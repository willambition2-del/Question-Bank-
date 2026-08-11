import { Module } from '@nestjs/common';
import { AdminSettingsController } from './admin/admin-settings.controller';
import { AdminSettingsService } from './admin/admin-settings.service';
import { SettingsController } from './settings.controller';

@Module({
  controllers: [AdminSettingsController, SettingsController],
  providers: [AdminSettingsService],
  exports: [AdminSettingsService],
})
export class SettingsModule {}
