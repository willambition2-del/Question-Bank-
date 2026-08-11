import { BadRequestException } from '@nestjs/common';
import {
  QuestionReviewStatus,
  QuestionType,
} from '../../generated/prisma/enums';
import {
  createQuestionFingerprint,
  normalizeQuestionText,
} from './question-normalization';
import {
  assertQuestionTransition,
  QUESTION_REVIEW_TRANSITIONS,
} from './question-review-policy';

describe('Question hardening policies', () => {
  it('normalizes whitespace, Arabic punctuation, tatweel, and Unicode', () => {
    expect(normalizeQuestionText('  مــا  وحدة\nقياس القوة؟؟ ')).toBe(
      'ما وحدة قياس القوة',
    );
  });

  it('creates the same fingerprint for equivalent question text', () => {
    const first = createQuestionFingerprint(
      'ما وحدة قياس القوة؟',
      'subject-1',
      QuestionType.MULTIPLE_CHOICE,
    );
    const second = createQuestionFingerprint(
      '  ما   وحدة قياس القوة!! ',
      'subject-1',
      QuestionType.MULTIPLE_CHOICE,
    );
    expect(second).toBe(first);
  });

  it('scopes fingerprints by subject and question type', () => {
    const base = createQuestionFingerprint(
      'القوة كمية متجهة',
      'subject-1',
      QuestionType.TRUE_FALSE,
    );
    expect(
      createQuestionFingerprint(
        'القوة كمية متجهة',
        'subject-2',
        QuestionType.TRUE_FALSE,
      ),
    ).not.toBe(base);
    expect(
      createQuestionFingerprint(
        'القوة كمية متجهة',
        'subject-1',
        QuestionType.MULTIPLE_CHOICE,
      ),
    ).not.toBe(base);
  });

  it.each([
    [QuestionReviewStatus.DRAFT, QuestionReviewStatus.REVIEW_REQUIRED],
    [QuestionReviewStatus.REVIEW_REQUIRED, QuestionReviewStatus.READY],
    [QuestionReviewStatus.REVIEW_REQUIRED, QuestionReviewStatus.REJECTED],
    [QuestionReviewStatus.REJECTED, QuestionReviewStatus.DRAFT],
    [QuestionReviewStatus.REJECTED, QuestionReviewStatus.REVIEW_REQUIRED],
    [QuestionReviewStatus.READY, QuestionReviewStatus.ARCHIVED],
    [QuestionReviewStatus.ARCHIVED, QuestionReviewStatus.DRAFT],
    [QuestionReviewStatus.ARCHIVED, QuestionReviewStatus.REVIEW_REQUIRED],
  ])('allows the documented transition %s -> %s', (current, next) => {
    expect(() => assertQuestionTransition(current, next)).not.toThrow();
  });

  it.each([
    [QuestionReviewStatus.DRAFT, QuestionReviewStatus.READY],
    [QuestionReviewStatus.READY, QuestionReviewStatus.DRAFT],
    [QuestionReviewStatus.REJECTED, QuestionReviewStatus.READY],
    [QuestionReviewStatus.ARCHIVED, QuestionReviewStatus.READY],
  ])('rejects the undocumented transition %s -> %s', (current, next) => {
    expect(() => assertQuestionTransition(current, next)).toThrow(
      BadRequestException,
    );
  });

  it('defines transitions for every review state', () => {
    expect(Object.keys(QUESTION_REVIEW_TRANSITIONS).sort()).toEqual(
      Object.values(QuestionReviewStatus).sort(),
    );
  });

  it('keeps Arabic fixtures valid UTF-8 without replacement characters', () => {
    const fixtures = [
      'اختبار وزارة التربية',
      'تصف قوانين نيوتن العلاقة بين القوة والحركة.',
      'ما وحدة قياس القوة؟',
    ];
    expect(fixtures.join('')).not.toMatch(/\uFFFD|ط£|ظ…/u);
  });
});
