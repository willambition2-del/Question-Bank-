import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  KnowledgeBaseScope,
  RoutingStrategy,
  ServiceProviderAuthType,
  ServiceProviderType,
  ServiceTaskType,
  UserRole,
} from '../../../generated/prisma/enums';

export class CreateProviderDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]{1,63}$/)
  key!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayNameInternal!: string;

  @IsEnum(ServiceProviderType)
  providerType!: ServiceProviderType;

  @IsString()
  @MaxLength(2048)
  baseUrl!: string;

  @IsEnum(ServiceProviderAuthType)
  authType!: ServiceProviderAuthType;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  secondarySecret?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300_000)
  timeoutMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  maxRetries?: number;
}

export class UpdateProviderDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayNameInternal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  baseUrl?: string;

  @IsOptional()
  @IsEnum(ServiceProviderAuthType)
  authType?: ServiceProviderAuthType;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  secondarySecret?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300_000)
  timeoutMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  maxRetries?: number;
}

export class CreateModelDto {
  @IsUUID()
  providerId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  internalName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  remoteModelId!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsText?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsVision?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsImages?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsEmbeddings?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsJsonMode?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsStreaming?: boolean;

  @IsInt()
  @Min(256)
  @Max(10_000_000)
  contextWindow!: number;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maxOutputTokens!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  inputCostPerMillion?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  outputCostPerMillion?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  imageCost?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  latencyClass?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  qualityClass?: number;
}

export class UpdateModelDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  internalName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  remoteModelId?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsText?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsVision?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsImages?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsEmbeddings?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsJsonMode?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsStreaming?: boolean;

  @IsOptional()
  @IsInt()
  @Min(256)
  contextWindow?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxOutputTokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  inputCostPerMillion?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  outputCostPerMillion?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  imageCost?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  latencyClass?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  qualityClass?: number;
}

export class RoutingCandidateDto {
  @IsUUID()
  modelId!: string;

  @IsInt()
  @Min(1)
  @Max(10_000)
  priority!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  weight?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCostPerDay?: number;
}

export class CreateRouteDto {
  @IsEnum(ServiceTaskType)
  taskType!: ServiceTaskType;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nameInternal!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsEnum(RoutingStrategy)
  strategy!: RoutingStrategy;

  @IsOptional()
  @IsUUID()
  primaryModelId?: string;

  @IsInt()
  @Min(0)
  @Max(10)
  maxFallbacks!: number;

  @IsOptional()
  @IsBoolean()
  requiredVision?: boolean;

  @IsOptional()
  @IsBoolean()
  requiredJsonMode?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  minContextWindow?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxEstimatedCost?: number;

  @IsInt()
  @Min(100)
  @Max(300_000)
  timeoutMs!: number;

  @IsNumber()
  @Min(0)
  @Max(2)
  temperature!: number;

  @IsInt()
  @Min(1)
  maxOutputTokens!: number;

  @IsOptional()
  @IsUUID()
  knowledgeBaseId?: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RoutingCandidateDto)
  candidates!: RoutingCandidateDto[];
}

export class UpdateRouteDto extends CreateRouteDto {
  @IsOptional()
  declare taskType: ServiceTaskType;

  @IsOptional()
  declare nameInternal: string;

  @IsOptional()
  declare strategy: RoutingStrategy;

  @IsOptional()
  declare maxFallbacks: number;

  @IsOptional()
  declare timeoutMs: number;

  @IsOptional()
  declare temperature: number;

  @IsOptional()
  declare maxOutputTokens: number;

  @IsOptional()
  declare candidates: RoutingCandidateDto[];
}

export class CreatePromptDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_.-]{1,99}$/)
  key!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nameInternal!: string;

  @IsEnum(ServiceTaskType)
  taskType!: ServiceTaskType;

  @IsString()
  @MinLength(10)
  @MaxLength(50_000)
  systemPrompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  developerPrompt?: string;

  @IsOptional()
  @IsObject()
  responseSchemaJson?: Record<string, unknown>;
}

export class UpdatePromptDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nameInternal?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(50_000)
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  developerPrompt?: string;

  @IsOptional()
  @IsObject()
  responseSchemaJson?: Record<string, unknown>;
}

export class UpdateUsagePolicyDto {
  @IsBoolean()
  enabled!: boolean;

  @IsInt()
  @Min(0)
  userDailyLimit!: number;

  @IsInt()
  @Min(0)
  userMonthlyLimit!: number;

  @IsInt()
  @Min(0)
  globalDailyLimit!: number;

  @IsInt()
  @Min(1)
  maxInputTokens!: number;

  @IsInt()
  @Min(1)
  maxOutputTokens!: number;

  @IsInt()
  @Min(0)
  maxImages!: number;

  @IsInt()
  @Min(0)
  maxImageSize!: number;

  @IsInt()
  @Min(0)
  maxDocumentPages!: number;

  @IsArray()
  @ArrayMaxSize(10)
  @IsEnum(UserRole, { each: true })
  allowedRoles!: UserRole[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  subscriptionTier?: string;

  @IsInt()
  @Min(0)
  @Max(86_400)
  cooldownSeconds!: number;
}

export class CreateKnowledgeBaseDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(KnowledgeBaseScope)
  scope!: KnowledgeBaseScope;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2,3}(-[A-Z]{2})?$/)
  language?: string;

  @IsOptional()
  @IsObject()
  retrievalSettings?: Record<string, unknown>;
}

export class UpdateKnowledgeBaseDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  retrievalSettings?: Record<string, unknown>;
}

export class KnowledgeUploadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @Matches(/^[a-z]{2,3}(-[A-Z]{2})?$/)
  language!: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @IsOptional()
  @IsUUID()
  sourceId?: string;
}

export class SearchKnowledgeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  query!: string;
}

export class AdminLogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 100;
}
