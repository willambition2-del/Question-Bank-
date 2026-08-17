import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { createPageMeta } from '../../common/pagination/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateLessonDto,
  ReorderItemsDto,
  UpdateLessonDto,
} from '../dto/education.dto';
import {
  educationConflict,
  educationNotFound,
  isUniqueConstraintError,
} from '../education-errors';
import { GradeLevel } from '../../generated/prisma/enums';
import { toAdminLesson, toStudentLesson } from '../education.mapper';

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getStudentGradeLevel(userId: string): Promise<GradeLevel> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { gradeLevel: true },
    });
    return user?.gradeLevel ?? GradeLevel.THIRD_SECONDARY;
  }

  async listPublishedByUnit(userId: string, unitId: string) {
    const userGrade = await this.getStudentGradeLevel(userId);
    const unit = await this.prisma.unit.findFirst({
      where: {
        id: unitId,
        isActive: true,
        isPublished: true,
        deletedAt: null,
        subject: {
          isActive: true,
          isPublished: true,
          deletedAt: null,
          curriculum: { isActive: true, deletedAt: null },
          grade: { isActive: true, deletedAt: null, code: userGrade },
        },
      },
      select: { id: true },
    });
    if (!unit) throw educationNotFound('UNIT_NOT_FOUND', 'Unit not found');
    const lessons = await this.prisma.lesson.findMany({
      where: { unitId, isActive: true, isPublished: true, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            questions: {
              where: { isActive: true, isPublished: true, deletedAt: null },
            },
          },
        },
        studentProgress: { where: { userId }, take: 1 },
      },
    });
    return lessons.map(toStudentLesson);
  }

  async getPublished(userId: string, id: string) {
    const userGrade = await this.getStudentGradeLevel(userId);
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id,
        isActive: true,
        isPublished: true,
        deletedAt: null,
        subject: {
          isActive: true,
          isPublished: true,
          deletedAt: null,
          curriculum: { isActive: true, deletedAt: null },
          grade: { isActive: true, deletedAt: null, code: userGrade },
        },
        unit: { isActive: true, isPublished: true, deletedAt: null },
      },
      include: {
        _count: {
          select: {
            questions: {
              where: { isActive: true, isPublished: true, deletedAt: null },
            },
          },
        },
        studentProgress: { where: { userId }, take: 1 },
      },
    });
    if (!lesson)
      throw educationNotFound('LESSON_NOT_FOUND', 'Lesson not found');
    return toStudentLesson(lesson);
  }

  async create(dto: CreateLessonDto) {
    if (dto.isPublished === true && dto.isActive === false) {
      throw this.inactivePublish();
    }
    await this.ensureOwnership(
      dto.subjectId,
      dto.unitId,
      dto.isPublished === true,
    );
    try {
      return toAdminLesson(await this.prisma.lesson.create({ data: dto }));
    } catch (error: unknown) {
      this.throwLessonConflict(error);
      throw error;
    }
  }

  async listAdmin(query: PageQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const [lessons, totalItems] = await this.prisma.$transaction([
      this.prisma.lesson.findMany({
        orderBy: [
          { deletedAt: 'asc' },
          { unitId: 'asc' },
          { sortOrder: 'asc' },
        ],
        skip,
        take: query.limit,
      }),
      this.prisma.lesson.count(),
    ]);
    return {
      items: lessons.map(toAdminLesson),
      meta: createPageMeta(query.page, query.limit, totalItems),
    };
  }

  async update(id: string, dto: UpdateLessonDto) {
    const lesson = await this.findRecord(id);
    const subjectId = dto.subjectId ?? lesson.subjectId;
    const unitId = dto.unitId ?? lesson.unitId;
    const nextActive = dto.isActive ?? lesson.isActive;
    const nextPublished = dto.isPublished ?? lesson.isPublished;
    if (nextPublished && (!nextActive || lesson.deletedAt)) {
      throw this.inactivePublish();
    }
    await this.ensureOwnership(subjectId, unitId, nextPublished);
    const data = {
      ...dto,
      ...(dto.isActive === false ? { isPublished: false } : {}),
    };
    try {
      return toAdminLesson(
        await this.prisma.lesson.update({ where: { id }, data }),
      );
    } catch (error: unknown) {
      this.throwLessonConflict(error);
      throw error;
    }
  }

  async remove(id: string) {
    await this.findRecord(id);
    return toAdminLesson(
      await this.prisma.lesson.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false, isPublished: false },
      }),
    );
  }

  async restore(id: string) {
    const lesson = await this.findRecord(id);
    await this.ensureOwnership(lesson.subjectId, lesson.unitId);
    return toAdminLesson(
      await this.prisma.lesson.update({
        where: { id },
        data: { deletedAt: null, isActive: true },
      }),
    );
  }

  publish(id: string) {
    return this.setPublished(id, true);
  }

  unpublish(id: string) {
    return this.setPublished(id, false);
  }

  async reorder(dto: ReorderItemsDto) {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw this.invalidReorder('Duplicate lesson ids are not allowed');
    }
    const existing = await this.prisma.lesson.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, unitId: true },
    });
    if (existing.length !== ids.length) {
      throw educationNotFound(
        'LESSON_NOT_FOUND',
        'One or more lessons were not found',
      );
    }
    if (new Set(existing.map((item) => item.unitId)).size !== 1) {
      throw this.invalidReorder('Lessons must belong to the same unit');
    }
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.lesson.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
    return { reordered: dto.items.length };
  }

  private async setPublished(id: string, isPublished: boolean) {
    const lesson = await this.findRecord(id);
    if (isPublished) {
      if (lesson.deletedAt || !lesson.isActive) throw this.inactivePublish();
      await this.ensureOwnership(lesson.subjectId, lesson.unitId, true);
    }
    return toAdminLesson(
      await this.prisma.lesson.update({
        where: { id },
        data: { isPublished },
      }),
    );
  }

  private async findRecord(id: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id } });
    if (!lesson)
      throw educationNotFound('LESSON_NOT_FOUND', 'Lesson not found');
    return lesson;
  }

  private async ensureOwnership(
    subjectId: string,
    unitId: string,
    requirePublished = false,
  ): Promise<void> {
    const unit = await this.prisma.unit.findFirst({
      where: {
        id: unitId,
        subjectId,
        isActive: true,
        deletedAt: null,
        ...(requirePublished ? { isPublished: true } : {}),
        subject: {
          isActive: true,
          deletedAt: null,
          ...(requirePublished ? { isPublished: true } : {}),
          curriculum: { isActive: true, deletedAt: null },
          grade: { isActive: true, deletedAt: null },
        },
      },
      select: { id: true },
    });
    if (!unit) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'LESSON_UNIT_SUBJECT_MISMATCH',
        message:
          'Unit does not belong to an active subject or cannot be published',
      });
    }
  }

  private inactivePublish() {
    return new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'LESSON_NOT_ACTIVE',
      message: 'Only a lesson under an active published unit can be published',
    });
  }

  private throwLessonConflict(error: unknown): void {
    if (isUniqueConstraintError(error)) {
      throw educationConflict(
        'LESSON_SLUG_EXISTS',
        'Lesson slug already exists in this unit',
      );
    }
  }

  private invalidReorder(message: string) {
    return new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'INVALID_LESSON_REORDER',
      message,
    });
  }
}
