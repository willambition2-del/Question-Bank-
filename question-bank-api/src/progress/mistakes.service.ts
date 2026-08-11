import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { createPageMeta } from '../common/pagination/pagination';
import { toStudentQuestion } from '../content/content.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { MistakeQueryDto } from './dto/progress.dto';
import { progressNotFound } from './progress-errors';
import { visibleQuestionWhere } from './progress-visibility';

const mistakeInclude = {
  question: { include: { options: true, readingPassage: true } },
} satisfies Prisma.StudentQuestionProgressInclude;

type MistakeRecord = Prisma.StudentQuestionProgressGetPayload<{
  include: typeof mistakeInclude;
}>;

@Injectable()
export class MistakesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: MistakeQueryDto) {
    const where: Prisma.StudentQuestionProgressWhereInput = {
      userId,
      wrongCount: { gte: query.minWrongCount },
      ...(query.mastered !== undefined ? { isMastered: query.mastered } : {}),
      ...(query.reviewed !== undefined
        ? { manualReviewedAt: query.reviewed ? { not: null } : null }
        : {}),
      question: visibleQuestionWhere(query),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.studentQuestionProgress.findMany({
        where,
        include: mistakeInclude,
        orderBy: this.orderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.studentQuestionProgress.count({ where }),
    ]);
    return {
      items: items.map((item) => this.map(item)),
      meta: createPageMeta(query.page, query.limit, totalItems),
    };
  }

  async get(userId: string, questionId: string) {
    const item = await this.prisma.studentQuestionProgress.findFirst({
      where: {
        userId,
        questionId,
        wrongCount: { gt: 0 },
        question: visibleQuestionWhere(),
      },
      include: mistakeInclude,
    });
    if (!item) throw progressNotFound('MISTAKE_NOT_FOUND', 'Mistake not found');
    return this.map(item);
  }

  async markReviewed(userId: string, questionId: string) {
    const existing = await this.prisma.studentQuestionProgress.findFirst({
      where: {
        userId,
        questionId,
        wrongCount: { gt: 0 },
        question: visibleQuestionWhere(),
      },
      select: { id: true, isMastered: true, manualReviewedAt: true },
    });
    if (!existing)
      throw progressNotFound('MISTAKE_NOT_FOUND', 'Mistake not found');
    const manualReviewedAt = existing.manualReviewedAt ?? new Date();
    if (!existing.manualReviewedAt)
      await this.prisma.studentQuestionProgress.update({
        where: { id: existing.id },
        data: { manualReviewedAt },
      });
    return {
      questionId,
      reviewStatus: 'REVIEWED',
      manualReviewedAt,
      isMastered: existing.isMastered,
      message: 'Reviewed status recorded; demonstrated mastery is unchanged',
    };
  }

  private orderBy(
    sort: MistakeQueryDto['sort'],
  ): Prisma.StudentQuestionProgressOrderByWithRelationInput[] {
    const id = { id: 'asc' as const };
    if (sort === 'last_wrong_desc') return [{ lastWrongAt: 'desc' }, id];
    if (sort === 'mastery_asc') return [{ masteryScore: 'asc' }, id];
    if (sort === 'difficulty_asc')
      return [{ question: { difficulty: 'asc' } }, id];
    if (sort === 'created_desc') return [{ createdAt: 'desc' }, id];
    return [{ wrongCount: 'desc' }, { lastWrongAt: 'desc' }, id];
  }

  private map(item: MistakeRecord) {
    return {
      question: toStudentQuestion(item.question),
      attemptsCount: item.attemptsCount,
      correctCount: item.correctCount,
      wrongCount: item.wrongCount,
      consecutiveWrong: item.consecutiveWrong,
      masteryScore: Number(item.masteryScore),
      isMastered: item.isMastered,
      reviewed: item.manualReviewedAt !== null,
      manualReviewedAt: item.manualReviewedAt,
      lastAnsweredAt: item.lastAnsweredAt,
      lastTimeMs: item.lastTimeMs,
    };
  }
}
