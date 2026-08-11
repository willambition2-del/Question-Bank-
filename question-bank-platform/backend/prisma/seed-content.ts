import { createHash } from 'node:crypto';
import type { PrismaClient } from '../src/generated/prisma/client';
import {
  QuestionDifficulty,
  QuestionOrigin,
  QuestionReviewStatus,
  QuestionType,
  SourceType,
} from '../src/generated/prisma/enums';

const fingerprint = (
  questionText: string,
  subjectId: string,
  type: QuestionType,
) =>
  createHash('sha256')
    .update(
      `${questionText.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()}|${subjectId}|${type}`,
    )
    .digest('hex');

export async function seedContent(prisma: PrismaClient): Promise<void> {
  let source = await prisma.source.findFirst({
    where: {
      name: 'نماذج وزارية تجريبية',
      type: SourceType.MINISTRY_MODEL,
      year: 2025,
      deletedAt: null,
    },
  });
  source ??= await prisma.source.create({
    data: {
      name: 'نماذج وزارية تجريبية',
      type: SourceType.MINISTRY_MODEL,
      year: 2025,
      description: 'مصدر تجريبي لبيانات التطوير فقط.',
      isOfficial: false,
    },
  });

  const subjects = await prisma.subject.findMany({
    where: {
      isActive: true,
      isPublished: true,
      deletedAt: null,
      curriculum: { slug: 'yemeni-curriculum' },
      grade: { slug: 'grade-12' },
    },
    include: {
      units: {
        where: { isActive: true, deletedAt: null },
        include: {
          lessons: { where: { isActive: true, deletedAt: null }, take: 1 },
        },
        take: 1,
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  for (const subject of subjects) {
    const unit = subject.units[0];
    const lesson = unit?.lessons[0];
    const definitions = [
      {
        type: QuestionType.MULTIPLE_CHOICE,
        text: `ما العبارة الصحيحة في مقدمة مادة ${subject.name}؟`,
        options: [
          { optionText: 'العبارة الصحيحة التجريبية', isCorrect: true },
          { optionText: 'عبارة غير صحيحة', isCorrect: false },
          { optionText: 'عبارة مشتتة', isCorrect: false },
        ],
      },
      {
        type: QuestionType.MULTIPLE_CHOICE,
        text: `اختر المفهوم الأساسي المرتبط بمادة ${subject.name}.`,
        options: [
          { optionText: 'المفهوم الأساسي', isCorrect: true },
          { optionText: 'مفهوم مختلف', isCorrect: false },
        ],
      },
      {
        type: QuestionType.TRUE_FALSE,
        text: `هذا سؤال صح أو خطأ تجريبي في مادة ${subject.name}.`,
        correctBoolean: true,
      },
    ] as const;

    for (const definition of definitions) {
      const hash = fingerprint(definition.text, subject.id, definition.type);
      const existing = await prisma.question.findFirst({
        where: { fingerprint: hash, deletedAt: null },
        select: { id: true },
      });
      if (existing) continue;
      const isMcq = definition.type === QuestionType.MULTIPLE_CHOICE;
      await prisma.question.create({
        data: {
          subjectId: subject.id,
          unitId: unit?.id,
          lessonId: lesson?.id,
          sourceId: source.id,
          type: definition.type,
          questionText: definition.text,
          correctBoolean:
            definition.type === QuestionType.TRUE_FALSE
              ? definition.correctBoolean
              : null,
          explanationShort: 'شرح تجريبي مختصر يظهر بعد تسجيل الإجابة.',
          difficulty: QuestionDifficulty.EASY,
          reviewStatus: QuestionReviewStatus.READY,
          origin: QuestionOrigin.MANUAL,
          fingerprint: hash,
          isPublished: true,
          options: isMcq
            ? {
                create: definition.options.map((option, index) => ({
                  optionText: option.optionText,
                  isCorrect: option.isCorrect,
                  sortOrder: index + 1,
                })),
              }
            : undefined,
        },
      });
    }

    const examQuestions = await prisma.question.findMany({
      where: {
        subjectId: subject.id,
        sourceId: source.id,
        reviewStatus: QuestionReviewStatus.READY,
        isActive: true,
        isPublished: true,
        deletedAt: null,
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 3,
    });
    const exam = await prisma.examModel.upsert({
      where: { slug: `sample-${subject.slug}-2025` },
      update: {
        subjectId: subject.id,
        sourceId: source.id,
        title: `????? ?????? - ${subject.name}`,
        durationMinutes: 30,
        difficulty: QuestionDifficulty.MIXED,
        isPublished: examQuestions.length > 0,
        deletedAt: null,
      },
      create: {
        subjectId: subject.id,
        sourceId: source.id,
        title: `????? ?????? - ${subject.name}`,
        slug: `sample-${subject.slug}-2025`,
        year: 2025,
        description: '????? ?????? ????? ??????.',
        durationMinutes: 30,
        difficulty: QuestionDifficulty.MIXED,
        isPublished: examQuestions.length > 0,
        sortOrder: 1,
      },
    });
    for (const [index, question] of examQuestions.entries()) {
      await prisma.examModelQuestion.upsert({
        where: {
          examModelId_questionId: {
            examModelId: exam.id,
            questionId: question.id,
          },
        },
        update: { points: 1 },
        create: {
          examModelId: exam.id,
          questionId: question.id,
          sortOrder: index + 1,
          points: 1,
        },
      });
    }
  }
  console.log('Content seed completed successfully.');
}
