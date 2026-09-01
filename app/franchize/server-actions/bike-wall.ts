// /app/franchize/server-actions/bike-wall.ts
"use server";

// ─────────────────────────────────────────────────────────────────────────────
// iter28 — «стена мото» server actions.
//
// getBikesWallAction  → fleet overview: every BIKE (cars.type = 'bike') with
//                       per-bike earnings / counters — the /bikes list page.
// getBikeStoryAction  → one bike's VK-wall: all rentals (newest first) AND
//                       service work, each rental with start/end photos
//                       (signed URLs from the private `rental-photos` bucket),
//                       money, odometer, equipment, partner/company split.
//
// SERVICE WORK DISCOVERY: the crew logs service jobs as rentals rows whose
// vehicle_id is a SERVICE price-list item (cars.type='service',
// vip-bike-svc-XXX) with metadata.bike = the real bike id and
// metadata.source = 'service_work'. So the bike's story feed = rentals of the
// bike (vehicle_id = bike) + service rentals (metadata.bike = bike), merged
// chronologically. Service ₽ never mix into rental earnings (computeBikeStats
// keeps them in serviceTotal/serviceCount).
//
// Access gate mirrors getFranchizeCrewRentalsListAction exactly:
//   • password analytics auth            → full access (all bikes)
//   • crew owner                          → full access
//   • global admin (users.role/status incl. vprAdmin, metadata legacy) → full
//   • ACTIVE crew member (any role: admin / co_owner / member)       → full
//   • subrenter (cars.specs.subrenter_chat_id) → HIS bikes only
//
// Money rule (iter27): cancelled rentals are excluded from every counter here
// via computeBikeStats — they render on the wall crossed out, worth ₽0.
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import {
  computeBikeStats,
  effectiveStatus,
  equipmentChips,
  odometerDelta,
  compareWallItems,
  mskMonthKey,
  normalizeMonthParam,
  availableMonthKeys,
  type BikeWallSummary,
  type StatsInputRow,
  type WallFeedItem,
  type WallPhoto,
} from "@/app/franchize/lib/bike-wall";
import { computePartnerSplit, resolveRentalSubrenterChatId } from "@/app/franchize/lib/rental-price-split";

const PHOTO_BUCKET = "rental-photos";
/** 60 min — a wall browsing session; images die with the page, not before. */
const SIGNED_URL_TTL_SEC = 3600;
/** Supabase batch limit safety: chunk createSignedUrls calls. */
const SIGN_CHUNK = 50;
/** Wall feed cap: a bike with a longer history keeps the newest 80 events. */
const WALL_EVENTS_CAP = 80;

// ── shared access gate ───────────────────────────────────────────────────────

interface GateResult {
  ok: true;
  crewId: string;
  /**
   * Server-VERIFIED actor identity (cookie / signed initData / password-owner
   * check). 2026-09-02 security fix: downstream scoping (subrenter bikes,
   * partner lookups) must use this, never a client-claimed id that the gate
   * did not authenticate.
   */
  actorUserId: string;
  /** empty = whole fleet; non-empty = subrenter scope (his bike ids only) */
  subrenterVehicleIds: string[];
}

/** Global admin — top-level columns first (iter8 pattern), metadata legacy second. */
function isGlobalAdminRow(user: { role: string | null; status: string | null; metadata: Record<string, unknown> | null } | null): boolean {
  const meta = user?.metadata as Record<string, unknown> | null;
  return (
    user?.role === "admin" ||
    user?.role === "vprAdmin" ||
    user?.status === "admin" ||
    meta?.role === "admin" ||
    meta?.status === "admin"
  );
}

/**
 * Identity + role resolution for one actor against one crew.
 * Owner / global admin / ANY active membership → full fleet.
 * Subrenter (specs.subrenter_chat_id) → his bikes only.
 */
