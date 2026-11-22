// iter53 — live verification of the ЭКИП reference pricing in buildRentalsCsv.
// Boss spec (2026-10-08): ЭКИП subtable shows PROPER prices for 0-cost docs
// (hourly → half price; ≥24h → day 1 full + halves after), stored prices win,
// СВОДКА / ВСЕГО / summary counters stay EXACTLY as before (no double
// accounting).
// Run: bun --env-file=.env.local scripts/task81-verify-csv.mjs
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync, existsSync } from "fs";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
globalThis.__SUPABASE_ADMIN__ = sb;

const { buildRentalsCsv } = await import("../lib/csv-builders/rentals-csv.ts");

const from = "2026-09-01";
const to = "2026-10-07";
const { csv, summary } = await buildRentalsCsv("vip-bike", from, to);

const lines = csv.split("\n");
const blockOf = {};
let cur = null;
for (const l of lines) {
  const t = l.replace(/\uFEFF/, "").trim();
  if (/^(АРЕНДЫ|ЭКИП|СЕРВИС|ПРОДАЖИ|СВОДКА)/.test(t)) { cur = t; blockOf[cur] = []; continue; }
  if (cur && t) blockOf[cur].push(l);
}

const assert = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; } else console.log("OK:", msg); };

// RFC4180 line parser (cells may be quoted — notes contain commas)
const parseLine = (line) => {
  const cells = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { cells.push(cur); cur = ""; }
    else cur += ch;
  }
  cells.push(cur);
  return cells;
};

console.log("=== LIVE ЭКИП block, vip-bike", from, "→", to, "===");

// ── ЭКИП rows: prices now non-zero ──────────────────────────────────────────
const eqRows = blockOf["ЭКИП"].slice(1); // drop header
const parsed = eqRows.map((l) => {
  const cells = parseLine(l);
  return { date: cells[0], name: cells[1], price: Number(cells[2] || "0"), id: cells[6], isTotals: /^итого/i.test((cells[0] || "").trim()) };
}).filter((r) => !r.isTotals);
const zeroShown = parsed.filter((r) => r.price === 0);
console.log(`ЭКИП rows: ${parsed.length}, zero-price rows shown: ${zeroShown.length}`);
assert(zeroShown.length === 0, "no zero prices remain in ЭКИП block");

// stored-wins + canon spot checks against the DB
const known = {};
for (const r of parsed) known[r.id] = r.price;
const { data: eqDocs, error: eqDocsErr } = await sb.from("rentals")
  .select("rental_id, total_cost, requested_start_date, requested_end_date, metadata")
  .in("rental_id", parsed.map((r) => r.id).filter(Boolean));
if (eqDocsErr) console.error("eqDocs err:", eqDocsErr.message);
let checked = 0;
for (const d of eqDocs || []) {
  const shown = known[d.rental_id];
  const stored = Number(d.total_cost || 0);
  if (stored > 0) {
    assert(shown === stored, `stored wins ${d.rental_id.slice(0, 8)}: shown ${shown} == stored ${stored}`);
    checked++;
    continue;
  }
  // 0-cost → duration-aware canon on metadata.daily_price (or items Σ)
  const items = Array.isArray(d.metadata?.equipment_items) ? d.metadata.equipment_items : [];
  let base = items.reduce((s, i) => s + (Number(i?.daily_price) > 0 ? Number(i.daily_price) : 0), 0);
  if (!(base > 0)) base = Number(d.metadata?.daily_price || 0);
  if (!(base > 0)) continue; // vehicle fallback path — covered by helper tests
  const start = new Date(d.requested_start_date).getTime();
  const end = new Date(d.requested_end_date).getTime();
  const hours = (end - start) / 36e5;
  const days = Math.max(1, Math.ceil(hours / 24));
  const qty = Number(d.metadata?.quantity) > 0 ? Number(d.metadata.quantity) : 1;
  const expected = hours < 24
    ? Math.round(base / 2) * qty
    : (base + Math.round(base / 2) * (days - 1)) * qty;
  assert(shown === expected, `canon ${d.rental_id.slice(0, 8)}: ${hours.toFixed(1)}h base ${base} → shown ${shown} == expected ${expected}`);
  checked++;
}
console.log(`spot-checked ${checked} docs against the canon`);
assert(checked >= 20, "most docs verified against stored/canon");

