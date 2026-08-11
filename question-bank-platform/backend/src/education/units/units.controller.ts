import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { LessonsService } from '../lessons/lessons.service';
import { UnitsService } from './units.service';

@ApiTags('Units')
@ApiBearerAuth('access-token')
@Controller('units')
export class UnitsController {
  constructor(
    private readonly units: UnitsService,
    private readonly lessons: LessonsService,
  ) {}

  @Get(':unitId')
  @ApiOperation({ summary: 'Get an active published unit' })
  @ApiParam({ name: 'unitId', format: 'uuid' })
  async get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('unitId', ParseUUIDPipe) unitId: string,
  ) {
    return { data: await this.units.getPublished(actor.userId, unitId) };
  }

  @Get(':unitId/lessons')
  @ApiOperation({ summary: 'List active published lessons for a unit' })
  @ApiParam({ name: 'unitId', format: 'uuid' })
  async listLessons(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('unitId', ParseUUIDPipe) unitId: string,
  ) {
    return {
      data: await this.lessons.listPublishedByUnit(actor.userId, unitId),
    };
  }
}
