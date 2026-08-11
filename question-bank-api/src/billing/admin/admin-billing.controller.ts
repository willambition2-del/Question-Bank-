import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma/enums';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { AdminBillingService } from './admin-billing.service';

@ApiTags('Admin Billing')
@ApiBearerAuth('access-token')
@Controller('admin/subscriptions')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class AdminBillingController {
  constructor(private readonly service: AdminBillingService) {}

  @Get()
  async list(@Query() query: PageQueryDto) {
    const result = await this.service.listSubscriptions(query);
    return { data: result.items, meta: result.meta };
  }
}
