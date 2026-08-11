import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Lesson, Subject, Unit } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LessonsService } from './lessons/lessons.service';
import { SubjectsService } from './subjects/subjects.service';
import { UnitsService } from './units/units.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const now = new Date('2026-07-17T00:00:00.000Z');
const userId = '90000000-0000-4000-8000-000000000001';
const subject: Subject = {
  id: '10000000-0000-4000-8000-000000000001',
  curriculumId: '10000000-0000-4000-8000-000000000002',
  gradeId: '10000000-0000-4000-8000-000000000003',
  name: 'Physics',
  slug: 'physics',
  description: null,
  iconKey: 'physics',
  colorHex: '#315BE8',
  sortOrder: 1,
  isActive: true,
  isPublished: true,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};
const unit: Unit = {
  id: '20000000-0000-4000-8000-000000000001',
  subjectId: subject.id,
  name: 'Mechanics',
  slug: 'mechanics',
  description: null,
  sortOrder: 1,
  isActive: true,
  isPublished: true,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};
const lesson: Lesson = {
  id: '30000000-0000-4000-8000-000000000001',
  subjectId: subject.id,
  unitId: unit.id,
  name: 'Motion',
  slug: 'motion',
  description: null,
  summary: null,
  sortOrder: 1,
  isActive: true,
  isPublished: true,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

describe('Education services', () => {
  const prisma = {
    subject: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    curriculum: { findFirst: jest.fn() },
    grade: { findFirst: jest.fn() },
    curriculumGrade: { upsert: jest.fn() },
    userSubjectFavorite: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    unit: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    lesson: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  let subjects: SubjectsService;
  let units: UnitsService;
  let lessons: LessonsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );
    subjects = new SubjectsService(prisma as unknown as PrismaService);
    units = new UnitsService(prisma as unknown as PrismaService);
    lessons = new LessonsService(prisma as unknown as PrismaService);
  });

  it('creates a subject and activates its curriculum-grade link', async () => {
    prisma.curriculum.findFirst.mockResolvedValue({ id: subject.curriculumId });
    prisma.grade.findFirst.mockResolvedValue({ id: subject.gradeId });
    prisma.curriculumGrade.upsert.mockResolvedValue({ id: 'link-1' });
    prisma.subject.create.mockResolvedValue(subject);

    const result = await subjects.create({
      curriculumId: subject.curriculumId,
      gradeId: subject.gradeId,
      name: subject.name,
      slug: subject.slug,
    });

    expect(result.slug).toBe('physics');
    expect(prisma.curriculumGrade.upsert).toHaveBeenCalled();
  });

  it('converts a duplicate subject slug into a conflict', async () => {
    prisma.curriculum.findFirst.mockResolvedValue({ id: subject.curriculumId });
    prisma.grade.findFirst.mockResolvedValue({ id: subject.gradeId });
    prisma.curriculumGrade.upsert.mockResolvedValue({ id: 'link-1' });
    prisma.subject.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      subjects.create({
        curriculumId: subject.curriculumId,
        gradeId: subject.gradeId,
        name: subject.name,
        slug: subject.slug,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns persisted counts, favorite state, and student progress', async () => {
    prisma.subject.findMany.mockResolvedValue([
      {
        ...subject,
        _count: { units: 2, lessons: 4, questions: 12 },
        studentProgress: [
          {
            answeredQuestions: 9,
            correctAnswers: 7,
            accuracyPercent: 77.78,
            masteryPercent: 65,
            lastActivityAt: now,
          },
        ],
        favoritedBy: [{ id: 'favorite-1' }],
      },
    ]);

    const result = await subjects.listPublished(userId, {
      page: 1,
      limit: 20,
      sort: 'sortOrder',
    });

    expect(result.items[0]).toMatchObject({
      questionsCount: 12,
      isFavorite: true,
      progress: {
        answeredQuestions: 9,
        correctAnswers: 7,
        masteryPercent: 65,
      },
    });
    expect(prisma.subject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          isPublished: true,
          deletedAt: null,
          curriculum: { isActive: true, deletedAt: null },
          grade: { isActive: true, deletedAt: null },
        }) as object,
      }),
    );
  });

  it('uses PostgreSQL-backed favorites idempotently', async () => {
    prisma.subject.findFirst.mockResolvedValue({
      ...subject,
      _count: { units: 0, lessons: 0, questions: 0 },
      studentProgress: [],
      favoritedBy: [],
    });
    prisma.userSubjectFavorite.upsert.mockResolvedValue({ id: 'favorite-1' });

    await expect(subjects.favorite(userId, subject.id)).resolves.toEqual({
      subjectId: subject.id,
      isFavorite: true,
    });
    expect(prisma.userSubjectFavorite.upsert).toHaveBeenCalledWith({
      where: { userId_subjectId: { userId, subjectId: subject.id } },
      update: {},
      create: { userId, subjectId: subject.id },
    });
  });

  it('applies the favorite filter to the authenticated user', async () => {
    prisma.subject.findMany.mockResolvedValue([]);
    await subjects.listPublished(userId, {
      page: 1,
      limit: 20,
      sort: 'sortOrder',
      favorite: true,
    });
    expect(prisma.subject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          favoritedBy: { some: { userId } },
        }) as object,
      }),
    );
  });

  it('rejects publishing when the parent curriculum is inactive', async () => {
    prisma.subject.findUnique.mockResolvedValue(subject);
    prisma.curriculum.findFirst.mockResolvedValue(null);
    prisma.grade.findFirst.mockResolvedValue({ id: subject.gradeId });

    await expect(subjects.publish(subject.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.subject.update).not.toHaveBeenCalled();
  });

  it('soft-deletes and unpublishes a subject', async () => {
    prisma.subject.findUnique.mockResolvedValue(subject);
    prisma.subject.update.mockResolvedValue({
      ...subject,
      isActive: false,
      isPublished: false,
      deletedAt: now,
    });

    const result = await subjects.remove(subject.id);
    expect(result.deletedAt).toEqual(now);
    expect(prisma.subject.update).toHaveBeenCalledWith({
      where: { id: subject.id },
      data: {
        deletedAt: expect.any(Date) as Date,
        isActive: false,
        isPublished: false,
      },
    });
  });

  it('reorders units from one subject in a transaction', async () => {
    prisma.unit.findMany.mockResolvedValue([
      { id: unit.id, subjectId: unit.subjectId },
    ]);
    prisma.unit.update.mockResolvedValue(unit);

    await expect(
      units.reorder({ items: [{ id: unit.id, sortOrder: 4 }] }),
    ).resolves.toEqual({ reordered: 1 });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects reordering units across different subjects', async () => {
    prisma.unit.findMany.mockResolvedValue([
      { id: unit.id, subjectId: unit.subjectId },
      {
        id: '20000000-0000-4000-8000-000000000002',
        subjectId: '10000000-0000-4000-8000-000000000099',
      },
    ]);

    await expect(
      units.reorder({
        items: [
          { id: unit.id, sortOrder: 1 },
          {
            id: '20000000-0000-4000-8000-000000000002',
            sortOrder: 2,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a lesson whose unit does not belong to its subject', async () => {
    prisma.unit.findFirst.mockResolvedValue(null);

    await expect(
      lessons.create({
        subjectId: subject.id,
        unitId: unit.id,
        name: lesson.name,
        slug: lesson.slug,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.lesson.create).not.toHaveBeenCalled();
  });
  it('rejects creating published inactive education nodes', async () => {
    await expect(
      subjects.create({
        curriculumId: subject.curriculumId,
        gradeId: subject.gradeId,
        name: subject.name,
        slug: subject.slug,
        isActive: false,
        isPublished: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      units.create({
        subjectId: subject.id,
        name: unit.name,
        slug: unit.slug,
        isActive: false,
        isPublished: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      lessons.create({
        subjectId: subject.id,
        unitId: unit.id,
        name: lesson.name,
        slug: lesson.slug,
        isActive: false,
        isPublished: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
