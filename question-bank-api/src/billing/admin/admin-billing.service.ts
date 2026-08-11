import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PageQueryDto } from '../../common/pagination/page-query.dto';

@Injectable()
export class AdminBillingService {
  constructor(private readonly prisma: PrismaService) {}

  async listSubscriptions(query: PageQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    
    const [total, items] = await Promise.all([
      this.prisma.userSubscription.count(),
      this.prisma.userSubscription.findMany({
        skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } }
      })
    ]);
    return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
