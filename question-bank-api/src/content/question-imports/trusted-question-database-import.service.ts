import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  createReadStream,
  existsSync,
  openSync,
  closeSync,
  readSync,
} from 'node:fs';
import Database from 'better-sqlite3';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import {
  ImportStatus,
  ImportedSourceEntityType,
  QuestionDifficulty,
  QuestionImportApprovalMode,
  QuestionImportMode,
  QuestionImportRowStatus,
  QuestionImportSourceType,
  QuestionOrigin,
  QuestionReviewStatus,
  QuestionType,
  SourceType,
  UserRole,
} from '../../generated/prisma/enums';

export const OWNER_APPROVED_FULL_IMPORT = 'OWNER_APPROVED_FULL_IMPORT' as const;
const CANONICAL_CHECKSUM =
  '400e5ebd6f6ab34c4a6a03f53c7550d3bf57a0897397f4c1905dfee463914bf8';
const EXPECTED = {
  SUBJECT: 7,
  UNIT: 33,
  LESSON: 298,
  SOURCE: 18,
  PASSAGE: 90,
  QUESTION: 19841,
  OPTION: 42035,
} as const;

type Row = Record<string, string | number | null>;
type RecordMaps = Record<ImportedSourceEntityType, Map<string, string>>;

@Injectable()
export class TrustedQuestionDatabaseImportService {
  constructor(private readonly prisma: PrismaService) {}

  async execute(jobId: string, actorId: string, confirmation: string) {
    if (confirmation !== OWNER_APPROVED_FULL_IMPORT)
      throw new BadRequestException(
        'Explicit OWNER_APPROVED_FULL_IMPORT confirmation is required',
      );
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
        'Only an active SUPER_ADMIN can approve the trusted import',
      );
    const job = await this.prisma.questionImportJob.findUnique({
      where: { id: jobId },
    });
    if (!job?.storagePath || !existsSync(job.storagePath))
      throw new BadRequestException('Import source file is unavailable');
    if (job.sourceType !== QuestionImportSourceType.SQLITE)
      throw new BadRequestException(
        'Trusted full import accepts SQLite sources only',
      );
    this.assertSqliteMagic(job.storagePath);
    const checksum = await this.sha256(job.storagePath);
    if (checksum !== CANONICAL_CHECKSUM || job.checksum !== checksum)
      throw new BadRequestException(
        'Source checksum does not match the owner-approved canonical database',
      );

