import 'dotenv/config';
import pg from 'pg';

const connectionString =
  process.env.DATABASE_URL_VERIFY ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const client = new pg.Client({ connectionString });
await client.connect();
try {
  const checks = await client.query(`
    SELECT
      current_setting('server_version') AS "postgresVersion",
      EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS "vectorInstalled",
      EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') AS "vectorAvailable",
      to_regclass('"KnowledgeChunkEmbedding"') IS NOT NULL AS "embeddingMetadataReady",
      to_regclass('"KnowledgeChunkVector"') IS NOT NULL AS "vectorStorageReady",
      to_regclass('"KnowledgeChunk_searchVector_gin_idx"') IS NOT NULL AS "keywordIndexReady"
  `);
  const integrity = await client.query(`
    SELECT
      (SELECT count(*)::int FROM "KnowledgeDocument") AS "documents",
      (SELECT count(*)::int FROM "KnowledgeChunk") AS "chunks",
      (SELECT count(*)::int FROM "KnowledgeChunkEmbedding") AS "embeddings",
      (
        SELECT count(*)::int
        FROM "KnowledgeChunk" c
        LEFT JOIN "KnowledgeDocument" d ON d.id = c."documentId"
        WHERE d.id IS NULL
      ) AS "orphanChunks"
  `);
  console.log(JSON.stringify({ checks: checks.rows[0], integrity: integrity.rows[0] }));
  if (!checks.rows[0].embeddingMetadataReady || !checks.rows[0].keywordIndexReady) {
    process.exitCode = 1;
  }
  if (integrity.rows[0].orphanChunks !== 0) process.exitCode = 1;
} finally {
  await client.end();
}
