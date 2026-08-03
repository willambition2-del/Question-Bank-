import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export enum ImageAnalysisMode {
  EXTRACT_ONLY = 'EXTRACT_ONLY',
  EXPLAIN = 'EXPLAIN',
  SOLVE = 'SOLVE',
  CHECK_MY_ANSWER = 'CHECK_MY_ANSWER',
}

export class ImageQuestionAnalysisDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  userQuestion?: string;

  @ApiProperty({ enum: ImageAnalysisMode })
  @IsEnum(ImageAnalysisMode)
  analysisMode: ImageAnalysisMode = ImageAnalysisMode.EXPLAIN;
}

export interface ImageQuestionAnalysisResponse {
  requestId: string;
  detectedText: string;
  normalizedQuestion: string;
  detectedOptions: string[];
  detectedSubject: string | null;
  detectedTopic: string | null;
  analysisMode: ImageAnalysisMode;
  explanation: string | null;
  solutionSteps: string[];
  finalAnswer: string | null;
  confidence: number;
  requiresClarification: boolean;
  warnings: string[];
  matchedQuestionId: string | null;
  sourceReferences: Array<{
    documentId: string;
    pageNumber: number | null;
    title: string;
  }>;
  usageStatus: { remainingToday: number | null };
}
