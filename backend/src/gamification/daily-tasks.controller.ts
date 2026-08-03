import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { DailyTasksService } from './daily-tasks.service';

@ApiTags('Daily Tasks')
@ApiBearerAuth('access-token')
@Controller('daily-tasks')
export class DailyTasksController {
  constructor(private readonly tasks: DailyTasksService) {}

  @Get('today')
  async today(@CurrentUser() actor: AuthenticatedUser) {
    return { data: await this.tasks.today(actor.userId) };
  }

  @Post(':id/claim')
  async claim(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.tasks.claim(actor.userId, id) };
  }
}
