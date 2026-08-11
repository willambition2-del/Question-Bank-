import { Injectable } from '@nestjs/common';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { createPageMeta } from '../../common/pagination/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCurriculumDto, UpdateCurriculumDto } from '../dto/education.dto';
import {
  educationConflict,
  educationNotFound,
  isUniqueConstraintError,
} from '../education-errors';
import { toCurriculum } from '../education.mapper';

@Injectable()
export class CurriculaService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCurriculumDto) {
    try {
      return toCurriculum(await this.prisma.curriculum.create({ data: dto }));
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw educationConflict(
          'CURRICULUM_SLUG_EXISTS',
          'Curriculum slug already exists',
        );
      }
      throw error;
    }
  }

  async list(query: PageQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.curriculum.findMany({
        orderBy: [{ deletedAt: 'asc' }, { name: 'asc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.curriculum.count(),
    ]);
    return {
      items: items.map(toCurriculum),
      meta: createPageMeta(query.page, query.limit, totalItems),
    };
  }

  async get(id: string) {
    const curriculum = await this.prisma.curriculum.findUnique({
      where: { id },
    });
    if (!curriculum) {
      throw educationNotFound('CURRICULUM_NOT_FOUND', 'Curriculum not found');
    }
    return toCurriculum(curriculum);
  }

  async update(id: string, dto: UpdateCurriculumDto) {
    await this.get(id);
    try {
      return toCurriculum(
        await this.prisma.curriculum.update({ where: { id }, data: dto }),
      );
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw educationConflict(
          'CURRICULUM_SLUG_EXISTS',
          'Curriculum slug already exists',
        );
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.get(id);
    return toCurriculum(
      await this.prisma.curriculum.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      }),
    );
  }

  async restore(id: string) {
    await this.get(id);
    return toCurriculum(
      await this.prisma.curriculum.update({
        where: { id },
        data: { deletedAt: null, isActive: true },
      }),
    );
  }
}
