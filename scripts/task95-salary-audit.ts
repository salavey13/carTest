// Task 95 (2026-10-15) — salary audit for djorudjov, October 2026.
//
// Replicates the EXACT math the profile «Мои доходы» (getMemberEarnings) and
// the owner overview (getOwnerSalaryOverview) render, using the same PURE
// production modules (lib/salary-coefficients-shared, lib/rental-pricing-
// calculator, app/franchize/lib/operator-attribution, app/franchize/lib/
// salary-paid-out, app/franchize/lib/msk-time) — so the numbers here ARE the
// numbers the profile shows for the same period. DB access is service-role
// REST (same as supabaseAdmin).
//
// Also produces the operator-attribution audit for ALL October rentals:
// who each rental was credited to (doc_command / handout / return / shift),
// which verifies the boss's claim «all rental bonuses belong to djorudjov»
// and exposes the /doc created_by bug (fixed in this task: doc-manual.ts used
// to write crewOwnerChatId instead of the sender).
//
// Usage: bun scripts/task95-salary-audit.mjs   (needs .env.local)
// Out:   scripts/task95-salary-result.json + console table.

import { readFileSync, writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import {
  OFFICIAL_SALARY_CONFIG,
  DEFAULT_PRICE_TIERS,
  resolveCategoriesForBike,
  resolveBikeCategories,
  countEquipmentUnits,
  computeRentalSalary,
  computeSaleSalary,
  RENTAL_CATEGORY_LABELS,
  type SalaryConfig,
  type RentalEquipment,
} from "../lib/salary-coefficients-shared.ts";
import { calculatePrice } from "../lib/rental-pricing-calculator.ts";
import {
  resolveRentalOperator,
  resolveSaleOperator,
  ATTRIBUTION_SOURCE_LABELS,
} from "../app/franchize/lib/operator-attribution.ts";
import { computeShiftAccrued } from "../app/franchize/lib/salary-paid-out.ts";
import { mskDateFromUtcIso } from "../app/franchize/lib/msk-time.ts";

const URL_ = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!URL_ || !KEY) { console.error("Missing SUPABASE env"); process.exit(1); }
const db = createClient(URL_, KEY, { auth: { persistSession: false } });
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const CREW_SLUG = "vip-bike";
const MEMBER_USERNAME = "djorudjov";
const PERIOD_FROM = "2026-10-01";
const PERIOD_TO = "2026-10-31"; // full month window (data to date shows through today)

// MSK-anchored period window (same as normalizePeriodStart/End for date-only
// inputs — app/franchize/lib/msk-time.ts).
const MSK_OFFSET = 3 * 3600 * 1000;
function dayBounds(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const startMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - MSK_OFFSET;
  return { startUtcIso: new Date(startMs).toISOString(), endUtcIso: new Date(startMs + 86400000 - 1).toISOString() };
}
const fromDate = dayBounds(PERIOD_FROM).startUtcIso;          // 2026-09-30T21:00:00.000Z
const toDateIso = dayBounds(PERIOD_TO).endUtcIso;             // 2026-10-31T20:59:59.999Z

// ── config readers (replicas of lib/salary-coefficients.ts private helpers) ─
function readSalaryConfig(metadata) {
  const config = structuredClone(OFFICIAL_SALARY_CONFIG);
  let node = metadata;
  for (const key of ["franchize", "salaryCoefficients"]) {
    if (!node || typeof node !== "object") return null;
    node = node[key];
  }
  if (!node || typeof node !== "object") return null;
  let touched = false;
  for (const cat of Object.keys(config.rental)) {
    const v = Number(node.rental?.[cat]);
    if (Number.isFinite(v) && v >= 0) { config.rental[cat] = Math.round(v); touched = true; }
  }
  const equipUnit = Number(node.equipmentRentalUnit);
  if (Number.isFinite(equipUnit) && equipUnit >= 0) { config.equipmentRentalUnit = Math.round(equipUnit); touched = true; }
  for (const cat of Object.keys(config.sale)) {
    const v = Number(node.sale?.[cat]);
    if (Number.isFinite(v) && v >= 0) { config.sale[cat] = Math.round(v); touched = true; }
  }
  for (const cat of Object.keys(config.equipmentSale)) {
    const v = Number(node.equipmentSale?.[cat]);
    if (Number.isFinite(v) && v >= 0) { config.equipmentSale[cat] = Math.round(v); touched = true; }
  }
  const op = Number(node.overpricePercent);
  if (Number.isFinite(op) && op >= 0 && op <= 100) { config.overpricePercent = Math.round(op); touched = true; }
  return touched ? config : null;
}
function readPriceTiers(metadata) {
  const raw = metadata?.franchize?.salaryCoefficients?.priceThresholds;
  const premium = Number(raw?.premiumThreshold);
  const regular = Number(raw?.regularThreshold);
  if (Number.isFinite(premium) && premium > 0 && Number.isFinite(regular) && regular > 0 && regular < premium) {
    return { premiumThreshold: premium, regularThreshold: regular };
  }
  return { ...DEFAULT_PRICE_TIERS };
}

