import { Module } from '@nestjs/common';
import {
  IntelligentServicesAdminController,
  KnowledgeAdminController,
} from './admin/intelligent-services-admin.controller';
import { IntelligentServicesAdminService } from './admin/intelligent-services-admin.service';
import { AssistantController } from './assistant/assistant.controller';
import { AssistantResponseValidator } from './assistant/assistant-response-validator.service';
import { AssistantService } from './assistant/assistant.service';
import { AssistantCacheService } from './assistant/assistant-cache.service';
import { ImageQuestionService } from './assistant/image-question.service';
import { ImageUploadValidator } from './assistant/image-upload-validator.service';
import { PromptTemplateService } from './assistant/prompt-template.service';
import { QuestionContextService } from './assistant/question-context.service';
import { CredentialEncryptionService } from './credentials/credential-encryption.service';
import { IntelligentServicesGateway } from './intelligent-services.gateway';
import { DocumentFileValidator } from './knowledge/document-file-validator.service';
import { DocumentIngestionService } from './knowledge/document-ingestion.service';
import { DocumentStorageService } from './knowledge/document-storage.service';
import { DocumentTextExtractor } from './knowledge/document-text-extractor.service';
import { KnowledgeBaseService } from './knowledge/knowledge-base.service';
import { EmbeddingService } from './knowledge/embedding.service';
import { VectorExtensionService } from './knowledge/vector-extension.service';
import { VectorEmbeddingRepository } from './knowledge/vector-embedding.repository';
import { RerankingService } from './knowledge/reranking.service';
import { KnowledgeChunkerService } from './knowledge/knowledge-chunker.service';
import { KnowledgeRetrievalService } from './knowledge/knowledge-retrieval.service';
import { OcrService } from './knowledge/ocr.service';
import { CustomHttpAdapter } from './providers/custom-http.adapter';
import { GoogleCompatibleAdapter } from './providers/google-compatible.adapter';
import { OpenAiCompatibleAdapter } from './providers/openai-compatible.adapter';
import { ProviderAdapterRegistry } from './providers/provider-adapter.registry';
import { ProviderUrlSecurityService } from './providers/provider-url-security.service';
import { ModelRoutingEngine } from './routing/model-routing.engine';
import { ProviderCircuitBreakerService } from './routing/provider-circuit-breaker.service';
import { UsageGovernanceService } from './usage/usage-governance.service';

@Module({
  controllers: [
    AssistantController,
    IntelligentServicesAdminController,
    KnowledgeAdminController,
  ],
  providers: [
    IntelligentServicesAdminService,
    AssistantService,
    AssistantCacheService,
    ImageQuestionService,
    ImageUploadValidator,
    AssistantResponseValidator,
    PromptTemplateService,
    QuestionContextService,
    UsageGovernanceService,
    CredentialEncryptionService,
    ProviderUrlSecurityService,
    OpenAiCompatibleAdapter,
    GoogleCompatibleAdapter,
    CustomHttpAdapter,
    ProviderAdapterRegistry,
    ProviderCircuitBreakerService,
    ModelRoutingEngine,
    IntelligentServicesGateway,
    DocumentFileValidator,
    DocumentStorageService,
    DocumentTextExtractor,
    OcrService,
    KnowledgeChunkerService,
    DocumentIngestionService,
    KnowledgeBaseService,
    EmbeddingService,
    VectorExtensionService,
    VectorEmbeddingRepository,
    RerankingService,
    KnowledgeRetrievalService,
  ],
  exports: [
    AssistantService,
    AssistantCacheService,
    ImageQuestionService,
    ImageUploadValidator,
    QuestionContextService,
    UsageGovernanceService,
    CredentialEncryptionService,
    ProviderAdapterRegistry,
    ProviderCircuitBreakerService,
    ModelRoutingEngine,
    IntelligentServicesGateway,
    DocumentFileValidator,
    DocumentStorageService,
    DocumentTextExtractor,
    OcrService,
    KnowledgeChunkerService,
    DocumentIngestionService,
    KnowledgeBaseService,
    EmbeddingService,
    VectorExtensionService,
    VectorEmbeddingRepository,
    RerankingService,
    KnowledgeRetrievalService,
  ],
})
export class IntelligentServicesModule {}
