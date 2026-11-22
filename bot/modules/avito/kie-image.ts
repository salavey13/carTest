/**
 * modules/avito/kie-image.ts
 * Генерация визуала объявления через Kie.ai (img2img от реального фото байка).
 * Запуск: npx tsx modules/avito/kie-image.ts gen-image [flags]
 *
 * Команда:
 *   gen-image --ref <фото-байка> [--style-ref <реф-конкурента>] --prompt "<текст>"
 *             [--model nano-banana-2] [--aspect 4:5] [--resolution 2K]
 *             [--out <dir>] [--n 1]
 *     → JSON { paths, taskId, mock } в stdout
 *
 * Метод Kie (v1 jobs): upload (CDN) → createTask → poll recordInfo → download → sharp ≤2K.
 *   KIE_API_KEY      — ключ Kie (обязателен для реальной генерации)   {{уточнить: ключ VIP BIKE}}
 *   KIE_MOCK=1       — форс-мок (dev/тесты без ключа и без трат кредитов)
 *
 * Без ключа (или KIE_MOCK=1) — копирует исходное фото в out как заглушку, mock:true.
 * Так флоу бота тестируется без секретов и без сжигания кредитов.
 *
 * ⛔ Правила (image-slide-generation): max 2K (не 4K); на картинке для Авито НЕТ текста
 *    (текст добавляет оператор/площадка); байк = img2img от реального фото, не с нуля.
 * 152-ФЗ/гигиена: --ref/--out принимают пути ТОЛЬКО внутри UPLOADS_DIR (anti path-traversal).
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const UPLOADS_DIR = path.resolve(process.env.AVITO_UPLOADS_DIR ?? 'workspace/uploads');
const KIE_BASE = 'https://api.kie.ai/api/v1/jobs';
const KIE_UPLOAD = 'https://kieai.redpandaai.co/api/file-stream-upload';
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 3 * 60_000;
const MAX_SIDE = 2048; // ≤2K по правилу клиента

function parseFlags(args: string[]): Record<string, string> {
  const f: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true';
      f[key] = val;
    }
  }
  return f;
}

/** Путь обязан лежать внутри UPLOADS_DIR. */
function safe(p: string): string {
  const abs = path.resolve(p);
  if (abs !== UPLOADS_DIR && !abs.startsWith(UPLOADS_DIR + path.sep)) {
    throw new Error(`path outside uploads dir: ${p}`);
  }
  return abs;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isMock(): boolean {
  return process.env.KIE_MOCK === '1' || !process.env.KIE_API_KEY;
}

async function uploadToKie(filePath: string, key: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const fd = new FormData();
  fd.append('file', new Blob([buf]), path.basename(filePath));
  fd.append('uploadPath', 'vip-bike-avito');
  const res = await fetch(KIE_UPLOAD, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: fd,
  });
  if (!res.ok) throw new Error(`upload failed ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { downloadUrl?: string };
  if (!j.downloadUrl) throw new Error(`upload: no downloadUrl in ${JSON.stringify(j)}`);
  return j.downloadUrl;
}

async function createTask(
  key: string,
  model: string,
  prompt: string,
  imageInput: string[],
  aspect: string,
  resolution: string,
): Promise<string> {
  const res = await fetch(`${KIE_BASE}/createTask`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: { prompt, resolution, aspect_ratio: aspect, image_input: imageInput },
    }),
  });
  if (!res.ok) throw new Error(`createTask failed ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { data?: { taskId?: string }; taskId?: string };
  const taskId = j.data?.taskId ?? j.taskId;
  if (!taskId) throw new Error(`createTask: no taskId in ${JSON.stringify(j)}`);
  return taskId;
}

async function pollResult(key: string, taskId: string): Promise<string[]> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const res = await fetch(`${KIE_BASE}/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) continue;
    const j = (await res.json()) as { data?: { state?: string; resultJson?: string } };
    const state = j.data?.state;
    if (state === 'success' || state === 'completed') {
      const parsed = JSON.parse(j.data?.resultJson ?? '{}') as { resultUrls?: string[] };
      const urls = parsed.resultUrls ?? [];
      if (!urls.length) throw new Error('success but no resultUrls');
      return urls;
    }
    if (state === 'failed' || state === 'cancelled') {
      throw new Error(`task ${state}: ${JSON.stringify(j.data)}`);
    }
  }
  throw new Error(`poll timeout after ${POLL_TIMEOUT_MS}ms (taskId ${taskId})`);
}

/** Скачать URL → resize ≤2K → сохранить JPEG в out. */
async function downloadAndSave(url: string, outPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await sharp(buf)
    .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(outPath);
}

async function genImage(f: Record<string, string>): Promise<void> {
  if (!f.ref) throw new Error('--ref <фото байка> обязателен');
  if (!f.prompt) throw new Error('--prompt "<текст>" обязателен');
  const ref = safe(f.ref);
  const styleRef = f['style-ref'] ? safe(f['style-ref']) : null;
  const model = f.model ?? 'nano-banana-2';
  const aspect = f.aspect ?? '4:5';
  const resolution = (f.resolution ?? '2K').toUpperCase() === '4K' ? '2K' : (f.resolution ?? '2K');
  const n = Math.max(1, Math.min(4, parseInt(f.n ?? '1', 10) || 1));
  const outDir = safe(f.out ?? path.join(UPLOADS_DIR, '_test'));
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = Date.now();

  // MOCK — без ключа/трат: исходник как заглушка результата.
  if (isMock()) {
    const paths: string[] = [];
    for (let i = 0; i < n; i++) {
      const out = path.join(outDir, `avito-mock-${stamp}-${i + 1}.jpg`);
      await sharp(fs.readFileSync(ref))
        .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(out);
      paths.push(out);
    }
    process.stdout.write(JSON.stringify({ paths, taskId: null, mock: true }) + '\n');
    return;
  }

  const key = process.env.KIE_API_KEY!;
  const refUrl = await uploadToKie(ref, key);
  const imageInput = [refUrl];
  if (styleRef) imageInput.push(await uploadToKie(styleRef, key));

  const paths: string[] = [];
  for (let i = 0; i < n; i++) {
    const taskId = await createTask(key, model, f.prompt, imageInput, aspect, resolution);
    const urls = await pollResult(key, taskId);
    const out = path.join(outDir, `avito-${stamp}-${i + 1}.jpg`);
    await downloadAndSave(urls[0], out);
    paths.push(out);
  }
  process.stdout.write(JSON.stringify({ paths, mock: false }) + '\n');
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  try {
    if (cmd === 'gen-image') await genImage(flags);
    else {
      process.stderr.write(`unknown command: ${cmd}\nИспользуй: gen-image --ref <p> --prompt "<t>"\n`);
      process.exit(2);
    }
  } catch (e) {
    process.stderr.write(`ERROR: ${(e as Error).message}\n`);
    process.exit(1);
  }
}

main();
