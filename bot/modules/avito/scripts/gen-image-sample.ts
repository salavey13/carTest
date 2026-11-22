/**
 * modules/avito/scripts/gen-image-sample.ts
 * Мок-тест Kie-генерации без ключа и без трат кредитов.
 * Запуск: KIE_MOCK=1 npx tsx modules/avito/scripts/gen-image-sample.ts
 * Проверяет: создаётся валидный JPEG ≤2K в _test/, JSON с mock:true.
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import sharp from 'sharp';

const UPLOADS = path.resolve(process.env.AVITO_UPLOADS_DIR ?? 'workspace/uploads');
const testDir = path.join(UPLOADS, '_test');
fs.mkdirSync(testDir, { recursive: true });

// синтетический «байк» — красный прямоугольник 1600×1200
const ref = path.join(testDir, 'sample-bike.png');
await sharp({ create: { width: 1600, height: 1200, channels: 3, background: { r: 200, g: 40, b: 40 } } })
  .png()
  .toFile(ref);

const res = spawnSync(
  'npx',
  ['tsx', 'modules/avito/kie-image.ts', 'gen-image', '--ref', ref, '--prompt', 'studio render, clean background', '--n', '2', '--out', testDir],
  { encoding: 'utf8', env: { ...process.env, KIE_MOCK: '1' } },
);

process.stdout.write(res.stdout);
if (res.status !== 0) {
  process.stderr.write(res.stderr);
  console.error('FAIL: gen-image exit', res.status);
  process.exit(1);
}

const out = JSON.parse(res.stdout.trim().split('\n').pop()!);
let ok = out.mock === true && Array.isArray(out.paths) && out.paths.length === 2;
for (const p of out.paths ?? []) {
  const meta = await sharp(p).metadata();
  if (!meta.width || meta.width > 2048 || meta.height! > 2048) ok = false;
}
console.log(ok ? 'PASS: 2 mock JPEG ≤2K созданы' : 'FAIL: проверка вывода');
process.exit(ok ? 0 : 1);
