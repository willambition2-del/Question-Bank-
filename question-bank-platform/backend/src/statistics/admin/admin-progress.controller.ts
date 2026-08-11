import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma/enums';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { AdminProgressService } from './admin-progress.service';

@ApiTags('Admin Progress')
@ApiBearerAuth('access-token')
@Controller('admin/student-progress')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class AdminProgressController {
  constructor(private readonly service: AdminProgressService) {}

  @Get()
  async list(@Query() query: PageQueryDto) {
    const result = await this.service.list(query);
    return { data: result.items, meta: result.meta };
  }
}
