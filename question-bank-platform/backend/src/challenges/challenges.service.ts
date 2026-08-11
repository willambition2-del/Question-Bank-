import { BadRequestException, Injectable } from '@nestjs/common';
import { createPageMeta } from '../common/pagination/pagination';
import { educationNotFound } from '../education/education-errors';
import type { Prisma } from '../generated/prisma/client';
import {
  ChallengeMode,
  ChallengeParticipantStatus,
  ChallengeStatus,
  NotificationType,
  QuestionDifficulty,
} from '../generated/prisma/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { visibleQuestionWhere } from '../progress/progress-visibility';
import { RedisService } from '../redis/redis.service';
import {
  ChallengeQueryDto,
  CreateChallengeDto,
  InviteChallengeDto,
} from './dto/challenge.dto';

const participantInclude = {
  user: {
    select: {
      id: true,
      name: true,
      schoolName: true,
      companion: true,
    },
  },
} as const;

type ChallengeLobby = Prisma.ChallengeGetPayload<{
  include: { participants: { include: typeof participantInclude } };
}>;

@Injectable()
export class ChallengesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
  ) {}

  modes() {
    return [
      {
        mode: ChallengeMode.ONE_VS_ONE,
        minPlayers: 2,
        maxPlayers: 2,
        description: 'Head-to-head challenge',
      },
      {
        mode: ChallengeMode.TWO_VS_TWO,
        minPlayers: 4,
        maxPlayers: 4,
        description: 'Two teams with two players each',
      },
      {
        mode: ChallengeMode.LIGHTNING,
        minPlayers: 2,
        maxPlayers: 10,
        description: 'Fast timed questions',
      },
      {
        mode: ChallengeMode.SURVIVAL,
        minPlayers: 2,
        maxPlayers: 10,
        description: 'Continue while hearts remain',
      },
    ];
  }

  async create(userId: string, dto: CreateChallengeDto) {
    this.validate(dto);
    await this.assertScope(dto);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    return this.prisma.$transaction(async (tx) => {
      const challenge = await tx.challenge.create({
        data: {
          mode: dto.mode,
          status: ChallengeStatus.WAITING,
          subjectId: dto.subjectId,
          unitId: dto.unitId,
          lessonId: dto.lessonId,
          questionCount: dto.questionCount,
          timePerQuestionSeconds: dto.timePerQuestionSeconds,
          difficulty: dto.difficulty,
          maxPlayers:
            dto.mode === ChallengeMode.ONE_VS_ONE
              ? 2
              : dto.mode === ChallengeMode.TWO_VS_TWO
                ? 4
                : dto.maxPlayers,
          createdById: userId,
          expiresAt,
          settings: (dto.settings ?? {}) as Prisma.InputJsonObject,
        },
      });
      await tx.challengeParticipant.create({
        data: {
          challengeId: challenge.id,
          userId,
          status: ChallengeParticipantStatus.JOINED,
          heartsRemaining: dto.mode === ChallengeMode.SURVIVAL ? 3 : null,
          team: dto.mode === ChallengeMode.TWO_VS_TWO ? 1 : null,
        },
      });
      return challenge;
    });
  }

  async invite(userId: string, id: string, dto: InviteChallengeDto) {
    if (dto.userId === userId) {
      throw this.invalid('You cannot invite yourself', 'INVALID_INVITATION');
    }
    return this.prisma.$transaction(async (tx) => {
      const challenge = await tx.challenge.findFirst({
        where: {
          id,
          createdById: userId,
          status: {
            in: [ChallengeStatus.WAITING, ChallengeStatus.MATCHMAKING],
          },
        },
        include: { participants: true },
      });
      if (!challenge) {
        throw educationNotFound('CHALLENGE_NOT_FOUND', 'Challenge not found');
      }
      const invitedUser = await tx.user.findFirst({
        where: {
          id: dto.userId,
          role: 'STUDENT',
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!invitedUser) {
        throw educationNotFound(
          'INVITED_USER_NOT_FOUND',
          'Invited user not found',
        );
      }
      const active = challenge.participants.filter(
        (participant) => participant.status !== ChallengeParticipantStatus.LEFT,
      );
      if (active.length >= challenge.maxPlayers) {
        throw this.invalid('Challenge is full', 'CHALLENGE_FULL');
      }
      const team =
        challenge.mode === ChallengeMode.TWO_VS_TWO ? dto.team : null;
      if (challenge.mode === ChallengeMode.TWO_VS_TWO && !team) {
        throw this.invalid('team is required for TWO_VS_TWO invitations');
      }
      if (
        team &&
        active.filter((participant) => participant.team === team).length >= 2
      ) {
        throw this.invalid('Challenge team is full', 'CHALLENGE_TEAM_FULL');
      }
      const existing = challenge.participants.find(
        (participant) => participant.userId === dto.userId,
      );
      const participant = existing
        ? await tx.challengeParticipant.update({
            where: { id: existing.id },
            data: {
              status: ChallengeParticipantStatus.INVITED,
              team,
              completedAt: null,
            },
          })
        : await tx.challengeParticipant.create({
            data: {
              challengeId: id,
              userId: dto.userId,
              status: ChallengeParticipantStatus.INVITED,
              team,
              heartsRemaining:
                challenge.mode === ChallengeMode.SURVIVAL ? 3 : null,
            },
          });
      await this.notifications.create(tx, {
        userId: dto.userId,
        type: NotificationType.CHALLENGE_INVITE,
        title: 'Challenge invitation',
        body: 'You have been invited to a challenge',
        data: { challengeId: id, invitedByUserId: userId },
      });
      return participant;
    });
  }

  async acceptInvitation(userId: string, id: string) {
    return this.updateInvitation(userId, id, ChallengeParticipantStatus.JOINED);
  }

  async rejectInvitation(userId: string, id: string) {
    return this.updateInvitation(userId, id, ChallengeParticipantStatus.LEFT);
  }

  async cancel(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const challenge = await tx.challenge.findFirst({
        where: {
          id,
          createdById: userId,
          status: {
            in: [
              ChallengeStatus.CREATED,
              ChallengeStatus.MATCHMAKING,
              ChallengeStatus.WAITING,
              ChallengeStatus.COUNTDOWN,
            ],
          },
        },
      });
      if (!challenge) {
        throw educationNotFound('CHALLENGE_NOT_FOUND', 'Challenge not found');
      }
      await tx.challengeParticipant.updateMany({
        where: {
          challengeId: id,
          status: { not: ChallengeParticipantStatus.LEFT },
        },
        data: {
          status: ChallengeParticipantStatus.LEFT,
          completedAt: new Date(),
        },
      });
      return tx.challenge.update({
        where: { id },
        data: { status: ChallengeStatus.CANCELLED, completedAt: new Date() },
      });
    });
  }
  async list(userId: string, query: ChallengeQueryDto) {
    const where = {
      participants: { some: { userId } },
      ...(query.status ? { status: query.status } : {}),
      ...(query.mode ? { mode: query.mode } : {}),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.challenge.findMany({
        where,
        include: {
          participants: { include: participantInclude },
          _count: { select: { questions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.challenge.count({ where }),
    ]);
    return { items, meta: createPageMeta(query.page, query.limit, totalItems) };
  }

  async get(userId: string, id: string) {
    const challenge = await this.prisma.challenge.findFirst({
      where: { id, participants: { some: { userId } } },
      include: {
        participants: { include: participantInclude },
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            question: {
              select: {
                id: true,
                type: true,
                questionText: true,
                questionImageUrl: true,
                difficulty: true,
                subjectId: true,
                unitId: true,
                lessonId: true,
                options: {
                  select: {
                    id: true,
                    optionText: true,
                    optionImageUrl: true,
                    sortOrder: true,
                  },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    });
    if (!challenge)
      throw educationNotFound('CHALLENGE_NOT_FOUND', 'Challenge not found');
    const currentSortOrder = challenge.startedAt
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - challenge.startedAt.getTime()) /
              (challenge.timePerQuestionSeconds * 1000),
          ),
        )
      : 0;
    const questions =
      challenge.status === ChallengeStatus.COMPLETED
        ? challenge.questions
        : challenge.status === ChallengeStatus.IN_PROGRESS
          ? challenge.questions.filter(
              (question) => question.sortOrder === currentSortOrder,
            )
          : [];
    return {
      ...challenge,
      currentSortOrder:
        challenge.status === ChallengeStatus.IN_PROGRESS
          ? currentSortOrder
          : null,
      questions,
    };
  }

  async join(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const challenge = await tx.challenge.findUnique({
        where: { id },
        include: { participants: true },
      });
      if (!challenge)
        throw educationNotFound('CHALLENGE_NOT_FOUND', 'Challenge not found');
      if (
        challenge.status !== ChallengeStatus.WAITING &&
        challenge.status !== ChallengeStatus.MATCHMAKING
      ) {
        throw this.invalid('Challenge is not accepting participants');
      }
      const active = challenge.participants.filter(
        (participant) => participant.status !== ChallengeParticipantStatus.LEFT,
      );
      if (active.length >= challenge.maxPlayers)
        throw this.invalid('Challenge is full', 'CHALLENGE_FULL');
      const existing = challenge.participants.find(
        (participant) => participant.userId === userId,
      );
      if (challenge.mode === ChallengeMode.TWO_VS_TWO && !existing) {
        throw this.invalid(
          'TWO_VS_TWO participants must join through a team invitation',
          'TEAM_INVITATION_REQUIRED',
        );
      }
      return existing
        ? tx.challengeParticipant.update({
            where: { id: existing.id },
            data: {
              status: ChallengeParticipantStatus.JOINED,
              completedAt: null,
            },
          })
        : tx.challengeParticipant.create({
            data: {
              challengeId: id,
              userId,
              status: ChallengeParticipantStatus.JOINED,
              heartsRemaining:
                challenge.mode === ChallengeMode.SURVIVAL ? 3 : null,
            },
          });
    });
  }

  async leave(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const participant = await tx.challengeParticipant.findUnique({
        where: { challengeId_userId: { challengeId: id, userId } },
        include: { challenge: true },
      });
      if (!participant)
        throw educationNotFound('CHALLENGE_NOT_FOUND', 'Challenge not found');
      if (
        participant.challenge.status === ChallengeStatus.COMPLETED ||
        participant.challenge.status === ChallengeStatus.CANCELLED
      )
        return participant;
      const updated = await tx.challengeParticipant.update({
        where: { id: participant.id },
        data: {
          status: ChallengeParticipantStatus.LEFT,
          completedAt: new Date(),
        },
      });
      const remaining = await tx.challengeParticipant.count({
        where: {
          challengeId: id,
          status: { not: ChallengeParticipantStatus.LEFT },
        },
      });
      if (remaining === 0) {
        await tx.challenge.update({
          where: { id },
          data: { status: ChallengeStatus.CANCELLED, completedAt: new Date() },
        });
      }
      return updated;
    });
  }

  async ready(userId: string, id: string, retry = 0): Promise<ChallengeLobby> {
    const result = await this.redis.withLock(
      `lock:challenge-ready:${id}`,
      5_000,
      async () => {
        const candidates = await this.eligibleQuestionIds(id);
        return this.prisma.$transaction(
          async (tx) => {
            const participant = await tx.challengeParticipant.findUnique({
              where: { challengeId_userId: { challengeId: id, userId } },
              include: { challenge: true },
            });
            if (!participant) {
              throw educationNotFound(
                'CHALLENGE_NOT_FOUND',
                'Challenge not found',
              );
            }
            if (
              participant.challenge.status === ChallengeStatus.COUNTDOWN ||
              participant.challenge.status === ChallengeStatus.IN_PROGRESS
            ) {
              return tx.challenge.findUnique({
                where: { id },
                include: { participants: { include: participantInclude } },
              });
            }
            if (participant.challenge.status !== ChallengeStatus.WAITING) {
              throw this.invalid('Challenge is not waiting');
            }
            if (
              participant.status !== ChallengeParticipantStatus.JOINED &&
              participant.status !== ChallengeParticipantStatus.READY
            ) {
              throw this.invalid('Participant has not joined the challenge');
            }
            await tx.challengeParticipant.update({
              where: { id: participant.id },
              data: { status: ChallengeParticipantStatus.READY },
            });
            const active = await tx.challengeParticipant.findMany({
              where: {
                challengeId: id,
                status: { not: ChallengeParticipantStatus.LEFT },
              },
            });
            const minimumPlayers = this.minimumPlayers(
              participant.challenge.mode,
            );
            const allReady =
              active.length >= minimumPlayers &&
              active.every(
                (entry) => entry.status === ChallengeParticipantStatus.READY,
              );
            if (
              allReady &&
              participant.challenge.mode === ChallengeMode.TWO_VS_TWO
            ) {
              const teamOne = active.filter((entry) => entry.team === 1).length;
              const teamTwo = active.filter((entry) => entry.team === 2).length;
              if (teamOne !== 2 || teamTwo !== 2) {
                throw this.invalid(
                  'TWO_VS_TWO requires two ready players on each team',
                  'INVALID_TEAM_COMPOSITION',
                );
              }
            }
            if (allReady) {
              if (candidates.length < participant.challenge.questionCount) {
                throw this.invalid(
                  'Not enough eligible published questions',
                  'INSUFFICIENT_CHALLENGE_QUESTIONS',
                );
              }
              await tx.challengeQuestion.createMany({
                data: candidates
                  .slice(0, participant.challenge.questionCount)
                  .map((questionId, sortOrder) => ({
                    challengeId: id,
                    questionId,
                    sortOrder,
                  })),
                skipDuplicates: true,
              });
              await tx.challenge.updateMany({
                where: { id, status: ChallengeStatus.WAITING },
                data: {
                  status: ChallengeStatus.COUNTDOWN,
                  startedAt: new Date(Date.now() + 3_000),
                },
              });
            }
            return tx.challenge.findUnique({
              where: { id },
              include: { participants: { include: participantInclude } },
            });
          },
          { isolationLevel: 'Serializable' },
        );
      },
    );
    if (!result) {
      if (retry < 5) {
        await new Promise((resolve) => setTimeout(resolve, 25 * (retry + 1)));
        return this.ready(userId, id, retry + 1);
      }
      throw this.invalid(
        'Ready state is already being processed',
        'READY_BUSY',
      );
    }
    return result;
  }
  async result(userId: string, id: string) {
    const challenge = await this.prisma.challenge.findFirst({
      where: { id, participants: { some: { userId } } },
      include: {
        participants: {
          include: participantInclude,
          orderBy: [{ rank: 'asc' }, { score: 'desc' }],
        },
      },
    });
    if (!challenge)
      throw educationNotFound('CHALLENGE_NOT_FOUND', 'Challenge not found');
    if (challenge.status !== ChallengeStatus.COMPLETED)
      throw this.invalid('Challenge is not completed');
    return {
      challengeId: challenge.id,
      winnerUserId: challenge.winnerUserId,
      winnerTeam: challenge.winnerTeam,
      completedAt: challenge.completedAt,
      standings: challenge.participants,
    };
  }

  async history(userId: string, query: ChallengeQueryDto) {
    return this.list(userId, {
      ...query,
      status: query.status ?? ChallengeStatus.COMPLETED,
    });
  }

  async rematch(userId: string, id: string) {
    const previous = await this.prisma.challenge.findFirst({
      where: { id, participants: { some: { userId } } },
    });
    if (!previous)
      throw educationNotFound('CHALLENGE_NOT_FOUND', 'Challenge not found');
    return this.create(userId, {
      mode: previous.mode,
      subjectId: previous.subjectId ?? undefined,
      unitId: previous.unitId ?? undefined,
      lessonId: previous.lessonId ?? undefined,
      questionCount: previous.questionCount,
      timePerQuestionSeconds: previous.timePerQuestionSeconds,
      difficulty: previous.difficulty,
      maxPlayers: previous.maxPlayers,
      settings: previous.settings as Record<string, unknown>,
    });
  }

  private async updateInvitation(
    userId: string,
    id: string,
    status: ChallengeParticipantStatus,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const participant = await tx.challengeParticipant.findUnique({
        where: { challengeId_userId: { challengeId: id, userId } },
        include: { challenge: true },
      });
      if (
        !participant ||
        participant.status !== ChallengeParticipantStatus.INVITED ||
        (participant.challenge.status !== ChallengeStatus.WAITING &&
          participant.challenge.status !== ChallengeStatus.MATCHMAKING)
      ) {
        throw educationNotFound(
          'CHALLENGE_INVITATION_NOT_FOUND',
          'Challenge invitation not found',
        );
      }
      return tx.challengeParticipant.update({
        where: { id: participant.id },
        data: {
          status,
          completedAt:
            status === ChallengeParticipantStatus.LEFT ? new Date() : null,
        },
      });
    });
  }

  private async assertScope(dto: CreateChallengeDto) {
    if (dto.lessonId && (!dto.unitId || !dto.subjectId)) {
      throw this.invalid('lessonId requires unitId and subjectId');
    }
    if (dto.unitId && !dto.subjectId) {
      throw this.invalid('unitId requires subjectId');
    }
    if (dto.subjectId) {
      const subject = await this.prisma.subject.findFirst({
        where: {
          id: dto.subjectId,
          isActive: true,
          isPublished: true,
          deletedAt: null,
          curriculum: { is: { isActive: true, deletedAt: null } },
          grade: { is: { isActive: true, deletedAt: null } },
        },
        select: { id: true },
      });
      if (!subject) {
        throw educationNotFound('SUBJECT_NOT_FOUND', 'Subject not found');
      }
    }
    if (dto.unitId) {
      const unit = await this.prisma.unit.findFirst({
        where: {
          id: dto.unitId,
          subjectId: dto.subjectId,
          isActive: true,
          isPublished: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!unit) throw educationNotFound('UNIT_NOT_FOUND', 'Unit not found');
    }
    if (dto.lessonId) {
      const lesson = await this.prisma.lesson.findFirst({
        where: {
          id: dto.lessonId,
          unitId: dto.unitId,
          subjectId: dto.subjectId,
          isActive: true,
          isPublished: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!lesson) {
        throw educationNotFound('LESSON_NOT_FOUND', 'Lesson not found');
      }
    }
  }

  private minimumPlayers(mode: ChallengeMode) {
    return mode === ChallengeMode.TWO_VS_TWO ? 4 : 2;
  }
  private async eligibleQuestionIds(challengeId: string) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
    });
    if (!challenge)
      throw educationNotFound('CHALLENGE_NOT_FOUND', 'Challenge not found');
    const rows = await this.prisma.question.findMany({
      where: {
        ...visibleQuestionWhere(),
        ...(challenge.subjectId ? { subjectId: challenge.subjectId } : {}),
        ...(challenge.unitId ? { unitId: challenge.unitId } : {}),
        ...(challenge.lessonId ? { lessonId: challenge.lessonId } : {}),
        ...(challenge.difficulty !== QuestionDifficulty.MIXED
          ? { difficulty: challenge.difficulty }
          : {}),
      },
      select: { id: true },
      take: Math.max(challenge.questionCount * 3, challenge.questionCount),
    });
    return rows.map((row) => row.id).sort(() => Math.random() - 0.5);
  }

  private validate(dto: CreateChallengeDto) {
    if (dto.mode === ChallengeMode.ONE_VS_ONE && dto.maxPlayers !== 2) {
      throw this.invalid('ONE_VS_ONE challenges require exactly two players');
    }
  }

  private invalid(message: string, code = 'INVALID_CHALLENGE_STATE') {
    return new BadRequestException({ code, message });
  }
}
