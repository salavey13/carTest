// app/franchize/lib/catalog-cards-shared.ts
// ─────────────────────────────────────────────────────────────────────────────
// PURE-хелперы промо-карточек каталога — общий модуль для записи
// (server-actions/catalog-cards.ts) и гидрации (actions-runtime.ts).
// НЕ "use server": импортируется обеими сторонами, включая спеки.
// ─────────────────────────────────────────────────────────────────────────────

const CAP_URL = 400;

/**
 * Boss codereview 2026-10-11 (round 2 B-NEW-1 + round 3 minor 1): href/imageUrl
 * карточек попадают в <a href>/<img src> витрины — разрешаем ТОЛЬКО
 * относительные пути того же сайта ("/…", но не "//host") или https://.
 * javascript:/data:/http:// и прочие схемы → "" (карточка без ссылки).
 * Применяется И при записи (quick admin), И при гидрации (defense-in-depth:
 * легаси-строки и записи из большого конфиг-флоу тоже не пробьют DOM).
 */
export function safeCardHref(value: unknown): string {
  const raw = String(value ?? "").trim().slice(0, CAP_URL);
  if (!raw) return "";
  if (/^\/(?!\/)/.test(raw)) return raw;
  if (/^https:\/\/\S+$/i.test(raw)) return raw;
  return "";
}
