import { Module } from '@nestjs/common';
import {
  UpdatesAdminController,
  UpdatesController,
} from './updates.controller';
import { UpdatesService } from './updates.service';

@Module({
  controllers: [UpdatesController, UpdatesAdminController],
  providers: [UpdatesService],
  exports: [UpdatesService],
})
export class UpdatesModule {}
