import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve, sep } from 'node:path';

@Injectable()
export class DocumentStorageService {
  private readonly root: string;
  private readonly driver: 'local' | 's3';
  private readonly bucket?: string;
  private readonly s3?: S3Client;

  constructor(private readonly config: ConfigService) {
    const configured = config.get<string>(
      'DOCUMENT_STORAGE_PATH',
      './storage/knowledge',
    );
    this.driver = config.get<'local' | 's3'>('STORAGE_DRIVER', 'local');
    if (!['local', 's3'].includes(this.driver)) {
      throw new Error('STORAGE_DRIVER must be local or s3');
    }
    if (
      this.driver === 'local' &&
      config.get<string>('NODE_ENV') === 'production' &&
      !isAbsolute(configured)
    ) {
      throw new Error('DOCUMENT_STORAGE_PATH must be absolute in production');
    }
    this.root = resolve(configured);
    if (this.driver === 's3') {
      this.bucket = config.get<string>('S3_BUCKET');
      if (!this.bucket) throw new Error('S3_BUCKET is required for s3 storage');
      const accessKeyId = config.get<string>('S3_ACCESS_KEY_ID');
      const secretAccessKey = config.get<string>('S3_SECRET_ACCESS_KEY');
      this.s3 = new S3Client({
        region: config.get<string>('S3_REGION', 'auto'),
        endpoint: config.get<string>('S3_ENDPOINT') || undefined,
        forcePathStyle: config.get<boolean>('S3_FORCE_PATH_STYLE', false),
        credentials:
          accessKeyId && secretAccessKey
            ? { accessKeyId, secretAccessKey }
            : undefined,
      });
    }
  }

  async store(
    documentId: string,
    extension: string,
    buffer: Buffer,
  ): Promise<string> {
    const key = `${documentId.slice(0, 2)}/${documentId}.${extension}`;
    if (this.driver === 's3') {
      await this.s3!.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: this.contentType(extension),
          ServerSideEncryption: this.config.get<string>(
            'S3_SERVER_SIDE_ENCRYPTION',
            'AES256',
          ) as 'AES256',
        }),
      );
      return `s3://${this.bucket}/${key}`;
    }
    const directory = join(this.root, documentId.slice(0, 2));
    await mkdir(directory, { recursive: true });
    const path = join(directory, `${documentId}.${extension}`);
    this.assertWithinRoot(path);
    await writeFile(path, buffer, { flag: 'wx', mode: 0o600 });
    return path;
  }

  async read(path: string): Promise<Buffer> {
    if (path.startsWith('s3://')) {
      const key = this.s3Key(path);
      const response = await this.s3!.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!response.Body) throw new Error('STORAGE_OBJECT_EMPTY');
      return Buffer.from(await response.Body.transformToByteArray());
    }
    this.assertWithinRoot(path);
    return readFile(path);
  }

  async remove(path: string): Promise<void> {
    if (path.startsWith('s3://')) {
      await this.s3!.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: this.s3Key(path),
        }),
      );
      return;
    }
    this.assertWithinRoot(path);
    await unlink(path).catch((error: unknown) => {
      if (
        typeof error !== 'object' ||
        error === null ||
        !('code' in error) ||
        error.code !== 'ENOENT'
      ) {
        throw error;
      }
    });
  }

  private s3Key(path: string): string {
    if (!this.s3 || !this.bucket) throw new Error('S3_STORAGE_NOT_CONFIGURED');
    const prefix = `s3://${this.bucket}/`;
    if (!path.startsWith(prefix)) throw new Error('S3_STORAGE_BUCKET_MISMATCH');
    const key = path.slice(prefix.length);
    if (!/^[a-f0-9]{2}\/[a-f0-9-]+\.[a-z0-9]+$/i.test(key)) {
      throw new Error('S3_STORAGE_KEY_INVALID');
    }
    return key;
  }

  private contentType(extension: string): string {
    return (
      {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        txt: 'text/plain',
        markdown: 'text/markdown',
      }[extension] ?? 'application/octet-stream'
    );
  }

  private assertWithinRoot(path: string): void {
    const resolved = resolve(path);
    if (resolved !== this.root && !resolved.startsWith(`${this.root}${sep}`)) {
      throw new Error('Document storage path escaped its configured root');
    }
  }
}
