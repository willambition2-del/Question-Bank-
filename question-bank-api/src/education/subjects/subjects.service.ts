import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { createPageMeta } from '../../common/pagination/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSubjectDto,
  SubjectQueryDto,
  SubjectSort,
  UpdateSubjectDto,
} from '../dto/education.dto';
import {
  educationConflict,
  educationNotFound,
  isUniqueConstraintError,
} from '../education-errors';
import { toAdminSubject, toStudentSubject } from '../education.mapper';

import { GradeLevel } from '../../generated/prisma/enums';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getStudentGradeLevel(userId: string): Promise<GradeLevel> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { gradeLevel: true, role: true },
    });
    return user?.gradeLevel ?? GradeLevel.THIRD_SECONDARY;
  }

  async listPublished(userId: string, query: SubjectQueryDto) {
    const userGrade = await this.getStudentGradeLevel(userId);
    const where = {
      isActive: true,
      isPublished: true,
      deletedAt: null,
      curriculum: { isActive: true, deletedAt: null },
      grade: { isActive: true, deletedAt: null, code: userGrade },
      ...(query.favorite === true ? { favoritedBy: { some: { userId } } } : {}),
      ...(query.search
        ? {
            OR: [
              {
                name: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                slug: { contains: query.search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };
    const subjects = await this.prisma.subject.findMany({
      where,
      include: {
        _count: {
          select: {
            units: {
              where: { isActive: true, isPublished: true, deletedAt: null },
            },
            lessons: {
              where: { isActive: true, isPublished: true, deletedAt: null },
            },
            questions: {
              where: { isActive: true, isPublished: true, deletedAt: null },
            },
          },
        },
        studentProgress: { where: { userId }, take: 1 },
        favoritedBy: { where: { userId }, select: { id: true }, take: 1 },
      },
    });
    const items = subjects.map(toStudentSubject);
    this.sortStudentSubjects(items, query.sort);
    const totalItems = items.length;
    const offset = (query.page - 1) * query.limit;
    return {
      items: items.slice(offset, offset + query.limit),
      meta: createPageMeta(query.page, query.limit, totalItems),
    };
  }

  async getPublished(userId: string, id: string) {
    const userGrade = await this.getStudentGradeLevel(userId);
    const subject = await this.prisma.subject.findFirst({
      where: {
        id,
        isActive: true,
        isPublished: true,
        deletedAt: null,
        curriculum: { isActive: true, deletedAt: null },
        grade: { isActive: true, deletedAt: null, code: userGrade },
      },
      include: {
        _count: {
          select: {
            units: {
              where: { isActive: true, isPublished: true, deletedAt: null },
            },
            lessons: {
              where: { isActive: true, isPublished: true, deletedAt: null },
            },
            questions: {
              where: { isActive: true, isPublished: true, deletedAt: null },
            },
          },
        },
        studentProgress: { where: { userId }, take: 1 },
        favoritedBy: { where: { userId }, select: { id: true }, take: 1 },
      },
    });
    if (!subject) {
      throw educationNotFound('SUBJECT_NOT_FOUND', 'Subject not found');
    }
    return toStudentSubject(subject);
  }

  async favorite(userId: string, subjectId: string) {
    await this.getPublished(userId, subjectId);
    await this.prisma.userSubjectFavorite.upsert({
      where: { userId_subjectId: { userId, subjectId } },
      update: {},
      create: { userId, subjectId },
    });
    return { subjectId, isFavorite: true };
  }

  async unfavorite(userId: string, subjectId: string) {
    await this.prisma.userSubjectFavorite.deleteMany({
      where: { userId, subjectId },
    });
    return { subjectId, isFavorite: false };
  }

  async create(dto: CreateSubjectDto) {
    if (dto.isPublished === true && dto.isActive === false) {
      throw this.inactivePublish();
    }
    await this.ensureEducationContext(dto.curriculumId, dto.gradeId);
    try {
      const [, subject] = await this.prisma.$transaction([
        this.prisma.curriculumGrade.upsert({
          where: {
            curriculumId_gradeId: {
              curriculumId: dto.curriculumId,
              gradeId: dto.gradeId,
            },
          },
          update: { isActive: true },
          create: {
            curriculumId: dto.curriculumId,
            gradeId: dto.gradeId,
            isActive: true,
          },
        }),
        this.prisma.subject.create({ data: dto }),
      ]);
      return toAdminSubject(subject);
    } catch (error: unknown) {
      this.throwSubjectConflict(error);
      throw error;
    }
  }

  async listAdmin(query: SubjectQueryDto) {
    const where = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { slug: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const skip = (query.page - 1) * query.limit;
    const [subjects, totalItems] = await this.prisma.$transaction([
      this.prisma.subject.findMany({
        where,
        orderBy: [{ deletedAt: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.subject.count({ where }),
    ]);
    return {
      items: subjects.map(toAdminSubject),
      meta: createPageMeta(query.page, query.limit, totalItems),
    };
  }

  async getAdmin(id: string) {
    return toAdminSubject(await this.findRecord(id));
  }

  async update(id: string, dto: UpdateSubjectDto) {
    const current = await this.findRecord(id);
    const curriculumId = dto.curriculumId ?? current.curriculumId;
    const gradeId = dto.gradeId ?? current.gradeId;
    await this.ensureEducationContext(curriculumId, gradeId);
    const nextActive = dto.isActive ?? current.isActive;
    const nextPublished = dto.isPublished ?? current.isPublished;
    if (nextPublished && (!nextActive || current.deletedAt)) {
      throw this.inactivePublish();
    }
    const data = {
      ...dto,
      ...(dto.isActive === false ? { isPublished: false } : {}),
    };
    try {
      const [, subject] = await this.prisma.$transaction([
        this.prisma.curriculumGrade.upsert({
          where: { curriculumId_gradeId: { curriculumId, gradeId } },
          update: { isActive: true },
          create: { curriculumId, gradeId, isActive: true },
        }),
        this.prisma.subject.update({ where: { id }, data }),
      ]);
      return toAdminSubject(subject);
    } catch (error: unknown) {
      this.throwSubjectConflict(error);
      throw error;
    }
  }

  async remove(id: string) {
    await this.findRecord(id);
    return toAdminSubject(
      await this.prisma.subject.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false, isPublished: false },
      }),
    );
  }

  async restore(id: string) {
    const subject = await this.findRecord(id);
    await this.ensureEducationContext(subject.curriculumId, subject.gradeId);
    return toAdminSubject(
      await this.prisma.subject.update({
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

  private async setPublished(id: string, isPublished: boolean) {
    const subject = await this.findRecord(id);
    if (isPublished) {
      if (subject.deletedAt || !subject.isActive) throw this.inactivePublish();
      await this.ensureEducationContext(subject.curriculumId, subject.gradeId);
    }
    return toAdminSubject(
      await this.prisma.subject.update({
        where: { id },
        data: { isPublished },
      }),
    );
  }

  private async findRecord(id: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id } });
    if (!subject) {
      throw educationNotFound('SUBJECT_NOT_FOUND', 'Subject not found');
    }
    return subject;
  }

  private async ensureEducationContext(curriculumId: string, gradeId: string) {
    const [curriculum, grade] = await Promise.all([
      this.prisma.curriculum.findFirst({
        where: { id: curriculumId, isActive: true, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.grade.findFirst({
        where: { id: gradeId, isActive: true, deletedAt: null },
        select: { id: true },
      }),
    ]);
    if (!curriculum) {
      throw educationNotFound('CURRICULUM_NOT_FOUND', 'Curriculum not found');
    }
    if (!grade) throw educationNotFound('GRADE_NOT_FOUND', 'Grade not found');
  }

  private sortStudentSubjects(
    items: Array<ReturnType<typeof toStudentSubject>>,
    sort: SubjectSort,
  ): void {
    const byName = (
      left: (typeof items)[number],
      right: (typeof items)[number],
    ) => left.name.localeCompare(right.name);
    items.sort((left, right) => {
      if (sort === SubjectSort.NAME) return byName(left, right);
      if (sort === SubjectSort.QUESTIONS_DESC) {
        return (
          right.questionsCount - left.questionsCount || byName(left, right)
        );
      }
      if (sort === SubjectSort.PROGRESS_DESC) {
        return (
          right.progress.masteryPercent - left.progress.masteryPercent ||
          byName(left, right)
        );
      }
      if (sort === SubjectSort.PROGRESS_ASC) {
        return (
          left.progress.masteryPercent - right.progress.masteryPercent ||
          byName(left, right)
        );
      }
      if (sort === SubjectSort.RECENT_ACTIVITY) {
        return (
          (right.progress.lastActivityAt?.getTime() ?? 0) -
            (left.progress.lastActivityAt?.getTime() ?? 0) ||
          byName(left, right)
        );
      }
      return left.sortOrder - right.sortOrder || byName(left, right);
    });
  }

  private inactivePublish() {
    return new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'SUBJECT_NOT_ACTIVE',
      message:
        'Only a subject with an active curriculum and grade can be published',
    });
  }

  private throwSubjectConflict(error: unknown): void {
    if (isUniqueConstraintError(error)) {
      throw educationConflict(
        'SUBJECT_SLUG_EXISTS',
        'Subject slug already exists in this curriculum and grade',
      );
    }
  }
}
