// scripts/task166-feature-tour-menu-flags.mjs — task166 seed: crews.metadata.feature_tour
// flags now CONTROL the header burger menu (boss: «i want this flags to control
// the list of links in header menu (configured in crew metadata;)»).
//
// Crews whose configured menus contain crew-scoped tour-feature routes must
// keep them visible exactly as today — their flags are seeded ALL-TRUE (merge
// into metadata, re-read before write, never overwriting the rest of the
// config). Fresh crews (moto-selection etc.) stay untouched: unset flags →
// their menu starts minimal and GROWS through the onboarding quest's
// activation checkboxes / paid ⭐ activations.
//
// Idempotent: re-running is a no-op. Dry-run by default; `--apply` to write.

const SUPABASE_URL = process.env.SUPABASE_URL || "https://inmctohsodgdohamhzag.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes("--apply");

// The full TOUR_FEATURE_KEYS set (components/roman-gift/tourFeatures.ts) —
// mirrored here because the script runs standalone. The two free/global keys
// (landing, storefront, discovery, leaderboard, garage) are included too:
// flag=true on them changes nothing (they are exempt from menu filtering)
// but keeps the quest's owner panel showing «everything on» for vip-bike.
const ALL_FEATURE_KEYS = [
  "landing",
  "storefront",
  "configurator",
  "electro_enduro",
  "wheel",
  "discovery",
  "leaderboard",
  "garage",
  "bikes",
  "cart",
  "profile",
  "price_calc",
  "map_riders",
  "community",
  "sales",
  "about",
  "contacts",
  "onboarding",
  "season_stats",
];

// Crews whose CURRENT configured menu contains feature-route links — seeding
// all-true preserves today's golden-standard menus under the new rule.
const CREW_SLUGS = ["vip-bike", "sly13", "svarprofi"];

if (!KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is required (env)");
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

const res = await fetch(
  `${SUPABASE_URL}/rest/v1/crews?select=id,slug,metadata&slug=in.(${CREW_SLUGS.map((s) => `"${s}"`).join(",")})`,
  { headers },
);
if (!res.ok) {
  console.error("HTTP", res.status, (await res.text()).slice(0, 400));
  process.exit(1);
}
const crews = await res.json();

for (const crew of crews) {
  const meta = crew.metadata || {};
  const existing = (meta.feature_tour && typeof meta.feature_tour === "object") ? meta.feature_tour : {};
  const missing = ALL_FEATURE_KEYS.filter((k) => existing[k] !== true);
  const already = ALL_FEATURE_KEYS.length - missing.length;
  if (missing.length === 0) {
    console.log(`✓ ${crew.slug}: all ${ALL_FEATURE_KEYS.length} flags already true — no-op`);
    continue;
  }
  const nextFlags = { ...existing };
  for (const k of missing) nextFlags[k] = true;
  const merged = { ...meta, feature_tour: nextFlags };
  console.log(`→ ${crew.slug}: ${already}/${ALL_FEATURE_KEYS.length} true, seeding ${missing.length} missing (${missing.join(", ")})`);
  if (!APPLY) continue;
  const upd = await fetch(
    `${SUPABASE_URL}/rest/v1/crews?id=eq.${crew.id}`,
    { method: "PATCH", headers, body: JSON.stringify({ metadata: merged }) },
  );
  if (!upd.ok) {
    console.error(`  ✗ write failed: HTTP ${upd.status}`, (await upd.text()).slice(0, 300));
  } else {
    // Verify with a re-read (merge sanity).
    const check = await fetch(`${SUPABASE_URL}/rest/v1/crews?select=metadata&id=eq.${crew.id}`, { headers });
    const [row] = await check.json();
    const flags = row?.metadata?.feature_tour || {};
    const ok = ALL_FEATURE_KEYS.every((k) => flags[k] === true);
    const menuStillThere = Array.isArray(row?.metadata?.franchize?.header?.menuLinks);
    console.log(`  ✓ written; verify all-true=${ok}; menuLinks intact=${menuStillThere}`);
  }
}

if (!APPLY) console.log("\nDRY RUN — re-run with --apply to write.");
