// task69-reports.mjs — September 2026 «Мотопарк» reports for three bikes,
// generated through the repo's OWN builder (exact button parity) and
// CROSS-CHECKED against an INDEPENDENT reimplementation of the money canon
// (no repo money imports — fresh math, so a builder bug cannot hide).
//
// Bikes (boss 2026-10-04): kawasaki-ex650k (partner 425137783 @K0r_Al),
// ducati-1199-panigale-2012 (owner-run, no partner),
// ducati-panigale-s-electro-black-aero (partner 1090242359 @golybev_v).
//
// Run: cd /home/z/cartest && bun scripts/task69-reports.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const sb = createClient("https://inmctohsodgdohamhzag.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const MONTH = "2026-09";
const NOW = Date.now();

// ── independent money math (reimplemented from the owner canon) ──────────────
const UNIT = { helmets: 1000, gloves: 500, jacket: 500, pants: 500, boots: 500, net: 500, bag: 500, backpack: 500, charger: 0 };
const UNIT_FALLBACK = 500;

function durUnit(base, startIso, endIso) {
  if (!(base > 0)) return 0;
  const s = Date.parse(startIso || ""), e = Date.parse(endIso || "");
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return base; // broken window → flat
  const hours = (e - s) / 36e5;
  if (hours < 24) return Math.round(base / 2);
  const days = Math.max(1, Math.ceil(hours / 24));
  return base + Math.round(base / 2) * (days - 1);
}

function gearEstimate(metadata, startIso, endIso) {
  const eq = metadata?.equipment;
  if (!eq || typeof eq !== "object" || Array.isArray(eq)) return 0;
  let total = 0;
  for (const [k, v] of Object.entries(eq)) {
    if (k.endsWith("_gift")) continue;
    if (eq[`${k}_gift`] === true) continue;
    const unit = durUnit(UNIT[k] ?? UNIT_FALLBACK, startIso, endIso);
    const qty = typeof v === "number" && v > 0 ? v : v === true ? 1 : 0;
    total += unit * qty;
  }
  return total;
}

function effStatus(status, endIso) {
  if ((status === "active" || status === "confirmed") && endIso) {
    const end = Date.parse(endIso);
    if (!Number.isNaN(end) && end + 24 * 36e5 < NOW) return "expired";
  }
  return status ?? "unknown";
}

