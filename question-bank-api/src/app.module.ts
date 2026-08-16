import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { ChallengesModule } from './challenges/challenges.module';
import { validateEnvironment } from './config/environment';
import { ContentModule } from './content/content.module';
import { EducationModule } from './education/education.module';
import { GamificationModule } from './gamification/gamification.module';
import { HealthModule } from './health/health.module';
import { IntelligentServicesModule } from './intelligent-services/intelligent-services.module';
import { LeaderboardsModule } from './leaderboards/leaderboards.module';
import { RequestLoggingInterceptor } from './logging/request-logging.interceptor';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { QuizModule } from './quiz/quiz.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { RedisModule } from './redis/redis.module';
import { RedisThrottlerStorage } from './redis/redis-throttler.storage';
import { StatisticsModule } from './statistics/statistics.module';
import { UpdatesModule } from './updates/updates.module';
import { UsersModule } from './users/users.module';
import { SupportModule } from './support/support.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { BillingModule } from './billing/billing.module';
import { SettingsModule } from './settings/settings.module';
import { StudyResourcesModule } from './study-resources/study-resources.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      skipProcessEnv: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        storage,
        throttlers: [{ name: 'global', ttl: 60_000, limit: 100 }],
      }),
    }),
    QuizModule,
    HealthModule,
    IntelligentServicesModule,
    UsersModule,
    AuthModule,
    EducationModule,
    ContentModule,
    GamificationModule,
    StatisticsModule,
    RecommendationsModule,
    LeaderboardsModule,
    UpdatesModule,
    NotificationsModule,
    ChallengesModule,
    SupportModule,
    AnnouncementsModule,
    BillingModule,
    SettingsModule,
    StudyResourcesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule {}
