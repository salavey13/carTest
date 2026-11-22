// app/franchize/server-actions/season-stats.ts
// "use server"
//
// Сезонная статистика экипажа (сезон 2026: апрель–октябрь).
//
// Design goals (boss brief 2026-10-19):
//   • DO NOT burn through Supabase usage — cheap requests only:
//       – overview = 3 narrow range queries (rentals / sales / cash) with
//         minimal columns, aggregated in JS; results cached in memory 10 min
//         (single-flight, one loader per crew);
//       – month details are LAZY — loaded only when the user opens a month;
//       – counters for verification use getVerificationStatusMap (chunked
//         reads of rental_verifications) instead of loading full rows.
//   • Any crew member may look at their crew's numbers; verification round +
//     per-rental resend stay owner-tier (the same gate as the payout hub).
//   • Infographics are drawn client-side (CSS/SVG) — no pictures.

"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import {
  verifyCrewAccess,
  handleError,
  successResponse,
  errorResponse,
  type ActionResponse,
} from "./shared/auth-helpers";
import {
  getVerificationStatusMap,
  requestRentalVerification,
} from "@/app/franchize/lib/rental-verify";
import { getCrewPayoutSummary, type PayoutSummaryView } from "@/app/franchize/lib/rental-payout";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { logger } from "@/lib/logger";
import {
  SEASON_YEAR,
  SEASON_MONTH_KEYS,
  monthLabelRu,
} from "./season-stats-constants";

function currentMskMonthKey(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

// ── In-memory cache (house pattern: salaryCalcCache) ────────────────────────
interface CacheEntry {
  data: unknown;
  expiry: number;
  inflight?: Promise<unknown>;
}
const statsCache = new Map<string, CacheEntry>();
const TTL_MS = 10 * 60 * 1000;

async function withCache<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = statsCache.get(key);
  const now = Date.now();
  if (hit && hit.expiry > now) return hit.data as T;
  if (hit?.inflight) return hit.inflight as Promise<T>;
  const inflight: Promise<T> = (async () => {
    const data = await loader();
    statsCache.set(key, { data, expiry: Date.now() + TTL_MS });
    return data;
  })();
  statsCache.set(key, { data: (hit?.data ?? null) as unknown, expiry: hit?.expiry ?? 0, inflight });
  try {
    return await inflight;
  } finally {
    const cur = statsCache.get(key);
    if (cur && cur.inflight === inflight) delete cur.inflight;
  }
}

function invalidateCrewCache(crewId: string) {
  for (const key of statsCache.keys()) {
    if (key.startsWith(`season:${crewId}`)) statsCache.delete(key);
  }
}

// ── Shared fetchers (narrow, cached) ────────────────────────────────────────
interface SeasonRentalRow {
  rental_id: string;
  status: string | null;
  total_cost: number | null;
  payment_status: string | null;
  requested_start_date: string | null;
  agreed_start_date: string | null;
  created_at: string | null;
  vehicle: { make: string | null; model: string | null; type: string | null } | null;
}

function startMonthOf(row: { requested_start_date: string | null; agreed_start_date: string | null }): string {
  return (row.requested_start_date || row.agreed_start_date || "")?.slice(0, 7) || "";
}

function rub(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** private-schema client (sale artifacts live in `private`) — loosely typed,
 *  matching the `as any` house style of the verification/payout modules. */
function privateSchemaClient(): { from: (table: string) => any } {
  return (supabaseAdmin as unknown as {
    schema: (s: string) => { from: (t: string) => any };
  }).schema("private");
}

async function fetchSeasonRentals(crewId: string): Promise<SeasonRentalRow[]> {
  const { data, error } = await supabaseAdmin
    .from("rentals")
    .select(`
      rental_id, status, total_cost, payment_status,
      requested_start_date, agreed_start_date, created_at,
      vehicle:cars!inner(make, model, type, crew_id)
    `)
    .eq("vehicle.crew_id", crewId)
    .neq("status", "cancelled")
    .order("requested_start_date", { ascending: true })
    .limit(2000);
  if (error) throw error;
  return (data || []) as unknown as SeasonRentalRow[];
}

async function fetchSeasonSales(crewId: string): Promise<Array<{ created_at: string | null; sale_price: string | number | null }>> {
  const { data: cars } = await supabaseAdmin.from("cars").select("id").eq("crew_id", crewId);
  const bikeIds = (cars || []).map((c) => c.id);
  if (bikeIds.length === 0) return [];
  const from = `${SEASON_MONTH_KEYS[0]}-01T00:00:00+03:00`;
  const to = "2026-11-01T00:00:00+03:00";
  const { data, error } = await privateSchemaClient()
    .from("sale_contract_artifacts")
    .select("id, sale_price, created_at")
    .in("resolved_bike_id", bikeIds)
    .gte("created_at", from)
    .lt("created_at", to)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) {
    logger.warn("[season-stats] sales fetch failed (degrading to empty):", error.message);
    return [];
  }
  return (data || []) as Array<{ created_at: string | null; sale_price: string | number | null }>;
}

