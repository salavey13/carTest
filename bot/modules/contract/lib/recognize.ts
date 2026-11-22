/**
 * lib/recognize.ts
 * Распознавание паспорта РФ / водительского удостоверения через Z.AI (GLM vision).
 * Вход: фото (base64 или URL). Выход: строгий JSON по форме ClientOcrFields.
 *
 * Z.AI — OpenAI-совместимый endpoint. Конфиг через .env.local (хук блокирует
 * автосоздание секретов):
 *   Z_AI_API_KEY       — ключ (обязателен для реального распознавания)   {{уточнить}}
 *   Z_AI_BASE_URL      — базовый URL (дефолт https://api.z.ai/api/paas/v4)
 *   Z_AI_VISION_MODEL  — vision-модель (дефолт glm-4.5v)                  {{уточнить}}
 *   RECOGNIZE_MOCK=1   — форсировать мок-режим даже при наличии ключа (dev/тесты)
 *
 * Без ключа (или RECOGNIZE_MOCK=1) модуль возвращает ДЕТЕРМИНИРОВАННЫЕ
 * ФИКТИВНЫЕ поля — чтобы флоу бота разрабатывался и тестировался без секретов.
 *
 * 152-ФЗ: фото документов здесь НЕ сохраняются. Возвращаем только распознанные
 * поля + сырой ответ модели (для аудита/правок оператором).
 */

import type { ClientOcrFields } from './types.js';

// ── Конфиг ──────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://api.z.ai/api/paas/v4';
const DEFAULT_MODEL = 'glm-4.5v';
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;

// Локальный гибрид: tesseract (фото→текст) + текстовая модель движка (текст→поля).
// Используется когда нет paas-баланса для vision. Текстовую модель берём с
// Anthropic-совместимого эндпоинта (тот же coding-plan ключ, что и движок бота).
const DEFAULT_ANTHROPIC_BASE = 'https://api.z.ai/api/anthropic';
const DEFAULT_TEXT_MODEL = 'glm-4.6';

// Groq vision (бесплатный tier) — OpenAI-совместимый, читает фото напрямую (VLM).
const DEFAULT_GROQ_BASE = 'https://api.groq.com/openai/v1';
const DEFAULT_GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

// Yandex Vision OCR (РФ-облако) — спец-модели под РФ-документы, работает с РФ-сервера, ПДн в РФ.
const DEFAULT_YANDEX_OCR = 'https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText';

// gen-api.ru — РФ-агрегатор (доступен с РФ-сервера, в отличие от Groq). Vision через gemini.
// gemini-2-5-flash читает РФ-паспорта структурно и не отказывается (gpt-4o отказывается).
const DEFAULT_GENAPI_BASE = 'https://api.gen-api.ru/api/v1/networks';
const DEFAULT_GENAPI_MODEL = 'gemini-2-5-flash';

/** Режим распознавания. */
export type OcrMode = 'mock' | 'local' | 'paas' | 'groq' | 'genapi';

/**
 * Выбор режима:
 *  RECOGNIZE_MOCK=1                       → mock (фиктивные поля)
 *  OCR_MODE=genapi|groq|local|paas       → явный выбор (с фолбэком в mock если нет ключа)
 *  иначе авто: GENAPI_API_KEY → genapi; GROQ → groq; ANTHROPIC → local; Z_AI → paas; иначе mock
 *  genapi (gen-api.ru gemini) — РАБОТАЕТ с РФ-сервера; groq гео-блокирован для РФ.
 */
export function ocrMode(): OcrMode {
  if (process.env.RECOGNIZE_MOCK === '1') return 'mock';
  const m = (process.env.OCR_MODE ?? '').toLowerCase();
  if (m === 'genapi') return process.env.GENAPI_API_KEY ? 'genapi' : 'mock';
  if (m === 'groq') return process.env.GROQ_API_KEY ? 'groq' : 'mock';
  if (m === 'paas') return process.env.Z_AI_API_KEY ? 'paas' : 'mock';
  if (m === 'local') return process.env.ANTHROPIC_AUTH_TOKEN ? 'local' : 'mock';
  if (process.env.GENAPI_API_KEY) return 'genapi';
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.ANTHROPIC_AUTH_TOKEN) return 'local';
  if (process.env.Z_AI_API_KEY) return 'paas';
  return 'mock';
}