// ── standard price helpers (replicas of lib/salary-coefficients.ts) ─────────
function splitIsoToMoscow(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const fmt = new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts = {};
    for (const p of fmt.formatToParts(d)) parts[p.type] = p.value;
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
  } catch { return null; }
}
function equipmentStandardCost(eq) {
  if (!eq) return 0;
  let c = 0;
  if (Number(eq.helmets) > 0) c += Number(eq.helmets) * 1000;
  if (Number(eq.gloves) > 0) c += Number(eq.gloves) * 500;
  if (eq.jacket) c += 500;
  if (eq.pants) c += 500;
  if (eq.boots) c += 500;
  if (eq.net) c += 500;
  if (eq.backpack) c += 500;
  return c;
}
function standardRentalPrice({ specs, startIso, endIso, dailyPrice, fallbackTotalCost }) {
  try {
    if (!startIso || !endIso) return fallbackTotalCost;
    const start = splitIsoToMoscow(startIso);
    const end = splitIsoToMoscow(endIso);
    if (!start || !end) return fallbackTotalCost;
    const pricing = calculatePrice({ ...(specs || {}), dailyPrice: dailyPrice ?? undefined }, start.date, end.date, start.time, end.time, 0);
    if (!Number.isFinite(pricing.basePriceRub) || pricing.basePriceRub <= 0) return fallbackTotalCost;
    return pricing.basePriceRub;
  } catch { return fallbackTotalCost; }
}

// ── go ───────────────────────────────────────────────────────────────────────
console.log(`Период (MSK): ${PERIOD_FROM} 00:00 — ${PERIOD_TO} 23:59`);
console.log(`UTC окно: ${fromDate} — ${toDateIso}\n`);

const { data: crewRows } = await db.from("crews").select("id, name, slug, owner_id, metadata").eq("slug", CREW_SLUG).maybeSingle();
if (!crewRows) { console.error("crew not found"); process.exit(1); }
const crew = crewRows;
const crewId = crew.id;
console.log(`Экипаж: ${crew.name} (${crew.slug}) id=${crewId} owner_id=${crew.owner_id}`);

const { data: memberRows } = await db.from("users").select("user_id, username, full_name, metadata").ilike("username", `%${MEMBER_USERNAME}%`);
const users = memberRows || [];
console.log("Найденные юзеры по username ilike djorudjov:", users.map(u => `${u.user_id} @${u.username} ${u.full_name}`).join(" | "));
const member = users[0];
if (!member) { console.error("member not found"); process.exit(1); }
const memberId = member.user_id;

const { data: membership } = await db.from("crew_members").select("user_id, role, membership_status").eq("crew_id", crewId).eq("user_id", memberId).maybeSingle();
console.log(`Членство: ${JSON.stringify(membership)}`);
const { data: ownerMembership } = await db.from("crew_members").select("user_id, role").eq("crew_id", crewId).eq("role", "owner");
console.log("crew_members с role=owner:", JSON.stringify(ownerMembership));

