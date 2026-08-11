import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { contentBadRequest, contentNotFound } from '../content-errors';

@Injectable()
export class ExamModelHierarchyValidator {
  constructor(private readonly prisma: PrismaService) {}

  async validate(
    subjectId: string,
    sourceId?: string | null,
    requireVisible = false,
  ) {
    const hierarchy = await this.load(subjectId, sourceId);
    if (!hierarchy.subject) {
      throw contentNotFound(
        'EXAM_MODEL_SUBJECT_NOT_FOUND',
        'Exam model subject not found',
      );
    }
    if (sourceId && !hierarchy.source) {
      throw contentNotFound(
        'EXAM_MODEL_SOURCE_NOT_FOUND',
        'Exam model source not found',
      );
    }
    if (requireVisible && !this.isVisible(hierarchy)) {
      throw contentBadRequest(
        'EXAM_MODEL_PARENT_NOT_VISIBLE',
        'Exam model subject hierarchy and source must be visible',
      );
    }
    return hierarchy;
  }

  async load(subjectId: string, sourceId?: string | null) {
    const [subject, source] = await Promise.all([
      this.prisma.subject.findFirst({
        where: { id: subjectId, deletedAt: null },
        include: { curriculum: true, grade: true },
      }),
      sourceId
        ? this.prisma.source.findFirst({
            where: { id: sourceId, deletedAt: null },
          })
        : null,
    ]);
    return { subject, source };
  }

  isVisible(
    hierarchy: Awaited<ReturnType<ExamModelHierarchyValidator['load']>>,
  ) {
    const { subject, source } = hierarchy;
    return Boolean(
      subject?.isActive &&
      subject.isPublished &&
      !subject.deletedAt &&
      subject.curriculum.isActive &&
      !subject.curriculum.deletedAt &&
      subject.grade.isActive &&
      !subject.grade.deletedAt &&
      (!source || (source.isActive && !source.deletedAt)),
    );
  }
}
