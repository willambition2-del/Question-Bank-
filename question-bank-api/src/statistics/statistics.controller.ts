import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { StatisticsQueryDto } from './dto/statistics-query.dto';
import { StatisticsService } from './statistics.service';

@ApiTags('Statistics')
@ApiBearerAuth('access-token')
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}

  @Get('overview')
  overview(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: StatisticsQueryDto,
  ) {
    return this.wrap(this.statistics.overview(actor.userId, query));
  }

  @Get('activity')
  activity(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: StatisticsQueryDto,
  ) {
    return this.wrap(this.statistics.activity(actor.userId, query));
  }

  @Get('subjects')
  subjects(@CurrentUser() actor: AuthenticatedUser) {
    return this.wrap(this.statistics.subjects(actor.userId));
  }

  @Get('performance')
  performance(@CurrentUser() actor: AuthenticatedUser) {
    return this.wrap(this.statistics.performance(actor.userId));
  }

  @Get('questions')
  questionAnalytics(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: StatisticsQueryDto,
  ) {
    return this.wrap(this.statistics.questionAnalytics(actor.userId, query));
  }

  @Get('time-analytics')
  timeAnalytics(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: StatisticsQueryDto,
  ) {
    return this.wrap(this.statistics.timeAnalytics(actor.userId, query));
  }

  @Get('subjects/:subjectId')
  subject(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
  ) {
    return this.wrap(this.statistics.subject(actor.userId, subjectId));
  }

  @Get('units/:unitId')
  unit(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('unitId', ParseUUIDPipe) unitId: string,
  ) {
    return this.wrap(this.statistics.unit(actor.userId, unitId));
  }

  @Get('lessons/:lessonId')
  lesson(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ) {
    return this.wrap(this.statistics.lesson(actor.userId, lessonId));
  }

  @Get('accuracy-trend')
  accuracyTrend(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: StatisticsQueryDto,
  ) {
    return this.wrap(this.statistics.accuracyTrend(actor.userId, query));
  }

  @Get('time-distribution')
  timeDistribution(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: StatisticsQueryDto,
  ) {
    return this.wrap(this.statistics.timeDistribution(actor.userId, query));
  }

  @Get('heatmap')
  heatmap(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: StatisticsQueryDto,
  ) {
    return this.wrap(this.statistics.heatmap(actor.userId, query));
  }

  private async wrap(value: Promise<unknown>) {
    return { data: await value };
  }
}
