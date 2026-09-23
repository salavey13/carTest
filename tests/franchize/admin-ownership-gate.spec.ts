import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Task 45 — ownership & visibility fixes:
 *
 * 1. Admin garage must be CREW-SCOPED. Opening /franchize/<slug>/admin used
 *    to fall back to getEditableVehiclesForUser (ALL vehicles from ALL of
 *    the user's crews + personal) rendered under the foreign crew's banner —
 *    salavey13 saw his vip-bike + sly13 items as "Мототех НН: админка
 *    гаража". Now the fleet is always getCrewVehicles(slug) and non-admins
 *    get an access gate instead of any data.
 *
 * 2. Profile dropdown operator links (leads / dashboard / rentals analytics)
 *    used to depend on userCrewInfo — the user's PRIMARY crew only (owned
 *    crew, else one arbitrary membership row). Crew admins/co_owners and
 *    multi-crew owners saw the "Аналитика аренд" item disappear randomly.
 *    canViewCrewLinks now also honours isCurrentCrewAdmin (memberships).
 *
 * 3. AppContext now exposes userCrewMembershipsLoaded so permission gates
 *    can distinguish "no memberships" from "not fetched yet".
 */

const repoRoot = resolve(__dirname, "../..");

const read = (rel: string): string =>
  readFileSync(resolve(repoRoot, rel), "utf8");

describe("Task 45: admin garage crew scoping (FranchizeAdminClient)", () => {
  const src = read("app/franchize/components/FranchizeAdminClient.tsx");

  it("fleet loader uses the crew-scoped getCrewVehicles(crew.slug)", () => {
    expect(src).toContain("await getCrewVehicles(crew.slug)");
  });

  it("no longer loads personal cross-crew vehicles on the admin page", () => {
    expect(src).not.toContain("getEditableVehiclesForUser(");
    expect(src).not.toContain('from "@/app/rentals/actions"');
  });

  it("gate = crew membership admin OR platform admin", () => {
    expect(src).toContain("const canManageCrewFleet = isCrewFleetAdmin || userIsPlatformAdmin;");
    expect(src).toContain("useIsAdmin()");
  });

  it("renders an access gate instead of fleet data for non-admins", () => {
    expect(src).toContain("Панель владельца экипажа недоступна");
    // denial waits for the membership check to settle (no flash for admins)
    expect(src).toContain("if (!userCrewMembershipsLoaded) {");
  });

  it("denial does not fetch any vehicles (no permission → no data)", () => {
    // the denied branch must return BEFORE the Supabase call
    expect(src).toMatch(
      /if \(!canManageCrewFleet\) \{[\s\S]{0,600}?setFleetAccessDenied\(true\);[\s\S]{0,400}?return;[\s\S]{0,200}?\}\s*setFleetAccessDenied\(false\);[\s\S]*?await getCrewVehicles\(crew\.slug\);/,
    );
  });
});

describe("Task 45: profile dropdown operator links (FranchizeProfileButton)", () => {
  const src = read("app/franchize/components/FranchizeProfileButton.tsx");

  it("canViewCrewLinks honours crew admins, not just the primary crew", () => {
    expect(src).toContain(
      "const canViewCrewLinks = userIsAdmin || isCurrentCrewAdmin || isCurrentCrewMember;",
    );
  });

  it("isCurrentCrewAdmin is membership-based with admin-level roles", () => {
    expect(src).toMatch(
      /isCurrentCrewAdmin = useMemo\(\(\) => \{[\s\S]*?userCrewMemberships\.some\([\s\S]*?\["owner", "admin", "co_owner"\]\.includes\(m\.role\)/,
    );
  });

  it("analytics link stays gated by canViewCrewLinks", () => {
    expect(src).toMatch(
      /\{canViewCrewLinks && effectiveSlug && \(\s*<DropdownMenuItem asChild>\s*<Link href=\{`\/franchize\/\$\{effectiveSlug\}\/rentals-analytics`\}/,
    );
  });
});

describe("Task 45: AppContext exposes userCrewMembershipsLoaded", () => {
  const src = read("contexts/AppContext.tsx");

  it("flag is declared on the runtime context contract", () => {
    expect(src).toContain("userCrewMembershipsLoaded: boolean;");
  });

  it("flag settles even when the snapshot fetch fails (finally)", () => {
    expect(src).toMatch(/finally \{[\s\S]*?setUserCrewMembershipsLoaded\(true\);[\s\S]*?\}/);
  });
});

describe("Task 45: explicit bike condition migration", () => {
  const sql = read(
    "supabase/migrations/20260923210000_set_bike_condition_specs.sql",
  );

  it("pins the six owner-confirmed NEW bikes", () => {
    for (const id of [
      "falcon-lite-2026",
      "falcon-lynx-purple",
      "falcon-gt-2026",
      "falcon-pro-2026",
      "sequence-zero",
      "y-volt-surge-v",
    ]) {
      expect(sql).toContain(`('${id}',`);
    }
  });

  it("downgrades the six owner-confirmed NOT-new bikes to used", () => {
    for (const id of [
      "jilang-max-pro",
      "leopard-asaka",
      "livewire-one",
      "motoland-breakout",
      "nibbler-regumoto-4v",
      "sotion-em01",
    ]) {
      expect(sql).toContain(`('${id}',`);
    }
  });

  it("is idempotent and does not touch a non-existent updated_at", () => {
    expect(sql).toContain("coalesce(c.specs ->> 'condition', '') <> cond.value");
    // the UPDATE statement itself must not assign updated_at (cars has no
    // such column — comments may mention it, SQL must not)
    expect(sql.replace(/^--.*$/gm, "")).not.toContain("updated_at");
  });
});
