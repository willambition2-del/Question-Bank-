import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma/enums';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { AdminSupportService } from './admin-support.service';

@ApiTags('Admin Support')
@ApiBearerAuth('access-token')
@Controller('admin/support-tickets')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class AdminSupportController {
  constructor(private readonly service: AdminSupportService) {}

  @Get()
  async list(@Query() query: PageQueryDto) {
    const result = await this.service.list(query);
    return { data: result.items, meta: result.meta };
  }
}
