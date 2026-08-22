import type {
  Curriculum,
  Grade,
  Lesson,
  Subject,
  Unit,
} from '../generated/prisma/client';

export interface StudentProgressSummary {
  answeredQuestions: number;
  correctAnswers: number;
  accuracyPercent: number;
  masteryPercent: number;
  lastActivityAt: Date | null;
}

const emptyProgress = (): StudentProgressSummary => ({
  answeredQuestions: 0,
  correctAnswers: 0,
  accuracyPercent: 0,
  masteryPercent: 0,
  lastActivityAt: null,
});

type ProgressRecord = {
  answeredQuestions: number;
  correctAnswers: number;
  accuracyPercent: unknown;
  masteryPercent: unknown;
  lastActivityAt: Date | null;
};

const toProgress = (progress?: ProgressRecord): StudentProgressSummary =>
  progress
    ? {
        answeredQuestions: progress.answeredQuestions,
        correctAnswers: progress.correctAnswers,
        accuracyPercent: Number(progress.accuracyPercent),
        masteryPercent: Number(progress.masteryPercent),
        lastActivityAt: progress.lastActivityAt,
      }
    : emptyProgress();
export function toGrade(grade: Grade) {
  return {
    id: grade.id,
    name: grade.name,
    slug: grade.slug,
    description: grade.description,
    sortOrder: grade.sortOrder,
    isActive: grade.isActive,
    createdAt: grade.createdAt,
    updatedAt: grade.updatedAt,
    deletedAt: grade.deletedAt,
  };
}

export function toCurriculum(curriculum: Curriculum) {
  return {
    id: curriculum.id,
    name: curriculum.name,
    slug: curriculum.slug,
    countryCode: curriculum.countryCode,
    academicYear: curriculum.academicYear,
    description: curriculum.description,
    isActive: curriculum.isActive,
    createdAt: curriculum.createdAt,
    updatedAt: curriculum.updatedAt,
    deletedAt: curriculum.deletedAt,
  };
}

export function toAdminSubject(subject: Subject) {
  return {
    id: subject.id,
    curriculumId: subject.curriculumId,
    gradeId: subject.gradeId,
    name: subject.name,
    slug: subject.slug,
    description: subject.description,
    iconKey: subject.iconKey,
    colorHex: subject.colorHex,
    coverImageUrl: subject.coverImageUrl ?? null,
    sortOrder: subject.sortOrder,
    isActive: subject.isActive,
    isPublished: subject.isPublished,
    createdAt: subject.createdAt,
    updatedAt: subject.updatedAt,
    deletedAt: subject.deletedAt,
  };
}

export function toStudentSubject(
  subject: Subject & {
    _count: { units: number; lessons: number; questions: number };
    studentProgress: ProgressRecord[];
    favoritedBy: Array<{ id: string }>;
  },
) {
  return {
    id: subject.id,
    name: subject.name,
    slug: subject.slug,
    description: subject.description,
    iconKey: subject.iconKey,
    colorHex: subject.colorHex,
    coverImageUrl: subject.coverImageUrl ?? null,
    sortOrder: subject.sortOrder,
    unitsCount: subject._count.units,
    lessonsCount: subject._count.lessons,
    questionsCount: subject._count.questions,
    isFavorite: subject.favoritedBy.length > 0,
    progress: toProgress(subject.studentProgress[0]),
  };
}

export function toAdminUnit(unit: Unit) {
  return {
    id: unit.id,
    subjectId: unit.subjectId,
    name: unit.name,
    slug: unit.slug,
    description: unit.description,
    sortOrder: unit.sortOrder,
    isActive: unit.isActive,
    isPublished: unit.isPublished,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
    deletedAt: unit.deletedAt,
  };
}

export function toStudentUnit(
  unit: Unit & {
    _count: { lessons: number; questions: number };
    studentProgress: ProgressRecord[];
  },
) {
  return {
    id: unit.id,
    subjectId: unit.subjectId,
    name: unit.name,
    slug: unit.slug,
    description: unit.description,
    sortOrder: unit.sortOrder,
    lessonsCount: unit._count.lessons,
    questionsCount: unit._count.questions,
    progress: toProgress(unit.studentProgress[0]),
  };
}

export function toAdminLesson(lesson: Lesson) {
  return {
    id: lesson.id,
    subjectId: lesson.subjectId,
    unitId: lesson.unitId,
    name: lesson.name,
    slug: lesson.slug,
    description: lesson.description,
    summary: lesson.summary,
    sortOrder: lesson.sortOrder,
    isActive: lesson.isActive,
    isPublished: lesson.isPublished,
    createdAt: lesson.createdAt,
    updatedAt: lesson.updatedAt,
    deletedAt: lesson.deletedAt,
  };
}

export function toStudentLesson(
  lesson: Lesson & {
    _count: { questions: number };
    studentProgress: ProgressRecord[];
  },
) {
  return {
    id: lesson.id,
    subjectId: lesson.subjectId,
    unitId: lesson.unitId,
    name: lesson.name,
    slug: lesson.slug,
    description: lesson.description,
    summary: lesson.summary,
    sortOrder: lesson.sortOrder,
    questionsCount: lesson._count.questions,
    progress: toProgress(lesson.studentProgress[0]),
  };
}
