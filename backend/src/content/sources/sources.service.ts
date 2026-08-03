import { Injectable } from '@nestjs/common';
import { createPageMeta } from '../../common/pagination/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { toSource } from '../content.mapper';
import {
  contentBadRequest,
  contentNotFound,
  mapContentPrismaError,
} from '../content-errors';
import { CreateSourceDto, UpdateSourceDto } from '../dto/content.dto';
import { SourceQueryDto } from '../dto/question-bank-query.dto';

@Injectable()
export class SourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(query: SourceQueryDto) {
    const where = {
      isActive: true,
      deletedAt: null,
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.year ? { year: query.year } : {}),
      ...(query.isOfficial !== undefined
        ? { isOfficial: query.isOfficial }
        : {}),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.source.findMany({
        where,
        orderBy: [{ year: 'desc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.source.count({ where }),
    ]);
    return {
      items: items.map(toSource),
      meta: createPageMeta(query.page, query.limit, totalItems),
    };
  }

  async create(dto: CreateSourceDto) {
    this.validateYear(dto.year);
    try {
      return toSource(await this.prisma.source.create({ data: dto }));
    } catch (error) {
      mapContentPrismaError(error, 'SOURCE_CONFLICT');
    }
  }

  async listAdmin(query: SourceQueryDto) {
    const where = {
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.year ? { year: query.year } : {}),
      ...(query.isOfficial !== undefined
        ? { isOfficial: query.isOfficial }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.source.findMany({
        where,
        orderBy: [{ deletedAt: 'asc' }, { year: 'desc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.source.count({ where }),
    ]);
    return {
      items: items.map(toSource),
      meta: createPageMeta(query.page, query.limit, totalItems),
    };
  }

  async get(id: string) {
    return toSource(await this.findRecord(id));
  }

  async update(id: string, dto: UpdateSourceDto) {
    await this.findRecord(id);
    this.validateYear(dto.year);
    try {
      return toSource(
        await this.prisma.source.update({ where: { id }, data: dto }),
      );
    } catch (error) {
      mapContentPrismaError(error, 'SOURCE_NOT_FOUND');
    }
  }

  async remove(id: string) {
    await this.findRecord(id);
    return toSource(
      await this.prisma.source.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      }),
    );
  }

  async restore(id: string) {
    await this.findRecord(id);
    return toSource(
      await this.prisma.source.update({
        where: { id },
        data: { deletedAt: null, isActive: false },
      }),
    );
  }

  private async findRecord(id: string) {
    const source = await this.prisma.source.findUnique({ where: { id } });
    if (!source) throw contentNotFound('SOURCE_NOT_FOUND', 'Source not found');
    return source;
  }

  private validateYear(year?: number): void {
    const maximum = new Date().getUTCFullYear() + 1;
    if (year !== undefined && (year < 1990 || year > maximum)) {
      throw contentBadRequest(
        'SOURCE_YEAR_INVALID',
        'Source year must be between 1990 and next year',
      );
    }
  }
}
