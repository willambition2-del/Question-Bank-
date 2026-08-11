import { Module } from '@nestjs/common';
import { AdminAnnouncementsController } from './admin/admin-announcements.controller';
import { AdminAnnouncementsService } from './admin/admin-announcements.service';

@Module({
  controllers: [AdminAnnouncementsController],
  providers: [AdminAnnouncementsService],
})
export class AnnouncementsModule {}
