ALTER TYPE "KnowledgeDocumentStatus" ADD VALUE IF NOT EXISTS 'OCR_REQUIRED';
ALTER TYPE "KnowledgeDocumentStatus" ADD VALUE IF NOT EXISTS 'OCR_PROCESSING';
ALTER TYPE "KnowledgeDocumentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_READY';

CREATE TYPE "KnowledgeEmbeddingStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

ALTER TABLE "KnowledgeDocument"
ADD COLUMN "embeddedChunkCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "failedChunkCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "embeddingModelVersion" TEXT,
ADD COLUMN "lastEmbeddedAt" TIMESTAMP(3),
ADD COLUMN "ocrPageCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "KnowledgeChunkEmbedding" (
  "id" TEXT NOT NULL,
  "chunkId" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "dimensions" INTEGER NOT NULL,
  "contentChecksum" TEXT NOT NULL,
  "status" "KnowledgeEmbeddingStatus" NOT NULL DEFAULT 'PENDING',
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeChunkEmbedding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KnowledgeChunkEmbedding_chunkId_fkey"
    FOREIGN KEY ("chunkId") REFERENCES "KnowledgeChunk"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "KnowledgeChunkEmbedding_modelId_fkey"
    FOREIGN KEY ("modelId") REFERENCES "ServiceModel"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "KnowledgeChunkEmbedding_chunkId_modelId_key"
ON "KnowledgeChunkEmbedding"("chunkId", "modelId");
CREATE INDEX "KnowledgeChunkEmbedding_modelId_dimensions_status_idx"
ON "KnowledgeChunkEmbedding"("modelId", "dimensions", "status");
CREATE INDEX "KnowledgeChunkEmbedding_chunkId_status_idx"
ON "KnowledgeChunkEmbedding"("chunkId", "status");

ALTER TABLE "KnowledgeChunk"
ADD COLUMN "searchVector" tsvector
GENERATED ALWAYS AS (to_tsvector('simple', coalesce("content", ''))) STORED;

CREATE INDEX "KnowledgeChunk_searchVector_gin_idx"
ON "KnowledgeChunk" USING GIN ("searchVector");
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'vector'
  ) THEN
    CREATE EXTENSION IF NOT EXISTS vector;
    EXECUTE '
      CREATE TABLE IF NOT EXISTS "KnowledgeChunkVector" (
        "embeddingId" TEXT PRIMARY KEY
          REFERENCES "KnowledgeChunkEmbedding"("id") ON DELETE CASCADE,
        "embedding" vector NOT NULL
      )';
    EXECUTE '
      CREATE INDEX IF NOT EXISTS "KnowledgeChunkVector_embedding_1536_hnsw_idx"
      ON "KnowledgeChunkVector"
      USING hnsw ((embedding::vector(1536)) vector_cosine_ops)
      WHERE vector_dims(embedding) = 1536';
  END IF;
END
$$;
