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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma/enums';
import { CreateSourceDto, UpdateSourceDto } from '../dto/content.dto';
import { SourceQueryDto } from '../dto/question-bank-query.dto';
import { SourcesService } from './sources.service';

@ApiTags('Sources')
@ApiBearerAuth('access-token')
@Controller('sources')
export class SourcesController {
  constructor(private readonly sources: SourcesService) {}

  @Get()
  @ApiOperation({ summary: 'List active question sources' })
  async list(@Query() query: SourceQueryDto) {
    const result = await this.sources.listPublished(query);
    return { data: result.items, meta: result.meta };
  }
}

@ApiTags('Sources')
@ApiBearerAuth('access-token')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/sources')
export class SourcesAdminController {
  constructor(private readonly sources: SourcesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a question source' })
  async create(@Body() dto: CreateSourceDto) {
    return { data: await this.sources.create(dto) };
  }

  @Get()
  @ApiOperation({ summary: 'List sources for administration' })
  async list(@Query() query: SourceQueryDto) {
    const result = await this.sources.listAdmin(query);
    return { data: result.items, meta: result.meta };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a source for administration' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.sources.get(id) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a source' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSourceDto,
  ) {
    return { data: await this.sources.update(id, dto) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a source' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.sources.remove(id) };
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted source' })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.sources.restore(id) };
  }
}
