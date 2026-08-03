import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class AssistantChatDto {
  @ApiProperty({ minLength: 1, maxLength: 4000 })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;
}

export class AttemptContextDto {
  @ApiProperty()
  @IsUUID()
  attemptId!: string;
}

export class KnowledgeAskDto {
  @ApiProperty({ minLength: 1, maxLength: 4000 })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  question!: string;

  @ApiProperty()
  @IsUUID()
  knowledgeBaseId!: string;

  @ApiPropertyOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  lessonId?: string;
}
