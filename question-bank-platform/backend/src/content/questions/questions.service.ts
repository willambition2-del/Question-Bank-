import { ForbiddenException, HttpStatus, Injectable } from '@nestjs/common';
import { createPageMeta } from '../../common/pagination/pagination';
import {
  QuestionOrigin,
  QuestionReviewStatus,
  QuestionType,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import {
  QuestionWithContent,
  toAdminQuestion,
  toStudentQuestion,
} from '../content.mapper';
import {
  contentBadRequest,
  contentConflict,
  contentNotFound,
  mapContentPrismaError,
} from '../content-errors';
import {
  CreateQuestionDto,
  QuestionBulkAction,
  QuestionBulkActionDto,
  QuestionOptionInputDto,
  UpdateQuestionDto,
} from '../dto/content.dto';
import { QuestionQueryDto, QuestionSort } from '../dto/question-bank-query.dto';
import {
  QuestionHierarchyInput,
  QuestionHierarchyValidator,
} from './question-hierarchy.validator';
import {
  createQuestionFingerprint,
  normalizeQuestionText,
} from './question-normalization';
import { assertQuestionTransition } from './question-review-policy';

const QUESTION_INCLUDE = {
  options: true,
  readingPassage: true,
} as const;

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hierarchy: QuestionHierarchyValidator,
  ) {}

  async create(actorId: string, dto: CreateQuestionDto) {
    await this.hierarchy.validate(dto);
    this.validateType(dto.type, dto.correctBoolean, dto.options ?? []);
    const fingerprint = createQuestionFingerprint(
      dto.questionText,
      dto.subjectId,
      dto.type,
    );
    await this.ensureNotDuplicate(fingerprint);
    const { options, ...questionData } = dto;
    try {
      const question = await this.prisma.$transaction((tx) =>
        tx.question.create({
          data: {
            ...questionData,
            correctBoolean:
              dto.type === QuestionType.MULTIPLE_CHOICE
                ? null
                : dto.correctBoolean,
            origin: QuestionOrigin.MANUAL,
            reviewStatus: QuestionReviewStatus.DRAFT,
            isPublished: false,
            createdById: actorId,
            fingerprint,
            options:
              dto.type === QuestionType.MULTIPLE_CHOICE
                ? { create: options ?? [] }
                : undefined,
          },
          include: QUESTION_INCLUDE,
        }),
      );
      return toAdminQuestion(question);
    } catch (error) {
      mapContentPrismaError(error, 'QUESTION_DUPLICATE');
    }
  }

  async listAdmin(query: QuestionQueryDto) {
    const where = {
      ...(query.search
        ? {
            questionText: {
              contains: query.search,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.lessonId ? { lessonId: query.lessonId } : {}),
      ...(query.sourceId ? { sourceId: query.sourceId } : {}),
      ...(query.readingPassageId
        ? { readingPassageId: query.readingPassageId }
        : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
      ...(query.reviewStatus ? { reviewStatus: query.reviewStatus } : {}),
      ...(query.origin ? { origin: query.origin } : {}),
      ...(query.isPublished !== undefined
        ? { isPublished: query.isPublished }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.hasLesson !== undefined
        ? { lessonId: query.hasLesson ? { not: null } : null }
        : {}),
      ...(query.hasPassage !== undefined
        ? { readingPassageId: query.hasPassage ? { not: null } : null }
        : {}),
      ...(query.createdById ? { createdById: query.createdById } : {}),
      ...(query.reviewedById ? { reviewedById: query.reviewedById } : {}),
      ...(query.year ? { source: { is: { year: query.year } } } : {}),
    };
    const orderBy =
      query.sort === QuestionSort.CREATED_ASC
        ? [{ deletedAt: 'asc' as const }, { createdAt: 'asc' as const }]
        : query.sort === QuestionSort.UPDATED_DESC
          ? [{ deletedAt: 'asc' as const }, { updatedAt: 'desc' as const }]
          : query.sort === QuestionSort.QUESTION_TEXT_ASC
            ? [{ deletedAt: 'asc' as const }, { questionText: 'asc' as const }]
            : query.sort === QuestionSort.DIFFICULTY_ASC
              ? [{ deletedAt: 'asc' as const }, { difficulty: 'asc' as const }]
              : query.sort === QuestionSort.REVIEW_STATUS
                ? [
                    { deletedAt: 'asc' as const },
                    { reviewStatus: 'asc' as const },
                  ]
                : query.sort === QuestionSort.YEAR_DESC
                  ? [
                      { deletedAt: 'asc' as const },
                      { source: { year: 'desc' as const } },
                    ]
                  : [
                      { deletedAt: 'asc' as const },
                      { createdAt: 'desc' as const },
                    ];
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        include: QUESTION_INCLUDE,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.question.count({ where }),
    ]);
    return {
      items: items.map(toAdminQuestion),
      meta: createPageMeta(query.page, query.limit, totalItems),
    };
  }

  async getAdmin(id: string) {
    return toAdminQuestion(await this.findAdminRecord(id));
  }

  async getStudent(id: string) {
    const question = await this.findAvailableRecord(id);
    return toStudentQuestion(question);
  }

  async similar(id: string) {
    const base = await this.findAvailableRecord(id);
    const candidates = await this.prisma.question.findMany({
      where: {
        id: { not: id },
        subjectId: base.subjectId,
        type: base.type,
        reviewStatus: QuestionReviewStatus.READY,
        isActive: true,
        isPublished: true,
        deletedAt: null,
      },
      include: QUESTION_INCLUDE,
      orderBy: [
        { lessonId: base.lessonId ? 'asc' : 'desc' },
        { unitId: base.unitId ? 'asc' : 'desc' },
        { createdAt: 'desc' },
        { id: 'asc' },
      ],
      take: 30,
    });
    const visible: QuestionWithContent[] = [];
    for (const candidate of candidates) {
      const hierarchy = await this.hierarchy.load(candidate);
      if (this.hierarchy.isVisible(hierarchy)) visible.push(candidate);
      if (visible.length === 10) break;
    }
    return visible.map(toStudentQuestion);
  }

  async update(id: string, actorId: string, dto: UpdateQuestionDto) {
    const current = await this.findAdminRecord(id);
    const type = dto.type ?? current.type;
    const hierarchy = this.mergeHierarchy(current, dto);
    const questionText = dto.questionText ?? current.questionText;
    const inheritedOptions =
      type === QuestionType.TRUE_FALSE
        ? []
        : current.options.map((option) => ({
            optionText: option.optionText,
            optionImageUrl: option.optionImageUrl ?? undefined,
            sortOrder: option.sortOrder,
            isCorrect: option.isCorrect,
            whyWrong: option.whyWrong ?? undefined,
          }));
    const options = dto.options ?? inheritedOptions;
    const correctBoolean =
      dto.correctBoolean !== undefined
        ? dto.correctBoolean
        : current.correctBoolean;
    await this.hierarchy.validate(hierarchy);
    this.validateType(type, correctBoolean, options);
    const fingerprint = createQuestionFingerprint(
      questionText,
      hierarchy.subjectId,
      type,
    );
    await this.ensureNotDuplicate(fingerprint, id);
    const { options: requestedOptions, ...data } = dto;
    const replaceOptions =
      requestedOptions !== undefined || dto.type !== undefined;
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const question = await tx.question.update({
          where: { id },
          data: {
            ...data,
            correctBoolean:
              type === QuestionType.MULTIPLE_CHOICE ? null : correctBoolean,
            fingerprint,
            contentVersion: { increment: 1 },
            isPublished: false,
            reviewStatus: QuestionReviewStatus.DRAFT,
            reviewedById: null,
            reviewedAt: null,
            rejectionReason: null,
            options: replaceOptions
              ? {
                  deleteMany: {},
                  create:
                    type === QuestionType.MULTIPLE_CHOICE ? options : undefined,
                }
              : undefined,
          },
          include: QUESTION_INCLUDE,
        });
        if (current.reviewStatus !== QuestionReviewStatus.DRAFT) {
          await tx.questionReview.create({
            data: {
              questionId: id,
              reviewerId: actorId,
              previousStatus: current.reviewStatus,
              newStatus: QuestionReviewStatus.DRAFT,
              note: 'Content edited',
            },
          });
        }
        return question;
      });
      return toAdminQuestion(updated);
    } catch (error) {
      mapContentPrismaError(error, 'QUESTION_DUPLICATE');
    }
  }

  async remove(id: string) {
    await this.findAdminRecord(id);
    return this.updateRecord(id, {
      deletedAt: new Date(),
      isActive: false,
      isPublished: false,
    });
  }

  async restore(id: string) {
    const question = await this.findAdminRecord(id);
    await this.hierarchy.validate(question);
    return this.updateRecord(id, {
      deletedAt: null,
      isActive: true,
      isPublished: false,
    });
  }

  submitReview(id: string, actorId: string, note?: string) {
    return this.transition(
      id,
      actorId,
      QuestionReviewStatus.REVIEW_REQUIRED,
      note,
    );
  }

  async approve(id: string, actorId: string, note?: string) {
    const question = await this.findAdminRecord(id);
    if (question.createdById === actorId) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        code: 'QUESTION_SELF_APPROVAL_FORBIDDEN',
        message: 'A question creator cannot approve their own question',
      });
    }
    return this.transition(id, actorId, QuestionReviewStatus.READY, note);
  }

  reject(id: string, actorId: string, reason: string) {
    return this.transition(
      id,
      actorId,
      QuestionReviewStatus.REJECTED,
      reason,
      reason,
    );
  }

  archive(id: string, actorId: string, note?: string) {
    return this.transition(id, actorId, QuestionReviewStatus.ARCHIVED, note);
  }

  async publish(id: string) {
    const question = await this.findAdminRecord(id);
    if (
      question.reviewStatus !== QuestionReviewStatus.READY ||
      !question.isActive ||
      question.deletedAt
    ) {
      throw contentBadRequest(
        'QUESTION_NOT_READY_FOR_PUBLISH',
        'Only an active READY question can be published',
      );
    }
    this.validateType(
      question.type,
      question.correctBoolean,
      this.optionInputs(question),
    );
    await this.hierarchy.validate(question, true);
    return this.updateRecord(id, { isPublished: true });
  }

  async unpublish(id: string) {
    await this.findAdminRecord(id);
    return this.updateRecord(id, { isPublished: false });
  }

  async bulk(actorId: string, dto: QuestionBulkActionDto) {
    const questionIds = [...new Set(dto.questionIds)];
    const records = await this.prisma.question.findMany({
      where: { id: { in: questionIds } },
      include: QUESTION_INCLUDE,
    });
    if (records.length !== questionIds.length) {
      throw contentNotFound(
        'QUESTION_NOT_FOUND',
        'One or more questions were not found',
      );
    }

    const assignmentTargetId =
      dto.action === QuestionBulkAction.ASSIGN_UNIT
        ? (dto.unitId ?? dto.targetId)
        : (dto.lessonId ?? dto.targetId);
    let targetUnit: { id: string; subjectId: string } | undefined;
    let targetLesson:
      { id: string; unitId: string; subjectId: string } | undefined;
    if (
      (dto.action === QuestionBulkAction.ASSIGN_UNIT ||
        dto.action === QuestionBulkAction.ASSIGN_LESSON) &&
      !assignmentTargetId
    ) {
      throw contentBadRequest(
        'QUESTION_BULK_ACTION_FAILED',
        'targetId is required for this bulk action',
      );
    }
    if (dto.action === QuestionBulkAction.ASSIGN_UNIT) {
      targetUnit =
        (await this.prisma.unit.findFirst({
          where: { id: assignmentTargetId, isActive: true, deletedAt: null },
          select: { id: true, subjectId: true },
        })) ?? undefined;
      if (!targetUnit) {
        throw contentNotFound('UNIT_NOT_FOUND', 'Unit not found');
      }
    }
    if (dto.action === QuestionBulkAction.ASSIGN_LESSON) {
      targetLesson =
        (await this.prisma.lesson.findFirst({
          where: { id: assignmentTargetId, isActive: true, deletedAt: null },
          select: { id: true, unitId: true, subjectId: true },
        })) ?? undefined;
      if (!targetLesson) {
        throw contentNotFound('LESSON_NOT_FOUND', 'Lesson not found');
      }
    }

    for (const question of records) {
      if (targetUnit && targetUnit.subjectId !== question.subjectId) {
        throw contentBadRequest(
          'QUESTION_HIERARCHY_INVALID',
          'Bulk unit must belong to every question subject',
        );
      }
      if (targetLesson && targetLesson.subjectId !== question.subjectId) {
        throw contentBadRequest(
          'QUESTION_HIERARCHY_INVALID',
          'Bulk lesson must belong to every question subject',
        );
      }
      if (dto.action === QuestionBulkAction.PUBLISH) {
        if (
          question.reviewStatus !== QuestionReviewStatus.READY ||
          !question.isActive ||
          question.deletedAt
        ) {
          throw contentBadRequest(
            'QUESTION_BULK_ACTION_FAILED',
            'Every question must be active and READY before publication',
          );
        }
        this.validateType(
          question.type,
          question.correctBoolean,
          this.optionInputs(question),
        );
        await this.hierarchy.validate(question, true);
      }
      if (dto.action === QuestionBulkAction.ARCHIVE) {
        assertQuestionTransition(
          question.reviewStatus,
          QuestionReviewStatus.ARCHIVED,
        );
      }
      if (dto.action === QuestionBulkAction.SUBMIT_REVIEW) {
        assertQuestionTransition(
          question.reviewStatus,
          QuestionReviewStatus.REVIEW_REQUIRED,
        );
      }
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const question of records) {
          const data =
            dto.action === QuestionBulkAction.PUBLISH
              ? { isPublished: true }
              : dto.action === QuestionBulkAction.UNPUBLISH
                ? { isPublished: false }
                : dto.action === QuestionBulkAction.ARCHIVE
                  ? {
                      reviewStatus: QuestionReviewStatus.ARCHIVED,
                      isPublished: false,
                    }
                  : dto.action === QuestionBulkAction.ACTIVATE
                    ? { isActive: true }
                    : dto.action === QuestionBulkAction.DEACTIVATE
                      ? { isActive: false, isPublished: false }
                      : dto.action === QuestionBulkAction.ASSIGN_UNIT
                        ? {
                            unitId: targetUnit?.id,
                            lessonId: null,
                            reviewStatus: QuestionReviewStatus.DRAFT,
                            isPublished: false,
                            contentVersion: { increment: 1 },
                          }
                        : dto.action === QuestionBulkAction.ASSIGN_LESSON
                          ? {
                              unitId: targetLesson?.unitId,
                              lessonId: targetLesson?.id,
                              reviewStatus: QuestionReviewStatus.DRAFT,
                              isPublished: false,
                              contentVersion: { increment: 1 },
                            }
                          : {
                              reviewStatus:
                                QuestionReviewStatus.REVIEW_REQUIRED,
                              rejectionReason: null,
                              isPublished: false,
                            };
          await tx.question.update({ where: { id: question.id }, data });
          const assignmentReturnedToDraft =
            (dto.action === QuestionBulkAction.ASSIGN_UNIT ||
              dto.action === QuestionBulkAction.ASSIGN_LESSON) &&
            question.reviewStatus !== QuestionReviewStatus.DRAFT;
          if (
            dto.action === QuestionBulkAction.ARCHIVE ||
            dto.action === QuestionBulkAction.SUBMIT_REVIEW ||
            assignmentReturnedToDraft
          ) {
            await tx.questionReview.create({
              data: {
                questionId: question.id,
                reviewerId: actorId,
                previousStatus: question.reviewStatus,
                newStatus:
                  dto.action === QuestionBulkAction.ARCHIVE
                    ? QuestionReviewStatus.ARCHIVED
                    : dto.action === QuestionBulkAction.SUBMIT_REVIEW
                      ? QuestionReviewStatus.REVIEW_REQUIRED
                      : QuestionReviewStatus.DRAFT,
                note: assignmentReturnedToDraft
                  ? 'Hierarchy assignment edited'
                  : undefined,
              },
            });
          }
        }
      });
    } catch (error) {
      mapContentPrismaError(error, 'QUESTION_BULK_ACTION_FAILED');
    }
    return {
      processed: questionIds.length,
      succeeded: questionIds.length,
      failed: 0,
      errors: [],
    };
  }

  private async transition(
    id: string,
    actorId: string,
    nextStatus: QuestionReviewStatus,
    note?: string,
    rejectionReason?: string,
  ) {
    const current = await this.findAdminRecord(id);
    assertQuestionTransition(current.reviewStatus, nextStatus);
    const reviewed =
      nextStatus === QuestionReviewStatus.READY ||
      nextStatus === QuestionReviewStatus.REJECTED;
    const updated = await this.prisma.$transaction(async (tx) => {
      const question = await tx.question.update({
        where: { id },
        data: {
          reviewStatus: nextStatus,
          ...(reviewed
            ? { reviewedById: actorId, reviewedAt: new Date() }
            : {}),
          rejectionReason:
            nextStatus === QuestionReviewStatus.REJECTED
              ? rejectionReason
              : null,
          isPublished:
            nextStatus === QuestionReviewStatus.READY
              ? current.isPublished
              : false,
        },
        include: QUESTION_INCLUDE,
      });
      await tx.questionReview.create({
        data: {
          questionId: id,
          reviewerId: actorId,
          previousStatus: current.reviewStatus,
          newStatus: nextStatus,
          note,
        },
      });
      return question;
    });
    return toAdminQuestion(updated);
  }

  private async findAdminRecord(id: string): Promise<QuestionWithContent> {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: QUESTION_INCLUDE,
    });
    if (!question) {
      throw contentNotFound('QUESTION_NOT_FOUND', 'Question not found');
    }
    return question;
  }

  private async findAvailableRecord(id: string): Promise<QuestionWithContent> {
    const question = await this.prisma.question.findFirst({
      where: {
        id,
        reviewStatus: QuestionReviewStatus.READY,
        isActive: true,
        isPublished: true,
        deletedAt: null,
      },
      include: QUESTION_INCLUDE,
    });
    if (!question) {
      throw contentNotFound(
        'QUESTION_NOT_AVAILABLE',
        'Question is not available',
      );
    }
    const hierarchy = await this.hierarchy.load(question);
    if (!this.hierarchy.isVisible(hierarchy)) {
      throw contentNotFound(
        'QUESTION_NOT_AVAILABLE',
        'Question is not available',
      );
    }
    return question;
  }

  private async updateRecord(
    id: string,
    data: Parameters<PrismaService['question']['update']>[0]['data'],
  ) {
    try {
      return toAdminQuestion(
        await this.prisma.question.update({
          where: { id },
          data,
          include: QUESTION_INCLUDE,
        }),
      );
    } catch (error) {
      mapContentPrismaError(error, 'QUESTION_NOT_FOUND');
    }
  }

  private mergeHierarchy(
    current: QuestionWithContent,
    dto: UpdateQuestionDto,
  ): QuestionHierarchyInput {
    return {
      subjectId: dto.subjectId ?? current.subjectId,
      unitId: dto.unitId === undefined ? current.unitId : dto.unitId,
      lessonId: dto.lessonId === undefined ? current.lessonId : dto.lessonId,
      sourceId: dto.sourceId === undefined ? current.sourceId : dto.sourceId,
      readingPassageId:
        dto.readingPassageId === undefined
          ? current.readingPassageId
          : dto.readingPassageId,
    };
  }

  private optionInputs(
    question: QuestionWithContent,
  ): QuestionOptionInputDto[] {
    return question.options.map((option) => ({
      optionText: option.optionText,
      optionImageUrl: option.optionImageUrl ?? undefined,
      sortOrder: option.sortOrder,
      isCorrect: option.isCorrect,
      whyWrong: option.whyWrong ?? undefined,
    }));
  }

  private validateType(
    type: QuestionType,
    correctBoolean: boolean | null | undefined,
    options: QuestionOptionInputDto[],
  ): void {
    if (type === QuestionType.MULTIPLE_CHOICE) {
      if (options.length < 2) {
        throw contentBadRequest(
          'QUESTION_INVALID_OPTIONS',
          'Multiple-choice questions need at least two options',
        );
      }
      if (options.some((option) => !option.optionText.trim())) {
        throw contentBadRequest(
          'QUESTION_INVALID_OPTIONS',
          'Question options cannot be empty',
        );
      }
      if (options.filter((option) => option.isCorrect).length !== 1) {
        throw contentBadRequest(
          'QUESTION_CORRECT_OPTION_REQUIRED',
          'Multiple-choice questions need exactly one correct option',
        );
      }
      if (correctBoolean !== undefined && correctBoolean !== null) {
        throw contentBadRequest(
          'QUESTION_INVALID_OPTIONS',
          'correctBoolean must be null for multiple-choice questions',
        );
      }
      if (
        new Set(options.map((option) => option.sortOrder)).size !==
        options.length
      ) {
        throw contentBadRequest(
          'QUESTION_INVALID_OPTIONS',
          'Option sortOrder values must be unique',
        );
      }
      const normalizedOptions = options.map((option) =>
        normalizeQuestionText(option.optionText),
      );
      if (new Set(normalizedOptions).size !== normalizedOptions.length) {
        throw contentBadRequest(
          'QUESTION_INVALID_OPTIONS',
          'Question option text must be unique',
        );
      }
      return;
    }
    if (options.length > 0) {
      throw contentBadRequest(
        'QUESTION_INVALID_OPTIONS',
        'True/false questions cannot contain options',
      );
    }
    if (typeof correctBoolean !== 'boolean') {
      throw contentBadRequest(
        'QUESTION_TRUE_FALSE_VALUE_REQUIRED',
        'correctBoolean is required for true/false questions',
      );
    }
  }

  private async ensureNotDuplicate(
    fingerprint: string,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await this.prisma.question.findFirst({
      where: {
        fingerprint,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw contentConflict(
        'QUESTION_DUPLICATE',
        'An equivalent question already exists for this subject and type',
      );
    }
  }
}
