import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma/enums';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { AdminUsersService } from './admin-users.service';

@ApiTags('Admin Users')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({ description: 'Administrator role is required.' })
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users with pagination' })
  async listUsers(@Query() query: AdminUsersQueryDto) {
    const result = await this.adminUsers.list(query);
    return { data: result.items, meta: result.meta };
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Change user role' })
  async changeRole(
    @Param('id') id: string,
    @Body('role') role: UserRole,
  ) {
    return { data: await this.adminUsers.changeRole(id, role) };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change user active status' })
  async changeStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return { data: await this.adminUsers.changeStatus(id, isActive) };
  }
}
