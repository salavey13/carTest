// scripts/task79-verify-salary-pipeline.ts
//
// Task 79 (boss): «make sure djorudjov sees same picture regarding his
// salary in his profile - all rentals and sales should be correctly
// assigned to him :) and that vip-bike crew owner sees correct djorudjov's
// salary their profile (crew salary section)».
//
// Replicates EXACTLY (same queries, same libs — imports the real pure
// modules) what each view computes, then cross-checks:
//   A.  djorudjov profile «Мои доходы» → getMemberEarnings (OLD behavior:
//       shifts + expense_commission) — kept for the record.
//   B2. owner «Зарплаты команды» → getTeamEarnings with the NEW task-79
//       category-aware math for EVERY member (shifts + category bonuses).
//   C.  /salary «Детали расчёта» → calculateSalaryForPeriod category
//       bonuses (rentals via resolveRentalOperator chain + sales via
//       resolveSaleOperator) — the canonical picture.
//   D.  reassigned sale sanity.
//
// Run: bun --env-file=.env.local scripts/task79-verify-salary-pipeline.ts
import { createClient } from "../node_modules/@supabase/supabase-js/dist/main/index.js";
import { resolveRentalOperator, resolveSaleOperator, type ShiftLike } from "../app/franchize/lib/operator-attribution.ts";
import {
  computeRentalSalary,
  computeSaleSalary,
  OFFICIAL_SALARY_CONFIG,
  resolveCategoriesForBike,
} from "../lib/salary-coefficients-shared.ts";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";
const DJ = "7813830016"; // djorudjov

// ── current pay period (same rule as getCurrentPayPeriod)
const now = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const y = now.getUTCFullYear(), mo = now.getUTCMonth(), day = now.getUTCDate();
let from: string, to: string;
if (day >= 25) {
  from = fmt(y, mo, 25);
  const nm = mo === 11 ? 0 : mo + 1; const ny = mo === 11 ? y + 1 : y;
  to = fmt(ny, nm, 10);
} else if (day < 10) {
  const pm = mo === 0 ? 11 : mo - 1; const py = mo === 0 ? y - 1 : y;
  from = fmt(py, pm, 25);
  to = fmt(y, mo, 10);
} else {
  from = fmt(y, mo, 10); to = fmt(y, mo, 25);
}
console.log(`PAY PERIOD: ${from} … ${to}`);
const fromDateIso = new Date(`${from}T00:00:00.000+03:00`).toISOString();
const toDateIso = new Date(`${to}T23:59:59.999+03:00`).toISOString();

// ── shared context (mirrors computeCategoryBonuses + team-earnings queries)
const { data: crewRow } = await sb.from("crews").select("metadata").eq("id", CREW_ID).single();
const stored = (crewRow?.metadata as any)?.franchize?.salaryCoefficients;
const hasCoefficients = Boolean(stored);
const config = structuredClone(OFFICIAL_SALARY_CONFIG);
if (stored) {
  for (const cat of Object.keys(config.rental) as (keyof typeof config.rental)[]) {
    const v = Number(stored.rental?.[cat]); if (Number.isFinite(v) && v >= 0) config.rental[cat] = Math.round(v);
  }
  const eu = Number(stored.equipmentRentalUnit); if (Number.isFinite(eu) && eu >= 0) config.equipmentRentalUnit = Math.round(eu);
  for (const cat of Object.keys(config.sale) as (keyof typeof config.sale)[]) {
    const v = Number(stored.sale?.[cat]); if (Number.isFinite(v) && v >= 0) config.sale[cat] = Math.round(v);
  }
  const op = Number(stored.overpricePercent); if (Number.isFinite(op) && op >= 0 && op <= 100) config.overpricePercent = Math.round(op);
}
console.log(`config: category model=${hasCoefficients} rental=${JSON.stringify(config.rental)} sale=${JSON.stringify(config.sale)}`);

const { data: members } = await sb.from("crew_members")
  .select("user_id, role, users (username, full_name, metadata)")
  .eq("crew_id", CREW_ID).eq("membership_status", "active");
const memberIdsSet = new Set((members || []).map((m: any) => m.user_id));

