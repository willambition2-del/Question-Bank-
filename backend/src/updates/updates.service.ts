import { Injectable } from '@nestjs/common';
import { createPageMeta } from '../common/pagination/pagination';
import { PageQueryDto } from '../common/pagination/page-query.dto';
import { educationNotFound } from '../education/education-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppUpdateDto, UpdateAppUpdateDto } from './dto/update.dto';

const updateSelect = {
  id: true,
  title: true,
  body: true,
  category: true,
  imageUrl: true,
  actionType: true,
  actionValue: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UpdatesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(query: PageQueryDto) {
    const where = { isPublished: true, deletedAt: null };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.appUpdate.findMany({
        where,
        select: updateSelect,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.appUpdate.count({ where }),
    ]);
    return { items, meta: createPageMeta(query.page, query.limit, totalItems) };
  }

  async getPublished(id: string) {
    const item = await this.prisma.appUpdate.findFirst({
      where: { id, isPublished: true, deletedAt: null },
      select: updateSelect,
    });
    if (!item) throw educationNotFound('UPDATE_NOT_FOUND', 'Update not found');
    return item;
  }

  async listAdmin(query: PageQueryDto) {
    const where = { deletedAt: null };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.appUpdate.findMany({
        where,
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.appUpdate.count({ where }),
    ]);
    return { items, meta: createPageMeta(query.page, query.limit, totalItems) };
  }

  create(createdById: string, dto: CreateAppUpdateDto) {
    const published = dto.isPublished === true;
    return this.prisma.appUpdate.create({
      data: {
        ...dto,
        createdById,
        isPublished: published,
        publishedAt: published ? new Date() : null,
      },
    });
  }

  async update(id: string, dto: UpdateAppUpdateDto) {
    await this.requireAdmin(id);
    return this.prisma.appUpdate.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.isPublished === undefined
          ? {}
          : { publishedAt: dto.isPublished ? new Date() : null }),
      },
    });
  }

  async publish(id: string, published: boolean) {
    await this.requireAdmin(id);
    return this.prisma.appUpdate.update({
      where: { id },
      data: {
        isPublished: published,
        publishedAt: published ? new Date() : null,
      },
    });
  }

  async remove(id: string) {
    await this.requireAdmin(id);
    return this.prisma.appUpdate.update({
      where: { id },
      data: { deletedAt: new Date(), isPublished: false, publishedAt: null },
    });
  }

  private async requireAdmin(id: string) {
    const item = await this.prisma.appUpdate.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!item) throw educationNotFound('UPDATE_NOT_FOUND', 'Update not found');
    return item;
  }
}
