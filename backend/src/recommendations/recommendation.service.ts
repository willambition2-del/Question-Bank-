import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { visibleQuestionWhere } from '../progress/progress-visibility';
import { RedisService } from '../redis/redis.service';
import { RecommendationQueryDto } from './dto/recommendation-query.dto';

const RECOMMENDATION_WEIGHTS = {
  masteryGap: 0.4,
  wrongAnswers: 4,
  slowAnswer: 10,
  staleReview: 10,
  subjectImportance: 5,
} as const;

type RecommendationBundle = {
  generatedAt: Date | string;
  weaknesses: unknown[];
  lessons: unknown[];
};

@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async get(userId: string, query: RecommendationQueryDto) {
    await this.assertSubject(query.subjectId);
    const cacheKey = `recommendations:${userId}:${query.subjectId ?? 'all'}:${query.limit}`;
    const cached = await this.redis.getJson<RecommendationBundle>(cacheKey);
    if (cached) return cached;
    const [weaknesses, lessons] = await Promise.all([
      this.weaknesses(userId, query),
      this.lessons(userId, query),
    ]);
    const result = {
      generatedAt: new Date(),
      weaknesses,
      lessons,
    };
    await this.redis.setJson(cacheKey, result, 60);
    return result;
  }

  async weaknesses(userId: string, query: RecommendationQueryDto) {
    const rows = await this.prisma.studentQuestionProgress.findMany({
      where: {
        userId,
        attemptsCount: { gte: 2 },
        isMastered: false,
        question: {
          is: visibleQuestionWhere({ subjectId: query.subjectId }),
        },
      },
      include: {
        question: {
          select: {
            id: true,
            questionText: true,
            difficulty: true,
            subjectId: true,
            unitId: true,
            lessonId: true,
            subject: { select: { name: true, sortOrder: true } },
          },
        },
      },
      orderBy: [
        { masteryScore: 'asc' },
        { wrongCount: 'desc' },
        { questionId: 'asc' },
      ],
      take: query.limit * 2,
    });
    return rows
      .map((row) => {
        const mastery = Number(row.masteryScore);
        const staleDays = row.lastAnsweredAt
          ? Math.floor((Date.now() - row.lastAnsweredAt.getTime()) / 86400000)
          : 365;
        const score =
          (100 - mastery) * RECOMMENDATION_WEIGHTS.masteryGap +
          Math.min(row.wrongCount, 5) * RECOMMENDATION_WEIGHTS.wrongAnswers +
          (row.averageTimeMs >= 30000 ? RECOMMENDATION_WEIGHTS.slowAnswer : 0) +
          (staleDays >= 7 ? RECOMMENDATION_WEIGHTS.staleReview : 0) +
          (row.question.subject.sortOrder <= 2
            ? RECOMMENDATION_WEIGHTS.subjectImportance
            : 0);
        return {
          type: 'QUESTION_WEAKNESS',
          score: Number(score.toFixed(2)),
          reason: this.reason(
            row.wrongCount,
            mastery,
            row.averageTimeMs,
            staleDays,
          ),
          question: {
            id: row.question.id,
            questionText: row.question.questionText,
            difficulty: row.question.difficulty,
            subjectId: row.question.subjectId,
            subjectName: row.question.subject.name,
            unitId: row.question.unitId,
            lessonId: row.question.lessonId,
          },
          attemptsCount: row.attemptsCount,
          wrongCount: row.wrongCount,
          masteryPercent: mastery,
          averageTimeMs: row.averageTimeMs,
          lastAnsweredAt: row.lastAnsweredAt,
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, query.limit);
  }

  async lessons(userId: string, query: RecommendationQueryDto) {
    const rows = await this.prisma.studentLessonProgress.findMany({
      where: {
        userId,
        answeredQuestions: { gte: 2 },
        masteryPercent: { lt: 80 },
        lesson: {
          ...(query.subjectId ? { subjectId: query.subjectId } : {}),
          isActive: true,
          isPublished: true,
          deletedAt: null,
        },
      },
      include: {
        lesson: {
          select: {
            id: true,
            name: true,
            slug: true,
            subjectId: true,
            unitId: true,
            subject: { select: { name: true } },
            _count: {
              select: { questions: { where: visibleQuestionWhere() } },
            },
          },
        },
      },
      orderBy: [{ masteryPercent: 'asc' }, { wrongAnswers: 'desc' }],
      take: query.limit,
    });
    return rows.map((row) => ({
      type: 'LESSON_REVIEW',
      score: Number(
        (
          (100 - Number(row.masteryPercent)) *
            RECOMMENDATION_WEIGHTS.masteryGap +
          Math.min(row.wrongAnswers, 5) * RECOMMENDATION_WEIGHTS.wrongAnswers
        ).toFixed(2),
      ),
      reason: `Mastery is ${Number(row.masteryPercent)}% with ${row.wrongAnswers} mistakes`,
      lesson: {
        id: row.lesson.id,
        name: row.lesson.name,
        slug: row.lesson.slug,
        subjectId: row.lesson.subjectId,
        subjectName: row.lesson.subject.name,
        unitId: row.lesson.unitId,
        availableQuestions: row.lesson._count.questions,
      },
      questionsAnswered: row.answeredQuestions,
      masteryPercent: Number(row.masteryPercent),
      accuracyPercent: Number(row.accuracyPercent),
    }));
  }

  async actions(userId: string, query: RecommendationQueryDto) {
    await this.assertSubject(query.subjectId);
    const [lessons, units, subjects] = await Promise.all([
      this.lessons(userId, query),
      this.prisma.studentUnitProgress.findMany({
        where: {
          userId,
          answeredQuestions: { gte: 2 },
          masteryPercent: { lt: 80 },
          unit: {
            is: {
              ...(query.subjectId ? { subjectId: query.subjectId } : {}),
              isActive: true,
              isPublished: true,
              deletedAt: null,
              subject: {
                is: { isActive: true, isPublished: true, deletedAt: null },
              },
            },
          },
        },
        include: {
          unit: { select: { id: true, name: true, subjectId: true } },
        },
        orderBy: [{ masteryPercent: 'asc' }, { wrongAnswers: 'desc' }],
        take: query.limit,
      }),
      this.prisma.studentSubjectProgress.findMany({
        where: {
          userId,
          answeredQuestions: { gte: 2 },
          masteryPercent: { lt: 80 },
          ...(query.subjectId ? { subjectId: query.subjectId } : {}),
          subject: {
            is: { isActive: true, isPublished: true, deletedAt: null },
          },
        },
        include: { subject: { select: { id: true, name: true } } },
        orderBy: [{ masteryPercent: 'asc' }, { wrongAnswers: 'desc' }],
        take: query.limit,
      }),
    ]);
    return [
      ...lessons.map((item) => ({
        type: 'REVIEW_LESSON',
        priority: item.score,
        reason: item.reason,
        target: item.lesson,
      })),
      ...units.map((row) => ({
        type: 'TAKE_UNIT_QUIZ',
        priority:
          100 - Number(row.masteryPercent) + Math.min(row.wrongAnswers, 10) * 2,
        reason: `Unit mastery is ${Number(row.masteryPercent)}%`,
        target: row.unit,
      })),
      ...subjects.map((row) => ({
        type: 'FOCUS_SUBJECT',
        priority:
          100 - Number(row.masteryPercent) + Math.min(row.wrongAnswers, 10) * 2,
        reason: `Subject mastery is ${Number(row.masteryPercent)}%`,
        target: row.subject,
      })),
    ]
      .sort(
        (left, right) =>
          right.priority - left.priority ||
          left.target.id.localeCompare(right.target.id),
      )
      .slice(0, query.limit);
  }

  private async assertSubject(subjectId?: string) {
    if (!subjectId) return;
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: subjectId,
        isActive: true,
        isPublished: true,
        deletedAt: null,
        curriculum: { is: { isActive: true, deletedAt: null } },
        grade: { is: { isActive: true, deletedAt: null } },
      },
      select: { id: true },
    });
    if (!subject) {
      throw new NotFoundException({
        code: 'RECOMMENDATION_SUBJECT_NOT_FOUND',
        message: 'Subject not found',
      });
    }
  }
  private reason(
    wrong: number,
    mastery: number,
    averageTimeMs: number,
    staleDays: number,
  ) {
    const reasons = [`${wrong} incorrect answers`, `${mastery}% mastery`];
    if (averageTimeMs >= 30000) reasons.push('answer time is above target');
    if (staleDays >= 7) reasons.push('review is overdue');
    return reasons.join('; ');
  }
}
