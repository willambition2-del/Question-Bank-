-- CreateEnum
CREATE TYPE "ServiceTaskType" AS ENUM ('TEXT_CHAT', 'QUESTION_EXPLANATION', 'QUESTION_HINT', 'ANSWER_REVIEW', 'LESSON_SUMMARY', 'LESSON_SIMPLIFICATION', 'STUDY_ASSISTANT', 'IMAGE_QUESTION_ANALYSIS', 'IMAGE_OCR', 'DOCUMENT_QUESTION_ANSWERING', 'MATH_PROBLEM_SOLVING', 'QUESTION_GENERATION', 'QUIZ_GENERATION', 'DISTRACTOR_GENERATION', 'ANSWER_EXPLANATION_GENERATION', 'WRONG_OPTION_EXPLANATION', 'CONTENT_CLASSIFICATION', 'CONTENT_MODERATION', 'RECOMMENDATION_EXPLANATION', 'EMBEDDING_GENERATION', 'RERANKING');

-- CreateEnum
CREATE TYPE "ServiceProviderType" AS ENUM ('OPENAI_COMPATIBLE', 'GOOGLE_COMPATIBLE', 'CUSTOM_HTTP', 'NVIDIA', 'LOCAL_MODEL', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceProviderAuthType" AS ENUM ('BEARER', 'API_KEY_HEADER', 'QUERY_PARAMETER', 'NONE');

-- CreateEnum
CREATE TYPE "RoutingStrategy" AS ENUM ('PRIORITY', 'WEIGHTED', 'LOWEST_COST', 'LOWEST_LATENCY', 'QUALITY_FIRST', 'BALANCED');

-- CreateEnum
CREATE TYPE "ServiceHealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'DISABLED', 'RATE_LIMITED', 'CIRCUIT_OPEN');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KnowledgeBaseScope" AS ENUM ('GLOBAL', 'SUBJECT', 'UNIT', 'LESSON', 'QUESTION_BANK', 'ADMIN_PRIVATE');

-- CreateEnum
CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('UPLOADED', 'QUEUED', 'EXTRACTING', 'CHUNKING', 'EMBEDDING', 'READY', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProviderCredentialAuditAction" AS ENUM ('CREATED', 'REPLACED', 'TEST_SUCCEEDED', 'TEST_FAILED', 'DISABLED');

-- CreateTable
CREATE TABLE "ServiceProvider" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayNameInternal" TEXT NOT NULL,
    "providerType" "ServiceProviderType" NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "authType" "ServiceProviderAuthType" NOT NULL DEFAULT 'BEARER',
    "encryptedApiKey" TEXT,
    "encryptedSecondarySecret" TEXT,
    "secretLastFour" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "maxRetries" INTEGER NOT NULL DEFAULT 1,
    "supportsStreaming" BOOLEAN NOT NULL DEFAULT false,
    "metadataJson" JSONB,
    "healthStatus" "ServiceHealthStatus" NOT NULL DEFAULT 'DISABLED',
    "healthScore" INTEGER NOT NULL DEFAULT 100,
    "lastHealthCheckAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceModel" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "internalName" TEXT NOT NULL,
    "remoteModelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "supportsText" BOOLEAN NOT NULL DEFAULT true,
    "supportsVision" BOOLEAN NOT NULL DEFAULT false,
    "supportsImages" BOOLEAN NOT NULL DEFAULT false,
    "supportsEmbeddings" BOOLEAN NOT NULL DEFAULT false,
    "supportsTools" BOOLEAN NOT NULL DEFAULT false,
    "supportsJsonMode" BOOLEAN NOT NULL DEFAULT false,
    "supportsStreaming" BOOLEAN NOT NULL DEFAULT false,
    "supportsLongContext" BOOLEAN NOT NULL DEFAULT false,
    "supportsReasoning" BOOLEAN NOT NULL DEFAULT false,
    "contextWindow" INTEGER NOT NULL DEFAULT 8192,
    "maxOutputTokens" INTEGER NOT NULL DEFAULT 2048,
    "inputCostPerMillion" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "outputCostPerMillion" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "imageCost" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "latencyClass" INTEGER NOT NULL DEFAULT 3,
    "qualityClass" INTEGER NOT NULL DEFAULT 3,
    "metadataJson" JSONB,
    "healthStatus" "ServiceHealthStatus" NOT NULL DEFAULT 'DISABLED',
    "averageLatencyMs" INTEGER,
    "successRate" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutingPolicy" (
    "id" TEXT NOT NULL,
    "taskType" "ServiceTaskType" NOT NULL,
    "nameInternal" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "strategy" "RoutingStrategy" NOT NULL DEFAULT 'PRIORITY',
    "primaryModelId" TEXT,
    "maxFallbacks" INTEGER NOT NULL DEFAULT 2,
    "requiredVision" BOOLEAN NOT NULL DEFAULT false,
    "requiredJsonMode" BOOLEAN NOT NULL DEFAULT false,
    "minContextWindow" INTEGER NOT NULL DEFAULT 0,
    "maxEstimatedCost" DECIMAL(14,6),
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "temperature" DECIMAL(3,2) NOT NULL DEFAULT 0.2,
    "maxOutputTokens" INTEGER NOT NULL DEFAULT 1024,
    "systemPromptVersionId" TEXT,
    "knowledgeBaseId" TEXT,
    "routingVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutingCandidate" (
    "id" TEXT NOT NULL,
    "routingPolicyId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "maxRequestsPerMinute" INTEGER,
    "maxRequestsPerDay" INTEGER,
    "maxCostPerDay" DECIMAL(14,6),
    "conditionsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutingCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameInternal" TEXT NOT NULL,
    "taskType" "ServiceTaskType" NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "developerPrompt" TEXT,
    "responseSchemaJson" JSONB,
    "version" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBase" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "scope" "KnowledgeBaseScope" NOT NULL,
    "subjectId" TEXT,
    "gradeId" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ar',
    "retrievalSettingsJson" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'ar',
    "pageCount" INTEGER,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "subjectId" TEXT,
    "unitId" TEXT,
    "lessonId" TEXT,
    "sourceId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "extractionError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "sectionTitle" TEXT,
    "chunkIndex" INTEGER NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "contentChecksum" TEXT NOT NULL,
    "metadataJson" JSONB,
    "embeddingRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureUsagePolicy" (
    "id" TEXT NOT NULL,
    "taskType" "ServiceTaskType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "userDailyLimit" INTEGER NOT NULL DEFAULT 0,
    "userMonthlyLimit" INTEGER NOT NULL DEFAULT 0,
    "globalDailyLimit" INTEGER NOT NULL DEFAULT 0,
    "maxInputTokens" INTEGER NOT NULL DEFAULT 4096,
    "maxOutputTokens" INTEGER NOT NULL DEFAULT 1024,
    "maxImages" INTEGER NOT NULL DEFAULT 0,
    "maxImageSize" INTEGER NOT NULL DEFAULT 0,
    "maxDocumentPages" INTEGER NOT NULL DEFAULT 0,
    "allowedRoles" JSONB NOT NULL,
    "subscriptionTier" TEXT,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureUsagePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequestLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "userId" TEXT,
    "taskType" "ServiceTaskType" NOT NULL,
    "routingPolicyId" TEXT,
    "selectedModelId" TEXT,
    "selectedProviderId" TEXT,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "inputTokenCount" INTEGER NOT NULL DEFAULT 0,
    "outputTokenCount" INTEGER NOT NULL DEFAULT 0,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER,
    "estimatedCost" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "fallbackCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "knowledgeUsed" BOOLEAN NOT NULL DEFAULT false,
    "promptVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderCredentialAudit" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "ProviderCredentialAuditAction" NOT NULL,
    "secretLastFour" TEXT,
    "succeeded" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderCredentialAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceProvider_key_key" ON "ServiceProvider"("key");

-- CreateIndex
CREATE INDEX "ServiceProvider_enabled_priority_idx" ON "ServiceProvider"("enabled", "priority");

-- CreateIndex
CREATE INDEX "ServiceProvider_healthStatus_idx" ON "ServiceProvider"("healthStatus");

-- CreateIndex
CREATE INDEX "ServiceModel_enabled_healthStatus_idx" ON "ServiceModel"("enabled", "healthStatus");

-- CreateIndex
CREATE INDEX "ServiceModel_supportsText_supportsVision_supportsEmbeddings_idx" ON "ServiceModel"("supportsText", "supportsVision", "supportsEmbeddings");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceModel_providerId_remoteModelId_key" ON "ServiceModel"("providerId", "remoteModelId");

-- CreateIndex
CREATE INDEX "RoutingPolicy_taskType_enabled_idx" ON "RoutingPolicy"("taskType", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "RoutingPolicy_taskType_nameInternal_key" ON "RoutingPolicy"("taskType", "nameInternal");

-- CreateIndex
CREATE INDEX "RoutingCandidate_routingPolicyId_enabled_priority_idx" ON "RoutingCandidate"("routingPolicyId", "enabled", "priority");

-- CreateIndex
CREATE INDEX "RoutingCandidate_modelId_idx" ON "RoutingCandidate"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "RoutingCandidate_routingPolicyId_modelId_key" ON "RoutingCandidate"("routingPolicyId", "modelId");

-- CreateIndex
CREATE INDEX "PromptTemplate_taskType_active_idx" ON "PromptTemplate"("taskType", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_key_version_key" ON "PromptTemplate"("key", "version");

-- CreateIndex
CREATE INDEX "KnowledgeBase_scope_enabled_idx" ON "KnowledgeBase"("scope", "enabled");

-- CreateIndex
CREATE INDEX "KnowledgeBase_subjectId_gradeId_idx" ON "KnowledgeBase"("subjectId", "gradeId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_knowledgeBaseId_status_enabled_idx" ON "KnowledgeDocument"("knowledgeBaseId", "status", "enabled");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_subjectId_unitId_lessonId_idx" ON "KnowledgeDocument"("subjectId", "unitId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_knowledgeBaseId_checksum_key" ON "KnowledgeDocument"("knowledgeBaseId", "checksum");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_knowledgeBaseId_idx" ON "KnowledgeChunk"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_documentId_idx" ON "KnowledgeChunk"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_documentId_chunkIndex_key" ON "KnowledgeChunk"("documentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "FeatureUsagePolicy_taskType_enabled_idx" ON "FeatureUsagePolicy"("taskType", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureUsagePolicy_taskType_subscriptionTier_key" ON "FeatureUsagePolicy"("taskType", "subscriptionTier");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequestLog_requestId_key" ON "ServiceRequestLog"("requestId");

-- CreateIndex
CREATE INDEX "ServiceRequestLog_taskType_createdAt_idx" ON "ServiceRequestLog"("taskType", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequestLog_status_createdAt_idx" ON "ServiceRequestLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequestLog_selectedProviderId_selectedModelId_create_idx" ON "ServiceRequestLog"("selectedProviderId", "selectedModelId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequestLog_userId_idempotencyKey_key" ON "ServiceRequestLog"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ProviderCredentialAudit_providerId_createdAt_idx" ON "ProviderCredentialAudit"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderCredentialAudit_actorId_createdAt_idx" ON "ProviderCredentialAudit"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "ServiceModel" ADD CONSTRAINT "ServiceModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingCandidate" ADD CONSTRAINT "RoutingCandidate_routingPolicyId_fkey" FOREIGN KEY ("routingPolicyId") REFERENCES "RoutingPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingCandidate" ADD CONSTRAINT "RoutingCandidate_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ServiceModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderCredentialAudit" ADD CONSTRAINT "ProviderCredentialAudit_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
