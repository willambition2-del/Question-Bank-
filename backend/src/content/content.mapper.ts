import type {
  Question,
  QuestionOption,
  ReadingPassage,
  Source,
} from '../generated/prisma/client';

export type QuestionWithContent = Question & {
  options: QuestionOption[];
  readingPassage: ReadingPassage | null;
};

export function toSource(source: Source) {
  return {
    id: source.id,
    name: source.name,
    type: source.type,
    year: source.year,
    governorate: source.governorate,
    description: source.description,
    referenceUrl: source.referenceUrl,
    isOfficial: source.isOfficial,
    isActive: source.isActive,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    deletedAt: source.deletedAt,
  };
}

export function toAdminReadingPassage(passage: ReadingPassage) {
  return {
    id: passage.id,
    subjectId: passage.subjectId,
    sourceId: passage.sourceId,
    title: passage.title,
    passageText: passage.passageText,
    languageCode: passage.languageCode,
    difficulty: passage.difficulty,
    isActive: passage.isActive,
    isPublished: passage.isPublished,
    createdById: passage.createdById,
    reviewedById: passage.reviewedById,
    createdAt: passage.createdAt,
    updatedAt: passage.updatedAt,
    deletedAt: passage.deletedAt,
  };
}

const toPassageReference = (passage: ReadingPassage | null) =>
  passage
    ? {
        id: passage.id,
        title: passage.title,
        passageText: passage.passageText,
        languageCode: passage.languageCode,
      }
    : null;

export function toAdminQuestion(question: QuestionWithContent) {
  return {
    id: question.id,
    subjectId: question.subjectId,
    unitId: question.unitId,
    lessonId: question.lessonId,
    sourceId: question.sourceId,
    readingPassageId: question.readingPassageId,
    type: question.type,
    questionText: question.questionText,
    questionImageUrl: question.questionImageUrl,
    correctBoolean: question.correctBoolean,
    hintText: question.hintText,
    explanationShort: question.explanationShort,
    explanationDetailed: question.explanationDetailed,
    dangerKeyword: question.dangerKeyword,
    commonMistake: question.commonMistake,
    difficulty: question.difficulty,
    reviewStatus: question.reviewStatus,
    origin: question.origin,
    fingerprint: question.fingerprint,
    isTrapQuestion: question.isTrapQuestion,
    isActive: question.isActive,
    isPublished: question.isPublished,
    contentVersion: question.contentVersion,
    createdById: question.createdById,
    reviewedById: question.reviewedById,
    reviewedAt: question.reviewedAt,
    rejectionReason: question.rejectionReason,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    deletedAt: question.deletedAt,
    readingPassage: toPassageReference(question.readingPassage),
    options: question.options
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((option) => ({
        id: option.id,
        optionText: option.optionText,
        optionImageUrl: option.optionImageUrl,
        sortOrder: option.sortOrder,
        isCorrect: option.isCorrect,
        whyWrong: option.whyWrong,
      })),
  };
}

export function toStudentQuestion(question: QuestionWithContent) {
  return {
    id: question.id,
    subjectId: question.subjectId,
    unitId: question.unitId,
    lessonId: question.lessonId,
    sourceId: question.sourceId,
    readingPassageId: question.readingPassageId,
    type: question.type,
    questionText: question.questionText,
    questionImageUrl: question.questionImageUrl,
    difficulty: question.difficulty,
    isTrapQuestion: question.isTrapQuestion,
    contentVersion: question.contentVersion,
    readingPassage: toPassageReference(question.readingPassage),
    options: question.options
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((option) => ({
        id: option.id,
        optionText: option.optionText,
        optionImageUrl: option.optionImageUrl,
        sortOrder: option.sortOrder,
      })),
  };
}

export function toAnsweredQuestion(question: QuestionWithContent) {
  return {
    ...toStudentQuestion(question),
    correctBoolean: question.correctBoolean,
    hintText: question.hintText,
    explanationShort: question.explanationShort,
    explanationDetailed: question.explanationDetailed,
    dangerKeyword: question.dangerKeyword,
    commonMistake: question.commonMistake,
    options: question.options
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((option) => ({
        id: option.id,
        optionText: option.optionText,
        optionImageUrl: option.optionImageUrl,
        sortOrder: option.sortOrder,
        isCorrect: option.isCorrect,
        whyWrong: option.whyWrong,
      })),
  };
}
