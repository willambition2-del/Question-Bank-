import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';
import { AppDateService } from './app-date.service';
import { DailyTasksController } from './daily-tasks.controller';
import { DailyTasksService } from './daily-tasks.service';
import { GamificationController } from './gamification.controller';
import { GamificationEventsService } from './gamification-events.service';
import { LevelService } from './level.service';
import { PointsService } from './points.service';
import { StreakService } from './streak.service';

@Module({
  imports: [NotificationsModule],
  controllers: [
    GamificationController,
    AchievementsController,
    DailyTasksController,
  ],
  providers: [
    AppDateService,
    LevelService,
    PointsService,
    StreakService,
    DailyTasksService,
    AchievementsService,
    GamificationEventsService,
  ],
  exports: [
    LevelService,
    PointsService,
    StreakService,
    DailyTasksService,
    AchievementsService,
    GamificationEventsService,
  ],
})
export class GamificationModule {}
