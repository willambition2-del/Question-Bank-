import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CompanionType, GradeLevel } from '../../generated/prisma/enums';

const trimOptionalString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

export class UpdateProfileDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '+966500000000', nullable: true })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  schoolName?: string;

  @ApiPropertyOptional({ example: 'أمانة العاصمة', nullable: true })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  governorate?: string;

  @ApiPropertyOptional({ enum: GradeLevel })
  @IsOptional()
  @IsEnum(GradeLevel)
  gradeLevel?: GradeLevel;

  @ApiPropertyOptional({ enum: CompanionType })
  @IsOptional()
  @IsEnum(CompanionType)
  companion?: CompanionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onboardingCompleted?: boolean;
}

