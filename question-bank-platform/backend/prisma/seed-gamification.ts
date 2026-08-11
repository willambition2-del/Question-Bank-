import type { PrismaClient } from '../src/generated/prisma/client';
import {
  AchievementCategory,
  AchievementConditionType,
  DailyTaskType,
} from '../src/generated/prisma/enums';

export async function seedGamification(prisma: PrismaClient): Promise<void> {
  const tasks = [
    {
      key: 'answer-10',
      title: 'Answer 10 questions',
      description: 'Answer ten questions today',
      taskType: DailyTaskType.ANSWER_QUESTIONS,
      targetValue: 10,
      pointsReward: 30,
    },
    {
      key: 'correct-5',
      title: 'Five correct answers',
      description: 'Answer five questions correctly today',
      taskType: DailyTaskType.CORRECT_ANSWERS,
      targetValue: 5,
      pointsReward: 25,
    },
    {
      key: 'complete-quiz',
      title: 'Complete a quiz',
      description: 'Finish one quiz today',
      taskType: DailyTaskType.COMPLETE_QUIZ,
      targetValue: 1,
      pointsReward: 20,
    },
    {
      key: 'review-3-mistakes',
      title: 'Review mistakes',
      description: 'Review three previous mistakes',
      taskType: DailyTaskType.REVIEW_MISTAKES,
      targetValue: 3,
      pointsReward: 25,
    },
  ];
  for (const task of tasks) {
    await prisma.dailyTaskDefinition.upsert({
      where: { key: task.key },
      update: { ...task, isActive: true },
      create: task,
    });
  }

  const achievements = [
    {
      key: 'first-correct-answer',
      name: 'First Step',
      description: 'Answer your first question correctly',
      category: AchievementCategory.QUESTIONS,
      conditionType: AchievementConditionType.CORRECT_ANSWERS,
      conditionValue: 1,
      pointsReward: 10,
      sortOrder: 1,
    },
    {
      key: 'hundred-questions',
      name: 'Dedicated Learner',
      description: 'Answer one hundred questions',
      category: AchievementCategory.QUESTIONS,
      conditionType: AchievementConditionType.ANSWERED_QUESTIONS,
      conditionValue: 100,
      pointsReward: 100,
      sortOrder: 2,
    },
    {
      key: 'ten-quizzes',
      name: 'Quiz Explorer',
      description: 'Complete ten quizzes',
      category: AchievementCategory.QUIZZES,
      conditionType: AchievementConditionType.QUIZZES_COMPLETED,
      conditionValue: 10,
      pointsReward: 100,
      sortOrder: 3,
    },
    {
      key: 'first-quiz',
      name: 'Quiz Debut',
      description: 'Complete your first quiz',
      category: AchievementCategory.QUIZZES,
      conditionType: AchievementConditionType.QUIZZES_COMPLETED,
      conditionValue: 1,
      pointsReward: 20,
      sortOrder: 3,
    },
    {
      key: 'thousand-points',
      name: 'XP Champion',
      description: 'Earn one thousand lifetime points',
      category: AchievementCategory.SPECIAL,
      conditionType: AchievementConditionType.TOTAL_POINTS,
      conditionValue: 1000,
      pointsReward: 200,
      sortOrder: 4,
    },
    {
      key: 'subject-mastery',
      name: 'Subject Master',
      description: 'Master your first subject',
      category: AchievementCategory.SUBJECT_MASTERY,
      conditionType: AchievementConditionType.SUBJECT_MASTERY,
      conditionValue: 1,
      pointsReward: 150,
      sortOrder: 5,
    },
    {
      key: 'fast-answers',
      name: 'Quick Thinker',
      description: 'Earn twenty-five fast-answer bonuses',
      category: AchievementCategory.ACCURACY,
      conditionType: AchievementConditionType.FAST_ANSWERS,
      conditionValue: 25,
      pointsReward: 100,
      sortOrder: 6,
    },
    {
      key: 'challenge-winner',
      name: 'Challenge Winner',
      description: 'Win ten challenges',
      category: AchievementCategory.CHALLENGES,
      conditionType: AchievementConditionType.CHALLENGES_WON,
      conditionValue: 10,
      pointsReward: 200,
      sortOrder: 7,
    },
    {
      key: 'seven-day-streak',
      name: 'One Full Week',
      description: 'Maintain a seven-day learning streak',
      category: AchievementCategory.STREAK,
      conditionType: AchievementConditionType.CURRENT_STREAK,
      conditionValue: 7,
      pointsReward: 150,
      sortOrder: 4,
    },
  ];
  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { key: achievement.key },
      update: { ...achievement, isActive: true },
      create: achievement,
    });
  }
}
