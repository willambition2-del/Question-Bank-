import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

export type SupportedDocumentType = 'PDF' | 'DOCX' | 'TXT' | 'MARKDOWN';

export interface ValidatedDocumentFile {
  type: SupportedDocumentType;
  extension: string;
  checksum: string;
}

@Injectable()
export class DocumentFileValidator {
  constructor(private readonly config: ConfigService) {}

  validate(file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }): ValidatedDocumentFile {
    const maxBytes =
      this.config.get<number>('DOCUMENT_MAX_SIZE_MB', 20) * 1024 * 1024;
    if (
      file.size <= 0 ||
      file.size > maxBytes ||
      file.buffer.length !== file.size
    )
      throw this.invalid('DOCUMENT_SIZE_INVALID');

    const extension = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    const signature = file.buffer.subarray(0, 8);
    let type: SupportedDocumentType;
    if (
      extension === 'pdf' &&
      file.mimetype === 'application/pdf' &&
      signature.subarray(0, 5).toString('ascii') === '%PDF-'
    ) {
      type = 'PDF';
    } else if (
      extension === 'docx' &&
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
      signature.subarray(0, 2).toString('hex') === '504b'
    ) {
      type = 'DOCX';
    } else if (
      ['txt', 'md', 'markdown'].includes(extension) &&
      ['text/plain', 'text/markdown'].includes(file.mimetype) &&
      !file.buffer.includes(0)
    ) {
      type = extension === 'txt' ? 'TXT' : 'MARKDOWN';
    } else {
      throw this.invalid('DOCUMENT_TYPE_UNSUPPORTED');
    }
    return {
      type,
      extension: type.toLowerCase(),
      checksum: createHash('sha256').update(file.buffer).digest('hex'),
    };
  }

  private invalid(code: string): BadRequestException {
    return new BadRequestException({
      code,
      message: 'The uploaded document is invalid or unsupported',
    });
  }
}
