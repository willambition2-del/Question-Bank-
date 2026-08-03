import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { ImageUploadValidator } from './image-upload-validator.service';

describe('ImageUploadValidator', () => {
  const validator = new ImageUploadValidator(
    new ConfigService({
      IMAGE_MAX_SIZE_MB: 2,
      IMAGE_MAX_PIXELS: 1_000_000,
      IMAGE_MAX_DIMENSION: 800,
    }),
  );

  it('sniffs, strips metadata, and normalizes an allowed image', async () => {
    const buffer = await sharp({
      create: {
        width: 1200,
        height: 600,
        channels: 3,
        background: 'white',
      },
    })
      .png()
      .withMetadata({ comment: 'private metadata' })
      .toBuffer();

    const result = await validator.normalize(file(buffer, 'image/png'));

    expect(result.mimeType).toBe('image/jpeg');
    expect(result.width).toBe(800);
    expect(result.height).toBe(400);
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.format).toBe('jpeg');
    expect(metadata.comments).toBeUndefined();
  });

  it('rejects a MIME claim that does not match magic bytes', async () => {
    const buffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: 'white',
      },
    })
      .png()
      .toBuffer();

    await expect(
      validator.normalize(file(buffer, 'image/jpeg')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects dimensions above the decompression-bomb limit', async () => {
    const buffer = await sharp({
      create: {
        width: 1100,
        height: 1000,
        channels: 3,
        background: 'white',
      },
    })
      .jpeg()
      .toBuffer();

    await expect(
      validator.normalize(file(buffer, 'image/jpeg')),
    ).rejects.toBeInstanceOf(Error);
  });
});

function file(buffer: Buffer, mimetype: string): Express.Multer.File {
  return {
    fieldname: 'image',
    originalname: 'question',
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
  };
}
