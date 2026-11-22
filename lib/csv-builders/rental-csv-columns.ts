// lib/csv-builders/rental-csv-columns.ts
//
// iter20: pure helpers for the 3 new rentals-analytics table/CSV columns
// («Заметки», «Субарендатор», «Фото») + the hidden rental-id column that
// makes table rows clickable. Extracted from buildRentalsCsv so the join
// logic is unit-testable without Supabase.

export interface RentalNotesSource {
  /** /doc-flow operator comments: [{at, text, author}] */
  comments?: unknown;
  /** Web-order operator notes captured at the pickup freeze. */
  pickup_freeze?: unknown;
  /** Damage/return notes recorded at closure. */
  return_notes?: unknown;
  damage_notes?: unknown;
  [key: string]: unknown;
}

const NOTES_JOIN = " | ";
const NOTES_MAX_CHARS = 200;

/**
 * «Заметки» cell — all operator notes attached to the rental, most
 * authoritative first:
 *   1. metadata.comments[].text (operator comment thread)
 *   2. metadata.pickup_freeze.notes (handout notes — fuel, gear, agreements)
 *   3. metadata.return_notes / damage_notes (closure notes)
 * The /doc flow also mirrors free-form agreements here («Перчатки — в
 * подарок»), which is exactly what the operator wants to see in the sheet.
 */
export function rentalNotesSummary(metadata: RentalNotesSource | null | undefined): string {
  if (!metadata || typeof metadata !== "object") return "";
  const parts: string[] = [];

  const comments = metadata.comments;
  if (Array.isArray(comments)) {
    for (const c of comments) {
      if (!c || typeof c !== "object") continue;
      const text = (c as Record<string, unknown>)["text"];
      if (typeof text === "string" && text.trim().length > 0) {
        parts.push(text.trim().replace(/\s+/g, " "));
      }
    }
  }

  const freeze = metadata.pickup_freeze;
  if (freeze && typeof freeze === "object") {
    const notes = (freeze as Record<string, unknown>)["notes"];
    if (typeof notes === "string" && notes.trim().length > 0) {
      parts.push(notes.trim().replace(/\s+/g, " "));
    }
  }

  for (const key of ["return_notes", "damage_notes"] as const) {
    const v = metadata[key];
    if (typeof v === "string" && v.trim().length > 0) {
      parts.push(v.trim().replace(/\s+/g, " "));
    }
  }

  const joined = parts.join(NOTES_JOIN);
  if (joined.length <= NOTES_MAX_CHARS) return joined;
  return `${joined.slice(0, NOTES_MAX_CHARS - 1).trimEnd()}…`;
}

/**
 * «Фото» cell — "start+end" photo counts (e.g. "3+2" = 3 pickup photos,
 * 2 return photos). Empty when neither side has photos.
 */
export function rentalPhotoCountsLabel(
  startPhotoCount: number | null | undefined,
  endPhotoCount: number | null | undefined,
): string {
  const start = Number(startPhotoCount) || 0;
  const end = Number(endPhotoCount) || 0;
  if (start <= 0 && end <= 0) return "";
  return `${start}+${end}`;
}

/** Extract the partner-owner chat id from bike specs (subrented bike marker). */
export function subrenterChatIdFromSpecs(
  specs: Record<string, unknown> | null | undefined,
): string | null {
  const raw = specs?.["subrenter_chat_id"];
  if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return null;
}

/**
 * «Субарендатор» cell — "@username · Full Name" for the partner-owner.
 * Falls back to the bare chat id when the user is not in public.users
 * (partner never opened the app).
 */
export function subrenterCsvLabel(user: {
  user_id: string;
  full_name: string | null;
  username: string | null;
} | null | undefined): string {
  if (!user) return "";
  if (user.username) {
    return user.full_name ? `@${user.username} · ${user.full_name}` : `@${user.username}`;
  }
  return user.full_name || user.user_id;
}