export type DocKind = 'passport' | 'license' | 'registration';

/** Ссылка на изображение: либо base64 (без префикса data:), либо http(s)-URL. */
export interface ImageRef {
  /** base64 содержимое (без `data:...;base64,`). */
  base64?: string;
  /** Прямой http(s)-URL изображения. */
  url?: string;
  /** MIME для base64 (дефолт image/jpeg). */
  mime?: string;
}

export interface RecognizeResult {
  /** Распознанные поля (нормализованные: даты → ISO YYYY-MM-DD). */
  fields: Partial<ClientOcrFields>;
  /** Сырой JSON от модели (для clients.raw_ocr / ручной правки). */
  raw: Record<string, unknown>;
  /** true — данные фиктивные (мок-режим, ключа нет). */
  mock: boolean;
}

/** Готов ли реальный распознаватель (любой режим кроме mock). */
export function recognizeConfigured(): boolean {
  return ocrMode() !== 'mock';
}

// ── Промпты ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  'Ты — точный OCR-экстрактор данных из российских документов. ' +
  'Верни СТРОГО валидный JSON по запрошенной схеме, без markdown и пояснений. ' +
  'Значения переноси дословно, как в документе. ' +
  'Даты возвращай в формате ДД.ММ.ГГГГ. ' +
  'Если поле не видно или нечитаемо — поставь null. Не выдумывай данные.';

/** Инструкция + список полей под каждый тип документа (camelCase = ключи JSON). */
const FIELD_SPECS: Record<DocKind, string> = {
  passport:
    'Это разворот паспорта гражданина РФ (OCR-текст в нескольких ориентациях). Извлеки поля:\n' +
    '{"fullName": "Фамилия Имя Отчество", "birthDate": "ДД.ММ.ГГГГ", ' +
    '"passportSeries": "4 цифры", "passportNumber": "6 цифр", ' +
    '"passportIssuedBy": "кем выдан", "passportIssuedDate": "ДД.ММ.ГГГГ", ' +
    '"passportDeptCode": "код подразделения NNN-NNN", ' +
    '"registrationAddress": "адрес регистрации (прописки), если есть"}\n' +
    'ВАЖНО про серию и номер:\n' +
    '- Серия (4 цифры) и номер (6 цифр) напечатаны ВЕРТИКАЛЬНО красным справа — ищи их ТОЛЬКО в блоках с пометкой "повёрнуто". Серия может идти двумя парами (напр. 22 14 → серия 2214), номер — 6 цифр подряд.\n' +
    '- ⛔ НЕ бери серию/номер из MRZ-строки (PNRUS.../RUS<<<) — там другая кодировка, получится НЕВЕРНЫЙ номер. MRZ игнорируй для серии/номера.\n' +
    '- Если в повёрнутых блоках серию/номер уверенно НЕ видно — ставь null. Неверный номер хуже пустого: оператор впишет вручную.',
  license:
    'Это водительское удостоверение РФ (OCR-текст). Извлеки поля:\n' +
    '{"fullName": "Фамилия Имя Отчество", "birthDate": "ДД.ММ.ГГГГ", ' +
    '"licenseNumber": "номер ВУ — 10 цифр, в документе часто с пробелами (напр. 99 49 389184) → верни 10 цифр подряд без пробелов", ' +
    '"licenseCategories": "открытые категории — буквы в рамках внизу (A, A1, B, B1, M и т.п.), перечисли ВСЕ через запятую", ' +
    '"licenseIssuedDate": "ДД.ММ.ГГГГ (пункт 4a)", "licenseValidUntil": "ДД.ММ.ГГГГ (пункт 4b)"}',
  registration:
    'Это страница регистрации (прописки) паспорта РФ. Извлеки ОДНО поле:\n' +
    '{"registrationAddress": "полный адрес регистрации одной строкой (область, город, улица, дом, квартира)"}',
};

