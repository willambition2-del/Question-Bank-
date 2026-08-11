import { Injectable } from '@nestjs/common';
import { createPageMeta } from '../../common/pagination/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { toAdminReadingPassage } from '../content.mapper';
import {
  contentBadRequest,
  contentNotFound,
  mapContentPrismaError,
} from '../content-errors';
import {
  CreateReadingPassageDto,
  UpdateReadingPassageDto,
} from '../dto/content.dto';
import { ReadingPassageQueryDto } from '../dto/question-bank-query.dto';

@Injectable()
export class ReadingPassagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actorId: string, dto: CreateReadingPassageDto) {
    await this.ensureRelations(dto.subjectId, dto.sourceId);
    try {
      return toAdminReadingPassage(
        await this.prisma.readingPassage.create({
          data: { ...dto, isPublished: false, createdById: actorId },
        }),
      );
    } catch (error) {
      mapContentPrismaError(error, 'READING_PASSAGE_CONFLICT');
    }
  }

  async list(query: ReadingPassageQueryDto) {
    const where = {
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.sourceId ? { sourceId: query.sourceId } : {}),
      ...(query.isPublished !== undefined
        ? { isPublished: query.isPublished }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              {
                title: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                passageText: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.readingPassage.findMany({
        where,
        orderBy: [{ deletedAt: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.readingPassage.count({ where }),
    ]);
    return {
      items: items.map(toAdminReadingPassage),
      meta: createPageMeta(query.page, query.limit, totalItems),
    };
  }

  async get(id: string) {
    return toAdminReadingPassage(await this.findRecord(id));
  }

  async update(id: string, dto: UpdateReadingPassageDto) {
    const current = await this.findRecord(id);
    await this.ensureRelations(
      dto.subjectId ?? current.subjectId,
      dto.sourceId === undefined
        ? (current.sourceId ?? undefined)
        : dto.sourceId,
    );
    try {
      return toAdminReadingPassage(
        await this.prisma.readingPassage.update({
          where: { id },
          data: { ...dto, isPublished: false },
        }),
      );
    } catch (error) {
      mapContentPrismaError(error, 'READING_PASSAGE_NOT_FOUND');
    }
  }

  async remove(id: string) {
    await this.findRecord(id);
    return toAdminReadingPassage(
      await this.prisma.readingPassage.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false, isPublished: false },
      }),
    );
  }

  async restore(id: string) {
    const passage = await this.findRecord(id);
    await this.ensureRelations(
      passage.subjectId,
      passage.sourceId ?? undefined,
    );
    return toAdminReadingPassage(
      await this.prisma.readingPassage.update({
        where: { id },
        data: { deletedAt: null, isActive: false, isPublished: false },
      }),
    );
  }

  async publish(id: string, actorId: string) {
    const passage = await this.findRecord(id);
    if (passage.deletedAt || !passage.isActive) {
      throw contentBadRequest(
        'READING_PASSAGE_NOT_ACTIVE',
        'Only an active passage can be published',
      );
    }
    const { subject, source } = await this.ensureRelations(
      passage.subjectId,
      passage.sourceId ?? undefined,
      true,
    );
    if (
      !subject.isPublished ||
      !subject.curriculum.isActive ||
      subject.curriculum.deletedAt ||
      !subject.grade.isActive ||
      subject.grade.deletedAt ||
      (source && !source.isActive)
    ) {
      throw contentBadRequest(
        'QUESTION_PARENT_NOT_VISIBLE',
        'Passage subject and source must be visible before publication',
      );
    }
    return toAdminReadingPassage(
      await this.prisma.readingPassage.update({
        where: { id },
        data: { isPublished: true, reviewedById: actorId },
      }),
    );
  }

  async unpublish(id: string) {
    await this.findRecord(id);
    return toAdminReadingPassage(
      await this.prisma.readingPassage.update({
        where: { id },
        data: { isPublished: false },
      }),
    );
  }

  private async findRecord(id: string) {
    const passage = await this.prisma.readingPassage.findUnique({
      where: { id },
    });
    if (!passage) {
      throw contentNotFound(
        'READING_PASSAGE_NOT_FOUND',
        'Reading passage not found',
      );
    }
    return passage;
  }

  private async ensureRelations(
    subjectId: string,
    sourceId?: string,
    requireActive = false,
  ) {
    const [subject, source] = await Promise.all([
      this.prisma.subject.findFirst({
        where: {
          id: subjectId,
          deletedAt: null,
          ...(requireActive ? { isActive: true } : {}),
        },
        include: { curriculum: true, grade: true },
      }),
      sourceId
        ? this.prisma.source.findFirst({
            where: {
              id: sourceId,
              deletedAt: null,
              ...(requireActive ? { isActive: true } : {}),
            },
          })
        : null,
    ]);
    if (!subject) {
      throw contentNotFound('SUBJECT_NOT_FOUND', 'Subject not found');
    }
    if (sourceId && !source) {
      throw contentNotFound('SOURCE_NOT_FOUND', 'Source not found');
    }
    return { subject, source };
  }
}
