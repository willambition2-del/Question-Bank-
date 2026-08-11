import { Injectable } from '@nestjs/common';
import { QuizScope } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ExamModelHierarchyValidator } from '../content/exam-models/exam-model-hierarchy.validator';
import { QuestionHierarchyValidator } from '../content/questions/question-hierarchy.validator';
import { CreateQuizAttemptDto } from './dto/quiz.dto';
import { quizBadRequest } from './quiz-errors';

export type ResolvedQuizScope = {
  subjectId?: string;
  unitId?: string;
  lessonId?: string;
  examModelId?: string;
};

@Injectable()
export class QuizScopeValidator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questionHierarchy: QuestionHierarchyValidator,
    private readonly examHierarchy: ExamModelHierarchyValidator,
  ) {}

  async validate(dto: CreateQuizAttemptDto): Promise<ResolvedQuizScope> {
    switch (dto.scope) {
      case QuizScope.SUBJECT:
        this.requireOnly(dto, ['subjectId']);
        if (!dto.subjectId)
          this.invalid('subjectId is required for SUBJECT scope');
        await this.visibleHierarchy({ subjectId: dto.subjectId });
        return { subjectId: dto.subjectId };
      case QuizScope.UNIT:
        this.requireOnly(dto, ['subjectId', 'unitId']);
        if (!dto.unitId) this.invalid('unitId is required for UNIT scope');
        return this.resolveUnit(dto.unitId, dto.subjectId);
      case QuizScope.LESSON:
        this.requireOnly(dto, ['subjectId', 'unitId', 'lessonId']);
        if (!dto.lessonId)
          this.invalid('lessonId is required for LESSON scope');
        return this.resolveLesson(dto.lessonId, dto.unitId, dto.subjectId);
      case QuizScope.EXAM_MODEL:
        this.requireOnly(dto, ['examModelId']);
        if (!dto.examModelId)
          this.invalid('examModelId is required for EXAM_MODEL scope');
        return this.resolveExam(dto.examModelId);
      case QuizScope.RANDOM:
        this.requireOnly(dto, ['subjectId']);
        if (dto.subjectId)
          await this.visibleHierarchy({ subjectId: dto.subjectId });
        return { subjectId: dto.subjectId };
      case QuizScope.MISTAKES:
      case QuizScope.WEAKNESS:
      case QuizScope.SAVED:
        this.requireOnly(dto, ['subjectId', 'unitId', 'lessonId']);
        return this.resolveOptionalHierarchy(dto);
      default:
        this.invalid('Unsupported quiz scope');
    }
  }

  private async resolveOptionalHierarchy(dto: CreateQuizAttemptDto) {
    if (dto.lessonId)
      return this.resolveLesson(dto.lessonId, dto.unitId, dto.subjectId);
    if (dto.unitId) return this.resolveUnit(dto.unitId, dto.subjectId);
    if (dto.subjectId)
      await this.visibleHierarchy({ subjectId: dto.subjectId });
    return { subjectId: dto.subjectId };
  }

  private async resolveUnit(unitId: string, expectedSubjectId?: string) {
    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId, deletedAt: null },
      select: { id: true, subjectId: true },
    });
    if (!unit || (expectedSubjectId && expectedSubjectId !== unit.subjectId)) {
      this.invalid('Unit does not belong to the selected subject');
    }
    await this.visibleHierarchy({ subjectId: unit.subjectId, unitId: unit.id });
    return { subjectId: unit.subjectId, unitId: unit.id };
  }

  private async resolveLesson(
    lessonId: string,
    expectedUnitId?: string,
    expectedSubjectId?: string,
  ) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null },
      select: { id: true, unitId: true, subjectId: true },
    });
    if (
      !lesson ||
      (expectedUnitId && expectedUnitId !== lesson.unitId) ||
      (expectedSubjectId && expectedSubjectId !== lesson.subjectId)
    ) {
      this.invalid('Lesson does not belong to the selected unit and subject');
    }
    await this.visibleHierarchy({
      subjectId: lesson.subjectId,
      unitId: lesson.unitId,
      lessonId: lesson.id,
    });
    return {
      subjectId: lesson.subjectId,
      unitId: lesson.unitId,
      lessonId: lesson.id,
    };
  }

  private async resolveExam(examModelId: string) {
    const exam = await this.prisma.examModel.findFirst({
      where: { id: examModelId, isPublished: true, deletedAt: null },
      select: { id: true, subjectId: true, sourceId: true },
    });
    if (!exam) this.invalid('Published exam model not found');
    const hierarchy = await this.examHierarchy.load(
      exam.subjectId,
      exam.sourceId,
    );
    if (!this.examHierarchy.isVisible(hierarchy))
      this.invalid('Exam model hierarchy is not visible');
    return { subjectId: exam.subjectId, examModelId: exam.id };
  }

  private async visibleHierarchy(input: {
    subjectId: string;
    unitId?: string;
    lessonId?: string;
  }) {
    try {
      await this.questionHierarchy.validate(input, true);
    } catch {
      this.invalid('Quiz scope hierarchy is invalid or hidden');
    }
  }

  private requireOnly(
    dto: CreateQuizAttemptDto,
    allowed: Array<'subjectId' | 'unitId' | 'lessonId' | 'examModelId'>,
  ) {
    const fields = ['subjectId', 'unitId', 'lessonId', 'examModelId'] as const;
    if (fields.some((field) => dto[field] && !allowed.includes(field))) {
      this.invalid(`Identifier combination is invalid for ${dto.scope}`);
    }
  }

  private invalid(message: string): never {
    throw quizBadRequest('QUIZ_SCOPE_INVALID', message);
  }
}
