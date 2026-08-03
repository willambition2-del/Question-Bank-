import type {
  ExamModel,
  ExamModelQuestion,
  Source,
  Subject,
} from '../../generated/prisma/client';
import {
  QuestionWithContent,
  toAdminQuestion,
  toStudentQuestion,
} from '../content.mapper';

export type ExamQuestionWithContent = ExamModelQuestion & {
  question: QuestionWithContent;
};
export type ExamModelWithContent = ExamModel & {
  subject: Subject;
  source: Source | null;
  questions: ExamQuestionWithContent[];
};

const toSubjectSummary = (subject: Subject) => ({
  id: subject.id,
  name: subject.name,
  slug: subject.slug,
});

const toSourceSummary = (source: Source | null) =>
  source
    ? {
        id: source.id,
        name: source.name,
        type: source.type,
        year: source.year,
        governorate: source.governorate,
        isOfficial: source.isOfficial,
      }
    : null;

const totalPoints = (items: ExamQuestionWithContent[]) =>
  items.reduce((sum, item) => sum + Number(item.points), 0);

export function toStudentExamModelListItem(
  exam: ExamModelWithContent,
  validQuestions: ExamQuestionWithContent[],
) {
  return {
    id: exam.id,
    title: exam.title,
    slug: exam.slug,
    year: exam.year,
    governorate: exam.governorate,
    description: exam.description,
    durationMinutes: exam.durationMinutes,
    difficulty: exam.difficulty,
    isOfficial: exam.isOfficial,
    questionsCount: validQuestions.length,
    totalPoints: totalPoints(validQuestions),
    subject: toSubjectSummary(exam.subject),
    source: toSourceSummary(exam.source),
    sortOrder: exam.sortOrder,
  };
}

export function toStudentExamModelDetail(
  exam: ExamModelWithContent,
  validQuestions: ExamQuestionWithContent[],
) {
  return {
    ...toStudentExamModelListItem(exam, validQuestions),
    questions: validQuestions.map((item) => ({
      sortOrder: item.sortOrder,
      points: Number(item.points),
      question: toStudentQuestion(item.question),
    })),
  };
}

export function toAdminExamModelQuestion(item: ExamQuestionWithContent) {
  return {
    sortOrder: item.sortOrder,
    points: Number(item.points),
    question: toAdminQuestion(item.question),
  };
}

export function toAdminExamModel(
  exam: ExamModelWithContent,
  warnings: string[] = [],
  includeQuestions = true,
) {
  const result = {
    id: exam.id,
    subjectId: exam.subjectId,
    sourceId: exam.sourceId,
    title: exam.title,
    slug: exam.slug,
    year: exam.year,
    governorate: exam.governorate,
    description: exam.description,
    durationMinutes: exam.durationMinutes,
    difficulty: exam.difficulty,
    isOfficial: exam.isOfficial,
    isPublished: exam.isPublished,
    sortOrder: exam.sortOrder,
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt,
    deletedAt: exam.deletedAt,
    questionsCount: exam.questions.length,
    totalPoints: totalPoints(exam.questions),
    subject: toSubjectSummary(exam.subject),
    source: toSourceSummary(exam.source),
    warnings,
  };
  return includeQuestions
    ? { ...result, questions: exam.questions.map(toAdminExamModelQuestion) }
    : result;
}
