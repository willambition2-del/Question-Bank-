import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsIn,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import {
  ChallengeMode,
  ChallengeStatus,
  QuestionDifficulty,
} from '../../generated/prisma/enums';

export class CreateChallengeDto {
  @IsEnum(ChallengeMode)
  mode!: ChallengeMode;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  questionCount!: number;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(120)
  timePerQuestionSeconds!: number;

  @IsEnum(QuestionDifficulty)
  difficulty: QuestionDifficulty = QuestionDifficulty.MIXED;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(10)
  maxPlayers: number = 2;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class InviteChallengeDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2])
  team?: number;
}
export class MatchmakingDto {
  @IsEnum(ChallengeMode)
  mode!: ChallengeMode;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsEnum(QuestionDifficulty)
  difficulty: QuestionDifficulty = QuestionDifficulty.MIXED;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  questionCount: number = 10;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(120)
  timePerQuestionSeconds: number = 30;
}

export class ChallengeQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ChallengeStatus })
  @IsOptional()
  @IsEnum(ChallengeStatus)
  status?: ChallengeStatus;

  @ApiPropertyOptional({ enum: ChallengeMode })
  @IsOptional()
  @IsEnum(ChallengeMode)
  mode?: ChallengeMode;
}