// shifts (period + ±1day margin for attribution)
const [{ data: periodShifts }, { data: allShiftRows }, { data: memberRowIds }] = await Promise.all([
  db.from("crew_member_shifts").select("clock_in_time, clock_out_time, hourly_rate, salary_amount, member_id")
    .eq("crew_id", crewId).gte("clock_in_time", fromDate).lte("clock_in_time", toDateIso),
  db.from("crew_member_shifts").select("member_id, clock_in_time, clock_out_time")
    .eq("crew_id", crewId)
    .gte("clock_in_time", new Date(Date.parse(fromDate) - 86400000).toISOString())
    .lte("clock_in_time", new Date(Date.parse(toDateIso) + 86400000).toISOString()),
  db.from("crew_members").select("user_id").eq("crew_id", crewId),
]);
const memberIds = new Set((memberRowIds || []).map((m) => m.user_id));
const shiftsForAttribution = (allShiftRows || []).map((s) => ({ member_id: s.member_id, clock_in_time: s.clock_in_time, clock_out_time: s.clock_out_time ?? null }));
console.log(`\nСмен в окне (все члены): ${(periodShifts || []).length}; смен (с ±1д, для атрибуции): ${shiftsForAttribution.length}`);
const memberShifts = (periodShifts || []).filter((s) => s.member_id === memberId);
console.log(`Смен djorudjov в окне: ${memberShifts.length}`);

// crew bikes → category overrides
const { data: bikes } = await db.from("cars").select("id, make, model, daily_price, specs").eq("crew_id", crewId).order("daily_price", { ascending: false });
const tiers = readPriceTiers(crew.metadata);
const bikeOverrides = new Map();
for (const bike of bikes || []) {
  if (!bike?.id) continue;
  bikeOverrides.set(bike.id, resolveCategoriesForBike({ bikeId: bike.id, specs: bike.specs, dailyPrice: bike.daily_price, tiers }));
}
const bikeName = (id) => {
  const b = (bikes || []).find((x) => x.id === id);
  return b ? `${b.make || ""} ${b.model || ""}`.trim() : id;
};

// ── ALL crew rentals in the period (same select/filters as computeCategoryBonuses)
const { data: rentals, error: rentalsError } = await db.from("rentals")
  .select(`rental_id, total_cost, metadata, created_at, created_by_operator_chat_id,
           requested_start_date, requested_end_date, agreed_start_date, agreed_end_date,
           vehicle:cars!inner(id, make, model, crew_id, specs, daily_price)`)
  .eq("vehicle.crew_id", crewId)
  .neq("status", "cancelled")
  .gte("requested_start_date", fromDate)
  .lt("requested_start_date", toDateIso);
if (rentalsError) console.error("rentals query error:", rentalsError.message);
console.log(`\nАренд в окне (не cancelled): ${(rentals || []).length}`);

const config = readSalaryConfig(crew.metadata) || structuredClone(OFFICIAL_SALARY_CONFIG);
console.log("Коэффициенты экипажа (после metadata-оверрайдов):", JSON.stringify({
  rental: config.rental, equipmentRentalUnit: config.equipmentRentalUnit,
  sale: config.sale, overpricePercent: config.overpricePercent,
  fromMetadata: Boolean(readSalaryConfig(crew.metadata)),
}));

// attribute ALL rentals + compute salary for each
const rentalRows = [];
const attributionTally = new Map();
let bonusAllRentals = 0;
for (const r of rentals || []) {
  const attribution = resolveRentalOperator(r, shiftsForAttribution);
  const vehicle = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
  const meta = r.metadata || {};
  const eq = (meta.equipment || {});
  const price = Number(r.total_cost) || 0;
  const stdPrice = standardRentalPrice({
    specs: vehicle?.specs,
    startIso: r.requested_start_date || r.agreed_start_date,
    endIso: r.requested_end_date || r.agreed_end_date,
    dailyPrice: vehicle?.daily_price,
    fallbackTotalCost: price,
  }) + equipmentStandardCost(eq);
  const categories = resolveBikeCategories(vehicle?.id || "", bikeOverrides);
  const salary = computeRentalSalary({
    config,
    rentalCategory: categories.rental,
    equipmentUnits: countEquipmentUnits(eq),
    totalCost: price,
    standardPrice: stdPrice,
  });
  bonusAllRentals += salary.total;
  const key = `${attribution.operatorId ?? "никто"}|${attribution.source}`;
  attributionTally.set(key, (attributionTally.get(key) ?? 0) + 1);
  rentalRows.push({
    rentalId: r.rental_id,
    createdAt: r.created_at,
    bikeId: vehicle?.id,
    bike: bikeName(vehicle?.id),
    start: r.requested_start_date,
    end: r.requested_end_date,
    totalCost: price,
    standardPrice: stdPrice,
    markup: Math.max(0, price - stdPrice),
    equipmentUnits: countEquipmentUnits(eq),
    rentalCategory: categories.rental,
    categoryLabel: RENTAL_CATEGORY_LABELS[categories.rental],
    attributionSource: attribution.source,
    attributionOperator: attribution.operatorId,
    isDjorudjov: attribution.operatorId === memberId,
    salary,
    createdByOperatorChatId: r.created_by_operator_chat_id,
    handoutBy: meta?.pickup_freeze?.frozen_by ?? null,
    returnBy: meta?.return_confirmed_by ?? null,
  });
}
rentalRows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

