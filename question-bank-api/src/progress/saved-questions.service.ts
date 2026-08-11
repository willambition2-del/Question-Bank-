import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { createPageMeta } from '../common/pagination/pagination';
import { toStudentQuestion } from '../content/content.mapper';
import { PrismaService } from '../prisma/prisma.service';
import {
  SavedQuestionNoteDto,
  SavedQuestionQueryDto,
} from './dto/progress.dto';
import { progressNotFound } from './progress-errors';
import { visibleQuestionWhere } from './progress-visibility';

const savedInclude = {
  question: { include: { options: true, readingPassage: true } },
} satisfies Prisma.SavedQuestionInclude;

type SavedRecord = Prisma.SavedQuestionGetPayload<{
  include: typeof savedInclude;
}>;

@Injectable()
export class SavedQuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async save(userId: string, questionId: string, dto: SavedQuestionNoteDto) {
    const question = await this.availableQuestion(questionId);
    await this.prisma.savedQuestion.upsert({
      where: { userId_questionId: { userId, questionId } },
      update: dto.note === undefined ? {} : { note: dto.note },
      create: {
        userId,
        questionId,
        subjectId: question.subjectId,
        unitId: question.unitId,
        lessonId: question.lessonId,
        note: dto.note,
      },
    });
    return this.getVisible(userId, questionId);
  }

  async remove(userId: string, questionId: string) {
    const result = await this.prisma.savedQuestion.deleteMany({
      where: { userId, questionId },
    });
    return { questionId, removed: result.count > 0 };
  }

  async update(userId: string, questionId: string, dto: SavedQuestionNoteDto) {
    const existing = await this.prisma.savedQuestion.findFirst({
      where: { userId, questionId, question: visibleQuestionWhere() },
      select: { id: true },
    });
    if (!existing)
      throw progressNotFound(
        'SAVED_QUESTION_NOT_FOUND',
        'Saved question not found',
      );
    const updated = await this.prisma.savedQuestion.updateMany({
      where: { id: existing.id, userId },
      data: { note: dto.note ?? null },
    });
    if (!updated.count)
      throw progressNotFound(
        'SAVED_QUESTION_NOT_FOUND',
        'Saved question not found',
      );
    return this.getVisible(userId, questionId);
  }

  async list(userId: string, query: SavedQuestionQueryDto) {
    const where: Prisma.SavedQuestionWhereInput = {
      userId,
      question: visibleQuestionWhere(query),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.savedQuestion.findMany({
        where,
        include: savedInclude,
        orderBy: this.orderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.savedQuestion.count({ where }),
    ]);
    return {
      items: items.map((item) => this.map(item)),
      meta: createPageMeta(query.page, query.limit, totalItems),
    };
  }

  private async getVisible(
    userId: string,
    questionId: string,
  ): Promise<ReturnType<SavedQuestionsService['map']>> {
    const saved = await this.prisma.savedQuestion.findFirst({
      where: { userId, questionId, question: visibleQuestionWhere() },
      include: savedInclude,
    });
    if (!saved)
      throw progressNotFound(
        'SAVED_QUESTION_NOT_FOUND',
        'Saved question not found',
      );
    return this.map(saved);
  }

  private async availableQuestion(questionId: string) {
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, ...visibleQuestionWhere() },
      select: { id: true, subjectId: true, unitId: true, lessonId: true },
    });
    if (!question)
      throw progressNotFound(
        'SAVED_QUESTION_NOT_AVAILABLE',
        'Question is not available',
      );
    return question;
  }

  private orderBy(
    sort: SavedQuestionQueryDto['sort'],
  ): Prisma.SavedQuestionOrderByWithRelationInput[] {
    const id = { id: 'asc' as const };
    if (sort === 'saved_asc') return [{ createdAt: 'asc' }, id];
    if (sort === 'question_text_asc')
      return [{ question: { questionText: 'asc' } }, id];
    if (sort === 'difficulty_asc')
      return [{ question: { difficulty: 'asc' } }, id];
    return [{ createdAt: 'desc' }, id];
  }

  private map(item: SavedRecord) {
    return {
      id: item.id,
      question: toStudentQuestion(item.question),
      note: item.note,
      savedAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
