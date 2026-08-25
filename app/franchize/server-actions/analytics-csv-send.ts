"use server";

// /app/franchize/server-actions/analytics-csv-send.ts
//
// FIX (iter4): server-action that builds the analytics CSV (rentals or sales)
// and sends it to the operator's own Telegram chat via the bot.
//
// Reuses:
//   • lib/csv-builders/rentals-csv.ts → buildRentalsCsv
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
  };
}

// ── Optional XLSX conversion (lazy-loaded so server cold-start doesn't pay
// the ExcelJS cost unless the user actually requests XLSX). ──────────────────
async function convertCsvToXlsx(csv: string, sheetName = "Sheet1"): Promise<Buffer> {
  // ExcelJS is a CJS module — use dynamic import to avoid bundler issues.
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);

  // Parse the CSV (RFC-4180-lite) — same logic as the modal's parser.
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let i = 0;
    let field = "";
    let inQ = false;
    while (i < line.length) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { inQ = true; i++; continue; }
      if (ch === ",") { out.push(field); field = ""; i++; continue; }
      field += ch; i++;
    }
    out.push(field);
    return out;
  };

  // Split lines (handle CRLF + LF + lone CR)
  const lines: string[] = [];
  let cur = "";
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === "\r") {
      lines.push(cur); cur = "";
      if (csv[i + 1] === "\n") i++;
      continue;
    }
    if (ch === "\n") { lines.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.length > 0) lines.push(cur);

  for (const line of lines) {
    if (!line) continue;
    const cells = parseLine(line);
    // Cast numeric strings to numbers so Excel formats them properly.
    const row = cells.map((c) => {
      const t = c.trim();
      if (t === "") return "";
      const n = Number(t.replace(/\s/g, "").replace(",", "."));
      return Number.isFinite(n) && /^\d+([.,]\d+)?$/.test(t) ? n : c;
    });
    ws.addRow(row);
  }

  // Style header row (bold + fill)
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF3B82F6" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  });

  // Auto-size columns (approximate by max cell length)
  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const s = String(cell.value ?? "");
      if (s.length > max) max = s.length;
    });
    col.width = Math.min(max + 2, 40);
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

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
      const s = built.summary as { rentals: number; sales: number; totalRevenue: number; totalSalary: number };
      caption =
        `📊 Аренды ${from} → ${to}\n` +
        `• Аренд: ${s.rentals}\n` +
        `• Продаж: ${s.sales}\n` +
        `• Выручка: ${s.totalRevenue.toLocaleString("ru-RU")} ₽\n` +
        `• ЗП оператора: ${s.totalSalary.toLocaleString("ru-RU")} ₽`;
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
        fileContent = await convertCsvToXlsx(built.csv, variant === "rentals" ? "Аренды" : "Продажи");
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
