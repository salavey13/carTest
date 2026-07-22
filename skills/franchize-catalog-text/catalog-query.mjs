#!/usr/bin/env node
// catalog-query.mjs — Text-based bike catalog for VIP Bike.
//
// Queries Supabase REST API directly (no Node server, no supabase-js dep),
// reads the `cars` table for crew=vip-bike bikes + scooters, plus `rentals`
// for availability checks, and prints formatted text tables.
//
// Sibling of `leads-query.mjs`. Same conventions:
//   - default secrets path: /home/z/my-project/upload/secrets.txt
//   - hardcoded crew: vip-bike (CREW_SLUG, CREW_ID)
//   - all output → stdout; errors → stderr with exit code 2
//   - read-only (no INSERT / UPDATE / DELETE anywhere)
//
// Usage:
//   node catalog-query.mjs list-bikes
//   node catalog-query.mjs list-bikes --type scooter
//   node catalog-query.mjs list-bikes --type all
//   node catalog-query.mjs bike-detail <bikeId>
//   node catalog-query.mjs bike-pricing <bikeId>
//   node catalog-query.mjs check-availability <bikeId>
//   node catalog-query.mjs check-availability <bikeId> --date 2026-07-25
//
// Env:
//   SUPABASE_URL                (default: https://inmctohsodgdohamhzag.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY   (fallback: read from --secrets=<path> or
//                                /home/z/my-project/upload/secrets.txt)

import { readFileSync } from "node:fs";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SUPA_URL = "https://inmctohsodgdohamhzag.supabase.co";
const DEFAULT_SECRETS_PATH = "/home/z/my-project/upload/secrets.txt";

const CREW_SLUG = "vip-bike";
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";

// Known `type` values stored on the `cars` table for vip-bike.
// `bike` → motorcycles / electric dirt bikes / mopeds that go in the bike list.
// `scooter` → stand-up scooters / e-scooters.
// Pass `all` to disable the type filter entirely.
const KNOWN_TYPES = new Set(["bike", "scooter", "car", "all"]);

// Rental statuses that block a bike on a given day.
// `pending_confirmation` is intentionally excluded — the rental hasn't been
// agreed yet, so the bike is still bookable by another customer.
const BLOCKING_RENTAL_STATUSES = ["active", "confirmed"];

// Pricing tiers pulled from `specs` jsonb. Order matters for the pricing table.
const PRICING_TIERS = [
  { key: "rent_weekday",  label: "Будни (1 день)",       unit: "₽/день" },
  { key: "rent_weekend",  label: "Выходной (1 день)",    unit: "₽/день" },
  { key: "rent_2_4d",     label: "2–4 дня",              unit: "₽/день" },
  { key: "rent_5_10d",    label: "5–10 дней",            unit: "₽/день" },
  { key: "rent_11_30d",   label: "11–30 дней",           unit: "₽/день" },
  { key: "deposit_rub",   label: "Залог",                unit: "₽" },
];

// Specs keys considered "key specs" for the compact list-bikes table.
const KEY_SPEC_KEYS = ["color", "year", "engine", "power_kw", "battery_kwh", "range_km", "weight_kg", "vin"];

// ─── Supabase REST client (uses fetch, no supabase-js dep) ────────────────────

let _supaUrl = null;
let _supaKey = null;

