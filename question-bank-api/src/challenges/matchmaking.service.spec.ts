import { ChallengeMode, QuestionDifficulty } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { MatchmakingService } from './matchmaking.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('MatchmakingService', () => {
  it('creates a real waiting entry without manufacturing a bot opponent', async () => {
    const tx = {
      challengeParticipant: { findFirst: jest.fn().mockResolvedValue(null) },
      userPoints: { findUnique: jest.fn().mockResolvedValue({ level: 2 }) },
      challenge: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 'challenge-1',
          status: 'MATCHMAKING',
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    const service = new MatchmakingService(
      prisma as unknown as PrismaService,
      {
        enqueue: jest.fn().mockResolvedValue(undefined),
        dequeue: jest.fn().mockResolvedValue(undefined),
      } as never,
    );
    const result = await service.findOrCreate('user-1', {
      mode: ChallengeMode.ONE_VS_ONE,
      difficulty: QuestionDifficulty.MEDIUM,
      questionCount: 10,
      timePerQuestionSeconds: 30,
    });
    expect(result.matched).toBe(false);
    expect(tx.challenge.create).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(tx.challenge.create.mock.calls)).not.toContain('BOT');
  });
});
