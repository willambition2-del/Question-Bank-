import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { RegisterPushDeviceDto } from './dto/push-device.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: NotificationQueryDto,
  ) {
    const result = await this.notifications.list(actor.userId, query);
    return { data: result.items, meta: result.meta };
  }

  @Get('unread-count')
  async unread(@CurrentUser() actor: AuthenticatedUser) {
    return {
      data: { count: await this.notifications.countUnread(actor.userId) },
    };
  }

  @Post('devices')
  async registerDevice(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: RegisterPushDeviceDto,
  ) {
    return {
      data: await this.notifications.registerDevice(actor.userId, dto),
    };
  }

  @Delete('devices/:id')
  async removeDevice(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return {
      data: await this.notifications.removeDevice(actor.userId, id),
    };
  }

  @Patch('read-all')
  async readAll(@CurrentUser() actor: AuthenticatedUser) {
    return { data: await this.notifications.readAll(actor.userId) };
  }

  @Post('read-all')
  async readAllLegacy(@CurrentUser() actor: AuthenticatedUser) {
    return this.readAll(actor);
  }

  @Patch(':id/read')
  async read(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.notifications.read(actor.userId, id) };
  }

  @Post(':id/read')
  async readLegacy(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.read(actor, id);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.notifications.remove(actor.userId, id) };
  }
}
