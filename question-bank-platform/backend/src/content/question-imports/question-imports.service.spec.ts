import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  ImportFileType,
  ImportStatus,
  QuestionDifficulty,
  QuestionType,
} from '../../generated/prisma/enums';
import { FileTypeDetector } from '../../common/files/file-type-detector';
import { PrismaService } from '../../prisma/prisma.service';
import { QuestionImportsService } from './question-imports.service';
import * as unzipper from 'unzipper';

jest.mock('unzipper', () => ({ Open: { buffer: jest.fn() } }));
jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const now = new Date('2026-07-17T00:00:00.000Z');
const actorId = '70000000-0000-4000-8000-000000000001';
const subjectId = '70000000-0000-4000-8000-000000000002';

const job = {
  id: '70000000-0000-4000-8000-000000000003',
  uploadedById: actorId,
  fileName: 'questions.json',
  fileUrl: null,
  fileType: ImportFileType.JSON,
  status: ImportStatus.PENDING,
  totalRows: 1,
  validRows: 0,
  invalidRows: 0,
  importedRows: 0,
  duplicateRows: 0,
  errorFileUrl: null,
  payload: [
    {
      subjectId,
      type: QuestionType.TRUE_FALSE,
      questionText: 'Water boils at 100 C.',
      correctBoolean: true,
      difficulty: QuestionDifficulty.EASY,
    },
  ],
  validationErrors: null,
  startedAt: null,
  completedAt: null,
  createdAt: now,
};

describe('QuestionImportsService', () => {
  const prisma = {
    questionImportJob: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    subject: { findMany: jest.fn() },
    unit: { findMany: jest.fn() },
    lesson: { findMany: jest.fn() },
    source: { findMany: jest.fn() },
    readingPassage: { findMany: jest.fn() },
    question: { findMany: jest.fn(), createMany: jest.fn() },
    questionOption: { createMany: jest.fn() },
    $transaction: jest.fn(),
  };
  let service: QuestionImportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QuestionImportsService(
      prisma as unknown as PrismaService,
      new FileTypeDetector(),
    );
  });

  prisma.unit.findMany.mockResolvedValue([]);
  prisma.lesson.findMany.mockResolvedValue([]);
  prisma.source.findMany.mockResolvedValue([]);
  prisma.readingPassage.findMany.mockResolvedValue([]);
  it('accepts a JSON array and stores a pending import without exposing payload', async () => {
    prisma.questionImportJob.create.mockResolvedValue(job);
    const result = await service.upload(actorId, {
      originalname: 'questions.json',
      mimetype: 'application/json',
      size: 100,
      buffer: Buffer.from(JSON.stringify(job.payload)),
    });

    expect(result.status).toBe(ImportStatus.PENDING);
    expect(result).not.toHaveProperty('payload');
    expect(prisma.questionImportJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileType: ImportFileType.JSON,
          totalRows: 1,
        }) as object,
      }),
    );
  });

  it('rejects malformed JSON before creating a job', async () => {
    await expect(
      service.upload(actorId, {
        originalname: 'questions.json',
        mimetype: 'application/json',
        size: 10,
        buffer: Buffer.from('{bad json'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.questionImportJob.create).not.toHaveBeenCalled();
  });

  it('validates rows and marks a usable job ready to import', async () => {
    prisma.questionImportJob.findUnique.mockResolvedValue(job);
    prisma.subject.findMany.mockResolvedValue([{ id: subjectId }]);
    prisma.question.findMany.mockResolvedValue([]);
    prisma.questionImportJob.update
      .mockResolvedValueOnce({
        ...job,
        status: ImportStatus.VALIDATING,
        startedAt: now,
      })
      .mockResolvedValueOnce({
        ...job,
        status: ImportStatus.READY_TO_IMPORT,
        validRows: 1,
        invalidRows: 0,
        validationErrors: [],
      });

    const result = await service.validate(job.id);

    expect(result.status).toBe(ImportStatus.READY_TO_IMPORT);
    expect(result.validRows).toBe(1);
    expect(prisma.questionImportJob.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ImportStatus.READY_TO_IMPORT,
          invalidRows: 0,
        }) as object,
      }),
    );
  });

  it('reports duplicate fingerprints without importing them as valid work', async () => {
    prisma.questionImportJob.findUnique.mockResolvedValue(job);
    prisma.subject.findMany.mockResolvedValue([{ id: subjectId }]);
    const fingerprint = createHash('sha256')
      .update(`water boils at 100 c.|${subjectId}|${QuestionType.TRUE_FALSE}`)
      .digest('hex');
    prisma.question.findMany.mockResolvedValue([{ fingerprint }]);
    prisma.questionImportJob.update
      .mockResolvedValueOnce({ ...job, status: ImportStatus.VALIDATING })
      .mockResolvedValueOnce({
        ...job,
        status: ImportStatus.FAILED,
        validRows: 1,
        duplicateRows: 1,
        validationErrors: [{ row: 2, duplicate: true }],
      });
    const result = await service.validate(job.id);
    expect(result.validRows).toBe(1);
    expect(result.duplicateRows).toBe(1);
  });
  it('rejects ZIP path traversal before extraction or persistence', async () => {
    (unzipper.Open.buffer as jest.Mock).mockResolvedValue({
      files: [
        { path: '../outside.png', type: 'File', uncompressedSize: 10 },
        { path: 'questions.xlsx', type: 'File', uncompressedSize: 10 },
      ],
    });
    await expect(
      service.upload(actorId, {
        originalname: 'questions.zip',
        mimetype: 'application/zip',
        size: 20,
        buffer: Buffer.from('PK malicious archive'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.questionImportJob.create).not.toHaveBeenCalled();
  });
});
