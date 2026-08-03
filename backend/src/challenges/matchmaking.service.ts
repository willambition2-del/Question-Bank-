import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ChallengeMode,
  ChallengeParticipantStatus,
  ChallengeStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MatchmakingDto } from './dto/challenge.dto';

@Injectable()
export class MatchmakingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findOrCreate(userId: string, dto: MatchmakingDto) {
    if (dto.mode === ChallengeMode.TWO_VS_TWO) {
      throw new BadRequestException({
        code: 'TEAM_LOBBY_REQUIRED',
        message: 'TWO_VS_TWO challenges must be created as invitation lobbies',
      });
    }
    const result = await this.prisma.$transaction(
      async (tx) => {
        const current = await tx.challengeParticipant.findFirst({
          where: {
            userId,
            challenge: {
              status: {
                in: [ChallengeStatus.MATCHMAKING, ChallengeStatus.WAITING],
              },
            },
          },
          include: { challenge: true },
          orderBy: { joinedAt: 'desc' },
        });
        if (current) {
          return {
            matched: current.challenge.status === ChallengeStatus.WAITING,
            challenge: current.challenge,
          };
        }
        const userPoints = await tx.userPoints.findUnique({
          where: { userId },
        });
        const candidates = await tx.challenge.findMany({
          where: {
            status: ChallengeStatus.MATCHMAKING,
            mode: dto.mode,
            subjectId: dto.subjectId,
            difficulty: dto.difficulty,
            createdById: { not: userId },
            expiresAt: { gt: new Date() },
          },
          include: {
            participants: {
              include: {
                user: { select: { points: { select: { level: true } } } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
          take: 20,
        });
        const level = userPoints?.level ?? 1;
        const match = candidates.find(
          (candidate) =>
            candidate.participants.length < candidate.maxPlayers &&
            candidate.participants.every(
              (participant) =>
                Math.abs((participant.user.points?.level ?? 1) - level) <= 2,
            ),
        );
        if (match) {
          await tx.challengeParticipant.create({
            data: {
              challengeId: match.id,
              userId,
              status: ChallengeParticipantStatus.JOINED,
            },
          });
          const challenge = await tx.challenge.update({
            where: { id: match.id },
            data: { status: ChallengeStatus.WAITING },
          });
          return { matched: true, challenge };
        }
        const challenge = await tx.challenge.create({
          data: {
            mode: dto.mode,
            status: ChallengeStatus.MATCHMAKING,
            subjectId: dto.subjectId,
            questionCount: dto.questionCount,
            timePerQuestionSeconds: dto.timePerQuestionSeconds,
            difficulty: dto.difficulty,
            maxPlayers: 2,
            createdById: userId,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            settings: { source: 'matchmaking' },
            participants: {
              create: {
                userId,
                status: ChallengeParticipantStatus.JOINED,
              },
            },
          },
        });
        return { matched: false, challenge };
      },
      { isolationLevel: 'Serializable' },
    );
    const queue = `matchmaking:${dto.mode}:${dto.subjectId ?? 'all'}:${dto.difficulty}`;
    if (result.matched) {
      await this.redis.dequeue(queue, userId);
      if (result.challenge.createdById) {
        await this.redis.dequeue(queue, result.challenge.createdById);
      }
    } else {
      await this.redis.enqueue(queue, userId);
    }
    return result;
  }
}
