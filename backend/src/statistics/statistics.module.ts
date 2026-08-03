import { Module } from '@nestjs/common';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { AdminProgressController } from './admin/admin-progress.controller';
import { AdminProgressService } from './admin/admin-progress.service';

@Module({
  controllers: [StatisticsController, AdminProgressController],
  providers: [StatisticsService, AdminProgressService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