// ── No double accounting: СВОДКА / ВСЕГО / summary identical to pre-fix ────
const svLines = blockOf["СВОДКА"];
const sv = svLines.map(parseLine);
const vsego = sv.find((r) => r[0] === "ВСЕГО");
const eqSvRow = sv.find((r) => r[0] === "Экип");
console.log("СВОДКА Экип row:", eqSvRow.join(" | "));
console.log("СВОДКА ВСЕГО row:", vsego.join(" | "));
assert(summary.blocks.equipment.revenue === Number(eqSvRow[2]), `summary.blocks.equipment.revenue == СВОДКА Экип (stored Σ ${eqSvRow[2]})`);
assert(summary.totalRevenue === Number(vsego[2]), `summary.totalRevenue == СВОДКА ВСЕГО (${vsego[2]})`);
// iter52 pinned numbers MINUS the fake Молев sale removed in task82 (owner
// order 2026-10-08): ВСЕГО 2 863 238−500 000 / ЗП 135 675−10 000 (its sale
// bonus). Equipment block must be bit-identical: 33 docs / 10 000 stored.
assert(Number(vsego[2]) === 2363238, "ВСЕГО выручка == 2 863 238 − 500 000 (fake Молев sale removed) = 2 363 238");
assert(Number(vsego[3]) === 125675, "ВСЕГО ЗП == 135 675 − 10 000 (sale bonus) = 125 675");
assert(Number(eqSvRow[2]) === 10000, "СВОДКА Экип revenue == stored Σ 10 000 (unchanged)");
// Молев artifact must be gone from ПРОДАЖИ
const salesBlockIds = (blockOf["ПРОДАЖИ"] || []).map((l) => parseLine(l)[5]).filter(Boolean);
assert(!salesBlockIds.some((x) => x.startsWith("57258f91")), "fake Молев sale absent from ПРОДАЖИ block");

const baselinePath = "scripts/task81-csv-baseline.json";
if (!existsSync(baselinePath)) {
  writeFileSync(baselinePath, JSON.stringify({ summary, svodka: svLines, itogo: blockOf["ЭКИП"].find((l) => l.startsWith("Итого экип")) }, null, 1));
  console.log("BASELINE saved to", baselinePath, "— re-run to diff against it");
} else {
  const base = JSON.parse(readFileSync(baselinePath, "utf8"));
  assert(JSON.stringify(base.summary) === JSON.stringify(summary), "summary object IDENTICAL to baseline (counters intact)");
  assert(JSON.stringify(base.svodka) === JSON.stringify(svLines), "СВОДКА block IDENTICAL to baseline");
  const itogoEquip = blockOf["ЭКИП"].find((l) => l.startsWith("Итого экип"));
  console.log("Итого экип now:", itogoEquip, "| baseline:", base.itogo);
  assert(Number(parseLine(itogoEquip)[2]) >= Number(parseLine(base.itogo)[2]), "Итого экип (справочно) ≥ stored Σ (only ADDS reference prices)");
}

// ── the ЭКИП итого equals the Σ of shown prices (subtable self-consistent) ──
const itogo = Number(parseLine(blockOf["ЭКИП"].find((l) => l.startsWith("Итого экип")))[2]);
assert(itogo === parsed.reduce((s, r) => s + r.price, 0), `Итого экип (справочно) ${itogo} == Σ shown prices`);

console.log(process.exitCode ? "=== VERIFY FAILED ===" : "=== VERIFY PASSED ===");