// ── sales (private schema) ──────────────────────────────────────────────────
const bikeIds = (bikes || []).map((b) => b.id);
let saleRows = [];
if (bikeIds.length > 0) {
  const res = await fetch(`${URL_}/rest/v1/sale_contract_artifacts?select=id,sale_price,resolved_bike_id,created_at,telegram_chat_id&resolved_bike_id=in.(${bikeIds.join(",")})&created_at=gte.${fromDate}&created_at=lt.${toDateIso}`, { headers: { ...H, "Accept-Profile": "private" } });
  if (res.ok) saleRows = await res.json();
  else console.error("sales query failed:", res.status, await res.text());
}
let saleTotalAll = 0;
const salesAttributed = [];
for (const s of saleRows) {
  const attribution = resolveSaleOperator(s, memberIds, shiftsForAttribution);
  const categories = resolveBikeCategories(s.resolved_bike_id || "", bikeOverrides);
  const salary = computeSaleSalary({ config, saleCategory: categories.sale, salePrice: Number(s.sale_price) || 0 });
  saleTotalAll += salary.total;
  if (attribution.operatorId === memberId) salesAttributed.push({ id: s.id, bike: bikeName(s.resolved_bike_id), createdAt: s.created_at, salePrice: Number(s.sale_price) || 0, category: categories.sale, salary, source: attribution.source });
}

// ── djorudjov: EXACT getMemberEarnings replication ──────────────────────────
const shiftIncome = computeShiftAccrued(memberShifts || []);
const shiftBreakdown = (memberShifts || []).map((s) => {
  const stored = Number(s.salary_amount || 0);
  const start = s.clock_in_time ? new Date(s.clock_in_time) : null;
  const end = s.clock_out_time ? new Date(s.clock_out_time) : new Date();
  const hours = start ? Math.max(0, (end.getTime() - start.getTime()) / 3600000) : 0;
  return { clockIn: s.clock_in_time, clockOut: s.clock_out_time, hours: Math.round(hours * 10) / 10, rate: Number(s.hourly_rate || 0), salaryAmount: stored, amount: Math.round(stored > 0 ? stored : hours * Number(s.hourly_rate || 0)) };
});

const attributedRentals = rentalRows.filter((r) => r.isDjorudjov);
const byCategory = new Map();
let rentalBonusTotal = 0;
for (const r of attributedRentals) {
  rentalBonusTotal += r.salary.total;
  const label = r.categoryLabel;
  const bucket = byCategory.get(label) || { count: 0, amount: 0, sources: {} };
  bucket.count += 1;
  bucket.amount += r.salary.total;
  bucket.sources[r.attributionSource] = (bucket.sources[r.attributionSource] ?? 0) + 1;
  byCategory.set(label, bucket);
}
const saleBonusTotal = salesAttributed.reduce((sum, s) => sum + s.salary.total, 0);
const commissionIncome = rentalBonusTotal + saleBonusTotal; // category model
const totalAccrued = Math.round(shiftIncome + commissionIncome);

// ── paid out (sumMemberPaidOut replica) ─────────────────────────────────────
const { data: formalRows } = await db.from("cash_transactions").select("amount, transaction_date, description")
  .eq("crew_id", crewId).eq("to_user_id", memberId).eq("transaction_type", "expense_salary")
  .gte("transaction_date", fromDate).lte("transaction_date", toDateIso);
