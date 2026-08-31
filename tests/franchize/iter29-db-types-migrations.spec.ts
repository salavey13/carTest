// iter29 — programmatic database.types + migrations restructure + docs cleanup
// + BikeSoul PRD: source guards locking in the iteration's invariants.
//
// What this suite locks in:
//   1. gen:db-types is wired (script + npm alias) and the generated types
//      reflect LIVE truth: rental_photos typed strictly, cars.status does NOT
//      exist (the old hand-typed file lied), cars.is_test_result DOES exist
//      (iter28's open question, resolved), rentals.metadata is Json, and FK
//      relationships exist so supabase-js embedded joins typecheck.
//   2. Product/legacy boundary: franchize product tables strict, sandbox
//      tables and views loose, the manual Functions block preserved across
//      regeneration.
//   3. Migrations apply path is cloner-safe: Paul: syntax bug gone, no junk
//      files, no cron jobs (the leaked-token pair lives in legacy), 160
//      clean files, READMEs explain both folders.
//   4. Docs: legacy archive + plans filed, product README at root, BikeSoul
//      PRD exists with its core invariants (display-only money rule, XP
//      formula, rollout gates).
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(process.cwd());
const TYPES = readFileSync(join(ROOT, "types/database.types.ts"), "utf8");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("iter29: gen:db-types — wired and truthful", () => {
  it("script + npm alias exist", () => {
    expect(existsSync(join(ROOT, "scripts/gen-db-types.mjs"))).toBe(true);
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts["gen:db-types"]).toBe("node scripts/gen-db-types.mjs");
  });

  it("generated file declares itself auto-generated and exports only Database + Json", () => {
    expect(TYPES).toMatch(/AUTO-GENERATED FILE/);
    expect(TYPES).toMatch(/gen:db-types/);
    const exports = [...TYPES.matchAll(/^export (?:type|interface) (\w+)/gm)].map((m) => m[1]);
    expect(exports.sort()).toEqual(["Database", "Json"]);
  });

  it("rental_photos exists with a strict shape (the stale file lacked the table entirely)", () => {
    expect(TYPES).toMatch(/rental_photos: \{\n        Row: \{/);
    expect(TYPES).toMatch(/storage_path: string/);
    expect(TYPES).toMatch(/photo_type: string/);
  });

  it("cars.status does NOT exist — the old hand-typed types lied, live DB has no such column", () => {
    const carsBlock = TYPES.match(/cars: \{\n        Row: \{[\s\S]*?\n        \}/)?.[0] ?? "";
    expect(carsBlock).not.toMatch(/^\s+status: /m);
    expect(carsBlock).toMatch(/is_test_result: boolean \| null/); // iter28's unverified column — now verified
    expect(carsBlock).toMatch(/daily_price: number \| null/);
  });

  it("rentals has Json metadata and FK relationships for embedded joins", () => {
    expect(TYPES).toMatch(/rentals: \{\n        Row: \{/);
    const rentalsBlock = TYPES.match(/^      rentals: \{[\s\S]*?\n      \}/m)?.[0] ?? "";
    expect(rentalsBlock).toMatch(/metadata: Json \| null/);
    expect(rentalsBlock).toMatch(/referencedRelation: "cars"/);
    expect(rentalsBlock).toMatch(/referencedRelation: "users"/);
  });

  it("strict/loose boundary: product tables strict, sandbox tables + views loose", () => {
    expect(TYPES).toMatch(/      rentals: \{\n        Row: \{/);
    expect(TYPES).toMatch(/      crews: \{\n        Row: \{/);
    expect(TYPES).toMatch(/      crew_members: \{\n        Row: \{/);
    expect(TYPES).toMatch(/      lobbies: LooseSupabaseTable/);
    expect(TYPES).toMatch(/      chemicals: LooseSupabaseTable/);
    expect(TYPES).toMatch(/      daily_cash_flow: \{\n        Row: LooseSupabaseRow/);
  });

  it("strict-listed tables missing from the REST spec are kept loose WITH a documenting comment", () => {
    expect(TYPES).toMatch(/\/\/ NOT exposed in the REST spec/);
    expect(TYPES).toMatch(/crew_secrets: LooseSupabaseTable/);
    expect(TYPES).toMatch(/rental_contract_artifacts: LooseSupabaseTable/);
  });

  it("manual Functions block is preserved (regeneration carries it over)", () => {
    expect(TYPES).toMatch(/capture_vip_bike_callback_intent/);
    expect(TYPES).toMatch(/validate_analytics_password|finalize_vip_bike_callback_notification/);
  });
});

describe("iter29: migrations apply path is cloner-safe", () => {
  const MIG = join(ROOT, "supabase/migrations");
  const files = readdirSync(MIG).filter((f) => statSync(join(MIG, f)).isFile() && f !== "README.md");

  it("the Paul: syntax bug that broke every fresh DB at migration #1 is gone", () => {
    const init = readFileSync(join(MIG, "20240101000000_init.sql"), "utf8");
    expect(init).not.toMatch(/^Paul:/m);
  });

  it("apply path holds exactly the 159 clean SQL files — no junk, no crons", () => {
    expect(files.length).toBe(159);
    expect(files.every((f) => f.endsWith(".sql"))).toBe(true);
    expect(files.some((f) => /cron/i.test(f))).toBe(false);
    expect(files.some((f) => /NOTAPPLIED/i.test(f))).toBe(false);
  });

  it("the leaked-bot-token cron pair is OUT of the apply path, in legacy/_cron", () => {
    const legacyCron = join(ROOT, "supabase/legacy-migrations/_cron");
    expect(existsSync(join(legacyCron, "20260610000000_daily_insights_cron.sql"))).toBe(true);
    expect(existsSync(join(legacyCron, "20260610000002_sleep_reminder_cron.sql"))).toBe(true);
    expect(files.includes("20260610000000_daily_insights_cron.sql")).toBe(false);
    expect(files.includes("20260610000002_sleep_reminder_cron.sql")).toBe(false);
    const readme = readFileSync(join(legacyCron, "..", "README.md"), "utf8");
    expect(readme).toMatch(/rotate/i); // the ROTATE IT warning must stay
  });

  it("READMEs explain both folders", () => {
    expect(existsSync(join(MIG, "README.md"))).toBe(true);
    expect(read("supabase/legacy-migrations/README.md")).toMatch(/_junk/);
    expect(read("supabase/legacy-migrations/README.md")).toMatch(/_cron/);
    expect(read("supabase/legacy-migrations/README.md")).toMatch(/_sandbox/);
  });
});

describe("iter29: docs cleanup + BikeSoul PRD", () => {
  it("legacy archive and plans exist with their READMEs", () => {
    expect(existsSync(join(ROOT, "docs/legacy/README.md"))).toBe(true);
    expect(existsSync(join(ROOT, "docs/legacy/SOUL.md"))).toBe(true);
    expect(existsSync(join(ROOT, "docs/superpowers/plans/PLAN-LEADS-QUALITY-UPGRADE.md"))).toBe(true);
  });

  it("root is decluttered: vibe files archived, junk gone, product README shipped", () => {
    expect(existsSync(join(ROOT, "README.MD"))).toBe(true);
    expect(read("README.MD")).toMatch(/VIP Bike/);
    expect(read("README.MD")).toMatch(/gen:db-types/);
    expect(existsSync(join(ROOT, "SOUL.md"))).toBe(false);
    expect(existsSync(join(ROOT, "build.log"))).toBe(false);
    expect(existsSync(join(ROOT, "dev.log"))).toBe(false);
    expect(existsSync(join(ROOT, "tailwind.config"))).toBe(false); // extensionless dup
    expect(existsSync(join(ROOT, "bun.lock"))).toBe(true); // CI needs it — must NOT be deleted
  });

  it("BikeSoul PRD exists with its core invariants", () => {
    const prd = read("docs/PRD_BIKE_SOUL_GAMIFICATION.md");
    expect(prd).toMatch(/BikeSoul/);
    expect(prd).toMatch(/gamification is display-only/i); // the one rule
    expect(prd).toMatch(/50 · \(n−1\)\^1\.6/); // XP curve formula
    expect(prd).toMatch(/bike_souls/);
    expect(prd).toMatch(/bike_events/);
    expect(prd).toMatch(/bike_battles/);
    expect(prd).toMatch(/swap_contracts/);
    expect(prd).toMatch(/Moon Program/i);
    expect(prd).toMatch(/iter30|iteration 30|iter 30/i);
  });
});
