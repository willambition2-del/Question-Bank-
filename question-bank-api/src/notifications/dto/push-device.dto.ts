import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { PushDevicePlatform } from '../../generated/prisma/enums';

export class RegisterPushDeviceDto {
  @IsString()
  @MinLength(16)
  @MaxLength(4096)
  target!: string;

  @IsEnum(PushDevicePlatform)
  platform!: PushDevicePlatform;
}
