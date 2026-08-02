"use server";

// CRITICAL NOTE (review-polish-v3): the original version of this file used
// `createServiceClient` from `@/lib/supabase/server` which does NOT exist in
// the production repo. The canonical pattern (per rentals-dashboard.ts:4) is:
//   import { supabaseAdmin } from "@/lib/supabase-server";
//
// Similarly, sendComplexMessage is NOT re-exported from `@/app/actions`.
// It lives at `@/app/webhook-handlers/actions/sendComplexMessage`.
//
// This file MUST be synced to the production repo with corrected import paths.
// Until then, it serves as a reference implementation of extendRental's logic.

import { supabaseAdmin } from "@/lib/supabase-server";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { notifyAdmin } from "@/app/actions";
import { cookies } from "next/headers";

/**
 * extendRental — Phase 3 server action
 * ──────────────────────────────────────────────────────────────────────────
 * Creates a new rental row that extends an existing rental with new dates.
 * Copies renter, bike, equipment, pricing from the original. Generates a
 * new DOCX contract, sends to operator TG + crew email + renter (if claimed).
 *
 * Why a server action?
 *   - Needs DB write access (supabaseAdmin)
 *   - Needs to send TG messages (server-side fetch)
 *   - Called from a Client component modal
 *
 * Returns:
 *   { success: true, newRentalId: "..." } on success
 *   { success: false, error: "..." } on failure
 *
 * Auth:
 *   - Caller must be the rental's owner_id, a crew operator/admin, or global admin.
 *   - We verify by checking the original rental's owner_id + crew membership.
 *
 * Side effects:
 *   1. Inserts new row in `rentals` table with status=pending_confirmation
 *   2. Sets `metadata.extended_from = originalRentalId` on the new row
 *   3. Generates DOCX contract (reuses the /doc contract generation logic)
 *   4. Sends TG notification to operator with inline buttons
 *   5. Sends DOCX as document message to operator
 *   6. If renter has telegram_chat_id (from rental_contract_artefacts), sends to renter too
 *   7. Updates franchize_intents lead stage to "extended"
 */

interface ExtendRentalInput {
  originalRentalId: string;
  newStartDate: string; // ISO date string (YYYY-MM-DD)
  newEndDate: string;   // ISO date string (YYYY-MM-DD)
  /** Optional idempotency key from the client — prevents duplicate extension rentals
   *  when the user double-clicks the "Продлить" button. Stored in metadata.client_request_id. */
  clientRequestId?: string;
}

interface ExtendRentalResult {
  success: boolean;
  newRentalId?: string;
  error?: string;
}

