import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { contentBadRequest, contentNotFound } from '../content-errors';

export interface QuestionHierarchyInput {
  subjectId: string;
  unitId?: string | null;
  lessonId?: string | null;
  sourceId?: string | null;
  readingPassageId?: string | null;
}

@Injectable()
export class QuestionHierarchyValidator {
  constructor(private readonly prisma: PrismaService) {}

  async validate(
    input: QuestionHierarchyInput,
    requireVisible = false,
  ): Promise<Awaited<ReturnType<QuestionHierarchyValidator['load']>>> {
    if (input.lessonId && !input.unitId) {
      throw this.invalid('lessonId requires unitId');
    }
    const hierarchy = await this.load(input);
    if (!hierarchy.subject) {
      throw contentNotFound('SUBJECT_NOT_FOUND', 'Subject not found');
    }
    if (input.unitId && !hierarchy.unit) {
      throw this.invalid('Unit does not belong to the selected subject');
    }
    if (input.lessonId && !hierarchy.lesson) {
      throw this.invalid(
        'Lesson does not belong to the selected unit and subject',
      );
    }
    if (input.sourceId && !hierarchy.source) {
      throw contentNotFound('SOURCE_NOT_FOUND', 'Source not found');
    }
    if (input.readingPassageId && !hierarchy.readingPassage) {
      throw this.invalid(
        'Reading passage does not belong to the selected subject',
      );
    }
    if (requireVisible && !this.isVisible(hierarchy)) {
      throw contentBadRequest(
        'QUESTION_PARENT_NOT_VISIBLE',
        'Question hierarchy must be active and published before publication',
      );
    }
    return hierarchy;
  }

  async load(input: QuestionHierarchyInput) {
    const [subject, unit, lesson, source, readingPassage] = await Promise.all([
      this.prisma.subject.findFirst({
        where: { id: input.subjectId, deletedAt: null },
        include: { curriculum: true, grade: true },
      }),
      input.unitId
        ? this.prisma.unit.findFirst({
            where: {
              id: input.unitId,
              subjectId: input.subjectId,
              deletedAt: null,
            },
          })
        : null,
      input.lessonId
        ? this.prisma.lesson.findFirst({
            where: {
              id: input.lessonId,
              unitId: input.unitId ?? undefined,
              subjectId: input.subjectId,
              deletedAt: null,
            },
          })
        : null,
      input.sourceId
        ? this.prisma.source.findFirst({
            where: { id: input.sourceId, deletedAt: null },
          })
        : null,
      input.readingPassageId
        ? this.prisma.readingPassage.findFirst({
            where: {
              id: input.readingPassageId,
              subjectId: input.subjectId,
              deletedAt: null,
            },
            include: { source: true },
          })
        : null,
    ]);
    return { subject, unit, lesson, source, readingPassage };
  }

  isVisible(
    hierarchy: Awaited<ReturnType<QuestionHierarchyValidator['load']>>,
  ): boolean {
    const { subject, unit, lesson, source, readingPassage } = hierarchy;
    return Boolean(
      subject?.isActive &&
      subject.isPublished &&
      !subject.deletedAt &&
      subject.curriculum.isActive &&
      !subject.curriculum.deletedAt &&
      subject.grade.isActive &&
      !subject.grade.deletedAt &&
      (!unit || (unit.isActive && unit.isPublished && !unit.deletedAt)) &&
      (!lesson ||
        (lesson.isActive && lesson.isPublished && !lesson.deletedAt)) &&
      (!source || (source.isActive && !source.deletedAt)) &&
      (!readingPassage ||
        (readingPassage.isActive &&
          readingPassage.isPublished &&
          !readingPassage.deletedAt &&
          (!readingPassage.source ||
            (readingPassage.source.isActive &&
              !readingPassage.source.deletedAt)))),
    );
  }

  private invalid(message: string) {
    return contentBadRequest('QUESTION_HIERARCHY_INVALID', message);
  }
}
