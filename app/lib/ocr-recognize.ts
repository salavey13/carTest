/**
 * ocr-recognize.ts
 * Распознавание паспорта РФ / водительского удостоверения через gen-api.ru (Gemini) или Z.AI (GLM).
 * Вход: фото (base64 или URL). Выход: строгий JSON по форме ClientOcrFields.
 *
 * Упрощенная версия из ClaudeClaw бота (Oleg's implementation).
 * Убраны: Tesseract fallback, Groq (geo-blocked), mock режим.
 * Оставлены: gen-api.ru (PRIMARY), Z.AI через Anthropic endpoint (fallback).
 *
 * Конфиг через .env.local:
 *   GENAPI_API_KEY       — ключ gen-api.ru (обязателен для PRIMARY режима)
 *   GENAPI_MODEL         — модель (дефолт gemini-2-5-flash)
 *   ANTHROPIC_AUTH_TOKEN — ключ Z.AI через Anthropic endpoint (fallback)
 *   ANTHROPIC_BASE_URL   — базовый URL (дефолт https://api.z.ai/api/anthropic)
 *   ANTHROPIC_MODEL      — модель (дефолт glm-5.2)
 *   OCR_MODE             — genapi|anthropic (дефолт genapi)
 *
 * 152-ФЗ: фото документов здесь НЕ сохраняются. Возвращаем только распознанные
 * поля + сырой ответ модели (для аудита/правок оператором).
 */

"use server";

// ── Конфиг ──────────────────────────────────────────────────────────────────

const DEFAULT_GENAPI_BASE = 'https://api.gen-api.ru/api/v1/networks';
const DEFAULT_GENAPI_MODEL = 'gemini-2-5-flash';

const DEFAULT_ANTHROPIC_BASE = 'https://api.z.ai/api/anthropic';
const DEFAULT_ANTHROPIC_MODEL = 'glm-5.2';

const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;

/** Режим распознавания. */
export type OcrMode = 'genapi' | 'anthropic';

/**
 * Выбор режима:
 *  OCR_MODE=genapi|anthropic → явный выбор
 *  иначе авто: GENAPI_API_KEY → genapi; ANTHROPIC_AUTH_TOKEN → anthropic
 */
export function ocrMode(): OcrMode {
  const m = (process.env.OCR_MODE ?? '').toLowerCase();
  if (m === 'genapi' && process.env.GENAPI_API_KEY) return 'genapi';
  if (m === 'anthropic' && process.env.ANTHROPIC_AUTH_TOKEN) return 'anthropic';
  
  // Auto-detect
  if (process.env.GENAPI_API_KEY) return 'genapi';
  if (process.env.ANTHROPIC_AUTH_TOKEN) return 'anthropic';
  
  throw new Error('OCR не настроен: нужен GENAPI_API_KEY или ANTHROPIC_AUTH_TOKEN');
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
}

