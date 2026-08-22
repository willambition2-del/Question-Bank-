import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { join } from 'path';
import { corsOrigins } from './config/environment';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('API_PREFIX', 'api/v1');
  const production = config.get<string>('NODE_ENV') === 'production';
  const allowedOrigins = corsOrigins(config.get<string>('CORS_ORIGINS'));

  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  app.setGlobalPrefix(apiPrefix);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      hsts: production
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.enableCors({
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
    origin(
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) {
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, '');
      if (!production && allowedOrigins.length === 0) {
        return callback(null, true);
      }
      return allowedOrigins.includes(normalized)
        ? callback(null, true)
        : callback(new Error('Origin is not allowed by CORS'));
    },
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Question Bank API')
    .setDescription(
      '\u0648\u0627\u062c\u0647\u0629 \u0628\u0631\u0645\u062c\u0629 \u062a\u0637\u0628\u064a\u0642 \u0628\u0646\u0643 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0644\u0644\u0635\u0641 \u0627\u0644\u062b\u0627\u0644\u062b \u0627\u0644\u062b\u0627\u0646\u0648\u064a',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
    },
  });
}