async function accessForActor(params: {
  actorUserId: string;
  crewId: string;
  ownerId: string;
}): Promise<{ ok: true; subrenterVehicleIds: string[] } | { ok: false; error: string }> {
  const { actorUserId, crewId, ownerId } = params;

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("role, status, metadata")
    .eq("user_id", actorUserId)
    .maybeSingle();

  if (ownerId === actorUserId || isGlobalAdminRow(user ?? null)) {
    return { ok: true, subrenterVehicleIds: [] };
  }

  // Any ACTIVE crew membership (admin / co_owner / member) → full fleet access.
  const { data: membership } = await supabaseAdmin
    .from("crew_members")
    .select("user_id")
    .eq("crew_id", crewId)
    .eq("user_id", actorUserId)
    .eq("membership_status", "active")
    .maybeSingle();
  if (membership) return { ok: true, subrenterVehicleIds: [] };

  // Subrenter: only the bikes whose specs.subrenter_chat_id is his chat id.
  const { data: subrentBikes } = await supabaseAdmin
    .from("cars")
    .select("id")
    .eq("crew_id", crewId)
    .eq("specs->>subrenter_chat_id", actorUserId);
  const ids = (subrentBikes ?? []).map((b: { id: string }) => String(b.id));
  if (ids.length === 0) return { ok: false, error: "Недостаточно прав для просмотра." };
  return { ok: true, subrenterVehicleIds: ids };
}

async function resolveBikeWallAccess(params: {
  slug: string;
  actorUserId?: string;
  isPasswordAuth?: boolean;
  /**
   * Telegram WebApp initData (raw query string) — optional fallback for
   * browsers that block the signed actor cookie. HMAC-verified against the
   * bot token; the claimed actorUserId must match the signed user.
   */
  initData?: string;
}): Promise<GateResult | { ok: false; error: string }> {
  const { slug, actorUserId, isPasswordAuth = false, initData } = params;

  const { data: crew } = await supabaseAdmin
    .from("crews")
    .select("id, owner_id")
    .eq("slug", slug.trim())
    .maybeSingle();
  if (!crew) return { ok: false, error: "Экипаж не найден." };

  // ── 2026-09-02 security fix (SA-001): the client-supplied isPasswordAuth
  // boolean used to grant FULL fleet access with zero server-side validation —
  // anyone could call the action with { isPasswordAuth: true } and read renter
  // PII + signed photo URLs. Identity is now verified server-side, in order:
  //   1. signed Telegram actor cookie,
  //   2. signed initData fallback (HMAC-checked, actor must match),
  //   3. password path — isPasswordAuth only unlocks when the claimed
  //      actorUserId IS the crew owner / global admin (the id the password
  //      gate issued), same model as the leads LA-001 fix.
  const { cookies } = await import("next/headers");
  const { TELEGRAM_ACTOR_COOKIE, verifyTelegramActorCookieValue } = await import("@/lib/telegram-actor-cookie");
  const cookieUserId = verifyTelegramActorCookieValue(
    (await cookies()).get(TELEGRAM_ACTOR_COOKIE)?.value,
  );

  if (cookieUserId) {
    const res = await accessForActor({ actorUserId: cookieUserId, crewId: crew.id, ownerId: crew.owner_id });
    if (res.ok) return { ok: true, crewId: crew.id, actorUserId: cookieUserId, subrenterVehicleIds: res.subrenterVehicleIds };
    // A valid cookie that is not allowed here should not silently fall through
    // to weaker paths — the user IS authenticated, just not for this crew.
    return { ok: false, error: res.error };
  }

  if (initData && actorUserId) {
    try {
      const { computeTelegramWebAppHash } = await import("@/lib/telegram-webapp-auth");
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        const validation = await computeTelegramWebAppHash(initData, botToken);
        if (validation.isValid) {
          const tgUserId = (() => {
            try {
              const userJson = new URLSearchParams(initData).get("user");
              return userJson ? String((JSON.parse(userJson) as { id?: number | string }).id ?? "") : null;
            } catch {
              return null;
            }
          })();
          if (tgUserId && tgUserId === String(actorUserId).trim()) {
            const res = await accessForActor({ actorUserId: tgUserId, crewId: crew.id, ownerId: crew.owner_id });
            if (res.ok) return { ok: true, crewId: crew.id, actorUserId: tgUserId, subrenterVehicleIds: res.subrenterVehicleIds };
            return { ok: false, error: res.error };
          }
        }
      }
    } catch (err) {
      logger.warn("[resolveBikeWallAccess] initData fallback failed:", err instanceof Error ? err.message : String(err));
    }
  }

  // Password analytics path: the flag alone grants nothing — the claimed
  // actorUserId must actually be this crew's owner (or a global admin).
  if (isPasswordAuth && actorUserId) {
    const { data: actorUser } = await supabaseAdmin
      .from("users")
      .select("role, status, metadata")
      .eq("user_id", actorUserId)
      .maybeSingle();
    if (crew.owner_id === actorUserId || isGlobalAdminRow(actorUser ?? null)) {
      return { ok: true, crewId: crew.id, actorUserId, subrenterVehicleIds: [] };
    }
    return { ok: false, error: "Недостаточно прав для просмотра." };
  }

  return { ok: false, error: "Не авторизовано." };
}

