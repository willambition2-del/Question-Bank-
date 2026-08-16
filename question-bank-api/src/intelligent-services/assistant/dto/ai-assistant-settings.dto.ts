import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { AiResetPeriod } from '../../../generated/prisma/enums';

export class UpdateAiAssistantSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  providerId?: string | null;

  @IsOptional()
  @IsString()
  modelId?: string | null;

  @IsOptional()
  @IsString()
  fallbackModelId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  userMessageLimit?: number;

  @IsOptional()
  @IsEnum(AiResetPeriod)
  resetPeriod?: AiResetPeriod;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  limitMessage?: string;
}

export class UserUsageQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
