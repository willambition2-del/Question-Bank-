import { Injectable } from '@nestjs/common';
import type { ExamModel, Prisma } from '../../generated/prisma/client';
import { GradeLevel, QuestionReviewStatus } from '../../generated/prisma/enums';
import { createPageMeta } from '../../common/pagination/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import {
  contentBadRequest,
  contentConflict,
  contentNotFound,
} from '../content-errors';
import {
  AddExamQuestionDto,
  BulkAddExamQuestionsDto,
  CreateExamModelDto,
  ExamModelQueryDto,
  ReorderExamQuestionsDto,
  UpdateExamModelDto,
} from '../dto/phase-c.dto';
import { QuestionHierarchyValidator } from '../questions/question-hierarchy.validator';
import { ExamModelHierarchyValidator } from './exam-model-hierarchy.validator';
import {
  ExamModelWithContent,
  ExamQuestionWithContent,
  toAdminExamModel,
  toStudentExamModelDetail,
  toStudentExamModelListItem,
} from './exam-models.mapper';

const detailInclude = {
  subject: true,
  source: true,
  questions: {
    include: { question: { include: { options: true, readingPassage: true } } },
    orderBy: { sortOrder: 'asc' as const },
  },
};

@Injectable()
export class ExamModelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly examHierarchy: ExamModelHierarchyValidator,
    private readonly questionHierarchy: QuestionHierarchyValidator,
  ) {}

  async create(dto: CreateExamModelDto) {
    await this.examHierarchy.validate(dto.subjectId, dto.sourceId);
    try {
      const exam = await this.prisma.examModel.create({
        data: { ...dto, isPublished: false },
        include: detailInclude,
      });
      return toAdminExamModel(exam, [], false);
    } catch (error) {
      this.mapWriteError(error, 'EXAM_MODEL_SLUG_EXISTS');
    }
  }

  async listStudent(query: ExamModelQueryDto, userId?: string) {
    let userGrade: GradeLevel = GradeLevel.THIRD_SECONDARY;
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { gradeLevel: true },
      });
      if (user?.gradeLevel) userGrade = user.gradeLevel;
    }
    const candidates = await this.prisma.examModel.findMany({
      where: {
        ...this.buildWhere(query, true),
        subject: {
          isActive: true,
          deletedAt: null,
          grade: { isActive: true, deletedAt: null, code: userGrade },
        },
      },
      include: detailInclude,
      orderBy: this.orderBy(query.sort),
    });
    const visible: Array<{
      exam: ExamModelWithContent;
      questions: ExamQuestionWithContent[];
    }> = [];
    for (const exam of candidates) {
      const parent = await this.examHierarchy.load(
        exam.subjectId,
        exam.sourceId,
      );
      if (!this.examHierarchy.isVisible(parent)) continue;
      const questions = await this.validStudentQuestions(exam);
      if (questions.length) visible.push({ exam, questions });
    }
    const totalItems = visible.length;
    const start = (query.page - 1) * query.limit;
    return {
      items: visible
        .slice(start, start + query.limit)
        .map(({ exam, questions }) =>
          toStudentExamModelListItem(exam, questions),
        ),
      meta: createPageMeta(query.page, query.limit, totalItems),
    };
  }

  async listAdmin(query: ExamModelQueryDto) {
    const where = this.buildWhere(query, false);
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.examModel.findMany({
        where,
        include: detailInclude,
        orderBy: this.orderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.examModel.count({ where }),
    ]);
    return {
      items: await Promise.all(
        items.map(async (exam) =>
          toAdminExamModel(exam, await this.membershipWarnings(exam), false),
        ),
      ),
      meta: createPageMeta(query.page, query.limit, totalItems),
    };
  }

  async getStudent(id: string) {
    const exam = await this.prisma.examModel.findFirst({
      where: { id, isPublished: true, deletedAt: null },
      include: detailInclude,
    });
    if (!exam) this.notFound();
    const parent = await this.examHierarchy.load(exam.subjectId, exam.sourceId);
    if (!this.examHierarchy.isVisible(parent)) this.notFound();
    const questions = await this.validStudentQuestions(exam);
    if (!questions.length) this.notFound();
    return toStudentExamModelDetail(exam, questions);
  }

  async getAdmin(id: string) {
    const exam = await this.findDetail(id);
    return toAdminExamModel(exam, await this.membershipWarnings(exam));
  }

  async update(id: string, dto: UpdateExamModelDto) {
    const current = await this.findRecord(id);
    this.assertMutable(current);
    const subjectId = dto.subjectId ?? current.subjectId;
    const sourceId =
      dto.sourceId === undefined ? current.sourceId : dto.sourceId;
    await this.examHierarchy.validate(subjectId, sourceId);
    if (dto.subjectId && dto.subjectId !== current.subjectId) {
      const count = await this.prisma.examModelQuestion.count({
        where: { examModelId: id },
      });
      if (count) {
        throw contentBadRequest(
          'EXAM_MODEL_SUBJECT_CHANGE_FORBIDDEN',
          'Remove all exam questions before changing the subject',
        );
      }
    }
    try {
      const exam = await this.prisma.examModel.update({
        where: { id },
        data: { ...dto, isPublished: false },
        include: detailInclude,
      });
      return toAdminExamModel(exam, [], false);
    } catch (error) {
      this.mapWriteError(error, 'EXAM_MODEL_SLUG_EXISTS');
    }
  }

  async remove(id: string) {
    await this.findRecord(id);
    const exam = await this.prisma.examModel.update({
      where: { id },
      data: { deletedAt: new Date(), isPublished: false },
      include: detailInclude,
    });
    return toAdminExamModel(exam, await this.membershipWarnings(exam), false);
  }

  async restore(id: string) {
    const current = await this.findRecord(id);
    await this.examHierarchy.validate(current.subjectId, current.sourceId);
    const exam = await this.prisma.examModel.update({
      where: { id },
      data: { deletedAt: null, isPublished: false },
      include: detailInclude,
    });
    return toAdminExamModel(exam, await this.membershipWarnings(exam), false);
  }

  async publish(id: string) {
    const exam = await this.findDetail(id);
    if (exam.deletedAt) {
      throw contentBadRequest(
        'EXAM_MODEL_NOT_READY_FOR_PUBLISH',
        'A deleted exam model cannot be published',
      );
    }
    if (exam.durationMinutes < 1 || exam.durationMinutes > 1440) {
      throw contentBadRequest(
        'EXAM_MODEL_INVALID_DURATION',
        'Exam model duration must be between 1 and 1440 minutes',
      );
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(exam.slug)) {
      throw contentBadRequest(
        'EXAM_MODEL_NOT_READY_FOR_PUBLISH',
        'Exam model slug is invalid',
      );
    }
    if (!exam.questions.length) {
      throw contentBadRequest(
        'EXAM_MODEL_EMPTY',
        'Add at least one question before publishing',
      );
    }
    await this.examHierarchy.validate(exam.subjectId, exam.sourceId, true);
    const orders = exam.questions.map((item) => item.sortOrder);
    if (new Set(orders).size !== orders.length) {
      throw contentConflict(
        'EXAM_MODEL_SORT_ORDER_CONFLICT',
        'Exam question sort orders must be unique',
      );
    }
    for (const item of exam.questions) {
      this.assertPoints(Number(item.points));
      const question = item.question;
      if (question.subjectId !== exam.subjectId) {
        throw contentBadRequest(
          'EXAM_MODEL_QUESTION_SUBJECT_MISMATCH',
          'Every question must belong to the exam subject',
        );
      }
      if (
        question.reviewStatus !== QuestionReviewStatus.READY ||
        !question.isActive ||
        !question.isPublished ||
        question.deletedAt
      ) {
        throw contentBadRequest(
          'EXAM_MODEL_NOT_READY_FOR_PUBLISH',
          'Every exam question must be READY, active, published, and not deleted',
        );
      }
      try {
        await this.questionHierarchy.validate(question, true);
      } catch {
        throw contentBadRequest(
          'EXAM_MODEL_NOT_READY_FOR_PUBLISH',
          'Every exam question hierarchy must be valid and visible',
        );
      }
    }
    const updated = await this.prisma.examModel.update({
      where: { id },
      data: { isPublished: true },
      include: detailInclude,
    });
    return toAdminExamModel(updated, [], false);
  }

  async unpublish(id: string) {
    await this.findRecord(id);
    const exam = await this.prisma.examModel.update({
      where: { id },
      data: { isPublished: false },
      include: detailInclude,
    });
    return toAdminExamModel(exam, await this.membershipWarnings(exam), false);
  }

  async addQuestion(id: string, dto: AddExamQuestionDto) {
    const exam = await this.findRecord(id);
    this.assertMutable(exam);
    await this.ensureQuestion(exam, dto.questionId);
    this.assertPoints(dto.points ?? 1);
    const sortOrder = dto.sortOrder ?? (await this.nextSortOrder(id));
    await this.ensureMembershipAvailable(id, dto.questionId, sortOrder);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.examModelQuestion.create({
          data: {
            examModelId: id,
            questionId: dto.questionId,
            sortOrder,
            points: dto.points ?? 1,
          },
        });
      });
    } catch (error) {
      this.mapWriteError(error, 'EXAM_MODEL_QUESTION_ALREADY_EXISTS');
    }
    return this.getAdmin(id);
  }

  async bulkAdd(id: string, dto: BulkAddExamQuestionsDto) {
    const exam = await this.findRecord(id);
    this.assertMutable(exam);
    const questionIds = dto.questions.map((item) => item.questionId);
    if (new Set(questionIds).size !== questionIds.length) {
      throw contentConflict(
        'EXAM_MODEL_QUESTION_ALREADY_EXISTS',
        'Question IDs in the request must be unique',
      );
    }
    for (const item of dto.questions) {
      this.assertPoints(item.points ?? 1);
      await this.ensureQuestion(exam, item.questionId);
    }
    let next = await this.nextSortOrder(id);
    const rows = dto.questions.map((item) => ({
      examModelId: id,
      questionId: item.questionId,
      sortOrder: item.sortOrder ?? next++,
      points: item.points ?? 1,
    }));
    const orders = rows.map((row) => row.sortOrder);
    if (new Set(orders).size !== orders.length) {
      throw contentConflict(
        'EXAM_MODEL_SORT_ORDER_CONFLICT',
        'Sort orders in the request must be unique',
      );
    }
    const [existingQuestion, existingOrder] = await Promise.all([
      this.prisma.examModelQuestion.findFirst({
        where: { examModelId: id, questionId: { in: questionIds } },
        select: { id: true },
      }),
      this.prisma.examModelQuestion.findFirst({
        where: { examModelId: id, sortOrder: { in: orders } },
        select: { id: true },
      }),
    ]);
    if (existingQuestion) {
      throw contentConflict(
        'EXAM_MODEL_QUESTION_ALREADY_EXISTS',
        'A question is already in this exam model',
      );
    }
    if (existingOrder) {
      throw contentConflict(
        'EXAM_MODEL_SORT_ORDER_CONFLICT',
        'A sort order is already in use',
      );
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.examModelQuestion.createMany({ data: rows });
      });
    } catch (error) {
      this.mapWriteError(error, 'EXAM_MODEL_QUESTION_ALREADY_EXISTS');
    }
    const totalQuestions = await this.prisma.examModelQuestion.count({
      where: { examModelId: id },
    });
    return { examModelId: id, addedCount: rows.length, totalQuestions };
  }

  async removeQuestion(id: string, questionId: string) {
    const exam = await this.findRecord(id);
    this.assertMutable(exam);
    const result = await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.examModelQuestion.deleteMany({
        where: { examModelId: id, questionId },
      });
      if (!deleted.count) {
        throw contentNotFound(
          'EXAM_MODEL_QUESTION_NOT_FOUND',
          'Exam model question not found',
        );
      }
      const totalQuestions = await tx.examModelQuestion.count({
        where: { examModelId: id },
      });
      return { examModelId: id, removedQuestionId: questionId, totalQuestions };
    });
    return result;
  }

  async reorder(id: string, dto: ReorderExamQuestionsDto) {
    const exam = await this.findRecord(id);
    this.assertMutable(exam);
    const ids = dto.items.map((item) => item.questionId);
    const orders = dto.items.map((item) => item.sortOrder);
    if (new Set(ids).size !== ids.length) {
      throw contentBadRequest(
        'EXAM_MODEL_QUESTION_NOT_FOUND',
        'Question IDs must be unique',
      );
    }
    if (new Set(orders).size !== orders.length) {
      throw contentConflict(
        'EXAM_MODEL_SORT_ORDER_CONFLICT',
        'Sort orders must be unique',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const linked = await tx.examModelQuestion.count({
        where: { examModelId: id, questionId: { in: ids } },
      });
      if (linked !== ids.length) {
        throw contentNotFound(
          'EXAM_MODEL_QUESTION_NOT_FOUND',
          'One or more questions are not linked to this exam model',
        );
      }
      const conflicts = await tx.examModelQuestion.count({
        where: {
          examModelId: id,
          sortOrder: { in: orders },
          questionId: { notIn: ids },
        },
      });
      if (conflicts) {
        throw contentConflict(
          'EXAM_MODEL_SORT_ORDER_CONFLICT',
          'A requested sort order belongs to another question',
        );
      }
      for (const [index, item] of dto.items.entries()) {
        await tx.examModelQuestion.update({
          where: {
            examModelId_questionId: {
              examModelId: id,
              questionId: item.questionId,
            },
          },
          data: { sortOrder: -1_000_000 - index },
        });
      }
      for (const item of dto.items) {
        await tx.examModelQuestion.update({
          where: {
            examModelId_questionId: {
              examModelId: id,
              questionId: item.questionId,
            },
          },
          data: { sortOrder: item.sortOrder },
        });
      }
    });
    return this.getAdmin(id);
  }

  private buildWhere(
    query: ExamModelQueryDto,
    student: boolean,
  ): Prisma.ExamModelWhereInput {
    return {
      ...(student
        ? { isPublished: true, deletedAt: null }
        : {
            ...(query.isPublished !== undefined
              ? { isPublished: query.isPublished }
              : {}),
            ...(!query.includeDeleted ? { deletedAt: null } : {}),
          }),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.sourceId ? { sourceId: query.sourceId } : {}),
      ...(query.year ? { year: query.year } : {}),
      ...(query.governorate
        ? { governorate: { equals: query.governorate, mode: 'insensitive' } }
        : {}),
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
      ...(query.isOfficial !== undefined
        ? { isOfficial: query.isOfficial }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private orderBy(
    sort: ExamModelQueryDto['sort'],
  ): Prisma.ExamModelOrderByWithRelationInput[] {
    const stable = { id: 'asc' as const };
    switch (sort) {
      case 'year_desc':
        return [{ year: 'desc' }, stable];
      case 'year_asc':
        return [{ year: 'asc' }, stable];
      case 'title_asc':
        return [{ title: 'asc' }, stable];
      case 'title_desc':
        return [{ title: 'desc' }, stable];
      case 'created_desc':
        return [{ createdAt: 'desc' }, stable];
      default:
        return [{ sortOrder: 'asc' }, { createdAt: 'desc' }, stable];
    }
  }

  private async validStudentQuestions(exam: ExamModelWithContent) {
    const valid: ExamQuestionWithContent[] = [];
    for (const item of exam.questions) {
      const question = item.question;
      if (
        question.subjectId !== exam.subjectId ||
        question.reviewStatus !== QuestionReviewStatus.READY ||
        !question.isActive ||
        !question.isPublished ||
        question.deletedAt ||
        !this.pointsValid(Number(item.points))
      )
        continue;
      try {
        await this.questionHierarchy.validate(question, true);
        valid.push(item);
      } catch {
        continue;
      }
    }
    return valid;
  }

  private async membershipWarnings(exam: ExamModelWithContent) {
    const warnings: string[] = [];
    const parent = await this.examHierarchy.load(exam.subjectId, exam.sourceId);
    if (!this.examHierarchy.isVisible(parent))
      warnings.push('EXAM_MODEL_PARENT_NOT_VISIBLE');
    for (const item of exam.questions) {
      const question = item.question;
      const prefix = `${question.id}:`;
      if (question.subjectId !== exam.subjectId)
        warnings.push(`${prefix}EXAM_MODEL_QUESTION_SUBJECT_MISMATCH`);
      if (
        question.reviewStatus !== QuestionReviewStatus.READY ||
        !question.isActive ||
        question.deletedAt
      ) {
        warnings.push(`${prefix}EXAM_MODEL_QUESTION_NOT_READY`);
      }
      if (!question.isPublished)
        warnings.push(`${prefix}QUESTION_NOT_PUBLISHED`);
      if (!this.pointsValid(Number(item.points)))
        warnings.push(`${prefix}EXAM_MODEL_INVALID_POINTS`);
      try {
        await this.questionHierarchy.validate(question, true);
      } catch {
        warnings.push(`${prefix}QUESTION_HIERARCHY_NOT_VISIBLE`);
      }
    }
    return [...new Set(warnings)];
  }

  private async ensureQuestion(exam: ExamModel, questionId: string) {
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, deletedAt: null },
      include: { options: true, readingPassage: true },
    });
    if (!question) {
      throw contentNotFound(
        'EXAM_MODEL_QUESTION_NOT_FOUND',
        'Question not found',
      );
    }
    if (question.subjectId !== exam.subjectId) {
      throw contentBadRequest(
        'EXAM_MODEL_QUESTION_SUBJECT_MISMATCH',
        'Question does not belong to the exam subject',
      );
    }
    if (
      question.reviewStatus !== QuestionReviewStatus.READY ||
      !question.isActive
    ) {
      throw contentBadRequest(
        'EXAM_MODEL_QUESTION_NOT_READY',
        'Question must be READY and active',
      );
    }
    try {
      await this.questionHierarchy.validate(question);
    } catch {
      throw contentBadRequest(
        'EXAM_MODEL_QUESTION_NOT_READY',
        'Question hierarchy is invalid',
      );
    }
    return question;
  }

  private async ensureMembershipAvailable(
    examModelId: string,
    questionId: string,
    sortOrder: number,
  ) {
    const [question, order] = await Promise.all([
      this.prisma.examModelQuestion.findUnique({
        where: { examModelId_questionId: { examModelId, questionId } },
        select: { id: true },
      }),
      this.prisma.examModelQuestion.findUnique({
        where: { examModelId_sortOrder: { examModelId, sortOrder } },
        select: { id: true },
      }),
    ]);
    if (question)
      throw contentConflict(
        'EXAM_MODEL_QUESTION_ALREADY_EXISTS',
        'Question is already in this exam model',
      );
    if (order)
      throw contentConflict(
        'EXAM_MODEL_SORT_ORDER_CONFLICT',
        'Sort order is already in use',
      );
  }

  private async nextSortOrder(examModelId: string) {
    const last = await this.prisma.examModelQuestion.findFirst({
      where: { examModelId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  private async findRecord(id: string) {
    const exam = await this.prisma.examModel.findUnique({ where: { id } });
    if (!exam) this.notFound();
    return exam;
  }

  private async findDetail(id: string): Promise<ExamModelWithContent> {
    const exam = await this.prisma.examModel.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!exam) this.notFound();
    return exam;
  }

  private assertMutable(exam: ExamModel) {
    if (exam.isPublished) {
      throw contentConflict(
        'EXAM_MODEL_PUBLISHED_MODIFICATION_FORBIDDEN',
        'Unpublish the exam model before modifying it',
      );
    }
    if (exam.deletedAt) this.notFound();
  }

  private assertPoints(points: number) {
    if (!this.pointsValid(points)) {
      throw contentBadRequest(
        'EXAM_MODEL_INVALID_POINTS',
        'Question points must be a finite number greater than zero',
      );
    }
  }

  private pointsValid(points: number) {
    return Number.isFinite(points) && points > 0;
  }

  private mapWriteError(error: unknown, conflictCode: string): never {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (code === 'P2002') {
      const target =
        typeof error === 'object' &&
        error !== null &&
        'meta' in error &&
        typeof (error as { meta?: unknown }).meta === 'object' &&
        (error as { meta?: object }).meta !== null &&
        'target' in (error as { meta: object }).meta
          ? String((error as { meta: { target?: unknown } }).meta.target)
          : '';
      if (target.includes('sortOrder')) {
        throw contentConflict(
          'EXAM_MODEL_SORT_ORDER_CONFLICT',
          'An exam question sort order is already in use',
        );
      }
      if (target.includes('questionId')) {
        throw contentConflict(
          'EXAM_MODEL_QUESTION_ALREADY_EXISTS',
          'Question is already in this exam model',
        );
      }
      throw contentConflict(
        conflictCode,
        'A conflicting exam model record exists',
      );
    }
    if (code === 'P2003')
      throw contentBadRequest(
        'EXAM_MODEL_PARENT_NOT_VISIBLE',
        'An exam model relation is invalid',
      );
    if (code === 'P2025') this.notFound();
    throw error;
  }

  private notFound(): never {
    throw contentNotFound('EXAM_MODEL_NOT_FOUND', 'Exam model not found');
  }
}
