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
import { canManageSubrenters, syncUserSubrenterFlag } from "./bike-subrenter";
import { resolveServerActorUserId } from "./shared/auth-helpers";
import {
  normalizeMonthKey,
  currentMskMonthKey,
  summarizeSubrenterMonth,
  getEquipmentCostPart,
  getBikeRevenuePart,
  type SubrenterMonthSummary,
} from "@/app/franchize/lib/subrenter-economics";

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
  initData?: string;
}): Promise<{ success: boolean; data?: SubrenterOwnedBikesData; error?: string }> {
  const parsed = z
    .object({
      slug: z.string().trim().min(1),
      userId: z.string().trim().min(1),
      initData: z.string().trim().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { success: false, error: "Некорректный запрос." };
  const { slug } = parsed.data;
  // SA-002 fix: the "self" identity must be verified server-side — a spoofed
  // userId would let anyone read another partner's bikes.
  const userId = await resolveServerActorUserId({
    claimedActorUserId: parsed.data.userId,
    initData: parsed.data.initData,
  });
  if (!userId) return { success: false, error: "Не авторизовано." };
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
      // iter18 self-heal: the flag must not claim bikes the user no longer owns.
      await syncUserSubrenterFlag(userId, crew.id, []);
      return { success: true, data: { bikes: [], rentals: [] } };
    }

    // iter18 self-heal: backfill / refresh the backwards ownership flag
    // (users.metadata.subrenterOf) from the freshly-queried bike list.
    await syncUserSubrenterFlag(
      userId,
      crew.id,
      bikes.map((b: { id: string | number }) => String(b.id)),
    );

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
      // iter27: cancelled rentals don't count toward «всего» — same rule as the
      // analytics quick counters (they never physically happened).
      const mine = (rentals ?? []).filter((r: { vehicle_id?: string | null; status?: string | null }) =>
        String(r.vehicle_id ?? "") === bikeId && String(r.status ?? "") !== "cancelled");
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
  initData?: string;
}): Promise<{ success: boolean; data?: SubrenterOverviewRow[]; error?: string }> {
  const parsed = z
    .object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      initData: z.string().trim().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { success: false, error: "Некорректный запрос." };
  const { slug } = parsed.data;
  // SA-002 fix: the actor must be verified server-side (signed cookie or
  // Telegram-signed initData) — a client-claimed id could be anyone.
  const actorUserId = await resolveServerActorUserId({
    claimedActorUserId: parsed.data.actorUserId,
    initData: parsed.data.initData,
  });
  if (!actorUserId) return { success: false, error: "Не авторизовано." };
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
      // iter27: cancelled rentals never physically happened — they must not
      // inflate a partner's «всего аренд» counter (mirrors the analytics KPIs,
      // CSV and salary rules).
      if (String(r.status ?? "") === "cancelled") continue;
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
// Monthly earnings / payouts (iter18).
//
// Scope rule (mirrors the analytics day page + weekly report): a rental
// belongs to the month in which it STARTS (MSK calendar). The money math
// (equipment part vs bike part vs 50% cut) lives in subrenter-economics.ts —
// the same helpers that drive the analytics quick counters.
// ─────────────────────────────────────────────────────────────────────────

function mskLocalMonth(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    // en-CA + year/month emits "YYYY-MM" directly.
    return new Date(iso).toLocaleDateString("en-CA", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Month boundaries in ISO (MSK) — rentals are queried by created_at window
 *  and then precisely scoped by their MSK START month in JS. */
function monthWindowIso(month: string): { fromIso: string; toIso: string } {
  const [y, m] = month.split("-").map(Number);
  // start of the month minus a 60-day advance-booking buffer
  const from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0) - 60 * 86400000);
  // end of the month plus a small tail
  const to = new Date(Date.UTC(y, m, 0, 23, 59, 59) + 86400000);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

/**
 * SUBRENTER's own monthly earnings: rentals of HIS bikes that started in the
 * requested month (default: current MSK month), each with the money split
 * (total / equipment / bike part / his 50% cut) + month totals.
 *
 * This is the «how much did I earn» panel for actual paybacks; the activation
 * notification is the immediate-satisfaction counterpart.
 */
export async function getSubrenterMonthlyEarningsAction(input: {
  slug: string;
  userId: string;
  month?: string;
  initData?: string;
}): Promise<{ success: boolean; data?: SubrenterMonthSummary; error?: string }> {
  const parsed = z
    .object({
      slug: z.string().trim().min(1),
      userId: z.string().trim().min(1),
      month: z.string().trim().optional(),
      initData: z.string().trim().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { success: false, error: "Некорректный запрос." };
  const { slug } = parsed.data;
  // SA-002 fix: the "self" identity must be verified server-side — a spoofed
  // userId would let anyone read another partner's bikes.
  const userId = await resolveServerActorUserId({
    claimedActorUserId: parsed.data.userId,
    initData: parsed.data.initData,
  });
  if (!userId) return { success: false, error: "Не авторизовано." };  const month = normalizeMonthKey(parsed.data.month) || currentMskMonthKey();

  try {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id")
      .eq("slug", slug.trim())
      .maybeSingle();
    if (!crew) return { success: false, error: "Экипаж не найден." };

    const { data: bikes } = await supabaseAdmin
      .from("cars")
      .select("id, make, model")
      .eq("crew_id", crew.id)
      .eq("specs->>subrenter_chat_id", userId);
    if (!bikes || bikes.length === 0) {
      return { success: true, data: summarizeSubrenterMonth(month, [], { docLinkBase: `/franchize/${slug}/rental` }) };
    }

    const bikeLabel = new Map(
      bikes.map((b: { id: string | number; make?: string | null; model?: string | null }) => [
        String(b.id),
        `${b.make ?? ""} ${b.model ?? ""}`.trim() || String(b.id),
      ]),
    );

    const { fromIso, toIso } = monthWindowIso(month);
    const { data: rentals } = await supabaseAdmin
      .from("rentals")
      .select("rental_id,vehicle_id,status,total_cost,agreed_start_date,agreed_end_date,requested_start_date,metadata,created_at")
      .in("vehicle_id", Array.from(bikeLabel.keys()))
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1000);

    // Precise MSK-month scoping by START date (agreed first, requested fallback).
    const scoped = (rentals ?? []).filter((r: {
      agreed_start_date?: string | null;
      requested_start_date?: string | null;
    }) => {
      const start = r.agreed_start_date || r.requested_start_date;
      return mskLocalMonth(start) === month;
    });

    const rows = scoped.map((r: {
      rental_id: string;
      vehicle_id?: string | null;
      status?: string | null;
      total_cost?: number | string | null;
      agreed_start_date?: string | null;
      agreed_end_date?: string | null;
      requested_start_date?: string | null;
      metadata?: Record<string, unknown> | null;
    }) => ({
      rentalId: String(r.rental_id),
      bikeId: String(r.vehicle_id ?? ""),
      bikeLabel: bikeLabel.get(String(r.vehicle_id ?? "")) ?? "Байк",
      status: r.status || "unknown",
      totalCost: r.total_cost ?? 0,
      agreedStartDate: r.agreed_start_date || null,
      agreedEndDate: r.agreed_end_date || null,
      requestedStartDate: r.requested_start_date || null,
      metadata: r.metadata ?? null,
    }));

    return {
      success: true,
      data: summarizeSubrenterMonth(month, rows, {
        docLinkBase: `/franchize/${slug}/rental`,
      }),
    };
  } catch (error) {
    logger.warn("[getSubrenterMonthlyEarningsAction] failed:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export interface SubrenterPayoutRow {
  chatId: string;
  username: string | null;
  name: string | null;
  bikeLabels: string[];
  rentalCount: number;
  totalRub: number;
  bikePartRub: number;
  payoutRub: number;
  summary: SubrenterMonthSummary;
}

export interface SubrentersMonthlyPayoutsData {
  month: string;
  rows: SubrenterPayoutRow[];
  totalPayoutRub: number;
}

/**
 * CREW OWNER's / admin's monthly payout sheet: one row per partner with his
 * rentals of subrented bikes started in the month, the money split and the
 * amount the crew owes him (50% of the bike part; equipment is crew money).
 * Plus the grand total — «how much to pay subrenters this month».
 */
export async function getSubrentersMonthlyPayoutsAction(input: {
  slug: string;
  actorUserId: string;
  month?: string;
  initData?: string;
}): Promise<{ success: boolean; data?: SubrentersMonthlyPayoutsData; error?: string }> {
  const parsed = z
    .object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      month: z.string().trim().optional(),
      initData: z.string().trim().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { success: false, error: "Некорректный запрос." };
  const { slug } = parsed.data;
  // SA-002 fix: the actor must be verified server-side (signed cookie or
  // Telegram-signed initData) — a client-claimed id could be anyone.
  const actorUserId = await resolveServerActorUserId({
    claimedActorUserId: parsed.data.actorUserId,
    initData: parsed.data.initData,
  });
  if (!actorUserId) return { success: false, error: "Не авторизовано." };  const month = normalizeMonthKey(parsed.data.month) || currentMskMonthKey();

  try {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug.trim())
      .maybeSingle();
    if (!crew) return { success: false, error: "Экипаж не найден." };

    const allowed = await canManageSubrenters(crew.id, crew.owner_id, actorUserId);
    if (!allowed) return { success: false, error: "Недостаточно прав." };

    const { data: bikes } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, specs")
      .eq("crew_id", crew.id)
      .not("specs->>subrenter_chat_id", "is", null);
    const partnerBikes = (bikes ?? []).map((b: {
      id: string | number;
      make?: string | null;
      model?: string | null;
      specs?: Record<string, unknown> | null;
    }) => ({
      bikeId: String(b.id),
      label: `${b.make ?? ""} ${b.model ?? ""}`.trim() || String(b.id),
      chatId: typeof b.specs?.subrenter_chat_id === "string" ? b.specs.subrenter_chat_id : "",
    })).filter((b: { chatId: string }) => b.chatId.length > 0);
    if (partnerBikes.length === 0) {
      return { success: true, data: { month, rows: [], totalPayoutRub: 0 } };
    }

    const bikeByChat = new Map<string, { bikeId: string; label: string }[]>();
    for (const b of partnerBikes) {
      const list = bikeByChat.get(b.chatId) ?? [];
      list.push({ bikeId: b.bikeId, label: b.label });
      bikeByChat.set(b.chatId, list);
    }
    const bikeLabelById = new Map(partnerBikes.map((b: { bikeId: string; label: string }) => [b.bikeId, b.label]));

    const { fromIso, toIso } = monthWindowIso(month);
    const { data: rentals } = await supabaseAdmin
      .from("rentals")
      .select("rental_id,vehicle_id,status,total_cost,agreed_start_date,agreed_end_date,requested_start_date,metadata,created_at")
      .in("vehicle_id", partnerBikes.map((b: { bikeId: string }) => b.bikeId))
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      // M4 fix: same earning statuses as the wall — expired (never
      // returned/confirmed) and disputed rentals must not inflate the payout.
      .in("status", ["completed", "active", "confirmed", "pending_confirmation"])
      .order("created_at", { ascending: false })
      .limit(2000);

    const scoped = (rentals ?? []).filter((r: {
      agreed_start_date?: string | null;
      requested_start_date?: string | null;
    }) => {
      const start = r.agreed_start_date || r.requested_start_date;
      return mskLocalMonth(start) === month;
    });

    // Group rentals per partner (a bike has exactly one partner).
    const rentalsByChat = new Map<string, Array<{
      rentalId: string;
      bikeId: string;
      bikeLabel: string;
      status: string;
      totalCost: number | string | null;
      agreedStartDate: string | null;
      agreedEndDate: string | null;
      requestedStartDate: string | null;
      metadata: Record<string, unknown> | null;
    }>>();
    for (const r of scoped as Array<{
      rental_id: string;
      vehicle_id?: string | null;
      status?: string | null;
      total_cost?: number | string | null;
      agreed_start_date?: string | null;
      agreed_end_date?: string | null;
      requested_start_date?: string | null;
      metadata?: Record<string, unknown> | null;
    }>) {
      const bikeId = String(r.vehicle_id ?? "");
      const partner = partnerBikes.find((b: { bikeId: string }) => b.bikeId === bikeId);
      if (!partner) continue;
      const list = rentalsByChat.get(partner.chatId) ?? [];
      list.push({
        rentalId: String(r.rental_id),
        bikeId,
        bikeLabel: bikeLabelById.get(bikeId) ?? "Байк",
        status: r.status || "unknown",
        totalCost: r.total_cost ?? 0,
        agreedStartDate: r.agreed_start_date || null,
        agreedEndDate: r.agreed_end_date || null,
        requestedStartDate: r.requested_start_date || null,
        metadata: r.metadata ?? null,
      });
      rentalsByChat.set(partner.chatId, list);
    }

    // Partner identities
    const chatIds = Array.from(bikeByChat.keys());
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

    const rows: SubrenterPayoutRow[] = [];
    for (const [chatId, list] of rentalsByChat) {
      const user = userByChatId.get(chatId);
      const summary = summarizeSubrenterMonth(month, list, {
        docLinkBase: `/franchize/${slug}/rental`,
      });
      rows.push({
        chatId,
        username: user?.username ?? null,
        name: user?.name ?? null,
        bikeLabels: (bikeByChat.get(chatId) ?? []).map((b) => b.label),
        rentalCount: summary.rentalCount,
        totalRub: summary.totalRub,
        bikePartRub: summary.bikePartRub,
        payoutRub: summary.cutRub,
        summary,
      });
    }

    // Partners with bikes but zero rentals this month still appear — the owner
    // wants the full payback list, not only the busy ones.
    for (const chatId of bikeByChat.keys()) {
      if (rentalsByChat.has(chatId)) continue;
      const user = userByChatId.get(chatId);
      rows.push({
        chatId,
        username: user?.username ?? null,
        name: user?.name ?? null,
        bikeLabels: (bikeByChat.get(chatId) ?? []).map((b) => b.label),
        rentalCount: 0,
        totalRub: 0,
        bikePartRub: 0,
        payoutRub: 0,
        summary: summarizeSubrenterMonth(month, [], {
          docLinkBase: `/franchize/${slug}/rental`,
        }),
      });
    }

    rows.sort((a, b) => b.payoutRub - a.payoutRub || a.chatId.localeCompare(b.chatId));
    return {
      success: true,
      data: {
        month,
        rows,
        totalPayoutRub: rows.reduce((s, r) => s + r.payoutRub, 0),
      },
    };
  } catch (error) {
    logger.warn("[getSubrentersMonthlyPayoutsAction] failed:", error);
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
  /** iter20: send the rendered DOCX to the ADMIN's own Telegram chat instead
   *  of the partner's (the blob-download button is dead in the TG WebApp
   *  iframe sandbox on iOS — «Послать себе в ТГ» replaces «Скачать отчёт»). */
  sendToSelf?: boolean;
}

export interface SubrentWeeklyReportResult {
  success: boolean;
  error?: string;
  fileName?: string;
  /** base64 DOCX so the operator can also download it in the web app */
  docBase64?: string;
  sentToPartner?: boolean;
  /** iter20: true when the report was delivered to the admin's own chat. */
  sentToSelf?: boolean;
  summary?: {
    rentalCount: number;
    totalPaymentsRub: number;
    /** iter25: bike part of the payments — the payout base (gear excluded). */
    bikePartRub: number;
    /** iter25: gear part of the payments — never split with the partner. */
    equipmentPartRub: number;
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
      sendToSelf: z.boolean().optional(),
      initData: z.string().trim().optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Некорректные параметры отчёта." };
  }
  const { slug, chatId, from, to, ownerPercentage, sendToPartner = true, sendToSelf = false } = parsed.data;
  // SA-002 fix: the actor must be verified server-side (signed cookie or
  // Telegram-signed initData) — a client-claimed id could be anyone.
  const actorUserId = await resolveServerActorUserId({
    claimedActorUserId: parsed.data.actorUserId,
    initData: parsed.data.initData,
  });
  if (!actorUserId) return { success: false, error: "Не авторизовано." };
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
      // M4 fix: mirror the wall's earning statuses — expired/disputed rows
      // never earn money and must not appear in the payout report.
      .in("status", ["completed", "active", "confirmed", "pending_confirmation"])
      .order("agreed_start_date", { ascending: true });

    // n3 fix: render in MSK (the period bounds are +03:00-stamped; on the UTC
    // server the local getters used to show the previous day for date_from).
    const fmtRuDate = (iso: string | null) => {
      if (!iso) return "—";
      const d = new Date(Date.parse(iso) + 3 * 3600 * 1000);
      return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
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
      // iter25: moto / gear split per rental — the client's wish
      // («стоимость мота и экипа отдельно»). Stored amounts (exact) when the
      // rental carries them, unit-price estimate for legacy rows.
      const equipmentRub = getEquipmentCostPart(r.metadata);
      const rub = Math.round(Number(r.total_cost) || 0);
      const bikeRub = getBikeRevenuePart(rub, equipmentRub);
      return {
        bike: bikeLabel.get(String(r.vehicle_id ?? "")) ?? String(r.vehicle_id ?? ""),
        client: String((r.metadata as Record<string, unknown> | null)?.renter_name ?? "—"),
        period: `${fmtRuDate(r.agreed_start_date)} – ${fmtRuDate(r.agreed_end_date)}`,
        rub,
        bikeRub,
        equipmentRub,
        statusLabel,
      };
    });

    const totalPayments = rows.reduce((acc: number, r: { rub: number }) => acc + r.rub, 0);
    // iter25: split the period totals into bike vs gear parts — the payout
    // base is the BIKE part only (gear belongs to the crew and is never
    // split). Previously the weekly report paid pct × TOTAL including gear,
    // which disagreed with the monthly payout sheet and overpaid partners
    // whenever gear was rented along with the bike.
    const totalEquipment = rows.reduce((acc: number, r: { equipmentRub: number }) => acc + r.equipmentRub, 0);
    const totalBikePart = rows.reduce((acc: number, r: { bikeRub: number }) => acc + r.bikeRub, 0);

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
    const payout = Math.round((totalBikePart * pct) / 100);

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
      // M1 fix: private.crew_secrets keys on crew_slug (NOT crew_id) and has
      // no requisites columns — everything lives inside contract_defaults JSON.
      // The old query returned a PostgREST error, data stayed null and the
      // report header silently fell back to "Экипаж / — / —".
      const { data: secrets } = await supabaseAdmin
        .schema("private" as never)
        .from("crew_secrets")
        .select("contract_defaults")
        .eq("crew_slug", slug)
        .limit(1)
        .maybeSingle();
      const cdRaw = (secrets as { contract_defaults?: unknown | null } | null)?.contract_defaults;
      let cd: Record<string, string> = {};
      if (typeof cdRaw === "string") { try { cd = JSON.parse(cdRaw); } catch { cd = {}; } }
      else if (cdRaw && typeof cdRaw === "object") cd = cdRaw as Record<string, string>;
      orgVars = {
        organization_name: cd.organizationName || orgVars.organization_name,
        organization_short: cd.organizationShort || orgVars.organization_short,
        inn: cd.inn || orgVars.inn,
        legal_address: cd.legalAddress || orgVars.legal_address,
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

    // Render Appendix № 3 rows — iter25: moto and gear costs in SEPARATE
    // columns (client wish: «стоимость мота и экипа отдельно»)
    const rowsHtml = rows
      .map((r: { bike: string; client: string; period: string; rub: number; bikeRub: number; equipmentRub: number; statusLabel: string }, idx: number) =>
        `<tr>` +
        `<td style="border: 1px solid #000; padding: 4pt 6pt; text-align: center;">${idx + 1}</td>` +
        `<td style="border: 1px solid #000; padding: 4pt 6pt; text-align: center;">${r.period}</td>` +
        `<td style="border: 1px solid #000; padding: 4pt 6pt;">${r.bike}</td>` +
        `<td style="border: 1px solid #000; padding: 4pt 6pt;">${r.client}</td>` +
        `<td style="border: 1px solid #000; padding: 4pt 6pt; text-align: right;">${r.bikeRub.toLocaleString("ru-RU")}</td>` +
        `<td style="border: 1px solid #000; padding: 4pt 6pt; text-align: right;">${r.equipmentRub > 0 ? r.equipmentRub.toLocaleString("ru-RU") : "—"}</td>` +
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
      bike_part_rub: totalBikePart.toLocaleString("ru-RU"),
      equipment_part_rub: totalEquipment.toLocaleString("ru-RU"),
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

    // Deliver to the partner (best-effort, never fails the report itself).
    // iter20: sendToSelf routes the SAME docx to the admin's own chat — the
    // admin wants the report in TG, not as a browser download.
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
    let sentToSelf = false;
    if (sendToSelf) {
      try {
        const { sendTelegramDocument } = await import("@/app/actions");
        const selfResult = await sendTelegramDocument(actorUserId, new Blob([doc.bytes]), fileName);
        sentToSelf = Boolean(selfResult?.success);
        if (!sentToSelf) {
          logger.warn("[subrent-weekly-report] self delivery failed", { actorUserId, error: selfResult?.error });
        }
      } catch (sendErr) {
        logger.warn("[subrent-weekly-report] self delivery threw (non-fatal)", sendErr);
      }
    }

    return {
      success: true,
      fileName,
      docBase64: Buffer.from(doc.bytes).toString("base64"),
      sentToPartner,
      sentToSelf,
      summary: {
        rentalCount: rows.length,
        totalPaymentsRub: totalPayments,
        bikePartRub: totalBikePart,
        equipmentPartRub: totalEquipment,
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