/** Готов ли реальный распознаватель. */
export function recognizeConfigured(): boolean {
  return !!(process.env.GENAPI_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

// ── Типы (из ClaudeClaw types.ts) ──────────────────────────────────────────

/** Поля, извлекаемые из фото документов. */
export interface ClientOcrFields {
  entityType: 'гражданин' | 'ИП' | 'ООО';
  fullName: string;
  birthDate: string | null;
  passportSeries: string | null;
  passportNumber: string | null;
  passportIssuedBy: string | null;
  passportIssuedDate: string | null;
  passportDeptCode: string | null;
  registrationAddress: string | null;
  licenseNumber: string | null;
  licenseCategories: string | null;
  licenseIssuedDate: string | null;
  licenseValidUntil: string | null;
  inn: string | null;
  ogrn: string | null;
  legalAddress: string | null;
  phone: string | null;
  telegram: string | null;
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
    'Это разворот паспорта гражданина РФ. Извлеки поля:\n' +
    '{"fullName": "Фамилия Имя Отчество", "birthDate": "ДД.ММ.ГГГГ", ' +
    '"passportSeries": "4 цифры", "passportNumber": "6 цифр", ' +
    '"passportIssuedBy": "кем выдан", "passportIssuedDate": "ДД.ММ.ГГГГ", ' +
    '"passportDeptCode": "код подразделения NNN-NNN", ' +
    '"registrationAddress": "адрес регистрации (прописки), если есть"}\n' +
    'ВАЖНО про серию и номер:\n' +
    '- Серия (4 цифры) и номер (6 цифр) напечатаны ВЕРТИКАЛЬНО красным справа.\n' +
    '- ⛔ НЕ бери серию/номер из MRZ-строки (PNRUS.../RUS<<<) — там другая кодировка.\n' +
    '- Если серию/номер уверенно НЕ видно — ставь null.',
  license:
    'Это водительское удостоверение РФ. Извлеки поля:\n' +
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

// ── Вспомогательные функции ──────────────────────────────────────────────

function imageUrl(image: ImageRef): string {
  if (image.url) return image.url;
  if (image.base64) return `data:${image.mime ?? 'image/jpeg'};base64,${image.base64}`;
  throw new Error('recognizeDocument: ImageRef требует base64 или url');
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
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
    throw new Error('Ответ не является валидным JSON');
  }
}

// ── gen-api.ru (Gemini) ──────────────────────────────────────────────────

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

// ── Z.AI через Anthropic endpoint (GLM) ──────────────────────────────────

/**
 * Z.AI vision через Anthropic-compatible endpoint (glm-5.2).
 * Формат: POST /v1/messages, x-api-key, anthropic-version, messages с image_url.
 * Ответ: { content: [{ type: 'text', text: '...' }] }.
 */
async function callAnthropic(kind: DocKind, image: ImageRef): Promise<Record<string, unknown>> {
  const base = (process.env.ANTHROPIC_BASE_URL ?? DEFAULT_ANTHROPIC_BASE).replace(/\/$/, '');
  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
  const token = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!token) throw new Error('ANTHROPIC_AUTH_TOKEN не задан');

  const body = {
    model,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `${SYSTEM_PROMPT}\n\n${FIELD_SPECS[kind]}\n\nВерни ТОЛЬКО валидный JSON, без markdown.` },
          { type: 'image', source: { type: 'base64', media_type: image.mime ?? 'image/jpeg', data: image.base64 ?? '' } },
        ],
      },
    ],
  };

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
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        await res.text().catch(() => '');
        throw new Error(`anthropic HTTP ${res.status}`);
      }
      const data = (await res.json()) as { content?: { type?: string; text?: string }[] };
      const textContent = data.content?.find((c) => c.type === 'text');
      const content = textContent?.text;
      if (!content) throw new Error('anthropic: пустой ответ модели');
      return parseJsonLoose(content);
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_RETRIES) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(
    `anthropic: распознавание не удалось после ${MAX_RETRIES} попыток: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}

// ── Публичный API ───────────────────────────────────────────────────────────

/**
 * Распознать ОДИН документ (паспорт или ВУ).
 * Использует gen-api.ru (PRIMARY) или Z.AI Anthropic (fallback).
 */
export async function recognizeDocument(
  kind: DocKind,
  image: ImageRef,
): Promise<RecognizeResult> {
  const mode = ocrMode();
  let raw: Record<string, unknown>;
  
  if (mode === 'genapi') {
    raw = await callGenApi(kind, image);
  } else {
    raw = await callAnthropic(kind, image);
  }
  
  return { fields: normalizeFields(kind, raw), raw };
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
}): Promise<{ fields: ClientOcrFields; raw: Record<string, unknown> }> {
  if (!docs.passport && !docs.license) {
    throw new Error('recognizeClient: нужен хотя бы паспорт или ВУ');
  }

  const passport = docs.passport ? await recognizeDocument('passport', docs.passport) : null;
  const license = docs.license ? await recognizeDocument('license', docs.license) : null;
  const registration = docs.registration
    ? await recognizeDocument('registration', docs.registration)
    : null;

  // Приоритет полей: паспорт (база) > регистрация (адрес) > ВУ (дополняет ФИО/ДР).
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
  };
}
