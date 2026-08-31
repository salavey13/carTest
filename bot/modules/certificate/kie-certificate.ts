/**
 * modules/certificate/kie-certificate.ts
 * Генерация подарочного сертификата VIP BIKE ELECTRO через Kie.ai (img2img от
 * фирменного референс-сертификата). Скопировано с паттерна modules/avito/kie-image.ts.
 * Запуск: npx tsx modules/certificate/kie-certificate.ts gen-certificate [flags]
 *
 * Команда:
 *   gen-certificate --recipient "Имя Фамилия (родительный падеж)" --donor "ООО «Компания»"
 *                    --occasion "С праздником!" --amount "10 000 руб." [--issued ДД.ММ.ГГГГ]
 *                    [--expires ДД.ММ.ГГГГ] [--n 1..3] [--out <dir>]
 *     → JSON { paths, mock } в stdout
 *
 * Метод Kie (v1 jobs), модель gpt-image-2-image-to-image: upload референса (CDN) →
 * createTask (по варианту на композицию) → poll recordInfo → download → sharp ≤2K.
 *   KIE_API_KEY  — ключ Kie (уже прописан в .env бота, обязателен для реальной генерации)
 *   KIE_MOCK=1   — форс-мок (dev/тесты без трат кредитов)
 *
 * Без ключа (или KIE_MOCK=1) — копирует референс в out как заглушку, mock:true.
 *
 * ⛔ Правила (см. _shared/certificate-generator.md фабрики):
 *   - Символ «₽» AI ломает — писать сумму словом «руб.», не «₽».
 *   - Логотип получается леттерингом, не фирменный знак — это ожидаемо для этого канала.
 *   - Референс — только output/visuals/certificate-sergey-trushin-8888-2026-07-30 фабрики,
 *     здесь лежит его копия assets/certificate-reference.jpg (не менять руками).
 *   - Результат — ВСЕГДА отдать оператору файлом в чат и попросить подтвердить текст глазами
 *     (кириллица/сумма/имя) — это НЕ автоматическая проверка, а ручной QA оператора.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR_DEFAULT = path.resolve(process.env.CERT_OUTPUT_DIR ?? 'workspace/uploads/certificates');
const REF_IMAGE = path.resolve(__dirname, 'assets/certificate-reference.jpg');
const KIE_BASE = 'https://api.kie.ai/api/v1/jobs';
const KIE_UPLOAD = 'https://kieai.redpandaai.co/api/file-stream-upload';
const MODEL = 'gpt-image-2-image-to-image';
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 3 * 60_000;
const MAX_SIDE = 2048;

const BASE_STYLE =
  'Premium dark tech gift certificate, horizontal 16:9, based on the reference layout and style. ' +
  'Deep graphite background #0D0F11, neon cyan #1CE6D4 accents and glow, hi-tech thin neon frame ' +
  'with cut corners, realistic black electric motorcycle with cyan neon light lines, reflective dark ' +
  'studio floor, clean composition, lots of air, no people, no emoji, no watermark. ' +
  'All text must be rendered in flawless Russian Cyrillic, exactly these strings and nothing else: ';

const COMPOSITIONS = [
  'Composition A: motorcycle in three-quarter front view on the right half, text block left aligned, ' +
    'amount at bottom left, wide cyan light streaks in the background.',
  'Composition B: motorcycle in dramatic low-angle side silhouette across the bottom right, heading at ' +
    'the top spanning full width, the amount centered in a glowing cyan panel, dark smoke and floor haze.',
  'Composition C: close-up of the motorcycle front headlight glowing cyan on the right third, vertical ' +
    'neon divider line, text block on the left in a strict grid, amount in an outlined cyan badge, ' +
    'minimal and graphic.',
];

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

/** Путь обязан лежать внутри OUT_DIR_DEFAULT.parent (workspace/uploads) — anti path-traversal. */
function safeOut(p: string): string {
  const uploadsRoot = path.resolve(path.dirname(OUT_DIR_DEFAULT));
  const abs = path.resolve(p);
  if (abs !== uploadsRoot && !abs.startsWith(uploadsRoot + path.sep)) {
    throw new Error(`out path outside uploads dir: ${p}`);
  }
  return abs;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isMock(): boolean {
  return process.env.KIE_MOCK === '1' || !process.env.KIE_API_KEY;
}

function buildPrompt(f: Record<string, string>, composition: string): string {
  const footer =
    f.footer ??
    `ТОВАРЫ И УСЛУГИ VIP BIKE ELECTRO · Нижний Новгород, пл. Комсомольская, 2 · ` +
      `Выдан ${f.issued ?? ''}, действует до ${f.expires ?? ''}`;
  const textBlock =
    `heading in huge bold uppercase white letters: "ПОДАРОЧНЫЙ СЕРТИФИКАТ"; ` +
    `below it in white: "Для ${f.recipient}"; ` +
    `below in grey: "от компании ${f.donor}"; ` +
    `a cyan highlighted line: "${f.occasion}"; ` +
    `a giant cyan glowing amount: "${f.amount}"; ` +
    `small grey footer line: "${footer}"; ` +
    `top right corner cyan neon lettering logo: "VIP BIKE ELECTRO". ` +
    'Spelling must be letter-perfect, no invented or distorted Cyrillic characters, no extra words. ';
  return BASE_STYLE + textBlock + composition;
}

async function uploadToKie(filePath: string, key: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const fd = new FormData();
  fd.append('file', new Blob([buf]), path.basename(filePath));
  fd.append('uploadPath', 'vip-bike-certificates');
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

async function createTask(key: string, prompt: string, refUrl: string): Promise<string> {
  const res = await fetch(`${KIE_BASE}/createTask`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      input: { prompt, resolution: '2K', aspect_ratio: '16:9', input_urls: [refUrl] },
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

async function downloadAndSave(url: string, outPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await sharp(buf)
    .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toFile(outPath);
}

async function genCertificate(f: Record<string, string>): Promise<void> {
  for (const req of ['recipient', 'donor', 'occasion', 'amount']) {
    if (!f[req]) throw new Error(`--${req} обязателен`);
  }
  const n = Math.max(1, Math.min(3, parseInt(f.n ?? '1', 10) || 1));
  const outDir = safeOut(f.out ?? OUT_DIR_DEFAULT);
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = Date.now();

  if (isMock()) {
    const paths: string[] = [];
    for (let i = 0; i < n; i++) {
      const out = path.join(outDir, `certificate-mock-${stamp}-${i + 1}.jpg`);
      await sharp(fs.readFileSync(REF_IMAGE))
        .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(out);
      paths.push(out);
    }
    process.stdout.write(JSON.stringify({ paths, mock: true }) + '\n');
    return;
  }

  const key = process.env.KIE_API_KEY!;
  const refUrl = await uploadToKie(REF_IMAGE, key);

  const paths: string[] = [];
  for (let i = 0; i < n; i++) {
    const prompt = buildPrompt(f, COMPOSITIONS[i % COMPOSITIONS.length]);
    const taskId = await createTask(key, prompt, refUrl);
    const urls = await pollResult(key, taskId);
    const out = path.join(outDir, `certificate-${stamp}-${i + 1}.png`);
    await downloadAndSave(urls[0], out);
    paths.push(out);
  }
  process.stdout.write(JSON.stringify({ paths, mock: false }) + '\n');
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  try {
    if (cmd === 'gen-certificate') await genCertificate(flags);
    else {
      process.stderr.write(
        `unknown command: ${cmd}\nИспользуй: gen-certificate --recipient "<р.п.>" --donor "<ООО...>" --occasion "<текст>" --amount "<сумма> руб."\n`,
      );
      process.exit(2);
    }
  } catch (e) {
    process.stderr.write(`ERROR: ${(e as Error).message}\n`);
    process.exit(1);
  }
}

main();