function mskMonth(iso) {
  const t = Date.parse(iso || "");
  const d = new Date((Number.isNaN(t) ? NOW : t) + 3 * 36e5);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function rowMoney(r, specsChat, pct) {
  const m = r.metadata ?? {};
  const start = r.agreed_start_date || r.requested_start_date || r.created_at;
  const end = r.agreed_end_date || r.requested_end_date || null;
  const eff = effStatus(r.status, r.agreed_end_date || r.requested_end_date);
  const isMirror = m.item_type === "equipment" && (typeof m.primary_rental_id === "string" ? m.primary_rental_id.trim() !== "" : typeof m.primary_rental_id === "number");
  const total = Math.max(0, Math.round(Number(r.total_cost) || 0));
  let gear = 0, source = "stored";
  if (isMirror) { gear = 0; source = "mirror"; }
  else if (m.item_type === "equipment") { gear = total; source = "equipment_total"; }
  else if (m.equipment_price != null && Number.isFinite(Number(m.equipment_price))) gear = Math.min(Math.round(Number(m.equipment_price)), total);
  else { gear = Math.min(gearEstimate(m, start, end), total); source = "estimated"; }
  const bike = total - gear;
  const chatSnap = typeof m.subrenter_chat_id === "string" ? m.subrenter_chat_id.trim() : "";
  const chat = chatSnap || specsChat || null;
  const earns = (eff === "completed" || eff === "active") && !isMirror;
  const partner = earns && chat && bike > 0 ? Math.round((bike * pct) / 100) : 0;
  return { total, bike, gear, source, partner, earns, eff, start, end, isMirror };
}

// ── data loading ─────────────────────────────────────────────────────────────
const { data: carRows } = await sb.from("cars").select("id, make, model, specs").in("id", [
  "kawasaki-ex650k",
  "ducati-1199-panigale-2012",
  "ducati-panigale-s-electro-black-aero",
]);
const { data: crew } = await sb.from("crews").select("name, slug").eq("slug", "vip-bike").maybeSingle();
const CREW_NAME = crew?.name ?? "VIP_BIKE";
const CREW_SLUG = crew?.slug ?? "vip-bike";

// contract pct (same chain as resolveSubrenterSharePct: latest artifact wins)
let PCT = 50;
try {
  const { data: art } = await sb.schema("private").from("subrent_contract_artifacts")
    .select("owner_percentage").eq("crew_id", CREW_SLUG).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const stored = Number(art?.owner_percentage);
  if (Number.isFinite(stored) && stored >= 1 && stored <= 99) PCT = Math.round(stored);
} catch { /* default 50 */ }

const { data: allUsers } = await sb.from("users").select("user_id, full_name, username");
const usersById = new Map((allUsers ?? []).map((u) => [String(u.user_id), u]));

function clientName(r) {
  const u = r.user_id ? usersById.get(String(r.user_id)) : null;
  const full = (u?.full_name || "").trim();
  if (full) return full;
  const un = (u?.username || "").trim();
  if (un) return `@${un}`;
  return (typeof r.metadata?.renter_name === "string" && r.metadata.renter_name.trim()) || null;
}

function fmt(n) { return `${Math.round(n).toLocaleString("ru-RU").replace(/\u00A0/g, " ")} ₽`; }

const BIKES = [
  { id: "kawasaki-ex650k", partnerChat: "425137783", partnerLabel: "Александр Корнилов · @K0r_Al · TG 425137783", accent: "#6cd44a", accentDark: "#3f9e2a" },
  { id: "ducati-1199-panigale-2012", partnerChat: null, partnerLabel: null, accent: "#ef4444", accentDark: "#b91c1c" },
  { id: "ducati-panigale-s-electro-black-aero", partnerChat: "1090242359", partnerLabel: "Валерий Голубев · @golybev_v · TG 1090242359", accent: "#f59e0b", accentDark: "#c2740a" },
];

const results = [];

for (const bike of BIKES) {
  const car = carRows.find((c) => c.id === bike.id);
  const specsChat = typeof car?.specs?.subrenter_chat_id === "string" ? car.specs.subrenter_chat_id.trim() : null;
  const pct = bike.partnerChat ? PCT : 0;

  const { data: rentals } = await sb.from("rentals")
    .select("rental_id,status,payment_status,total_cost,agreed_start_date,agreed_end_date,requested_start_date,requested_end_date,created_at,user_id,metadata")
    .eq("vehicle_id", bike.id)
    .order("created_at", { ascending: true });

  const rows = (rentals ?? []).map((r) => ({ ...r, metadata: r.metadata ?? null }));

  // ── real builder (button parity) ──
  const builderRows = rows.map((r) => ({
    rentalId: String(r.rental_id),
    status: r.status ?? null,
    paymentStatus: r.payment_status ?? null,
    totalCost: r.total_cost == null ? null : Number(r.total_cost),
    agreedStart: r.agreed_start_date ?? null,
    agreedEnd: r.agreed_end_date ?? null,
    requestedStart: r.requested_start_date ?? null,
    requestedEnd: r.requested_end_date ?? null,
    createdAt: r.created_at ?? null,
    clientName: clientName(r),
    metadata: r.metadata ?? null,
  }));
  const { buildBikeRentalsReport } = await import("../app/franchize/lib/bike-rentals-report.ts");
  const { markdown, filename } = buildBikeRentalsReport({
    bikeLabel: `${car?.make || ""} ${car?.model || ""}`.trim() || bike.id,
    bikeId: bike.id,
    crewName: CREW_NAME,
    rentals: builderRows,
    month: MONTH,
    subrent: bike.partnerChat ? { chatId: bike.partnerChat, pct } : null,
    nowMs: NOW,
  });

  // ── independent math ──
  const sep = rows
    .map((r) => ({ r, m: rowMoney(r, specsChat, pct), month: mskMonth(r.agreed_start_date || r.requested_start_date || r.created_at) }))
    .filter((x) => x.month === MONTH)
    .sort((a, b) => (Date.parse(a.m.start || a.r.created_at || "") || 0) - (Date.parse(b.m.start || b.r.created_at || "") || 0));

  let revenue = 0, revCount = 0, bikeSum = 0, gearSum = 0, partnerSum = 0;
  for (const { m } of sep) {
    if (!m.earns || m.total <= 0) continue;
    revenue += m.total; revCount++;
    bikeSum += m.bike; gearSum += m.gear; partnerSum += m.partner;
  }
  const avg = revCount ? Math.floor(revenue / revCount) : 0;

  // ── verify: parse the md and compare with independent math ──
  const money = (s) => { const m = /([\d\s\u00A0]+)\s*₽/.exec(s); return m ? Number(m[1].replace(/[\s\u00A0]/g, "")) : null; };
  const sumLine = (label) => {
    const re = new RegExp(`${label}[^*]*\\*\\*([^*]+)\\*\\*`);
    const m = re.exec(markdown);
    if (!m) return null;
    return money(m[1]);
  };
  const mdRevenue = sumLine("Выручка");
  const mdBike = sumLine("в т\\.ч\\. аренда мото");
  const mdGear = sumLine("в т\\.ч\\. экипировка");
  const mdPartner = bike.partnerChat ? sumLine("Итого партнёру") : 0;
  const mdAvg = sumLine("Средний чек");

  const tableRows = markdown.split("\n").filter((l) => l.startsWith("|") && /\d/.test(l) && !l.includes("#") && !l.includes("---"));
  const sepCount = tableRows.length;

  const asserts = [];
  const ok = (name, cond, detail) => asserts.push({ name, ok: !!cond, detail });

  ok(`${bike.id}: revenue`, mdRevenue === revenue, `md ${mdRevenue} vs indep ${revenue}`);
  ok(`${bike.id}: bike part`, mdBike === bikeSum, `md ${mdBike} vs indep ${bikeSum}`);
  ok(`${bike.id}: gear part`, mdGear === gearSum, `md ${mdGear} vs indep ${gearSum}`);
  ok(`${bike.id}: avg check`, mdAvg === avg, `md ${mdAvg} vs indep ${avg}`);
  ok(`${bike.id}: scoped rows`, sepCount === sep.length, `md ${sepCount} vs indep ${sep.length}`);
  if (bike.partnerChat) ok(`${bike.id}: partner payout`, mdPartner === partnerSum, `md ${mdPartner} vs indep ${partnerSum}`);

  // per-row check: table cells vs independent per-row numbers
  let rowIdx = 0;
  for (const { m, r } of sep) {
    rowIdx++;
    const line = tableRows[rowIdx - 1];
    const cells = line.split("|").map((c) => c.trim());
    // cells: '' #, dates, dur, client, status, pay, мот, экип, итого, [партнёр], создана, ''
    const mCell = cells[7], gCell = cells[8], tCell = cells[9], pCell = bike.partnerChat ? cells[10] : null;
    const mVal = money(mCell), gVal = money(gCell), tVal = money(tCell), pVal = pCell ? money(pCell) : null;
    ok(`${bike.id} r${rowIdx} мото`, (mVal ?? 0) === m.bike, `${mCell} vs ${m.bike}`);
    ok(`${bike.id} r${rowIdx} экип`, (gVal ?? 0) === m.gear, `${gCell} vs ${m.gear}`);
    if (!m.isMirror) ok(`${bike.id} r${rowIdx} итого`, (tVal ?? 0) === m.total, `${tCell} vs ${m.total}`);
    ok(`${bike.id} r${rowIdx} inv bike+gear=total`, m.bike + m.gear === m.total, `${m.bike}+${m.gear}!=${m.total}`);
    if (bike.partnerChat) ok(`${bike.id} r${rowIdx} партнёр`, (pVal ?? 0) === m.partner, `${pCell} vs ${m.partner}`);
  }

  results.push({
    bike: bike.id,
    label: `${car?.make || ""} ${car?.model || ""}`.trim() || bike.id,
    accent: bike.accent, accentDark: bike.accentDark,
    partnerChat: bike.partnerChat, partnerLabel: bike.partnerLabel, pct,
    filename, markdown,
    indep: {
      revenue, revCount, bikeSum, gearSum, partnerSum, avg,
      rowsCount: sep.length,
      allTimeRevenue: rows.filter((r) => (effStatus(r.status, r.agreed_end_date || r.requested_end_date) === "completed") && (r.metadata?.item_type !== "equipment" || false) && Number(r.total_cost) > 0).reduce((a, r) => a + Number(r.total_cost), 0),
      allTimeCount: rows.length,
    },
    rows: sep.map(({ r, m }) => ({
      dates: `${r.agreed_start_date || r.requested_start_date || r.created_at}`,
      end: r.agreed_end_date || r.requested_end_date || null,
      client: clientName(r),
      status: m.eff, payment: r.payment_status,
      bike: m.bike, gear: m.gear, total: m.total, partner: m.partner,
      estimated: m.source === "estimated" && m.gear > 0,
      mirror: m.isMirror,
      createdAt: r.created_at,
    })),
    asserts,
  });

  console.log(`\n━━━ ${bike.id} ━━━`);
  console.log(`revenue ${fmt(revenue)} = мото ${fmt(bikeSum)} + экип ${fmt(gearSum)}; partner ${fmt(partnerSum)} (${pct}% от мото); avg ${fmt(avg)}; rows ${sep.length} (earning ${revCount})`);
  console.log(`md → ${filename}`);
  const fails = asserts.filter((a) => !a.ok);
  console.log(fails.length ? `✗ FAILS: ${fails.length}` : `✓ ${asserts.length}/${asserts.length} asserts`);
  for (const f of fails) console.log(`  ✗ ${f.name}: ${f.detail}`);
}

mkdirSync("/home/z/my-project/download", { recursive: true });
const dump = { month: MONTH, pct: PCT, generatedAt: new Date(NOW).toISOString(), results };
writeFileSync("/tmp/task69-computed.json", JSON.stringify(dump, null, 2), "utf8");

for (const r of results) {
  writeFileSync(`/home/z/my-project/download/${r.filename}`, r.markdown, "utf8");
  console.log(`WROTE /home/z/my-project/download/${r.filename}`);
}
const totalFails = results.flatMap((r) => r.asserts).filter((a) => !a.ok);
console.log(`\n${totalFails.length === 0 ? "ALL GREEN" : "FAILURES PRESENT"} (${results.flatMap((r) => r.asserts).length} asserts total)`);
if (totalFails.length) process.exit(1);
