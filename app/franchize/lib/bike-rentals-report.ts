// /app/franchize/lib/bike-rentals-report.ts
// ─────────────────────────────────────────────────────────────────────────────
// «Отчёт по арендам байка» — pure markdown builder for the Мотопарк report
// button (2026-09-26). Produces exactly the boss-approved one-pager format:
//
//   # Аренды за всё время — Yamaha R6
//
//   - Байк: `yamaha-r6-2007` (VIP BIKE)
//   - Период данных: 29.08.2026 — 24.09.2026
//   - Отчёт сформирован: 25.09.2026 14:02 МСК
//
//   ## Сводка
//   - Всего аренд: **3**
//     - Завершена: 3
//   - Выручка (завершённые + активные): **21 000 ₽**
//   - Средний чек: **7 000 ₽**
//
//   ## Все аренды
//   | # | Даты (МСК) | Длит. | Клиент | Статус | Оплата | Стоимость | Создана |
//   ...
//
//   ## Ссылки на аренды
//   1. https://t.me/oneBikePlsBot/app?startapp=rental_<id>
//
// Pure by design: NO supabase, NO React — the server action fetches rows and
// resolves client names, this module only formats. Tests import it directly.
//
// Conventions (verified against the live DB on 2026-09-26):
//   • Client display name = users.full_name (caller resolves; «SERG»/«Maxim»),
//     fallbacks live in resolveReportClientName.
//   • Dates: agreed_* with requested_* fallback (pending rentals have no
//     agreed dates yet — the boss sample shows the requested window).
//   • Payment: fully_paid → «оплачен», interest_paid → «предоплата»,
//     pending → «не оплачен».
//   • Revenue = сумма total_cost по эффективным статусам completed+active
//     (label says exactly that; pending/confirmed/cancelled never count).
//     Avg check = floor(revenue / paid count) — boss sample: 38 000/3 → 12 666.
//   • All wall-clock rendering is MSK (+03:00 fixed offset — the app tz).
// ─────────────────────────────────────────────────────────────────────────────

import { effectiveStatus, mskMonthKey, monthLabelRu } from "@/app/franchize/lib/bike-wall";

// ── Types ────────────────────────────────────────────────────────────────────

/** One rentals row, pre-shaped by the server action (names already resolved). */
export interface BikeReportRentalRow {
  rentalId: string;
  status: string | null;
  paymentStatus: string | null;
  totalCost: number | null;
  agreedStart: string | null;
  agreedEnd: string | null;
  /** fallback dates for pending rentals (no agreed window yet) */
  requestedStart: string | null;
  requestedEnd: string | null;
  createdAt: string | null;
  /** ready-to-print client name or null («—») */
  clientName: string | null;
}

export interface BikeReportInput {
  /** «Yamaha R6» — cars.make + model (card label) */
  bikeLabel: string;
  /** «yamaha-r6-2007» — cars.id (vip-bike ids are slugs) */
  bikeId: string;
  /** «VIP_BIKE» — crews.name; underscores are prettified to spaces */
  crewName: string;
  rentals: BikeReportRentalRow[];
  /** bot username for deep links, default «oneBikePlsBot» */
  botUsername?: string;
  /**
   * "YYYY-MM" (MSK) — when set, the report covers only that month and the
   * title becomes «Аренды за сентябрь 2026 — …» (the Мотопарк wall has a
   * month selector; the report must never contradict the numbers on screen).
   * null/undefined = all-time («Аренды за всё время», the boss samples).
   */
  month?: string | null;
  /** injectable clock (tests); defaults to Date.now() */
  nowMs?: number;
}

export interface BikeReportResult {
  markdown: string;
  filename: string;
}

// ── MSK wall-clock helpers (+03:00 fixed — the app canonical tz) ─────────────

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * Header/meta lines are crew-controlled DB strings (make/model, crews.name).
 * Markdown headings and bullet lines must stay single-line and must not
 * break the inline-code span around bikeId.
 */
