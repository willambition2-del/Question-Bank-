import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileTypeDetector } from './file-type-detector';

const hex = (value: string) => Buffer.from(value.replaceAll(' ', ''), 'hex');

describe('FileTypeDetector', () => {
  const detector = new FileTypeDetector();

  it.each([
    ['JPEG', hex('FF D8 FF E0 00 10 4A 46 49 46 00 01'), 'image/jpeg'],
    [
      'PNG',
      hex('89 50 4E 47 0D 0A 1A 0A 00 00 00 0D 49 48 44 52'),
      'image/png',
    ],
    [
      'WEBP',
      Buffer.from('524946460C0000005745425056503820', 'hex'),
      'image/webp',
    ],
    ['PDF', Buffer.from('%PDF-1.7\n'), 'application/pdf'],
    ['ZIP', hex('50 4B 03 04 14 00 00 00 00 00'), 'application/zip'],
  ])('detects %s from magic bytes', async (_name, buffer, expectedMime) => {
    await expect(detector.detectFromBuffer(buffer)).resolves.toMatchObject({
      mime: expectedMime,
    });
  });

  it('does not trust a fake file extension', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'file-type-detector-'));
    const path = join(directory, 'not-an-image.txt');
    try {
      await writeFile(
        path,
        hex('89 50 4E 47 0D 0A 1A 0A 00 00 00 0D 49 48 44 52'),
      );
      await expect(detector.detectFromFile(path)).resolves.toMatchObject({
        mime: 'image/png',
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('returns undefined for an unknown buffer without an extension fallback', async () => {
    await expect(
      detector.detectFromBuffer(Buffer.from('plain text without magic bytes')),
    ).resolves.toBeUndefined();
  });

  it('propagates dynamic import failures', async () => {
    class FailingDetector extends FileTypeDetector {
      protected loadModule(): Promise<typeof import('file-type')> {
        return Promise.reject(new Error('module unavailable'));
      }
    }
    await expect(
      new FailingDetector().detectFromBuffer(Buffer.from('anything')),
    ).rejects.toThrow('module unavailable');
  });
});
