// /app/franchize/lib/notification-log.ts
//
// Pure helpers for reading the `franchize_order_notifications` audit table.
//
// WHY THIS EXISTS (iter21): the admin panel's «Сбои отправки» loader used to
// `.select("order_id, send_to, ...")` — but the table has NO `send_to` column
// (see supabase/migrations/20260313090000_franchize_order_notifications.sql:
// id, slug, order_id, payload, send_status, attempts, rendered_markdown,
// doc_file_name, last_error, created_at, updated_at). Every query died with
// `column franchize_order_notifications.send_to does not exist` and the admin
// saw the toast «Не удалось загрузить уведомления».
//
// The recipient identity was never a column — it lives inside the payload
// JSONB, written differently by the two producers:
//   1. Order flow (actions-runtime.ts createFranchizeOrderNotificationLog):
//      payload.telegramUserId ("413553377") + payload.recipient ("Paul").
//   2. Configurator flow (actions_configurator.ts):
//      payload.sentTo = [{ tgId: "413553377", ok: true }, ...].
//
// deriveNotificationSendTo() reads both shapes (and tolerates legacy rows)
// so the failure list can show WHO was supposed to receive the doc.

/**
 * Derive a human-readable recipient label from a notification-log payload.
 * Returns "" when nothing recognizable is present.
 *
 * Priority:
 *   1. payload.sentTo[] (configurator) — "413553377, 8037950842"
 *   2. payload.recipient + payload.telegramUserId (order flow) — "Paul · TG 413553377"
 *   3. either one alone
 */
export function deriveNotificationSendTo(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;

  // Configurator shape: array of per-recipient send results.
  if (Array.isArray(p.sentTo)) {
    const ids = p.sentTo
      .map((entry) => {
        if (!entry || typeof entry !== "object") return "";
        const tgId = (entry as Record<string, unknown>).tgId;
        if (typeof tgId === "number" && Number.isFinite(tgId)) return String(tgId);
        return typeof tgId === "string" ? tgId.trim() : "";
      })
      .filter((id) => id.length > 0);
    if (ids.length > 0) return ids.join(", ");
  }

  const recipient = typeof p.recipient === "string" ? p.recipient.trim() : "";
  const rawTgId = p.telegramUserId;
  const tgId =
    typeof rawTgId === "number" && Number.isFinite(rawTgId)
      ? String(rawTgId)
      : typeof rawTgId === "string"
        ? rawTgId.trim()
        : "";

  if (recipient && tgId) return `${recipient} · TG ${tgId}`;
  if (recipient) return recipient;
  if (tgId) return `TG ${tgId}`;
  return "";
}