interface CashRow {
  amount: number | string | null;
  flow_direction: string | null;
  transaction_type: string | null;
  transaction_date: string | null;
  created_at: string | null;
}

async function fetchSeasonCash(crewId: string): Promise<CashRow[]> {
  const from = `${SEASON_MONTH_KEYS[0]}-01T00:00:00+03:00`;
  const to = "2026-11-01T00:00:00+03:00";
  const { data, error } = await supabaseAdmin
    .from("cash_transactions")
    .select("amount, flow_direction, transaction_type, transaction_date, created_at")
    .eq("crew_id", crewId)
    .gte("transaction_date", from)
    .lt("transaction_date", to)
    .order("transaction_date", { ascending: true })
    .limit(2000);
  if (error) {
    logger.warn("[season-stats] cash fetch failed (degrading to empty):", error.message);
    return [];
  }
  return (data || []) as CashRow[];
}

// ── Overview ─────────────────────────────────────────────────────────────────
export interface SeasonMonthBucket {
  month: string;
  label: string;
  rentals: number;
  completed: number;
  revenue: number;
  sales: number;
  salesRevenue: number;
  cashIn: number;
  cashOut: number;
  isFuture: boolean;
}

export interface SeasonUnverifiedItem {
  rentalId: string;
  title: string;
  renter: string;
  total: number;
  startedAt: string;
  verificationStatus: string | null;
}

export interface SeasonOverview {
  crewSlug: string;
  crewName: string;
  seasonYear: number;
  months: SeasonMonthBucket[];
  totals: {
    rentals: number;
    completed: number;
    revenue: number;
    sales: number;
    salesRevenue: number;
    cashIn: number;
    cashOut: number;
    avgCheck: number;
  };
  verification: {
    completed: number;
    verified: number;
    disputed: number;
    waiting: number;
    unverified: number;
    verifiedSharePct: number;
  };
  latestUnverified: SeasonUnverifiedItem[];
  generatedAt: string;
}