/** Какие ключи допустимы в ответе для каждого типа (фильтр от мусора). */
const ALLOWED_KEYS: Record<DocKind, (keyof ClientOcrFields)[]> = {
  passport: [
    'fullName', 'birthDate', 'passportSeries', 'passportNumber',
    'passportIssuedBy', 'passportIssuedDate', 'passportDeptCode',
    'registrationAddress',
  ],
  license: [
    'fullName', 'birthDate', 'licenseNumber', 'licenseCategories',
    'licenseIssuedDate', 'licenseValidUntil',
  ],
  registration: ['registrationAddress'],
};

const DATE_KEYS = new Set<keyof ClientOcrFields>([
  'birthDate', 'passportIssuedDate', 'licenseIssuedDate', 'licenseValidUntil',
]);

// ── Нормализация ─────────────────────────────────────────────────────────

/** ДД.ММ.ГГГГ | ДД-ММ-ГГГГ | ГГГГ-ММ-ДД | ДД/ММ/ГГГГ → ISO YYYY-MM-DD (или null). */
export function normalizeDate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/); // ДД.ММ.ГГГГ
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/); // ГГГГ-ММ-ДД
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

/** Пустые строки → null, тримминг, нормализация дат, отбрасывание чужих ключей. */
function normalizeFields(
  kind: DocKind,
  raw: Record<string, unknown>,
): Partial<ClientOcrFields> {
  // ALLOWED_KEYS содержат только строковые поля (без enum entityType),
  // поэтому собираем в Record<string,string> и кастуем на выходе.
  const out: Record<string, string> = {};
  for (const key of ALLOWED_KEYS[kind] as (keyof ClientOcrFields & string)[]) {
    const val = raw[key];
    if (DATE_KEYS.has(key)) {
      const iso = normalizeDate(val);
      if (iso) out[key] = iso;
      continue;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed) out[key] = trimmed;
    } else if (typeof val === 'number') {
      out[key] = String(val);
    }
  }
  return out as Partial<ClientOcrFields>;
}

// ── Z.AI vision вызов ──────────────────────────────────────────────────────

function imageUrl(image: ImageRef): string {
  if (image.url) return image.url;
  if (image.base64) return `data:${image.mime ?? 'image/jpeg'};base64,${image.base64}`;
  throw new Error('recognizeDocument: ImageRef требует base64 или url');
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * fetch с опциональным прокси (для провайдеров, гео-блокирующих РФ-IP, напр. Groq).
 * Прокси из env OCR_PROXY / GROQ_PROXY (http(s)://[user:pass@]host:port).
 * Без прокси — обычный глобальный fetch.
 */
async function proxiedFetch(url: string, opts: Record<string, unknown>): Promise<Response> {
  const proxy = process.env.OCR_PROXY ?? process.env.GROQ_PROXY;
  if (!proxy) return fetch(url, opts as RequestInit);
  const { fetch: uFetch, ProxyAgent } = await import('undici');
  // undici fetch совместим с глобальным; dispatcher маршрутизирует через прокси.
  return uFetch(url, { ...opts, dispatcher: new ProxyAgent(proxy) } as never) as unknown as Response;
}

/** Универсальный OpenAI-совместимый vision-вызов (Z.AI paas, Groq и др.). */
async function callOpenAIVision(
  opts: { baseUrl: string; key: string; model: string; jsonMode: boolean; label: string },
  kind: DocKind,
  image: ImageRef,
): Promise<Record<string, unknown>> {
  const baseUrl = opts.baseUrl.replace(/\/$/, '');
  const body: Record<string, unknown> = {
    model: opts.model,
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: `${FIELD_SPECS[kind]}\n\nВерни ТОЛЬКО валидный JSON, без markdown.` },
          { type: 'image_url', image_url: { url: imageUrl(image) } },
        ],
      },
    ],
  };
  if (opts.jsonMode) body.response_format = { type: 'json_object' };

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await proxiedFetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${opts.key}`,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        // 152-ФЗ: НЕ включаем тело ответа в ошибку/логи (фрагменты ПДн).
        await res.text().catch(() => '');
        throw new Error(`${opts.label} HTTP ${res.status}`);
      }
      const data = (await res.json()) as ChatResponse;
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error(`${opts.label}: пустой ответ модели`);
      return parseJsonLoose(content);
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_RETRIES) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(
    `${opts.label}: распознавание не удалось после ${MAX_RETRIES} попыток: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}

