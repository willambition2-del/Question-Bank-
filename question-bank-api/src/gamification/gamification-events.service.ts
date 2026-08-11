import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { DailyTaskType, PointType } from '../generated/prisma/enums';
import { AchievementsService } from './achievements.service';
import { DailyTasksService } from './daily-tasks.service';
import { AppDateService } from './app-date.service';
import { PointsService } from './points.service';
import { StreakService } from './streak.service';

@Injectable()
export class GamificationEventsService {
  constructor(
    private readonly points: PointsService,
    private readonly tasks: DailyTasksService,
    private readonly streaks: StreakService,
    private readonly dates: AppDateService,
    private readonly achievements: AchievementsService,
  ) {}

  async answer(
    tx: Prisma.TransactionClient,
    userId: string,
    attemptId: string,
    questionId: string,
    isCorrect: boolean,
    scoring: { correctPoints: number; speedBonus: number },
  ) {
    await this.tasks.progress(tx, userId, DailyTaskType.ANSWER_QUESTIONS);
    if (isCorrect) {
      await this.points.award(tx, userId, {
        amount: scoring.correctPoints,
        type: PointType.QUIZ_CORRECT,
        idempotencyKey: `quiz-correct:${attemptId}:${questionId}`,
        referenceType: 'QuizAnswer',
        referenceId: `${attemptId}:${questionId}`,
      });
      await this.tasks.progress(tx, userId, DailyTaskType.CORRECT_ANSWERS);
      if (scoring.speedBonus > 0) {
        await this.points.award(tx, userId, {
          amount: scoring.speedBonus,
          type: PointType.FAST_ANSWER,
          idempotencyKey: `fast-answer:${attemptId}:${questionId}`,
          referenceType: 'QuizAnswer',
          referenceId: `${attemptId}:${questionId}`,
        });
      }
    }
    await this.achievements.evaluate(tx, userId);
  }

  async quizCompleted(
    tx: Prisma.TransactionClient,
    userId: string,
    attemptId: string,
  ) {
    await this.points.award(tx, userId, {
      amount: 20,
      type: PointType.QUIZ_COMPLETE,
      idempotencyKey: `quiz-complete:${attemptId}`,
      referenceType: 'QuizAttempt',
      referenceId: attemptId,
    });
    await this.tasks.progress(tx, userId, DailyTaskType.COMPLETE_QUIZ);
    await this.streaks.recordActivity(tx, userId);
    await this.achievements.evaluate(tx, userId);
  }
  async challengeCompleted(
    tx: Prisma.TransactionClient,
    userId: string,
    challengeId: string,
    won: boolean,
  ) {
    const date = this.dates.today();
    await tx.studentDailyActivity.upsert({
      where: { userId_date: { userId, date } },
      update: { challengesPlayed: { increment: 1 } },
      create: { userId, date, challengesPlayed: 1 },
    });
    await this.tasks.progress(tx, userId, DailyTaskType.PLAY_CHALLENGE);
    if (won) {
      await this.points.award(tx, userId, {
        amount: 100,
        type: PointType.CHALLENGE_WIN,
        idempotencyKey: `challenge-win:${challengeId}:${userId}`,
        referenceType: 'Challenge',
        referenceId: challengeId,
      });
      await this.tasks.progress(tx, userId, DailyTaskType.WIN_CHALLENGE);
    }
    await this.achievements.evaluate(tx, userId);
  }
}
