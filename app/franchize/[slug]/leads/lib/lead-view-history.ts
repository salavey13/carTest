// /app/franchize/[slug]/leads/lib/lead-view-history.ts
//
// ── ИСТОРИЯ ПРОСМОТРОВ ЛИДОВ «ЗА СМЕНУ» ─────────────────────────────────────
//
// КЛИЕНТСКАЯ ПРОСЬБА (next iteration ideas): «per-lead view history (which
// leads you already opened this shift)». Оператор за смену открывает десятки
// карточек; вернувшись к списку, он больше не помнит, кого уже изучал.
// Метка «👁 уже открывали» на карточке и счётчик «открыто за смену: N»
// снимают этот когнитивный налог.
//
// Контракт — «новая смена = чистый лист»: история живёт в localStorage
// ДО КОНЦА ДНЯ (ключ на экипаж, как у отметок плейбука) и МЕЖУСТРОЙНО
// не синхронизируется — просмотр личный и эфемерный, серверу он не нужен.
//
// ЧИСТАЯ логика (без window/localStorage — I/O-обёртки в LeadsClient),
// модуль тестируется в vitest без jsdom. Переиспользует playbookTodayKey /
// msUntilNextMidnight из lead-playbook-done.ts — одна и та же граница дня
// для всех сменных сторов (отметки плейбука, история просмотров).

import { playbookTodayKey } from "./lead-playbook-done";

/** Формат стора: { day: "YYYY-MM-DD", ids: ["leadId", …] } — ids в порядке
 *  добавления (старые в начале), при переполнении отрезаются СНАЧАЛА. */
export interface LeadViewHistoryRecord {
  day: string;
  ids: string[];
}

/** Верхняя граница истории: 300 лидов за смену — больше физически
 *  не обработать, а квота localStorage остаётся копеечной (~10 КБ). */
export const VIEWED_HISTORY_CAP = 300;

/** Формат ключа стора — единый для записи и чтения. */
export function viewedHistoryKey(slug: string): string {
  return `leads-viewed:${slug}`;
}

/**
 * Парс стора → множество просмотренных СЕГОДНЯ. Чужой день (вкладка
 * пережила полночь), битый JSON, чужие типы, неизвестные ключи → пустой
 * набор: история всегда «свежесменная». Дубликаты схлопываются, хвост
 * старше капы отбрасывается (защита от рукопашных правок стора).
 */
export function parseLeadViewHistory(
  raw: string | null | undefined,
  now: Date = new Date(),
): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as { day?: unknown; ids?: unknown };
    if (!parsed || parsed.day !== playbookTodayKey(now) || !Array.isArray(parsed.ids)) {
      return new Set();
    }
    const ids = parsed.ids.filter((id): id is string => typeof id === "string" && id.length > 0);
    // Капа отрезает СТАРЕШУЮ голову (порядок добавления сохранён).
    const capped = ids.length > VIEWED_HISTORY_CAP ? ids.slice(ids.length - VIEWED_HISTORY_CAP) : ids;
    return new Set(capped);
  } catch {
    return new Set();
  }
}

/**
 * Чистое добавление лида в историю: множество → НОВОЕ множество
 * (без мутаций). Переполнение — самая старая запись вытесняется:
 * «посмотрел 301-го — первый забыт», история отражает СВЕЖУЮ память смены.
 */
export function applyLeadViewed(base: Set<string>, leadId: string, cap = VIEWED_HISTORY_CAP): Set<string> {
  if (base.has(leadId)) return base;
  const ids = Array.from(base);
  ids.push(leadId);
  const capped = ids.length > cap ? ids.slice(ids.length - cap) : ids;
  return new Set(capped);
}

/** Сериализация стора (вызов под try/catch в I/O-обёртке). */
export function serializeLeadViewHistory(ids: Set<string>, now: Date = new Date()): string {
  return JSON.stringify({ day: playbookTodayKey(now), ids: Array.from(ids) } satisfies LeadViewHistoryRecord);
}