export async function getSeasonStatsOverview(params: {
  slug: string;
}): Promise<ActionResponse<SeasonOverview>> {
  try {
    const access = await verifyCrewAccess(params.slug);
    if (!access.allowed || !access.crewId) return { success: false, error: access.error };
    const crewId = access.crewId;

    const overview = await withCache(`season:${crewId}:overview`, async () => {
      const [rentals, sales, cash] = await Promise.all([
        fetchSeasonRentals(crewId),
        fetchSeasonSales(crewId),
        fetchSeasonCash(crewId),
      ]);

      const futureKey = currentMskMonthKey();
      const months: SeasonMonthBucket[] = SEASON_MONTH_KEYS.map((key) => ({
        month: key,
        label: monthLabelRu(key),
        rentals: 0,
        completed: 0,
        revenue: 0,
        sales: 0,
        salesRevenue: 0,
        cashIn: 0,
        cashOut: 0,
        isFuture: key > futureKey,
      }));
      const bucket = (key: string) => months.find((m) => m.month === key);

      let completedIds: string[] = [];
      for (const r of rentals) {
        const m = bucket(startMonthOf(r));
        if (!m) continue;
        m.rentals += 1;
        m.revenue += rub(r.total_cost);
        if (r.status === "completed") {
          m.completed += 1;
          completedIds.push(r.rental_id);
        }
      }
      for (const s of sales) {
        const key = (s.created_at || "").slice(0, 7);
        const m = bucket(key);
        if (!m) continue;
        m.sales += 1;
        m.salesRevenue += Number(String(s.sale_price ?? "").replace(/[^\d]/g, "")) || 0;
      }
      for (const c of cash) {
        const key = (c.transaction_date || c.created_at || "").slice(0, 7);
        const m = bucket(key);
        if (!m) continue;
        const amt = rub(c.amount);
        if (c.flow_direction === "out" || String(c.transaction_type || "").startsWith("expense")) m.cashOut += amt;
        else m.cashIn += amt;
      }

      // verification coverage over completed rentals
      const verMap = await getVerificationStatusMap(completedIds);
      let verified = 0;
      let disputed = 0;
      let waiting = 0;
      for (const id of completedIds) {
        const brief = verMap.get(id);
        const st = brief?.status;
        if (st === "verified") verified += 1;
        else if (st === "disputed") disputed += 1;
        else if (st) waiting += 1;
      }
      const completed = completedIds.length;
      const unverified = Math.max(0, completed - verified - disputed - waiting);

      // latest unverified — narrow fetch for titles
      const candidates = rentals
        .filter((r) => r.status === "completed")
        .sort((a, b) => (startMonthOf(b) + (b.created_at || "")).localeCompare(startMonthOf(a) + (a.created_at || "")))
        .filter((r) => {
          const st = verMap.get(r.rental_id)?.status;
          return !st || st === "pending" || st === "operator_confirmed" || st === "owner_confirmed";
        })
        .slice(0, 6);
      let latestUnverified: SeasonUnverifiedItem[] = [];
      if (candidates.length > 0) {
        const ids = candidates.map((r) => r.rental_id);
        const { data: rows } = await supabaseAdmin
          .from("rentals")
          .select(`
            rental_id, total_cost, requested_start_date, renter_name:metadata->>renter_name,
            vehicle:cars(make, model)
          `)
          .in("rental_id", ids);
        const byId = new Map((rows || []).map((r) => [r.rental_id, r]));
        latestUnverified = candidates
          .map((c) => {
            const row = byId.get(c.rental_id) as
              | { rental_id: string; total_cost: number | null; requested_start_date: string | null; renter_name: string | null; vehicle: { make: string | null; model: string | null } | null }
              | undefined;
            const v = row?.vehicle;
            return {
              rentalId: c.rental_id,
              title: [v?.make, v?.model].filter(Boolean).join(" ") || "Байк",
              renter: row?.renter_name || "",
              total: rub(row?.total_cost ?? c.total_cost),
              startedAt: (row?.requested_start_date || c.requested_start_date || c.created_at || "").slice(0, 10),
              verificationStatus: verMap.get(c.rental_id)?.status || null,
            };
          })
          .slice(0, 5);
      }

      const totals = months.reduce(
        (acc, m) => {
          acc.rentals += m.rentals;
          acc.completed += m.completed;
          acc.revenue += m.revenue;
          acc.sales += m.sales;
          acc.salesRevenue += m.salesRevenue;
          acc.cashIn += m.cashIn;
          acc.cashOut += m.cashOut;
          return acc;
        },
        { rentals: 0, completed: 0, revenue: 0, sales: 0, salesRevenue: 0, cashIn: 0, cashOut: 0, avgCheck: 0 },
      );
      totals.avgCheck = totals.rentals > 0 ? Math.round(totals.revenue / totals.rentals) : 0;

      return {
        crewSlug: params.slug,
        crewName: "",
        seasonYear: SEASON_YEAR,
        months,
        totals,
        verification: {
          completed,
          verified,
          disputed,
          waiting,
          unverified,
          verifiedSharePct: completed > 0 ? Math.round((verified / completed) * 100) : 0,
        },
        latestUnverified,
        generatedAt: new Date().toISOString(),
      } satisfies SeasonOverview;
    });

    return successResponse(overview);
  } catch (err) {
    logger.error("[season-stats] overview failed:", err);
    return errorResponse(handleError(err, "getSeasonStatsOverview"));
  }
}

// ── Month details (lazy) ─────────────────────────────────────────────────────
export interface SeasonMonthDetailRow {
  rentalId: string;
  title: string;
  kind: string;
  renter: string;
  total: number;
  status: string;
  paymentStatus: string | null;
  startedAt: string;
  verificationStatus: string | null;
}

