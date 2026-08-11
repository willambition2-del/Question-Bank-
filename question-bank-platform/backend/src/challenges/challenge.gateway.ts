import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { AccessTokenPayload } from '../common/interfaces/jwt-payload.interface';
import { ChallengeStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ChallengeGameplayService } from './challenge-gameplay.service';
import { ChallengesService } from './challenges.service';
import { SubmitChallengeAnswerDto } from './dto/challenge-answer.dto';

type AuthenticatedSocket = Socket;

type ChallengeIdMessage = { challengeId: string };

@WebSocketGateway({
  namespace: '/challenges',
  cors: { origin: true, credentials: true },
})
export class ChallengeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;
  private readonly authenticatedUsers = new Map<string, string>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly challenges: ChallengesService,
    private readonly gameplay: ChallengeGameplayService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const auth = client.handshake.auth as Record<string, unknown>;
      const authorization = client.handshake.headers.authorization;
      const token =
        typeof auth.token === 'string'
          ? auth.token
          : typeof authorization === 'string' &&
              authorization.startsWith('Bearer ')
            ? authorization.slice(7)
            : null;
      if (!token) throw new Error('Missing access token');
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      const user = await this.prisma.user.findFirst({
        where: {
          id: payload.sub,
          username: payload.username,
          role: payload.role,
          tokenVersion: payload.tokenVersion,
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!user) throw new Error('Invalid access token');
      this.authenticatedUsers.set(client.id, user.id);
      const activeChallenges = await this.prisma.challengeParticipant.findMany({
        where: {
          userId: user.id,
          status: { notIn: ['LEFT', 'COMPLETED', 'ELIMINATED'] },
          challenge: {
            status: { in: ['WAITING', 'COUNTDOWN', 'IN_PROGRESS'] },
          },
        },
        select: { challengeId: true },
      });
      for (const entry of activeChallenges) {
        await client.join(this.room(entry.challengeId));
        const state = await this.challenges.get(user.id, entry.challengeId);
        client.emit('challenge:state', state);
      }
      client.emit('challenge:connection_restored', {
        connectedAt: new Date().toISOString(),
        challengeIds: activeChallenges.map((entry) => entry.challengeId),
      });
    } catch {
      client.emit('challenge:error', {
        code: 'UNAUTHORIZED',
        message: 'Authentication failed',
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = this.authenticatedUsers.get(client.id);
    for (const room of client.rooms) {
      if (room.startsWith('challenge:')) {
        client.to(room).emit('challenge:connection_lost', {
          userId,
        });
      }
    }
    this.authenticatedUsers.delete(client.id);
  }

  @SubscribeMessage('challenge:join')
  async join(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() message: ChallengeIdMessage,
  ) {
    return this.guard(client, async (userId) => {
      await this.challenges.get(userId, message.challengeId);
      const room = this.room(message.challengeId);
      await client.join(room);
      client.emit('challenge:joined', { challengeId: message.challengeId });
      client.to(room).emit('challenge:participant_joined', { userId });
    });
  }

  @SubscribeMessage('challenge:leave')
  async leave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() message: ChallengeIdMessage,
  ) {
    return this.guard(client, async (userId) => {
      await this.challenges.leave(userId, message.challengeId);
      const room = this.room(message.challengeId);
      await client.leave(room);
      client.to(room).emit('challenge:participant_left', { userId });
    });
  }

  @SubscribeMessage('challenge:ready')
  async ready(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() message: ChallengeIdMessage,
  ) {
    return this.guard(client, async (userId) => {
      const challenge = await this.challenges.ready(
        userId,
        message.challengeId,
      );
      const room = this.room(message.challengeId);
      this.server.to(room).emit('challenge:ready_updated', {
        challengeId: message.challengeId,
        participants: challenge?.participants,
      });
      if (challenge?.status === ChallengeStatus.COUNTDOWN) {
        await this.redis.setJson(
          `challenge:countdown:${message.challengeId}`,
          { startedAt: Date.now(), seconds: 3 },
          10,
        );
        this.server.to(room).emit('challenge:countdown', { seconds: 3 });
        await this.gameplay.start(userId, message.challengeId);
        const detail = await this.challenges.get(userId, message.challengeId);
        this.server.to(room).emit('challenge:started', {
          challengeId: message.challengeId,
          startedAt: detail.startedAt?.toISOString() ?? null,
        });
        const first = detail.questions[0];
        if (first)
          this.server.to(room).emit('challenge:question', {
            sortOrder: first.sortOrder,
            question: first.question,
          });
      }
    });
  }

  @SubscribeMessage('challenge:answer')
  async answer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() message: SubmitChallengeAnswerDto,
  ) {
    return this.guard(client, async (userId) => {
      const result = await this.gameplay.answer(userId, message);
      client.emit('challenge:round_completed', result);
      const room = this.room(message.challengeId);
      this.server.to(room).emit('challenge:score_updated', {
        userId,
        totalScore: result.totalScore,
        heartsRemaining: result.heartsRemaining,
      });
      if (result.challengeCompleted) {
        const completed = await this.challenges.result(
          userId,
          message.challengeId,
        );
        this.server.to(room).emit('challenge:completed', completed);
      }
    });
  }

  @SubscribeMessage('challenge:sync')
  async sync(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() message: ChallengeIdMessage,
  ) {
    return this.guard(client, async (userId) => {
      await this.gameplay.expireTimedOut(message.challengeId);
      const state = await this.challenges.get(userId, message.challengeId);
      client.emit('challenge:state', state);
      return state;
    });
  }

  @SubscribeMessage('challenge:heartbeat')
  async heartbeat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() message: ChallengeIdMessage,
  ) {
    return this.guard(client, async (userId) => {
      await this.redis.setJson(
        `challenge:heartbeat:${message.challengeId}:${userId}`,
        { at: Date.now() },
        30,
      );
      return { event: 'challenge:heartbeat', data: { acknowledged: true } };
    });
  }

  @SubscribeMessage('challenge:rematch')
  async rematch(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() message: ChallengeIdMessage,
  ) {
    return this.guard(client, async (userId) => {
      const challenge = await this.challenges.rematch(
        userId,
        message.challengeId,
      );
      client.emit('challenge:joined', {
        challengeId: challenge.id,
        rematch: true,
      });
    });
  }

  private async guard(
    client: AuthenticatedSocket,
    work: (userId: string) => Promise<unknown>,
  ) {
    const userId = this.authenticatedUsers.get(client.id);
    if (!userId) {
      client.emit('challenge:error', {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }
    try {
      return await work(userId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Challenge operation failed';
      client.emit('challenge:error', {
        code: 'CHALLENGE_ERROR',
        message,
      });
    }
  }

  private room(challengeId: string) {
    return `challenge:${challengeId}`;
  }
}
