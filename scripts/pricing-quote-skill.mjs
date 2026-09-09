#!/usr/bin/env node
// pricing-quote-skill.mjs — Instant price quotes for VIP Bike.
//
// Calculates rental prices using the same logic as the web app's pricing calculator.
// Supports daily/hourly tiers, equipment add-ons (helmets, gloves, etc.), deposits.
//
// Usage:
//   node pricing-quote-skill.mjs quote --bike "MT-07" --days 3
//   node pricing-quote-skill.mjs quote --bike "MT-07" --days 3 --helmets 2 --gloves 2
//   node pricing-quote-skill.mjs quote --bike "MT-07" --hours 5
//   node pricing-quote-skill.mjs quote --bikeId falcon-gt-2025 --days 2
//   node pricing-quote-skill.mjs deposit --bike "MT-07"
//   node pricing-quote-skill.mjs deposit --bikeId falcon-gt-2025
//   node pricing-quote-skill.mjs tiers --bike "MT-07"
//   node pricing-quote-skill.mjs list-prices
//
// Env:
//   SUPABASE_URL                (default: https://inmctohsodgdohamhzag.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY   (fallback: read from --secrets=<path>)

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SUPA_URL = "https://inmctohsodgdohamhzag.supabase.co";
const DEFAULT_SECRETS_PATH = "/home/z/my-project/upload/secrets.txt";
const CREW_SLUG = "vip-bike";
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";

// Equipment prices (mirrors app/franchize/lib/pricing-calculator.ts)
// Helmet is duration-dependent: <24h = 500₽, ≥24h = 1000₽ (see helmetPrice())
const GLOVES_PRICE = 500;      // ₽ per rental
const NET_PRICE = 500;         // ₽ per rental
const BACKPACK_PRICE = 500;    // ₽ per rental
const BAG_PRICE = 500;         // ₽ per rental
const CHARGER_PRICE = 0;       // free (returnable)
const JACKET_PRICE = 500;      // ₽ per rental
const BOOTS_PRICE = 500;       // ₽ per rental

// ─── Arg parsing ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0] || "";
const flags = {};
const positional = [];
let secretsPath = DEFAULT_SECRETS_PATH;

for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith("--secrets=")) { secretsPath = a.slice(10); continue; }
  if (a.startsWith("--")) {
    const key = a.slice(2).replace(/=.*$/, "");
    const val = a.includes("=") ? a.slice(a.indexOf("=") + 1) : (args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : true);
    flags[key] = val;
  } else {
    positional.push(a);
  }
}

const arg = (k) => flags[k];
const hasFlag = (k) => k in flags;

// ─── Supabase setup ──────────────────────────────────────────────────────────

