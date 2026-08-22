import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface UploadedSubjectImageFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class SubjectImageService {
  private readonly s3: S3Client | null = null;
  private readonly bucket: string | undefined;
  private readonly publicBaseUrl: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const driver = this.config.get<'local' | 's3'>('STORAGE_DRIVER', 'local');
    if (driver === 's3') {
      this.bucket = this.config.get<string>('S3_BUCKET');
      this.publicBaseUrl = this.config.get<string>('S3_PUBLIC_BASE_URL');
      const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
      const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
      if (accessKeyId && secretAccessKey && this.bucket) {
        this.s3 = new S3Client({
          region: this.config.get<string>('S3_REGION', 'auto'),
          endpoint: this.config.get<string>('S3_ENDPOINT') || undefined,
          forcePathStyle: this.config.get<boolean>('S3_FORCE_PATH_STYLE', false),
          credentials: { accessKeyId, secretAccessKey },
        });
      }
    }
  }

  async uploadCoverImage(
    subjectId: string,
    file?: UploadedSubjectImageFile,
  ): Promise<{ coverImageUrl: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException({
        code: 'IMAGE_FILE_REQUIRED',
        message: 'A valid image file is required',
      });
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'IMAGE_TOO_LARGE',
        message: 'Image size cannot exceed 5MB',
      });
    }

    const mime = file.mimetype?.toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(mime)) {
      throw new BadRequestException({
        code: 'INVALID_IMAGE_TYPE',
        message: 'Only JPG, JPEG, PNG, and WEBP image formats are supported',
      });
    }

    const rawExt = extname(file.originalname || '').toLowerCase();
    const ext = ALLOWED_EXTENSIONS.includes(rawExt)
      ? rawExt
      : mime === 'image/png'
        ? '.png'
        : mime === 'image/webp'
          ? '.webp'
          : '.jpg';

    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });
    if (!subject || subject.deletedAt) {
      throw new NotFoundException({
        code: 'SUBJECT_NOT_FOUND',
        message: 'Subject not found',
      });
    }

    let coverImageUrl: string;

    if (this.s3 && this.bucket) {
      const key = `subjects/covers/${subjectId}-${Date.now()}${ext}`;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: mime,
        }),
      );

      if (this.publicBaseUrl) {
        coverImageUrl = `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
      } else {
        const endpoint = this.config.get<string>('S3_ENDPOINT', '');
        coverImageUrl = endpoint
          ? `${endpoint.replace(/\/$/, '')}/${this.bucket}/${key}`
          : `https://${this.bucket}.s3.amazonaws.com/${key}`;
      }
    } else {
      // Local storage driver
      const uploadDir = join(process.cwd(), 'uploads', 'subjects');
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `${subjectId}-${Date.now()}${ext}`;
      const filePath = join(uploadDir, filename);
      writeFileSync(filePath, file.buffer);

      // Clean up previous local file if applicable
      if (subject.coverImageUrl?.startsWith('/uploads/subjects/')) {
        const prevFilename = subject.coverImageUrl.replace('/uploads/subjects/', '');
        const prevPath = join(uploadDir, prevFilename);
        if (existsSync(prevPath)) {
          try {
            unlinkSync(prevPath);
          } catch {
            // Ignore cleanup failure
          }
        }
      }

      coverImageUrl = `/uploads/subjects/${filename}`;
    }

    await this.prisma.subject.update({
      where: { id: subjectId },
      data: { coverImageUrl },
    });

    return { coverImageUrl };
  }

  async deleteCoverImage(subjectId: string): Promise<{ success: boolean }> {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });
    if (!subject || subject.deletedAt) {
      throw new NotFoundException({
        code: 'SUBJECT_NOT_FOUND',
        message: 'Subject not found',
      });
    }

    if (subject.coverImageUrl?.startsWith('/uploads/subjects/')) {
      const filename = subject.coverImageUrl.replace('/uploads/subjects/', '');
      const filePath = join(process.cwd(), 'uploads', 'subjects', filename);
      if (existsSync(filePath)) {
        try {
          unlinkSync(filePath);
        } catch {
          // Ignore
        }
      }
    }

    await this.prisma.subject.update({
      where: { id: subjectId },
      data: { coverImageUrl: null },
    });

    return { success: true };
  }
}
