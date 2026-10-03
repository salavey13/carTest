// /app/franchize/lib/subrenter-month-report.ts
// ─────────────────────────────────────────────────────────────────────────────
// «Отчёт партнёру за месяц» — pure markdown builder (2026-10-03, boss:
// «add "total for subrenter excluding equipment" report in subrenter's
// profile, subrenter's section in admin franchize page and in motopark»).
//
// One partner + one MSK month → ALL rentals of HIS bikes (any status, like
// the Мотопарк per-bike report), each row split Мот/Экип/Итого + «Партнёру
// N%», and the headline the boss asked for:
//
//   - Итого партнёру (50% от мото, без экипировки): **39 500 ₽**
//
// Money math is THE SAME chain as everywhere (rental-price-split.ts →
// subrenter-economics.ts): stored bike/equipment split wins, legacy rows get
// the duration-aware estimate from the rental window; gear mirror rows are
// inventory echoes with no money; gear is crew money and never splits.
//
// Pure by design: NO supabase, NO React — the server action fetches rows and
// resolves names, this module only formats. Tests import it directly.
// ─────────────────────────────────────────────────────────────────────────────

import { effectiveStatus, monthLabelRu } from "@/app/franchize/lib/bike-wall";
import {
  isLinkedEquipmentRow,
  splitRentalPrice,
  type RentalPriceSplit,
} from "@/app/franchize/lib/rental-price-split";

// ── Types ────────────────────────────────────────────────────────────────────

/** One rentals row, pre-shaped by the server action (names already resolved). */
export interface SubrenterReportRentalRow {
  rentalId: string;
  bikeId: string;
  /** «Kawasaki EX650K» — card label resolved by the caller */
  bikeLabel: string;
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
  metadata?: Record<string, unknown> | null;
}

export interface SubrenterMonthReportInput {
  /** «Александр Корнилов (@K0r_Al)» — resolved by the caller, single line */
  partnerLabel: string;
  /** Telegram chat id (filename stamp + audit line) */
  partnerChatId: string;
  /** «VIP_BIKE» — crews.name; underscores are prettified to spaces */
  crewName: string;
  /** "YYYY-MM" (MSK) — report scope */
  month: string;
  /** bike labels of the partner (cards header, «Байки: …») */
  bikeLabels: string[];
  /** partner's bike rentals starting in the month, any status */
  rentals: SubrenterReportRentalRow[];
  /** partner share pct (resolved from the contract by the caller) */
  pct: number;
  /** bot username for deep links, default «oneBikePlsBot» */
  botUsername?: string;
  /** injectable clock (tests); defaults to Date.now() */
  nowMs?: number;
}

export interface SubrenterMonthReportResult {
  markdown: string;
  filename: string;
  /** Numbers behind the summary — tests + the caller's toast reuse them. */
  stats: {
    totalRentals: number;
    earningRentals: number;
    revenueRub: number;
    bikeRub: number;
    gearRub: number;
    partnerRub: number;
  };
}

// ── Formatting helpers (same conventions as bike-rentals-report) ─────────────

const pad2 = (n: number): string => String(n).padStart(2, "0");

function mskParts(iso: string | null | undefined): { d: number; m: number; y: number; hh: number; mm: number } | null {
  const ts = Date.parse(iso || "");
  if (Number.isNaN(ts)) return null;
  const d = new Date(ts + 3 * 60 * 60 * 1000);
  return { d: d.getUTCDate(), m: d.getUTCMonth() + 1, y: d.getUTCFullYear(), hh: d.getUTCHours(), mm: d.getUTCMinutes() };
}

/** «29.08.2026 15:00» (MSK) or «—». */
export function reportMskDateTime(iso: string | null | undefined): string {
  const p = mskParts(iso);
  return p ? `${pad2(p.d)}.${pad2(p.m)}.${p.y} ${pad2(p.hh)}:${pad2(p.mm)}` : "—";
}

/** «21 000 ₽» — ru-RU grouping with plain ASCII spaces (file-safe, no NBSP). */
export function reportMoneyRub(rub: number): string {
  return `${Math.round(rub || 0).toLocaleString("ru-RU").replace(/\u00A0/g, " ")} ₽`;
}

/** «1 ч» / «6 ч» / «1 дн» — hours below 24h, days otherwise (rounded). */
export function reportDurationLabel(startIso: string | null | undefined, endIso: string | null | undefined): string {
  if (!startIso || !endIso) return "—";
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return "—";
  const hours = (e - s) / (60 * 60 * 1000);
  if (hours < 24) return `${Math.max(1, Math.floor(hours))} ч`;
  return `${Math.max(1, Math.round(hours / 24))} дн`;
}

