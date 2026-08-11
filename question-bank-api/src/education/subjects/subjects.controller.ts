import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { SubjectQueryDto } from '../dto/education.dto';
import { UnitsService } from '../units/units.service';
import { SubjectsService } from './subjects.service';

@ApiTags('Subjects')
@ApiBearerAuth('access-token')
@Controller('subjects')
export class SubjectsController {
  constructor(
    private readonly subjects: SubjectsService,
    private readonly units: UnitsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List active published subjects' })
  @ApiOkResponse({ description: 'A paginated list of subjects.' })
  async list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: SubjectQueryDto,
  ) {
    const result = await this.subjects.listPublished(actor.userId, query);
    return { data: result.items, meta: result.meta };
  }

  @Get(':subjectId')
  @ApiOperation({ summary: 'Get an active published subject' })
  @ApiParam({ name: 'subjectId', format: 'uuid' })
  @ApiOkResponse({ description: 'The requested subject.' })
  @ApiNotFoundResponse({ description: 'Subject not found.' })
  async get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
  ) {
    return {
      data: await this.subjects.getPublished(actor.userId, subjectId),
    };
  }

  @Get(':subjectId/units')
  @ApiOperation({ summary: 'List active published units for a subject' })
  @ApiParam({ name: 'subjectId', format: 'uuid' })
  async listUnits(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
  ) {
    return {
      data: await this.units.listPublishedBySubject(actor.userId, subjectId),
    };
  }

  @Post(':subjectId/favorite')
  @ApiOperation({
    summary: 'Add a published subject to the current user favorites',
  })
  async favorite(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
  ) {
    return { data: await this.subjects.favorite(actor.userId, subjectId) };
  }

  @Delete(':subjectId/favorite')
  @ApiOperation({ summary: 'Remove a subject from the current user favorites' })
  async unfavorite(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
  ) {
    return { data: await this.subjects.unfavorite(actor.userId, subjectId) };
  }
}