function readSecretsFile(path) {
  try {
    const txt = readFileSync(path, "utf-8");
    const m = txt.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

function initSupabase(opts = {}) {
  _supaUrl = opts.url || process.env.SUPABASE_URL || DEFAULT_SUPA_URL;
  _supaKey = opts.key
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || readSecretsFile(opts.secretsPath || DEFAULT_SECRETS_PATH);
  if (!_supaKey) {
    console.error("ERROR: SUPABASE_SERVICE_ROLE_KEY not found.");
    console.error("       Set env var, or pass --secrets=<path>, or use default " + DEFAULT_SECRETS_PATH);
    process.exit(2);
  }
}

async function supabaseQuery(table, q = {}, opts = {}) {
  const schema = opts.schema || "public";
  const params = new URLSearchParams();

  if (q.select) params.set("select", q.select);

  if (Array.isArray(q.filters)) {
    for (const f of q.filters) {
      const [key] = f.split("=");
      params.append(key, f.slice(key.length + 1));
    }
  }

  if (q.order)  params.set("order", q.order);
  if (q.limit)  params.set("limit", String(q.limit));

  const url = `${_supaUrl}/rest/v1/${table}?${params.toString()}`;
  const headers = {
    apikey: _supaKey,
    Authorization: `Bearer ${_supaKey}`,
  };
  if (schema === "private") {
    headers["Accept-Profile"] = "private";
    headers["Content-Profile"] = "private";
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${schema}.${table} ${res.status}: ${body.slice(0, 400)}`);
  }
  return res.json();
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtRub(n) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("ru-RU").replace(/,/g, " ") + " ₽";
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toISOString().slice(8, 10) + "." + dt.toISOString().slice(5, 7) + "." + dt.toISOString().slice(0, 4);
}

function truncate(s, n) {
  if (!s) return "";
  s = String(s);
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function padR(s, n) {
  s = String(s ?? "");
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function padL(s, n) {
  s = String(s ?? "");
  return s.length >= n ? s : " ".repeat(n - s.length) + s;
}

function formatTable(rows, widths) {
  if (!rows.length) return "(нет данных)";
  const header = rows[0].map((c, i) => padR(String(c), widths[i])).join("  ");
  const sep = widths.map((w) => "─".repeat(w)).join("  ");
  const body = rows.slice(1).map((r) => r.map((c, i) => padR(String(c ?? ""), widths[i])).join("  ")).join("\n");
  return `${header}\n${sep}\n${body}`;
}

function pickKeySpecs(specs) {
  if (!specs || typeof specs !== "object") return "";
  const parts = [];
  for (const k of KEY_SPEC_KEYS) {
    const v = specs[k];
    if (v != null && v !== "") parts.push(`${k}=${v}`);
  }
  return parts.join(", ");
}

function describeAvailability(rules) {
  if (!rules || typeof rules !== "object") return "по умолчанию (доступен)";
  const parts = [];
  if (rules.available != null) parts.push(rules.available ? "доступен" : "недоступен");
  if (rules.season) parts.push(`сезон: ${rules.season}`);
  if (rules.blackout_dates && Array.isArray(rules.blackout_dates) && rules.blackout_dates.length) {
    parts.push(`blacked-out: ${rules.blackout_dates.length} дн.`);
  }
  if (rules.notice_hours) parts.push(`заявка за ${rules.notice_hours}ч`);
  if (rules.min_rental_days) parts.push(`мин. аренда ${rules.min_rental_days} дн.`);
  if (rules.max_rental_days) parts.push(`макс. аренда ${rules.max_rental_days} дн.`);
  return parts.length ? parts.join(", ") : "по умолчанию (доступен)";
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function cmdListBikes(opts) {
  const type = opts.type || "bike";
  if (!KNOWN_TYPES.has(type)) {
    console.error(`ERROR: invalid type "${type}". Use bike|scooter|all.`);
    process.exit(2);
  }

  const filters = [`crew_id=eq.${CREW_ID}`];
  if (type !== "all") filters.push(`type=eq.${type}`);

  // Skip test-result bikes that were generated by the embedding pipeline.
  filters.push(`is_test_result=eq.false`);

  const rows = await supabaseQuery("cars", {
    select: "id,make,model,daily_price,image_url,specs,availability_rules,quantity,type",
    filters,
    order: "make.asc,model.asc",
    limit: 500,
  });

  const title = `=== Каталог ${CREW_SLUG} (${type === "all" ? "все ТС" : type + "s"}) — ${rows.length} позиций ===`;
  console.log(title);
  if (!rows.length) {
    console.log("Нет ТС в каталоге.");
    return;
  }

  const tableRows = [
    ["ID", "Марка", "Модель", "Цена/день", "Кол-во", "Ключевые спецификации"],
  ];
  for (const r of rows) {
    tableRows.push([
      truncate(r.id, 22),
      truncate(r.make, 16),
      truncate(r.model, 24),
      padL(fmtRub(r.daily_price).replace(" ₽", ""), 10) + " ₽",
      String(r.quantity ?? 1),
      truncate(pickKeySpecs(r.specs), 60),
    ]);
  }
  const widths = [22, 16, 24, 12, 7, 60];
  console.log(formatTable(tableRows, widths));

  console.log("\n— Изображения —");
  for (const r of rows) {
    console.log(`  ${r.id}: ${r.image_url || "(нет)"}`);
  }
}

async function cmdBikeDetail(opts) {
  const bikeId = opts._positional?.[0];
  if (!bikeId) {
    console.error("ERROR: bikeId is required. Usage: bike-detail <bikeId>");
    process.exit(2);
  }

  const rows = await supabaseQuery("cars", {
    select: "id,make,model,description,daily_price,image_url,rent_link,type,crew_id,specs,availability_rules,quantity,owner_id,is_test_result",
    filters: [`id=eq.${bikeId}`],
    limit: 2,
  });

  if (!rows.length) {
    console.error(`ERROR: bike not found: ${bikeId}`);
    process.exit(2);
  }
  if (rows.length > 1) {
    console.error(`WARNING: multiple cars returned for id=${bikeId}, using first`);
  }

  const b = rows[0];

  console.log(`=== Байк: ${b.make} ${b.model} ===`);
  console.log(`ID:               ${b.id}`);
  console.log(`Тип:              ${b.type}`);
  console.log(`Crew:             ${b.crew_id} (${CREW_SLUG})`);
  console.log(`Количество:       ${b.quantity ?? 1}`);
  console.log(`Базовая цена/день: ${fmtRub(b.daily_price)}`);
  console.log(`Is test result:   ${b.is_test_result ? "да" : "нет"}`);
  console.log(`Owner ID:         ${b.owner_id || "—"}`);
  console.log(`Ссылка на аренду: ${b.rent_link || "—"}`);
  console.log(`Изображение:      ${b.image_url || "(нет)"}`);

  console.log("\n— Описание —");
  console.log(b.description || "(нет описания)");

  console.log("\n— Pricing tiers (from specs) —");
  printPricingTable(b.specs);

  console.log("\n— Полные спецификации (specs jsonb) —");
  if (b.specs && Object.keys(b.specs).length) {
    for (const [k, v] of Object.entries(b.specs)) {
      const display = typeof v === "object" ? JSON.stringify(v) : String(v);
      console.log(`  ${padR(k, 20)} ${truncate(display, 80)}`);
    }
  } else {
    console.log("  (пусто)");
  }

  console.log("\n— Правила доступности (availability_rules jsonb) —");
  if (b.availability_rules && Object.keys(b.availability_rules).length) {
    for (const [k, v] of Object.entries(b.availability_rules)) {
      const display = typeof v === "object" ? JSON.stringify(v) : String(v);
      console.log(`  ${padR(k, 20)} ${truncate(display, 80)}`);
    }
  } else {
    console.log("  (пусто — по умолчанию доступен)");
  }
}

function printPricingTable(specs) {
  if (!specs || typeof specs !== "object") {
    console.log("  (specs пусто — нет pricing tiers)");
    return;
  }
  const rows = [["Tier", "Цена", "Единица"]];
  for (const t of PRICING_TIERS) {
    const raw = specs[t.key];
    rows.push([t.label, raw == null || raw === "" ? "—" : fmtRub(raw), t.unit]);
  }
  const widths = [22, 14, 10];
  console.log(formatTable(rows, widths));
}

async function cmdBikePricing(opts) {
  const bikeId = opts._positional?.[0];
  if (!bikeId) {
    console.error("ERROR: bikeId is required. Usage: bike-pricing <bikeId>");
    process.exit(2);
  }

  const rows = await supabaseQuery("cars", {
    select: "id,make,model,daily_price,specs",
    filters: [`id=eq.${bikeId}`],
    limit: 2,
  });

  if (!rows.length) {
    console.error(`ERROR: bike not found: ${bikeId}`);
    process.exit(2);
  }
  const b = rows[0];

  console.log(`=== Pricing: ${b.make} ${b.model} (id: ${b.id}) ===`);
  console.log(`Базовая цена/день (cars.daily_price): ${fmtRub(b.daily_price)}`);
  console.log("");
  console.log("— Tiers from specs jsonb —");
  printPricingTable(b.specs);

  // Pull dailyPrice too if present (sometimes duplicated in specs).
  if (b.specs?.dailyPrice != null) {
    console.log(`\nspecs.dailyPrice: ${fmtRub(b.specs.dailyPrice)}`);
  }
}

async function cmdCheckAvailability(opts) {
  const bikeId = opts._positional?.[0];
  if (!bikeId) {
    console.error("ERROR: bikeId is required. Usage: check-availability <bikeId> [--date YYYY-MM-DD]");
    process.exit(2);
  }

  // Default date = today (UTC).
  const date = opts.date || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error(`ERROR: invalid date "${date}". Use YYYY-MM-DD.`);
    process.exit(2);
  }

  // First verify the bike exists.
  const bikeRows = await supabaseQuery("cars", {
    select: "id,make,model,quantity,availability_rules",
    filters: [`id=eq.${bikeId}`],
    limit: 2,
  });
  if (!bikeRows.length) {
    console.error(`ERROR: bike not found: ${bikeId}`);
    process.exit(2);
  }
  const bike = bikeRows[0];

  // Period overlap: any rental where
  //   vehicle_id = bikeId
  //   status IN (active, confirmed)
  //   requested_start_date <= endOfDay
  //   requested_end_date   >= startOfDay
  const START = `${date}T00:00:00.000Z`;
  const END = `${date}T23:59:59.999Z`;

  const statusFilter = BLOCKING_RENTAL_STATUSES.map((s) => `"${s}"`).join(",");
  const blocking = await supabaseQuery("rentals", {
    select: "rental_id,status,payment_status,requested_start_date,requested_end_date,agreed_start_date,agreed_end_date,user_id,total_cost",
    filters: [
      `vehicle_id=eq.${bikeId}`,
      `status=in.(${statusFilter})`,
      `requested_start_date=lte.${END}`,
      `requested_end_date=gte.${START}`,
    ],
    order: "requested_start_date.asc",
    limit: 100,
  });

  const qty = Number(bike.quantity ?? 1);
  const isAvailable = blocking.length < qty;

  console.log(`=== Доступность байка ${bike.make} ${bike.model} (id: ${bike.id}) ===`);
  console.log(`Дата:                       ${date}`);
  console.log(`Количество в парке:         ${qty}`);
  console.log(`Активных/подтверждённых аренд на эту дату: ${blocking.length}`);
  console.log(`Доступен:                   ${isAvailable ? "✅ ДА" : "❌ НЕТ"}`);
  console.log(`Правила доступности:        ${describeAvailability(bike.availability_rules)}`);

  if (blocking.length) {
    console.log("\n— Блокирующие аренды —");
    const rows = [["rental_id", "status", "payment", "период (requested)", "период (agreed)", "renter"]];
    for (const r of blocking) {
      rows.push([
        truncate(r.rental_id, 36),
        r.status,
        r.payment_status || "—",
        `${fmtDate(r.requested_start_date)} → ${fmtDate(r.requested_end_date)}`,
        r.agreed_start_date ? `${fmtDate(r.agreed_start_date)} → ${fmtDate(r.agreed_end_date)}` : "—",
        truncate(r.user_id, 14),
      ]);
    }
    const widths = [36, 11, 12, 26, 26, 14];
    console.log(formatTable(rows, widths));
  }
}

// ─── Arg parsing ──────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const cmd = argv[0] || "";
  const positional = [];
  const opts = {};
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const eq = key.indexOf("=");
      if (eq > -1) {
        opts[key.slice(0, eq)] = key.slice(eq + 1);
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        opts[key] = argv[++i];
      } else {
        opts[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  opts._positional = positional;
  return { cmd, opts };
}

function printHelp() {
  console.log(`catalog-query.mjs — VIP Bike catalog CLI

Usage:
  node catalog-query.mjs list-bikes [--type bike|scooter|all]
  node catalog-query.mjs bike-detail <bikeId>
  node catalog-query.mjs bike-pricing <bikeId>
  node catalog-query.mjs check-availability <bikeId> [--date YYYY-MM-DD]

Options:
  --type <t>          Filter by vehicle type (default: bike). Use \`all\` to disable filter.
  --date <YYYY-MM-DD> Date for availability check (default: today UTC).
  --secrets <path>    Path to secrets file (default: ${DEFAULT_SECRETS_PATH}).
  --url <url>         Supabase URL (default: ${DEFAULT_SUPA_URL}).
  --key <key>         Supabase service role key (default: from env or secrets file).

Environment:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Crew: ${CREW_SLUG} (${CREW_ID})
`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") {
    printHelp();
    process.exit(0);
  }

  const { cmd, opts } = parseArgs(argv);

  initSupabase({
    url: opts.url,
    key: opts.key,
    secretsPath: opts.secrets,
  });

  try {
    switch (cmd) {
      case "list-bikes":         await cmdListBikes(opts); break;
      case "bike-detail":        await cmdBikeDetail(opts); break;
      case "bike-pricing":       await cmdBikePricing(opts); break;
      case "check-availability": await cmdCheckAvailability(opts); break;
      default:
        console.error(`ERROR: unknown command "${cmd}"`);
        printHelp();
        process.exit(2);
    }
  } catch (err) {
    console.error(`ERROR: ${err.message || err}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(2);
  }
}

main();