function loadSecrets() {
  try {
    const raw = readFileSync(secretsPath, "utf-8");
    const lines = raw.split("\n");
    const map = {};
    for (const line of lines) {
      const idx = line.indexOf("=");
      if (idx > 0) map[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return map;
  } catch { return {}; }
}

const secretsMap = loadSecrets();
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPA_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || secretsMap.SUPABASE_SERVICE_ROLE_KEY || secretsMap.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.error(JSON.stringify({ ok: false, stage: "env", reason: "missing_supabase_key" }));
  process.exit(2);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Output helpers ──────────────────────────────────────────────────────────

function fail(payload) {
  console.error(JSON.stringify({ ok: false, ...payload }, null, 2));
  process.exit(2);
}
function done(payload) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}
function fmtMoney(n) {
  return Number(n || 0).toLocaleString("ru-RU") + " ₽";
}

// ─── Bike lookup ─────────────────────────────────────────────────────────────

async function findBike(query) {
  let bikeQuery = supabase
    .from("cars")
    .select("id, make, model, type, daily_price, specs, crew_id")
    .eq("crew_id", CREW_ID)
    .in("type", ["bike", "scooter", "car"]);

  if (query.includes("-")) {
    // Looks like a bike ID
    bikeQuery = bikeQuery.eq("id", query);
  } else {
    // Search by make + model
    const parts = query.toLowerCase().split(/\s+/);
    const { data: all } = await supabase
      .from("cars")
      .select("id, make, model, type, daily_price, specs, crew_id")
      .eq("crew_id", CREW_ID)
      .in("type", ["bike", "scooter", "car"]);

    if (!all) return null;
    const match = all.find((b) => {
      const title = `${b.make || ""} ${b.model || ""}`.toLowerCase();
      return parts.every((p) => title.includes(p));
    });
    return match || null;
  }

  const { data, error } = await bikeQuery.maybeSingle();
  if (error || !data) return null;
  return data;
}

// ─── Pricing logic (mirrors pricing-calculator.ts, tier model) ──────────────
// 2026-09-10: aligned with app/franchize/lib/pricing-calculator.ts.
// The web app NEVER uses percentage discounts — it uses per-day tier rates
// from specs (rent_2_4d / rent_5_10d / rent_11_30d) and hourly tiers
// (price_per_hour / price_per_2h / price_per_3h / price_per_6h / price_per_12h).
// The old "7+ days -10%, 14+ days -15%" model was legacy and misquoted prices.

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function isWeekendDate(dateStr) {
  if (!dateStr) return false;
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const day = d.getDay();
  return day === 0 || day === 6;
}

function calculatePrice(dailyPrice, days, hours, specs = {}, startDateStr = null) {
  const perHour = num(specs.price_per_hour) ?? dailyPrice;
  const per2h = num(specs.price_per_2h);
  const per3h = num(specs.price_per_3h);
  const per6h = num(specs.price_per_6h);
  const per12h = num(specs.price_per_12h);

  if (hours && hours > 0) {
    if (hours < 24) {
      if (hours <= 1) return { base: Math.round(perHour * hours), tier: "/ час", tierPrice: perHour, hours, days: 0 };
      if (hours < 3) {
        if (hours === 2 && per2h !== undefined) return { base: per2h, tier: "/ 2 часа", tierPrice: per2h / 2, hours, days: 0 };
        if (perHour !== undefined && per3h !== undefined) {
          const price = Math.round(perHour + (per3h - perHour) * (hours - 1) / 2);
          return { base: price, tier: `/ ${hours} ч`, tierPrice: price / hours, hours, days: 0 };
        }
        const fallback = per3h !== undefined ? per3h / 3 : perHour;
        return { base: Math.round(fallback * hours), tier: `/ ${hours} ч`, tierPrice: fallback, hours, days: 0 };
      }
      if (hours === 3) {
        const rate = per3h !== undefined ? per3h / 3 : perHour;
        return { base: per3h !== undefined ? per3h : Math.round(perHour * 3), tier: "/ 3 часа", tierPrice: rate, hours, days: 0 };
      }
      if (hours < 6) {
        if (per3h !== undefined && per6h !== undefined) {
          const price = Math.round(per3h + (per6h - per3h) * (hours - 3) / 3);
          return { base: price, tier: `/ ${hours} часов`, tierPrice: price / hours, hours, days: 0 };
        }
        const rate = per3h !== undefined ? per3h / 3 : perHour;
        return { base: Math.round(rate * hours), tier: `/ ${hours} часов`, tierPrice: rate, hours, days: 0 };
      }
      if (hours === 6) {
        if (per6h !== undefined) return { base: per6h, tier: "/ 6 часов", tierPrice: per6h / 6, hours, days: 0 };
        const rate = per3h !== undefined ? per3h / 3 : perHour;
        return { base: Math.round(rate * 6), tier: "/ 6 часов", tierPrice: rate, hours, days: 0 };
      }
      if (hours < 12) {
        if (per6h !== undefined && per12h !== undefined) {
          const price = Math.round(per6h + (per12h - per6h) * (hours - 6) / 6);
          return { base: price, tier: `/ ${hours} часов`, tierPrice: price / hours, hours, days: 0 };
        }
        const rate = per6h !== undefined ? per6h / 6 : perHour;
        return { base: Math.round(rate * hours), tier: `/ ${hours} часов`, tierPrice: rate, hours, days: 0 };
      }
      if (hours === 12) {
        if (per12h !== undefined) return { base: per12h, tier: "/ 12 часов", tierPrice: per12h / 12, hours, days: 0 };
        const rate = per6h !== undefined ? per6h / 6 : perHour;
        return { base: Math.round(rate * 12), tier: "/ 12 часов", tierPrice: rate, hours, days: 0 };
      }
      // 12–24h: interpolate between 12h tier and daily
      const daily = num(specs.dailyPrice) ?? num(specs.rent_weekday) ?? dailyPrice;
      if (per12h !== undefined) {
        const price = Math.round(per12h + (daily - per12h) * (hours - 12) / 12);
        return { base: price, tier: `/ ${hours} часов`, tierPrice: price / hours, hours, days: 0 };
      }
      return { base: daily, tier: "/ день", tierPrice: daily, hours, days: 0 };
    }
    // 24+ hours → count as days
    days = Math.ceil(hours / 24);
  }

  // ── Daily tiers: per-day rates × actual days (mirrors calculatePriceForDays) ──
  const d11 = num(specs.rent_11_30d);
  const d5 = num(specs.rent_5_10d);
  const d2 = num(specs.rent_2_4d);
  const weekday = num(specs.rent_weekday);
  const weekend = num(specs.rent_weekend);

  if (days >= 11 && d11 !== undefined) return { base: d11 * days, tier: "/ 11-30 дней", tierPrice: d11, days };
  if (days >= 5 && d5 !== undefined) return { base: d5 * days, tier: "/ 5-10 дней", tierPrice: d5, days };
  if (days >= 2 && d2 !== undefined) return { base: d2 * days, tier: "/ 2-4 дня", tierPrice: d2, days };
  if (days === 1 && startDateStr && isWeekendDate(startDateStr) && weekend !== undefined) {
    return { base: weekend, tier: "/ день (выходные)", tierPrice: weekend, days };
  }
  if (days === 1 && weekday !== undefined) return { base: weekday, tier: weekday < dailyPrice ? "/ день (будни)" : "/ день", tierPrice: weekday, days };
  return { base: dailyPrice * days, tier: "/ день", tierPrice: dailyPrice, days };
}

function helmetPrice(hours) {
  // Mirrors getHelmetPrice(): hourly rentals (<24h) = 500₽, daily+ (≥24h) = 1000₽
  return hours && hours > 0 && hours < 24 ? 500 : 1000;
}

function calculateEquipment(opts) {
  const items = [];
  let total = 0;
  const helmetUnit = helmetPrice(opts.hours);
  if (opts.helmets && opts.helmets > 0) { items.push({ name: `Шлем ×${opts.helmets}`, price: helmetUnit * opts.helmets }); total += helmetUnit * opts.helmets; }
  if (opts.gloves && opts.gloves > 0) { items.push({ name: `Перчатки ×${opts.gloves}`, price: GLOVES_PRICE * opts.gloves }); total += GLOVES_PRICE * opts.gloves; }
  if (opts.net) { items.push({ name: "Сетка", price: NET_PRICE }); total += NET_PRICE; }
  if (opts.backpack) { items.push({ name: "Рюкзак", price: BACKPACK_PRICE }); total += BACKPACK_PRICE; }
  if (opts.bag) { items.push({ name: "Сумка", price: BAG_PRICE }); total += BAG_PRICE; }
  if (opts.charger) { items.push({ name: "Зарядка (бесплатно)", price: 0 }); }
  if (opts.jacket) { items.push({ name: "Куртка", price: JACKET_PRICE }); total += JACKET_PRICE; }
  if (opts.boots) { items.push({ name: "Боты", price: BOOTS_PRICE }); total += BOOTS_PRICE; }
  return { items, total };
}

// ─── COMMAND: quote ──────────────────────────────────────────────────────────

async function cmdQuote() {
  const bikeQuery = arg("bike") || arg("bikeId") || positional[0];
  if (!bikeQuery) fail({ stage: "quote", reason: "missing_bike", details: { expected: "--bike \"MT-07\" or --bikeId falcon-gt-2025" } });

  const days = parseInt(arg("days") || "0", 10);
  const hours = parseInt(arg("hours") || "0", 10);
  if (days === 0 && hours === 0) fail({ stage: "quote", reason: "missing_duration", details: { expected: "--days 3 or --hours 5" } });

  const bike = await findBike(bikeQuery);
  if (!bike) fail({ stage: "quote", reason: "bike_not_found", details: { query: bikeQuery, hint: "Use list-prices to see available bikes" } });

  const dailyPrice = Number(bike.daily_price) || 0;
  if (dailyPrice <= 0) fail({ stage: "quote", reason: "no_price", details: { bikeId: bike.id, hint: "Bike has no daily_price set" } });

  const startDate = arg("from") || null;
  const specs = bike.specs || {};
  const pricing = calculatePrice(dailyPrice, days, hours, specs, startDate);
  const equipment = calculateEquipment({
    hours: hours > 0 ? hours : 0,
    helmets: parseInt(arg("helmets") || "0", 10),
    gloves: parseInt(arg("gloves") || "0", 10),
    net: hasFlag("net"),
    backpack: hasFlag("backpack"),
    bag: hasFlag("bag"),
    charger: hasFlag("charger"),
    jacket: hasFlag("jacket"),
    boots: hasFlag("boots"),
  });

  const grandTotal = pricing.base + equipment.total;
  const deposit = Number(specs.deposit_rub || specs.deposit || 20000);

  done({
    ok: true,
    stage: "quote",
    bike: {
      id: bike.id,
      title: `${bike.make || ""} ${bike.model || ""}`.trim(),
      type: bike.type,
    },
    duration: {
      days: pricing.days,
      ...(hours > 0 ? { hours } : {}),
      tier: pricing.tier,
    },
    pricing: {
      dailyPrice: fmtMoney(dailyPrice),
      base: fmtMoney(pricing.base),
      tier: pricing.tier,
      ...(pricing.tierPrice && pricing.tierPrice !== dailyPrice ? { rate: fmtMoney(pricing.tierPrice) } : {}),
    },
    equipment: equipment.items.length > 0 ? {
      items: equipment.items.map((i) => ({ name: i.name, price: fmtMoney(i.price) })),
      total: fmtMoney(equipment.total),
    } : null,
    deposit: fmtMoney(deposit),
    grandTotal: fmtMoney(grandTotal),
    grandTotalWithDeposit: fmtMoney(grandTotal + deposit),
    summary: `${bike.make} ${bike.model} — ${pricing.tier} — ${fmtMoney(grandTotal)}${deposit > 0 ? ` + депозит ${fmtMoney(deposit)}` : ""}`,
  });
}

// ─── COMMAND: deposit ────────────────────────────────────────────────────────

async function cmdDeposit() {
  const bikeQuery = arg("bike") || arg("bikeId") || positional[0];
  if (!bikeQuery) fail({ stage: "deposit", reason: "missing_bike" });

  const bike = await findBike(bikeQuery);
  if (!bike) fail({ stage: "deposit", reason: "bike_not_found", details: { query: bikeQuery } });

  const specs = bike.specs || {};
  const deposit = Number(specs.deposit_rub || specs.deposit || 20000);

  done({
    ok: true,
    stage: "deposit",
    bike: { id: bike.id, title: `${bike.make || ""} ${bike.model || ""}`.trim() },
    deposit: fmtMoney(deposit),
    depositRub: deposit,
  });
}

// ─── COMMAND: tiers ──────────────────────────────────────────────────────────

async function cmdTiers() {
  const bikeQuery = arg("bike") || arg("bikeId") || positional[0];
  if (!bikeQuery) fail({ stage: "tiers", reason: "missing_bike" });

  const bike = await findBike(bikeQuery);
  if (!bike) fail({ stage: "tiers", reason: "bike_not_found", details: { query: bikeQuery } });

  const dailyPrice = Number(bike.daily_price) || 0;
  if (dailyPrice <= 0) fail({ stage: "tiers", reason: "no_price" });

  // Mirror the web tier model: read tier rates from specs, fallback to daily_price
  const specs = bike.specs || {};
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : undefined; };
  const perHour = num(specs.price_per_hour) ?? dailyPrice;
  const tiers = [
    { duration: "2 часа", price: num(specs.price_per_2h) ?? Math.round(perHour * 2), note: num(specs.price_per_2h) ? "тариф 2ч" : "≈ почасовая × 2" },
    { duration: "3 часа", price: num(specs.price_per_3h) ?? Math.round(perHour * 3), note: num(specs.price_per_3h) ? "тариф 3ч" : "≈ почасовая × 3" },
    { duration: "1 день", price: num(specs.rent_weekday) ?? dailyPrice, note: num(specs.rent_weekday) && num(specs.rent_weekday) < dailyPrice ? "будни" : "" },
    { duration: "2-4 дня (за день)", price: num(specs.rent_2_4d) ?? dailyPrice, note: num(specs.rent_2_4d) ? "тариф, × дни" : "нет тарифа — дневная" },
    { duration: "5-10 дней (за день)", price: num(specs.rent_5_10d) ?? dailyPrice, note: num(specs.rent_5_10d) ? "тариф, × дни" : "нет тарифа — дневная" },
    { duration: "11-30 дней (за день)", price: num(specs.rent_11_30d) ?? dailyPrice, note: num(specs.rent_11_30d) ? "тариф, × дни" : "нет тарифа — дневная" },
  ];

  done({
    ok: true,
    stage: "tiers",
    bike: { id: bike.id, title: `${bike.make || ""} ${bike.model || ""}`.trim() },
    dailyPrice: fmtMoney(dailyPrice),
    tiers: tiers.map((t) => ({ ...t, price: fmtMoney(t.price) })),
  });
}

