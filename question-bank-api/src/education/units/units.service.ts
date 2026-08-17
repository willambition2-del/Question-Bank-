import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { createPageMeta } from '../../common/pagination/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateUnitDto,
  ReorderItemsDto,
  UpdateUnitDto,
} from '../dto/education.dto';
import {
  educationConflict,
  educationNotFound,
  isUniqueConstraintError,
} from '../education-errors';
import { GradeLevel } from '../../generated/prisma/enums';
import { toAdminUnit, toStudentUnit } from '../education.mapper';

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getStudentGradeLevel(userId: string): Promise<GradeLevel> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { gradeLevel: true },
    });
    return user?.gradeLevel ?? GradeLevel.THIRD_SECONDARY;
  }

  async listPublishedBySubject(userId: string, subjectId: string) {
    const userGrade = await this.getStudentGradeLevel(userId);
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: subjectId,
        isActive: true,
        isPublished: true,
        deletedAt: null,
        curriculum: { isActive: true, deletedAt: null },
        grade: { isActive: true, deletedAt: null, code: userGrade },
      },
      select: { id: true },
    });
    if (!subject)
      throw educationNotFound('SUBJECT_NOT_FOUND', 'Subject not found');

    const units = await this.prisma.unit.findMany({
      where: { subjectId, isActive: true, isPublished: true, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            lessons: {
              where: { isActive: true, isPublished: true, deletedAt: null },
            },
            questions: {
              where: { isActive: true, isPublished: true, deletedAt: null },
            },
          },
        },
        studentProgress: { where: { userId }, take: 1 },
      },
    });
    return units.map(toStudentUnit);
  }

  async getPublished(userId: string, id: string) {
    const userGrade = await this.getStudentGradeLevel(userId);
    const unit = await this.prisma.unit.findFirst({
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
      },
      include: {
        _count: {
          select: {
            lessons: {
              where: { isActive: true, isPublished: true, deletedAt: null },
            },
            questions: {
              where: { isActive: true, isPublished: true, deletedAt: null },
            },
          },
        },
        studentProgress: { where: { userId }, take: 1 },
      },
    });
    if (!unit) throw educationNotFound('UNIT_NOT_FOUND', 'Unit not found');
    return toStudentUnit(unit);
  }

  async create(dto: CreateUnitDto) {
    if (dto.isPublished === true && dto.isActive === false) {
      throw this.inactivePublish();
    }
    await this.ensureSubject(dto.subjectId, dto.isPublished === true);
    try {
      return toAdminUnit(await this.prisma.unit.create({ data: dto }));
    } catch (error: unknown) {
      this.throwUnitConflict(error);
      throw error;
    }
  }

  async listAdmin(query: PageQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const [units, totalItems] = await this.prisma.$transaction([
      this.prisma.unit.findMany({
        orderBy: [
          { deletedAt: 'asc' },
          { subjectId: 'asc' },
          { sortOrder: 'asc' },
        ],
        skip,
        take: query.limit,
      }),
      this.prisma.unit.count(),
    ]);
    return {
      items: units.map(toAdminUnit),
      meta: createPageMeta(query.page, query.limit, totalItems),
    };
  }

  async update(id: string, dto: UpdateUnitDto) {
    const current = await this.findRecord(id);
    const subjectId = dto.subjectId ?? current.subjectId;
    const nextActive = dto.isActive ?? current.isActive;
    const nextPublished = dto.isPublished ?? current.isPublished;
    if (nextPublished && (!nextActive || current.deletedAt)) {
      throw this.inactivePublish();
    }
    await this.ensureSubject(subjectId, nextPublished);
    const data = {
      ...dto,
      ...(dto.isActive === false ? { isPublished: false } : {}),
    };
    try {
      return toAdminUnit(
        await this.prisma.unit.update({ where: { id }, data }),
      );
    } catch (error: unknown) {
      this.throwUnitConflict(error);
      throw error;
    }
  }

  async remove(id: string) {
    await this.findRecord(id);
    return toAdminUnit(
      await this.prisma.unit.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false, isPublished: false },
      }),
    );
  }

  async restore(id: string) {
    const unit = await this.findRecord(id);
    await this.ensureSubject(unit.subjectId);
    return toAdminUnit(
      await this.prisma.unit.update({
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
      throw this.invalidReorder('Duplicate unit ids are not allowed');
    }
    const existing = await this.prisma.unit.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, subjectId: true },
    });
    if (existing.length !== ids.length) {
      throw educationNotFound(
        'UNIT_NOT_FOUND',
        'One or more units were not found',
      );
    }
    if (new Set(existing.map((item) => item.subjectId)).size !== 1) {
      throw this.invalidReorder('Units must belong to the same subject');
    }
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.unit.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
    return { reordered: dto.items.length };
  }

  private async setPublished(id: string, isPublished: boolean) {
    const unit = await this.findRecord(id);
    if (isPublished) {
      if (unit.deletedAt || !unit.isActive) throw this.inactivePublish();
      await this.ensureSubject(unit.subjectId, true);
    }
    return toAdminUnit(
      await this.prisma.unit.update({
        where: { id },
        data: { isPublished },
      }),
    );
  }

  private async findRecord(id: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) throw educationNotFound('UNIT_NOT_FOUND', 'Unit not found');
    return unit;
  }

  private async ensureSubject(
    subjectId: string,
    requirePublished = false,
  ): Promise<void> {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: subjectId,
        isActive: true,
        deletedAt: null,
        ...(requirePublished ? { isPublished: true } : {}),
        curriculum: { isActive: true, deletedAt: null },
        grade: { isActive: true, deletedAt: null },
      },
      select: { id: true },
    });
    if (!subject)
      throw educationNotFound('SUBJECT_NOT_FOUND', 'Subject not found');
  }

  private inactivePublish() {
    return new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'UNIT_NOT_ACTIVE',
      message: 'Only a unit under an active published subject can be published',
    });
  }

  private throwUnitConflict(error: unknown): void {
    if (isUniqueConstraintError(error)) {
      throw educationConflict(
        'UNIT_SLUG_EXISTS',
        'Unit slug already exists in this subject',
      );
    }
  }

  private invalidReorder(message: string) {
    return new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'INVALID_UNIT_REORDER',
      message,
    });
  }
}
