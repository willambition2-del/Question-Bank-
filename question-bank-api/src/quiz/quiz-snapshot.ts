import type { Prisma } from '../generated/prisma/client';
import { QuestionDifficulty, QuestionType } from '../generated/prisma/enums';
import type { QuestionWithContent } from '../content/content.mapper';
import { quizBadRequest } from './quiz-errors';

export type QuizQuestionSnapshot = {
  version: 1;
  id: string;
  subjectId: string;
  unitId: string | null;
  lessonId: string | null;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  questionText: string;
  questionImageUrl: string | null;
  isTrapQuestion: boolean;
  contentVersion: number;
  readingPassage: {
    id: string;
    title: string | null;
    passageText: string;
    languageCode: string;
  } | null;
  options: Array<{
    id: string;
    optionText: string;
    optionImageUrl: string | null;
    sortOrder: number;
    isCorrect: boolean;
    whyWrong: string | null;
  }>;
  correctBoolean: boolean | null;
  hintText: string | null;
  explanationShort: string | null;
  explanationDetailed: string | null;
};

export function createQuizSnapshot(
  question: QuestionWithContent,
): QuizQuestionSnapshot {
  return {
    version: 1,
    id: question.id,
    subjectId: question.subjectId,
    unitId: question.unitId,
    lessonId: question.lessonId,
    type: question.type,
    difficulty: question.difficulty,
    questionText: question.questionText,
    questionImageUrl: question.questionImageUrl,
    isTrapQuestion: question.isTrapQuestion,
    contentVersion: question.contentVersion,
    readingPassage: question.readingPassage
      ? {
          id: question.readingPassage.id,
          title: question.readingPassage.title,
          passageText: question.readingPassage.passageText,
          languageCode: question.readingPassage.languageCode,
        }
      : null,
    options: [...question.options]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((option) => ({
        id: option.id,
        optionText: option.optionText,
        optionImageUrl: option.optionImageUrl,
        sortOrder: option.sortOrder,
        isCorrect: option.isCorrect,
        whyWrong: option.whyWrong,
      })),
    correctBoolean: question.correctBoolean,
    hintText: question.hintText,
    explanationShort: question.explanationShort,
    explanationDetailed: question.explanationDetailed,
  };
}

export function parseQuizSnapshot(
  value: Prisma.JsonValue | null,
): QuizQuestionSnapshot {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value.version !== 1 ||
    typeof value.id !== 'string' ||
    typeof value.questionText !== 'string' ||
    !Array.isArray(value.options)
  ) {
    throw quizBadRequest(
      'QUIZ_COMPLETION_FAILED',
      'Quiz question snapshot is invalid',
    );
  }
  return value as unknown as QuizQuestionSnapshot;
}

export function toStudentSnapshot(snapshot: QuizQuestionSnapshot) {
  return {
    id: snapshot.id,
    subjectId: snapshot.subjectId,
    unitId: snapshot.unitId,
    lessonId: snapshot.lessonId,
    type: snapshot.type,
    difficulty: snapshot.difficulty,
    questionText: snapshot.questionText,
    questionImageUrl: snapshot.questionImageUrl,
    isTrapQuestion: snapshot.isTrapQuestion,
    contentVersion: snapshot.contentVersion,
    readingPassage: snapshot.readingPassage,
    hintText: snapshot.hintText,
    options: snapshot.options.map(
      ({ id, optionText, optionImageUrl, sortOrder }) => ({
        id,
        optionText,
        optionImageUrl,
        sortOrder,
      }),
    ),
  };
}

export function toAnsweredSnapshot(snapshot: QuizQuestionSnapshot) {
  return {
    ...toStudentSnapshot(snapshot),
    correctBoolean: snapshot.correctBoolean,
    hintText: snapshot.hintText,
    explanationShort: snapshot.explanationShort,
    explanationDetailed: snapshot.explanationDetailed,
    options: snapshot.options.map(
      ({ id, optionText, optionImageUrl, sortOrder, isCorrect, whyWrong }) => ({
        id,
        optionText,
        optionImageUrl,
        sortOrder,
        isCorrect,
        whyWrong,
      }),
    ),
  };
}
