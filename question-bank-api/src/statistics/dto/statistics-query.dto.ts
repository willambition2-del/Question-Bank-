import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum StatisticsRange {
  WEEK = 'week',
  MONTH = 'month',
  ALL = 'all',
}

export class StatisticsQueryDto {
  @ApiPropertyOptional({ enum: StatisticsRange, default: StatisticsRange.WEEK })
  @IsOptional()
  @IsEnum(StatisticsRange)
  range: StatisticsRange = StatisticsRange.WEEK;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export type StatisticsPeriod = {
  from?: Date;
  to?: Date;
};
