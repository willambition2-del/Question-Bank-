import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { educationNotFound } from './education-errors';

@Injectable()
export class EducationContextService {
  constructor(private readonly prisma: PrismaService) {}

  async getDefaultContext() {
    const links = await this.prisma.curriculumGrade.findMany({
      where: {
        isActive: true,
        curriculum: { isActive: true, deletedAt: null },
        grade: { isActive: true, deletedAt: null },
      },
      include: { curriculum: true, grade: true },
    });
    const link = links.sort(
      (left, right) => left.grade.sortOrder - right.grade.sortOrder,
    )[0];
    if (!link) {
      throw educationNotFound(
        'EDUCATION_CONTEXT_NOT_FOUND',
        'No active education context is configured',
      );
    }

    return {
      grade: {
        id: link.grade.id,
        name: link.grade.name,
        slug: link.grade.slug,
      },
      curriculum: {
        id: link.curriculum.id,
        name: link.curriculum.name,
        slug: link.curriculum.slug,
        academicYear: link.curriculum.academicYear,
      },
      countryCode: link.curriculum.countryCode,
    };
  }
}
