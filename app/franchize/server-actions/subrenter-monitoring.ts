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