const formalTotal = (formalRows || []).reduce((s, r) => s + (Number(r.amount) > 0 ? Number(r.amount) : 0), 0);
const startMskDate = mskDateFromUtcIso(fromDate);
const endMskDate = mskDateFromUtcIso(toDateIso);
const esc = memberId.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
const { data: walletRows } = await db.from("owner_cash_entries")
  .select("amount, title, person, kind, source, metadata, entry_date")
  .eq("crew_id", crewId).eq("direction", "out").gt("amount", 0)
  .ilike("person", `%(${esc})%`)
  .gte("entry_date", startMskDate).lte("entry_date", endMskDate);
const isWalletSalaryTitle = (title, metadata) => (typeof title === "string" && /зарпл/i.test(title)) || metadata?.book === "salary";
const isMirrored = (row) => {
  const meta = row.metadata ?? null;
  if (meta && (typeof meta.mirrorOfTx === "string" || typeof meta.mirroredToTx === "string")) return true;
  return row.source === "profile" && (row.metadata === null || row.metadata === undefined);
};
const walletSalary = (walletRows || []).filter((r) => r.kind !== "subrenter_payout").filter((r) => isWalletSalaryTitle(r.title, r.metadata)).filter((r) => !isMirrored(r));
const walletTotal = walletSalary.reduce((s, r) => s + (Number(r.amount) > 0 ? Number(r.amount) : 0), 0);
const paidTotal = formalTotal + walletTotal;

// legacy-model check: recorded commissions (should be skipped under category model)
const { data: legacyCommissions } = await db.from("cash_transactions").select("amount")
  .eq("crew_id", crewId).eq("to_user_id", memberId).eq("transaction_type", "expense_commission")
  .gte("transaction_date", fromDate).lte("transaction_date", toDateIso);

// ── ARTIFACT CROSS-CHECK: /doc rentals mis-attributed to the crew owner ─────
// private.rental_contract_artifacts.created_by_operator_chat_id was written
// as String(userId) (the SENDER) forever — so the TRUE operator of every
// /doc rental is recoverable even where the rentals row carries the buggy
// crewOwnerChatId (doc-manual bug, fixed 2026-10-15).
const docRentals = rentalRows.filter((r) => r.attributionSource === "doc_command");
const artifactFix = [];
let correctedBonusDelta = 0;
if (docRentals.length > 0) {
  const ids = docRentals.map((r) => r.rentalId).join(",");
  const res = await fetch(`${URL_}/rest/v1/rental_contract_artifacts?select=rental_id,created_by_operator_chat_id,telegram_chat_id,created_at&rental_id=in.(${ids})`, { headers: { ...H, "Accept-Profile": "private" } });
  if (res.ok) {
    const arts = await res.json();
    for (const r of docRentals) {
      const art = (arts || []).find((a) => a.rental_id === r.rentalId);
      const trueOperator = art?.created_by_operator_chat_id ?? null;
      const reattributed = trueOperator === memberId && !r.isDjorudjov;
      if (reattributed) correctedBonusDelta += r.salary.total;
      artifactFix.push({ rentalId: r.rentalId, rentalsRowSays: r.attributionOperator, artifactSays: trueOperator, salary: Math.round(r.salary.total), reattributedToDjorudjov: reattributed });
    }
  } else console.error("artifacts query failed:", res.status);
}
console.log("\n═══ КРОСС-ЧЕРЕЗ АРТЕФАКТОВ (/doc аренды) ═══");
for (const f of artifactFix) console.log(`  ${f.rentalId.slice(0, 8)}… rentals-таблица: ${f.rentalsRowSays} · артефакт: ${f.artifactSays} · ${f.salary} ₽ ${f.reattributedToDjorudjov ? "→ ПЕРЕЗАЧЕНО djorudjov" : ""}`);
console.log(`Скорректированные арендные бонусы djorudjov: ${Math.round(rentalBonusTotal + correctedBonusDelta)} ₽ (+${Math.round(correctedBonusDelta)})`);
console.log(`Скорректированный итог: ${Math.round(shiftIncome + rentalBonusTotal + correctedBonusDelta + saleBonusTotal)} ₽`);

