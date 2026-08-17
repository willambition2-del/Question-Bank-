import { Injectable } from '@nestjs/common';
import type { QuestionWithContent } from '../content/content.mapper';
import { QuestionHierarchyValidator } from '../content/questions/question-hierarchy.validator';
import { GradeLevel, QuestionReviewStatus, QuizScope } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuizAttemptDto } from './dto/quiz.dto';
import { quizBadRequest } from './quiz-errors';

export const QUIZ_CANDIDATE_POOL_LIMIT = 500;
export type SelectedQuizQuestion = { question: QuestionWithContent };

@Injectable()
export class QuestionSelectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hierarchy: QuestionHierarchyValidator,
  ) {}

  private async getStudentGradeLevel(userId: string): Promise<GradeLevel> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { gradeLevel: true },
    });
    return user?.gradeLevel ?? GradeLevel.THIRD_SECONDARY;
  }

  async select(
    userId: string,
    dto: CreateQuizAttemptDto,
  ): Promise<SelectedQuizQuestion[]> {
    const userGrade = await this.getStudentGradeLevel(userId);
    let questions: QuestionWithContent[];
    let balanceGeneral = false;
    if (dto.scope === QuizScope.EXAM_MODEL) {
      questions = await this.selectExamModel(dto);
    } else if (
      dto.scope === QuizScope.MISTAKES ||
      dto.scope === QuizScope.WEAKNESS
    ) {
      questions = await this.selectProgress(userId, dto, userGrade);
    } else if (dto.scope === QuizScope.SAVED) {
      questions = await this.selectSaved(userId, dto, userGrade);
    } else {
      questions = await this.selectGeneral(userId, dto, userGrade);
      balanceGeneral = true;
    }
    const visible = await this.filterVisible(questions);
    const selected = balanceGeneral
      ? this.pick(visible, dto.questionCount, dto.difficulty === 'MIXED')
      : visible.slice(0, dto.questionCount);
    return selected.map((question) => ({ question }));
  }

  private async selectGeneral(
    userId: string,
    dto: CreateQuizAttemptDto,
    userGrade: GradeLevel,
  ) {
    const recent = await this.prisma.quizAttemptQuestion.findMany({
      where: { attempt: { userId } },
      select: { questionId: true },
      orderBy: { createdAt: 'desc' },
      take: Math.min(300, dto.questionCount * 3),
    });
    const recentIds = [...new Set(recent.map((item) => item.questionId))];
    let candidates = await this.findCandidates(userId, dto, recentIds, userGrade);
    if (candidates.length < dto.questionCount && recentIds.length) {
      candidates = await this.findCandidates(userId, dto, [], userGrade);
    }
    return this.pick(candidates, dto.questionCount, dto.difficulty === 'MIXED');
  }

  private async selectProgress(
    userId: string,
    dto: CreateQuizAttemptDto,
    userGrade: GradeLevel,
  ) {
    const items = await this.prisma.studentQuestionProgress.findMany({
      where: {
        userId,
        ...(dto.scope === QuizScope.MISTAKES
          ? { wrongCount: { gt: 0 } }
          : { isMastered: false }),
        question: this.questionWhere(dto, userGrade),
      },
      include: {
        question: { include: { options: true, readingPassage: true } },
      },
      orderBy:
        dto.scope === QuizScope.MISTAKES
          ? [
              { wrongCount: 'desc' },
              { lastWrongAt: 'desc' },
              { questionId: 'asc' },
            ]
          : [
              { masteryScore: 'asc' },
              { lastAnsweredAt: 'asc' },
              { questionId: 'asc' },
            ],
      take: Math.min(
        QUIZ_CANDIDATE_POOL_LIMIT,
        Math.max(dto.questionCount * 5, dto.questionCount),
      ),
    });
    return items.map((item) => item.question);
  }

  private async selectSaved(
    userId: string,
    dto: CreateQuizAttemptDto,
    userGrade: GradeLevel,
  ) {
    const items = await this.prisma.savedQuestion.findMany({
      where: { userId, question: this.questionWhere(dto, userGrade) },
      include: {
        question: { include: { options: true, readingPassage: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { questionId: 'asc' }],
      take: Math.min(
        QUIZ_CANDIDATE_POOL_LIMIT,
        Math.max(dto.questionCount * 5, dto.questionCount),
      ),
    });
    return items.map((item) => item.question);
  }

  private async selectExamModel(dto: CreateQuizAttemptDto) {
    const exam = await this.prisma.examModel.findFirst({
      where: { id: dto.examModelId, isPublished: true, deletedAt: null },
      include: {
        questions: {
          include: {
            question: { include: { options: true, readingPassage: true } },
          },
          orderBy: { sortOrder: 'asc' },
          take: Math.min(
            QUIZ_CANDIDATE_POOL_LIMIT,
            Math.max(dto.questionCount * 5, dto.questionCount),
          ),
        },
      },
    });
    if (!exam)
      throw quizBadRequest(
        'QUIZ_SCOPE_INVALID',
        'Published exam model not found',
      );
    return exam.questions.map((item) => item.question);
  }

  private findCandidates(
    userId: string,
    dto: CreateQuizAttemptDto,
    excludedIds: string[],
    userGrade: GradeLevel,
  ) {
    return this.prisma.question.findMany({
      where: {
        ...this.questionWhere(dto, userGrade),
        ...(excludedIds.length ? { id: { notIn: excludedIds } } : {}),
        ...(dto.excludeMastered
          ? { studentProgress: { none: { userId, isMastered: true } } }
          : {}),
        ...(dto.unansweredOnly
          ? { studentProgress: { none: { userId } } }
          : {}),
      },
      include: { options: true, readingPassage: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: Math.min(
        QUIZ_CANDIDATE_POOL_LIMIT,
        Math.max(dto.questionCount * 5, dto.questionCount),
      ),
    });
  }

  private questionWhere(dto: CreateQuizAttemptDto, userGrade?: GradeLevel) {
    return {
      ...(dto.subjectId ? { subjectId: dto.subjectId } : {}),
      ...(dto.unitId ? { unitId: dto.unitId } : {}),
      ...(dto.lessonId ? { lessonId: dto.lessonId } : {}),
      reviewStatus: QuestionReviewStatus.READY,
      isActive: true,
      isPublished: true,
      deletedAt: null,
      subject: {
        isActive: true,
        deletedAt: null,
        ...(userGrade
          ? { grade: { isActive: true, deletedAt: null, code: userGrade } }
          : {}),
      },
      ...(dto.questionTypes?.length ? { type: { in: dto.questionTypes } } : {}),
      ...(dto.difficulty !== 'MIXED' ? { difficulty: dto.difficulty } : {}),
      OR: [
        { readingPassageId: null },
        {
          readingPassage: {
            is: { isActive: true, isPublished: true, deletedAt: null },
          },
        },
      ],
    };
  }

  private async filterVisible(questions: QuestionWithContent[]) {
    const visible: QuestionWithContent[] = [];
    const seen = new Set<string>();
    for (const question of questions) {
      if (seen.has(question.id)) continue;
      try {
        await this.hierarchy.validate(question, true);
        visible.push(question);
        seen.add(question.id);
      } catch {
        continue;
      }
    }
    return visible;
  }

  private pick(
    candidates: QuestionWithContent[],
    count: number,
    balanced: boolean,
  ) {
    if (!balanced) return this.shuffle([...candidates]).slice(0, count);
    const groups = new Map<string, QuestionWithContent[]>([
      ['EASY', []],
      ['MEDIUM', []],
      ['HARD', []],
    ]);
    candidates.forEach((question) =>
      groups.get(question.difficulty)?.push(question),
    );
    groups.forEach((questions) => this.shuffle(questions));
    const selected: QuestionWithContent[] = [];
    while (selected.length < count) {
      let added = false;
      for (const difficulty of ['EASY', 'MEDIUM', 'HARD']) {
        const question = groups.get(difficulty)?.shift();
        if (question) {
          selected.push(question);
          added = true;
          if (selected.length === count) break;
        }
      }
      if (!added) break;
    }
    return selected;
  }

  private shuffle<T>(items: T[]) {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [items[index], items[target]] = [items[target], items[index]];
    }
    return items;
  }
}