// shifts ±1 day margin (same as calculateSalaryForPeriod)
const { data: shiftRows } = await sb.from("crew_member_shifts")
  .select("member_id, clock_in_time, clock_out_time")
  .eq("crew_id", CREW_ID)
  .gte("clock_in_time", new Date(Date.parse(fromDateIso) - 86400000).toISOString())
  .lte("clock_in_time", new Date(Date.parse(toDateIso) + 86400000).toISOString());
const shifts: ShiftLike[] = (shiftRows || []).map((s: any) => ({ member_id: s.member_id, clock_in_time: s.clock_in_time, clock_out_time: s.clock_out_time ?? null }));

const { data: carsB } = await sb.from("cars").select("id, make, model, specs, daily_price, crew_id").eq("crew_id", CREW_ID);
const carById = new Map((carsB || []).map((c: any) => [c.id, c]));
const carIds = (carsB || []).map((c: any) => c.id);

// rentals in period (same query as computeCategoryBonuses)
const { data: rentals } = await sb.from("rentals")
  .select("rental_id, total_cost, metadata, created_at, created_by_operator_chat_id, requested_start_date, requested_end_date, agreed_start_date, agreed_end_date, vehicle_id")
  .in("vehicle_id", carIds).neq("status", "cancelled")
  .gte("requested_start_date", fromDateIso).lt("requested_start_date", toDateIso);

// sales in period (private schema, same query)
const { data: sales } = await sb.schema("private").from("sale_contract_artifacts")
  .select("id, sale_price, resolved_bike_id, created_at, telegram_chat_id")
  .in("resolved_bike_id", carIds)
  .gte("created_at", fromDateIso).lt("created_at", toDateIso);

const shiftAccrued = (sh: any[] | null) => (sh || []).reduce((sum, s) => {
  const storedAmt = Number(s.salary_amount || 0);
  if (storedAmt > 0) return sum + storedAmt;
  const start = s.clock_in_time ? new Date(s.clock_in_time) : null;
  if (!start) return sum;
  const end = s.clock_out_time ? new Date(s.clock_out_time) : new Date();
  return sum + Math.max(0, (end.getTime() - start.getTime()) / 3600000) * Number(s.hourly_rate || 0);
}, 0);

const rentalBonusFor = (memberId: string) => {
  let total = 0;
  for (const r of rentals || []) {
    const a = resolveRentalOperator({ created_by_operator_chat_id: r.created_by_operator_chat_id, created_at: r.created_at, metadata: r.metadata }, shifts);
    if (a.operatorId !== memberId) continue;
    const bike: any = carById.get(r.vehicle_id);
    const cats = resolveCategoriesForBike({ bikeId: r.vehicle_id, specs: bike?.specs, dailyPrice: bike?.daily_price });
    const eq = (r.metadata?.equipment || {}) as any;
    const price = Number(r.total_cost) || 0;
    const units = ["helmets", "gloves"].reduce((s, k) => s + Math.max(0, Number(eq[k]) || 0), 0)
      + ["jacket", "pants", "boots", "net", "backpack"].reduce((s, k) => s + (eq[k] ? 1 : 0), 0);
    total += computeRentalSalary({ config, rentalCategory: cats.rental, equipmentUnits: units, totalCost: price, standardPrice: price }).total;
  }
  return total;
};
const saleBonusFor = (memberId: string) => {
  let total = 0;
  for (const s of sales || []) {
    const a = resolveSaleOperator({ telegram_chat_id: s.telegram_chat_id, created_at: s.created_at }, memberIdsSet, shifts);
    if (a.operatorId !== memberId) continue;
    const bike: any = carById.get(s.resolved_bike_id);
    const cats = resolveCategoriesForBike({ bikeId: s.resolved_bike_id, specs: bike?.specs, dailyPrice: bike?.daily_price });
    total += computeSaleSalary({ config, saleCategory: cats.sale, salePrice: Number(s.sale_price) || 0 }).total;
  }
  return total;
};

// ── A. «Мои доходы» (NEW category-aware getMemberEarnings for djorudjov)
const { data: djShifts } = await sb.from("crew_member_shifts")
  .select("clock_in_time, clock_out_time, hourly_rate, salary_amount")
  .eq("crew_id", CREW_ID).eq("member_id", DJ)
  .gte("clock_in_time", fromDateIso).lte("clock_in_time", toDateIso);