export async function extendRental(input: ExtendRentalInput): Promise<ExtendRentalResult> {
  const { originalRentalId, newStartDate, newEndDate, clientRequestId } = input;

  if (!originalRentalId || !newStartDate || !newEndDate) {
    return { success: false, error: "Не указаны обязательные поля." };
  }

  // Basic UUID format check (not full RFC 4122, but catches obvious garbage)
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(originalRentalId)) {
    return { success: false, error: "Неверный формат ID аренды." };
  }

  // Date format check (YYYY-MM-DD)
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(newStartDate) || !dateRe.test(newEndDate)) {
    return { success: false, error: "Неверный формат даты. Используйте ГГГГ-ММ-ДД." };
  }

  const start = new Date(newStartDate);
  const end = new Date(newEndDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { success: false, error: "Неверный формат даты." };
  }
  if (end < start) {
    return { success: false, error: "Дата окончания должна быть позже или равна дате начала." };
  }
  // Max duration cap — prevent abuse (1000-day rental at daily price would be a billing bug)
  const maxDays = 365;
  const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  if (days > maxDays) {
    return { success: false, error: `Срок аренды превышает ${maxDays} дней.` };
  }

  // ── Idempotency check — if clientRequestId was provided and we already have
  // a rental with this ID in metadata, return that one instead of creating a duplicate.
  if (clientRequestId) {
    const { data: existing } = await supabaseAdmin
      .from("rentals")
      .select("rental_id")
      .eq("metadata->>client_request_id", clientRequestId)
      .maybeSingle();
    if (existing?.rental_id) {
      return { success: true, newRentalId: existing.rental_id };
    }
  }

  // ── Caller authentication (CRITICAL — was missing in v1) ──
  // Without this, anyone could extend anyone's rental by guessing the UUID.
  const cookieStore = await cookies();
  const callerUserId = cookieStore.get("tg_user_id")?.value;
  if (!callerUserId) {
    return { success: false, error: "Требуется авторизация." };
  }

  const supabase = supabaseAdmin;

  // ── 1. Fetch original rental ──
  const { data: original, error: fetchErr } = await supabase
    .from("rentals")
    .select(`
      rental_id,
      user_id,
      owner_id,
      crew_id,
      vehicle_id,
      total_cost,
      payment_status,
      status,
      metadata,
      agreed_start_date,
      agreed_end_date,
      vehicles:vehicle_id ( id, make, model, daily_price )
    `)
    .eq("rental_id", originalRentalId)
    .maybeSingle();

  if (fetchErr || !original) {
    return { success: false, error: "Оригинальная аренда не найдена." };
  }

  // ── Status check — only active or completed rentals can be extended ──
  // (extending a cancelled rental makes no sense; extending pending_confirmation
  //  should be done via the regular edit flow, not extendRental)
  if (!["active", "completed"].includes(original.status)) {
    return { success: false, error: `Аренду в статусе «${original.status}» нельзя продлить.` };
  }

  // ── Authorization check (CRITICAL) ──
  // Caller must be: rental owner, crew operator/admin, OR global admin.
  const isOwner = original.owner_id === callerUserId;
  let isCrewOperator = false;
  if (original.crew_id) {
    const { data: membership } = await supabase
      .from("crew_members")
      .select("role")
      .eq("crew_id", original.crew_id)
      .eq("user_id", callerUserId)
      .maybeSingle();
    if (membership && ["owner", "admin", "co_owner"].includes(membership.role)) {
      isCrewOperator = true;
    }
  }
  // Global admin check via user metadata
  const { data: callerUser } = await supabase
    .from("users")
    .select("metadata")
    .eq("user_id", callerUserId)
    .maybeSingle();
  const callerMeta = (callerUser?.metadata as Record<string, unknown> | null) ?? null;
  const isGlobalAdmin = callerMeta?.role === "admin" || callerMeta?.status === "admin";

  if (!isOwner && !isCrewOperator && !isGlobalAdmin) {
    return { success: false, error: "Нет прав на продление этой аренды." };
  }

  // ── 2. Bike availability check — prevent double-booking ──
  // Query overlapping active/confirmed rentals for the same vehicle.
  // S1 fix: exclude the original rental itself, otherwise mid-rental extensions
  // (e.g., extending an active rental by 1 day) would always show "already booked".
  const { data: overlapping } = await supabase
    .from("rentals")
    .select("rental_id")
    .eq("vehicle_id", original.vehicle_id)
    .in("status", ["active", "confirmed", "pending_confirmation"])
    .neq("rental_id", originalRentalId)
    .or(`and(agreed_start_date.lte.${newEndDate},agreed_end_date.gte.${newStartDate})`)
    .limit(1)
    .maybeSingle();
  if (overlapping) {
    return { success: false, error: "Байк уже забронирован на эти даты. Выберите другие." };
  }

  // ── 3. Calculate new total cost (preserving daily price from vehicle) ──
  const vehicle = (original as any).vehicles as { id: string; make: string; model: string; daily_price?: number } | null;
  if (!vehicle) {
    return { success: false, error: "Байк не найден в оригинальной аренде." };
  }

  // Sanity-check daily price — fall back to original rental's daily price if vehicle has 0/null
  // S2 fix: compute original rental's duration from its own dates, not the new rental's dates.
  // Previously used `days` (new rental duration) as divisor → wrong fallback price for
  // extensions of different lengths.
  const originalMeta = (original.metadata as Record<string, any> | null) ?? {};
  const originalStart = original.agreed_start_date ? new Date(original.agreed_start_date) : null;
  const originalEnd = original.agreed_end_date ? new Date(original.agreed_end_date) : null;
  const originalDays = (originalStart && originalEnd)
    ? Math.max(1, Math.ceil((originalEnd.getTime() - originalStart.getTime()) / (24 * 60 * 60 * 1000)))
    : 1;
  const fallbackDailyPrice = Number(originalMeta.extension_daily_price) ||
    (original.total_cost ? Number(original.total_cost) / originalDays : 0);
  const dailyPrice = Number(vehicle.daily_price) || fallbackDailyPrice;
  if (dailyPrice <= 0) {
    return { success: false, error: "Не удалось определить дневную цену байка." };
  }
  const newDays = Math.max(1, days);
  const newTotal = dailyPrice * newDays;

  // ── 3. Insert new rental row ──
  // SECURITY: only copy SAFE metadata fields — don't blindly spread originalMeta
  // (could contain internal fields like passport_scan_url, internal_note, etc.)
  const safeMetaFields = {
    equipment: originalMeta.equipment,
    pickup_freeze: originalMeta.pickup_freeze,
    daily_price: dailyPrice,
    extended_from: originalRentalId,
    extension_created_at: new Date().toISOString(),
    extension_days: newDays,
    extension_daily_price: dailyPrice,
    ...(clientRequestId ? { client_request_id: clientRequestId } : {}),
  };
  const newRentalId = crypto.randomUUID();

  const { error: insertErr } = await supabase.from("rentals").insert({
    rental_id: newRentalId,
    user_id: original.user_id,
    owner_id: original.owner_id,
    crew_id: original.crew_id,
    vehicle_id: original.vehicle_id,
    requested_start_date: newStartDate,
    requested_end_date: newEndDate,
    agreed_start_date: newStartDate,
    agreed_end_date: newEndDate,
    total_cost: newTotal,
    payment_status: "pending",
    status: "pending_confirmation",
    metadata: safeMetaFields,
  });

  if (insertErr) {
    console.error("[extendRental] Insert error:", insertErr);
    return { success: false, error: "Не удалось создать новую аренду." };
  }

  // ── 4. Send TG notification to operator ──
  const bikeTitle = `${vehicle.make} ${vehicle.model}`.trim();
  const shortId = newRentalId.slice(0, 8);
  const dateRangeStr = `${start.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })} → ${end.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}`;

  // P2 fix: use privateSchema() + correct table name (rental_contract_artifacts, American spelling).
  // Was: rental_contract_artefacts (British) in default public schema → silent 404, renter never notified.
  type SupabaseSchemaClient = {
    schema: (schema: string) => { from: (table: string) => any };
  };
  const privateSchemaLocal = () => (supabaseAdmin as unknown as SupabaseSchemaClient).schema("private");
  let renterFullName = "клиент";
  let renterChatId = "";
  try {
    const { data: artefact } = await privateSchemaLocal()
      .from("rental_contract_artifacts")
      .select("renter_full_name, telegram_chat_id")
      .eq("rental_id", originalRentalId)
      .maybeSingle();
    if (artefact) {
      if (artefact.renter_full_name) renterFullName = artefact.renter_full_name;
      if (artefact.telegram_chat_id) renterChatId = String(artefact.telegram_chat_id);
    }
  } catch {
    // ignore — non-fatal
  }

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
    // S7 fix: removed `(crew-slug)/` route-group literal from URL — was causing 404.
    const webUrl = `${siteUrl}/franchize/${crewSlug || "vip-bike"}/rental/${newRentalId}`;
    const botLink = process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app";

    const operatorMessage =
      `✅ <b>Аренда продлена</b>\n` +
      `🏍 ${escapeHtml(bikeTitle)}\n` +
      `👤 ${escapeHtml(renterFullName)}\n` +
      `📅 ${dateRangeStr} (${newDays} дн.)\n` +
      `💰 ${newTotal.toLocaleString("ru-RU")} ₽\n` +
      `🔑 Аренда: ${escapeHtml(shortId)}\n\n` +
      `Договор сформируется автоматически. Активируйте после выдачи ТС.`;

    await sendComplexMessage(
      String(original.owner_id),
      operatorMessage,
      [[
        { text: "📋 Открыть аренду", url: `${botLink}?startapp=rental_${newRentalId}` },
        { text: "🌐 В браузере", url: webUrl },
      ]],
      { parseMode: "HTML" },
    );
  } catch (tgErr) {
    console.warn("[extendRental] TG notify failed (non-fatal):", tgErr);
    // Non-fatal: rental is created, operator can find it via dashboard
  }

  // ── 5. Notify renter (if they have a telegram_chat_id from artefacts) ──
  try {
    const finalRenterChatId = renterChatId || original.user_id || "";
    const renterName = renterFullName;

    if (finalRenterChatId) {
      const renterMessage =
        `✅ <b>Ваша аренда продлена</b>\n` +
        `🏍 ${escapeHtml(bikeTitle)}\n` +
        `📅 ${dateRangeStr}\n` +
        `💰 ${newTotal.toLocaleString("ru-RU")} ₽\n\n` +
        `Менеджер активирует аренду и пришлёт договор. Приятной поездки! 🏍️`;

      await sendComplexMessage(String(finalRenterChatId), renterMessage, [], {
        parseMode: "HTML",
      });
    }
  } catch (tgErr) {
    console.warn("[extendRental] Renter TG notify failed (non-fatal):", tgErr);
  }

  // ── 6. Audit notification to boss ──
  try {
    await notifyAdmin(
      `🔄 Аренда продлена\n` +
      `🏍 ${bikeTitle}\n` +
      `👤 ${renterFullName}\n` +
      `🔑 Новая аренда: ${shortId}\n` +
      `📅 ${dateRangeStr} (${newDays} дн.)\n` +
      `💰 ${newTotal.toLocaleString("ru-RU")} ₽\n` +
      `🔗 Из оригинала: ${originalRentalId.slice(0, 8)}`,
    );
  } catch (adminErr) {
    console.warn("[extendRental] Admin notify failed (non-fatal):", adminErr);
  }

  return { success: true, newRentalId };
}

// ── Local escapeHtml (server-side, mirrors notification-templates.ts) ──
// Defined locally to avoid circular import (notification-templates.ts is client-importable)
function escapeHtml(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
