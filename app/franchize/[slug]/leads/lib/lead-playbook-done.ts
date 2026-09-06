// /app/franchize/[slug]/leads/lib/lead-playbook-done.ts
//
// Дневные отметки «сделал» плейбука смены — ЧИСТАЯ логика (без window/
// localStorage: I/O-обёртки живут в LeadsPlaybookPanel, модуль можно
// тестировать в vitest без jsdom).
//
// Контракт: «новая смена = чистая очередь» — отметки живут до КОНЦА ДНЯ
// (ключ на экипаж). Главное edge-case, ради которого выделен модуль:
// вкладка оператора (ночная смена), ПЕРЕЖИВШАЯ ПОЛНОЧЬ.
//
//   •Без защиты state держит вчерашние ключи, а следующий toggle
//    записывает их УЖЕ под новым днём — вчерашняя смена протекает
//    в новую и висит отмеченной весь день.
//   •applyPlaybookDoneToggle сбрасывает чужой день до применения,
//    а msUntilNextMidnight даёт таймер, на котором панель сама
//    перечитывает стор (parsePlaybookDone вернёт пустой набор) —
//    очередь визуально очищается даже без действий оператора.

export interface PlaybookDoneState {
  /** Локальная дата отметок «YYYY-MM-DD»; "" — ещё не загружено. */
  day: string;
  keys: Set<string>;
}

/** Локальная дата «YYYY-MM-DD» (отметки живут до полуночи по местному времени). */
export function playbookTodayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Мс до следующей локальной полуночи (+1 c запас, чтобы таймер сработал
 *  уже ПОСЛЕ смены даты). Минимум 1 с — защита от отрицательного остатка. */
export function msUntilNextMidnight(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}

/** Парс записи стора: чужой день / битый JSON / чужие типы → пустой набор. */
export function parsePlaybookDone(raw: string | null | undefined, now = new Date()): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as { day?: string; keys?: unknown };
    if (parsed.day !== playbookTodayKey(now) || !Array.isArray(parsed.keys)) return new Set();
    return new Set(parsed.keys.filter((k): k is string => typeof k === "string"));
  } catch {
    return new Set();
  }
}

/**
 * Toggle «сделал» с защитой от полуночи: если state чужого дня (вкладка
 * пережила дату, а таймер ещё не успел), базой становится ЧИСТЫЙ набор —
 * вчерашние отметки не протекут в запись нового дня.
 * Возвращает added: true, если ключ ДОБАВЛЕН (для тактильного отклика:
 * отмена — не достижение, вибрируем только на «сделал»).
 */
export function applyPlaybookDoneToggle(
  state: PlaybookDoneState,
  key: string,
  now = new Date(),
): PlaybookDoneState & { added: boolean } {
  const today = playbookTodayKey(now);
  const stale = state.day !== today;
  const next = new Set(stale ? new Set<string>() : state.keys);
  const added = !next.has(key);
  if (added) next.add(key);
  else next.delete(key);
  return { day: today, keys: next, added };
}