    const db = new Database(job.storagePath, {
      readonly: true,
      fileMustExist: true,
    });
    db.pragma('query_only = ON');
    try {
      const validation = this.validateStructure(db);
      if (validation.blockingErrors.length)
        throw new BadRequestException({
          message: 'Trusted source has blocking structural errors',
          errors: validation.blockingErrors,
        });
      await this.prisma.questionImportJob.update({
        where: { id: jobId },
        data: {
          approvalMode: QuestionImportApprovalMode.OWNER_APPROVED_FULL_IMPORT,
          approvedById: actor.id,
          approvedAt: new Date(),
          mode: QuestionImportMode.IMPORT,
          status: ImportStatus.IMPORTING,
          totalRows: EXPECTED.QUESTION,
          processedRows: 0,
          completedAt: null,
          validationErrors: Prisma.DbNull,
          errorSummary: Prisma.DbNull,
          settingsJson: {
            approvalMode: OWNER_APPROVED_FULL_IMPORT,
            structuralValidation: 'BLOCKING',
            contentQualityWarnings: 'NON_BLOCKING',
            checksum,
            file: job.storagePath,
            totalRows: EXPECTED.QUESTION,
            expectedEntities: EXPECTED,
            batchSize: 100,
            resumable: true,
            idempotency: 'SOURCE_CHECKSUM_AND_SOURCE_ID',
          },
        },
      });
      const maps = await this.loadMaps(checksum);
      await this.importSubjects(db, jobId, checksum, maps);
      await this.importUnits(db, jobId, checksum, maps);
      await this.importLessons(db, jobId, checksum, maps);
      await this.importSources(db, jobId, checksum, maps);
      await this.importPassages(db, jobId, checksum, maps);
      await this.importQuestions(
        db,
        jobId,
        actor.id,
        checksum,
        maps,
        job.fileName,
      );
      const verification = await this.verify(checksum);
      const complete = Object.entries(EXPECTED).every(
        ([key, count]) => verification.entities[key] === count,
      );
      if (!complete)
        throw new Error(
          `Trusted import count verification failed: ${JSON.stringify(verification.entities)}`,
        );
      await this.prisma.questionImportJob.update({
        where: { id: jobId },
        data: {
          status: verification.inactiveQuestions
            ? ImportStatus.COMPLETED_WITH_WARNINGS
            : ImportStatus.COMPLETED,
          importedRows: EXPECTED.QUESTION,
          processedRows: EXPECTED.QUESTION,
          cursor: EXPECTED.QUESTION,
          failedRows: 0,
          completedAt: new Date(),
          errorSummary: {
            qualityWarningsNonBlocking: true,
            inactiveQuestions: verification.inactiveQuestions,
            ownerSourceIncomplete: verification.ownerSourceIncomplete,
            ambiguousTrueFalse: verification.ambiguousTrueFalse,
            exactDuplicateTextGroupsPreserved:
              verification.exactDuplicateTextGroupsPreserved,
          },
        },
      });
      return {
        jobId,
        approvalMode: OWNER_APPROVED_FULL_IMPORT,
        checksum,
        ...verification,
      };
    } catch (error) {
      await this.prisma.questionImportJob
        .update({
          where: { id: jobId },
          data: {
            status: ImportStatus.FAILED,
            completedAt: new Date(),
            errorSummary: {
              code: 'OWNER_APPROVED_IMPORT_FAILED',
              message: error instanceof Error ? error.message : String(error),
            },
          },
        })
        .catch(() => undefined);
      throw error;
    } finally {
      db.close();
    }
  }

  async resume(jobId: string, actorId: string, confirmation: string) {
    return this.execute(jobId, actorId, confirmation);
  }

  async verify(checksum: string) {
    const grouped = await this.prisma.importedSourceRecord.groupBy({
      by: ['entityType'],
      where: { sourceChecksum: checksum },
      _count: { _all: true },
    });
    const entities = Object.fromEntries(
      Object.keys(EXPECTED).map((key) => [
        key,
        grouped.find((x) => x.entityType === key)?._count._all ?? 0,
      ]),
    );
    const questionIds = await this.prisma.importedSourceRecord.findMany({
      where: {
        sourceChecksum: checksum,
        entityType: ImportedSourceEntityType.QUESTION,
      },
      select: { targetRecordId: true, metadataJson: true },
    });
    const ids = questionIds.map((x) => x.targetRecordId);
    const [inactiveQuestions, ownerSourceIncomplete, sourceReferences] =
      await Promise.all([
        this.prisma.question.count({
          where: { id: { in: ids }, isActive: false },
        }),
        this.prisma.question.count({
          where: {
            id: { in: ids },
            rejectionReason: 'OWNER_SOURCE_INCOMPLETE',
          },
        }),
        this.prisma.questionSourceReference.count({
          where: { sourceChecksum: checksum },
        }),
      ]);
    const ambiguousTrueFalse = questionIds.filter((item) => {
      const metadata = item.metadataJson;
      return (
        metadata !== null &&
        typeof metadata === 'object' &&
        !Array.isArray(metadata) &&
        metadata.technicalState === 'AMBIGUOUS_TRUE_FALSE'
      );
    }).length;
    const exactDuplicateTextGroupsPreserved =
      await this.countDuplicateOptionText(ids);
    const optionContentMismatches =
      await this.countOptionContentMismatches(checksum);
    return {
      entities,
      sourceReferences,
      inactiveQuestions,
      ownerSourceIncomplete,
      ambiguousTrueFalse,
      exactDuplicateTextGroupsPreserved,
      optionContentMismatches,
    };
  }

  private validateStructure(db: Database.Database) {
    const integrity = db.pragma('integrity_check', { simple: true });
    const integrityText = this.scalarText(integrity);
    const tableCounts = {
      SUBJECT: this.count(db, 'subjects'),
      UNIT: this.count(db, 'curriculum_units'),
      LESSON: this.count(db, 'curriculum_lessons'),
      SOURCE: this.count(db, 'source_sets'),
      PASSAGE: this.count(db, 'passages'),
      QUESTION: this.count(db, 'questions'),
      OPTION: this.count(db, 'question_options'),
    };
    const blockingErrors: string[] = [];
    if (integrityText !== 'ok')
      blockingErrors.push(['SQLITE_INTEGRITY', integrityText].join(':'));
    for (const [key, expected] of Object.entries(EXPECTED))
      if (tableCounts[key as keyof typeof tableCounts] !== expected)
        blockingErrors.push(
          `COUNT_${key}:${tableCounts[key as keyof typeof tableCounts]}!=${expected}`,
        );
    const orphanChecks: Array<[string, string]> = [
      [
        'ORPHAN_UNIT',
        'select count(*) c from curriculum_units u left join subjects s on s.id=u.subject_id where s.id is null',
      ],
      [
        'ORPHAN_LESSON',
        'select count(*) c from curriculum_lessons l left join curriculum_units u on u.id=l.unit_id where u.id is null',
      ],
      [
        'ORPHAN_SOURCE',
        'select count(*) c from source_sets x left join subjects s on s.id=x.subject_id where s.id is null',
      ],
      [
        'ORPHAN_PASSAGE',
        'select count(*) c from passages p left join source_sets s on s.id=p.source_set_id where s.id is null',
      ],
      [
        'ORPHAN_QUESTION',
        'select count(*) c from questions q left join subjects s on s.id=q.subject_id left join source_sets x on x.id=q.source_set_id where s.id is null or x.id is null',
      ],
      [
        'ORPHAN_QUESTION_UNIT',
        'select count(*) c from questions q left join curriculum_units u on u.id=q.curriculum_unit_id where q.curriculum_unit_id is not null and u.id is null',
      ],
      [
        'ORPHAN_QUESTION_LESSON',
        'select count(*) c from questions q left join curriculum_lessons l on l.id=q.curriculum_lesson_id where q.curriculum_lesson_id is not null and l.id is null',
      ],
      [
        'ORPHAN_QUESTION_PASSAGE',
        'select count(*) c from questions q left join passages p on p.id=q.passage_id where q.passage_id is not null and p.id is null',
      ],
      [
        'ORPHAN_OPTION',
        'select count(*) c from question_options o left join questions q on q.id=o.question_id where q.id is null',
      ],
      [
        'DUPLICATE_OPTION_SORT',
        'select count(*) c from (select question_id,sort_order,count(*) n from question_options group by question_id,sort_order having n>1)',
      ],
    ];
    for (const [code, sql] of orphanChecks) {
      const n = Number((db.prepare(sql).get() as { c: number }).c);
      if (n) blockingErrors.push(`${code}:${n}`);
    }
    return { tableCounts, blockingErrors };
  }

  private async importSubjects(
    db: Database.Database,
    jobId: string,
    checksum: string,
    maps: RecordMaps,
  ) {
    const rows = db
      .prepare('select * from subjects order by id')
      .all() as Row[];
    const targets = await this.prisma.subject.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    });
    for (const row of rows) {
      const sid = String(row.id);
      if (maps.SUBJECT.has(sid)) continue;
      const sourceName = String(row.name_ar ?? '');
      const target = targets.find(
        (x) => this.subjectKey(x.name) === this.subjectKey(sourceName),
      );
      if (!target)
        throw new Error(
          `No explicit target subject mapping for source subject ${sid}:${sourceName}`,
        );
      await this.addRecord(
        jobId,
        checksum,
        ImportedSourceEntityType.SUBJECT,
        sid,
        target.id,
        row,
      );
      maps.SUBJECT.set(sid, target.id);
    }
  }

  private async importUnits(
    db: Database.Database,
    jobId: string,
    checksum: string,
    maps: RecordMaps,
  ) {
    for (const row of db
      .prepare('select * from curriculum_units order by id')
      .all() as Row[]) {
      const id = String(row.id);
      if (maps.UNIT.has(id)) continue;
      const subjectId = this.requiredMap(
        maps.SUBJECT,
        row.subject_id,
        'unit subject',
      );
      const target = await this.prisma.$transaction(async (tx) => {
        const unit = await tx.unit.create({
          data: {
            subjectId,
            name: String(row.unit_title ?? ''),
            slug: `owner-${checksum.slice(0, 8)}-unit-${id}`,
            description: String(row.notes ?? ''),
            sortOrder: Number(row.unit_order ?? 0),
            isActive: true,
            isPublished: true,
          },
        });
        await tx.importedSourceRecord.create({
          data: {
            importJobId: jobId,
            sourceChecksum: checksum,
            entityType: ImportedSourceEntityType.UNIT,
            sourceRecordId: id,
            targetRecordId: unit.id,
            metadataJson: this.json(row),
          },
        });
        return unit;
      });
      maps.UNIT.set(id, target.id);
    }
  }

  private async importLessons(
    db: Database.Database,
    jobId: string,
    checksum: string,
    maps: RecordMaps,
  ) {
    for (const row of db
      .prepare('select * from curriculum_lessons order by id')
      .all() as Row[]) {
      const id = String(row.id);
      if (maps.LESSON.has(id)) continue;
      const unitId = this.requiredMap(maps.UNIT, row.unit_id, 'lesson unit');
      const unit = await this.prisma.unit.findUniqueOrThrow({
        where: { id: unitId },
        select: { subjectId: true },
      });
      const target = await this.prisma.$transaction(async (tx) => {
        const lesson = await tx.lesson.create({
          data: {
            subjectId: unit.subjectId,
            unitId,
            name: String(row.lesson_title ?? ''),
            slug: `owner-${checksum.slice(0, 8)}-lesson-${id}`,
            description: String(row.notes ?? ''),
            summary: JSON.stringify({
              pageFrom: row.page_from,
              pageTo: row.page_to,
              lessonCode: row.lesson_code,
            }),
            sortOrder: Number(row.lesson_order ?? 0),
            isActive: true,
            isPublished: true,
          },
        });
        await tx.importedSourceRecord.create({
          data: {
            importJobId: jobId,
            sourceChecksum: checksum,
            entityType: ImportedSourceEntityType.LESSON,
            sourceRecordId: id,
            targetRecordId: lesson.id,
            metadataJson: this.json(row),
          },
        });
        return lesson;
      });
      maps.LESSON.set(id, target.id);
    }
  }

  private async importSources(
    db: Database.Database,
    jobId: string,
    checksum: string,
    maps: RecordMaps,
  ) {
    for (const row of db
      .prepare('select * from source_sets order by id')
      .all() as Row[]) {
      const id = String(row.id);
      if (maps.SOURCE.has(id)) continue;
      const year = String(row.academic_year ?? '').match(/\d{4}/)?.[0];
      const target = await this.prisma.$transaction(async (tx) => {
        const source = await tx.source.create({
          data: {
            name: String(row.title ?? ''),
            type: SourceType.IMPORT,
            year: year ? Number(year) : null,
            description: String(row.notes ?? ''),
            isOfficial: false,
            isActive: true,
          },
        });
        await tx.importedSourceRecord.create({
          data: {
            importJobId: jobId,
            sourceChecksum: checksum,
            entityType: ImportedSourceEntityType.SOURCE,
            sourceRecordId: id,
            targetRecordId: source.id,
            metadataJson: this.json(row),
          },
        });
        return source;
      });
      maps.SOURCE.set(id, target.id);
    }
  }

  private async importPassages(
    db: Database.Database,
    jobId: string,
    checksum: string,
    maps: RecordMaps,
  ) {
    const sourceSubjects = new Map(
      (db.prepare('select id,subject_id from source_sets').all() as Row[]).map(
        (x) => [String(x.id), String(x.subject_id)],
      ),
    );
    for (const row of db
      .prepare('select * from passages order by id')
      .all() as Row[]) {
      const id = String(row.id);
      if (maps.PASSAGE.has(id)) continue;
      const sourceSetId = String(row.source_set_id);
      const subjectSourceId = sourceSubjects.get(sourceSetId);
      if (!subjectSourceId)
        throw new Error(`Passage ${id} source subject missing`);
      const target = await this.prisma.$transaction(async (tx) => {
        const passage = await tx.readingPassage.create({
          data: {
            subjectId: this.requiredMap(
              maps.SUBJECT,
              subjectSourceId,
              'passage subject',
            ),
            sourceId: this.requiredMap(
              maps.SOURCE,
              sourceSetId,
              'passage source',
            ),
            title: String(row.model_code || row.model_number || ''),
            passageText: String(row.passage_text ?? ''),
            languageCode: 'ar',
            isActive: true,
            isPublished: true,
          },
        });
        await tx.importedSourceRecord.create({
          data: {
            importJobId: jobId,
            sourceChecksum: checksum,
            entityType: ImportedSourceEntityType.PASSAGE,
            sourceRecordId: id,
            targetRecordId: passage.id,
            metadataJson: this.json(row),
          },
        });
        return passage;
      });
      maps.PASSAGE.set(id, target.id);
    }
  }

  private async importQuestions(
    db: Database.Database,
    jobId: string,
    actorId: string,
    checksum: string,
    maps: RecordMaps,
    sourceFile: string,
  ) {
    const existing = new Set(maps.QUESTION.keys());
    const rows = db
      .prepare('select * from questions order by id')
      .all() as Row[];
    const optionStmt = db.prepare(
      'select * from question_options where question_id=? order by sort_order,id',
    );
    for (let offset = 0; offset < rows.length; offset += 100) {
      const state = await this.prisma.questionImportJob.findUnique({
        where: { id: jobId },
        select: { status: true },
      });
      if (
        state?.status === ImportStatus.PAUSED ||
        state?.status === ImportStatus.CANCELLED
      )
        return;
      const batch = rows
        .slice(offset, offset + 100)
        .filter((q) => !existing.has(String(q.id)));
      if (batch.length) {
        await this.prisma.$transaction(
          async (tx) => {
            for (const row of batch) {
              const sourceId = String(row.id);
              const type = this.questionType(row.question_type);
              if (!type)
                throw new Error(
                  `Unsupported question type at source id ${sourceId}`,
                );
              const options = optionStmt.all(row.id) as Row[];
              const text = String(row.question_text ?? '');
              const tf =
                type === QuestionType.TRUE_FALSE
                  ? this.trueFalse(row.correct_answer)
                  : null;
              const incomplete = text.trim() === '';
              const ambiguous = type === QuestionType.TRUE_FALSE && tf === null;
              const active = !incomplete && !ambiguous;
              const question = await tx.question.create({
                data: {
                  subjectId: this.requiredMap(
                    maps.SUBJECT,
                    row.subject_id,
                    'question subject',
                  ),
                  unitId:
                    row.curriculum_unit_id == null
                      ? null
                      : this.requiredMap(
                          maps.UNIT,
                          row.curriculum_unit_id,
                          'question unit',
                        ),
                  lessonId:
                    row.curriculum_lesson_id == null
                      ? null
                      : this.requiredMap(
                          maps.LESSON,
                          row.curriculum_lesson_id,
                          'question lesson',
                        ),
                  sourceId: this.requiredMap(
                    maps.SOURCE,
                    row.source_set_id,
                    'question source',
                  ),
                  readingPassageId:
                    row.passage_id == null
                      ? null
                      : this.requiredMap(
                          maps.PASSAGE,
                          row.passage_id,
                          'question passage',
                        ),
                  type,
                  questionText: text,
                  correctBoolean: tf,
                  hintText: this.stringOrNull(row.hint_text),
                  explanationShort: this.stringOrNull(row.explanation_short),
                  explanationDetailed: this.stringOrNull(
                    row.explanation_detailed ?? row.explanation,
                  ),
                  difficulty: this.difficulty(row.difficulty),
                  reviewStatus: active
                    ? QuestionReviewStatus.READY
                    : QuestionReviewStatus.DRAFT,
                  origin: QuestionOrigin.IMPORTED,
                  fingerprint: this.stringOrNull(row.fingerprint),
                  isActive: active,
                  isPublished: active,
                  createdById: actorId,
                  reviewedById: active ? actorId : null,
                  reviewedAt: active ? new Date() : null,
                  rejectionReason: incomplete
                    ? 'OWNER_SOURCE_INCOMPLETE'
                    : ambiguous
                      ? 'OWNER_SOURCE_UNREPRESENTABLE_TRUE_FALSE'
                      : null,
                },
              });
              const optionData = options.map((o) => ({
                id: randomUUID(),
                questionId: question.id,
                optionText: String(o.option_text ?? ''),
                sortOrder: Number(o.sort_order),
                isCorrect: Boolean(o.isCorrect),
                whyWrong: this.stringOrNull(o.whyWrong ?? o.why_wrong),
              }));
              if (optionData.length)
                await tx.questionOption.createMany({ data: optionData });
              await tx.questionSourceReference.create({
                data: {
                  questionId: question.id,
                  importJobId: jobId,
                  sourceType: QuestionImportSourceType.SQLITE,
                  sourceFile,
                  sourceRow: Number(row.id),
                  externalId: String(row.external_id ?? row.id),
                  sourceChecksum: checksum,
                },
              });
              await tx.importedSourceRecord.create({
                data: {
                  importJobId: jobId,
                  sourceChecksum: checksum,
                  entityType: ImportedSourceEntityType.QUESTION,
                  sourceRecordId: sourceId,
                  targetRecordId: question.id,
                  metadataJson: this.json({
                    ...row,
                    technicalState: incomplete
                      ? 'OWNER_SOURCE_INCOMPLETE'
                      : ambiguous
                        ? 'AMBIGUOUS_TRUE_FALSE'
                        : 'READY_PUBLISHED',
                  }),
                },
              });
              if (optionData.length)
                await tx.importedSourceRecord.createMany({
                  data: options.map((o, i) => ({
                    id: randomUUID(),
                    importJobId: jobId,
                    sourceChecksum: checksum,
                    entityType: ImportedSourceEntityType.OPTION,
                    sourceRecordId: String(o.id),
                    targetRecordId: optionData[i].id,
                    metadataJson: this.json(o),
                  })),
                });
              await tx.questionImportRow.updateMany({
                where: { importJobId: jobId, rowNumber: Number(row.id) },
                data: {
                  status: QuestionImportRowStatus.IMPORTED,
                  destinationQuestionId: question.id,
                },
              });
              maps.QUESTION.set(sourceId, question.id);
              for (let i = 0; i < options.length; i++)
                maps.OPTION.set(String(options[i].id), optionData[i].id);
            }
          },
          { timeout: 120000 },
        );
      }
      const imported = await this.prisma.importedSourceRecord.count({
        where: {
          sourceChecksum: checksum,
          entityType: ImportedSourceEntityType.QUESTION,
        },
      });
      await this.prisma.questionImportJob.update({
        where: { id: jobId },
        data: {
          importedRows: imported,
          processedRows: imported,
          cursor: Math.min(offset + 100, rows.length),
        },
      });
    }
  }

  private async loadMaps(checksum: string) {
    const maps = {} as RecordMaps;
    for (const type of Object.values(ImportedSourceEntityType))
      maps[type] = new Map();
    const records = await this.prisma.importedSourceRecord.findMany({
      where: { sourceChecksum: checksum },
      select: { entityType: true, sourceRecordId: true, targetRecordId: true },
    });
    for (const row of records)
      maps[row.entityType].set(row.sourceRecordId, row.targetRecordId);
    return maps;
  }
  private async addRecord(
    jobId: string,
    checksum: string,
    entityType: ImportedSourceEntityType,
    sourceRecordId: string,
    targetRecordId: string,
    metadata: unknown,
  ) {
    await this.prisma.importedSourceRecord.create({
      data: {
        importJobId: jobId,
        sourceChecksum: checksum,
        entityType,
        sourceRecordId,
        targetRecordId,
        metadataJson: this.json(metadata),
      },
    });
  }
  private requiredMap(
    map: Map<string, string>,
    source: unknown,
    label: string,
  ) {
    const id = map.get(String(source));
    if (!id)
      throw new Error(
        `Missing ${label} mapping for source id ${String(source)}`,
      );
    return id;
  }
  private count(db: Database.Database, table: string) {
    return Number(
      (db.prepare(`select count(*) c from ${table}`).get() as { c: number }).c,
    );
  }
  private questionType(v: unknown) {
    if (v === 'اختيار من متعدد' || v === QuestionType.MULTIPLE_CHOICE)
      return QuestionType.MULTIPLE_CHOICE;
    if (v === 'صح وخطأ' || v === QuestionType.TRUE_FALSE)
      return QuestionType.TRUE_FALSE;
    return null;
  }
  private scalarText(value: unknown): string {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    )
      return value.toString();
    return JSON.stringify(value) ?? '';
  }

  private trueFalse(v: unknown) {
    const key = this.scalarText(v)
      .trim()
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه');
    if (['صح', 'صواب', 'true', '1'].includes(key)) return true;
    if (['خطا', 'false', '0'].includes(key)) return false;
    return null;
  }
  private difficulty(v: unknown) {
    const key = this.scalarText(v).toUpperCase();
    return Object.values(QuestionDifficulty).includes(key as QuestionDifficulty)
      ? (key as QuestionDifficulty)
      : QuestionDifficulty.MEDIUM;
  }
  private stringOrNull(v: unknown) {
    return v == null ? null : this.scalarText(v);
  }
  private subjectKey(v: string) {
    return v.trim().normalize('NFKC').replace(/[أإآ]/g, 'ا').replace(/^ال/, '');
  }
  private json(v: unknown) {
    return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
  }
  private async countOptionContentMismatches(checksum: string) {
    const rows = await this.prisma.$queryRaw<Array<{ c: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint c
      FROM "ImportedSourceRecord" r
      JOIN "QuestionOption" o ON o.id = r."targetRecordId"
      WHERE r."sourceChecksum" = ${checksum}
        AND r."entityType" = 'OPTION'::"ImportedSourceEntityType"
        AND (
          o."optionText" IS DISTINCT FROM r."metadataJson"->>'option_text'
          OR o."sortOrder" IS DISTINCT FROM (r."metadataJson"->>'sort_order')::int
          OR o."isCorrect" IS DISTINCT FROM CASE WHEN lower(r."metadataJson"->>'isCorrect') IN ('1', 'true') THEN true ELSE false END
          OR o."whyWrong" IS DISTINCT FROM COALESCE(r."metadataJson"->>'whyWrong', r."metadataJson"->>'why_wrong')
        )
    `);
    return Number(rows[0]?.c ?? 0);
  }
  private async countDuplicateOptionText(questionIds: string[]) {
    if (!questionIds.length) return 0;
    const rows = await this.prisma.$queryRaw<Array<{ c: bigint }>>(
      Prisma.sql`SELECT count(*)::bigint c FROM (SELECT "questionId", "optionText" FROM "QuestionOption" WHERE "questionId" IN (${Prisma.join(questionIds)}) GROUP BY "questionId", "optionText" HAVING count(*) > 1) d`,
    );
    return Number(rows[0]?.c ?? 0);
  }
  private assertSqliteMagic(path: string) {
    const fd = openSync(path, 'r');
    try {
      const b = Buffer.alloc(16);
      readSync(fd, b, 0, 16, 0);
      if (b.toString('binary') !== 'SQLite format 3\u0000')
        throw new BadRequestException('Source is not SQLite 3');
    } finally {
      closeSync(fd);
    }
  }
  private sha256(path: string) {
    return new Promise<string>((resolve, reject) => {
      const h = createHash('sha256');
      const s = createReadStream(path);
      s.on('data', (c) => h.update(c));
      s.on('error', reject);
      s.on('end', () => resolve(h.digest('hex')));
    });
  }
}
