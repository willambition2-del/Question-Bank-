import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createReadStream, openSync, readSync, closeSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { Prisma } from '../../generated/prisma/client';
import {
  ImportFileType,
  ImportStatus,
  QuestionImportConflictPolicy,
  QuestionImportMode,
  QuestionImportRowStatus,
  QuestionImportSourceType,
  QuestionImportRollbackStatus,
  QuestionOrigin,
  QuestionReviewStatus,
  QuestionType,
  UserRole,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';

type SourceQuestion = {
  id: number;
  external_id: string | null;
  question_type: string | null;
  question_text: string | null;
  correct_answer: string | null;
  explanation: string | null;
  hint_text: string | null;
  explanation_short: string | null;
  explanation_detailed: string | null;
  difficulty: string | null;
  tags: string | null;
  review_required: number | null;
  reviewRequired: number | null;
  fingerprint: string | null;
  subject_name: string | null;
  unit_title: string | null;
  lesson_title: string | null;
  source_title: string | null;
  academic_year: string | null;
};

type SourceOption = {
  question_id: number;
  option_text: string | null;
  sort_order: number | null;
  isCorrect: number | null;
  why_wrong: string | null;
  whyWrong: string | null;
};

export type SqliteDryRunReport = {
  jobId: string;
  sourceFile: string;
  checksum: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateExactRows: number;
  requiresReviewRows: number;
  readyForImportRows: number;
  missingCorrectAnswerRows: number;
  missingOptionsRows: number;
  missingSubjectRows: number;
  missingLessonRows: number;
  unmatchedSubjects: string[];
  unmatchedUnits: string[];
  unmatchedLessons: string[];
  errorSamples: Array<{
    row: number;
    externalId: string | null;
    codes: string[];
  }>;
};

@Injectable()
export class QuestionImportEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async dryRunSqlite(
    sourcePath: string,
    actorId?: string,
  ): Promise<SqliteDryRunReport> {
    const absolutePath = resolve(sourcePath);
    this.assertSqliteMagic(absolutePath);
    const checksum = await this.sha256(absolutePath);
    const actor = actorId
      ? await this.prisma.user.findFirst({
          where: {
            id: actorId,
            role: UserRole.SUPER_ADMIN,
            isActive: true,
            deletedAt: null,
          },
          select: { id: true },
        })
      : await this.prisma.user.findFirst({
          where: {
            role: UserRole.SUPER_ADMIN,
            isActive: true,
            deletedAt: null,
          },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });

    const existing = await this.prisma.questionImportJob.findUnique({
      where: { checksum },
    });
    const job = existing
      ? await this.prisma.$transaction(async (tx) => {
          await tx.questionImportRow.deleteMany({
            where: { importJobId: existing.id },
          });
          return tx.questionImportJob.update({
            where: { id: existing.id },
            data: this.jobStartData(absolutePath, actor?.id),
          });
        })
      : await this.prisma.questionImportJob.create({
          data: {
            ...this.jobStartData(absolutePath, actor?.id),
            checksum,
          },
        });

    const db = new Database(absolutePath, {
      readonly: true,
      fileMustExist: true,
    });
    db.pragma('query_only = ON');
    try {
      const integrity = db.pragma('integrity_check', { simple: true });
      if (integrity !== 'ok')
        throw new BadRequestException(
          `SQLite integrity check failed: ${String(integrity)}`,
        );
      const sourceQuestions = db
        .prepare(
          `
        SELECT q.id, q.external_id, q.question_type, q.question_text, q.correct_answer,
               q.explanation, q.hint_text, q.explanation_short, q.explanation_detailed,
               q.difficulty, q.tags, q.review_required, q.reviewRequired, q.fingerprint,
               s.name_ar AS subject_name, cu.unit_title, cl.lesson_title,
               ss.title AS source_title, ss.academic_year
          FROM questions q
          LEFT JOIN subjects s ON s.id = q.subject_id
          LEFT JOIN curriculum_units cu ON cu.id = q.curriculum_unit_id
          LEFT JOIN curriculum_lessons cl ON cl.id = q.curriculum_lesson_id
          LEFT JOIN source_sets ss ON ss.id = q.source_set_id
         WHERE q.deletedAt IS NULL
         ORDER BY q.id
      `,
        )
        .all() as SourceQuestion[];
      const sourceOptions = db
        .prepare(
          `
        SELECT question_id, option_text, sort_order, isCorrect, why_wrong, whyWrong
          FROM question_options
         ORDER BY question_id, sort_order, id
      `,
        )
        .all() as SourceOption[];
      const optionsByQuestion = new Map<number, SourceOption[]>();
      for (const option of sourceOptions) {
        const list = optionsByQuestion.get(option.question_id) ?? [];
        list.push(option);
        optionsByQuestion.set(option.question_id, list);
      }

      const [subjects, units, lessons, existingQuestions] = await Promise.all([
        this.prisma.subject.findMany({
          where: { deletedAt: null, isActive: true },
          select: { id: true, name: true },
        }),
        this.prisma.unit.findMany({
          where: { deletedAt: null, isActive: true },
          select: { id: true, subjectId: true, name: true },
        }),
        this.prisma.lesson.findMany({
          where: { deletedAt: null, isActive: true },
          select: { id: true, subjectId: true, unitId: true, name: true },
        }),
        this.prisma.question.findMany({
          where: { deletedAt: null, fingerprint: { not: null } },
          select: { fingerprint: true },
        }),
      ]);
      const subjectsByName = new Map(
        subjects.map((item) => [this.searchKey(item.name), item]),
      );
      const subjectAliases: Record<string, string> = {
        احياء: 'الاحياء',
        فيزياء: 'الفيزياء',
        كيمياء: 'الكيمياء',
      };
      for (const [alias, canonical] of Object.entries(subjectAliases)) {
        const destination = subjectsByName.get(canonical);
        if (destination) subjectsByName.set(alias, destination);
      }
      const unitsByName = new Map(
        units.map((item) => [
          `${item.subjectId}|${this.searchKey(item.name)}`,
          item,
        ]),
      );
      const lessonsByName = new Map(
        lessons.map((item) => [
          `${item.subjectId}|${this.searchKey(item.name)}`,
          item,
        ]),
      );
      const knownFingerprints = new Set(
        existingQuestions.flatMap((item) =>
          item.fingerprint ? [item.fingerprint] : [],
        ),
      );
      const seenFingerprints = new Set<string>();
      const unmatchedSubjects = new Set<string>();
      const unmatchedUnits = new Set<string>();
      const unmatchedLessons = new Set<string>();
      const errorSamples: SqliteDryRunReport['errorSamples'] = [];
      let validRows = 0;
      let invalidRows = 0;
      let duplicateExactRows = 0;
      let requiresReviewRows = 0;
      let missingCorrectAnswerRows = 0;
      let missingOptionsRows = 0;
      let missingSubjectRows = 0;
      let missingLessonRows = 0;
      const staging: Prisma.QuestionImportRowCreateManyInput[] = [];

      for (const question of sourceQuestions) {
        const errors: string[] = [];
        const warnings: string[] = [];
        const text = this.preserveText(question.question_text);
        const subjectName = this.preserveText(question.subject_name);
        const subject = subjectsByName.get(this.searchKey(subjectName));
        if (!text) errors.push('EMPTY_QUESTION_TEXT');
        if (!subject) {
          errors.push('SUBJECT_NOT_MAPPED');
          missingSubjectRows += 1;
          if (subjectName) unmatchedSubjects.add(subjectName);
        }
        const type = this.questionType(question.question_type);
        if (!type) errors.push('UNSUPPORTED_QUESTION_TYPE');
        const options = optionsByQuestion.get(question.id) ?? [];
        let correctBoolean: boolean | null = null;
        if (type === QuestionType.MULTIPLE_CHOICE) {
          if (options.length < 2) {
            errors.push('MCQ_MISSING_OPTIONS');
            missingOptionsRows += 1;
          }
          const normalizedOptionTexts = options
            .map((option) => this.searchKey(option.option_text ?? ''))
            .filter(Boolean);
          if (
            new Set(normalizedOptionTexts).size !== normalizedOptionTexts.length
          )
            errors.push('DUPLICATE_OPTION_TEXT');
          const correctCount = options.filter(
            (option) => option.isCorrect === 1,
          ).length;
          if (correctCount !== 1) {
            errors.push(
              correctCount === 0
                ? 'MCQ_MISSING_CORRECT_OPTION'
                : 'MCQ_MULTIPLE_CORRECT_OPTIONS',
            );
            missingCorrectAnswerRows += 1;
          }
        } else if (type === QuestionType.TRUE_FALSE) {
          correctBoolean = this.trueFalse(question.correct_answer);
          if (correctBoolean === null) {
            errors.push('TRUE_FALSE_ANSWER_AMBIGUOUS');
            missingCorrectAnswerRows += 1;
          }
        }
        const unit =
          subject && question.unit_title
            ? unitsByName.get(
                `${subject.id}|${this.searchKey(question.unit_title)}`,
              )
            : undefined;
        const lesson =
          subject && question.lesson_title
            ? lessonsByName.get(
                `${subject.id}|${this.searchKey(question.lesson_title)}`,
              )
            : undefined;
        if (question.unit_title && !unit) {
          warnings.push('UNIT_NOT_MAPPED');
          unmatchedUnits.add(`${subjectName}: ${question.unit_title}`);
        }
        if (!lesson) {
          warnings.push('LESSON_NOT_MAPPED');
          missingLessonRows += 1;
          if (question.lesson_title)
            unmatchedLessons.add(`${subjectName}: ${question.lesson_title}`);
        }
        if (lesson && unit && lesson.unitId !== unit.id)
          errors.push('LESSON_UNIT_CONFLICT');
        if (question.review_required === 1 || question.reviewRequired === 1)
          warnings.push('SOURCE_REVIEW_REQUIRED');
        const fingerprint =
          subject && type && text
            ? this.fingerprint(text, subject.id, type)
            : null;
        const duplicate = Boolean(
          fingerprint &&
          (knownFingerprints.has(fingerprint) ||
            seenFingerprints.has(fingerprint)),
        );
        if (duplicate && errors.length === 0) duplicateExactRows += 1;
        if (fingerprint) seenFingerprints.add(fingerprint);
        let status: QuestionImportRowStatus;
        if (errors.length) {
          status = QuestionImportRowStatus.INVALID;
          invalidRows += 1;
        } else if (duplicate) {
          status = QuestionImportRowStatus.DUPLICATE;
        } else if (warnings.length) {
          status = QuestionImportRowStatus.REQUIRES_REVIEW;
          requiresReviewRows += 1;
        } else {
          status = QuestionImportRowStatus.VALID;
          validRows += 1;
        }
        if (errors.length && errorSamples.length < 25)
          errorSamples.push({
            row: question.id,
            externalId: question.external_id,
            codes: errors,
          });
        const sourcePayload = {
          sourceQuestionId: question.id,
          externalId: question.external_id,
          subject: subjectName,
          unit: question.unit_title,
          lesson: question.lesson_title,
          source: question.source_title,
          year: question.academic_year,
          questionType: question.question_type,
          questionText: question.question_text,
          correctAnswer: question.correct_answer,
          explanation: question.explanation,
          options: options.map((option) => ({
            text: option.option_text,
            order: option.sort_order,
            isCorrect: option.isCorrect === 1,
            whyWrong: option.whyWrong ?? option.why_wrong,
          })),
        };
        const normalizedPayload = {
          subjectId: subject?.id ?? null,
          unitId: unit?.id ?? null,
          lessonId: lesson?.id ?? null,
          type,
          questionText: text,
          correctBoolean,
          hintText: this.preserveText(question.hint_text),
          explanationShort: this.preserveText(
            question.explanation_short || question.explanation,
          ),
          explanationDetailed: this.preserveText(question.explanation_detailed),
          options: sourcePayload.options,
        };
        staging.push({
          importJobId: job.id,
          rowNumber: question.id,
          externalId: question.external_id,
          sourcePayloadJson: sourcePayload,
          normalizedPayloadJson: normalizedPayload,
          status,
          errorCodes: errors,
          warningCodes: warnings,
          fingerprint,
        });
        if (staging.length >= 500) {
          await this.prisma.questionImportRow.createMany({ data: staging });
          staging.length = 0;
        }
      }
      if (staging.length)
        await this.prisma.questionImportRow.createMany({ data: staging });
      const report: SqliteDryRunReport = {
        jobId: job.id,
        sourceFile: basename(absolutePath),
        checksum,
        totalRows: sourceQuestions.length,
        validRows,
        invalidRows,
        duplicateExactRows,
        requiresReviewRows,
        readyForImportRows: validRows,
        missingCorrectAnswerRows,
        missingOptionsRows,
        missingSubjectRows,
        missingLessonRows,
        unmatchedSubjects: [...unmatchedSubjects].sort(),
        unmatchedUnits: [...unmatchedUnits].sort(),
        unmatchedLessons: [...unmatchedLessons].sort(),
        errorSamples,
      };
      await this.prisma.questionImportJob.update({
        where: { id: job.id },
        data: {
          status: ImportStatus.DRY_RUN_COMPLETED,
          totalRows: report.totalRows,
          processedRows: report.totalRows,
          validRows: report.validRows,
          invalidRows: report.invalidRows,
          duplicateRows: report.duplicateExactRows,
          skippedRows: report.duplicateExactRows,
          reviewRows: report.requiresReviewRows,
          cursor: report.totalRows,
          completedAt: new Date(),
          errorSummary: report,
        },
      });
      return report;
    } catch (error) {
      await this.prisma.questionImportJob.update({
        where: { id: job.id },
        data: {
          status: ImportStatus.FAILED,
          completedAt: new Date(),
          errorSummary: {
            code: 'DRY_RUN_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      });
      throw error;
    } finally {
      db.close();
    }
  }

  async rows(
    jobId: string,
    page = 1,
    limit = 50,
    status?: QuestionImportRowStatus,
  ) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const safePage = Math.max(page, 1);
    const where = { importJobId: jobId, ...(status ? { status } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.questionImportRow.findMany({
        where,
        orderBy: { rowNumber: 'asc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        select: {
          id: true,
          rowNumber: true,
          sheetName: true,
          externalId: true,
          status: true,
          errorCodes: true,
          warningCodes: true,
          fingerprint: true,
          destinationQuestionId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.questionImportRow.count({ where }),
    ]);
    return {
      items,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async report(jobId: string) {
    const job = await this.prisma.questionImportJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        fileName: true,
        checksum: true,
        status: true,
        mode: true,
        approvalMode: true,
        approvedById: true,
        approvedAt: true,
        totalRows: true,
        processedRows: true,
        validRows: true,
        invalidRows: true,
        duplicateRows: true,
        reviewRows: true,
        importedRows: true,
        skippedRows: true,
        failedRows: true,
        cursor: true,
        errorSummary: true,
        startedAt: true,
        completedAt: true,
      },
    });
    if (!job) throw new BadRequestException('Question import job not found');
    const grouped = await this.prisma.questionImportRow.groupBy({
      by: ['status'],
      where: { importJobId: jobId },
      _count: { _all: true },
    });
    return {
      ...job,
      rowsByStatus: Object.fromEntries(
        grouped.map((item) => [item.status, item._count._all]),
      ),
    };
  }

  async confirm(jobId: string, actorId: string) {
    const actor = await this.prisma.user.findFirst({
      where: {
        id: actorId,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!actor)
      throw new BadRequestException(
        'Only an active SUPER_ADMIN can confirm an import',
      );
    const job = await this.prisma.questionImportJob.findUnique({
      where: { id: jobId },
    });
    if (!job || job.status !== ImportStatus.DRY_RUN_COMPLETED)
      throw new BadRequestException(
        'A completed dry run is required before import',
      );
    if (job.validRows < 1)
      throw new BadRequestException('Dry run has no ready rows to import');
    await this.prisma.questionImportJob.update({
      where: { id: jobId },
      data: {
        status: ImportStatus.IMPORTING,
        mode: QuestionImportMode.IMPORT,
        completedAt: null,
      },
    });
    let imported = job.importedRows;
    while (true) {
      const state = await this.prisma.questionImportJob.findUnique({
        where: { id: jobId },
        select: { status: true },
      });
      if (
        !state ||
        state.status === ImportStatus.CANCELLED ||
        state.status === ImportStatus.PAUSED
      )
        return this.report(jobId);
      const batch = await this.prisma.questionImportRow.findMany({
        where: {
          importJobId: jobId,
          status: QuestionImportRowStatus.VALID,
          destinationQuestionId: null,
        },
        orderBy: { rowNumber: 'asc' },
        take: 100,
      });
      if (!batch.length) break;
      for (const row of batch) {
        const value = row.normalizedPayloadJson as Record<
          string,
          unknown
        > | null;
        if (
          !value ||
          typeof value.subjectId !== 'string' ||
          typeof value.questionText !== 'string' ||
          typeof value.type !== 'string'
        ) {
          await this.prisma.questionImportRow.update({
            where: { id: row.id },
            data: {
              status: QuestionImportRowStatus.FAILED,
              errorCodes: ['NORMALIZED_PAYLOAD_INVALID'],
            },
          });
          continue;
        }
        const options = Array.isArray(value.options)
          ? (value.options as Array<Record<string, unknown>>)
          : [];
        const created = await this.prisma.$transaction(async (tx) => {
          const question = await tx.question.create({
            data: {
              subjectId: value.subjectId as string,
              unitId: typeof value.unitId === 'string' ? value.unitId : null,
              lessonId:
                typeof value.lessonId === 'string' ? value.lessonId : null,
              type: value.type as QuestionType,
              questionText: value.questionText as string,
              correctBoolean:
                typeof value.correctBoolean === 'boolean'
                  ? value.correctBoolean
                  : null,
              hintText:
                typeof value.hintText === 'string' && value.hintText
                  ? value.hintText
                  : null,
              explanationShort:
                typeof value.explanationShort === 'string' &&
                value.explanationShort
                  ? value.explanationShort
                  : null,
              explanationDetailed:
                typeof value.explanationDetailed === 'string' &&
                value.explanationDetailed
                  ? value.explanationDetailed
                  : null,
              reviewStatus: QuestionReviewStatus.REVIEW_REQUIRED,
              origin: QuestionOrigin.IMPORTED,
              fingerprint: row.fingerprint,
              isPublished: false,
              createdById: actor.id,
              options:
                value.type === QuestionType.MULTIPLE_CHOICE
                  ? {
                      create: options.map((option, index) => ({
                        optionText:
                          typeof option.text === 'string'
                            ? option.text
                            : typeof option.optionText === 'string'
                              ? option.optionText
                              : '',
                        sortOrder:
                          typeof option.order === 'number'
                            ? option.order
                            : index,
                        isCorrect: option.isCorrect === true,
                        whyWrong:
                          typeof option.whyWrong === 'string'
                            ? option.whyWrong
                            : null,
                      })),
                    }
                  : undefined,
            },
          });
          await tx.questionSourceReference.create({
            data: {
              questionId: question.id,
              importJobId: jobId,
              sourceType: job.sourceType ?? QuestionImportSourceType.MANUAL,
              sourceFile: job.fileName,
              sourceRow: row.rowNumber,
              externalId: row.externalId,
              sourceChecksum: job.checksum ?? `job:${job.id}`,
            },
          });
          await tx.questionImportRow.update({
            where: { id: row.id },
            data: {
              status: QuestionImportRowStatus.IMPORTED,
              destinationQuestionId: question.id,
            },
          });
          return question;
        });
        if (created) imported += 1;
      }
      await this.prisma.questionImportJob.update({
        where: { id: jobId },
        data: {
          importedRows: imported,
          processedRows: { increment: batch.length },
          cursor: batch[batch.length - 1].rowNumber,
        },
      });
    }
    await this.prisma.questionImportJob.update({
      where: { id: jobId },
      data: {
        status:
          job.invalidRows || job.reviewRows || job.duplicateRows
            ? ImportStatus.COMPLETED_WITH_WARNINGS
            : ImportStatus.COMPLETED,
        importedRows: imported,
        completedAt: new Date(),
      },
    });
    return this.report(jobId);
  }

  async pause(jobId: string) {
    return this.prisma.questionImportJob.update({
      where: { id: jobId, status: ImportStatus.IMPORTING },
      data: { status: ImportStatus.PAUSED },
    });
  }

  async resume(jobId: string, actorId: string) {
    const job = await this.prisma.questionImportJob.update({
      where: { id: jobId, status: ImportStatus.PAUSED },
      data: { status: ImportStatus.DRY_RUN_COMPLETED },
    });
    return this.confirm(job.id, actorId);
  }

  async cancel(jobId: string) {
    return this.prisma.questionImportJob.update({
      where: { id: jobId },
      data: { status: ImportStatus.CANCELLED, completedAt: new Date() },
    });
  }

  async rollback(jobId: string, actorId: string) {
    const actor = await this.prisma.user.findFirst({
      where: {
        id: actorId,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!actor)
      throw new BadRequestException(
        'Only an active SUPER_ADMIN can rollback imports',
      );
    const rollback = await this.prisma.questionImportRollback.create({
      data: { importJobId: jobId, actorId },
    });
    const refs = await this.prisma.questionSourceReference.findMany({
      where: { importJobId: jobId },
      include: {
        question: {
          include: {
            _count: {
              select: {
                attemptQuestions: true,
                challengeQuestions: true,
                studentProgress: true,
                examModels: true,
              },
            },
          },
        },
      },
    });
    let deleted = 0;
    const blocked: Array<{ questionId: string; reason: string }> = [];
    for (const ref of refs) {
      const count = ref.question._count;
      const modifiedAfterImport =
        ref.question.updatedAt.getTime() > ref.importedAt.getTime() + 5000;
      if (
        modifiedAfterImport ||
        count.attemptQuestions ||
        count.challengeQuestions ||
        count.studentProgress ||
        count.examModels
      ) {
        blocked.push({
          questionId: ref.questionId,
          reason: modifiedAfterImport
            ? 'MANUALLY_MODIFIED'
            : 'BLOCKED_BY_DEPENDENCIES',
        });
        continue;
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.questionSourceReference.delete({ where: { id: ref.id } });
        await tx.question.delete({ where: { id: ref.questionId } });
        await tx.questionImportRow.updateMany({
          where: { importJobId: jobId, destinationQuestionId: ref.questionId },
          data: {
            status: QuestionImportRowStatus.SKIPPED,
            destinationQuestionId: null,
            warningCodes: ['ROLLED_BACK'],
          },
        });
      });
      deleted += 1;
    }
    const status = blocked.length
      ? deleted
        ? QuestionImportRollbackStatus.COMPLETED_WITH_BLOCKS
        : QuestionImportRollbackStatus.BLOCKED_BY_DEPENDENCIES
      : QuestionImportRollbackStatus.COMPLETED;
    await this.prisma.$transaction([
      this.prisma.questionImportRollback.update({
        where: { id: rollback.id },
        data: {
          status,
          deletedRows: deleted,
          blockedRows: blocked.length,
          blockedReason: blocked,
          completedAt: new Date(),
        },
      }),
      this.prisma.questionImportJob.update({
        where: { id: jobId },
        data: {
          status: blocked.length
            ? ImportStatus.COMPLETED_WITH_WARNINGS
            : ImportStatus.ROLLED_BACK,
        },
      }),
    ]);
    return {
      rollbackId: rollback.id,
      status,
      deletedRows: deleted,
      blockedRows: blocked.length,
      blocked,
    };
  }
  private jobStartData(path: string, actorId?: string) {
    return {
      uploadedById: actorId,
      fileName: basename(path).slice(0, 255),
      originalFileName: basename(path).slice(0, 255),
      storagePath: path,
      fileType: ImportFileType.SQLITE,
      sourceType: QuestionImportSourceType.SQLITE,
      status: ImportStatus.DRY_RUNNING,
      mode: QuestionImportMode.DRY_RUN,
      conflictPolicy: QuestionImportConflictPolicy.SKIP_EXISTING,
      totalRows: 0,
      processedRows: 0,
      validRows: 0,
      invalidRows: 0,
      importedRows: 0,
      updatedRows: 0,
      skippedRows: 0,
      duplicateRows: 0,
      failedRows: 0,
      reviewRows: 0,
      cursor: 0,
      payload: { sourceKind: 'verified-question-bank-sqlite', readOnly: true },
      validationErrors: Prisma.DbNull,
      errorSummary: Prisma.DbNull,
      settingsJson: {
        conflictPolicy: 'SKIP_EXISTING',
        batchSize: 500,
        finalImportAuthorized: false,
      },
      startedAt: new Date(),
      completedAt: null,
    } as const;
  }

  private questionType(value: string | null): QuestionType | null {
    if (value === 'اختيار من متعدد' || value === QuestionType.MULTIPLE_CHOICE)
      return QuestionType.MULTIPLE_CHOICE;
    if (value === 'صح وخطأ' || value === QuestionType.TRUE_FALSE)
      return QuestionType.TRUE_FALSE;
    return null;
  }

  private trueFalse(value: string | null): boolean | null {
    const key = this.searchKey(value ?? '');
    if (['صح', 'صواب', 'true', '1'].includes(key)) return true;
    if (['خطا', 'false', '0'].includes(key)) return false;
    return null;
  }

  private preserveText(value: string | null | undefined): string {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  }

  private searchKey(value: string): string {
    return this.preserveText(value)
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/[،؛]/g, ',');
  }

  private fingerprint(
    text: string,
    subjectId: string,
    type: QuestionType,
  ): string {
    return createHash('sha256')
      .update(`${this.searchKey(text)}|${subjectId}|${type}`)
      .digest('hex');
  }

  private assertSqliteMagic(path: string) {
    const descriptor = openSync(path, 'r');
    try {
      const header = Buffer.alloc(16);
      readSync(descriptor, header, 0, header.length, 0);
      if (header.toString('binary') !== 'SQLite format 3\u0000')
        throw new BadRequestException('Source is not a SQLite 3 database');
    } finally {
      closeSync(descriptor);
    }
  }

  private sha256(path: string): Promise<string> {
    return new Promise((resolveHash, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(path);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolveHash(hash.digest('hex')));
    });
  }
}
