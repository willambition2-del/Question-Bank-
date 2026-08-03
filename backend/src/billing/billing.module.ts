import { Module } from '@nestjs/common';
import { AdminBillingController } from './admin/admin-billing.controller';
import { AdminBillingService } from './admin/admin-billing.service';

@Module({
  controllers: [AdminBillingController],
  providers: [AdminBillingService],
})
export class BillingModule {}
