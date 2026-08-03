import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import ExcelJS from 'exceljs';
import * as unzipper from 'unzipper';
import { FileTypeDetector } from '../../common/files/file-type-detector';
import { createPageMeta } from '../../common/pagination/pagination';
import { educationNotFound } from '../../education/education-errors';
import { Prisma } from '../../generated/prisma/client';
import {
  ImportFileType,
  ImportStatus,
  QuestionImportMode,
  QuestionImportRowStatus,
  QuestionDifficulty,
  QuestionOrigin,
  QuestionReviewStatus,
  QuestionType,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { PageQueryDto } from '../../common/pagination/page-query.dto';

export interface UploadedImportFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

type RawRow = Record<string, unknown>;
type NormalizedRow = {
  subjectId: string;
  unitId?: string;
  lessonId?: string;
  sourceId?: string;
  readingPassageId?: string;
  type: QuestionType;
  questionText: string;
  correctBoolean?: boolean;
  difficulty: QuestionDifficulty;
  options: Array<{
    optionText: string;
    sortOrder: number;
    isCorrect: boolean;
    whyWrong?: string;
  }>;
};

type ValidationIssue = {
  row: number;
  code: string;
  message: string;
  duplicate?: boolean;
};

@Injectable()
export class QuestionImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileTypes: FileTypeDetector,
  ) {}

  async upload(actorId: string, file?: UploadedImportFile) {
    if (!file) throw this.invalid('A CSV, JSON, XLSX, or ZIP file is required');
    const maxBytes =
      Number(process.env.QUESTION_IMPORT_MAX_FILE_MB ?? 25) * 1024 * 1024;
    if (file.size > maxBytes)
      throw this.invalid('Import file exceeds QUESTION_IMPORT_MAX_FILE_MB');
    const extension = extname(file.originalname).toLowerCase();
    const fileType =
      extension === '.csv'
        ? ImportFileType.CSV
        : extension === '.json'
          ? ImportFileType.JSON
          : extension === '.xlsx'
            ? ImportFileType.XLSX
            : extension === '.zip'
              ? ImportFileType.ZIP
              : null;
    if (!fileType)
      throw this.invalid('Only CSV, JSON, XLSX, and ZIP files are supported');
    if (
      (fileType === ImportFileType.XLSX || fileType === ImportFileType.ZIP) &&
      file.buffer.subarray(0, 2).toString('binary') !== 'PK'
    ) {
      throw this.invalid('XLSX file signature is invalid');
    }
    const parsedPayload = await this.parseFile(fileType, file.buffer);
    const payload = await this.mapNamedHierarchy(parsedPayload);
    if (!payload.length) throw this.invalid('Import file contains no rows');
    if (payload.length > 50000)
      throw this.invalid('Import file cannot exceed 50000 rows');
    const job = await this.prisma.questionImportJob.create({
      data: {
        uploadedById: actorId,
        fileName: file.originalname.slice(0, 255),
        fileType,
        totalRows: payload.length,
        payload: payload as Prisma.InputJsonValue,
      },
    });
    return this.toJob(job);
  }

  async dryRun(id: string) {
    const before = await this.findJob(id);
    if (
      before.status === ImportStatus.PENDING ||
      before.status === ImportStatus.FAILED
    ) {
      await this.validate(id);
    }
    const job = await this.findJob(id);
    if (
      job.status !== ImportStatus.READY_TO_IMPORT &&
      job.status !== ImportStatus.FAILED
    ) {
      throw this.invalid('Import must be uploaded and analyzed before dry run');
    }
    const rows = this.payloadRows(job.payload);
    const issues = Array.isArray(job.validationErrors)
      ? (job.validationErrors as ValidationIssue[])
      : [];
    const issuesByRow = new Map<number, ValidationIssue[]>();
    for (const issue of issues) {
      const list = issuesByRow.get(issue.row) ?? [];
      list.push(issue);
      issuesByRow.set(issue.row, list);
    }
    await this.prisma.questionImportRow.deleteMany({
      where: { importJobId: id },
    });
    let validRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;
    const staging: Prisma.QuestionImportRowCreateManyInput[] = [];
    rows.forEach((raw, index) => {
      const rowNumber = index + 2;
      const normalized = this.normalize(raw);
      const rowIssues = issuesByRow.get(rowNumber) ?? [];
      const duplicate = rowIssues.some((issue) => issue.duplicate);
      const invalid = Boolean(
        normalized.error || rowIssues.some((issue) => !issue.duplicate),
      );
      const status = invalid
        ? QuestionImportRowStatus.INVALID
        : duplicate
          ? QuestionImportRowStatus.DUPLICATE
          : QuestionImportRowStatus.VALID;
      if (invalid) invalidRows += 1;
      else if (duplicate) duplicateRows += 1;
      else validRows += 1;
      staging.push({
        importJobId: id,
        rowNumber,
        externalId: this.text(raw.external_id ?? raw.externalId) || null,
        sourcePayloadJson: raw as Prisma.InputJsonValue,
        normalizedPayloadJson: normalized.data,
        status,
        errorCodes: rowIssues
          .filter((issue) => !issue.duplicate)
          .map((issue) => issue.code),
        warningCodes: duplicate ? ['DUPLICATE_CANDIDATE'] : [],
        fingerprint: normalized.data ? this.fingerprint(normalized.data) : null,
      });
    });
    for (let offset = 0; offset < staging.length; offset += 500) {
      await this.prisma.questionImportRow.createMany({
        data: staging.slice(offset, offset + 500),
      });
    }
    const completed = await this.prisma.questionImportJob.update({
      where: { id },
      data: {
        status: ImportStatus.DRY_RUN_COMPLETED,
        mode: QuestionImportMode.DRY_RUN,
        processedRows: rows.length,
        validRows,
        invalidRows,
        duplicateRows,
        skippedRows: duplicateRows,
        cursor: rows.length,
        completedAt: new Date(),
      },
    });
    return this.toJob(completed);
  }
  async validate(id: string) {
    const job = await this.findJob(id);
    if (
      job.status !== ImportStatus.PENDING &&
      job.status !== ImportStatus.FAILED
    ) {
      throw this.invalid('Only a pending or failed import can be validated');
    }
    await this.prisma.questionImportJob.update({
      where: { id },
      data: { status: ImportStatus.VALIDATING, startedAt: new Date() },
    });
    try {
      const rows = this.payloadRows(job.payload);
      const normalized = rows.map((row) => this.normalize(row));
      const subjectIds = [
        ...new Set(
          normalized.flatMap((row) => (row.data ? [row.data.subjectId] : [])),
        ),
      ];
      const dataRows = normalized.flatMap((row) =>
        row.data ? [row.data] : [],
      );
      const unitIds = [
        ...new Set(dataRows.flatMap((row) => (row.unitId ? [row.unitId] : []))),
      ];
      const lessonIds = [
        ...new Set(
          dataRows.flatMap((row) => (row.lessonId ? [row.lessonId] : [])),
        ),
      ];
      const sourceIds = [
        ...new Set(
          dataRows.flatMap((row) => (row.sourceId ? [row.sourceId] : [])),
        ),
      ];
      const passageIds = [
        ...new Set(
          dataRows.flatMap((row) =>
            row.readingPassageId ? [row.readingPassageId] : [],
          ),
        ),
      ];
      const [subjects, units, lessons, sources, passages] = await Promise.all([
        this.prisma.subject.findMany({
          where: { id: { in: subjectIds }, isActive: true, deletedAt: null },
          select: { id: true },
        }),
        this.prisma.unit.findMany({
          where: { id: { in: unitIds }, isActive: true, deletedAt: null },
          select: { id: true, subjectId: true },
        }),
        this.prisma.lesson.findMany({
          where: { id: { in: lessonIds }, isActive: true, deletedAt: null },
          select: { id: true, subjectId: true, unitId: true },
        }),
        this.prisma.source.findMany({
          where: { id: { in: sourceIds }, isActive: true, deletedAt: null },
          select: { id: true },
        }),
        this.prisma.readingPassage.findMany({
          where: { id: { in: passageIds }, isActive: true, deletedAt: null },
          select: { id: true, subjectId: true },
        }),
      ]);
      const validSubjects = new Set(subjects.map((subject) => subject.id));
      const validSources = new Set(sources.map((source) => source.id));
      const unitsById = new Map(units.map((unit) => [unit.id, unit]));
      const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
      const passagesById = new Map(
        passages.map((passage) => [passage.id, passage]),
      );
      const fingerprints = normalized.flatMap((row) =>
        row.data ? [this.fingerprint(row.data)] : [],
      );
      const existing = await this.prisma.question.findMany({
        where: { fingerprint: { in: fingerprints }, deletedAt: null },
        select: { fingerprint: true },
      });
      const duplicateFingerprints = new Set(
        existing.flatMap((item) =>
          item.fingerprint ? [item.fingerprint] : [],
        ),
      );
      const seen = new Set<string>();
      const issues: ValidationIssue[] = [];
      let validRows = 0;
      let duplicateRows = 0;
      normalized.forEach((result, index) => {
        const rowNumber = index + 2;
        if (result.error) {
          issues.push({
            row: rowNumber,
            code: 'INVALID_ROW',
            message: result.error,
          });
          return;
        }
        const data = result.data!;
        if (!validSubjects.has(data.subjectId)) {
          issues.push({
            row: rowNumber,
            code: 'SUBJECT_NOT_FOUND',
            message: 'subjectId is not active or does not exist',
          });
          return;
        }
        const unit = data.unitId ? unitsById.get(data.unitId) : undefined;
        const lesson = data.lessonId
          ? lessonsById.get(data.lessonId)
          : undefined;
        const passage = data.readingPassageId
          ? passagesById.get(data.readingPassageId)
          : undefined;
        const relationInvalid =
          (data.unitId && (!unit || unit.subjectId !== data.subjectId)) ||
          (data.lessonId &&
            (!lesson ||
              lesson.subjectId !== data.subjectId ||
              (data.unitId && lesson.unitId !== data.unitId))) ||
          (data.sourceId && !validSources.has(data.sourceId)) ||
          (data.readingPassageId &&
            (!passage || passage.subjectId !== data.subjectId));
        if (relationInvalid) {
          issues.push({
            row: rowNumber,
            code: 'INVALID_RELATION',
            message: 'A related content ID is invalid for the subject',
          });
          return;
        }
        validRows += 1;
        const fingerprint = this.fingerprint(data);
        if (duplicateFingerprints.has(fingerprint) || seen.has(fingerprint)) {
          duplicateRows += 1;
          issues.push({
            row: rowNumber,
            code: 'DUPLICATE_CANDIDATE',
            message: 'A matching fingerprint already exists',
            duplicate: true,
          });
        }
        seen.add(fingerprint);
      });
      const invalidRows = rows.length - validRows;
      const status =
        validRows > duplicateRows
          ? ImportStatus.READY_TO_IMPORT
          : ImportStatus.FAILED;
      const updated = await this.prisma.questionImportJob.update({
        where: { id },
        data: {
          status,
          totalRows: rows.length,
          validRows,
          invalidRows,
          duplicateRows,
          validationErrors: issues,
          completedAt: status === ImportStatus.FAILED ? new Date() : null,
        },
      });
      return this.toJob(updated);
    } catch (error) {
      await this.prisma.questionImportJob.update({
        where: { id },
        data: { status: ImportStatus.FAILED, completedAt: new Date() },
      });
      throw error;
    }
  }

  async execute(id: string) {
    const job = await this.findJob(id);
    if (job.status !== ImportStatus.READY_TO_IMPORT) {
      throw this.invalid('Import must be validated and ready before execution');
    }
    const issues = Array.isArray(job.validationErrors)
      ? (job.validationErrors as ValidationIssue[])
      : [];
    const skippedRows = new Set(
      issues
        .filter((issue) => !issue.duplicate || issue.duplicate)
        .map((issue) => issue.row - 2),
    );
    const rows = this.payloadRows(job.payload)
      .map((row, index) => ({ index, normalized: this.normalize(row) }))
      .filter((item) => !skippedRows.has(item.index) && item.normalized.data)
      .map((item) => item.normalized.data!);
    await this.prisma.questionImportJob.update({
      where: { id },
      data: {
        status: ImportStatus.PROCESSING,
        startedAt: new Date(),
        completedAt: null,
      },
    });
    try {
      const questionRows: Prisma.QuestionCreateManyInput[] = [];
      const optionRows: Prisma.QuestionOptionCreateManyInput[] = [];
      for (const row of rows) {
        const questionId = randomUUID();
        questionRows.push({
          id: questionId,
          subjectId: row.subjectId,
          unitId: row.unitId,
          lessonId: row.lessonId,
          sourceId: row.sourceId,
          readingPassageId: row.readingPassageId,
          type: row.type,
          questionText: row.questionText,
          correctBoolean:
            row.type === QuestionType.TRUE_FALSE ? row.correctBoolean : null,
          difficulty: row.difficulty,
          reviewStatus: QuestionReviewStatus.REVIEW_REQUIRED,
          origin: QuestionOrigin.IMPORTED,
          fingerprint: this.fingerprint(row),
          isPublished: false,
          createdById: job.uploadedById,
        });
        optionRows.push(
          ...row.options.map((option) => ({
            id: randomUUID(),
            questionId,
            optionText: option.optionText,
            sortOrder: option.sortOrder,
            isCorrect: option.isCorrect,
            whyWrong: option.whyWrong,
          })),
        );
      }
      await this.prisma.$transaction(async (tx) => {
        if (questionRows.length)
          await tx.question.createMany({ data: questionRows });
        if (optionRows.length)
          await tx.questionOption.createMany({ data: optionRows });
        await tx.questionImportJob.update({
          where: { id },
          data: {
            status: ImportStatus.COMPLETED,
            importedRows: questionRows.length,
            completedAt: new Date(),
          },
        });
      });
      return this.toJob(await this.findJob(id));
    } catch (error) {
      await this.prisma.questionImportJob.update({
        where: { id },
        data: { status: ImportStatus.FAILED, completedAt: new Date() },
      });
      throw error;
    }
  }

  async list(query: PageQueryDto) {
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.questionImportJob.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.questionImportJob.count(),
    ]);
    return {
      items: items.map((item) => this.toJob(item)),
      meta: createPageMeta(query.page, query.limit, totalItems),
    };
  }

  async get(id: string) {
    return this.toJob(await this.findJob(id));
  }

  async errors(id: string) {
    const job = await this.findJob(id);
    return {
      jobId: job.id,
      status: job.status,
      invalidRows: job.invalidRows,
      duplicateRows: job.duplicateRows,
      failedRows: job.failedRows,
      reviewRows: job.reviewRows,
      cursor: job.cursor,
      errors: Array.isArray(job.validationErrors) ? job.validationErrors : [],
    };
  }

  private async parseFile(
    type: ImportFileType,
    buffer: Buffer,
  ): Promise<RawRow[]> {
    const content = buffer.toString('utf8').replace(/^\uFEFF/, '');
    if (type === ImportFileType.JSON) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw this.invalid('JSON file is malformed');
      }
      if (!this.isRawRowArray(parsed))
        throw this.invalid('JSON root must be an array of objects');
      return parsed;
    }
    if (type === ImportFileType.ZIP) {
      const archive = await unzipper.Open.buffer(buffer);
      const seen = new Set<string>();
      const maxUncompressed =
        Number(process.env.QUESTION_ZIP_MAX_UNCOMPRESSED_MB ?? 250) *
        1024 *
        1024;
      let total = 0;
      for (const entry of archive.files) {
        const safePath = entry.path.replace(/\\/g, '/');
        if (safePath.startsWith('/') || safePath.split('/').includes('..'))
          throw this.invalid('ZIP path traversal is not allowed');
        const key = safePath.toLowerCase();
        if (seen.has(key))
          throw this.invalid('ZIP contains duplicate file names');
        seen.add(key);
        total += entry.uncompressedSize;
        if (total > maxUncompressed)
          throw this.invalid('ZIP uncompressed size limit exceeded');
      }
      const workbookEntry = archive.files.find(
        (entry) =>
          entry.type === 'File' &&
          entry.path.replace(/\\/g, '/').toLowerCase() === 'questions.xlsx',
      );
      if (!workbookEntry)
        throw this.invalid('ZIP must contain questions.xlsx at its root');
      const rows = await this.parseFile(
        ImportFileType.XLSX,
        await workbookEntry.buffer(),
      );
      const imageEntries = new Map(
        archive.files
          .filter(
            (entry) =>
              entry.type === 'File' &&
              entry.path
                .replace(/\\/g, '/')
                .toLowerCase()
                .startsWith('images/'),
          )
          .map((entry) => [
            entry.path.replace(/\\/g, '/').toLowerCase(),
            entry,
          ]),
      );
      for (const row of rows) {
        const reference = this.text(row.image_file);
        if (!reference) continue;
        const entry = imageEntries.get(
          reference.replace(/\\/g, '/').toLowerCase(),
        );
        if (!entry)
          throw this.invalid(`Referenced image is missing: ${reference}`);
        const bytes = await entry.buffer();
        const detected = await this.fileTypes.detectFromBuffer(bytes);
        if (!detected?.mime.startsWith('image/'))
          throw this.invalid(`Invalid image signature: ${reference}`);
        const maxImage =
          Number(process.env.QUESTION_IMAGE_MAX_MB ?? 8) * 1024 * 1024;
        if (bytes.length > maxImage)
          throw this.invalid(`Image exceeds size limit: ${reference}`);
      }
      return rows;
    }
    if (type === ImportFileType.XLSX) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      const sheet =
        workbook.getWorksheet('Questions') ?? workbook.worksheets[0];
      if (!sheet) return [];
      const headers = sheet.getRow(1).values as unknown[];
      const names = headers.slice(1).map((value) => this.text(value));
      if (!names.length || names.some((header) => !header))
        throw this.invalid('XLSX headers cannot be empty');
      const rows: RawRow[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const record: RawRow = {};
        let hasValue = false;
        names.forEach((name, index) => {
          const cell = row.getCell(index + 1);
          const value = cell.value;
          if (value && typeof value === 'object' && 'formula' in value)
            throw this.invalid('Formulas are not allowed in import data');
          const normalized =
            value instanceof Date
              ? value.toISOString()
              : value && typeof value === 'object' && 'text' in value
                ? String(value.text)
                : (value ?? '');
          const normalizedText =
            typeof normalized === 'string'
              ? normalized
              : typeof normalized === 'number' ||
                  typeof normalized === 'boolean'
                ? normalized.toString()
                : '';
          if (normalizedText.trim()) hasValue = true;
          record[name] = normalized;
        });
        if (hasValue) rows.push(record);
      });
      return rows;
    }
    const records = this.parseCsv(content);
    if (records.length < 2) return [];
    const headers = records[0].map((value) => value.trim());
    if (headers.some((header) => !header))
      throw this.invalid('CSV headers cannot be empty');
    return records
      .slice(1)
      .filter((row) => row.some(Boolean))
      .map((row) =>
        Object.fromEntries(
          headers.map((header, index) => [header, row[index] ?? '']),
        ),
      );
  }
  private async mapNamedHierarchy(rows: RawRow[]): Promise<RawRow[]> {
    if (rows.every((row) => this.text(row.subjectId))) return rows;
    const [subjects, units, lessons] = await Promise.all([
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
    ]);
    const subjectMap = new Map(
      subjects.map((item) => [this.searchKey(item.name), item]),
    );
    for (const [alias, canonical] of Object.entries({
      احياء: 'الاحياء',
      فيزياء: 'الفيزياء',
      كيمياء: 'الكيمياء',
    })) {
      const item = subjectMap.get(canonical);
      if (item) subjectMap.set(alias, item);
    }
    const unitMap = new Map(
      units.map((item) => [
        `${item.subjectId}|${this.searchKey(item.name)}`,
        item,
      ]),
    );
    const lessonMap = new Map(
      lessons.map((item) => [
        `${item.subjectId}|${this.searchKey(item.name)}`,
        item,
      ]),
    );
    return rows.map((row) => {
      const subject = this.text(row.subjectId)
        ? undefined
        : subjectMap.get(
            this.searchKey(this.text(row.subject ?? row['المادة'])),
          );
      const subjectId = this.text(row.subjectId) || subject?.id || '';
      const unit = this.text(row.unitId)
        ? undefined
        : unitMap.get(
            `${subjectId}|${this.searchKey(this.text(row.unit ?? row['الوحدة']))}`,
          );
      const lesson = this.text(row.lessonId)
        ? undefined
        : lessonMap.get(
            `${subjectId}|${this.searchKey(this.text(row.lesson ?? row['الدرس']))}`,
          );
      return {
        ...row,
        subjectId,
        unitId: this.text(row.unitId) || unit?.id || '',
        lessonId: this.text(row.lessonId) || lesson?.id || '',
      };
    });
  }

  private searchKey(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/\s+/g, ' ');
  }
  private parseCsv(content: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;
    for (let index = 0; index < content.length; index += 1) {
      const char = content[index];
      if (char === '"') {
        if (quoted && content[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = !quoted;
      } else if (char === ',' && !quoted) {
        row.push(field);
        field = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && content[index + 1] === '\n') index += 1;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else field += char;
    }
    if (quoted) throw this.invalid('CSV contains an unterminated quoted field');
    if (field || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  private normalize(raw: RawRow): { data?: NormalizedRow; error?: string } {
    const subjectId = this.text(raw.subjectId ?? raw.subject_id);
    const questionText = this.text(
      raw.questionText ?? raw.question_text ?? raw.question ?? raw['السؤال'],
    );
    const rawType = this.text(raw.type ?? raw.question_type);
    const type = (
      rawType === 'MCQ'
        ? QuestionType.MULTIPLE_CHOICE
        : rawType === 'TF'
          ? QuestionType.TRUE_FALSE
          : rawType
    ) as QuestionType;
    if (
      !subjectId ||
      !questionText ||
      !Object.values(QuestionType).includes(type)
    ) {
      return {
        error: 'subjectId, questionText, and a valid type are required',
      };
    }
    const difficultyValue =
      this.text(raw.difficulty) || QuestionDifficulty.MEDIUM;
    if (
      !Object.values(QuestionDifficulty).includes(
        difficultyValue as QuestionDifficulty,
      )
    ) {
      return { error: 'difficulty is invalid' };
    }
    let options: NormalizedRow['options'] = [];
    let correctBoolean: boolean | undefined;
    if (type === QuestionType.MULTIPLE_CHOICE) {
      const rawOptions = Array.isArray(raw.options)
        ? raw.options
        : [1, 2, 3, 4, 5, 6]
            .map((index) => {
              const value = raw[`option_${index}`] ?? raw[`option${index}`];
              if (!this.text(value)) return null;
              return {
                optionText: value,
                isCorrect: raw[`option_${index}_is_correct`] ?? false,
                whyWrong: raw[`option_${index}_why_wrong`],
              };
            })
            .filter((value) => value !== null);
      const correctIndex = Number(
        raw.correctOptionIndex ?? raw.correctOption ?? -1,
      );
      options = rawOptions.flatMap((value, index) => {
        if (this.isRecord(value)) {
          const optionText = this.text(value.optionText ?? value.text);
          return optionText
            ? [
                {
                  optionText,
                  sortOrder: index,
                  isCorrect:
                    value.isCorrect === true ||
                    this.boolean(value.isCorrect) === true,
                  whyWrong: this.text(value.whyWrong) || undefined,
                },
              ]
            : [];
        }
        const optionText = this.text(value);
        return optionText
          ? [
              {
                optionText,
                sortOrder: index,
                isCorrect: index === correctIndex,
              },
            ]
          : [];
      });
      if (
        options.length < 2 ||
        options.filter((option) => option.isCorrect).length !== 1
      ) {
        return {
          error:
            'MULTIPLE_CHOICE requires at least two options and exactly one correct option',
        };
      }
    } else {
      correctBoolean = this.boolean(
        raw.correctBoolean ?? raw.correct_answer_text ?? raw.correct_answer,
      );
      if (correctBoolean === undefined)
        return { error: 'TRUE_FALSE requires correctBoolean' };
    }
    return {
      data: {
        subjectId,
        unitId: this.text(raw.unitId) || undefined,
        lessonId: this.text(raw.lessonId) || undefined,
        sourceId: this.text(raw.sourceId) || undefined,
        readingPassageId: this.text(raw.readingPassageId) || undefined,
        type,
        questionText,
        correctBoolean,
        difficulty: difficultyValue as QuestionDifficulty,
        options,
      },
    };
  }

  private fingerprint(
    row: Pick<NormalizedRow, 'questionText' | 'subjectId' | 'type'>,
  ) {
    const normalized = row.questionText
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    return createHash('sha256')
      .update(`${normalized}|${row.subjectId}|${row.type}`)
      .digest('hex');
  }

  private payloadRows(payload: Prisma.JsonValue): RawRow[] {
    if (!this.isRawRowArray(payload)) {
      throw this.invalid('Stored import payload is invalid');
    }
    return payload;
  }

  private isRecord(value: unknown): value is RawRow {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isRawRowArray(value: unknown): value is RawRow[] {
    return Array.isArray(value) && value.every((row) => this.isRecord(row));
  }

  private text(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private boolean(value: unknown): boolean | undefined {
    if (
      value === true ||
      value === 'true' ||
      value === 'True' ||
      value === '1' ||
      value === 1 ||
      value === 'صح' ||
      value === 'صواب'
    )
      return true;
    if (
      value === false ||
      value === 'false' ||
      value === 'False' ||
      value === '0' ||
      value === 0 ||
      value === 'خطأ'
    )
      return false;
    return undefined;
  }

  private async findJob(id: string) {
    const job = await this.prisma.questionImportJob.findUnique({
      where: { id },
    });
    if (!job)
      throw educationNotFound(
        'QUESTION_IMPORT_NOT_FOUND',
        'Question import job not found',
      );
    return job;
  }

  private toJob(job: Awaited<ReturnType<QuestionImportsService['findJob']>>) {
    return {
      id: job.id,
      uploadedById: job.uploadedById,
      fileName: job.fileName,
      fileUrl: job.fileUrl,
      fileType: job.fileType,
      status: job.status,
      sourceType: job.sourceType,
      checksum: job.checksum,
      mode: job.mode,
      approvalMode: job.approvalMode,
      approvedById: job.approvedById,
      approvedAt: job.approvedAt,
      totalRows: job.totalRows,
      processedRows: job.processedRows,
      validRows: job.validRows,
      invalidRows: job.invalidRows,
      importedRows: job.importedRows,
      updatedRows: job.updatedRows,
      skippedRows: job.skippedRows,
      duplicateRows: job.duplicateRows,
      failedRows: job.failedRows,
      reviewRows: job.reviewRows,
      cursor: job.cursor,
      errorFileUrl: job.errorFileUrl,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
    };
  }

  private invalid(message: string) {
    return new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'INVALID_QUESTION_IMPORT',
      message,
    });
  }
}
