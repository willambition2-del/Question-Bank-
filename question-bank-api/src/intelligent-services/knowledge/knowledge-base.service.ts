import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  KnowledgeBaseScope,
  KnowledgeDocumentStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { randomUUID } from 'node:crypto';
import { DocumentFileValidator } from './document-file-validator.service';
import { DocumentIngestionService } from './document-ingestion.service';
import { DocumentStorageService } from './document-storage.service';

export interface KnowledgeUpload {
  title: string;
  language: string;
  subjectId?: string;
  unitId?: string;
  lessonId?: string;
  sourceId?: string;
  file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  };
}

@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: DocumentFileValidator,
    private readonly storage: DocumentStorageService,
    private readonly ingestion: DocumentIngestionService,
  ) {}

  list() {
    return this.prisma.knowledgeBase.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { documents: true, chunks: true } },
      },
    });
  }

  create(input: {
    name: string;
    description?: string;
    scope: KnowledgeBaseScope;
    subjectId?: string;
    gradeId?: string;
    language?: string;
    retrievalSettings?: Prisma.InputJsonValue;
  }) {
    return this.prisma.knowledgeBase.create({
      data: {
        name: input.name,
        description: input.description,
        scope: input.scope,
        subjectId: input.subjectId,
        gradeId: input.gradeId,
        language: input.language ?? 'ar',
        retrievalSettingsJson: input.retrievalSettings,
      },
    });
  }

  async update(
    id: string,
    input: {
      name?: string;
      description?: string;
      enabled?: boolean;
      retrievalSettings?: Prisma.InputJsonValue;
    },
  ) {
    await this.require(id);
    return this.prisma.knowledgeBase.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        enabled: input.enabled,
        retrievalSettingsJson: input.retrievalSettings,
        version:
          input.retrievalSettings === undefined ? undefined : { increment: 1 },
      },
    });
  }

  documents(knowledgeBaseId: string) {
    return this.prisma.knowledgeDocument.findMany({
      where: { knowledgeBaseId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
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

  async upload(
    knowledgeBaseId: string,
    actorId: string,
    input: KnowledgeUpload,
  ) {
    await this.require(knowledgeBaseId);
    const validated = this.validator.validate(input.file);
    const id = randomUUID();
    const path = await this.storage.store(
      id,
      validated.extension,
      input.file.buffer,
    );
    try {
      const document = await this.prisma.knowledgeDocument.create({
        data: {
          id,
          knowledgeBaseId,
          title: input.title,
          originalFileName: input.file.originalname,
          storagePath: path,
          mimeType: input.file.mimetype,
          fileSize: input.file.size,
          checksum: validated.checksum,
          language: input.language,
          subjectId: input.subjectId,
          unitId: input.unitId,
          lessonId: input.lessonId,
          sourceId: input.sourceId,
          uploadedById: actorId,
        },
      });
      await this.ingestion.enqueue(document.id);
      return {
        id: document.id,
        status: KnowledgeDocumentStatus.QUEUED,
      };
    } catch (error: unknown) {
      await this.storage.remove(path);
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'KNOWLEDGE_DOCUMENT_DUPLICATE',
          message: 'This document already exists in the knowledge base',
        });
      }
      throw error;
    }
  }

  async reprocess(id: string) {
    await this.prisma.knowledgeDocument.findUniqueOrThrow({ where: { id } });
    await this.ingestion.enqueue(id);
    return { id, status: KnowledgeDocumentStatus.QUEUED };
  }

  async archive(id: string) {
    return this.prisma.knowledgeDocument.update({
      where: { id },
      data: {
        status: KnowledgeDocumentStatus.ARCHIVED,
        enabled: false,
      },
      select: { id: true, status: true, enabled: true },
    });
  }

  private async require(id: string): Promise<void> {
    const value = await this.prisma.knowledgeBase.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!value) throw new NotFoundException('Knowledge base not found');
  }
}
