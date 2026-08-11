import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { INestApplicationContext } from '@nestjs/common';
import type { Server, ServerOptions } from 'socket.io';
import type Redis from 'ioredis';
import { corsOrigins } from '../config/environment';
import { RedisService } from './redis.service';

export class SocketIoRedisAdapter extends IoAdapter {
  private adapterFactory?: ReturnType<typeof createAdapter>;
  private clients: Redis[] = [];

  constructor(
    app: INestApplicationContext,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    super(app);
  }

  async connect() {
    const clients = this.redis.createPubSubClients();
    if (!clients) return;
    this.clients = clients;
    await Promise.all(clients.map((client) => client.connect()));
    this.adapterFactory = createAdapter(clients[0], clients[1]);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const origins = corsOrigins(this.config.get<string>('CORS_ORIGINS'));
    const production =
      this.config.get<string>('NODE_ENV', 'development') === 'production';
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        credentials: true,
        origin: production ? origins : origins.length > 0 ? origins : true,
      },
    }) as unknown as Server;
    if (this.adapterFactory) server.adapter(this.adapterFactory);
    return server;
  }

  async close() {
    await Promise.all(this.clients.map((client) => client.quit()));
  }
}