// ── bike row → wall summary ──────────────────────────────────────────────────

interface CarRow {
  id: string;
  make: string | null;
  model: string | null;
  image_url: string | null;
  daily_price: number | null;
  specs: Record<string, unknown> | null;
}

function specsStr(specs: Record<string, unknown> | null, key: string): string | null {
  const v = specs?.[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}

function galleryOf(specs: Record<string, unknown> | null, image_url: string | null): string[] {
  const gallery = specs?.gallery;
  if (Array.isArray(gallery)) {
    const urls = gallery.filter((g): g is string => typeof g === "string" && g.length > 0);
    if (urls.length > 0) return urls;
  }
  return image_url ? [image_url] : [];
}

const EMPTY_STATS = {
  earnedTotal: 0, earnedThisMonth: 0, monthRentals: 0, completedCount: 0, activeCount: 0, cancelledCount: 0,
  totalCount: 0, daysInRent: 0, avgCheck: 0, odometerLatest: null, distanceTotal: 0,
  lastRentalAt: null, serviceCount: 0, serviceTotal: 0, lastServiceAt: null,
} as const;

function toSummary(car: CarRow, stats: BikeWallSummary["stats"], onRentNow: boolean): BikeWallSummary {
  const specs = car.specs && typeof car.specs === "object" ? (car.specs as Record<string, unknown>) : null;
  return {
    bikeId: String(car.id),
    label: `${car.make || ""} ${car.model || ""}`.trim() || String(car.id),
    image: car.image_url || null,
    gallery: galleryOf(specs, car.image_url),
    dailyPrice: typeof car.daily_price === "number" ? car.daily_price : null,
    year: specsStr(specs, "year"),
    plate: specsStr(specs, "plate"),
    engineType: specsStr(specs, "type"),
    vin: specsStr(specs, "vin"),
    isPartnerBike: typeof specs?.subrenter_chat_id === "string" && (specs.subrenter_chat_id as string).length > 0,
    stats,
    onRentNow,
  };
}

// ── raw rental row shape ─────────────────────────────────────────────────────

interface RentalRawRow {
  rental_id: string;
  vehicle_id: string | null;
  status: string | null;
  total_cost: number | null;
  deposit_amount: number | null;
  deposit_method: string | null;
  deposit_returned: boolean | null;
  agreed_start_date: string | null;
  agreed_end_date: string | null;
  created_at: string | null;
  created_by_operator_chat_id: string | null;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
}

const RENTAL_SELECT =
  "rental_id,vehicle_id,status,total_cost,deposit_amount,deposit_method,deposit_returned,agreed_start_date,agreed_end_date,created_at,created_by_operator_chat_id,user_id,metadata";

/** A service-work rental row → { bikeId, cost, performedAt, serviceName } or null. */
function parseServiceEvent(r: RentalRawRow): {
  bikeId: string;
  cost: number;
  performedAt: string | null;
  serviceName: string;
} | null {
  const md = (r.metadata ?? {}) as Record<string, unknown>;
  const bikeRaw = md.bike;
  const bikeId = typeof bikeRaw === "string" ? bikeRaw.trim() : "";
  if (!bikeId) return null;
  const nameRaw = md.service_name;
  const serviceName =
    (typeof nameRaw === "string" && nameRaw.trim()) || `Сервисная работа (${r.rental_id.slice(0, 6)})`;
  return {
    bikeId,
    cost: Math.round(Number(r.total_cost) || 0),
    performedAt:
      (typeof md.performed_at === "string" && md.performed_at) ||
      r.agreed_start_date ||
      r.created_at,
    serviceName,
  };
}

/** Map a raw DB rental row onto the pure engine's input shape. */
function toStatsRow(r: RentalRawRow): StatsInputRow {
  return {
    status: r.status ?? "unknown",
    totalCost: r.total_cost,
    start: r.agreed_start_date,
    end: r.agreed_end_date,
    odometerBefore: (r.metadata as Record<string, unknown> | null)?.odometer_before,
    odometerAfter: (r.metadata as Record<string, unknown> | null)?.odometer_after,
    createdAt: r.created_at,
  };
}

/** effectiveStatus with a null-safe status. */
function effStatus(status: string | null, end: string | null, now: number): string {
  return effectiveStatus(status ?? "unknown", end, now);
}

// ── fleet overview (list page) ───────────────────────────────────────────────

export async function getBikesWallAction(params: {
  slug: string;
  actorUserId?: string;
  isPasswordAuth?: boolean;
  /** Telegram WebApp initData — HMAC-verified fallback when the actor cookie is blocked. */
  initData?: string;
  /** "YYYY-MM" (MSK) — scope the per-bike month tile + fleet month total. */
  month?: string | null;
}): Promise<{
  success: boolean;
  data?: {
    bikes: BikeWallSummary[];
    viewerIsSubrenter: boolean;
    fleetEarnedTotal: number;
    /** Effective month scope actually applied (null = all-time defaults). */
    month: string | null;
    /** Month keys with any activity (newest-first) — bounds the selector. */
    availableMonths: string[];
  };
  error?: string;
}> {
  try {
    const gate = await resolveBikeWallAccess(params);
    if (!gate.ok) return { success: false, error: gate.error };
    const { crewId, subrenterVehicleIds } = gate;
    const monthKey = normalizeMonthParam(params.month) ?? undefined;

    // BIKE rows only — equipment / service price-list / wb_item entries are
    // not part of the fleet wall.
    let bikeQuery = supabaseAdmin
      .from("cars")
      .select("id, make, model, image_url, daily_price, specs")
      .eq("crew_id", crewId)
      .eq("type", "bike")
      .neq("is_test_result", true)
      .order("daily_price", { ascending: false });
    if (subrenterVehicleIds.length > 0) {
      bikeQuery = bikeQuery.in("id", subrenterVehicleIds);
    }
    const { data: cars, error: carsErr } = await bikeQuery;
    if (carsErr) return { success: false, error: `Не удалось загрузить парк: ${carsErr.message}` };

    const bikeIds = (cars ?? []).map((c: CarRow) => String(c.id));

    // Rentals of these bikes + service work logged against them, one pass:
    // bike rentals match vehicle_id; service work matches metadata.bike.
    const rentalsByVehicle = new Map<string, RentalRawRow[]>();
    const serviceByVehicle = new Map<string, RentalRawRow[]>();
    if (bikeIds.length > 0) {
      const { data: rentals } = await supabaseAdmin
        .from("rentals")
        .select(RENTAL_SELECT)
        .or(`vehicle_id.in.(${bikeIds.join(",")}),metadata->>bike.in.(${bikeIds.join(",")})`);
      for (const raw of (rentals ?? []) as unknown as RentalRawRow[]) {
        if (!raw.rental_id) continue;
        const svc = parseServiceEvent(raw);
        if (svc && svc.bikeId !== raw.vehicle_id) {
          // service row pointing at a bike (vehicle_id is the svc price item)
          const list = serviceByVehicle.get(svc.bikeId) || [];
          list.push(raw);
          serviceByVehicle.set(svc.bikeId, list);
          continue;
        }
        const key = String(raw.vehicle_id ?? "");
        const list = rentalsByVehicle.get(key) || [];
        list.push(raw);
        rentalsByVehicle.set(key, list);
      }
    }

    const now = Date.now();
    // Months with any rental/service activity across the (visible) fleet —
    // collected BEFORE stats so the selector knows where history begins.
    const fleetMonths = availableMonthKeys(
      Array.from(rentalsByVehicle.values())
        .flat()
        .map((r) => r.agreed_start_date || r.created_at),
      now,
    );
    const bikes: BikeWallSummary[] = (cars ?? []).map((car: CarRow) => {
      const rows = rentalsByVehicle.get(String(car.id)) ?? [];
      const svcRows = serviceByVehicle.get(String(car.id)) ?? [];
      const stats = computeBikeStats(
        rows.map(toStatsRow),
        now,
        svcRows.map(parseServiceEvent).filter(Boolean) as never[],
        monthKey,
      );
      const onRentNow = rows.some(
        (r) =>
          r.status !== "cancelled" &&
          ["active", "confirmed"].includes(effStatus(r.status, r.agreed_end_date, now)),
      );
      return toSummary(car, stats, onRentNow);
    });

    return {
      success: true,
      data: {
        bikes,
        viewerIsSubrenter: subrenterVehicleIds.length > 0,
        // Month scope: sum the month slice when a month is selected.
        fleetEarnedTotal: bikes.reduce(
          (acc, b) => acc + (monthKey ? b.stats.earnedThisMonth : b.stats.earnedTotal),
          0,
        ),
        month: monthKey ?? null,
        availableMonths: fleetMonths,
      },
    };
  } catch (error) {
    logger.error("[getBikesWallAction]", error);
    return { success: false, error: error instanceof Error ? error.message : "Внутренняя ошибка" };
  }
}

// ── one bike's story (wall page) ─────────────────────────────────────────────

export async function getBikeStoryAction(params: {
  slug: string;
  bikeId: string;
  actorUserId?: string;
  isPasswordAuth?: boolean;
  /** Telegram WebApp initData — HMAC-verified fallback when the actor cookie is blocked. */
  initData?: string;
  /**
   * "YYYY-MM" (MSK) — when set, the wall shows only that month's events and
   * the month KPI is scoped to it (2026-09-01: month selector request).
   */
  month?: string | null;
}): Promise<{
  success: boolean;
  data?: {
    bike: BikeWallSummary;
    feed: WallFeedItem[];
    /** Effective month scope (null = whole history). */
    month: string | null;
    /** Month keys with any activity for this bike (newest-first). */
    availableMonths: string[];
    /**
     * Partner owner of this bike (specs.subrenter_chat_id), if any — the
     * story page shows a «партнёрское мото» chip with the contact.
     */
    partner: { name: string | null; username: string | null } | null;
  };
  error?: string;
}> {
  try {
    const gate = await resolveBikeWallAccess(params);
    if (!gate.ok) return { success: false, error: gate.error };
    const { crewId, subrenterVehicleIds } = gate;
    const monthKey = normalizeMonthParam(params.month) ?? undefined;

    const { data: car } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, image_url, daily_price, specs")
      .eq("id", params.bikeId.trim())
      .eq("crew_id", crewId)
      .eq("type", "bike")
      .maybeSingle();
    if (!car) return { success: false, error: "Мото не найдено в этом экипаже." };
    if (subrenterVehicleIds.length > 0 && !subrenterVehicleIds.includes(String(car.id))) {
      return { success: false, error: "Это мото принадлежит другому партнёру." };
    }

    const specs = car.specs && typeof car.specs === "object" ? (car.specs as Record<string, unknown>) : null;
    const bikeSubrenterChatId =
      typeof specs?.subrenter_chat_id === "string" ? (specs.subrenter_chat_id as string) : null;

    // Bike rentals + service work against THIS bike, one query.
    const { data: rentals, error: rentalsErr } = await supabaseAdmin
      .from("rentals")
      .select(RENTAL_SELECT)
      .or(`vehicle_id.eq.${car.id},metadata->>bike.eq.${car.id}`)
      .order("agreed_start_date", { ascending: false, nullsFirst: false })
      .limit(300);
    if (rentalsErr) return { success: false, error: `Не удалось загрузить историю: ${rentalsErr.message}` };

    const rows = (rentals ?? []) as unknown as RentalRawRow[];
    const bikeRentals: RentalRawRow[] = [];
    const serviceRentals: RentalRawRow[] = [];
    for (const r of rows) {
      const svc = parseServiceEvent(r);
      if (svc && svc.bikeId === String(car.id) && r.vehicle_id !== String(car.id)) {
        serviceRentals.push(r);
      } else if (String(r.vehicle_id ?? "") === String(car.id)) {
        bikeRentals.push(r);
      }
    }

    const now = Date.now();
    const stats = computeBikeStats(
      bikeRentals.map(toStatsRow),
      now,
      serviceRentals.map(parseServiceEvent).filter(Boolean) as never[],
      monthKey,
    );
    const onRentNow = bikeRentals.some(
      (r) =>
        r.status !== "cancelled" &&
        ["active", "confirmed"].includes(effStatus(r.status, r.agreed_end_date, now)),
    );
    const bike: BikeWallSummary = toSummary(car as CarRow, stats, onRentNow);

    // ── photos for every BIKE rental (service rows have no photos), batched ──
    const rentalIds = bikeRentals.slice(0, WALL_EVENTS_CAP).map((r) => r.rental_id);
    const photosByRental = new Map<string, WallPhoto[]>();
    if (rentalIds.length > 0) {
      const { data: photoRows } = await supabaseAdmin
        .from("rental_photos")
        .select("id, rental_id, photo_type, storage_path, width, height, uploaded_by, uploader_role, created_at")
        .in("rental_id", rentalIds)
        .is("deleted_at", null)
        .is("archived_at", null)
        .order("created_at", { ascending: true });
      const photoRows2 = (photoRows ?? []) as Array<{
        id: string; rental_id: string; photo_type: string; storage_path: string;
        width: number | null; height: number | null; uploaded_by: string | null;
        uploader_role: string | null; created_at: string | null;
      }>;

      const paths = photoRows2.map((p) => p.storage_path);
      const urlByPath = new Map<string, string>();
      for (let i = 0; i < paths.length; i += SIGN_CHUNK) {
        const chunk = paths.slice(i, i + SIGN_CHUNK);
        const { data: signed, error: signErr } = await supabaseAdmin.storage
          .from(PHOTO_BUCKET)
          .createSignedUrls(chunk, SIGNED_URL_TTL_SEC);
        if (signErr) {
          logger.warn("[getBikeStoryAction] signed url chunk failed:", signErr.message);
          continue;
        }
        (signed ?? []).forEach((s, j) => {
          if (s?.signedUrl) urlByPath.set(chunk[j], s.signedUrl);
        });
      }

      for (const p of photoRows2) {
        const url = urlByPath.get(p.storage_path);
        if (!url) continue;
        const list = photosByRental.get(p.rental_id) || [];
        list.push({
          photoId: p.id,
          photoType: p.photo_type,
          url,
          width: p.width,
          height: p.height,
          takenAt: p.created_at,
          uploaderRole: p.uploader_role,
        });
        photosByRental.set(p.rental_id, list);
      }
    }

    // ── operator/master names (one users lookup for the whole wall) ──
    const operatorIds = Array.from(
      new Set(
        [...bikeRentals, ...serviceRentals]
          .map((r) => r.created_by_operator_chat_id || r.user_id)
          .filter(Boolean) as string[],
      ),
    );
    const operatorNames = new Map<string, string>();
    if (operatorIds.length > 0) {
      const { data: operators } = await supabaseAdmin
        .from("users")
        .select("user_id, username, full_name")
        .in("user_id", operatorIds);
      for (const u of operators ?? []) {
        // iter31 fix: users has NO first_name/last_name columns (only
        // full_name) — the old select errored and every operator name on the
        // wall silently rendered as null.
        const name = (u.full_name ? String(u.full_name) : "").trim();
        operatorNames.set(String(u.user_id), name || (u.username ? `@${u.username}` : String(u.user_id)));
      }
    }

    const nameOf = (chatId: string | null): string | null =>
      chatId ? operatorNames.get(chatId) ?? null : null;

    // ── build feed items (rentals + service events), newest first ──
    const feed: WallFeedItem[] = [];

    for (const r of bikeRentals.slice(0, WALL_EVENTS_CAP)) {
      const md = (r.metadata ?? {}) as Record<string, unknown>;
      const eff = effStatus(r.status, r.agreed_end_date, now);
      const renterName =
        (typeof md.renter_name === "string" && md.renter_name.trim()) ||
        (typeof md.renterName === "string" && md.renterName.trim()) ||
        "Арендатор";
      const renterPhone =
        typeof md.renter_phone === "string" ? md.renter_phone : typeof md.renterPhone === "string" ? md.renterPhone : null;
      const odoBeforeRaw = md.odometer_before ?? md.odometerBefore;
      const odoAfterRaw = md.odometer_after ?? md.odometerAfter;
      const odoBefore = odoBeforeRaw == null ? null : Number(odoBeforeRaw);
      const odoAfter = odoAfterRaw == null ? null : Number(odoAfterRaw);

      const split = computePartnerSplit({
        totalCost: r.total_cost,
        metadata: md,
        subrenterChatId: resolveRentalSubrenterChatId(md, bikeSubrenterChatId),
      });

      const operatorChatId = r.created_by_operator_chat_id || r.user_id || null;

      feed.push({
        kind: "rental",
        rentalId: r.rental_id,
        status: eff,
        renterName,
        renterPhone,
        start: r.agreed_start_date,
        end: r.agreed_end_date,
        createdAt: r.created_at,
        totalCost: Math.round(Number(r.total_cost) || 0),
        depositAmount: Math.round(Number(r.deposit_amount ?? md.deposit_amount) || 0),
        depositMethod:
          r.deposit_method ?? (typeof (md.deposit as Record<string, unknown> | undefined)?.method === "string"
            ? String((md.deposit as Record<string, unknown>).method)
            : null),
        depositReturned: Boolean(r.deposit_returned ?? md.deposit_returned),
        odometerBefore: odoBefore != null && Number.isFinite(odoBefore) ? odoBefore : null,
        odometerAfter: odoAfter != null && Number.isFinite(odoAfter) ? odoAfter : null,
        odometerDelta: odometerDelta(odoBeforeRaw, odoAfterRaw),
        equipment: equipmentChips(md.equipment),
        partnerRub: split.partnerRub,
        companyRub: split.companyRub,
        operatorChatId,
        operatorName: nameOf(operatorChatId),
        photos: photosByRental.get(r.rental_id) ?? [],
        isNow: eff === "active" || eff === "confirmed",
      });
    }

    for (const r of serviceRentals.slice(0, WALL_EVENTS_CAP)) {
      const svc = parseServiceEvent(r);
      if (!svc) continue;
      const operatorChatId = r.created_by_operator_chat_id || null;
      feed.push({
        kind: "service",
        rentalId: r.rental_id,
        status: "completed",
        renterName: svc.serviceName,
        renterPhone: null,
        start: svc.performedAt,
        end: null,
        createdAt: r.created_at,
        totalCost: svc.cost,
        depositAmount: 0,
        depositMethod: null,
        depositReturned: false,
        odometerBefore: null,
        odometerAfter: null,
        odometerDelta: 0,
        equipment: [],
        partnerRub: 0,
        companyRub: 0,
        operatorChatId,
        operatorName: nameOf(operatorChatId),
        photos: [],
        isNow: false,
        service: {
          rentalId: r.rental_id,
          serviceName: svc.serviceName,
          cost: svc.cost,
          performedAt: svc.performedAt,
          masterName: nameOf(operatorChatId),
        },
      });
    }

    feed.sort(compareWallItems);

    // Month scope: keep only events whose (start || createdAt) falls in the
    // selected MSK month; the KPI band is already scoped via computeBikeStats.
    const inMonth = (item: WallFeedItem): boolean =>
      mskMonthKey(item.start || item.createdAt, now) === monthKey;
    const scoped = monthKey ? feed.filter(inMonth) : feed;
    const capped = scoped.slice(0, WALL_EVENTS_CAP);

    // Months with any activity for THIS bike (before scoping) — selector bounds.
    const bikeMonths = availableMonthKeys(
      [...bikeRentals, ...serviceRentals].map(
        (r) => r.agreed_start_date || r.created_at,
      ),
      now,
    );

    // ── partner owner (who handed this bike to the crew) ──
    let partner: { name: string | null; username: string | null } | null = null;
    if (bikeSubrenterChatId) {
      const { data: partnerUser } = await supabaseAdmin
        .from("users")
        .select("username, full_name")
        .eq("user_id", bikeSubrenterChatId)
        .maybeSingle();
      if (partnerUser) {
        partner = {
          name: partnerUser.full_name ? String(partnerUser.full_name).trim() || null : null,
          username: partnerUser.username ? String(partnerUser.username) : null,
        };
      }
    }

    return {
      success: true,
      data: {
        bike,
        feed: capped,
        month: monthKey ?? null,
        availableMonths: bikeMonths,
        partner,
      },
    };
  } catch (error) {
    logger.error("[getBikeStoryAction]", error);
    return { success: false, error: error instanceof Error ? error.message : "Внутренняя ошибка" };
  }
}
