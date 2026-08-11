import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma/enums';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { AdminAnnouncementsService } from './admin-announcements.service';

@ApiTags('Admin Announcements')
@ApiBearerAuth('access-token')
@Controller('admin/announcements')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class AdminAnnouncementsController {
  constructor(private readonly service: AdminAnnouncementsService) {}

  @Get()
  async list(@Query() query: PageQueryDto) {
    const result = await this.service.list(query);
    return { data: result.items, meta: result.meta };
  }
}
