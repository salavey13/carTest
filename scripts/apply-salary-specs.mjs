#!/usr/bin/env node
// iter6: write salary classification into cars.specs.salary (jsonb) for the
// vip-bike crew, and official rates into crews.metadata.franchize.salaryCoefficients.
// NO table schema changes — pure data updates (owner's instruction).
//
// Rules (owner, 2026-08-26):
//   • tier by price: premium >= 14000/day, regular >= 7000, budget < 7000
//   • subrented: ONLY ducati-panigale-s-electro-black-aero, yamaha-r7, suzuki-gsx-s1000f
//   • rentalCategory = subrented ? partner_<tier> : <tier>
//   • saleCategory  = budget→enduro_moped, regular→regular, premium→premium
//
// Usage: node scripts/apply-salary-specs.mjs          # dry-run
//        node scripts/apply-salary-specs.mjs --apply  # write to Supabase

import { readFileSync } from "fs";

const env = {};
for (const line of readFileSync("/home/z/my-project/cartest/upload/secrets.txt", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes("--apply");

const CREW_SLUG = "vip-bike";
const PREMIUM_THRESHOLD = 14000;
const REGULAR_THRESHOLD = 7000;
const SUBRENTED = new Set([
  "ducati-panigale-s-electro-black-aero",
  "yamaha-r7",
  "suzuki-gsx-s1000f",
]);

const OFFICIAL_CONFIG = {
  rental: { budget: 750, regular: 1000, partner_regular: 500, premium: 1500, partner_premium: 750 },
  equipmentRentalUnit: 200,
  sale: { enduro_moped: 5000, regular: 10000, premium: 15000 },
  equipmentSale: { helmet: 500, balaclava: 100, jacket: 500, pants: 500, gloves: 200 },
  overpricePercent: 10,
};

const headers = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json" };

function tierFor(price) {
  if (!Number.isFinite(price) || price <= 0) return "budget";
  if (price >= PREMIUM_THRESHOLD) return "premium";
  if (price >= REGULAR_THRESHOLD) return "regular";
  return "budget";
}
function saleFor(tier) {
  return tier === "premium" ? "premium" : tier === "regular" ? "regular" : "enduro_moped";
}

async function main() {
  // 1. Resolve crew
  const crewResp = await fetch(`${SUPA_URL}/rest/v1/crews?select=id,slug,metadata&slug=eq.${CREW_SLUG}`, { headers });
  if (!crewResp.ok) throw new Error(`crew query HTTP ${crewResp.status}`);
  const crews = await crewResp.json();
  const crew = crews[0];
  if (!crew) throw new Error(`crew ${CREW_SLUG} not found`);
  console.log(`Crew: ${crew.slug} (${crew.id})`);

  // 2. Fetch rentable bikes (specs.rent present)
  const carsResp = await fetch(`${SUPA_URL}/rest/v1/cars?select=id,make,model,daily_price,specs&crew_id=eq.${crew.id}&order=daily_price.desc`, { headers });
  if (!carsResp.ok) throw new Error(`cars query HTTP ${carsResp.status}`);
  const cars = await carsResp.json();
  const bikes = cars.filter((c) => c.specs && typeof c.specs === "object" && !Array.isArray(c.specs) && c.specs.rent !== undefined);
  console.log(`Rentable bikes: ${bikes.length}\n`);

  // 3. Compute + report
  const now = new Date().toISOString();
  const updates = [];
  for (const b of bikes) {
    const price = Number(b.daily_price) || 0;
    const tier = tierFor(price);
    const subrented = SUBRENTED.has(b.id);
    const rentalCategory = subrented ? `partner_${tier}` : tier;
    const saleCategory = saleFor(tier);
    const specs = { ...b.specs };
    specs.salary = { tier, subrented, rentalCategory, saleCategory, dailyPriceAtSet: price, setAt: now };
    updates.push({ id: b.id, name: `${b.make} ${b.model}`.trim(), price, tier, subrented, rentalCategory, saleCategory, specs });
    console.log(
      `${String(price).padStart(6)}/д  ${b.id.padEnd(44)} ${tier.padEnd(8)} ${subrented ? "субаренда" : "своя      "} → ${rentalCategory} / ${saleCategory}`
    );
  }

  // 4. Crew metadata (read-merge-write)
  const metadata = crew.metadata && typeof crew.metadata === "object" ? crew.metadata : {};
  const franchize = metadata.franchize && typeof metadata.franchize === "object" ? { ...metadata.franchize } : {};
  franchize.salaryCoefficients = {
    ...OFFICIAL_CONFIG,
    priceThresholds: { premiumThreshold: PREMIUM_THRESHOLD, regularThreshold: REGULAR_THRESHOLD },
    updatedAt: now,
  };
  metadata.franchize = franchize;

  console.log(`\nCrew metadata.franchize.salaryCoefficients:`);
  console.log(JSON.stringify(franchize.salaryCoefficients, null, 2));

  if (!APPLY) {
    console.log("\nDRY RUN — no changes written. Re-run with --apply to write to Supabase.");
    return;
  }

  // 5. Apply bike specs updates
  let ok = 0, fail = 0;
  for (const u of updates) {
    const resp = await fetch(`${SUPA_URL}/rest/v1/cars?id=eq.${encodeURIComponent(u.id)}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ specs: u.specs }),
    });
    if (resp.ok) ok++;
    else {
      fail++;
      console.error(`FAIL ${u.id}: HTTP ${resp.status} ${await resp.text()}`);
    }
  }
  console.log(`\nBikes updated: ${ok}, failed: ${fail}`);

  // 6. Apply crew metadata
  const crewPatch = await fetch(`${SUPA_URL}/rest/v1/crews?id=eq.${crew.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ metadata, updated_at: now }),
  });
  console.log(`Crew metadata update: HTTP ${crewPatch.status} ${crewPatch.ok ? "OK" : await crewPatch.text()}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
