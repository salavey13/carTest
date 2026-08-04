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
const HELMET_PRICE = 1000;     // ₽ per rental
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

// ─── Pricing logic (mirrors pricing-calculator.ts) ──────────────────────────

function calculatePrice(dailyPrice, days, hours) {
  if (hours && hours > 0) {
    // Hourly pricing: up to 3h = daily price, then +daily per day
    if (hours <= 3) return { base: dailyPrice, tier: "/ 3 часа", tierPrice: 0, hours, days: 1 };
    const extraDays = Math.ceil((hours - 3) / 24);
    const total = dailyPrice * (1 + extraDays);
    return { base: total, tier: `${hours} часов`, tierPrice: 0, hours, days: 1 + extraDays };
  }
  // Daily pricing
  const base = dailyPrice * days;
  // Volume discount: 7+ days = 10% off, 14+ days = 15% off
  let discount = 0;
  if (days >= 14) discount = 0.15;
  else if (days >= 7) discount = 0.10;
  const discounted = Math.round(base * (1 - discount));
  return { base: discounted, tier: days >= 14 ? "14+ дней (-15%)" : days >= 7 ? "7+ дней (-10%)" : `${days} дн.`, tierPrice: 0, days };
}

function calculateEquipment(opts) {
  const items = [];
  let total = 0;
  if (opts.helmets && opts.helmets > 0) { items.push({ name: `Шлем ×${opts.helmets}`, price: HELMET_PRICE * opts.helmets }); total += HELMET_PRICE * opts.helmets; }
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

  const pricing = calculatePrice(dailyPrice, days, hours);
  const equipment = calculateEquipment({
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
  const specs = bike.specs || {};
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
      ...(pricing.tier.includes("-") ? { discount: pricing.tier } : {}),
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

  const tiers = [
    { duration: "3 часа", price: dailyPrice, note: "базовая ставка" },
    { duration: "1 день", price: dailyPrice, note: "" },
    { duration: "3 дня", price: dailyPrice * 3, note: "" },
    { duration: "7 дней", price: Math.round(dailyPrice * 7 * 0.9), note: "-10%" },
    { duration: "14 дней", price: Math.round(dailyPrice * 14 * 0.85), note: "-15%" },
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