/** Z.AI paas vision (glm-4.5v). */
function callZAI(kind: DocKind, image: ImageRef): Promise<Record<string, unknown>> {
  return callOpenAIVision(
    {
      baseUrl: process.env.Z_AI_BASE_URL ?? DEFAULT_BASE_URL,
      key: process.env.Z_AI_API_KEY!,
      model: process.env.Z_AI_VISION_MODEL ?? DEFAULT_MODEL,
      jsonMode: true,
      label: 'Z.AI',
    },
    kind,
    image,
  );
}

/** Groq vision (llama-4-scout, free tier). */
function callGroq(kind: DocKind, image: ImageRef): Promise<Record<string, unknown>> {
  return callOpenAIVision(
    {
      baseUrl: process.env.GROQ_BASE_URL ?? DEFAULT_GROQ_BASE,
      key: process.env.GROQ_API_KEY!,
      model: process.env.GROQ_VISION_MODEL ?? DEFAULT_GROQ_MODEL,
      jsonMode: false, // у llama-scout на Groq json_object не всегда — парсим loose
      label: 'Groq',
    },
    kind,
    image,
  );
}

/**
 * gen-api.ru vision (gemini-2-5-flash) — РФ-агрегатор, доступен с РФ-сервера.
 * Формат: POST /networks/{model}, Bearer, is_sync:true, OpenAI-style messages с image_url.
 * Ответ: { response: [{ message: { content } }] } (или response — строка).
 */
async function callGenApi(kind: DocKind, image: ImageRef): Promise<Record<string, unknown>> {
  const base = (process.env.GENAPI_BASE ?? DEFAULT_GENAPI_BASE).replace(/\/$/, '');
  const model = process.env.GENAPI_MODEL ?? DEFAULT_GENAPI_MODEL;
  const key = process.env.GENAPI_API_KEY;
  if (!key) throw new Error('GENAPI_API_KEY не задан');

  const body = {
    is_sync: true,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `${FIELD_SPECS[kind]}\n\nВерни ТОЛЬКО валидный JSON, без markdown.` },
          { type: 'image_url', image_url: { url: imageUrl(image) } },
        ],
      },
    ],
  };

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}/${model}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        await res.text().catch(() => '');
        throw new Error(`gen-api HTTP ${res.status}`);
      }
      const data = (await res.json()) as { response?: unknown };
      const r = data.response;
      let content: string | undefined;
      if (typeof r === 'string') content = r;
      else if (Array.isArray(r)) {
        const first = r[0] as { message?: { content?: string } } | string | undefined;
        content = typeof first === 'string' ? first : first?.message?.content;
      }
      if (!content) throw new Error('gen-api: пустой ответ модели');
      return parseJsonLoose(content);
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_RETRIES) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(
    `gen-api: распознавание не удалось после ${MAX_RETRIES} попыток: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}

/** Парсит JSON, терпимо к ```json-обёрткам и тексту вокруг объекта. */
function parseJsonLoose(s: string): Record<string, unknown> {
  const trimmed = s.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first !== -1 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1)) as Record<string, unknown>;
    }
    throw new Error('Z.AI: ответ не является валидным JSON');
  }
}

// ── Локальный гибрид: tesseract (фото→текст) + текстовая модель (текст→поля) ──