export interface SeasonMonthDetails {
  month: string;
  label: string;
  rentals: SeasonMonthDetailRow[];
  sales: Array<{ id: string; buyer: string; price: number; createdAt: string }>;
  cash: {
    in: number;
    out: number;
    top: Array<{ type: string; direction: string; amount: number; date: string; description: string }>;
  };
}

export async function getSeasonMonthDetails(params: {
  slug: string;
  month: string;
}): Promise<ActionResponse<SeasonMonthDetails>> {
  try {
    const access = await verifyCrewAccess(params.slug);
    if (!access.allowed || !access.crewId) return { success: false, error: access.error };
    const crewId = access.crewId;
    const month = (params.month || "").trim();
    if (!/^\d{4}-\d{2}$/.test(month)) return { success: false, error: "Некорректный месяц." };
    if (!SEASON_MONTH_KEYS.includes(month)) return { success: false, error: "Месяц вне сезона 2026." };

    const details = await withCache(`season:${crewId}:month:${month}`, async () => {
      const fromIso = `${month}-01T00:00:00+03:00`;
      const [y, m] = month.split("-").map(Number);
      const next = new Date(Date.UTC(y, m, 1));
      const toIso = `${next.toISOString().slice(0, 10)}T00:00:00+03:00`;

      // House pattern (getRentalsDashboard): two range queries merged+deduped,
      // so rows with only agreed OR only requested start are both covered.
      const base = `
        rental_id, status, total_cost, payment_status,
        requested_start_date, agreed_start_date, created_at,
        renter_name:metadata->>renter_name,
        vehicle:cars!inner(make, model, type, crew_id)
      `;
      const [byRequested, byAgreed] = await Promise.all([
        supabaseAdmin.from("rentals").select(base)
          .eq("vehicle.crew_id", crewId).neq("status", "cancelled")
          .gte("requested_start_date", fromIso).lt("requested_start_date", toIso).limit(400),
        supabaseAdmin.from("rentals").select(base)
          .eq("vehicle.crew_id", crewId).neq("status", "cancelled")
          .gte("agreed_start_date", fromIso).lt("agreed_start_date", toIso).limit(400),
      ]);
      const merged = new Map<string, SeasonRentalRow & { renter_name?: string | null }>();
      for (const row of [
        ...((byRequested.data || []) as unknown as Array<SeasonRentalRow & { renter_name?: string | null }>),
        ...((byAgreed.data || []) as unknown as Array<SeasonRentalRow & { renter_name?: string | null }>),
      ]) {
        if (startMonthOf(row) === month) merged.set(row.rental_id, row);
      }

      const ids = [...merged.keys()];
      const verMap = ids.length > 0 ? await getVerificationStatusMap(ids) : new Map();

      const rentals: SeasonMonthDetailRow[] = [...merged.values()]
        .sort((a, b) => (a.requested_start_date || "").localeCompare(b.requested_start_date || ""))
        .map((r) => {
          const v = r.vehicle;
          const kind = v?.type === "equipment" ? "equipment" : v?.type === "service" ? "service" : "bike";
          return {
            rentalId: r.rental_id,
            title: [v?.make, v?.model].filter(Boolean).join(" ") || "—",
            kind,
            renter: r.renter_name || "",
            total: rub(r.total_cost),
            status: r.status || "—",
            paymentStatus: r.payment_status,
            startedAt: (r.requested_start_date || r.agreed_start_date || r.created_at || "").slice(0, 10),
            verificationStatus: verMap.get(r.rental_id)?.status || null,
          };
        });

      // sales within the month (private schema, crew bikes)
      const { data: cars } = await supabaseAdmin.from("cars").select("id").eq("crew_id", crewId);
      const bikeIds = (cars || []).map((c) => c.id);
      let sales: SeasonMonthDetails["sales"] = [];
      if (bikeIds.length > 0) {
        const { data: saleRows, error: saleErr } = await privateSchemaClient()
          .from("sale_contract_artifacts")
          .select("id, buyer_full_name, sale_price, created_at")
          .in("resolved_bike_id", bikeIds)
          .gte("created_at", fromIso)
          .lt("created_at", toIso)
          .order("created_at", { ascending: true })
          .limit(200);
        if (!saleErr) {
          sales = ((saleRows || []) as Array<{ id: string; buyer_full_name: string | null; sale_price: string | number | null; created_at: string | null }>).map((s) => ({
            id: s.id,
            buyer: s.buyer_full_name || "—",
            price: Number(String(s.sale_price ?? "").replace(/[^\d]/g, "")) || 0,
            createdAt: (s.created_at || "").slice(0, 10),
          }));
        }
      }

      // cash within the month
      const { data: cashRows } = await supabaseAdmin
        .from("cash_transactions")
        .select("amount, flow_direction, transaction_type, transaction_date, created_at, description")
        .eq("crew_id", crewId)
        .gte("transaction_date", fromIso)
        .lt("transaction_date", toIso)
        .order("transaction_date", { ascending: false })
        .limit(500);
      let cashIn = 0;
      let cashOut = 0;
      const top: SeasonMonthDetails["cash"]["top"] = [];
      for (const c of (cashRows || []) as Array<CashRow & { description: string | null }>) {
        const amt = rub(c.amount);
        const isOut = c.flow_direction === "out" || String(c.transaction_type || "").startsWith("expense");
        if (isOut) cashOut += amt;
        else cashIn += amt;
        if (top.length < 10) {
          top.push({
            type: c.transaction_type || "—",
            direction: isOut ? "out" : "in",
            amount: amt,
            date: (c.transaction_date || c.created_at || "").slice(0, 10),
            description: c.description || "",
          });
        }
      }

      return {
        month,
        label: monthLabelRu(month),
        rentals,
        sales,
        cash: { in: cashIn, out: cashOut, top },
      } satisfies SeasonMonthDetails;
    });

    return successResponse(details);
  } catch (err) {
    logger.error("[season-stats] month details failed:", err);
    return errorResponse(handleError(err, "getSeasonMonthDetails"));
  }
}