function line(s: string): string {
  return String(s || "")
    .replace(/\s*[\r\n]+\s*/g, " ")
    .replace(/`/g, "'")
    .trim();
}

function mskParts(iso: string | null | undefined): { d: number; m: number; y: number; hh: number; mm: number } | null {
  const ts = Date.parse(iso || "");
  if (Number.isNaN(ts)) return null;
  const d = new Date(ts + 3 * 60 * 60 * 1000);
  return { d: d.getUTCDate(), m: d.getUTCMonth() + 1, y: d.getUTCFullYear(), hh: d.getUTCHours(), mm: d.getUTCMinutes() };
}

/** «29.08.2026 15:00» (MSK) or «—». */
export function mskDateTime(iso: string | null | undefined): string {
  const p = mskParts(iso);
  return p ? `${pad2(p.d)}.${pad2(p.m)}.${p.y} ${pad2(p.hh)}:${pad2(p.mm)}` : "—";
}

/** «29.08.2026» (MSK) or «—». */
export function mskDate(iso: string | null | undefined): string {
  const p = mskParts(iso);
  return p ? `${pad2(p.d)}.${pad2(p.m)}.${p.y}` : "—";
}

// ── Money ────────────────────────────────────────────────────────────────────

/** «21 000 ₽» — ru-RU grouping with plain ASCII spaces (file-safe, no NBSP). */
export function reportMoney(rub: number): string {
  return `${Math.round(rub || 0).toLocaleString("ru-RU").replace(/\u00A0/g, " ")} ₽`;
}

// ── Duration ─────────────────────────────────────────────────────────────────

/**
 * «1 ч» / «6 ч» / «1 дн» — hours below 24h, days otherwise (rounded).
 * Boss samples: 1h→«1 ч», 6h→«6 ч», exactly 24h→«1 дн». No end date → «—».
 */
export function reportDuration(startIso: string | null | undefined, endIso: string | null | undefined): string {
  if (!startIso || !endIso) return "—";
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return "—";
  const hours = (e - s) / (60 * 60 * 1000);
  // Floor below the boundary: 23h36m must read «23 ч», never «24 ч».
  if (hours < 24) return `${Math.max(1, Math.floor(hours))} ч`;
  return `${Math.max(1, Math.round(hours / 24))} дн`;
}

// ── Status / payment labels (boss-approved emoji vocabulary) ─────────────────

/** Status → «🟢 Завершена» etc. Uses effectiveStatus (past-due active → expired). */
export function reportStatusLabel(status: string | null | undefined, endIso: string | null | undefined, nowMs: number): string {
  switch (effectiveStatus(status ?? "unknown", endIso, nowMs)) {
    case "completed":
      return "🟢 Завершена";
    case "active":
      return "🟢 В аренде";
    case "confirmed":
      return "🟣 Подтверждена";
    case "pending_confirmation":
      return "🟡 Ожидает подтверждения";
    case "expired":
      return "🔴 Просрочена";
    case "cancelled":
      return "⚪️ Отменена";
    default:
      return `⚪️ ${String(status || "—")}`;
  }
}

/** Plain status name for the Сводка sub-list (no emoji — matches the sample). */
export function reportStatusPlain(status: string | null | undefined, endIso: string | null | undefined, nowMs: number): string {
  switch (effectiveStatus(status ?? "unknown", endIso, nowMs)) {
    case "completed":
      return "Завершена";
    case "active":
      return "В аренде";
    case "confirmed":
      return "Подтверждена";
    case "pending_confirmation":
      return "Ожидает подтверждения";
    case "expired":
      return "Просрочена";
    case "cancelled":
      return "Отменена";
    default:
      return String(status || "—");
  }
}

/** fully_paid → «оплачен», interest_paid → «предоплата», pending → «не оплачен». */
export function paymentLabel(paymentStatus: string | null | undefined): string {
  const v = String(paymentStatus || "").trim();
  if (!v) return "—";
  if (v === "fully_paid") return "оплачен";
  if (v === "interest_paid") return "предоплата";
  if (v === "pending") return "не оплачен";
  return v;
}

/** Client name fallback chain (boss samples: users.full_name beats metadata). */
export function resolveReportClientName(user: {
  fullName: string | null | undefined;
  username: string | null | undefined;
} | null | undefined, metadataRenterName: string | null | undefined): string | null {
  const fullName = (user?.fullName || "").trim();
  if (fullName) return fullName;
  const username = (user?.username || "").trim();
  if (username) return `@${username}`;
  const renter = (metadataRenterName || "").trim();
  return renter || null;
}

// ── Row shaping ──────────────────────────────────────────────────────────────

/** Effective display window: agreed_* with requested_* fallback. */
function effectiveWindow(r: BikeReportRentalRow): { start: string | null; end: string | null } {
  return {
    start: r.agreedStart || r.requestedStart || r.createdAt,
    end: r.agreedEnd || r.requestedEnd || null,
  };
}

/** Table cells must never break the markdown table: strip pipes/newlines. */
function cell(text: string): string {
  return text.replace(/\|/g, "/").replace(/\s*[\r\n]+\s*/g, " ").trim();
}

/** Statuses present in the Сводка, boss-sample order (Завершена first). */
const SUMMARY_ORDER = ["completed", "active", "confirmed", "pending_confirmation", "expired", "cancelled"] as const;

/** Earning statuses for the «Выручка (завершённые + активные)» line. */
const REVENUE_STATUSES = new Set(["completed", "active"]);

/** Hard cap — a long-lived bike must not produce a multi-MB one-pager. */
const MAX_REPORT_ROWS = 1000;

// ── Builder ──────────────────────────────────────────────────────────────────

export function buildBikeRentalsReport(input: BikeReportInput): BikeReportResult {
  const now = input.nowMs ?? Date.now();
  const bot = (input.botUsername || "oneBikePlsBot").trim() || "oneBikePlsBot";
  const crewPretty = line(String(input.crewName || "").trim().replace(/_/g, " ")) || "—";
  const monthKey = typeof input.month === "string" && /^\d{4}-\d{2}$/.test(input.month.trim()) ? input.month.trim() : null;

  // Effective windows once — every section below works off these.
  const allRows = (Array.isArray(input.rentals) ? input.rentals : []).map((r) => ({
    r,
    win: effectiveWindow(r),
    eff: effectiveStatus(r.status ?? "unknown", r.agreedEnd || r.requestedEnd, now),
  }));

  // Month scope FIRST (the wall selector promises «выручка и аренды за месяц»,
  // the report must match the numbers on screen), then chronological order.
  const scoped = monthKey
    ? allRows.filter(({ r, win }) => mskMonthKey(win.start || r.createdAt, now) === monthKey)
    : allRows;
  scoped.sort((a, b) => {
    const ta = Date.parse(a.win.start || a.r.createdAt || "") || 0;
    const tb = Date.parse(b.win.start || b.r.createdAt || "") || 0;
    return ta - tb;
  });

  // Size cap: keep the NEWEST rows (a >1000-row bike's recent history is the
  // point of the one-pager); the truncation note states the cut explicitly.
  const truncated = scoped.length - MAX_REPORT_ROWS;
  const rows = truncated > 0 ? scoped.slice(-MAX_REPORT_ROWS) : scoped;

  // ── Сводка ──
  const byStatus = new Map<string, number>();
  for (const { eff } of rows) byStatus.set(eff, (byStatus.get(eff) || 0) + 1);

  let revenue = 0;
  let revenueCount = 0;
  for (const { r, eff } of rows) {
    if (!REVENUE_STATUSES.has(eff)) continue;
    const cost = Math.round(Number(r.totalCost) || 0);
    if (cost > 0) {
      revenue += cost;
      revenueCount++;
    }
  }
  const avgCheck = revenueCount > 0 ? Math.floor(revenue / revenueCount) : 0;

  // ── Период данных: min start — max end across ALL rows (data coverage) ──
  let minTs = Number.POSITIVE_INFINITY;
  let maxTs = Number.NEGATIVE_INFINITY;
  for (const { win } of rows) {
    const s = Date.parse(win.start || "");
    if (!Number.isNaN(s) && s < minTs) minTs = s;
    const e = Date.parse(win.end || win.start || "");
    if (!Number.isNaN(e) && e > maxTs) maxTs = e;
  }
  const periodLine =
    Number.isFinite(minTs) && Number.isFinite(maxTs)
      ? `${mskDate(new Date(minTs).toISOString())} — ${mskDate(new Date(maxTs).toISOString())}`
      : "—";

  // ── Lines ──
  const bikeLabelSafe = line(String(input.bikeLabel || input.bikeId || "—"));
  const bikeIdSafe = line(String(input.bikeId || ""));
  const scopeLabel = monthKey ? `Аренды за ${lowerFirst(monthLabelRu(monthKey))}` : "Аренды за всё время";
  const L: string[] = [];
  L.push(`# ${scopeLabel} — ${bikeLabelSafe}`);
  L.push("");
  L.push(`- Байк: \`${bikeIdSafe}\` (${crewPretty})`);
  L.push(`- Период данных: ${periodLine}`);
  L.push(`- Отчёт сформирован: ${mskDateTime(new Date(now).toISOString())} МСК`);
  L.push("");
  L.push("## Сводка");
  L.push("");
  L.push(`- Всего аренд: **${rows.length}**`);
  for (const key of SUMMARY_ORDER) {
    const n = byStatus.get(key);
    if (!n) continue;
    const plain = reportStatusPlain(key, null, now);
    L.push(`  - ${plain}: ${n}`);
  }
  // Unknown statuses still counted in the total — the breakdown must sum up.
  for (const [key, n] of byStatus) {
    if ((SUMMARY_ORDER as readonly string[]).includes(key)) continue;
    L.push(`  - ${reportStatusPlain(key, null, now)}: ${n}`);
  }
  L.push(`- Выручка (завершённые + активные): **${reportMoney(revenue)}**`);
  L.push(`- Средний чек: **${revenueCount > 0 ? reportMoney(avgCheck) : "—"}**`);
  L.push("");
  L.push("## Все аренды");
  L.push("");
  if (rows.length === 0) {
    L.push("Аренд пока не было.");
    L.push("");
  } else {
    L.push("| # | Даты (МСК) | Длит. | Клиент | Статус | Оплата | Стоимость | Создана |");
    L.push("|---|---|---|---|---|---|---|---|");
    rows.forEach(({ r, win }, i) => {
      const dates = `${mskDateTime(win.start)} → ${win.end ? mskDateTime(win.end) : "—"}`;
      const client = cell(r.clientName || "—");
      const status = cell(reportStatusLabel(r.status, r.agreedEnd || r.requestedEnd, now));
      const payment = cell(paymentLabel(r.paymentStatus));
      const cost = Math.round(Number(r.totalCost) || 0);
      const costCell = cost > 0 ? reportMoney(cost) : "—";
      L.push(
        `| ${i + 1} | ${cell(dates)} | ${reportDuration(win.start, win.end)} | ${client} | ${status} | ${payment} | ${costCell} | ${cell(mskDateTime(r.createdAt))} |`,
      );
    });
    L.push("");
    L.push("## Ссылки на аренды");
    L.push("");
    rows.forEach(({ r }, i) => {
      L.push(`${i + 1}. https://t.me/${bot}/app?startapp=rental_${r.rentalId}`);
    });
  }
  if (truncated > 0) {
    L.push("");
    L.push(`_Показаны последние ${MAX_REPORT_ROWS} аренд — всего ${truncated + MAX_REPORT_ROWS}, более старые усечены._`);
  }

  const day = new Date(now + 3 * 60 * 60 * 1000);
  const stamp = monthKey ?? `${day.getUTCFullYear()}-${pad2(day.getUTCMonth() + 1)}-${pad2(day.getUTCDate())}`;
  const safeBikeId = String(input.bikeId || "bike").replace(/[^a-zA-Z0-9._-]+/g, "-");
  const filename = `rentals_${safeBikeId}_${stamp}.md`;

  return { markdown: `${L.join("\n")}\n`, filename };
}

/** «Сентябрь 2026» → «сентябрь 2026» (mid-sentence scope label). */
function lowerFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}
