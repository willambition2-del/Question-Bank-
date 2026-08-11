import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PASSWORD_PATTERN,
  USERNAME_PATTERN,
} from '../../common/constants/auth.constants';
import { CompanionType } from '../../generated/prisma/enums';

const trimValue = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const optionalTrimValue = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

export class RegisterDto {
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @Transform(trimValue)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    minLength: 3,
    maxLength: 30,
    pattern: USERNAME_PATTERN.source,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(USERNAME_PATTERN, {
    message:
      'username may contain only English letters, numbers, and underscores',
  })
  username!: string;

  @ApiPropertyOptional({ example: '+966500000000' })
  @Transform(optionalTrimValue)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({
    minLength: 8,
    description: 'Must contain at least one letter and one number.',
  })
  @IsString()
  @Matches(PASSWORD_PATTERN, {
    message:
      'password must be at least 8 characters and contain a letter and a number',
  })
  password!: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @Transform(optionalTrimValue)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  schoolName?: string;

  @ApiProperty({ enum: CompanionType })
  @IsEnum(CompanionType)
  companion!: CompanionType;
}
