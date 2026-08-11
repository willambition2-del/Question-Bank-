import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GamificationModule } from '../gamification/gamification.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChallengeScoringService } from './challenge-scoring.service';
import { ChallengeGateway } from './challenge.gateway';
import { ChallengeGameplayService } from './challenge-gameplay.service';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';
import { MatchmakingService } from './matchmaking.service';

@Module({
  imports: [AuthModule, GamificationModule, NotificationsModule],
  controllers: [ChallengesController],
  providers: [
    ChallengesService,
    MatchmakingService,
    ChallengeScoringService,
    ChallengeGameplayService,
    ChallengeGateway,
  ],
  exports: [
    ChallengesService,
    MatchmakingService,
    ChallengeScoringService,
    ChallengeGameplayService,
  ],
})
export class ChallengesModule {}
