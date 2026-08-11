import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface VectorHealth {
  enabled: boolean;
  extensionInstalled: boolean;
  storageReady: boolean;
  dimensions: number;
}

@Injectable()
export class VectorExtensionService implements OnModuleInit {
  private health: VectorHealth = {
    enabled: false,
    extensionInstalled: false,
    storageReady: false,
    dimensions: 1536,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const enabled = this.vectorSearchEnabled();
    const dimensions = this.config.get<number>('VECTOR_DIMENSIONS', 1536);
    if (!enabled) {
      this.health = {
        enabled: false,
        extensionInstalled: false,
        storageReady: false,
        dimensions,
      };
      return;
    }
    const [status] = await this.prisma.$queryRaw<
      Array<{ extensionInstalled: boolean; storageReady: boolean }>
    >`
      SELECT
        EXISTS (
          SELECT 1 FROM pg_extension WHERE extname = 'vector'
        ) AS "extensionInstalled",
        to_regclass('"KnowledgeChunkVector"') IS NOT NULL AS "storageReady"
    `;
    this.health = {
      enabled: true,
      extensionInstalled: status?.extensionInstalled ?? false,
      storageReady: status?.storageReady ?? false,
      dimensions,
    };
    if (!this.health.extensionInstalled || !this.health.storageReady) {
      throw new Error(
        'VECTOR_SEARCH_ENABLED requires pgvector and KnowledgeChunkVector storage',
      );
    }
  }

  status(): VectorHealth {
    return { ...this.health };
  }

  assertReady(): void {
    if (!this.health.enabled || !this.health.storageReady) {
      throw new Error('VECTOR_SEARCH_NOT_READY');
    }
  }

  private vectorSearchEnabled(): boolean {
    const value = this.config.get<boolean | string>(
      'VECTOR_SEARCH_ENABLED',
      false,
    );
    return value === true || value === 'true';
  }
}
