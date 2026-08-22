import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  ProviderCredentialAuditAction,
  ServiceHealthStatus,
  ServiceProviderType,
  ServiceRequestStatus,
  ServiceTaskType,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { CredentialEncryptionService } from '../credentials/credential-encryption.service';
import { KnowledgeBaseService } from '../knowledge/knowledge-base.service';
import { DocumentIngestionService } from '../knowledge/document-ingestion.service';
import { KnowledgeRetrievalService } from '../knowledge/knowledge-retrieval.service';
import { VectorExtensionService } from '../knowledge/vector-extension.service';
import {
  CURATED_NVIDIA_MODELS,
  NvidiaModelCatalogItem,
} from '../providers/nvidia-compatible.adapter';
import type { ProviderConfiguration } from '../providers/provider-adapter';
import { ProviderAdapterRegistry } from '../providers/provider-adapter.registry';
import { ProviderUrlSecurityService } from '../providers/provider-url-security.service';
import type {
  AdminLogQueryDto,
  CreateKnowledgeBaseDto,
  CreateModelDto,
  CreatePromptDto,
  CreateProviderDto,
  CreateRouteDto,
  KnowledgeUploadDto,
  SearchKnowledgeDto,
  UpdateKnowledgeBaseDto,
  UpdateModelDto,
  UpdatePromptDto,
  UpdateProviderDto,
  UpdateRouteDto,
  UpdateUsagePolicyDto,
} from './dto/intelligent-services-admin.dto';
import { AiAssistantSettingsService } from '../assistant/ai-assistant-settings.service';
import type {
  UpdateAiAssistantSettingsDto,
  UserUsageQueryDto,
} from '../assistant/dto/ai-assistant-settings.dto';