// ─── COMMAND: list-prices ────────────────────────────────────────────────────

async function cmdListPrices() {
  const { data, error } = await supabase
    .from("cars")
    .select("id, make, model, type, daily_price, specs")
    .eq("crew_id", CREW_ID)
    .in("type", ["bike", "scooter", "car"])
    .order("daily_price", { ascending: false });

  if (error) fail({ stage: "list_prices", reason: "db_error", details: { message: error.message } });

  const bikes = (data || []).map((b) => ({
    id: b.id,
    title: `${b.make || ""} ${b.model || ""}`.trim(),
    type: b.type,
    dailyPrice: fmtMoney(b.daily_price),
    deposit: fmtMoney((b.specs || {}).deposit_rub || (b.specs || {}).deposit || 20000),
  }));

  done({ ok: true, stage: "list_prices", count: bikes.length, bikes });
}

// ─── Router ──────────────────────────────────────────────────────────────────

async function main() {
  switch (command) {
    case "quote": return await cmdQuote();
    case "deposit": return await cmdDeposit();
    case "tiers": return await cmdTiers();
    case "list-prices": return await cmdListPrices();
    default:
      fail({ stage: "router", reason: "unknown_command", details: { command, available: ["quote", "deposit", "tiers", "list-prices"] } });
  }
}

main().catch((e) => fail({ stage: "unhandled", reason: "exception", details: { message: e.message } }));
