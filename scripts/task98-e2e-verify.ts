// Task 98 E2E: build the real CSV for vip-bike Oct 1–16 (boss's exact window)
// + canonical per-member totals Oct 1–25 → print the reconciliation.
// Run: bun scripts/task98-e2e-verify.ts
import { buildRentalsCsv } from "@/lib/csv-builders/rentals-csv";
import { computeCategoryBonuses } from "@/app/franchize/lib/salary-category-bonuses";

const CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";
const DJ = "7813830016";
const SLUG = "vip-bike";

const { csv, summary } = await buildRentalsCsv(SLUG, "2026-10-01", "2026-10-16");
const lines = csv.replace(/^\uFEFF/, "").split("\n");
console.log("== CSV header (АРЕНДЫ) ==");
console.log(lines[1]);
console.log("\n== first 3 data rows ==");
for (const l of lines.slice(2, 5)) console.log(l);
const totalsRow = lines.find((l) => l.startsWith("Итого аренды"));
console.log("\n== Итого аренды ==");
console.log(totalsRow);
const summaryIdx = lines.findIndex((l) => l === "СВОДКА");
console.log("\n== СВОДКА ==");
for (const l of lines.slice(summaryIdx, summaryIdx + 7)) console.log(l);

// ── attribution reconciliation: sum «ЗП Аренда» (col 2) per «Оператор (ЗП)» (col 23) ──
const parseCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
};
const header = parseCsvLine(lines[1]);
const opIdx = header.indexOf("Оператор (ЗП)");
const zpIdx = header.indexOf("ЗП Аренда");
const perOperator = new Map<string, number>();
for (const l of lines.slice(2)) {
  if (!l || l.startsWith("Итого") || l === "ЭКИП" || l === "") continue;
  const cells = parseCsvLine(l);
  if (cells.length <= Math.max(opIdx, zpIdx)) continue;
  const op = cells[opIdx] || "(не атрибутирован)";
  const zp = Number(cells[zpIdx]) || 0;
  if (zp > 0) perOperator.set(op, (perOperator.get(op) || 0) + zp);
}
console.log("\n== CSV Σ «ЗП Аренда» per «Оператор (ЗП)» (01–16 Oct) ==");
let csvSum = 0;
for (const [op, sum] of perOperator) { console.log(`  ${op}: ${sum}`); csvSum += sum; }
console.log(`  Σ = ${csvSum}  (должно совпасть с «Итого аренды» ЗП = ${summary.blocks.rentals.salary})`);

// ── canonical member totals for the SAME window (01–16 Oct) ──
const pStart = "2026-10-01T00:00:00+03:00";
const pEnd = "2026-10-17T00:00:00+03:00";
console.log("\n== canonical computeCategoryBonuses per member (01–16 Oct) ==");
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: members } = await sb.from("crew_members").select("user_id").eq("crew_id", CREW).eq("membership_status", "active");
const { data: users } = await sb.from("users").select("user_id, username");
let canonicalSum = 0;
for (const m of members || []) {
  const r = await computeCategoryBonuses({ crewId: CREW, memberId: m.user_id, periodStart: pStart, periodEnd: pEnd });
  if (r.total > 0) {
    const u = (users || []).find((x) => x.user_id === m.user_id);
    const rentalSum = r.rentalItems.reduce((s, i) => s + i.amount, 0);
    const saleSum = r.saleItems.reduce((s, i) => s + i.amount, 0);
    console.log(`  ${u?.username || m.user_id}: rentals=${rentalSum} (${r.rentalItems.length} шт) + sales=${saleSum} = ${r.total}`);
    canonicalSum += r.total;
  }
}
console.log(`  Σ canonical (rentals+sales) = ${canonicalSum}`);
console.log(`  CSV Σ ЗП Аренды+Продажи = ${summary.blocks.rentals.salary + summary.blocks.sales.salary}`);
console.log(`  MATCH: ${Math.round(canonicalSum) === Math.round(summary.blocks.rentals.salary + summary.blocks.sales.salary) ? "YES ✅" : "NO ❌"}`);

// DJ profile-window total (01–25 Oct) — what «Мои доходы» now shows
const dj = await computeCategoryBonuses({ crewId: CREW, memberId: DJ, periodStart: "2026-10-01T00:00:00+03:00", periodEnd: "2026-10-26T00:00:00+03:00" });
console.log(`\n== DJ 01–25 Oct: rentals ${dj.rentalItems.length} шт = ${dj.rentalItems.reduce((s, i) => s + i.amount, 0)} + sales ${dj.saleItems.reduce((s, i) => s + i.amount, 0)} = ${dj.total} (было 26 880 с мусором экип-доков) ==`);
process.exit(0);
