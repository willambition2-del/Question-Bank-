import { Module } from '@nestjs/common';
import { StudyResourcesController } from './study-resources.controller';
import { StudyResourcesService } from './study-resources.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [StudyResourcesController],
  providers: [StudyResourcesService],
  exports: [StudyResourcesService],
})
export class StudyResourcesModule {}