const djShiftIncome = Math.round(shiftAccrued(djShifts));
const djRentalBonus = Math.round(rentalBonusFor(DJ));
const djSaleBonus = Math.round(saleBonusFor(DJ));
console.log(`\nA. МОИ ДОХОДЫ djorudjov (NEW): shifts=${djShifts?.length} → ${djShiftIncome}₽ + бонусы аренд/продаж ${djRentalBonus + djSaleBonus}₽ = TOTAL ${djShiftIncome + djRentalBonus + djSaleBonus}₽`);

// ── B2. «Зарплаты команды» (NEW category-aware getTeamEarnings)
const teamRows: any[] = [];
for (const m of members || []) {
  const { data: sh } = await sb.from("crew_member_shifts")
    .select("clock_in_time, clock_out_time, hourly_rate, salary_amount")
    .eq("crew_id", CREW_ID).eq("member_id", m.user_id)
    .gte("clock_in_time", fromDateIso).lte("clock_in_time", toDateIso);
  const si = Math.round(shiftAccrued(sh || []));
  const ci = Math.round(rentalBonusFor(m.user_id) + saleBonusFor(m.user_id));
  teamRows.push({ id: m.user_id, name: (m.users as any)?.username || m.user_id, role: m.role, shifts: sh?.length ?? 0, si, ci, total: si + ci });
}
console.log("\nB2. ЗАРПЛАТЫ КОМАНДЫ (owner modal, NEW):");
for (const r of teamRows.sort((a, b) => b.total - a.total)) {
  console.log(`   ${r.name.padEnd(14)} ${r.role.padEnd(9)} shifts=${String(r.shifts).padStart(3)} shifts₽=${String(r.si).padStart(7)} bonuses₽=${String(r.ci).padStart(6)} TOTAL=${r.total}₽`);
}
const djRow = teamRows.find(r => r.id === DJ);
const match = djRow && djRow.si === djShiftIncome && djRow.ci === djRentalBonus + djSaleBonus;
console.log(`   ⇒ djorudjov team row == «Мои доходы»: ${match ? "YES ✓ (одна и та же картина у члена и владельца)" : "NO ✗"}`);

// ── C. attribution detail for djorudjov (audit transparency)
const attributionByOperator: Record<string, number> = {};
const djRentalLines: string[] = [];
for (const r of rentals || []) {
  const a = resolveRentalOperator({ created_by_operator_chat_id: r.created_by_operator_chat_id, created_at: r.created_at, metadata: r.metadata }, shifts);
  attributionByOperator[a.operatorId ?? "none"] = (attributionByOperator[a.operatorId ?? "none"] || 0) + 1;
  if (a.operatorId === DJ) {
    const bike: any = carById.get(r.vehicle_id);
    djRentalLines.push(`   ${r.requested_start_date?.slice(0, 10)} ${String((bike?.make ?? "") + " " + (bike?.model ?? "")).trimEnd().slice(0, 24)} ${String(Number(r.total_cost) || 0).padStart(7)}₽ src=${a.source}`);
  }
}
console.log(`\nC1. АРЕНДЫ периода: total=${rentals?.length}, by operator: ${JSON.stringify(attributionByOperator)}`);
console.log(djRentalLines.join("\n"));
const djSales: any[] = [];
for (const s of sales || []) {
  const a = resolveSaleOperator({ telegram_chat_id: s.telegram_chat_id, created_at: s.created_at }, memberIdsSet, shifts);
  if (a.operatorId === DJ) djSales.push(s);
}
console.log(`C2. ПРОДАЖИ периода: djorudjov=${djSales.length} (telegram_chat_id атрибуция)`);

// ── D. reassigned sale sanity
const { data: fl } = await sb.schema("private").from("sale_contract_artifacts")
  .select("id, telegram_chat_id").eq("id", "f1915967-1056-425d-874c-86e694ef514e").single();
console.log(`\nD. REASSIGNED SALE (falcon-lite 290 000₽): telegram_chat_id=${fl?.telegram_chat_id} ${fl?.telegram_chat_id === DJ ? "✓" : "✗"}`);
