import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import {
  CompanionType,
  ExplanationMode,
  PointType,
  QuestionDifficulty,
  QuestionReviewStatus,
  QuestionType,
  QuizAttemptStatus,
  QuizScope,
  QuizTimingMode,
  UserRole,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

interface AuthResponse {
  tokens: { accessToken: string };
}
interface DataResponse<T = Record<string, unknown>> {
  data: T;
}
type CreatedQuiz = {
  attempt: {
    id: string;
    status: QuizAttemptStatus;
    questionCount: number;
    heartsRemaining: number | null;
  };
  questions: Array<{
    id: string;
    type: QuestionType;
    correctBoolean?: unknown;
    options: Array<{
      id: string;
      optionText: string;
      sortOrder: number;
      isCorrect?: unknown;
    }>;
  }>;
  availability: {
    requestedQuestionCount: number;
    actualQuestionCount: number;
    shortageCount: number;
    warningCode: string | null;
  };
};

const responseCode = (body: unknown) => (body as { code?: string }).code;

describe('Quiz Engine PostgreSQL hardening (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomUUID().slice(0, 8);
  const password = 'Password123';
  const ids: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  const auth = (token: string) => `Bearer ${token}`;
  const quizPost = (path: string, token = tokens.studentA) =>
    request(app.getHttpServer()).post(path).set('Authorization', auth(token));

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await hash(password);
    for (const [key, role] of [
      ['admin', UserRole.ADMIN],
      ['studentA', UserRole.STUDENT],
      ['studentB', UserRole.STUDENT],
    ] as const) {
      const username = `quiz_${key.toLowerCase()}_${suffix}`;
      const user = await prisma.user.create({
        data: {
          name: `Quiz ${key}`,
          username,
          passwordHash,
          role,
          companion: CompanionType.MALE,
        },
      });
      ids[`${key}Id`] = user.id;
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ identifier: username, password })
        .expect(200);
      tokens[key] = (login.body as AuthResponse).tokens.accessToken;
    }

    const grade = await prisma.grade.create({
      data: {
        name: `Quiz Grade ${suffix}`,
        slug: `quiz-grade-${suffix}`,
        isActive: true,
      },
    });
    const curriculum = await prisma.curriculum.create({
      data: {
        name: `Quiz Curriculum ${suffix}`,
        slug: `quiz-curriculum-${suffix}`,
        countryCode: 'YE',
        isActive: true,
      },
    });
    ids.gradeId = grade.id;
    ids.curriculumId = curriculum.id;
    await prisma.curriculumGrade.create({
      data: { curriculumId: curriculum.id, gradeId: grade.id },
    });
    const subject = await prisma.subject.create({
      data: {
        curriculumId: curriculum.id,
        gradeId: grade.id,
        name: `Quiz Physics ${suffix}`,
        slug: `quiz-physics-${suffix}`,
        isActive: true,
        isPublished: true,
      },
    });
    const emptySubject = await prisma.subject.create({
      data: {
        curriculumId: curriculum.id,
        gradeId: grade.id,
        name: `Quiz Empty ${suffix}`,
        slug: `quiz-empty-${suffix}`,
        isActive: true,
        isPublished: true,
      },
    });
    ids.subjectId = subject.id;
    ids.emptySubjectId = emptySubject.id;
    const unit = await prisma.unit.create({
      data: {
        subjectId: subject.id,
        name: `Quiz Motion ${suffix}`,
        slug: `quiz-motion-${suffix}`,
        isActive: true,
        isPublished: true,
      },
    });
    const lesson = await prisma.lesson.create({
      data: {
        subjectId: subject.id,
        unitId: unit.id,
        name: `Quiz Newton ${suffix}`,
        slug: `quiz-newton-${suffix}`,
        isActive: true,
        isPublished: true,
      },
    });
    ids.unitId = unit.id;
    ids.lessonId = lesson.id;

    const mcq = await prisma.question.create({
      data: {
        subjectId: subject.id,
        unitId: unit.id,
        lessonId: lesson.id,
        type: QuestionType.MULTIPLE_CHOICE,
        difficulty: QuestionDifficulty.EASY,
        questionText: `Quiz MCQ ${suffix}`,
        reviewStatus: QuestionReviewStatus.READY,
        isActive: true,
        isPublished: true,
        explanationShort: 'Snapshot explanation',
        options: {
          create: [
            { optionText: 'Newton', sortOrder: 0, isCorrect: true },
            {
              optionText: 'Joule',
              sortOrder: 1,
              isCorrect: false,
              whyWrong: 'Snapshot wrong reason',
            },
          ],
        },
      },
      include: { options: true },
    });
    const tf = await prisma.question.create({
      data: {
        subjectId: subject.id,
        unitId: unit.id,
        lessonId: lesson.id,
        type: QuestionType.TRUE_FALSE,
        difficulty: QuestionDifficulty.MEDIUM,
        questionText: `Quiz TF ${suffix}`,
        correctBoolean: true,
        reviewStatus: QuestionReviewStatus.READY,
        isActive: true,
        isPublished: true,
      },
    });
    const tf2 = await prisma.question.create({
      data: {
        subjectId: subject.id,
        unitId: unit.id,
        lessonId: lesson.id,
        type: QuestionType.TRUE_FALSE,
        difficulty: QuestionDifficulty.HARD,
        questionText: `Quiz TF2 ${suffix}`,
        correctBoolean: false,
        reviewStatus: QuestionReviewStatus.READY,
        isActive: true,
        isPublished: true,
      },
    });
    ids.mcqId = mcq.id;
    ids.correctOptionId =
      mcq.options.find((option) => option.isCorrect)?.id ?? '';
    ids.wrongOptionId =
      mcq.options.find((option) => !option.isCorrect)?.id ?? '';
    ids.tfId = tf.id;
    ids.tf2Id = tf2.id;

    const exam = await prisma.examModel.create({
      data: {
        subjectId: subject.id,
        title: `Quiz Exam ${suffix}`,
        slug: `quiz-exam-${suffix}`,
        durationMinutes: 60,
        isPublished: true,
        questions: {
          create: [
            { questionId: tf.id, sortOrder: 0, points: 1 },
            { questionId: mcq.id, sortOrder: 4, points: 2 },
          ],
        },
      },
    });
    ids.examId = exam.id;
  });

  const createQuiz = async (
    body: Record<string, unknown>,
    token = tokens.studentA,
  ) => {
    const response = await quizPost('/api/v1/quiz-attempts', token)
      .send(body)
      .expect(201);
    return (response.body as DataResponse<CreatedQuiz>).data;
  };

  const payloadFor = (
    question: CreatedQuiz['questions'][number],
    correct = true,
  ) => {
    if (question.type === QuestionType.MULTIPLE_CHOICE) {
      return {
        questionId: question.id,
        selectedOptionId: correct ? ids.correctOptionId : ids.wrongOptionId,
        timeSpentMs: 1000,
        hintUsed: false,
        eliminatedOptionUsed: false,
      };
    }
    const expected = question.id === ids.tfId;
    return {
      questionId: question.id,
      selectedBoolean: correct ? expected : !expected,
      timeSpentMs: 1000,
      hintUsed: false,
      eliminatedOptionUsed: false,
    };
  };

  it('validates scope, applies shortage policy, protects ownership, and returns safe snapshots', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/quiz-attempts')
      .send({})
      .expect(401);
    await quizPost('/api/v1/quiz-attempts')
      .send({
        scope: QuizScope.SUBJECT,
        subjectId: ids.subjectId,
        unitId: ids.unitId,
        questionCount: 1,
      })
      .expect(400)
      .expect(({ body }) =>
        expect(responseCode(body)).toBe('QUIZ_SCOPE_INVALID'),
      );

    const created = await createQuiz({
      scope: QuizScope.LESSON,
      subjectId: ids.subjectId,
      unitId: ids.unitId,
      lessonId: ids.lessonId,
      questionCount: 5,
      timingMode: QuizTimingMode.NONE,
      heartsEnabled: true,
      initialHearts: 2,
      hintsEnabled: true,
      explanationMode: ExplanationMode.AFTER_EACH,
    });
    ids.mainAttemptId = created.attempt.id;
    expect(created.availability).toEqual({
      requestedQuestionCount: 5,
      actualQuestionCount: 3,
      shortageCount: 2,
      warningCode: 'INSUFFICIENT_QUESTIONS',
    });
    expect(created.attempt.heartsRemaining).toBe(2);
    for (const question of created.questions) {
      expect(question).not.toHaveProperty('correctBoolean');
      for (const option of question.options)
        expect(option).not.toHaveProperty('isCorrect');
    }

    await request(app.getHttpServer())
      .get(`/api/v1/quiz-attempts/${ids.mainAttemptId}`)
      .set('Authorization', auth(tokens.studentB))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/quiz-attempts/${ids.mainAttemptId}/result`)
      .set('Authorization', auth(tokens.studentA))
      .expect(400)
      .expect(({ body }) =>
        expect(responseCode(body)).toBe('QUIZ_RESULT_NOT_AVAILABLE'),
      );

    await quizPost('/api/v1/quiz-attempts')
      .send({
        scope: QuizScope.SUBJECT,
        subjectId: ids.emptySubjectId,
        questionCount: 2,
      })
      .expect(400)
      .expect(({ body }) =>
        expect(responseCode(body)).toBe('INSUFFICIENT_QUESTIONS'),
      );
  });

  it('evaluates immutable snapshots, makes retries idempotent, updates progress, hearts, completion, and results', async () => {
    const current = await request(app.getHttpServer())
      .get(`/api/v1/quiz-attempts/${ids.mainAttemptId}`)
      .set('Authorization', auth(tokens.studentA))
      .expect(200);
    const questions = (
      current.body as DataResponse<{ questions: CreatedQuiz['questions'] }>
    ).data.questions;
    const mcq = questions.find((item) => item.id === ids.mcqId);
    const tf = questions.find((item) => item.id === ids.tfId);
    const tf2 = questions.find((item) => item.id === ids.tf2Id);
    expect(mcq && tf && tf2).toBeTruthy();

    await prisma.questionOption.update({
      where: { id: ids.correctOptionId },
      data: { isCorrect: false },
    });
    await prisma.questionOption.update({
      where: { id: ids.wrongOptionId },
      data: { isCorrect: true },
    });

    const mcqPayload = payloadFor(mcq!, true);
    const first = await quizPost(
      `/api/v1/quiz-attempts/${ids.mainAttemptId}/answers`,
    )
      .send(mcqPayload)
      .expect(201);
    expect((first.body as DataResponse).data).toMatchObject({
      accepted: true,
      isCorrect: true,
      correctAnswer: { optionId: ids.correctOptionId },
    });

    const retry = await quizPost(
      `/api/v1/quiz-attempts/${ids.mainAttemptId}/answers`,
    )
      .send(mcqPayload)
      .expect(201);
    expect((retry.body as DataResponse).data).toMatchObject({
      accepted: true,
      isCorrect: true,
    });
    expect(
      await prisma.quizAnswer.count({
        where: { attemptId: ids.mainAttemptId, questionId: ids.mcqId },
      }),
    ).toBe(1);

    await quizPost(`/api/v1/quiz-attempts/${ids.mainAttemptId}/answers`)
      .send({ ...mcqPayload, selectedOptionId: ids.wrongOptionId })
      .expect(409)
      .expect(({ body }) =>
        expect(responseCode(body)).toBe('QUESTION_ALREADY_ANSWERED'),
      );

    const wrong = await quizPost(
      `/api/v1/quiz-attempts/${ids.mainAttemptId}/answers`,
    )
      .send(payloadFor(tf!, false))
      .expect(201);
    expect(
      (wrong.body as DataResponse<{ progress: { heartsRemaining: number } }>)
        .data.progress.heartsRemaining,
    ).toBe(1);

    const final = await quizPost(
      `/api/v1/quiz-attempts/${ids.mainAttemptId}/answers`,
    )
      .send(payloadFor(tf2!, true))
      .expect(201);
    expect(
      (final.body as DataResponse<{ progress: { status: QuizAttemptStatus } }>)
        .data.progress.status,
    ).toBe(QuizAttemptStatus.COMPLETED);

    const attempt = await prisma.quizAttempt.findUniqueOrThrow({
      where: { id: ids.mainAttemptId },
    });
    expect(attempt).toMatchObject({
      status: QuizAttemptStatus.COMPLETED,
      correctCount: 2,
      wrongCount: 1,
      unansweredCount: 0,
    });
    expect(Number(attempt.scorePercent)).toBeCloseTo(66.67, 2);
    expect(
      await prisma.studentQuestionProgress.count({
        where: { userId: ids.studentAId },
      }),
    ).toBe(3);
    expect(
      await prisma.studentDailyActivity.count({
        where: { userId: ids.studentAId },
      }),
    ).toBe(1);
    expect(
      await prisma.pointTransaction.count({
        where: {
          userId: ids.studentAId,
          type: PointType.QUIZ_COMPLETE,
          referenceId: ids.mainAttemptId,
        },
      }),
    ).toBe(1);

    const completedAgain = await quizPost(
      `/api/v1/quiz-attempts/${ids.mainAttemptId}/complete`,
    ).expect(201);
    expect((completedAgain.body as DataResponse).data).toMatchObject({
      status: QuizAttemptStatus.COMPLETED,
    });
    expect(
      await prisma.pointTransaction.count({
        where: {
          type: PointType.QUIZ_COMPLETE,
          referenceId: ids.mainAttemptId,
        },
      }),
    ).toBe(1);

    const result = await request(app.getHttpServer())
      .get(`/api/v1/quiz-attempts/${ids.mainAttemptId}/result`)
      .set('Authorization', auth(tokens.studentA))
      .expect(200);
    const resultData = (
      result.body as DataResponse<{
        questions: Array<Record<string, unknown>>;
        summary: Record<string, unknown>;
      }>
    ).data;
    expect(resultData.summary).toMatchObject({
      status: QuizAttemptStatus.COMPLETED,
      correctCount: 2,
      wrongCount: 1,
      unansweredCount: 0,
    });
    const resultMcq = resultData.questions.find(
      (item) => item.id === ids.mcqId,
    );
    const resultOptions = resultMcq?.options as Array<Record<string, unknown>>;
    expect(
      resultOptions.find((option) => option.id === ids.correctOptionId)
        ?.isCorrect,
    ).toBe(true);

    const disabled = await createQuiz({
      scope: QuizScope.LESSON,
      lessonId: ids.lessonId,
      questionCount: 1,
      explanationMode: ExplanationMode.DISABLED,
    });
    ids.disabledAttemptId = disabled.attempt.id;
    const disabledAnswer = await quizPost(
      `/api/v1/quiz-attempts/${ids.disabledAttemptId}/answers`,
    )
      .send(payloadFor(disabled.questions[0], true))
      .expect(201);
    expect((disabledAnswer.body as DataResponse).data).not.toHaveProperty(
      'isCorrect',
    );
    expect((disabledAnswer.body as DataResponse).data.correctAnswer).toBeNull();
    const disabledResult = await request(app.getHttpServer())
      .get(`/api/v1/quiz-attempts/${ids.disabledAttemptId}/result`)
      .set('Authorization', auth(tokens.studentA))
      .expect(200);
    const disabledQuestion = (
      disabledResult.body as DataResponse<{
        questions: Array<Record<string, unknown>>;
      }>
    ).data.questions[0];
    expect(disabledQuestion).not.toHaveProperty('isCorrect');
    for (const option of disabledQuestion.options as Array<
      Record<string, unknown>
    >) {
      expect(option).not.toHaveProperty('isCorrect');
      expect(option).not.toHaveProperty('whyWrong');
    }

    await prisma.questionOption.update({
      where: { id: ids.correctOptionId },
      data: { isCorrect: true },
    });
    await prisma.questionOption.update({
      where: { id: ids.wrongOptionId },
      data: { isCorrect: false },
    });
  });

  it('preserves Exam Model order and supports deterministic history', async () => {
    const examAttempt = await createQuiz({
      scope: QuizScope.EXAM_MODEL,
      examModelId: ids.examId,
      questionCount: 2,
    });
    ids.examAttemptId = examAttempt.attempt.id;
    expect(examAttempt.questions.map((item) => item.id)).toEqual([
      ids.tfId,
      ids.mcqId,
    ]);
    const history = await request(app.getHttpServer())
      .get('/api/v1/quiz-attempts?sort=created_asc&scope=EXAM_MODEL')
      .set('Authorization', auth(tokens.studentA))
      .expect(200);
    expect(
      (history.body as { data: Array<{ id: string }> }).data.some(
        (item) => item.id === ids.examAttemptId,
      ),
    ).toBe(true);
  });

  it('makes abandon idempotent and expires attempts on the server', async () => {
    const hearts = await createQuiz({
      scope: QuizScope.LESSON,
      lessonId: ids.lessonId,
      questionCount: 2,
      heartsEnabled: true,
      initialHearts: 1,
    });
    ids.heartsAttemptId = hearts.attempt.id;
    const depleted = await quizPost(
      `/api/v1/quiz-attempts/${ids.heartsAttemptId}/answers`,
    )
      .send(payloadFor(hearts.questions[0], false))
      .expect(201);
    expect(
      (
        depleted.body as DataResponse<{
          progress: { status: QuizAttemptStatus };
        }>
      ).data.progress.status,
    ).toBe(QuizAttemptStatus.COMPLETED);
    const depletedRecord = await prisma.quizAttempt.findUniqueOrThrow({
      where: { id: ids.heartsAttemptId },
    });
    expect(depletedRecord.heartsRemaining).toBe(0);
    expect(
      (depletedRecord.settings as { completionReason?: string })
        .completionReason,
    ).toBe('HEARTS_DEPLETED');

    const abandoned = await createQuiz({
      scope: QuizScope.LESSON,
      lessonId: ids.lessonId,
      questionCount: 1,
    });
    ids.abandonedAttemptId = abandoned.attempt.id;
    await quizPost(
      `/api/v1/quiz-attempts/${ids.abandonedAttemptId}/abandon`,
    ).expect(201);
    await quizPost(
      `/api/v1/quiz-attempts/${ids.abandonedAttemptId}/abandon`,
    ).expect(201);
    await quizPost(`/api/v1/quiz-attempts/${ids.abandonedAttemptId}/answers`)
      .send(payloadFor(abandoned.questions[0], true))
      .expect(400)
      .expect(({ body }) =>
        expect(responseCode(body)).toBe('QUIZ_ATTEMPT_NOT_ACTIVE'),
      );
    expect(
      await prisma.pointTransaction.count({
        where: {
          type: PointType.QUIZ_COMPLETE,
          referenceId: ids.abandonedAttemptId,
        },
      }),
    ).toBe(0);

    const expired = await createQuiz({
      scope: QuizScope.LESSON,
      lessonId: ids.lessonId,
      questionCount: 1,
      timingMode: QuizTimingMode.TOTAL_TIME,
      durationSeconds: 10,
    });
    ids.expiredAttemptId = expired.attempt.id;
    await prisma.quizAttempt.update({
      where: { id: ids.expiredAttemptId },
      data: { expiresAt: new Date('2020-01-01T00:00:00.000Z') },
    });
    await quizPost(`/api/v1/quiz-attempts/${ids.expiredAttemptId}/answers`)
      .send(payloadFor(expired.questions[0], true))
      .expect(400)
      .expect(({ body }) =>
        expect(responseCode(body)).toBe('QUIZ_ATTEMPT_EXPIRED'),
      );
    expect(
      (
        await prisma.quizAttempt.findUniqueOrThrow({
          where: { id: ids.expiredAttemptId },
        })
      ).status,
    ).toBe(QuizAttemptStatus.EXPIRED);

    const perQuestion = await createQuiz({
      scope: QuizScope.LESSON,
      lessonId: ids.lessonId,
      questionCount: 1,
      timingMode: QuizTimingMode.PER_QUESTION,
      timePerQuestionSeconds: 5,
    });
    ids.perQuestionAttemptId = perQuestion.attempt.id;
    await prisma.quizAttempt.update({
      where: { id: ids.perQuestionAttemptId },
      data: { lastActivityAt: new Date('2020-01-01T00:00:00.000Z') },
    });
    await quizPost(`/api/v1/quiz-attempts/${ids.perQuestionAttemptId}/answers`)
      .send(payloadFor(perQuestion.questions[0], true))
      .expect(400)
      .expect(({ body }) =>
        expect(responseCode(body)).toBe('QUIZ_QUESTION_TIME_EXPIRED'),
      );
  });

  it('serializes concurrent duplicate answers and concurrent completion rewards', async () => {
    const answerRace = await createQuiz({
      scope: QuizScope.LESSON,
      lessonId: ids.lessonId,
      questionCount: 1,
    });
    ids.answerRaceAttemptId = answerRace.attempt.id;
    const payload = payloadFor(answerRace.questions[0], true);
    const progressBefore = await prisma.studentQuestionProgress.findUnique({
      where: {
        userId_questionId: {
          userId: ids.studentAId,
          questionId: answerRace.questions[0].id,
        },
      },
      select: { attemptsCount: true },
    });
    const answerResults = await Promise.allSettled([
      quizPost(`/api/v1/quiz-attempts/${ids.answerRaceAttemptId}/answers`).send(
        payload,
      ),
      quizPost(`/api/v1/quiz-attempts/${ids.answerRaceAttemptId}/answers`).send(
        payload,
      ),
    ]);
    expect(
      answerResults.every(
        (result) =>
          result.status === 'fulfilled' && result.value.status === 201,
      ),
    ).toBe(true);
    expect(
      await prisma.quizAnswer.count({
        where: { attemptId: ids.answerRaceAttemptId },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.studentQuestionProgress.findUniqueOrThrow({
          where: {
            userId_questionId: {
              userId: ids.studentAId,
              questionId: answerRace.questions[0].id,
            },
          },
        })
      ).attemptsCount,
    ).toBe((progressBefore?.attemptsCount ?? 0) + 1);

    const completeRace = await createQuiz({
      scope: QuizScope.LESSON,
      lessonId: ids.lessonId,
      questionCount: 2,
    });
    ids.completeRaceAttemptId = completeRace.attempt.id;
    const completeResults = await Promise.allSettled([
      quizPost(`/api/v1/quiz-attempts/${ids.completeRaceAttemptId}/complete`),
      quizPost(`/api/v1/quiz-attempts/${ids.completeRaceAttemptId}/complete`),
    ]);
    expect(
      completeResults.every(
        (result) =>
          result.status === 'fulfilled' && result.value.status === 201,
      ),
    ).toBe(true);
    expect(
      await prisma.pointTransaction.count({
        where: {
          type: PointType.QUIZ_COMPLETE,
          referenceId: ids.completeRaceAttemptId,
        },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.quizAttempt.findUniqueOrThrow({
          where: { id: ids.completeRaceAttemptId },
        })
      ).status,
    ).toBe(QuizAttemptStatus.COMPLETED);
  });

  it('keeps UUID validation, health, and Swagger routes intact', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/quiz-attempts/not-a-uuid')
      .set('Authorization', auth(tokens.studentA))
      .expect(400);
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    const swagger = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const paths = (swagger.body as { paths: Record<string, unknown> }).paths;
    for (const path of [
      '/api/v1/quiz-attempts',
      '/api/v1/quiz-attempts/{attemptId}/answers',
      '/api/v1/quiz-attempts/{attemptId}/complete',
      '/api/v1/quiz-attempts/{attemptId}/abandon',
      '/api/v1/quiz-attempts/{attemptId}/result',
      '/api/v1/quiz-attempts/{id}',
    ])
      expect(paths).toHaveProperty(path);
    await request(app.getHttpServer()).get('/api/docs').expect(200);
  });

  afterAll(async () => {
    if (!prisma || !app) return;
    await prisma.quizAttempt.deleteMany({
      where: {
        userId: { in: [ids.studentAId, ids.studentBId].filter(Boolean) },
      },
    });
    if (ids.examId)
      await prisma.examModel.deleteMany({ where: { id: ids.examId } });
    await prisma.question.deleteMany({
      where: { id: { in: [ids.mcqId, ids.tfId, ids.tf2Id].filter(Boolean) } },
    });
    if (ids.lessonId)
      await prisma.lesson.deleteMany({ where: { id: ids.lessonId } });
    if (ids.unitId) await prisma.unit.deleteMany({ where: { id: ids.unitId } });
    await prisma.subject.deleteMany({
      where: {
        id: { in: [ids.subjectId, ids.emptySubjectId].filter(Boolean) },
      },
    });
    if (ids.curriculumId || ids.gradeId)
      await prisma.curriculumGrade.deleteMany({
        where: {
          OR: [{ curriculumId: ids.curriculumId }, { gradeId: ids.gradeId }],
        },
      });
    if (ids.curriculumId)
      await prisma.curriculum.deleteMany({ where: { id: ids.curriculumId } });
    if (ids.gradeId)
      await prisma.grade.deleteMany({ where: { id: ids.gradeId } });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [ids.adminId, ids.studentAId, ids.studentBId].filter(Boolean),
        },
      },
    });
    await app.close();
  });
});
