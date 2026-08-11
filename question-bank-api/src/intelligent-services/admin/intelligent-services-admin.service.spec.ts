import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { CredentialEncryptionService } from '../credentials/credential-encryption.service';
import { KnowledgeBaseService } from '../knowledge/knowledge-base.service';
import { DocumentIngestionService } from '../knowledge/document-ingestion.service';
import { KnowledgeRetrievalService } from '../knowledge/knowledge-retrieval.service';
import { VectorExtensionService } from '../knowledge/vector-extension.service';
import { ProviderAdapterRegistry } from '../providers/provider-adapter.registry';
import { ProviderUrlSecurityService } from '../providers/provider-url-security.service';
import {
  IntelligentServicesAdminController,
  KnowledgeAdminController,
} from './intelligent-services-admin.controller';
import { IntelligentServicesAdminService } from './intelligent-services-admin.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('IntelligentServicesAdminService', () => {
  const findProviders = jest.fn();
  const service = new IntelligentServicesAdminService(
    {
      serviceProvider: { findMany: findProviders },
    } as unknown as PrismaService,
    {} as CredentialEncryptionService,
    {} as ProviderUrlSecurityService,
    {} as ProviderAdapterRegistry,
    {} as KnowledgeBaseService,
    {} as DocumentIngestionService,
    {} as VectorExtensionService,
    {} as KnowledgeRetrievalService,
  );

  it('never returns ciphertext or a complete credential', async () => {
    findProviders.mockResolvedValue([
      {
        id: 'provider-1',
        key: 'provider_key',
        displayNameInternal: 'Internal provider',
        providerType: 'OPENAI_COMPATIBLE',
        baseUrl: 'https://example.com/v1',
        authType: 'BEARER',
        encryptedApiKey: 'v1.primary.secret-ciphertext',
        encryptedSecondarySecret: null,
        secretLastFour: '1234',
        enabled: true,
        priority: 1,
        timeoutMs: 30_000,
        maxRetries: 1,
        supportsStreaming: false,
        healthStatus: 'HEALTHY',
        healthScore: 100,
        lastHealthCheckAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { models: 2 },
      },
    ]);

    const result = await service.providers();
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('secret-ciphertext');
    expect(serialized).not.toContain('encryptedApiKey');
    expect(result[0]).toEqual(
      expect.objectContaining({
        credentialConfigured: true,
        credentialMasked: '••••••••1234',
      }),
    );
  });
});

describe('provider onboarding readiness', () => {
  const prisma = {
    serviceProvider: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    serviceModel: { count: jest.fn() },
    routingPolicy: { count: jest.fn() },
    knowledgeBase: { count: jest.fn() },
  };
  const adapter = { listModels: jest.fn() };
  const onboarding = new IntelligentServicesAdminService(
    prisma as unknown as PrismaService,
    {
      decrypt: jest.fn(() => 'private-key'),
    } as unknown as CredentialEncryptionService,
    {} as ProviderUrlSecurityService,
    { get: jest.fn(() => adapter) } as unknown as ProviderAdapterRegistry,
    {} as KnowledgeBaseService,
    {} as KnowledgeRetrievalService,
    {
      queueStatus: jest.fn(() =>
        Promise.resolve({
          configured: true,
          mode: 'bullmq',
          waiting: 0,
          active: 0,
          delayed: 0,
          failed: 0,
          completed: 0,
        }),
      ),
    } as unknown as DocumentIngestionService,
    {
      status: jest.fn(() => ({
        enabled: true,
        extensionInstalled: true,
        storageReady: true,
        dimensions: 1536,
      })),
    } as unknown as VectorExtensionService,
  );

  it('discovers, normalizes and limits remote model identifiers', async () => {
    prisma.serviceProvider.findUnique.mockResolvedValue({
      id: 'provider-1',
      providerType: 'OPENAI_COMPATIBLE',
      baseUrl: 'https://example.com/v1',
      authType: 'BEARER',
      timeoutMs: 30000,
      maxRetries: 2,
      encryptedApiKey: 'ciphertext',
      encryptedSecondarySecret: null,
      metadataJson: null,
    });
    adapter.listModels.mockResolvedValue([' model-b ', 'model-a', 'model-a']);
    await expect(
      onboarding.discoverProviderModels('provider-1'),
    ).resolves.toEqual({
      providerId: 'provider-1',
      models: ['model-a', 'model-b'],
    });
  });

  it('reports credential waiting without exposing encrypted values', async () => {
    prisma.serviceProvider.findMany.mockResolvedValue([
      {
        id: 'provider-1',
        healthStatus: 'DEGRADED',
        encryptedApiKey: null,
        encryptedSecondarySecret: null,
      },
    ]);
    prisma.serviceModel.count.mockResolvedValue(0);
    prisma.routingPolicy.count.mockResolvedValue(0);
    prisma.knowledgeBase.count.mockResolvedValue(0);
    const result = await onboarding.readiness();
    expect(result.blockers).toContain('WAITING_FOR_PROVIDER_CREDENTIALS');
    expect(JSON.stringify(result)).not.toContain('encryptedApiKey');
  });
});
describe('intelligent services admin authorization metadata', () => {
  it.each([IntelligentServicesAdminController, KnowledgeAdminController])(
    'restricts %p to SUPER_ADMIN',
    (controller) => {
      expect(Reflect.getMetadata(ROLES_KEY, controller)).toEqual([
        UserRole.SUPER_ADMIN,
      ]);
    },
  );
});