// ── report ──────────────────────────────────────────────────────────────────
console.log("\n═══ АТРИБУЦИЯ ВСЕХ аренд октября (по источнику) ═══");
for (const [key, n] of [...attributionTally.entries()].sort()) {
  const [op, src] = key.split("|");
  const name = op === "никто" ? "НИКТО" : op === memberId ? "djorudjov" : op === crew.owner_id ? "owner экипажа" : op;
  console.log(`  ${name} ← ${ATTRIBUTION_SOURCE_LABELS[src]}: ${n}`);
}
console.log(`Бонусы за ВСЕ аренды (если бы всё досталось одному): ${Math.round(bonusAllRentals)} ₽; продажи все: ${saleTotalAll} ₽`);

console.log("\n═══ djorudjov: расчёт (1:1 как в «Мои доходы») ═══");
console.log(`Смены: ${memberShifts.length} → ${Math.round(shiftIncome)} ₽`);
console.log(`Арендные бонусы: ${Math.round(rentalBonusTotal)} ₽ (${attributedRentals.length} аренд)`);
for (const [label, b] of byCategory) console.log(`   · ${label}: ${b.count} шт → ${Math.round(b.amount)} ₽ (источники: ${JSON.stringify(b.sources)})`);
console.log(`Продажи: ${Math.round(saleBonusTotal)} ₽ (${salesAttributed.length})`);
console.log(`ИТОГО начислено: ${totalAccrued} ₽`);
console.log(`Выплачено: formal=${formalTotal} + wallet=${walletTotal} = ${paidTotal} ₽ → остаток ${Math.max(0, totalAccrued - paidTotal)} ₽`);
console.log(`(legacy expense_commission записей в окне: ${(legacyCommissions || []).length} — при категорийной модели игнорируются)`);

const result = {
  generatedAt: new Date().toISOString(),
  period: { fromMsk: PERIOD_FROM, toMsk: PERIOD_TO, fromUtc: fromDate, toUtc: toDateIso },
  crew: { id: crewId, name: crew.name, slug: crew.slug, ownerId: crew.owner_id },
  member: { id: memberId, username: member.username, fullName: member.full_name, membership: membership },
  config: { ...config, fromMetadata: Boolean(readSalaryConfig(crew.metadata)), tiers },
  ownerMembershipRows: ownerMembership,
  shifts: { count: memberShifts.length, income: Math.round(shiftIncome), breakdown: shiftBreakdown },
  rentals: {
    total: rentalRows.length,
    attributedToMember: attributedRentals.length,
    bonusTotalMember: Math.round(rentalBonusTotal),
    bonusAllRentals: Math.round(bonusAllRentals),
    byCategory: Object.fromEntries([...byCategory.entries()].map(([k, v]) => [k, { ...v, amount: Math.round(v.amount) }])),
    rows: rentalRows.map((r) => ({ ...r, salary: { ...r.salary, total: Math.round(r.salary.total) }, standardPrice: Math.round(r.standardPrice), markup: Math.round(r.markup) })),
  },
  sales: { total: saleRows.length, attributedToMember: salesAttributed.length, bonusTotalMember: Math.round(saleBonusTotal), bonusAll: Math.round(saleTotalAll), rows: salesAttributed.map((s) => ({ ...s, salary: { ...s.salary, total: Math.round(s.salary.total) } })) },
  totals: { shiftIncome: Math.round(shiftIncome), commissionIncome: Math.round(commissionIncome), totalAccrued },
  paidOut: { formalTotal, walletTotal, total: paidTotal, walletRows: walletSalary.map((r) => ({ title: r.title, amount: r.amount, entryDate: r.entry_date, source: r.source })), formalRows: (formalRows || []).map((r) => ({ date: r.transaction_date, amount: r.amount, description: r.description })) },
  balanceDue: Math.max(0, totalAccrued - paidTotal),
  attributionTally: Object.fromEntries([...attributionTally.entries()]),
  legacyCommissionsCount: (legacyCommissions || []).length,
};
writeFileSync(new URL("./task95-salary-result.json", import.meta.url), JSON.stringify(result, null, 2));
console.log("\n✓ JSON → scripts/task95-salary-result.json");
