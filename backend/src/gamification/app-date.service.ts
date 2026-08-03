import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppDateService {
  constructor(private readonly config: ConfigService) {}

  today(now = new Date()) {
    const timeZone = this.config.get<string>('APP_TIMEZONE', 'Asia/Aden');
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';
    return new Date(
      `${value('year')}-${value('month')}-${value('day')}T00:00:00.000Z`,
    );
  }
}
