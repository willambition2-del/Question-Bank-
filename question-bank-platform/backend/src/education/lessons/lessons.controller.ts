import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { LessonsService } from './lessons.service';

@ApiTags('Lessons')
@ApiBearerAuth('access-token')
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  @Get(':lessonId')
  @ApiOperation({ summary: 'Get an active published lesson' })
  @ApiParam({ name: 'lessonId', format: 'uuid' })
  async get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ) {
    return { data: await this.lessons.getPublished(actor.userId, lessonId) };
  }
}