/** Header/meta lines must stay single-line and must not break inline code. */
function line(s: string): string {
  return String(s || "")
    .replace(/\s*[\r\n]+\s*/g, " ")
    .replace(/`/g, "'")
    .trim();
}

/** Table cells must never break the markdown table: strip pipes/newlines. */
function cell(text: string): string {
  return text.replace(/\|/g, "/").replace(/\s*[\r\n]+\s*/g, " ").trim();
}

/** Boss-approved status emoji vocabulary (bike-rentals-report parity). */
export function reportStatusEmojiLabel(status: string | null | undefined, endIso: string | null | undefined, nowMs: number): string {
  switch (effectiveStatus(status ?? "unknown", endIso, nowMs)) {
    case "completed": return "🟢 Завершена";
    case "active": return "🟢 В аренде";
    case "confirmed": return "🟣 Подтверждена";
    case "pending_confirmation": return "🟡 Ожидает подтверждения";
    case "expired": return "🔴 Просрочена";
    case "cancelled": return "⚪️ Отменена";
    default: return `⚪️ ${String(status || "—")}`;
  }
}

function paymentStatusLabel(paymentStatus: string | null | undefined): string {
  const v = String(paymentStatus || "").trim();
  if (!v) return "—";
  if (v === "fully_paid") return "оплачен";
  if (v === "interest_paid") return "предоплата";
  if (v === "pending") return "не оплачен";
  return v;
}

/** Earning statuses for the «Оборот» line (bike-rentals-report parity). */
const REVENUE_STATUSES = new Set(["completed", "active"]);

/** Summary breakdown order (bike-rentals-report parity). */
const SUMMARY_ORDER = ["completed", "active", "confirmed", "pending_confirmation", "expired", "cancelled"] as const;

// ── Builder ──────────────────────────────────────────────────────────────────

export function buildSubrenterMonthReport(input: SubrenterMonthReportInput): SubrenterMonthReportResult {
  const now = input.nowMs ?? Date.now();
  const bot = (input.botUsername || "oneBikePlsBot").trim() || "oneBikePlsBot";
  const pct = Math.min(99, Math.max(1, Math.round(Number(input.pct) || 50)));
  const crewPretty = line(String(input.crewName || "").trim().replace(/_/g, " ")) || "—";
  const partnerSafe = line(input.partnerLabel) || `id ${input.partnerChatId}`;

  const rows = (Array.isArray(input.rentals) ? input.rentals : []).map((r) => {
    const start = r.agreedStart || r.requestedStart || r.createdAt;
    const end = r.agreedEnd || r.requestedEnd || null;
    const eff = effectiveStatus(r.status ?? "unknown", end, now);
    const linkedMirror = isLinkedEquipmentRow(r.metadata);
    const split = splitRentalPrice(r.totalCost, r.metadata, { startIso: start, endIso: end });
    const earns = REVENUE_STATUSES.has(eff) && !linkedMirror;
    // Gear mirror rows carry no money; cancelled rows never earn.
    const partnerRub =
      earns && split.bikePartRub > 0 ? Math.round((split.bikePartRub * pct) / 100) : 0;
    return { r, start, end, eff, split, partnerRub, earns, linkedMirror };
  });
  // Chronological, like the Мотопарк report.
  rows.sort((a, b) => (Date.parse(a.start || a.r.createdAt || "") || 0) - (Date.parse(b.start || b.r.createdAt || "") || 0));

  // ── Money summary ──
  let revenueRub = 0;
  let bikeRub = 0;
  let gearRub = 0;
  let partnerRub = 0;
  let earningRentals = 0;
  for (const row of rows) {
    if (!row.earns || row.split.totalRub <= 0) continue;
    revenueRub += row.split.totalRub;
    bikeRub += row.split.bikePartRub;
    gearRub += row.split.equipmentPartRub;
    partnerRub += row.partnerRub;
    earningRentals += 1;
  }

  const byStatus = new Map<string, number>();
  for (const row of rows) byStatus.set(row.eff, (byStatus.get(row.eff) || 0) + 1);

  // ── Lines ──
  const monthTitle = monthLabelRu(input.month) || input.month;
  const L: string[] = [];
  L.push(`# Отчёт партнёру — ${monthTitle}`);
  L.push("");
  L.push(`- Партнёр: ${partnerSafe} (id ${line(String(input.partnerChatId))})`);
  L.push(`- Байки: ${input.bikeLabels.length > 0 ? input.bikeLabels.map((b) => line(b)).join(", ") : "—"}`);
  L.push(`- Экипаж: ${crewPretty}`);
  L.push(`- Отчёт сформирован: ${reportMskDateTime(new Date(now).toISOString())} МСК`);
  L.push("");
  L.push("## Сводка");
  L.push("");
  L.push(`- Всего аренд: **${rows.length}**`);
  for (const key of SUMMARY_ORDER) {
    const n = byStatus.get(key);
    if (!n) continue;
    L.push(`  - ${reportStatusEmojiLabel(key, null, now).replace(/^[^\s]+\s/, "")}: ${n}`);
  }
  for (const [key, n] of byStatus) {
    if ((SUMMARY_ORDER as readonly string[]).includes(key)) continue;
    L.push(`  - ${reportStatusEmojiLabel(key, null, now).replace(/^[^\s]+\s/, "")}: ${n}`);
  }
  L.push(`- Оборот (завершённые + активные): **${reportMoneyRub(revenueRub)}**`);
  L.push(`  - в т.ч. аренда мото: **${reportMoneyRub(bikeRub)}**`);
  L.push(`  - в т.ч. экипировка: **${reportMoneyRub(gearRub)}** (не делится — остаётся экипажу)`);
  // THE line the boss asked for (2026-10-03): the subrenter's total, gear excluded.
  L.push(`- Итого партнёру (${pct}% от мото, без экипировки): **${reportMoneyRub(partnerRub)}**`);
  L.push("");

  L.push("## Все аренды");
  L.push("");
  if (rows.length === 0) {
    L.push("Аренд за этот месяц не было.");
    L.push("");
  } else {
    L.push(`| # | Байк | Даты (МСК) | Длит. | Клиент | Статус | Оплата | Мот | Экип | Итого | Партнёру ${pct}% |`);
    L.push(`|---|---|---|---|---|---|---|---|---|---|---|`);
    rows.forEach((row, i) => {
      const dates = `${reportMskDateTime(row.start)} → ${row.end ? reportMskDateTime(row.end) : "—"}`;
      const client = cell(row.r.clientName || "—");
      const status = cell(reportStatusEmojiLabel(row.r.status, row.end, now));
      const payment = cell(paymentStatusLabel(row.r.paymentStatus));
      const motoCell = row.split.bikePartRub > 0 ? reportMoneyRub(row.split.bikePartRub) : "—";
      const gearEstimated = !row.linkedMirror && row.split.source === "estimated" && row.split.equipmentPartRub > 0;
      const gearCell =
        row.split.equipmentPartRub > 0
          ? `${reportMoneyRub(row.split.equipmentPartRub)}${gearEstimated ? "*" : ""}`
          : "—";
      const totalCell = row.linkedMirror
        ? "выдача экипа"
        : row.split.totalRub > 0
          ? reportMoneyRub(row.split.totalRub)
          : "—";
      const partnerCell = row.partnerRub > 0 ? reportMoneyRub(row.partnerRub) : "—";
      L.push(
        `| ${i + 1} | ${cell(row.r.bikeLabel || "—")} | ${cell(dates)} | ${reportDurationLabel(row.start, row.end)} | ${client} | ${status} | ${payment} | ${motoCell} | ${gearCell} | ${totalCell} | ${partnerCell} |`,
      );
    });
    if (rows.some((row) => !row.linkedMirror && row.split.source === "estimated" && row.split.equipmentPartRub > 0)) {
      L.push("");
      L.push("_Экипировка со «*» — оценка по прайсу за срок аренды (в строке нет сохранённой разбивки мот/экип)._");
    }
    L.push("");
    L.push("## Ссылки на аренды");
    L.push("");
    rows.forEach((row, i) => {
      L.push(`${i + 1}. https://t.me/${bot}/app?startapp=rental_${row.r.rentalId}`);
    });
  }

  const safeChat = String(input.partnerChatId || "partner").replace(/[^a-zA-Z0-9._-]+/g, "-");
  const filename = `subrenter-report_${safeChat}_${input.month}.md`;

  return {
    markdown: `${L.join("\n")}\n`,
    filename,
    stats: {
      totalRentals: rows.length,
      earningRentals,
      revenueRub,
      bikeRub,
      gearRub,
      partnerRub,
    },
  };
}