/** ImageRef → Buffer с байтами изображения. */
async function imageBuffer(image: ImageRef): Promise<Buffer> {
  if (image.base64) return Buffer.from(image.base64, 'base64');
  if (image.url) {
    const res = await fetch(image.url);
    if (!res.ok) throw new Error(`не удалось загрузить изображение: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error('imageBuffer: ImageRef требует base64 или url');
}

/** Препроцессинг под OCR: автоориентация по EXIF, grayscale, увеличение контраста, апскейл. */
async function preprocess(buf: Buffer, rotateDeg = 0): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  let img = sharp(buf).rotate(); // .rotate() без аргумента — авто по EXIF
  if (rotateDeg) img = img.rotate(rotateDeg);
  return img
    .resize({ width: 1600, withoutEnlargement: false }) // апскейл мелкого текста
    .grayscale()
    .normalize()      // растянуть гистограмму (контраст)
    .sharpen()
    .toBuffer();
}

/** Tesseract OCR (rus+eng) набора буферов → массив текстов. Один worker на все. */
async function runTesseractMulti(buffers: Buffer[]): Promise<string[]> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['rus', 'eng']);
  try {
    const out: string[] = [];
    for (const b of buffers) {
      const { data } = await worker.recognize(b);
      out.push(data.text ?? '');
    }
    return out;
  } finally {
    await worker.terminate();
  }
}

/** Сырой OCR-текст → структурный JSON полей через текстовую модель движка (Anthropic-эндпоинт). */
async function extractFieldsFromText(
  kind: DocKind,
  rawText: string,
): Promise<Record<string, unknown>> {
  const base = (process.env.ANTHROPIC_BASE_URL ?? DEFAULT_ANTHROPIC_BASE).replace(/\/$/, '');
  const token = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!token) throw new Error('ANTHROPIC_AUTH_TOKEN не задан — нужен для local-OCR (текст→поля)');
  const model = process.env.OCR_TEXT_MODEL ?? DEFAULT_TEXT_MODEL;

  const prompt =
    `${SYSTEM_PROMPT}\n\n${FIELD_SPECS[kind]}\n\n` +
    `Ниже — текст, распознанный OCR с фото документа (возможны ошибки/мусор, ` +
    `извлеки максимум корректных полей, не выдумывай отсутствующее):\n"""\n${rawText}\n"""\n\n` +
    `Верни ТОЛЬКО JSON по схеме выше.`;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': token,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        await res.text().catch(() => '');
        throw new Error(`OCR-extract HTTP ${res.status}`);
      }
      const data = (await res.json()) as { content?: { text?: string }[] };
      const content = data.content?.[0]?.text;
      if (!content) throw new Error('OCR-extract: пустой ответ модели');
      return parseJsonLoose(content);
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_RETRIES) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(
    `Извлечение полей не удалось после ${MAX_RETRIES} попыток: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}

/**
 * Полный local-pipeline: фото → (sharp препроцесс, для паспорта ещё ±90°) →
 * tesseract → объединённый текст с пометками ориентации → модель → поля.
 * Поворот нужен паспорту: серия/номер напечатаны вертикально красным.
 */
async function callLocalHybrid(kind: DocKind, image: ImageRef): Promise<Record<string, unknown>> {
  const raw = await imageBuffer(image);

  const variants: { label: string; buf: Buffer }[] = [
    { label: 'основной текст', buf: await preprocess(raw) },
  ];
  if (kind === 'passport') {
    variants.push(
      { label: 'повёрнуто +90° (вертикальные надписи справа: серия/номер)', buf: await preprocess(raw, 90) },
      { label: 'повёрнуто -90°', buf: await preprocess(raw, -90) },
    );
  }

  const texts = await runTesseractMulti(variants.map((v) => v.buf));
  const combined = texts
    .map((t, i) => `[${variants[i].label}]\n${t.trim()}`)
    .join('\n\n');

  if (!combined.replace(/\[[^\]]*\]/g, '').trim()) {
    throw new Error('tesseract вернул пустой текст — фото нечитаемо, нужно лучшее качество');
  }
  return extractFieldsFromText(kind, combined);
}

// ── Мок ─────────────────────────────────────────────────────────────────────

/** Детерминированные ФИКТИВНЫЕ данные (имена/серии/номера вымышлены). */
function mockRaw(kind: DocKind): Record<string, unknown> {
  if (kind === 'passport') {
    return {
      fullName: 'Иванов Иван Иванович',
      birthDate: '15.05.1990',
      passportSeries: '2222',
      passportNumber: '333444',
      passportIssuedBy: 'ГУ МВД России по Нижегородской области (ФИКТ.)',
      passportIssuedDate: '20.06.2015',
      passportDeptCode: '520-001',
      registrationAddress: 'г. Нижний Новгород, ул. Пример, д. 1, кв. 1',
    };
  }
  if (kind === 'registration') {
    return { registrationAddress: 'г. Нижний Новгород, ул. Пример, д. 1, кв. 1 (ФИКТ.)' };
  }
  return {
    fullName: 'Иванов Иван Иванович',
    birthDate: '15.05.1990',
    licenseNumber: '9900 555666',
    licenseCategories: 'A,B,M',
    licenseIssuedDate: '10.07.2021',
    licenseValidUntil: '10.07.2031',
  };
}

// ── Публичный API ───────────────────────────────────────────────────────────

/**
 * Распознать ОДИН документ (паспорт или ВУ).
 * Без Z_AI_API_KEY (или RECOGNIZE_MOCK=1) — возвращает фиктивные поля (mock:true).
 */
export async function recognizeDocument(
  kind: DocKind,
  image: ImageRef,
): Promise<RecognizeResult> {
  const mode = ocrMode();
  if (mode === 'mock') {
    const raw = mockRaw(kind);
    return { fields: normalizeFields(kind, raw), raw, mock: true };
  }
  let raw: Record<string, unknown>;
  if (mode === 'local') raw = await callLocalHybrid(kind, image);
  else if (mode === 'genapi') raw = await callGenApi(kind, image);
  else if (mode === 'groq') raw = await callGroq(kind, image);
  else raw = await callZAI(kind, image);
  return { fields: normalizeFields(kind, raw), raw, mock: false };
}

/**
 * Распознать паспорт и/или ВУ и собрать единый ClientOcrFields.
 * Паспорт — основной источник ФИО/ДР; ВУ дополняет (и перекрывает ФИО/ДР, если их нет).
 * Бросает, если не передан ни один документ или не извлечено ФИО.
 */
export async function recognizeClient(docs: {
  passport?: ImageRef;
  license?: ImageRef;
  registration?: ImageRef;
}): Promise<{ fields: ClientOcrFields; raw: Record<string, unknown>; mock: boolean }> {
  if (!docs.passport && !docs.license) {
    throw new Error('recognizeClient: нужен хотя бы паспорт или ВУ');
  }

  const passport = docs.passport ? await recognizeDocument('passport', docs.passport) : null;
  const license = docs.license ? await recognizeDocument('license', docs.license) : null;
  const registration = docs.registration
    ? await recognizeDocument('registration', docs.registration)
    : null;

  // Приоритет полей: паспорт (база) > регистрация (адрес) > ВУ (дополняет ФИО/ДР).
  // Спред в порядке возрастания приоритета — последний перекрывает предыдущих.
  const merged: Partial<ClientOcrFields> = {
    ...(license?.fields ?? {}),
    ...(registration?.fields ?? {}),
    ...(passport?.fields ?? {}),
  };

  // registrationAddress: страница прописки точнее главного разворота — берём её, если есть.
  if (registration?.fields.registrationAddress) {
    merged.registrationAddress = registration.fields.registrationAddress;
  }

  if (!merged.fullName) {
    throw new Error('recognizeClient: не удалось распознать ФИО арендатора');
  }

  return {
    fields: { ...merged, fullName: merged.fullName } as ClientOcrFields,
    raw: {
      passport: passport?.raw ?? null,
      license: license?.raw ?? null,
      registration: registration?.raw ?? null,
    },
    mock: Boolean(passport?.mock || license?.mock || registration?.mock),
  };
}
