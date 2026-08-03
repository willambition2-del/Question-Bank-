import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { QuestionDifficulty } from '../../generated/prisma/enums';
import { CreateQuizAttemptDto } from '../../quiz/dto/quiz.dto';

const optionalBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === undefined) return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

export class MistakeQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() subjectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() unitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() lessonId?: string;
  @ApiPropertyOptional({ enum: QuestionDifficulty })
  @IsOptional()
  @IsEnum(QuestionDifficulty)
  difficulty?: QuestionDifficulty;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  minWrongCount = 1;

  @ApiPropertyOptional({ type: Boolean })
  @Transform(optionalBoolean)
  @IsOptional()
  @IsBoolean()
  mastered?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @Transform(optionalBoolean)
  @IsOptional()
  @IsBoolean()
  reviewed?: boolean;

  @ApiPropertyOptional({
    enum: [
      'last_wrong_desc',
      'wrong_count_desc',
      'mastery_asc',
      'difficulty_asc',
      'created_desc',
    ],
  })
  @IsOptional()
  @IsEnum([
    'last_wrong_desc',
    'wrong_count_desc',
    'mastery_asc',
    'difficulty_asc',
    'created_desc',
  ])
  sort:
    | 'last_wrong_desc'
    | 'wrong_count_desc'
    | 'mastery_asc'
    | 'difficulty_asc'
    | 'created_desc' = 'last_wrong_desc';
}

export class SavedQuestionQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() subjectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() unitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() lessonId?: string;
  @ApiPropertyOptional({ enum: QuestionDifficulty })
  @IsOptional()
  @IsEnum(QuestionDifficulty)
  difficulty?: QuestionDifficulty;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    enum: ['saved_desc', 'saved_asc', 'question_text_asc', 'difficulty_asc'],
  })
  @IsOptional()
  @IsEnum(['saved_desc', 'saved_asc', 'question_text_asc', 'difficulty_asc'])
  sort: 'saved_desc' | 'saved_asc' | 'question_text_asc' | 'difficulty_asc' =
    'saved_desc';
}

export class SavedQuestionNoteDto {
  @ApiPropertyOptional({
    nullable: true,
    maxLength: 1000,
    example: 'أحتاج مراجعة هذا السؤال',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class CreateCollectionQuizDto extends OmitType(CreateQuizAttemptDto, [
  'scope',
  'examModelId',
] as const) {}
