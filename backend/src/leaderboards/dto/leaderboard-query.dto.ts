import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PageQueryDto } from '../../common/pagination/page-query.dto';

export enum LeaderboardPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  ALL = 'all',
}

export enum LeaderboardScope {
  GLOBAL = 'global',
  SUBJECT = 'subject',
  SCHOOL = 'school',
}

export enum LeaderboardMetric {
  XP = 'xp',
  POINTS = 'points',
  WINS = 'wins',
}

export class LeaderboardQueryDto extends PageQueryDto {
  @ApiPropertyOptional({
    enum: LeaderboardPeriod,
    default: LeaderboardPeriod.WEEKLY,
  })
  @IsOptional()
  @IsEnum(LeaderboardPeriod)
  period: LeaderboardPeriod = LeaderboardPeriod.WEEKLY;

  @ApiPropertyOptional({
    enum: LeaderboardScope,
    default: LeaderboardScope.GLOBAL,
  })
  @IsOptional()
  @IsEnum(LeaderboardScope)
  scope: LeaderboardScope = LeaderboardScope.GLOBAL;

  @ApiPropertyOptional({
    enum: LeaderboardMetric,
    default: LeaderboardMetric.XP,
  })
  @IsOptional()
  @IsEnum(LeaderboardMetric)
  metric: LeaderboardMetric = LeaderboardMetric.XP;

  @IsOptional()
  @IsUUID()
  subjectId?: string;
}
