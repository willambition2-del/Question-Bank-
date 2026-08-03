import { Injectable } from '@nestjs/common';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { createPageMeta } from '../../common/pagination/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGradeDto, UpdateGradeDto } from '../dto/education.dto';
import {
  educationConflict,
  educationNotFound,
  isUniqueConstraintError,
} from '../education-errors';
import { toGrade } from '../education.mapper';

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGradeDto) {
    const duplicateName = await this.prisma.grade.findFirst({
      where: {
        name: { equals: dto.name, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (duplicateName) {
      throw educationConflict('GRADE_NAME_EXISTS', 'Grade name already exists');
    }

    try {
      return toGrade(await this.prisma.grade.create({ data: dto }));
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw educationConflict(
          'GRADE_SLUG_EXISTS',
          'Grade slug already exists',
        );
      }
      throw error;
    }
  }

  async list(query: PageQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.grade.findMany({
        orderBy: [{ deletedAt: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.grade.count(),
    ]);
    return {
      items: items.map(toGrade),
      meta: createPageMeta(query.page, query.limit, totalItems),
    };
  }

  async get(id: string) {
    const grade = await this.prisma.grade.findUnique({ where: { id } });
    if (!grade) throw educationNotFound('GRADE_NOT_FOUND', 'Grade not found');
    return toGrade(grade);
  }

  async update(id: string, dto: UpdateGradeDto) {
    await this.get(id);
    if (dto.name) {
      const duplicate = await this.prisma.grade.findFirst({
        where: {
          id: { not: id },
          name: { equals: dto.name, mode: 'insensitive' },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (duplicate) {
        throw educationConflict(
          'GRADE_NAME_EXISTS',
          'Grade name already exists',
        );
      }
    }
    try {
      return toGrade(
        await this.prisma.grade.update({ where: { id }, data: dto }),
      );
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw educationConflict(
          'GRADE_SLUG_EXISTS',
          'Grade slug already exists',
        );
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.get(id);
    return toGrade(
      await this.prisma.grade.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      }),
    );
  }

  async restore(id: string) {
    await this.get(id);
    return toGrade(
      await this.prisma.grade.update({
        where: { id },
        data: { deletedAt: null, isActive: true },
      }),
    );
  }
}
