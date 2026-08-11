import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChallengeScoringService } from './challenge-scoring.service';
import { ChallengesService } from './challenges.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('Challenges REST phase I', () => {
  it('never returns a challenge to a non-participant', async () => {
    const prisma = {
      challenge: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new ChallengesService(prisma as unknown as PrismaService);
    await expect(
      service.get('other-user', 'challenge-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.challenge.findFirst).toHaveBeenCalledTimes(1);
  });

  it('calculates challenge scores on the server with bounded bonuses', () => {
    const scoring = new ChallengeScoringService();
    expect(scoring.score(false, 1, 30, 10)).toBe(0);
    expect(scoring.score(true, 0, 30, 100)).toBe(200);
    expect(scoring.score(true, 30000, 30, 0)).toBe(100);
    expect(scoring.score(true, -100, 30, -2)).toBeGreaterThanOrEqual(100);
  });
});
