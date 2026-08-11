import { ChallengeGateway } from './challenge.gateway';

jest.mock('../generated/prisma/enums', () => ({
  ChallengeStatus: {
    WAITING: 'WAITING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
  },
}));
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('./challenge-gameplay.service', () => ({
  ChallengeGameplayService: class ChallengeGameplayService {},
}));
jest.mock('./challenges.service', () => ({
  ChallengesService: class ChallengesService {},
}));

describe('ChallengeGateway authentication', () => {
  it('uses the verified JWT identity and ignores a client-supplied userId', async () => {
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'verified-user',
        username: 'student',
        role: 'STUDENT',
        tokenVersion: 0,
      }),
    };
    const config = { getOrThrow: jest.fn().mockReturnValue('secret') };
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'verified-user' }) },
      challengeParticipant: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const challenges = {
      get: jest.fn().mockResolvedValue({ id: 'challenge-1' }),
    };
    const socket = {
      id: 'socket-1',
      handshake: {
        auth: { token: 'valid-token', userId: 'attacker-user' },
        headers: {},
      },
      rooms: new Set<string>(['socket-1']),
      emit: jest.fn(),
      disconnect: jest.fn(),
      join: jest.fn().mockResolvedValue(undefined),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    };
    const gateway = new ChallengeGateway(
      jwt as never,
      config as never,
      prisma as never,
      {} as never,
      challenges as never,
      {} as never,
    );
    await gateway.handleConnection(socket as never);
    await gateway.join(socket as never, { challengeId: 'challenge-1' });
    expect(challenges.get).toHaveBeenCalledWith('verified-user', 'challenge-1');
    expect(challenges.get).not.toHaveBeenCalledWith(
      'attacker-user',
      'challenge-1',
    );
  });
});
