import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  QuestionDifficulty,
  QuestionType,
  SourceType,
} from '../../generated/prisma/enums';

const optionalTrim = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
};

export class CreateSourceDto {
  @ApiProperty({ example: 'اختبار وزارة التربية 2025' })
  @Transform(optionalTrim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  name!: string;

  @ApiProperty({ enum: SourceType })
  @IsEnum(SourceType)
  type!: SourceType;

  @ApiPropertyOptional({ minimum: 1900, maximum: 2200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  year?: number;

  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  governorate?: string;

  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  referenceUrl?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isOfficial?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSourceDto extends PartialType(CreateSourceDto) {}

export class CreateReadingPassageDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  subjectId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(250)
  title?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  passageText!: string;

  @ApiPropertyOptional({ default: 'ar' })
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(10)
  languageCode?: string;

  @ApiPropertyOptional({ enum: QuestionDifficulty })
  @IsOptional()
  @IsEnum(QuestionDifficulty)
  difficulty?: QuestionDifficulty;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateReadingPassageDto extends PartialType(
  CreateReadingPassageDto,
) {}

export class QuestionOptionInputDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  optionText!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  optionImageUrl?: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;

  @ApiProperty()
  @IsBoolean()
  isCorrect!: boolean;

  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  whyWrong?: string;
}

export class CreateQuestionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  subjectId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readingPassageId?: string;

  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  type!: QuestionType;

  @ApiProperty({ example: 'ما وحدة قياس القوة؟' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  questionText!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  questionImageUrl?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsBoolean()
  correctBoolean?: boolean | null;

  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  hintText?: string;

  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  explanationShort?: string;

  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  explanationDetailed?: string;

  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  dangerKeyword?: string;

  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  commonMistake?: string;

  @ApiPropertyOptional({ enum: QuestionDifficulty, default: 'MEDIUM' })
  @IsOptional()
  @IsEnum(QuestionDifficulty)
  difficulty?: QuestionDifficulty;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isTrapQuestion?: boolean;

  @ApiPropertyOptional({ type: [QuestionOptionInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionInputDto)
  options?: QuestionOptionInputDto[];
}

export class UpdateQuestionDto extends PartialType(CreateQuestionDto) {}

export class ReviewNoteDto {
  @ApiPropertyOptional()
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;
}

export class RejectQuestionDto {
  @ApiProperty()
  @Transform(optionalTrim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  reason!: string;
}

export enum QuestionBulkAction {
  PUBLISH = 'publish',
  UNPUBLISH = 'unpublish',
  ARCHIVE = 'archive',
  ACTIVATE = 'activate',
  DEACTIVATE = 'deactivate',
  ASSIGN_UNIT = 'assign_unit',
  ASSIGN_LESSON = 'assign_lesson',
  SUBMIT_REVIEW = 'submit_review',
}

export class QuestionBulkActionDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  questionIds!: string[];

  @ApiProperty({ enum: QuestionBulkAction })
  @IsEnum(QuestionBulkAction)
  action!: QuestionBulkAction;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    deprecated: true,
    description: 'Use unitId or lessonId for assignment actions.',
  })
  @IsOptional()
  @IsUUID()
  targetId?: string;
}
