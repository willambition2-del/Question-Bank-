import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('features')
  async getFeatureFlags() {
    const defaultFlags = {
      AI_ASSISTANT: 'COMING_SOON',
      IMAGE_ANALYSIS: 'COMING_SOON',
      CHALLENGE_1V1: 'COMING_SOON',
      CHALLENGE_2V2: 'COMING_SOON',
      LEADERBOARD: 'COMING_SOON',
      NOTIFICATIONS: 'COMING_SOON',
      GOOGLE_LOGIN: 'COMING_SOON',
      KNOWLEDGE_ASSISTANT: 'COMING_SOON',
    };

    const settings = await this.prisma.systemSetting.findMany({
      where: { key: { startsWith: 'FLAG_' } },
    });

    const result = { ...defaultFlags };
    for (const setting of settings) {
      const key = setting.key.replace('FLAG_', '');
      if (key in result) {
        result[key as keyof typeof result] = setting.value;
      }
    }

    return result;
  }
}
