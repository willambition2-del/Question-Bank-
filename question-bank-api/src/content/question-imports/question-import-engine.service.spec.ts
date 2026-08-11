import { QuestionType } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { QuestionImportEngineService } from './question-import-engine.service';

jest.mock('../../generated/prisma/client', () => ({
  Prisma: { DbNull: null },
}));

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('QuestionImportEngineService normalization', () => {
  const service = new QuestionImportEngineService({} as PrismaService);
  const call = (name: string, ...args: unknown[]) =>
    (service as unknown as Record<string, (...values: unknown[]) => unknown>)[
      name
    ](...args);

  it('normalizes Arabic search variants without changing the preserved source', () => {
    const source = '  إختبار   الآيات  ';
    expect(call('preserveText', source)).toBe('إختبار الآيات');
    expect(call('searchKey', source)).toBe('اختبار الايات');
  });

  it.each([
    ['صح', true],
    ['صواب', true],
    ['True', true],
    ['خطأ', false],
    ['False', false],
    ['غير واضحة', null],
  ])('maps strict true/false source answer %s', (value, expected) => {
    expect(call('trueFalse', value)).toBe(expected);
  });

  it('supports only the two destination question types', () => {
    expect(call('questionType', 'اختيار من متعدد')).toBe(
      QuestionType.MULTIPLE_CHOICE,
    );
    expect(call('questionType', 'صح وخطأ')).toBe(QuestionType.TRUE_FALSE);
    expect(call('questionType', 'مقالي')).toBeNull();
  });

  it('creates stable subject and type scoped fingerprints', () => {
    const first = call(
      'fingerprint',
      '  سؤال   تجريبي ',
      'subject-1',
      QuestionType.TRUE_FALSE,
    );
    const same = call(
      'fingerprint',
      'سؤال تجريبي',
      'subject-1',
      QuestionType.TRUE_FALSE,
    );
    const other = call(
      'fingerprint',
      'سؤال تجريبي',
      'subject-2',
      QuestionType.TRUE_FALSE,
    );
    expect(first).toBe(same);
    expect(first).not.toBe(other);
  });
});
