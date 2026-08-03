import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import {
  ChallengeMode,
  ChallengeParticipantStatus,
  ChallengeStatus,
  NotificationType,
  QuestionType,
} from '../generated/prisma/enums';
import { GamificationEventsService } from '../gamification/gamification-events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ChallengeScoringService } from './challenge-scoring.service';
import { SubmitChallengeAnswerDto } from './dto/challenge-answer.dto';

@Injectable()
export class ChallengeGameplayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ChallengeScoringService,
    private readonly gamification: GamificationEventsService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
  ) {}

  async start(userId: string, challengeId: string) {
    return this.prisma.$transaction(async (tx) => {
      const participant = await tx.challengeParticipant.findUnique({
        where: { challengeId_userId: { challengeId, userId } },
        include: { challenge: true },
      });
      if (!participant)
        throw this.invalid('User is not a challenge participant');
      if (participant.challenge.status === ChallengeStatus.IN_PROGRESS)
        return participant.challenge;
      if (participant.challenge.status !== ChallengeStatus.COUNTDOWN)
        throw this.invalid('Challenge countdown has not started');
      await tx.challengeParticipant.updateMany({
        where: {
          challengeId,
          status: ChallengeParticipantStatus.READY,
        },
        data: { status: ChallengeParticipantStatus.PLAYING },
      });
      return tx.challenge.update({
        where: { id: challengeId },
        data: {
          status: ChallengeStatus.IN_PROGRESS,
          startedAt: participant.challenge.startedAt ?? new Date(),
        },
      });
    });
  }

  async answer(userId: string, dto: SubmitChallengeAnswerDto) {
    await this.expireTimedOut(dto.challengeId);
    const result = await this.redis.withLock(
      `lock:challenge-answer:${dto.challengeId}:${userId}:${dto.questionId}`,
      5000,
      () => this.recordAnswer(userId, dto),
    );
    if (!result)
      throw this.invalid('Answer is already being processed', 'ANSWER_BUSY');
    return result;
  }

  async expireTimedOut(challengeId: string) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      select: {
        id: true,
        status: true,
        startedAt: true,
        questionCount: true,
        timePerQuestionSeconds: true,
      },
    });
    if (
      !challenge ||
      challenge.status !== ChallengeStatus.IN_PROGRESS ||
      !challenge.startedAt
    ) {
      return false;
    }
    const deadline =
      challenge.startedAt.getTime() +
      challenge.questionCount * challenge.timePerQuestionSeconds * 1000;
    if (Date.now() < deadline) return false;
    return this.prisma.$transaction(async (tx) => {
      await tx.challengeParticipant.updateMany({
        where: {
          challengeId,
          status: ChallengeParticipantStatus.PLAYING,
        },
        data: {
          status: ChallengeParticipantStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      return this.finalizeIfComplete(tx, challengeId);
    });
  }
  private async recordAnswer(userId: string, dto: SubmitChallengeAnswerDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const participant = await tx.challengeParticipant.findUnique({
          where: {
            challengeId_userId: {
              challengeId: dto.challengeId,
              userId,
            },
          },
          include: { challenge: true },
        });
        if (!participant)
          throw this.invalid('User is not a challenge participant');
        if (participant.challenge.status !== ChallengeStatus.IN_PROGRESS)
          throw this.invalid('Challenge is not in progress');
        if (participant.status !== ChallengeParticipantStatus.PLAYING)
          throw this.invalid('Participant is not playing');

        const challengeQuestion = await tx.challengeQuestion.findUnique({
          where: {
            challengeId_questionId: {
              challengeId: dto.challengeId,
              questionId: dto.questionId,
            },
          },
          include: { question: { include: { options: true } } },
        });
        if (!challengeQuestion)
          throw this.invalid('Question is not part of this challenge');

        const question = challengeQuestion.question;
        const selectedOption = dto.selectedOptionId
          ? question.options.find(
              (option) => option.id === dto.selectedOptionId,
            )
          : undefined;
        if (dto.selectedOptionId && !selectedOption)
          throw this.invalid('Selected option does not belong to the question');
        const isCorrect =
          question.type === QuestionType.TRUE_FALSE
            ? dto.selectedBoolean !== undefined &&
              dto.selectedBoolean === question.correctBoolean
            : selectedOption?.isCorrect === true;
        if (
          question.type === QuestionType.TRUE_FALSE
            ? dto.selectedBoolean === undefined ||
              dto.selectedOptionId !== undefined
            : dto.selectedOptionId === undefined ||
              dto.selectedBoolean !== undefined
        ) {
          throw this.invalid(
            'Submit exactly one answer matching the question type',
          );
        }

        const now = new Date();
        const limitMs = participant.challenge.timePerQuestionSeconds * 1000;
        const challengeStartedAt = participant.challenge.startedAt?.getTime();
        if (!challengeStartedAt) {
          throw this.invalid('Challenge start time is missing');
        }
        const roundStartedAt =
          challengeStartedAt + challengeQuestion.sortOrder * limitMs;
        const roundEndsAt = roundStartedAt + limitMs;
        if (now.getTime() < roundStartedAt) {
          throw this.invalid(
            'Question round has not started',
            'ROUND_NOT_STARTED',
          );
        }
        if (now.getTime() >= roundEndsAt) {
          throw this.invalid('Question round has expired', 'QUESTION_TIMEOUT');
        }
        const currentSortOrder = Math.floor(
          (now.getTime() - challengeStartedAt) / limitMs,
        );
        if (challengeQuestion.sortOrder !== currentSortOrder) {
          throw this.invalid(
            'Question is not the current server round',
            'OUT_OF_TURN_ANSWER',
          );
        }
        const responseTimeMs = now.getTime() - roundStartedAt;
        const nextCombo = isCorrect ? participant.combo + 1 : 0;
        const pointsEarned = this.scoring.score(
          isCorrect,
          responseTimeMs,
          participant.challenge.timePerQuestionSeconds,
          nextCombo,
        );
        const heartsRemaining =
          participant.heartsRemaining === null
            ? null
            : Math.max(0, participant.heartsRemaining - (isCorrect ? 0 : 1));

        await tx.challengeAnswer.create({
          data: {
            challengeId: dto.challengeId,
            participantId: participant.id,
            questionId: dto.questionId,
            selectedOptionId: dto.selectedOptionId,
            selectedBoolean: dto.selectedBoolean,
            isCorrect,
            responseTimeMs,
            pointsEarned,
          },
        });
        const answeredCount = await tx.challengeAnswer.count({
          where: { participantId: participant.id },
        });
        const terminal =
          answeredCount >= participant.challenge.questionCount ||
          (participant.challenge.mode === ChallengeMode.SURVIVAL &&
            heartsRemaining === 0);
        const updated = await tx.challengeParticipant.update({
          where: { id: participant.id },
          data: {
            score: { increment: pointsEarned },
            correctAnswers: isCorrect ? { increment: 1 } : undefined,
            wrongAnswers: isCorrect ? undefined : { increment: 1 },
            combo: nextCombo,
            heartsRemaining,
            status: terminal
              ? heartsRemaining === 0
                ? ChallengeParticipantStatus.ELIMINATED
                : ChallengeParticipantStatus.COMPLETED
              : undefined,
            completedAt: terminal ? now : undefined,
          },
        });
        const completed = await this.finalizeIfComplete(
          tx,
          participant.challenge.id,
        );
        return {
          isCorrect,
          pointsEarned,
          totalScore: updated.score,
          heartsRemaining,
          responseTimeMs,
          challengeCompleted: completed,
          currentSortOrder: challengeQuestion.sortOrder,
          roundEndsAt: new Date(roundEndsAt),
        };
      });
    } catch (error) {
      if (this.prismaCode(error) === 'P2002')
        throw this.invalid(
          'Question has already been answered',
          'DUPLICATE_ANSWER',
        );
      throw error;
    }
  }

  private async finalizeIfComplete(
    tx: Prisma.TransactionClient,
    challengeId: string,
  ) {
    const challenge = await tx.challenge.findUniqueOrThrow({
      where: { id: challengeId },
      select: { mode: true },
    });
    const participants = await tx.challengeParticipant.findMany({
      where: {
        challengeId,
        status: { not: ChallengeParticipantStatus.LEFT },
      },
      orderBy: [{ score: 'desc' }, { completedAt: 'asc' }],
    });
    if (
      participants.length < 1 ||
      participants.some(
        (participant) =>
          participant.status === ChallengeParticipantStatus.PLAYING ||
          participant.status === ChallengeParticipantStatus.READY ||
          participant.status === ChallengeParticipantStatus.JOINED ||
          participant.status === ChallengeParticipantStatus.INVITED,
      )
    ) {
      return false;
    }

    let winnerUserId: string | null = null;
    let winnerTeam: number | null = null;
    const rankByParticipant = new Map<string, number>();
    if (challenge.mode === ChallengeMode.TWO_VS_TWO) {
      const teamScores = new Map<number, number>();
      for (const participant of participants) {
        const team = participant.team;
        if (team !== null) {
          teamScores.set(team, (teamScores.get(team) ?? 0) + participant.score);
        }
      }
      const orderedTeams = [...teamScores.entries()].sort(
        ([leftTeam, leftScore], [rightTeam, rightScore]) =>
          rightScore - leftScore || leftTeam - rightTeam,
      );
      if (
        orderedTeams.length > 0 &&
        (orderedTeams.length === 1 || orderedTeams[0][1] > orderedTeams[1][1])
      ) {
        winnerTeam = orderedTeams[0][0];
      }
      let previousScore: number | undefined;
      let teamRank = 0;
      orderedTeams.forEach(([team, score], index) => {
        if (score !== previousScore) teamRank = index + 1;
        previousScore = score;
        participants
          .filter((participant) => participant.team === team)
          .forEach((participant) =>
            rankByParticipant.set(participant.id, teamRank),
          );
      });
    } else {
      const topScore = participants[0]?.score ?? 0;
      const top = participants.filter(
        (participant) => participant.score === topScore,
      );
      winnerUserId = top.length === 1 ? top[0].userId : null;
      let previousScore: number | undefined;
      let rank = 0;
      participants.forEach((participant, index) => {
        if (participant.score !== previousScore) rank = index + 1;
        previousScore = participant.score;
        rankByParticipant.set(participant.id, rank);
      });
    }

    for (const participant of participants) {
      await tx.challengeParticipant.update({
        where: { id: participant.id },
        data: {
          rank: rankByParticipant.get(participant.id) ?? null,
          status: ChallengeParticipantStatus.COMPLETED,
          completedAt: participant.completedAt ?? new Date(),
        },
      });
      const isWinner =
        challenge.mode === ChallengeMode.TWO_VS_TWO
          ? participant.team === winnerTeam && winnerTeam !== null
          : participant.userId === winnerUserId;
      await this.gamification.challengeCompleted(
        tx,
        participant.userId,
        challengeId,
        isWinner,
      );
      await this.notifications.create(tx, {
        userId: participant.userId,
        type: NotificationType.CHALLENGE_RESULT,
        title: 'Challenge result',
        body:
          winnerUserId === null && winnerTeam === null
            ? 'The challenge ended in a draw'
            : isWinner
              ? 'You won the challenge'
              : 'Challenge completed',
        data: {
          challengeId,
          result:
            winnerUserId === null && winnerTeam === null
              ? 'DRAW'
              : isWinner
                ? 'WIN'
                : 'LOSS',
        },
        dedupeKey: `challenge-result:${challengeId}:${participant.userId}`,
      });
    }
    await tx.challenge.update({
      where: { id: challengeId },
      data: {
        status: ChallengeStatus.COMPLETED,
        completedAt: new Date(),
        winnerUserId,
        winnerTeam,
      },
    });
    return true;
  }
  private prismaCode(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : null;
  }

  private invalid(message: string, code = 'INVALID_CHALLENGE_STATE') {
    return new BadRequestException({ code, message });
  }
}
