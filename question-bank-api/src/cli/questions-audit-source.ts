import { createHash } from 'node:crypto';
import { createReadStream, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
const arg =
  process.argv.find((x, i) => i > 1 && !x.startsWith('--')) ?? 'D:\\three\\db';
const sha = (p: string) =>
  new Promise<string>((ok, no) => {
    const h = createHash('sha256'),
      s = createReadStream(p);
    s.on('data', (x) => h.update(x));
    s.on('error', no);
    s.on('end', () => ok(h.digest('hex')));
  });
async function main() {
  const root = resolve(arg);
  const out: Array<{ path: string; size: number; sha256: string }> = [];
  for (const name of readdirSync(root)) {
    const p = resolve(root, name),
      s = statSync(p);
    if (s.isFile()) out.push({ path: p, size: s.size, sha256: await sha(p) });
  }
  console.log(JSON.stringify({ readOnly: true, files: out }, null, 2));
}
void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
