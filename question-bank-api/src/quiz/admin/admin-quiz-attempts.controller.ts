import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma/enums';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { AdminQuizAttemptsService } from './admin-quiz-attempts.service';

@ApiTags('Admin Quiz Attempts')
@ApiBearerAuth('access-token')
@Controller('admin/quiz-attempts')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class AdminQuizAttemptsController {
  constructor(private readonly service: AdminQuizAttemptsService) {}

  @Get()
  async list(@Query() query: PageQueryDto) {
    const result = await this.service.list(query);
    return { data: result.items, meta: result.meta };
  }
}
