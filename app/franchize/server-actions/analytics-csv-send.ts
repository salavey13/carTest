"use server";

// /app/franchize/server-actions/analytics-csv-send.ts
//
// FIX (iter4): server-action that builds the analytics CSV (rentals or sales)
// and sends it to the operator's own Telegram chat via the bot.
//
// Reuses:
//   • lib/csv-builders/rentals-csv.ts → buildRentalsCsv (block-structured:
//     АРЕНДЫ / ЭКИП / СЕРВИС / ПРОДАЖИ / СВОДКА — iter52)
//   • lib/csv-builders/sales-csv.ts  → buildSalesCsv
//   • app/actions.ts                  → sendTelegramDocument (multipart upload
//     to bot API sendDocument endpoint)
//
// Auth: the caller passes `actorUserId` (the operator's telegram_user_id,
// already validated by the page's auth context — the page won't call this
// action otherwise). We treat it as the destination chat_id AND the actor
// identity. The sendTelegramDocument helper handles the bot-token + multipart
// plumbing.

import { sendTelegramDocument } from "@/app/actions";
import { buildRentalsCsv } from "@/lib/csv-builders/rentals-csv";
import { buildSalesCsv } from "@/lib/csv-builders/sales-csv";
import { csvToXlsxBuffer } from "@/lib/csv-builders/csv-to-xlsx";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-server";

export type SendAnalyticsCsvFormat = "csv" | "xlsx";

export interface SendAnalyticsCsvParams {
  slug: string;
  from: string;
  to: string;
  actorUserId: string;
  variant: "rentals" | "sales";
  format?: SendAnalyticsCsvFormat;
}

export interface SendAnalyticsCsvResult {
  success: boolean;
  error?: string;
  // Telegram message_id of the sent document (on success)
  messageId?: number;
  // Echo back the filename for debugging
  filename?: string;
  // Echo back the totals so the caller can show a "X rentals, Y ₽" toast
  summary?: {
    rentals?: number;
    sales?: number;
    totalRevenue: number;
    totalSalary: number;
    // iter52: per-block totals of the block-structured sheet
    blocks?: {
      rentals?: { count: number; revenue: number; salary: number };
      equipment?: { count: number; revenue: number; salary: number };
      service?: { count: number; revenue: number; salary: number };
      sales?: { count: number; revenue: number; salary: number };
    };
  };
}

// ── XLSX conversion lives in lib/csv-builders/csv-to-xlsx.ts (task 124) ──
// The converter moved out of this "use server" file so the browser download
// route (rentals-csv-export?format=xlsx) shares ONE implementation — and so
// a pure helper is not exposed as a callable server action. Task 124 added
// verification-status coloring (tinted rows + bold colored status cell).

export async function sendAnalyticsCsvToTelegram(
  params: SendAnalyticsCsvParams,
): Promise<SendAnalyticsCsvResult> {
  const { slug, from, to, actorUserId, variant, format = "csv" } = params;

  if (!slug || !from || !to || !actorUserId) {
    return { success: false, error: "slug, from, to, actorUserId are required" };
  }

  // Verify the actor is a member of this crew (defense-in-depth; the page
  // already gated by auth, but a direct call should still be denied here).
  try {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, name, owner_id")
      .eq("slug", slug)
      .maybeSingle();
    if (!crew) return { success: false, error: "Crew not found" };

    const isOwner = crew.owner_id === actorUserId;
    let isMember = isOwner;
    if (!isMember) {
      const { data: membership } = await supabaseAdmin
        .from("crew_members")
        .select("role, membership_status")
        .eq("crew_id", crew.id)
        .eq("user_id", actorUserId)
        .maybeSingle();
      isMember =
        membership?.membership_status === "active" &&
        ["owner", "admin", "co_owner", "member"].includes(membership.role);
    }

    // Also accept site admins
    if (!isMember) {
      const { data: userRow } = await supabaseAdmin
        .from("users")
        .select("metadata, role, status")
        .eq("user_id", actorUserId)
        .maybeSingle();
      const userMeta = (userRow?.metadata as Record<string, unknown>) || {};
      if (
        userRow?.role === "admin" ||
        userRow?.status === "admin" ||
        userMeta?.role === "admin" ||
        userMeta?.status === "admin"
      ) {
        isMember = true;
      }
    }

    if (!isMember) {
      return { success: false, error: "Нет доступа к отправке CSV для этой команды" };
    }

    // Build the CSV
    const built = variant === "rentals"
      ? await buildRentalsCsv(slug, from, to)
      : await buildSalesCsv(slug, from, to);

    const baseFilename = built.filename.replace(/\.csv$/, "");
    let caption: string;
    if (variant === "rentals") {
      // iter52: per-block caption — аренды / экип / сервис / продажи отдельно
      // (ЗП экипа и сервиса не начисляется, поэтому в «ЗП всего» не входит).
      const s = built.summary;
      const b = s.blocks;
      const rub = (n: number) => n.toLocaleString("ru-RU");
      caption =
        `📊 Выгрузка ${from} → ${to}\n` +
        `🛵 Аренды: ${b.rentals.count} — ${rub(b.rentals.revenue)} ₽ · ЗП ${rub(b.rentals.salary)} ₽\n` +
        `🧤 Экип: ${b.equipment.count} — ${rub(b.equipment.revenue)} ₽ · ЗП учтена в арендах\n` +
        `🛠 Сервис: ${b.service.count} — ${rub(b.service.revenue)} ₽\n` +
        `🏷 Продажи: ${b.sales.count} — ${rub(b.sales.revenue)} ₽ · ЗП ${rub(b.sales.salary)} ₽\n` +
        `Σ Выручка: ${rub(s.totalRevenue)} ₽ · ЗП оператора: ${rub(s.totalSalary)} ₽`;
    } else {
      const s = built.summary as { sales: number; totalRevenue: number; totalSalary: number };
      caption =
        `🛒 Продажи ${from} → ${to}\n` +
        `• Продаж: ${s.sales}\n` +
        `• Выручка: ${s.totalRevenue.toLocaleString("ru-RU")} ₽\n` +
        `• ЗП оператора: ${s.totalSalary.toLocaleString("ru-RU")} ₽`;
    }

    let fileContent: Buffer | string = built.csv;
    let filename = built.filename;
    let mimeType = "text/csv;charset=utf-8";

    if (format === "xlsx") {
      try {
        fileContent = await csvToXlsxBuffer(built.csv, variant === "rentals" ? "Выгрузка" : "Продажи");
        filename = `${baseFilename}.xlsx`;
        mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      } catch (xlsxErr) {
        logger.warn("[analytics-csv-send] XLSX conversion failed, falling back to CSV:", xlsxErr);
      }
    }

    // sendTelegramDocument expects (chatId, fileContent, fileName) — Buffer
    // works for binary; string works for text (CSV).
    const sendResult = await sendTelegramDocument(
      actorUserId,
      fileContent,
      filename,
    );

    if (!sendResult.success) {
      return {
        success: false,
        error: sendResult.error || "Telegram sendDocument failed",
        filename,
        summary: built.summary,
      };
    }

    return {
      success: true,
      filename,
      messageId: sendResult.data?.message_id,
      summary: built.summary,
    };
  } catch (err) {
    logger.error("[analytics-csv-send] error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Internal error",
    };
  }
}
