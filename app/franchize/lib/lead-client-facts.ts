// /app/franchize/lib/lead-client-facts.ts
//
// НАКОПИТЕЛЬНАЯ КАРТОЧКА КЛИЕНТА («подготовка за 5 минут»).
//
// Владелец: «lead info accumulates making 5 minut prep possible; we can
// precreate client/lead info on first message reception stage right away
// during response preparation ai pass — just feed additional client related
// info along actual message from avito chat».
//
// Как это работает: авито-агент при подготовке ответа уже достаёт факты из
// сообщения. Он (или фабричный монитор) может прислать их вместе с событием
// в webhook — блок `analysis.client_facts` (или `client` от монитора).
// Факты НАКОПИТЕЛЬНЫЕ: `analysis` последнего сообщения заменяется, а факты
// — мерджатся (первое значение живёт, пока не придёт явное обновление).
// Оператор открывает лид и за 5 минут видит всё: кто, что хочет, бюджет,
// когда кататься, что уже спрашивал.

/** Максимальный размер накопительного лога сообщений в metadata.messages. */
export const MAX_MESSAGE_LOG = 12;

export interface LeadClientFacts {
  name?: string;
  phone?: string;
  city?: string;
  budget?: string;
  bike_interest?: string;
  preferred_date?: string;
  license?: string;
  experience?: string;
  [key: string]: string | undefined;
}

const FACT_KEYS: ReadonlyArray<keyof LeadClientFacts> = [
  "name",
  "phone",
  "city",
  "budget",
  "bike_interest",
  "preferred_date",
  "license",
  "experience",
];

const FACT_LABELS_RU: Record<string, string> = {
  name: "Имя",
  phone: "Телефон",
  city: "Город",
  budget: "Бюджет",
  bike_interest: "Интересует мото",
  preferred_date: "Когда хочет кататься",
  license: "Категория/права",
  experience: "Опыт",
};

export function factLabelRu(key: string): string {
  return FACT_LABELS_RU[key] || key;
}

/** Обрезка + чистка строкового факта. null — мусор/пусто. */
function cleanFact(value: unknown, max = 160): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Санитизация блока client_facts от агента/монитора: только известные ключи
 * (плюс до 6 кастомных), короткие строки. null — присылать было нечего.
 */
export function sanitizeClientFacts(input: unknown): LeadClientFacts | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const out: LeadClientFacts = {};
  for (const key of FACT_KEYS) {
    const v = cleanFact(raw[key]);
    if (v) out[key] = v;
  }
  // Кастомные ключи агента (например "trade_in", "helmet") — с лимитом.
  let custom = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (custom >= 6) break;
    if (FACT_KEYS.includes(k as keyof LeadClientFacts)) continue;
    const cleanKey = cleanFact(k, 40);
    const cleanVal = cleanFact(v, 160);
    if (cleanKey && cleanVal && /^[a-z0-9_]+$/i.test(cleanKey)) {
      out[cleanKey] = cleanVal;
      custom += 1;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Мердж накопительных фактов: новое значение ПЕРЕЗАПИСЫВАЕТ старое только
 * если пришло; пустые старые добираются. Порядок полей стабилен.
 */
export function mergeClientFacts(
  prev: unknown,
  next: LeadClientFacts | null,
): LeadClientFacts | null {
  if (!next) {
    const base = sanitizeClientFacts(prev);
    return base;
  }
  const base: LeadClientFacts =
    prev && typeof prev === "object" && !Array.isArray(prev)
      ? { ...(prev as LeadClientFacts) }
      : {};
  const merged: LeadClientFacts = { ...base, ...next };
  // Чистим undefined-пустоты, чтобы JSONB не пух пустыми ключами.
  for (const k of Object.keys(merged)) {
    if (!merged[k]) delete merged[k];
  }
  return Object.keys(merged).length > 0 ? merged : null;
}

/** Одна запись накопительного лога чата (metadata.messages). */
export interface LeadMessageLogEntry {
  at: string;
  /** buyer | seller | agent. */
  from: string;
  text: string;
}

/** Добавление записи в лог чата (последние MAX_MESSAGE_LOG). */
export function appendMessageLog(
  prev: unknown,
  entry: LeadMessageLogEntry,
): LeadMessageLogEntry[] {
  const list: LeadMessageLogEntry[] =
    Array.isArray(prev) ? (prev as LeadMessageLogEntry[]) : [];
  const text = (entry.text || "").trim().slice(0, 500);
  const next = [...list, { at: entry.at, from: entry.from, text }];
  return next.slice(-MAX_MESSAGE_LOG);
}
