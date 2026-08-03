import { Module } from '@nestjs/common';
import { AdminSettingsController } from './admin/admin-settings.controller';
import { AdminSettingsService } from './admin/admin-settings.service';

@Module({
  controllers: [AdminSettingsController],
  providers: [AdminSettingsService],
})
export class SettingsModule {}
