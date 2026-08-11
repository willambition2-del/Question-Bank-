import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AchievementsService } from './achievements.service';

@ApiTags('Achievements')
@ApiBearerAuth('access-token')
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get()
  async list(@CurrentUser() actor: AuthenticatedUser) {
    return { data: await this.achievements.list(actor.userId) };
  }

  @Get('my')
  async my(@CurrentUser() actor: AuthenticatedUser) {
    return { data: await this.achievements.my(actor.userId) };
  }

  @Post(':id/mark-seen')
  async markSeen(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { data: await this.achievements.markSeen(actor.userId, id) };
  }
}
