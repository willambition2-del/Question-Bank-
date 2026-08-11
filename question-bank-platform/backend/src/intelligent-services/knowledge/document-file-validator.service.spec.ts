import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentFileValidator } from './document-file-validator.service';

describe('DocumentFileValidator', () => {
  const validator = new DocumentFileValidator(
    new ConfigService({ DOCUMENT_MAX_SIZE_MB: 1 }),
  );

  it('accepts a PDF only when MIME, extension and signature agree', () => {
    const buffer = Buffer.from('%PDF-1.7\nsafe');
    expect(
      validator.validate({
        originalname: 'book.pdf',
        mimetype: 'application/pdf',
        size: buffer.length,
        buffer,
      }),
    ).toEqual(
      expect.objectContaining({
        type: 'PDF',
        extension: 'pdf',
      }),
    );
  });

  it('rejects extension spoofing and binary text', () => {
    const fake = Buffer.from('not a pdf');
    expect(() =>
      validator.validate({
        originalname: 'book.pdf',
        mimetype: 'application/pdf',
        size: fake.length,
        buffer: fake,
      }),
    ).toThrow(BadRequestException);
    const binary = Buffer.from([65, 0, 66]);
    expect(() =>
      validator.validate({
        originalname: 'notes.txt',
        mimetype: 'text/plain',
        size: binary.length,
        buffer: binary,
      }),
    ).toThrow(BadRequestException);
  });

  it('enforces the configured file-size limit', () => {
    const buffer = Buffer.alloc(1024 * 1024 + 1, 65);
    expect(() =>
      validator.validate({
        originalname: 'large.txt',
        mimetype: 'text/plain',
        size: buffer.length,
        buffer,
      }),
    ).toThrow(BadRequestException);
  });
});
