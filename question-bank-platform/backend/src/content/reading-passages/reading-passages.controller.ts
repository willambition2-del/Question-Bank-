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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UserRole } from '../../generated/prisma/enums';
import {
  CreateReadingPassageDto,
  UpdateReadingPassageDto,
} from '../dto/content.dto';
import { ReadingPassageQueryDto } from '../dto/question-bank-query.dto';
import { ReadingPassagesService } from './reading-passages.service';

@ApiTags('Reading Passages', 'Admin Content')
@ApiBearerAuth('access-token')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/reading-passages')
export class ReadingPassagesController {
  constructor(private readonly passages: ReadingPassagesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a reusable reading passage' })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateReadingPassageDto,
  ) {
    return { data: await this.passages.create(actor.userId, dto) };
  }

  @Get()
  @ApiOperation({ summary: 'List reading passages for administration' })
  async list(@Query() query: ReadingPassageQueryDto) {
    const result = await this.passages.list(query);
    return { data: result.items, meta: result.meta };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a reading passage' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.passages.get(id) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a reading passage' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReadingPassageDto,
  ) {
    return { data: await this.passages.update(id, dto) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a reading passage' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.passages.remove(id) };
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted reading passage' })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.passages.restore(id) };
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish a reading passage' })
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return { data: await this.passages.publish(id, actor.userId) };
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish a reading passage' })
  async unpublish(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.passages.unpublish(id) };
  }
}
