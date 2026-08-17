import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GradeLevel } from '../../generated/prisma/enums';

const trimString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  return value.trim();
};

const trimOptionalString = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

export class CompleteOnboardingDto {
  @ApiProperty({ example: 'مدرسة الكويت النموذجية', minLength: 2, maxLength: 150 })
  @Transform(trimString)
  @IsNotEmpty({ message: 'اسم المدرسة مطلوب' })
  @IsString()
  @MinLength(2, { message: 'اسم المدرسة يجب أن يحتوي على حرفين على الأقل' })
  @MaxLength(150)
  schoolName!: string;

  @ApiProperty({ example: 'أمانة العاصمة', minLength: 2, maxLength: 100 })
  @Transform(trimString)
  @IsNotEmpty({ message: 'المحافظة مطلوبة' })
  @IsString()
  @MaxLength(100)
  governorate!: string;

  @ApiProperty({ enum: GradeLevel, example: GradeLevel.THIRD_SECONDARY })
  @IsNotEmpty({ message: 'الصف الدراسي مطلوب' })
  @IsEnum(GradeLevel, { message: 'الصف الدراسي غير صالح' })
  gradeLevel!: GradeLevel;

  @ApiPropertyOptional({ example: '+967770000000', nullable: true })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}