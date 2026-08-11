import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

export interface NormalizedImage {
  buffer: Buffer;
  mimeType: 'image/jpeg';
  checksum: string;
  width: number;
  height: number;
}

@Injectable()
export class ImageUploadValidator {
  constructor(private readonly config: ConfigService) {}

  async normalize(file?: Express.Multer.File): Promise<NormalizedImage> {
    if (!file?.buffer?.length) throw this.invalid('IMAGE_UNSUPPORTED');
    const maxBytes =
      this.config.get<number>('IMAGE_MAX_SIZE_MB', 8) * 1024 * 1024;
    if (file.size !== file.buffer.length || file.size > maxBytes) {
      throw this.invalid('IMAGE_TOO_LARGE');
    }
    const detected = this.detectedMime(file.buffer);
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!detected || !allowed.has(detected) || detected !== file.mimetype) {
      throw this.invalid('IMAGE_UNSUPPORTED');
    }
    const maxPixels = this.config.get<number>('IMAGE_MAX_PIXELS', 25_000_000);
    const pipeline = sharp(file.buffer, {
      failOn: 'error',
      limitInputPixels: maxPixels,
      sequentialRead: true,
    });
    const metadata = await pipeline.metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > maxPixels ||
      (metadata.pages ?? 1) > 1
    ) {
      throw this.invalid('IMAGE_UNSUPPORTED');
    }
    const maxDimension = this.config.get<number>('IMAGE_MAX_DIMENSION', 4096);
    const normalized = await pipeline
      .rotate()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return {
      buffer: normalized.data,
      mimeType: 'image/jpeg',
      checksum: createHash('sha256').update(normalized.data).digest('hex'),
      width: normalized.info.width,
      height: normalized.info.height,
    };
  }

  private detectedMime(buffer: Buffer): string | null {
    if (buffer.subarray(0, 3).toString('hex') === 'ffd8ff') {
      return 'image/jpeg';
    }
    if (buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
      return 'image/png';
    }
    if (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp';
    }
    return null;
  }
  private invalid(code: string) {
    return new BadRequestException({
      code,
      message: 'The uploaded question image is invalid or unsupported',
    });
  }
}
