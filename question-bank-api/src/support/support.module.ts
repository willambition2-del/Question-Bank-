import { Module } from '@nestjs/common';
import { AdminSupportController } from './admin/admin-support.controller';
import { AdminSupportService } from './admin/admin-support.service';

@Module({
  controllers: [AdminSupportController],
  providers: [AdminSupportService],
})
export class SupportModule {}
