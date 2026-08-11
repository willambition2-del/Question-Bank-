import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import {
  OWNER_APPROVED_FULL_IMPORT,
  TrustedQuestionDatabaseImportService,
} from '../content/question-imports/trusted-question-database-import.service';
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  providers: [TrustedQuestionDatabaseImportService],
})
class TrustedImportCliModule {}

const value = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
async function main() {
  const jobId = value('--job-id'),
    actorId = value('--actor-id'),
    confirmation = value('--confirmation');
  if (!jobId || !actorId || confirmation !== OWNER_APPROVED_FULL_IMPORT)
    throw new Error(
      'Required: --job-id --actor-id --confirmation OWNER_APPROVED_FULL_IMPORT',
    );
  const app = await NestFactory.createApplicationContext(
    TrustedImportCliModule,
  );
  try {
    console.log(
      JSON.stringify(
        await app
          .get(TrustedQuestionDatabaseImportService)
          .execute(jobId, actorId, confirmation),
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}
void main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
