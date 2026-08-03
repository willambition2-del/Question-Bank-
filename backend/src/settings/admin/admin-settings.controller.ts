import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma/enums';
import { AdminSettingsService } from './admin-settings.service';

@ApiTags('Admin Settings')
@ApiBearerAuth('access-token')
@Controller('admin/settings')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class AdminSettingsController {
  constructor(private readonly service: AdminSettingsService) {}

  @Get()
  async list() {
    const result = await this.service.list();
    return { data: result.items };
  }
}