@Injectable()
export class IntelligentServicesAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: CredentialEncryptionService,
    private readonly urls: ProviderUrlSecurityService,
    private readonly adapters: ProviderAdapterRegistry,
    private readonly knowledge: KnowledgeBaseService,
    private readonly retrieval: KnowledgeRetrievalService,
    private readonly ingestion: DocumentIngestionService,
    private readonly vectors: VectorExtensionService,
    private readonly assistantSettingsService: AiAssistantSettingsService,
  ) {}

  assistantSettings() {
    return this.assistantSettingsService.getSettings();
  }

  updateAssistantSettings(actorId: string, dto: UpdateAiAssistantSettingsDto) {
    return this.assistantSettingsService.updateSettings(actorId, dto);
  }

  userUsage(query: UserUsageQueryDto) {
    return this.assistantSettingsService.listUserUsage(query);
  }

  async providers() {
    const providers = await this.prisma.serviceProvider.findMany({
      orderBy: [{ priority: 'asc' }, { key: 'asc' }],
      include: { _count: { select: { models: true } } },
    });
    return providers.map((provider) => this.providerView(provider));
  }

  async provider(id: string) {
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { id },
      include: { _count: { select: { models: true } } },
    });
    if (!provider) throw this.notFound('PROVIDER_NOT_FOUND');
    return this.providerView(provider);
  }

  async createProvider(actorId: string, dto: CreateProviderDto) {
    await this.urls.assertAllowed(dto.baseUrl);
    const apiKey = dto.apiKey?.trim();
    const secondary = dto.secondarySecret?.trim();
    const provider = await this.prisma.serviceProvider.create({
      data: {
        key: dto.key,
        displayNameInternal: dto.displayNameInternal,
        providerType: dto.providerType,
        baseUrl: dto.baseUrl,
        authType: dto.authType,
        encryptedApiKey: apiKey ? this.encryption.encrypt(apiKey) : null,
        encryptedSecondarySecret: secondary
          ? this.encryption.encrypt(secondary)
          : null,
        secretLastFour: apiKey ? apiKey.slice(-4) : null,
        enabled: dto.enabled ?? false,
        timeoutMs: dto.timeoutMs,
        maxRetries: dto.maxRetries,
        healthStatus: dto.enabled
          ? ServiceHealthStatus.DEGRADED
          : ServiceHealthStatus.DISABLED,
        createdById: actorId,
        updatedById: actorId,
      },
    });
    if (apiKey || secondary) {
      await this.credentialAudit(
        provider.id,
        actorId,
        ProviderCredentialAuditAction.CREATED,
        apiKey?.slice(-4),
        true,
      );
    }
    return this.provider(provider.id);
  }

  async updateProvider(id: string, actorId: string, dto: UpdateProviderDto) {
    const current = await this.prisma.serviceProvider.findUnique({
      where: { id },
    });
    if (!current) throw this.notFound('PROVIDER_NOT_FOUND');
    if (dto.baseUrl) await this.urls.assertAllowed(dto.baseUrl);
    const apiKey = dto.apiKey?.trim();
    const secondary = dto.secondarySecret?.trim();
    await this.prisma.serviceProvider.update({
      where: { id },
      data: {
        displayNameInternal: dto.displayNameInternal,
        baseUrl: dto.baseUrl,
        authType: dto.authType,
        encryptedApiKey: apiKey ? this.encryption.encrypt(apiKey) : undefined,
        encryptedSecondarySecret: secondary
          ? this.encryption.encrypt(secondary)
          : undefined,
        secretLastFour: apiKey ? apiKey.slice(-4) : undefined,
        enabled: dto.enabled,
        timeoutMs: dto.timeoutMs,
        maxRetries: dto.maxRetries,
        healthStatus:
          dto.enabled === false ? ServiceHealthStatus.DISABLED : undefined,
        updatedById: actorId,
      },
    });
    if (apiKey || secondary) {
      await this.credentialAudit(
        id,
        actorId,
        ProviderCredentialAuditAction.REPLACED,
        apiKey?.slice(-4) ?? current.secretLastFour ?? undefined,
        true,
      );
    }
    return this.provider(id);
  }

  async disableProvider(id: string, actorId: string) {
    await this.updateProvider(id, actorId, { enabled: false });
    await this.credentialAudit(
      id,
      actorId,
      ProviderCredentialAuditAction.DISABLED,
      undefined,
      true,
    );
    return { id, enabled: false };
  }

  async testProvider(id: string, actorId: string) {
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { id },
      include: {
        models: { where: { enabled: true }, take: 1, orderBy: { id: 'asc' } },
      },
    });
    if (!provider) throw this.notFound('PROVIDER_NOT_FOUND');
    const model = provider.models[0];
    if (!model) {
      throw new BadRequestException({
        code: 'PROVIDER_TEST_MODEL_REQUIRED',
        message: 'An enabled model is required to test this provider',
      });
    }
    try {
      const adapter = this.adapters.get(provider.providerType);
      await adapter.testConnection(this.providerConfiguration(provider), model);
      await this.setHealth(provider.id, model.id, true);
      await this.credentialAudit(
        id,
        actorId,
        ProviderCredentialAuditAction.TEST_SUCCEEDED,
        provider.secretLastFour ?? undefined,
        true,
      );
      return { ok: true };
    } catch {
      await this.setHealth(provider.id, model.id, false);
      await this.credentialAudit(
        id,
        actorId,
        ProviderCredentialAuditAction.TEST_FAILED,
        provider.secretLastFour ?? undefined,
        false,
        'CONNECTION_TEST_FAILED',
      );
      throw new BadRequestException({
        code: 'CONNECTION_TEST_FAILED',
        message: 'The provider connection test failed',
      });
    }
  }

  async discoverProviderModels(id: string) {
    const provider = await this.prisma.serviceProvider.findUnique({
      where: { id },
    });
    if (!provider) throw this.notFound('PROVIDER_NOT_FOUND');
    try {
      const adapter = this.adapters.get(provider.providerType);
      const models = await adapter.listModels(
        this.providerConfiguration(provider),
      );
      return {
        providerId: provider.id,
        models: [
          ...new Set(models.map((model) => model.trim()).filter(Boolean)),
        ]
          .sort()
          .slice(0, 500),
      };
    } catch {
      throw new BadRequestException({
        code: 'MODEL_DISCOVERY_FAILED',
        message: 'Model discovery failed',
      });
    }
  }

  async getNvidiaConfig() {
    const nvidia = await this.assistantSettingsService.ensureNvidiaProvider();
    return {
      providerId: nvidia.id,
      key: nvidia.key,
      displayNameInternal: nvidia.displayNameInternal,
      baseUrl: nvidia.baseUrl,
      enabled: nvidia.enabled,
      apiKeyConfigured: Boolean(nvidia.encryptedApiKey),
      secretLastFour: nvidia.secretLastFour,
      models: nvidia.models.map((m) => ({
        id: m.id,
        remoteModelId: m.remoteModelId,
        internalName: m.internalName,
        enabled: m.enabled,
      })),
    };
  }

  async updateNvidiaConfig(
    actorId: string,
    dto: {
      apiKey?: string;
      baseUrl?: string;
      enabled?: boolean;
      removeApiKey?: boolean;
    },
  ) {
    const nvidia = await this.assistantSettingsService.ensureNvidiaProvider();
    if (dto.baseUrl) await this.urls.assertAllowed(dto.baseUrl);
    const apiKey = dto.apiKey?.trim();

    await this.prisma.serviceProvider.update({
      where: { id: nvidia.id },
      data: {
        baseUrl: dto.baseUrl,
        encryptedApiKey: dto.removeApiKey
          ? null
          : apiKey
            ? this.encryption.encrypt(apiKey)
            : undefined,
        secretLastFour: dto.removeApiKey
          ? null
          : apiKey
            ? apiKey.slice(-4)
            : undefined,
        enabled: dto.enabled,
        healthStatus:
          dto.enabled === false ? ServiceHealthStatus.DISABLED : undefined,
        updatedById: actorId,
      },
    });

    if (apiKey || dto.removeApiKey) {
      await this.credentialAudit(
        nvidia.id,
        actorId,
        dto.removeApiKey
          ? ProviderCredentialAuditAction.DISABLED
          : ProviderCredentialAuditAction.REPLACED,
        apiKey?.slice(-4),
        true,
      );
    }

    return this.getNvidiaConfig();
  }

  async discoverNvidiaModels() {
    const nvidia = await this.assistantSettingsService.ensureNvidiaProvider();
    let remoteModels: string[] = [];
    if (nvidia.encryptedApiKey) {
      try {
        const adapter = this.adapters.get(ServiceProviderType.NVIDIA);
        remoteModels = await adapter.listModels(
          this.providerConfiguration(nvidia),
        );
      } catch {
        // Use catalog fallback
      }
    }

    const catalogMap = new Map<string, NvidiaModelCatalogItem>();
    for (const item of CURATED_NVIDIA_MODELS) {
      catalogMap.set(item.id, item);
    }
    for (const id of remoteModels) {
      if (!catalogMap.has(id)) {
        catalogMap.set(id, {
          id,
          name: id.split('/').pop() || id,
          publisher: id.split('/')[0] || 'NVIDIA',
          isFree: true,
          contextWindow: 131072,
          supportsVision: false,
          description: 'نموذج مستضاف على منصة NVIDIA API Catalog.',
        });
      }
    }

    return {
      providerId: nvidia.id,
      models: Array.from(catalogMap.values()),
    };
  }

  async testNvidiaModel(actorId: string, modelId: string) {
    const nvidia = await this.assistantSettingsService.ensureNvidiaProvider();
    if (!nvidia.encryptedApiKey) {
      return {
        status: 'Unauthorized',
        message: 'مفتاح NVIDIA API غير مدخل. يرجى إدخال وحفظ المفتاح أولاً.',
        latencyMs: 0,
      };
    }

    let model = await this.prisma.serviceModel.findFirst({
      where: {
        providerId: nvidia.id,
        OR: [{ id: modelId }, { remoteModelId: modelId }],
      },
    });

    if (!model) {
      model = await this.prisma.serviceModel.create({
        data: {
          providerId: nvidia.id,
          internalName: modelId.split('/').pop() || modelId,
          remoteModelId: modelId,
          enabled: true,
          supportsText: true,
        },
      });
    }

    const startTime = Date.now();
    try {
      const adapter = this.adapters.get(ServiceProviderType.NVIDIA);
      await adapter.testConnection(this.providerConfiguration(nvidia), model);
      const latencyMs = Date.now() - startTime;
      await this.setHealth(nvidia.id, model.id, true);
      await this.credentialAudit(
        nvidia.id,
        actorId,
        ProviderCredentialAuditAction.TEST_SUCCEEDED,
        nvidia.secretLastFour ?? undefined,
        true,
      );
      return {
        status: 'Working',
        message: 'النموذج متصل ويعمل بنجاح!',
        latencyMs,
      };
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      await this.setHealth(nvidia.id, model.id, false);
      const status = error?.status || error?.statusCode || 0;
      let resultStatus = 'Unavailable';
      let message = 'تعذر الاتصال بالنموذج حالياً.';

      if (
        status === 401 ||
        status === 403 ||
        error?.kind === 'AUTHENTICATION'
      ) {
        resultStatus = 'Unauthorized';
        message = 'مفتاح NVIDIA API غير صالح أو غير مصرح به (401/403).';
      } else if (status === 404) {
        resultStatus = 'Model not found';
        message = 'النموذج غير متاح على خوادم NVIDIA API (404).';
      } else if (status === 429 || error?.kind === 'RATE_LIMIT') {
        resultStatus = 'Rate limited';
        message = 'تم تجاوز حد الطلبات للنموذج على NVIDIA API (429).';
      }

      await this.credentialAudit(
        nvidia.id,
        actorId,
        ProviderCredentialAuditAction.TEST_FAILED,
        nvidia.secretLastFour ?? undefined,
        false,
        resultStatus,
      );

      return {
        status: resultStatus,
        message,
        latencyMs,
      };
    }
  }

  async readiness() {
    const [providers, enabledModels, enabledRoutes, knowledgeBases, queue] =
      await Promise.all([
        this.prisma.serviceProvider.findMany({
          where: { enabled: true },
          select: {
            id: true,
            healthStatus: true,
            encryptedApiKey: true,
            encryptedSecondarySecret: true,
          },
        }),
        this.prisma.serviceModel.count({ where: { enabled: true } }),
        this.prisma.routingPolicy.count({ where: { enabled: true } }),
        this.prisma.knowledgeBase.count({ where: { enabled: true } }),
        this.ingestion.queueStatus(),
      ]);
    const credentialedProviders = providers.filter(
      (provider) =>
        provider.encryptedApiKey || provider.encryptedSecondarySecret,
    ).length;
    const healthyProviders = providers.filter(
      (provider) => provider.healthStatus === ServiceHealthStatus.HEALTHY,
    ).length;
    const vector = this.vectors.status();
    const blockers: string[] = [];
    if (!providers.length) blockers.push('NO_ENABLED_PROVIDER');
    if (providers.length && !credentialedProviders)
      blockers.push('WAITING_FOR_PROVIDER_CREDENTIALS');
    if (!enabledModels) blockers.push('NO_ENABLED_MODEL');
    if (!enabledRoutes) blockers.push('NO_ENABLED_ROUTE');
    if (!healthyProviders) blockers.push('NO_HEALTHY_PROVIDER');
    if (vector.enabled && (!vector.extensionInstalled || !vector.storageReady))
      blockers.push('VECTOR_STORAGE_NOT_READY');
    if (!queue.configured)
      blockers.push('DOCUMENT_WORKER_QUEUE_NOT_CONFIGURED');
    return {
      status: blockers.length ? 'BLOCKED' : 'READY',
      blockers,
      providers: {
        enabled: providers.length,
        credentialed: credentialedProviders,
        healthy: healthyProviders,
      },
      models: { enabled: enabledModels },
      routes: { enabled: enabledRoutes },
      knowledgeBases: { enabled: knowledgeBases },
      vector,
      queue,
      checkedAt: new Date().toISOString(),
    };
  }
  models() {
    return this.prisma.serviceModel.findMany({
      orderBy: [{ providerId: 'asc' }, { internalName: 'asc' }],
      include: {
        provider: {
          select: { id: true, displayNameInternal: true, enabled: true },
        },
      },
    });
  }

  createModel(dto: CreateModelDto) {
    return this.prisma.serviceModel.create({
      data: {
        ...dto,
        healthStatus: dto.enabled
          ? ServiceHealthStatus.DEGRADED
          : ServiceHealthStatus.DISABLED,
      },
    });
  }

  async updateModel(id: string, dto: UpdateModelDto) {
    await this.requireModel(id);
    return this.prisma.serviceModel.update({
      where: { id },
      data: {
        ...dto,
        healthStatus:
          dto.enabled === false ? ServiceHealthStatus.DISABLED : undefined,
      },
    });
  }

  async disableModel(id: string) {
    await this.updateModel(id, { enabled: false });
    return { id, enabled: false };
  }

  async testModel(id: string, actorId: string) {
    const model = await this.prisma.serviceModel.findUnique({
      where: { id },
      include: { provider: true },
    });
    if (!model) throw this.notFound('MODEL_NOT_FOUND');
    return this.testProvider(model.providerId, actorId);
  }

  routes() {
    return this.prisma.routingPolicy.findMany({
      orderBy: [{ taskType: 'asc' }, { nameInternal: 'asc' }],
      include: {
        candidates: {
          orderBy: { priority: 'asc' },
          include: {
            model: {
              select: {
                id: true,
                internalName: true,
                enabled: true,
                healthStatus: true,
              },
            },
          },
        },
      },
    });
  }

  createRoute(dto: CreateRouteDto) {
    const { candidates, ...policy } = dto;
    return this.prisma.routingPolicy.create({
      data: {
        ...policy,
        candidates: { create: candidates },
      },
      include: { candidates: true },
    });
  }

  async updateRoute(id: string, dto: UpdateRouteDto) {
    const { candidates, ...policy } = dto;
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.routingPolicy.findUnique({ where: { id } });
      if (!existing) throw this.notFound('ROUTING_POLICY_NOT_FOUND');
      if (candidates) {
        await tx.routingCandidate.deleteMany({
          where: { routingPolicyId: id },
        });
      }
      return tx.routingPolicy.update({
        where: { id },
        data: {
          ...policy,
          routingVersion: { increment: 1 },
          candidates: candidates ? { create: candidates } : undefined,
        },
        include: { candidates: true },
      });
    });
  }

  prompts() {
    return this.prisma.promptTemplate.findMany({
      orderBy: [{ taskType: 'asc' }, { key: 'asc' }, { version: 'desc' }],
    });
  }

  async createPrompt(actorId: string, dto: CreatePromptDto) {
    const latest = await this.prisma.promptTemplate.aggregate({
      where: { key: dto.key },
      _max: { version: true },
    });
    return this.prisma.promptTemplate.create({
      data: {
        ...dto,
        responseSchemaJson: dto.responseSchemaJson as
          Prisma.InputJsonValue | undefined,
        version: (latest._max.version ?? 0) + 1,
        createdById: actorId,
      },
    });
  }

  async updatePrompt(id: string, actorId: string, dto: UpdatePromptDto) {
    const current = await this.prisma.promptTemplate.findUnique({
      where: { id },
    });
    if (!current) throw this.notFound('PROMPT_NOT_FOUND');
    return this.createPrompt(actorId, {
      key: current.key,
      nameInternal: dto.nameInternal ?? current.nameInternal,
      taskType: current.taskType,
      systemPrompt: dto.systemPrompt ?? current.systemPrompt,
      developerPrompt:
        dto.developerPrompt === undefined
          ? (current.developerPrompt ?? undefined)
          : dto.developerPrompt,
      responseSchemaJson:
        dto.responseSchemaJson ??
        (current.responseSchemaJson as Record<string, unknown> | null) ??
        undefined,
    });
  }

  async activatePrompt(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const prompt = await tx.promptTemplate.findUnique({ where: { id } });
      if (!prompt) throw this.notFound('PROMPT_NOT_FOUND');
      await tx.promptTemplate.updateMany({
        where: { taskType: prompt.taskType, active: true },
        data: { active: false },
      });
      return tx.promptTemplate.update({
        where: { id },
        data: { active: true },
      });
    });
  }

  usagePolicies() {
    return this.prisma.featureUsagePolicy.findMany({
      orderBy: [{ taskType: 'asc' }, { subscriptionTier: 'asc' }],
    });
  }

  async upsertUsagePolicy(
    taskType: ServiceTaskType,
    dto: UpdateUsagePolicyDto,
  ) {
    const subscriptionTier = dto.subscriptionTier ?? null;
    const existing = await this.prisma.featureUsagePolicy.findFirst({
      where: { taskType, subscriptionTier },
      select: { id: true },
    });
    return existing
      ? this.prisma.featureUsagePolicy.update({
          where: { id: existing.id },
          data: dto,
        })
      : this.prisma.featureUsagePolicy.create({
          data: { taskType, ...dto, subscriptionTier },
        });
  }
  async usageOverview() {
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const month = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const [todayLogs, monthCost, processingDocuments] =
      await this.prisma.$transaction([
        this.prisma.serviceRequestLog.findMany({
          where: { createdAt: { gte: today } },
          take: 10_000,
        }),
        this.prisma.serviceRequestLog.aggregate({
          where: {
            createdAt: { gte: month },
            status: ServiceRequestStatus.SUCCEEDED,
          },
          _sum: { estimatedCost: true },
        }),
        this.prisma.knowledgeDocument.count({
          where: {
            status: { in: ['QUEUED', 'EXTRACTING', 'CHUNKING'] },
          },
        }),
      ]);
    const succeeded = todayLogs.filter(
      (log) => log.status === ServiceRequestStatus.SUCCEEDED,
    );
    const failed = todayLogs.filter(
      (log) => log.status === ServiceRequestStatus.FAILED,
    );
    const totalLatency = succeeded.reduce(
      (sum, log) => sum + (log.latencyMs ?? 0),
      0,
    );
    return {
      requestsToday: todayLogs.length,
      succeededToday: succeeded.length,
      failedToday: failed.length,
      averageLatencyMs: succeeded.length
        ? Math.round(totalLatency / succeeded.length)
        : 0,
      costToday: succeeded.reduce(
        (sum, log) => sum + Number(log.estimatedCost),
        0,
      ),
      costMonth: Number(monthCost._sum.estimatedCost ?? 0),
      fallbackRate: succeeded.length
        ? succeeded.filter((log) => log.fallbackCount > 0).length /
          succeeded.length
        : 0,
      cacheHitRate: todayLogs.length
        ? todayLogs.filter((log) => log.cacheHit).length / todayLogs.length
        : 0,
      processingDocuments,
      byTask: this.countBy(todayLogs, (log) => log.taskType),
      recentErrors: failed
        .slice(-20)
        .reverse()
        .map((log) => ({
          requestId: log.requestId,
          taskType: log.taskType,
          errorCode: log.errorCode,
          createdAt: log.createdAt,
        })),
    };
  }

  costs() {
    return this.prisma.serviceRequestLog.groupBy({
      by: ['selectedProviderId', 'selectedModelId'],
      where: { status: ServiceRequestStatus.SUCCEEDED },
      _sum: {
        estimatedCost: true,
        inputTokenCount: true,
        outputTokenCount: true,
      },
      _count: true,
    });
  }

  health() {
    return this.prisma.serviceProvider.findMany({
      orderBy: { priority: 'asc' },
      select: {
        id: true,
        displayNameInternal: true,
        enabled: true,
        healthStatus: true,
        healthScore: true,
        lastHealthCheckAt: true,
        models: {
          select: {
            id: true,
            internalName: true,
            enabled: true,
            healthStatus: true,
            averageLatencyMs: true,
            successRate: true,
          },
        },
      },
    });
  }

  logs(query: AdminLogQueryDto) {
    return this.prisma.serviceRequestLog.findMany({
      take: query.limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  knowledgeBases() {
    return this.knowledge.list();
  }

  createKnowledgeBase(dto: CreateKnowledgeBaseDto) {
    return this.knowledge.create({
      ...dto,
      retrievalSettings: dto.retrievalSettings as
        Prisma.InputJsonValue | undefined,
    });
  }

  updateKnowledgeBase(id: string, dto: UpdateKnowledgeBaseDto) {
    return this.knowledge.update(id, {
      ...dto,
      retrievalSettings: dto.retrievalSettings as
        Prisma.InputJsonValue | undefined,
    });
  }

  disableKnowledgeBase(id: string) {
    return this.knowledge.update(id, { enabled: false });
  }

  documents(knowledgeBaseId: string) {
    return this.knowledge.documents(knowledgeBaseId);
  }

  document(id: string) {
    return this.prisma.knowledgeDocument.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        knowledgeBaseId: true,
        title: true,
        originalFileName: true,
        mimeType: true,
        fileSize: true,
        status: true,
        enabled: true,
        language: true,
        pageCount: true,
        chunkCount: true,
        subjectId: true,
        unitId: true,
        lessonId: true,
        sourceId: true,
        extractionError: true,
        createdAt: true,
        processedAt: true,
      },
    });
  }

  uploadDocument(
    id: string,
    actorId: string,
    dto: KnowledgeUploadDto,
    file: Express.Multer.File,
  ) {
    return this.knowledge.upload(id, actorId, { ...dto, file });
  }

  reprocessDocument(id: string) {
    return this.knowledge.reprocess(id);
  }

  archiveDocument(id: string) {
    return this.knowledge.archive(id);
  }

  testSearch(knowledgeBaseId: string, dto: SearchKnowledgeDto) {
    return this.retrieval.search(dto.query, {
      knowledgeBaseId,
      allowAdminPrivate: true,
      limit: 10,
      minimumScore: 0,
    });
  }

  private providerView(provider: {
    id: string;
    key: string;
    displayNameInternal: string;
    providerType: string;
    baseUrl: string;
    authType: string;
    secretLastFour: string | null;
    encryptedApiKey: string | null;
    encryptedSecondarySecret: string | null;
    enabled: boolean;
    priority: number;
    timeoutMs: number;
    maxRetries: number;
    supportsStreaming: boolean;
    healthStatus: string;
    healthScore: number;
    lastHealthCheckAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: { models: number };
  }) {
    return {
      id: provider.id,
      key: provider.key,
      displayNameInternal: provider.displayNameInternal,
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      authType: provider.authType,
      credentialConfigured: Boolean(
        provider.encryptedApiKey || provider.encryptedSecondarySecret,
      ),
      credentialMasked: provider.secretLastFour
        ? `••••••••${provider.secretLastFour}`
        : null,
      enabled: provider.enabled,
      priority: provider.priority,
      timeoutMs: provider.timeoutMs,
      maxRetries: provider.maxRetries,
      supportsStreaming: provider.supportsStreaming,
      healthStatus: provider.healthStatus,
      healthScore: provider.healthScore,
      lastHealthCheckAt: provider.lastHealthCheckAt,
      modelCount: provider._count?.models,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }

  private providerConfiguration(provider: {
    id: string;
    providerType: ProviderConfiguration['providerType'];
    baseUrl: string;
    authType: ProviderConfiguration['authType'];
    timeoutMs: number;
    maxRetries: number;
    encryptedApiKey: string | null;
    encryptedSecondarySecret: string | null;
    metadataJson: Prisma.JsonValue | null;
  }): ProviderConfiguration {
    return {
      id: provider.id,
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      authType: provider.authType,
      timeoutMs: provider.timeoutMs,
      maxRetries: provider.maxRetries,
      apiKey: provider.encryptedApiKey
        ? this.encryption.decrypt(provider.encryptedApiKey)
        : undefined,
      secondarySecret: provider.encryptedSecondarySecret
        ? this.encryption.decrypt(provider.encryptedSecondarySecret)
        : undefined,
      metadata:
        typeof provider.metadataJson === 'object' &&
        provider.metadataJson !== null &&
        !Array.isArray(provider.metadataJson)
          ? provider.metadataJson
          : {},
    };
  }

  private async requireModel(id: string): Promise<void> {
    const model = await this.prisma.serviceModel.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!model) throw this.notFound('MODEL_NOT_FOUND');
  }

  private async setHealth(
    providerId: string,
    modelId: string,
    healthy: boolean,
  ) {
    const healthStatus = healthy
      ? ServiceHealthStatus.HEALTHY
      : ServiceHealthStatus.UNAVAILABLE;
    await this.prisma.$transaction([
      this.prisma.serviceProvider.update({
        where: { id: providerId },
        data: {
          healthStatus,
          healthScore: healthy ? 100 : 0,
          lastHealthCheckAt: new Date(),
        },
      }),
      this.prisma.serviceModel.update({
        where: { id: modelId },
        data: { healthStatus },
      }),
    ]);
  }

  private credentialAudit(
    providerId: string,
    actorId: string,
    action: ProviderCredentialAuditAction,
    secretLastFour: string | undefined,
    succeeded: boolean,
    errorCode?: string,
  ) {
    return this.prisma.providerCredentialAudit.create({
      data: {
        providerId,
        actorId,
        action,
        secretLastFour,
        succeeded,
        errorCode,
      },
    });
  }

  private countBy<T>(items: T[], key: (item: T) => string) {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const value = key(item);
      counts[value] = (counts[value] ?? 0) + 1;
    }
    return counts;
  }

  private notFound(code: string) {
    return new NotFoundException({ code, message: 'Resource was not found' });
  }
}
