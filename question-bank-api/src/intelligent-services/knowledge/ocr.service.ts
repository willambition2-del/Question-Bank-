import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCanvas } from '@napi-rs/canvas';
import { createWorker } from 'tesseract.js';
import type { ExtractedPage } from './document-text-extractor.service';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(private readonly config: ConfigService) {}

  async extractPdfPages(
    buffer: Buffer,
    pageNumbers: number[],
  ): Promise<ExtractedPage[]> {
    if (!pageNumbers.length) return [];
    if (!this.config.get<boolean>('OCR_ENABLED', true)) {
      throw new Error('OCR_DISABLED');
    }
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loading = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });
    const document = await loading.promise;
    const languages = this.config
      .get<string>('OCR_LANGUAGES', 'eng')
      .split(/[+,]/)
      .map((value) => value.trim())
      .filter(Boolean);
    const maximumPages = this.config.get<number>('OCR_MAX_PAGES', 100);
    if (pageNumbers.length > maximumPages) {
      throw new Error('OCR_PAGE_LIMIT_EXCEEDED');
    }
    const cachePath = this.config.get<string>(
      'OCR_CACHE_PATH',
      '.cache/tesseract',
    );
    const worker = await createWorker(
      languages.length ? languages : ['eng'],
      undefined,
      { cachePath },
    );
    const result: ExtractedPage[] = [];
    try {
      for (const pageNumber of pageNumbers) {
        if (pageNumber < 1 || pageNumber > document.numPages) continue;
        const page = await document.getPage(pageNumber);
        const scale = Math.min(
          4,
          Math.max(1, this.config.get<number>('OCR_RENDER_SCALE', 2)),
        );
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(
          Math.ceil(viewport.width),
          Math.ceil(viewport.height),
        );
        await page.render({
          canvas: canvas as never,
          canvasContext: canvas.getContext('2d') as never,
          viewport,
        }).promise;
        const timeoutMs = this.config.get<number>(
          'OCR_PAGE_TIMEOUT_MS',
          60_000,
        );
        const recognized = await this.withTimeout(
          worker.recognize(canvas.toBuffer('image/png')),
          timeoutMs,
        );
        result.push({
          pageNumber,
          text: recognized.data.text.replace(/\s+/g, ' ').trim(),
        });
      }
    } finally {
      await worker.terminate();
      await loading.destroy();
    }
    this.logger.log({
      event: 'document_ocr_completed',
      requestedPages: pageNumbers.length,
      extractedPages: result.filter((page) => page.text.length > 0).length,
    });
    return result;
  }

  private withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error('OCR_PAGE_TIMEOUT')),
        timeoutMs,
      );
    });
    return Promise.race([operation, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }
}
