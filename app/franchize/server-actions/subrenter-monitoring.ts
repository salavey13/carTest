"use server";

// subrenter-monitoring.ts
// ──────────────────────────────────────────────────────────────────────────
// Subrent partner monitoring (iter12):
//   • getSubrenterOwnedBikesAction — the SUBRENTER's own profile panel:
//     bikes he owns (cars.specs.subrenter_chat_id = his Telegram chat id)
//     plus recent rentals of those bikes, so the partner can watch how his
//     bike performs in the park without asking the crew.
//   • getFranchizeSubrentersOverviewAction — the CREW OWNER's / admin's
//     dedicated subrenters list on their profile: one row per partner with
//     his bikes and per-bike rental stats.
//
// Ownership marker: cars.specs.subrenter_chat_id (pure JSONB, no migration).

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { canManageSubrenters } from "./bike-subrenter";

export interface SubrenterOwnedBike {
  bikeId: string;
  label: string;
  imageUrl: string | null;
  activeRentals: number;
  totalRentals: number;
  lastRentalAt: string | null;
}

export interface SubrenterOwnedRental {
  rentalId: string;
  bikeId: string;
  bikeLabel: string;
  status: string;
  paymentStatus: string;
  agreedStartDate: string | null;
  agreedEndDate: string | null;
  docLink: string;
}

export interface SubrenterOwnedBikesData {
  bikes: SubrenterOwnedBike[];
  rentals: SubrenterOwnedRental[];
}

/** Date-aware active check — mirrors getFranchizeCrewRentalsListAction. */
function isRentalEffectivelyActive(rental: {
  status?: string | null;
  agreed_end_date?: string | null;
  now: number;
}): boolean {
  if (rental.status !== "active" && rental.status !== "confirmed") return false;
  const endTs = rental.agreed_end_date ? Date.parse(rental.agreed_end_date) : Number.NaN;
  // 24h grace absorbs the bare-date-as-midnight quirk and timezone fuzz.
  if (!Number.isNaN(endTs) && endTs + 24 * 60 * 60 * 1000 < rental.now) return false;
  return true;
}

/**
 * Subrenter's own monitoring data: bikes where specs.subrenter_chat_id
 * matches the CURRENT user, plus their rentals (last 10) and stats.
 * Plain visitors (no owned bikes) get empty lists — the client hides
 * the panel then.
 */
