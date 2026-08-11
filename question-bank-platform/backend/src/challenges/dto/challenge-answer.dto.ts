import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class SubmitChallengeAnswerDto {
  @IsUUID()
  challengeId!: string;

  @IsUUID()
  questionId!: string;

  @IsOptional()
  @IsUUID()
  selectedOptionId?: string;

  @IsOptional()
  @IsBoolean()
  selectedBoolean?: boolean;
}
