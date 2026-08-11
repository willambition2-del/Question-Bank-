import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { LeaderboardsService } from './leaderboards.service';

@ApiTags('Leaderboards')
@ApiBearerAuth('access-token')
@Controller('leaderboards')
export class LeaderboardsController {
  constructor(private readonly leaderboards: LeaderboardsService) {}

  @Get()
  async list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: LeaderboardQueryDto,
  ) {
    return { data: await this.leaderboards.list(actor.userId, query) };
  }

  @Get('me')
  async me(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: LeaderboardQueryDto,
  ) {
    return { data: await this.leaderboards.me(actor.userId, query) };
  }
}
