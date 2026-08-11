import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const items = await this.prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });
    return { items };
  }
}