export async function getSubrenterOwnedBikesAction(input: {
  slug: string;
  userId: string;
}): Promise<{ success: boolean; data?: SubrenterOwnedBikesData; error?: string }> {
  const parsed = z
    .object({ slug: z.string().trim().min(1), userId: z.string().trim().min(1) })
    .safeParse(input);
  if (!parsed.success) return { success: false, error: "Некорректный запрос." };
  const { slug, userId } = parsed.data;

  try {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id")
      .eq("slug", slug.trim())
      .maybeSingle();
    if (!crew) return { success: false, error: "Экипаж не найден." };

    const { data: bikes } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, image_url")
      .eq("crew_id", crew.id)
      .eq("specs->>subrenter_chat_id", userId);

    if (!bikes || bikes.length === 0) {
      return { success: true, data: { bikes: [], rentals: [] } };
    }

    const bikeIds = bikes.map((b: { id: string | number }) => String(b.id));
    const labelOf = (b: { make?: string | null; model?: string | null; id: string | number }) =>
      `${b.make ?? ""} ${b.model ?? ""}`.trim() || String(b.id);

    const { data: rentals } = await supabaseAdmin
      .from("rentals")
      .select("rental_id,status,payment_status,vehicle_id,agreed_start_date,agreed_end_date,created_at")
      .in("vehicle_id", bikeIds)
      .order("created_at", { ascending: false })
      .limit(200);

    const now = Date.now();
    const bikeById = new Map(bikes.map((b: { id: string | number }) => [String(b.id), b]));
    const rentalsOut: SubrenterOwnedRental[] = (rentals ?? []).map((r: {
      rental_id: string;
      status?: string | null;
      payment_status?: string | null;
      vehicle_id?: string | null;
      agreed_start_date?: string | null;
      agreed_end_date?: string | null;
    }) => {
      const bike = r.vehicle_id ? bikeById.get(String(r.vehicle_id)) : undefined;
      return {
        rentalId: r.rental_id,
        bikeId: String(r.vehicle_id ?? ""),
        bikeLabel: bike ? labelOf(bike) : "Байк",
        status: r.status || "unknown",
        paymentStatus: r.payment_status || "",
        agreedStartDate: r.agreed_start_date || null,
        agreedEndDate: r.agreed_end_date || null,
        docLink: `/franchize/${slug}/rental/${r.rental_id}`,
      };
    });

    const bikesOut: SubrenterOwnedBike[] = bikes.map((b: { id: string | number; make?: string | null; model?: string | null; image_url?: string | null }) => {
      const bikeId = String(b.id);
      const mine = (rentals ?? []).filter((r: { vehicle_id?: string | null }) => String(r.vehicle_id ?? "") === bikeId);
      const activeCount = mine.filter((r: { status?: string | null; agreed_end_date?: string | null }) =>
        isRentalEffectivelyActive({ status: r.status, agreed_end_date: r.agreed_end_date, now }),
      ).length;
      const lastCreated = mine[0] ? String((mine[0] as { created_at?: string }).created_at ?? "") || null : null;
      return {
        bikeId,
        label: labelOf(b),
        imageUrl: b.image_url || null,
        activeRentals: activeCount,
        totalRentals: mine.length,
        lastRentalAt: lastCreated,
      };
    });

    return { success: true, data: { bikes: bikesOut, rentals: rentalsOut.slice(0, 10) } };
  } catch (error) {
    logger.warn("[getSubrenterOwnedBikesAction] failed:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export interface SubrenterOverviewBike {
  bikeId: string;
  label: string;
  imageUrl: string | null;
  activeRentals: number;
  totalRentals: number;
}

export interface SubrenterOverviewRow {
  chatId: string;
  username: string | null;
  name: string | null;
  bikes: SubrenterOverviewBike[];
  activeRentals: number;
  totalRentals: number;
  lastRentalAt: string | null;
}

/**
 * Crew owner's / admin's dedicated subrenters list (profile panel).
 * One row per partner: who he is (@username · chat id), which bikes are his,
 * how many rentals those bikes have (active / total) and the last rental date.
 * Gate: same canManageSubrenters permission as the admin panel.
 */
export async function getFranchizeSubrentersOverviewAction(input: {
  slug: string;
  actorUserId: string;
}): Promise<{ success: boolean; data?: SubrenterOverviewRow[]; error?: string }> {
  const parsed = z
    .object({ slug: z.string().trim().min(1), actorUserId: z.string().trim().min(1) })
    .safeParse(input);
  if (!parsed.success) return { success: false, error: "Некорректный запрос." };
  const { slug, actorUserId } = parsed.data;

  try {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug.trim())
      .maybeSingle();
    if (!crew) return { success: false, error: "Экипаж не найден." };

    const allowed = await canManageSubrenters(crew.id, crew.owner_id, actorUserId);
    if (!allowed) return { success: false, error: "Недостаточно прав." };

    // Bikes with an assigned subrenter.
    const { data: bikes } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, image_url, specs")
      .eq("crew_id", crew.id)
      .not("specs->>subrenter_chat_id", "is", null);

    const rows = (bikes ?? []).map((b: {
      id: string | number;
      make?: string | null;
      model?: string | null;
      image_url?: string | null;
      specs?: Record<string, unknown> | null;
    }) => ({
      bikeId: String(b.id),
      label: `${b.make ?? ""} ${b.model ?? ""}`.trim() || String(b.id),
      imageUrl: b.image_url || null,
      chatId: typeof b.specs?.subrenter_chat_id === "string" ? b.specs.subrenter_chat_id : "",
    })).filter((r: { chatId: string }) => r.chatId.length > 0);

    if (rows.length === 0) return { success: true, data: [] };

    // Rentals of those bikes (stats only).
    const bikeIds = rows.map((r: { bikeId: string }) => r.bikeId);
    const { data: rentals } = await supabaseAdmin
      .from("rentals")
      .select("rental_id,status,vehicle_id,agreed_end_date,created_at")
      .in("vehicle_id", bikeIds)
      .order("created_at", { ascending: false })
      .limit(500);

    const now = Date.now();
    const statsByBike = new Map<string, { active: number; total: number }>();
    const lastRentalByBike = new Map<string, string>();
    for (const r of (rentals ?? []) as Array<{
      vehicle_id?: string | null;
      status?: string | null;
      agreed_end_date?: string | null;
      created_at?: string | null;
    }>) {
      const vid = String(r.vehicle_id ?? "");
      if (!vid) continue;
      const s = statsByBike.get(vid) ?? { active: 0, total: 0 };
      s.total += 1;
      if (isRentalEffectivelyActive({ status: r.status, agreed_end_date: r.agreed_end_date, now })) s.active += 1;
      statsByBike.set(vid, s);
      if (r.created_at && !lastRentalByBike.has(vid)) lastRentalByBike.set(vid, String(r.created_at));
    }

    // Resolve partner usernames/names from the users table.
    const chatIds = Array.from(new Set(rows.map((r: { chatId: string }) => r.chatId)));
    const userByChatId = new Map<string, { username: string | null; name: string | null }>();
    if (chatIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("user_id, username, full_name")
        .in("user_id", chatIds);
      for (const u of (users ?? []) as Array<{ user_id: string | number; username?: string | null; full_name?: string | null }>) {
        userByChatId.set(String(u.user_id), {
          username: u.username ? String(u.username) : null,
          name: u.full_name ? String(u.full_name) : null,
        });
      }
    }

    // Group bikes by partner.
    const byChat = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byChat.get(row.chatId) ?? [];
      list.push(row);
      byChat.set(row.chatId, list);
    }

    const out: SubrenterOverviewRow[] = [];
    for (const [chatId, partnerBikes] of byChat) {
      const user = userByChatId.get(chatId);
      const bikesOut: SubrenterOverviewBike[] = partnerBikes.map((b: { bikeId: string; label: string; imageUrl: string | null }) => {
        const s = statsByBike.get(b.bikeId) ?? { active: 0, total: 0 };
        return {
          bikeId: b.bikeId,
          label: b.label,
          imageUrl: b.imageUrl,
          activeRentals: s.active,
          totalRentals: s.total,
        };
      });
      const lastRentalAt = partnerBikes
        .map((b: { bikeId: string }) => lastRentalByBike.get(b.bikeId) ?? null)
        .filter((d: string | null): d is string => Boolean(d))
        .sort()
        .pop() ?? null;
      out.push({
        chatId,
        username: user?.username ?? null,
        name: user?.name ?? null,
        bikes: bikesOut,
        activeRentals: bikesOut.reduce((acc: number, b: SubrenterOverviewBike) => acc + b.activeRentals, 0),
        totalRentals: bikesOut.reduce((acc: number, b: SubrenterOverviewBike) => acc + b.totalRentals, 0),
        lastRentalAt,
      });
    }

    // Busiest partners first.
    out.sort((a, b) => b.totalRentals - a.totalRentals || a.chatId.localeCompare(b.chatId));
    return { success: true, data: out };
  } catch (error) {
    logger.warn("[getFranchizeSubrentersOverviewAction] failed:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Weekly owner report (subrent contract §5.5 / Приложение № 3) — iter14.
// The CREW (Арендатор по договору в парк) must hand the bike owner a weekly
// report of every rental of his bike + the owner's share of payments. This
// generator pulls real rentals for the partner's bikes over a date range
// (default: current week Mon–Sun), renders the Appendix № 3 DOCX and can
// deliver it straight to the partner's Telegram chat.
// ─────────────────────────────────────────────────────────────────────────

export interface SubrentWeeklyReportInput {
  slug: string;
  actorUserId: string;
  /** Partner (subrenter) Telegram chat id — specs.subrenter_chat_id */
  chatId: string;
  /** ISO dates YYYY-MM-DD (MSK calendar days) */
  from: string;
  to: string;
  /** Owner share override; when omitted we try the latest subrent contract
   *  artifact and fall back to the contract default of 50%. */
  ownerPercentage?: number;
  /** Send the rendered DOCX to the partner via the bot (default true). */
  sendToPartner?: boolean;
}

export interface SubrentWeeklyReportResult {
  success: boolean;
  error?: string;
  fileName?: string;
  /** base64 DOCX so the operator can also download it in the web app */
  docBase64?: string;
  sentToPartner?: boolean;
  summary?: {
    rentalCount: number;
    totalPaymentsRub: number;
    ownerPercentage: number;
    ownerPayoutRub: number;
    periodFrom: string;
    periodTo: string;
  };
}

const SUBRENT_REPORT_DEFAULT_PCT = 50;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function mskDayStartIso(dateStr: string): string {
  // MSK (UTC+3) midnight of the given calendar day
  return `${dateStr}T00:00:00+03:00`;
}
function mskDayEndIso(dateStr: string): string {
  return `${dateStr}T23:59:59.999+03:00`;
}

export async function generateSubrenterWeeklyReportAction(
  input: SubrentWeeklyReportInput,
): Promise<SubrentWeeklyReportResult> {
  const parsed = z
    .object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      chatId: z.string().trim().regex(/^\d{5,}$/),
      from: z.string().trim().regex(DATE_RE),
      to: z.string().trim().regex(DATE_RE),
      ownerPercentage: z.coerce.number().min(1).max(99).optional(),
      sendToPartner: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Некорректные параметры отчёта." };
  }
  const { slug, actorUserId, chatId, from, to, ownerPercentage, sendToPartner = true } = parsed.data;
  if (from > to) return { success: false, error: "Дата начала позже даты окончания." };

  try {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug)
      .maybeSingle();
    if (!crew) return { success: false, error: "Экипаж не найден." };
    if (!(await canManageSubrenters(crew.id, crew.owner_id, actorUserId))) {
      return { success: false, error: "Недостаточно прав." };
    }

    // Partner's bikes in this crew
    const { data: bikes } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, specs")
      .eq("crew_id", crew.id)
      .eq("specs->>subrenter_chat_id", chatId);
    if (!bikes || bikes.length === 0) {
      return { success: false, error: "У партнёра нет мотоциклов в этом экипаже." };
    }
    const bikeLabel = new Map(bikes.map((b: { id: string | number; make?: string | null; model?: string | null }) => [String(b.id), `${b.make ?? ""} ${b.model ?? ""}`.trim() || String(b.id)]));

    // Rentals of those bikes STARTING inside the period (a rental belongs to
    // the period in which it starts — same rule as the analytics day page).
    const fromIso = mskDayStartIso(from);
    const toIso = mskDayEndIso(to);
    const { data: rentals } = await supabaseAdmin
      .from("rentals")
      .select("rental_id,vehicle_id,status,total_cost,agreed_start_date,agreed_end_date,metadata")
      .in("vehicle_id", Array.from(bikeLabel.keys()))
      .gte("agreed_start_date", fromIso)
      .lte("agreed_start_date", toIso)
      .neq("status", "cancelled")
      .order("agreed_start_date", { ascending: true });

    const fmtRuDate = (iso: string | null) => {
      if (!iso) return "—";
      const d = new Date(iso);
      return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
    };

    const rows = (rentals ?? []).map((r: {
      vehicle_id?: string | null;
      status?: string | null;
      total_cost?: number | null;
      agreed_start_date?: string | null;
      agreed_end_date?: string | null;
      metadata?: Record<string, unknown> | null;
    }) => {
      const statusLabel = r.status === "completed" ? "Завершена" : r.status === "active" ? "Активна" : r.status === "confirmed" ? "Подтверждена" : "Ожидает";
      return {
        bike: bikeLabel.get(String(r.vehicle_id ?? "")) ?? String(r.vehicle_id ?? ""),
        client: String((r.metadata as Record<string, unknown> | null)?.renter_name ?? "—"),
        period: `${fmtRuDate(r.agreed_start_date)} – ${fmtRuDate(r.agreed_end_date)}`,
        rub: Math.round(Number(r.total_cost) || 0),
        statusLabel,
      };
    });

    const totalPayments = rows.reduce((acc: number, r: { rub: number }) => acc + r.rub, 0);

    // Owner share: explicit override → latest contract artifact → 50%
    let pct = ownerPercentage ?? SUBRENT_REPORT_DEFAULT_PCT;
    if (ownerPercentage == null) {
      const { data: artifact } = await supabaseAdmin
        .schema("private" as never)
        .from("subrent_contract_artifacts")
        .select("owner_percentage")
        .eq("crew_id", slug)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const stored = Number((artifact as { owner_percentage?: string | null } | null)?.owner_percentage);
      if (Number.isFinite(stored) && stored >= 1 && stored <= 99) pct = Math.round(stored);
    }
    const payout = Math.round((totalPayments * pct) / 100);

    // Crew requisites for the header block
    let orgVars: Record<string, string> = {
      organization_name: "Экипаж",
      organization_short: slug,
      inn: "—",
      legal_address: "—",
      issuer_representative: "Представитель экипажа",
      payment_deadline_days: "2",
    };
    try {
      const { data: secrets } = await supabaseAdmin
        .schema("private" as never)
        .from("crew_secrets")
        .select("contract_defaults, organization_short, organization_name, inn, legal_address")
        .eq("crew_id", slug)
        .limit(1)
        .maybeSingle();
      const cdRaw = (secrets as { contract_defaults?: unknown | null } | null)?.contract_defaults;
      let cd: Record<string, string> = {};
      if (typeof cdRaw === "string") { try { cd = JSON.parse(cdRaw); } catch { cd = {}; } }
      else if (cdRaw && typeof cdRaw === "object") cd = cdRaw as Record<string, string>;
      orgVars = {
        organization_name: (secrets as { organization_name?: string | null } | null)?.organization_name || cd.organizationName || orgVars.organization_name,
        organization_short: (secrets as { organization_short?: string | null } | null)?.organization_short || cd.organizationShort || orgVars.organization_short,
        inn: (secrets as { inn?: string | null } | null)?.inn || cd.inn || orgVars.inn,
        legal_address: (secrets as { legal_address?: string | null } | null)?.legal_address || cd.legalAddress || orgVars.legal_address,
        issuer_representative: cd.issuerRepresentative || cd.organizationRepresentative || cd.issuerName || orgVars.issuer_representative,
        payment_deadline_days: cd.payment_deadline_days || orgVars.payment_deadline_days,
      };
    } catch {
      // defaults above stay
    }

    // Partner identity (users table knows the name; bike specs may hold it too)
    let ownerFullName = `Telegram ID ${chatId}`;
    let ownerPhone = "—";
    const { data: partnerUser } = await supabaseAdmin
      .from("users")
      .select("full_name, username, metadata")
      .eq("user_id", chatId)
      .maybeSingle();
    if (partnerUser?.full_name) ownerFullName = String(partnerUser.full_name);
    else if (partnerUser?.username) ownerFullName = `@${partnerUser.username}`;
    const partnerPhone = (partnerUser?.metadata as Record<string, unknown> | null)?.phone;
    if (typeof partnerPhone === "string" && partnerPhone.length > 4) ownerPhone = partnerPhone;

    // Render Appendix № 3 rows
    const rowsHtml = rows
      .map((r: { bike: string; client: string; period: string; rub: number; statusLabel: string }, idx: number) =>
        `<tr>` +
        `<td style="border: 1px solid #000; padding: 4pt 6pt; text-align: center;">${idx + 1}</td>` +
        `<td style="border: 1px solid #000; padding: 4pt 6pt; text-align: center;">${r.period}</td>` +
        `<td style="border: 1px solid #000; padding: 4pt 6pt;">${r.bike}</td>` +
        `<td style="border: 1px solid #000; padding: 4pt 6pt;">${r.client}</td>` +
        `<td style="border: 1px solid #000; padding: 4pt 6pt; text-align: right;">${r.rub.toLocaleString("ru-RU")}</td>` +
        `<td style="border: 1px solid #000; padding: 4pt 6pt; text-align: center;">${r.statusLabel}</td>` +
        `</tr>`,
      )
      .join("\n");

    const mskNow = new Date(Date.now() + 3 * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const generatedAt = `${pad(mskNow.getUTCDate())}.${pad(mskNow.getUTCMonth() + 1)}.${mskNow.getUTCFullYear()} ${pad(mskNow.getUTCHours())}:${pad(mskNow.getUTCMinutes())}`;

    const variables: Record<string, string> = {
      ...orgVars,
      owner_full_name: ownerFullName,
      owner_phone: ownerPhone,
      date_from: fmtRuDate(fromIso),
      date_to: fmtRuDate(toIso),
      rental_rows: rowsHtml,
      zero_report: rows.length === 0 ? "1" : "",
      rental_count: String(rows.length),
      total_payments_rub: totalPayments.toLocaleString("ru-RU"),
      owner_percentage: String(pct),
      owner_payout_rub: payout.toLocaleString("ru-RU"),
      generated_at: generatedAt,
    };

    // Template: crew-specific first, general fallback (same loader as /subrent)
    const { loadTemplateForCrew } = await import("@/app/webhook-handlers/lib/crew-access");
    const template = loadTemplateForCrew("subrent_weekly_report", slug);

    const { buildFranchizeDocxFromTemplate } = await import("@/app/franchize/lib/docx-capability");
    const fileName = `subrent-weekly-report-${slug}-${chatId}-${from}.docx`;
    const doc = await buildFranchizeDocxFromTemplate({
      integrationScope: `subrent-weekly-report:${slug}`,
      uploadedBy: actorUserId,
      fileName,
      template,
      variables,
      flowType: "subrental",
      templateMode: "html",
    });

    // Deliver to the partner (best-effort, never fails the report itself)
    let sentToPartner = false;
    if (sendToPartner) {
      try {
        const { sendTelegramDocument } = await import("@/app/actions");
        const sendResult = await sendTelegramDocument(chatId, new Blob([doc.bytes]), fileName);
        sentToPartner = Boolean(sendResult?.success);
        if (!sentToPartner) {
          logger.warn("[subrent-weekly-report] partner delivery failed", { chatId, error: sendResult?.error });
        }
      } catch (sendErr) {
        logger.warn("[subrent-weekly-report] partner delivery threw (non-fatal)", sendErr);
      }
    }

    return {
      success: true,
      fileName,
      docBase64: Buffer.from(doc.bytes).toString("base64"),
      sentToPartner,
      summary: {
        rentalCount: rows.length,
        totalPaymentsRub: totalPayments,
        ownerPercentage: pct,
        ownerPayoutRub: payout,
        periodFrom: from,
        periodTo: to,
      },
    };
  } catch (error) {
    logger.error("[generateSubrenterWeeklyReportAction] failed:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
