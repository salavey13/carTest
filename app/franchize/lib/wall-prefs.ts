// app/franchize/lib/wall-prefs.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// Wall-notification preferences (polish round, profile v1 session).
//
// The fanout libs (wall-notify / wall-engage-notify) used to DM everyone in
// the crew regardless of the notification preferences the user set in their
// profile («Стена экипажа» toggle — franchizeNotificationPreferences).
// This helper centralizes the opt-out: ONE users read per fanout, cheap and
// never-throw (a prefs outage must not suppress notifications).
//
// Semantics (defaults keep the old behaviour):
//   · missing user row / missing prefs → WALL DMs allowed (true);
//   · crew-specific override wins over the global default;
//   · wallActivity === false → the user is excluded from wall fanout.
// Transactional notifications (order statuses etc.) are NOT affected.
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

/** Pure check (unit-tested): does this metadata payload allow wall DMs? */
export function userWantsWallActivity(metadata: unknown, slug: string): boolean {
  const meta = typeof metadata === "object" && metadata ? (metadata as Record<string, unknown>) : {};
  const prefs = typeof meta.franchizeNotificationPreferences === "object" && meta.franchizeNotificationPreferences
    ? (meta.franchizeNotificationPreferences as Record<string, unknown>)
    : {};
  const slugPrefs = typeof prefs[slug] === "object" && prefs[slug] ? (prefs[slug] as Record<string, unknown>) : null;
  const defaultPrefs = typeof prefs.default === "object" && prefs.default ? (prefs.default as Record<string, unknown>) : null;
  const source = slugPrefs ?? defaultPrefs;
  if (!source) return true;
  return source.wallActivity !== false;
}

/**
 * Filter fanout recipients by the wall-activity preference. Never throws —
 * on any error the ORIGINAL list is returned (deliver, don't silently drop).
 */
export async function filterWallNotifyRecipients(ids: string[], slug: string): Promise<string[]> {
  const wanted = [...new Set(ids.filter(Boolean))];
  if (wanted.length === 0) return [];
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("user_id, metadata")
      .in("user_id", wanted)
      .abortSignal(AbortSignal.timeout(5000));
    if (error) {
      logger.warn("[wall-prefs] prefs read failed (notify anyway)", { error: error.message });
      return ids;
    }
    const allowed = new Set<string>();
    for (const row of (data ?? []) as { user_id: string; metadata: unknown }[]) {
      if (userWantsWallActivity(row.metadata, slug)) allowed.add(row.user_id);
    }
    // Rows missing from the answer (no users row at all) keep the old
    // behaviour: notify (the crew fanout resolver put them there on purpose).
    return ids.filter((id) => !wanted.includes(id) || allowed.has(id));
  } catch (error) {
    logger.warn("[wall-prefs] prefs read crashed (notify anyway)", error);
    return ids;
  }
}
