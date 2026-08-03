/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mammoth from 'mammoth';
import pdf from 'pdf-parse';
import type { SupportedDocumentType } from './document-file-validator.service';

export interface ExtractedPage {
  pageNumber: number | null;
  text: string;
}

export interface ExtractedDocument {
  pageCount: number;
  pages: ExtractedPage[];
  pagesRequiringOcr: number[];
}

@Injectable()
export class DocumentTextExtractor {
  constructor(private readonly config: ConfigService) {}

  async extract(
    type: SupportedDocumentType,
    buffer: Buffer,
  ): Promise<ExtractedDocument> {
    if (type === 'PDF') return this.pdf(buffer);
    if (type === 'DOCX') {
      const result = await mammoth.extractRawText({ buffer });
      return {
        pageCount: 1,
        pages: [{ pageNumber: null, text: result.value }],
        pagesRequiringOcr: [],
      };
    }
    return {
      pageCount: 1,
      pages: [{ pageNumber: null, text: buffer.toString('utf8') }],
      pagesRequiringOcr: [],
    };
  }

  private async pdf(buffer: Buffer): Promise<ExtractedDocument> {
    const pages: ExtractedPage[] = [];
    const result = await pdf(buffer, {
      pagerender: async (page: any) => {
        const content = await page.getTextContent();
        const text = content.items
          .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        pages.push({ pageNumber: pages.length + 1, text });
        return text;
      },
    });
    const maxPages = this.config.get<number>('DOCUMENT_MAX_PAGES', 300);
    if (result.numpages > maxPages) {
      throw new BadRequestException({
        code: 'DOCUMENT_PAGE_LIMIT_EXCEEDED',
        message: 'The document exceeds the configured page limit',
      });
    }
    const minimumCharacters = this.config.get<number>(
      'OCR_MIN_CHARACTERS_PER_PAGE',
      40,
    );
    const pagesRequiringOcr = pages
      .filter(
        (page) => page.text.replace(/\s+/g, '').length < minimumCharacters,
      )
      .map((page) => page.pageNumber)
      .filter((value): value is number => value !== null);
    return { pageCount: result.numpages, pages, pagesRequiringOcr };
  }
}
