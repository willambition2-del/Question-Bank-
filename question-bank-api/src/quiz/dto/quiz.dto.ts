import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import {
  ExplanationMode,
  QuestionDifficulty,
  QuestionType,
  QuizAttemptStatus,
  QuizScope,
  QuizTimingMode,
} from '../../generated/prisma/enums';

export class CreateQuizAttemptDto {
  @ApiProperty({ enum: QuizScope, example: QuizScope.LESSON })
  @IsEnum(QuizScope)
  scope!: QuizScope;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

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
  examModelId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  questionCount = 20;

  @ApiPropertyOptional({ enum: QuestionType, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsEnum(QuestionType, { each: true })
  questionTypes?: QuestionType[];

  @ApiPropertyOptional({
    enum: QuestionDifficulty,
    default: QuestionDifficulty.MIXED,
  })
  @IsOptional()
  @IsEnum(QuestionDifficulty)
  difficulty: QuestionDifficulty = QuestionDifficulty.MIXED;

  @ApiPropertyOptional({ enum: QuizTimingMode, default: QuizTimingMode.NONE })
  @IsOptional()
  @IsEnum(QuizTimingMode)
  timingMode: QuizTimingMode = QuizTimingMode.NONE;

  @ApiPropertyOptional({
    minimum: 10,
    maximum: 21600,
    description: 'Required only for TOTAL_TIME.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(21600)
  durationSeconds?: number;

  @ApiPropertyOptional({
    minimum: 5,
    maximum: 3600,
    description: 'Required only for PER_QUESTION.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(3600)
  timePerQuestionSeconds?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  heartsEnabled = false;

  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  initialHearts = 3;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  hintsEnabled = true;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  eliminationEnabled = false;

  @ApiPropertyOptional({
    enum: ExplanationMode,
    default: ExplanationMode.AFTER_EACH,
  })
  @IsOptional()
  @IsEnum(ExplanationMode)
  explanationMode: ExplanationMode = ExplanationMode.AFTER_EACH;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  excludeMastered = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  unansweredOnly = false;
}

export class SubmitQuizAnswerDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  questionId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  selectedOptionId?: string | null;

  @ApiPropertyOptional({ type: Boolean, nullable: true })
  @IsOptional()
  @IsBoolean()
  selectedBoolean?: boolean | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 3600000, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3600000)
  timeSpentMs = 0;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hintUsed = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  eliminatedOptionUsed = false;
}

export class QuizAttemptQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: QuizAttemptStatus })
  @IsOptional()
  @IsEnum(QuizAttemptStatus)
  status?: QuizAttemptStatus;

  @ApiPropertyOptional({ enum: QuizScope })
  @IsOptional()
  @IsEnum(QuizScope)
  scope?: QuizScope;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    enum: [
      'created_desc',
      'created_asc',
      'score_desc',
      'score_asc',
      'completed_desc',
    ],
    default: 'created_desc',
  })
  @IsOptional()
  @IsIn([
    'created_desc',
    'created_asc',
    'score_desc',
    'score_asc',
    'completed_desc',
  ])
  sort?:
    | 'created_desc'
    | 'created_asc'
    | 'score_desc'
    | 'score_asc'
    | 'completed_desc';
}