// ── Verification round (owner-tier, «crew verifies as a game») ───────────────
export interface VerificationRoundItem {
  rentalId: string;
  title: string;
  renter: string;
  total: number;
  sent: boolean;
  reason?: string;
}

export interface VerificationRoundResult {
  started: number;
  sent: number;
  skipped: number;
  items: VerificationRoundItem[];
  dmed: boolean;
}

/**
 * Start a verification round: take the latest completed rentals that have NO
 * verification row yet and send the verification DM (✅/⚠️ buttons) for each.
 * requestRentalVerification is idempotent (first request wins), so running a
 * round twice never double-spams. A summary DM lands in the initiator's chat.
 */
export async function startSeasonVerificationRound(params: {
  slug: string;
  limit?: number;
  /** Password-auth path (PC viewer): owner id from validateAnalyticsPassword. */
  actorUserId?: string;
  /** Password-auth path flag — must come with actorUserId. */
  isPasswordAuth?: boolean;
}): Promise<ActionResponse<VerificationRoundResult>> {
  try {
    const access = await verifyCrewAccess(params.slug);
    // task151: the PC password session has no TG actor cookie — fall back to
    // the password-auth identity (crews.owner_id echoed by the client from
    // validateAnalyticsPassword, re-gated server-side; same contract as the
    // verify family in rental-verify-actions.ts).
    let crewId = access.crewId || "";
    let actorChatId = String(access.actorUserId || "");
    if (!access.allowed && params.isPasswordAuth && params.actorUserId?.trim()) {
      const claimed = params.actorUserId.trim();
      const { data: crew } = await supabaseAdmin
        .from("crews")
        .select("id, owner_id")
        .eq("slug", params.slug)
        .maybeSingle();
      if (!crew) return { success: false, error: "Экипаж не найден." };
      const { data: adminUser } = await supabaseAdmin
        .from("users")
        .select("role, status, metadata")
        .eq("user_id", claimed)
        .maybeSingle();
      const adminMeta = (adminUser?.metadata || {}) as Record<string, unknown>;
      const pwOk =
        crew.owner_id === claimed ||
        adminUser?.role === "admin" ||
        adminUser?.role === "vprAdmin" ||
        adminUser?.status === "admin" ||
        adminMeta?.role === "admin" ||
        adminMeta?.status === "admin";
      if (!pwOk) return { success: false, error: access.error };
      crewId = crew.id;
      actorChatId = claimed;
    } else if (!access.allowed || !access.crewId) {
      return { success: false, error: access.error };
    } else if (access.isOwner !== true) {
      return { success: false, error: "Запустить раунд сверки может владелец или администратор экипажа." };
    }
    const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 25);

    // candidates: latest completed rentals of the crew
    const { data: rows, error } = await supabaseAdmin
      .from("rentals")
      .select(`
        rental_id, status, total_cost, requested_start_date, created_at,
        renter_name:metadata->>renter_name,
        vehicle:cars!inner(make, model, crew_id)
      `)
      .eq("vehicle.crew_id", crewId)
      .eq("status", "completed")
      .order("requested_start_date", { ascending: false, nullsFirst: false })
      .limit(80);
    if (error) throw error;

    const ids = (rows || []).map((r) => r.rental_id);
    const verMap = await getVerificationStatusMap(ids);
    const pending = (rows || [])
      .filter((r) => {
        const st = verMap.get(r.rental_id)?.status;
        return !st || st === "pending";
      })
      .slice(0, limit);

    const items: VerificationRoundItem[] = [];
    let sent = 0;
    for (const r of pending) {
      const v = (r as unknown as { vehicle: { make: string | null; model: string | null } | null }).vehicle;
      const res = await requestRentalVerification({
        rentalId: r.rental_id,
        actorChatId,
        source: "admin_manual",
      });
      if (res.sent) sent += 1;
      items.push({
        rentalId: r.rental_id,
        title: [v?.make, v?.model].filter(Boolean).join(" ") || "Байк",
        renter: (r as unknown as { renter_name: string | null }).renter_name || "",
        total: rub(r.total_cost),
        sent: res.sent,
        reason: res.reason,
      });
    }

    let dmed = false;
    if (actorChatId && items.length > 0) {
      try {
        const lines = items.map(
          (i, idx) =>
            `${idx + 1}. ${i.title}${i.renter ? ` — ${i.renter}` : ""} — ${i.total.toLocaleString("ru-RU")} ₽ ${i.sent ? "📨" : `⏭ (${i.reason || "пропущено"})`}`,
        );
        await sendComplexMessage(
          actorChatId,
          [
            "🎲 <b>Раунд сверки запущен</b>",
            `Выслано сверок: <b>${sent}</b> из ${items.length}.`,
            "Отвечай ✅ / ⚠️ под каждой арендой — сумма зафиксируется после подтверждения обеих сторон.",
            "",
            ...lines,
          ].join("\n"),
          [],
          { parseMode: "HTML" },
        );
        dmed = true;
      } catch (e) {
        logger.warn("[season-stats] round summary DM failed:", e);
      }
    }

    invalidateCrewCache(crewId);
    return successResponse({
      started: items.length,
      sent,
      skipped: items.length - sent,
      items,
      dmed,
    });
  } catch (err) {
    logger.error("[season-stats] verification round failed:", err);
    return errorResponse(handleError(err, "startSeasonVerificationRound"));
  }
}

// ── Salary verification strip (owner-tier, for the /salary page) ─────────────
export interface SalaryVerificationStrip {
  payout: PayoutSummaryView | null;
  latestUnverified: SeasonUnverifiedItem[];
}

export async function getSalaryVerificationStrip(params: {
  slug: string;
}): Promise<ActionResponse<SalaryVerificationStrip>> {
  try {
    const access = await verifyCrewAccess(params.slug);
    if (!access.allowed) return { success: false, error: access.error };
    if (access.isOwner !== true) {
      return { success: false, error: "Сводка выплат доступна владельцу или администратору экипажа." };
    }
    const [payout, unverified] = await Promise.all([
      getCrewPayoutSummary(params.slug).catch(() => null),
      (async () => {
        const res = await getSeasonStatsOverview({ slug: params.slug });
        return res.success ? res.data?.latestUnverified ?? [] : [];
      })(),
    ]);
    return successResponse({ payout, latestUnverified: unverified.slice(0, 3) });
  } catch (err) {
    return errorResponse(handleError(err, "getSalaryVerificationStrip"));
  }
}
