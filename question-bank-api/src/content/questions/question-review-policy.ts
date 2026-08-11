import { QuestionReviewStatus } from '../../generated/prisma/enums';
import { contentBadRequest } from '../content-errors';

const TRANSITIONS: Readonly<
  Record<QuestionReviewStatus, readonly QuestionReviewStatus[]>
> = {
  DRAFT: [QuestionReviewStatus.REVIEW_REQUIRED],
  REVIEW_REQUIRED: [QuestionReviewStatus.READY, QuestionReviewStatus.REJECTED],
  READY: [QuestionReviewStatus.ARCHIVED],
  REJECTED: [QuestionReviewStatus.DRAFT, QuestionReviewStatus.REVIEW_REQUIRED],
  ARCHIVED: [QuestionReviewStatus.DRAFT, QuestionReviewStatus.REVIEW_REQUIRED],
};

export const QUESTION_REVIEW_TRANSITIONS = TRANSITIONS;

export function assertQuestionTransition(
  current: QuestionReviewStatus,
  next: QuestionReviewStatus,
): void {
  if (!TRANSITIONS[current].includes(next)) {
    throw contentBadRequest(
      'QUESTION_REVIEW_TRANSITION_INVALID',
      'Question cannot transition from ' + current + ' to ' + next,
    );
  }
}
