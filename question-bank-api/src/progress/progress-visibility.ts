import type { Prisma } from '../generated/prisma/client';
import { GradeLevel, QuestionReviewStatus } from '../generated/prisma/enums';

export type VisibleQuestionFilters = {
  subjectId?: string;
  unitId?: string;
  lessonId?: string;
  gradeLevel?: GradeLevel;
  difficulty?: Prisma.EnumQuestionDifficultyFilter['equals'];
  search?: string;
};

export function visibleQuestionWhere(
  filters: VisibleQuestionFilters = {},
): Prisma.QuestionWhereInput {
  return {
    ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
    ...(filters.unitId ? { unitId: filters.unitId } : {}),
    ...(filters.lessonId ? { lessonId: filters.lessonId } : {}),
    ...(filters.difficulty ? { difficulty: filters.difficulty } : {}),
    ...(filters.search
      ? {
          questionText: {
            contains: filters.search,
            mode: 'insensitive' as const,
          },
        }
      : {}),
    reviewStatus: QuestionReviewStatus.READY,
    isActive: true,
    isPublished: true,
    deletedAt: null,
    subject: {
      is: {
        isActive: true,
        isPublished: true,
        deletedAt: null,
        curriculum: { is: { isActive: true, deletedAt: null } },
        grade: {
          is: {
            isActive: true,
            deletedAt: null,
            ...(filters.gradeLevel ? { code: filters.gradeLevel } : {}),
          },
        },
      },
    },
    AND: [
      {
        OR: [
          { unitId: null },
          {
            unit: {
              is: { isActive: true, isPublished: true, deletedAt: null },
            },
          },
        ],
      },
      {
        OR: [
          { lessonId: null },
          {
            lesson: {
              is: { isActive: true, isPublished: true, deletedAt: null },
            },
          },
        ],
      },
      {
        OR: [
          { sourceId: null },
          { source: { is: { isActive: true, deletedAt: null } } },
        ],
      },
      {
        OR: [
          { readingPassageId: null },
          {
            readingPassage: {
              is: {
                isActive: true,
                isPublished: true,
                deletedAt: null,
                OR: [
                  { sourceId: null },
                  { source: { is: { isActive: true, deletedAt: null } } },
                ],
              },
            },
          },
        ],
      },
    ],
  };
}
