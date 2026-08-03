import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PointHistoryQueryDto } from './dto/gamification.dto';
import { PointsService } from './points.service';

@ApiTags('Gamification')
@ApiBearerAuth('access-token')
@Controller('gamification/points')
export class GamificationController {
  constructor(private readonly points: PointsService) {}

  @Get()
  async get(@CurrentUser() actor: AuthenticatedUser) {
    return { data: await this.points.get(actor.userId) };
  }

  @Get('history')
  async history(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: PointHistoryQueryDto,
  ) {
    const result = await this.points.history(actor.userId, query);
    return { data: result.items, meta: result.meta };
  }
}
