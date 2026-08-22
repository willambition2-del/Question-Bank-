import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudyResourceDto } from './dto/create-study-resource.dto';
import { UpdateStudyResourceDto } from './dto/update-study-resource.dto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GradeLevel } from '../generated/prisma/enums';

@Injectable()
export class StudyResourcesService {
  private readonly s3: S3Client | null = null;
  private readonly bucket: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const driver = this.config.get<'local' | 's3'>('STORAGE_DRIVER', 'local');
    if (driver === 's3') {
      this.bucket = this.config.get<string>('S3_BUCKET');
      const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
      const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
      this.s3 = new S3Client({
        region: this.config.get<string>('S3_REGION', 'auto'),
        endpoint: this.config.get<string>('S3_ENDPOINT') || undefined,
        forcePathStyle: this.config.get<boolean>('S3_FORCE_PATH_STYLE', false),
        credentials:
          accessKeyId && secretAccessKey
            ? { accessKeyId, secretAccessKey }
            : undefined,
      });
    }
  }

  // --- Client Methods ---

  private async getStudentGradeLevel(userId?: string): Promise<GradeLevel> {
    if (!userId) return GradeLevel.THIRD_SECONDARY;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { gradeLevel: true },
    });
    return user?.gradeLevel ?? GradeLevel.THIRD_SECONDARY;
  }

  async getSubjectsWithResources(userId?: string) {
    const userGrade = await this.getStudentGradeLevel(userId);
    return this.prisma.subject.findMany({
      where: {
        isActive: true,
        isPublished: true,
        deletedAt: null,
        grade: { isActive: true, deletedAt: null, code: userGrade },
      },
      select: {
        id: true,
        name: true,
        iconKey: true,
        colorHex: true,
        coverImageUrl: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getResourcesBySubject(subjectId: string, userId?: string) {
    const userGrade = await this.getStudentGradeLevel(userId);
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: subjectId,
        isActive: true,
        isPublished: true,
        deletedAt: null,
        grade: { isActive: true, deletedAt: null, code: userGrade },
      },
      select: { id: true },
    });
    if (!subject) {
      return [];
    }

    return this.prisma.studyResource.findMany({
      where: {
        subjectId,
        isPublished: true,
      },
      orderBy: [
        { category: 'asc' },
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async getDownloadUrl(id: string) {
    const resource = await this.prisma.studyResource.findUnique({
      where: { id },
    });
    if (!resource || !resource.isPublished) {
      throw new NotFoundException('Resource not found');
    }

    // Increment download count (fire and forget)
    this.prisma.studyResource
      .update({
        where: { id },
        data: { downloadCount: { increment: 1 } },
      })
      .catch(() => {});

    if (!this.s3) {
      // For local development, assume files are served statically from a local path
      return { url: `/local-storage/${resource.fileKey}` };
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: resource.fileKey,
    });
    const url = await getSignedUrl(this.s3, command, { expiresIn: 3600 });
    return { url };
  }

  // --- Admin Methods ---

  async findAllAdmin(subjectId?: string, category?: string) {
    return this.prisma.studyResource.findMany({
      where: {
        ...(subjectId && { subjectId }),
        ...(category && { category: category as any }),
      },
      include: {
        subject: { select: { name: true } },
      },
      orderBy: [{ subject: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });
  }

  async getUploadUrl(fileName: string, mimeType: string) {
    if (!this.s3) {
      throw new Error('S3/R2 storage is not configured.');
    }
    const key = `curriculum/${Date.now()}-${Math.random().toString(36).substring(7)}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 3600 });
    return { uploadUrl, fileKey: key };
  }

  async create(data: CreateStudyResourceDto) {
    return this.prisma.studyResource.create({
      data,
    });
  }

  async update(id: string, data: UpdateStudyResourceDto | { isPublished: boolean }) {
    return this.prisma.studyResource.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.studyResource.delete({
      where: { id },
    });
  }
}
