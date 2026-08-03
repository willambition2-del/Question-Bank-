import { createHash } from 'node:crypto';
import { QuestionType } from '../../generated/prisma/enums';

export function normalizeQuestionText(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('ar')
    .replace(/[\u0640]/g, '')
    .replace(/[\u060C,؛;:!?؟.]+/g, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function createQuestionFingerprint(
  questionText: string,
  subjectId: string,
  type: QuestionType,
): string {
  return createHash('sha256')
    .update(normalizeQuestionText(questionText) + '|' + subjectId + '|' + type)
    .digest('hex');
}
