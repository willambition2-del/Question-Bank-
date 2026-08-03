import { Injectable } from '@nestjs/common';

type FileTypeModule = typeof import('file-type');

@Injectable()
export class FileTypeDetector {
  async detectFromBuffer(buffer: Uint8Array) {
    const fileType = await this.loadModule();
    return fileType.fileTypeFromBuffer(buffer);
  }

  async detectFromFile(path: string) {
    const fileType = await this.loadModule();
    return fileType.fileTypeFromFile(path);
  }

  protected loadModule(): Promise<FileTypeModule> {
    return import('file-type');
  }
}
