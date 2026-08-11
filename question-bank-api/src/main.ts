import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { JsonLogger } from './logging/json.logger';
import { RedisService } from './redis/redis.service';
import { SocketIoRedisAdapter } from './redis/socket-io-redis.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: new JsonLogger() });
  configureApp(app);

  const config = app.get(ConfigService);
  const socketAdapter = new SocketIoRedisAdapter(
    app,
    app.get(RedisService),
    config,
  );
  await socketAdapter.connect();
  app.useWebSocketAdapter(socketAdapter);

  const port = config.get<number>('PORT', 3000);
  const host = config.get<string>('HOST', '0.0.0.0');
  await app.listen(port, host);
}

void bootstrap();
