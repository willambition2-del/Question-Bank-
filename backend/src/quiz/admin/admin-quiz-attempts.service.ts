import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PageQueryDto } from '../../common/pagination/page-query.dto';

@Injectable()
export class AdminQuizAttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PageQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    
    const [total, items] = await Promise.all([
      this.prisma.quizAttempt.count(),
      this.prisma.quizAttempt.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          subject: { select: { id: true, name: true } },
        }
      })
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    };
  }
}
