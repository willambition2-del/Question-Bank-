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
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PageQueryDto } from '../common/pagination/page-query.dto';
import { UserRole } from '../generated/prisma/enums';
import { CreateAppUpdateDto, UpdateAppUpdateDto } from './dto/update.dto';
import { UpdatesService } from './updates.service';

@ApiTags('Updates')
@ApiBearerAuth('access-token')
@Controller('updates')
export class UpdatesController {
  constructor(private readonly updates: UpdatesService) {}

  @Get()
  async list(@Query() query: PageQueryDto) {
    const result = await this.updates.listPublished(query);
    return { data: result.items, meta: result.meta };
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.updates.getPublished(id) };
  }
}

@ApiTags('Updates Admin')
@ApiBearerAuth('access-token')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/updates')
export class UpdatesAdminController {
  constructor(private readonly updates: UpdatesService) {}

  @Get()
  async list(@Query() query: PageQueryDto) {
    const result = await this.updates.listAdmin(query);
    return { data: result.items, meta: result.meta };
  }

  @Post()
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateAppUpdateDto,
  ) {
    return { data: await this.updates.create(actor.userId, dto) };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppUpdateDto,
  ) {
    return { data: await this.updates.update(id, dto) };
  }

  @Post(':id/publish')
  async publish(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.updates.publish(id, true) };
  }

  @Post(':id/unpublish')
  async unpublish(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.updates.publish(id, false) };
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.updates.remove(id) };
  }
}
