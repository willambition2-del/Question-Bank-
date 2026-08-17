import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { QuestionType } from '../generated/prisma/enums';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const [
      users,
      subjects,
      units,
      lessons,
      questions,
      options,
      sources,
      passages,
      studyResources,
      attempts,
      studentQuestionProgress,
      challenges,
      models,
      providers,
      policies,
      aiSettings,
      aiUsages,
      systemSettings
    ] = await Promise.all([
      prisma.user.count(),
      prisma.subject.count(),
      prisma.unit.count(),
      prisma.lesson.count(),
      prisma.question.count(),
      prisma.questionOption.count(),
      prisma.source.count(),
      prisma.readingPassage.count(),
      prisma.studyResource.count(),
      prisma.quizAttempt.count(),
      prisma.studentQuestionProgress.count(),
      prisma.challenge.count(),
      prisma.serviceModel.count(),
      prisma.serviceProvider.count(),
      prisma.featureUsagePolicy.count(),
      prisma.aiAssistantSetting.count(),
      prisma.aiUserUsage.count(),
      prisma.systemSetting.count()
    ]);

    const [
      mcqCount,
      trueFalseCount,
      withHint,
      withExplShort,
      withExplDetail,
      withWhyWrong,
      publishedQuestions,
      activeQuestions
    ] = await Promise.all([
      prisma.question.count({ where: { type: QuestionType.MULTIPLE_CHOICE } }),
      prisma.question.count({ where: { type: QuestionType.TRUE_FALSE } }),
      prisma.question.count({ where: { hintText: { not: null } } }),
      prisma.question.count({ where: { explanationShort: { not: null } } }),
      prisma.question.count({ where: { explanationDetailed: { not: null } } }),
      prisma.questionOption.count({ where: { whyWrong: { not: null } } }),
      prisma.question.count({ where: { isPublished: true } }),
      prisma.question.count({ where: { isActive: true } })
    ]);

    const [
      orphanQuestionsNoLesson,
      questionsNoCorrectOption,
      publishedLessons,
      activeLessons,
      publishedUnits,
      activeUnits,
      activeMistakesCount
    ] = await Promise.all([
      prisma.question.count({ where: { lessonId: null } }),
      prisma.question.count({
        where: {
          type: QuestionType.MULTIPLE_CHOICE,
          options: {
            none: { isCorrect: true }
          }
        }
      }),
      prisma.lesson.count({ where: { isPublished: true, isActive: true, deletedAt: null } }),
      prisma.lesson.count({ where: { isActive: true, deletedAt: null } }),
      prisma.unit.count({ where: { isPublished: true, isActive: true, deletedAt: null } }),
      prisma.unit.count({ where: { isActive: true, deletedAt: null } }),
      prisma.studentQuestionProgress.count({ where: { lastAnswerCorrect: false } })
    ]);

    const subjectsList = await prisma.subject.findMany({
      select: {
        id: true,
        name: true,
        isPublished: true,
        isActive: true,
        sortOrder: true,
        colorHex: true,
        iconKey: true,
        _count: { select: { questions: true, units: true, studyResources: true } }
      },
      orderBy: { sortOrder: 'asc' }
    });

    const resourceCategories = await prisma.studyResource.groupBy({
      by: ['category'],
      _count: { id: true }
    });

    const userRoles = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true }
    });

    const aiSettingRecord = await prisma.aiAssistantSetting.findUnique({
      where: { id: 'default' }
    });

    const sysSettings = await prisma.systemSetting.findMany();

    console.log("=== AUDIT_STATS_JSON_START ===");
    console.log(JSON.stringify({
      counts: {
        users, subjects, units, lessons, questions, options, sources, passages,
        studyResources, attempts, studentQuestionProgress, activeMistakesCount, challenges,
        models, providers, policies, aiSettings, aiUsages, systemSettings
      },
      userRoles,
      questionStats: {
        mcqCount, trueFalseCount, withHint, withExplShort, withExplDetail, withWhyWrong,
        publishedQuestions, activeQuestions, orphanQuestionsNoLesson, questionsNoCorrectOption
      },
      hierarchy: {
        publishedLessons, activeLessons, publishedUnits, activeUnits
      },
      subjectsList,
      resourceCategories,
      aiSettingRecord,
      sysSettings
    }, null, 2));
    console.log("=== AUDIT_STATS_JSON_END ===");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
