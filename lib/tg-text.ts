// lib/tg-text.ts
// ──────────────────────────────────────────────────────────────────────────
// Hardened text sanitizers for Telegram notifications.
//
// Background: "одна буква на строку" (one letter per line). Rental
// notifications twice arrived with the bike line split ONE CHARACTER PER
// LINE — "R\ne\ng\ne\ng…" — the 2026-08-29 nbsp-only normalization did not
// fully cure it. This module is the round-2 defense:
//
//   1. CR/CRLF → LF; strips every break-prone invisible char Telegram may
//      render as a line break or break opportunity: \v \f NEL(U+0085)
//      LS/PS(U+2028/U+2029), zero-width & bidi controls (U+200B–U+200F,
//      U+2060–U+206F, U+FEFF), other C0 control chars.
//   2. nbsp family (U+00A0 from toLocaleString("ru-RU"), U+202F, U+2007)
//      → plain space.
//   3. REPAIRS the pathological shape itself: a run of ≥6 consecutive
//      one-character lines (counted in CODE POINTS, so astral emoji like
//      🏍 count as one) is re-joined into a single line. Legit text never
//      contains 6+ single-char lines in a row, so even a mangled string
//      that sneaks in from imported/edited data renders correctly.
//   4. oneLine() = per-char repair + collapse ALL whitespace runs to single
//      spaces — for data fields (bike names, names, phones) that never
//      legitimately contain newlines.
//   5. escapeHtmlText() escapes &, <, > for messages sent with
//      parse_mode: "HTML".
// -----------------------------------------------------------------------------

/** Chars Telegram treats as line breaks or break opportunities. */
const BREAK_OR_CONTROL_RE =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u0085\u200B-\u200F\u2060-\u206F\uFEFF\u2028\u2029]/g;

/** Unicode spaces emitted by Intl number formatting (ru-RU etc.). */
const NBSP_FAMILY_RE = /[\u00A0\u202F\u2007]/g;

/** A run must have at least this many consecutive 1-char lines to be repaired. */
const PER_CHAR_RUN_MIN = 6;

/** Normalize invisible chars: CR/CRLF → LF, strip break/control, nbsp → space. */
function normalizeInvisible(input: string): string {
  return String(input ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(BREAK_OR_CONTROL_RE, "")
    .replace(NBSP_FAMILY_RE, " ");
}

/**
 * Re-join runs of ≥ PER_CHAR_RUN_MIN consecutive single-character lines
 * ("R\ne\ng…" → "Reg…"). Lines are measured in code points so astral
 * emoji (🏍, length 2 in UTF-16) still count as a single-char line.
 */
function repairPerCharLines(normalized: string): string {
  const lines = normalized.split("\n");
  const repaired: string[] = [];
  let run: string[] = [];
  const flushRun = () => {
    if (run.length >= PER_CHAR_RUN_MIN) repaired.push(run.join(""));
    else repaired.push(...run);
    run = [];
  };
  for (const line of lines) {
    if ([...line].length === 1) run.push(line);
    else { flushRun(); repaired.push(line); }
  }
  flushRun();
  return repaired.join("\n");
}

/**
 * Normalize arbitrary text for a Telegram message body.
 * - CR/CRLF → LF, strips break-prone invisible chars, nbsp family → space.
 * - Re-joins runs of ≥6 consecutive single-character lines ("R\ne\ng…" →
 *   "Reg…") — the one-letter-per-line repair.
 */
export function sanitizeTelegramText(input: string): string {
  return repairPerCharLines(normalizeInvisible(input));
}

/**
 * Repair the one-letter-per-line shape, then collapse ALL newlines and
 * whitespace runs to single spaces and trim — for data fields (bike names,
 * names, phones) that never legitimately contain newlines.
 */
export function oneLine(value: unknown): string {
  return repairPerCharLines(normalizeInvisible(String(value ?? ""))).replace(/\s+/g, " ").trim();
}

/**
 * HTML-escape a data value for messages sent with parse_mode "HTML"
 * (order matters: repair + collapse whitespace first, then escape & < >).
 */
export function escapeHtmlText(value: unknown): string {
  return oneLine(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
