import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Task 45/46 — ownership & visibility guarantees (ONE test per guarantee —
 * the suite used to be 13 source-grep its; the boss asked to slim it down):
 *
 * 1. Admin garage is CREW-SCOPED: fleet always getCrewVehicles(crew.slug),
 *    never the cross-crew getEditableVehiclesForUser fallback, and non-admins
 *    get an access gate that returns BEFORE any Supabase call.
 * 2. Profile dropdown operator links honour membership admins
 *    (isCurrentCrewAdmin), not just the primary-crew userCrewInfo — that
 *    mismatch made the rentals-analytics item disappear randomly.
 * 3. AppContext exposes userCrewMembershipsLoaded (settles even on error).
 * 4. The explicit bike-condition migration pins all 12 owner-confirmed ids
 *    and stays idempotent.
 */

const repoRoot = resolve(__dirname, "../..");

const read = (rel: string): string =>
  readFileSync(resolve(repoRoot, rel), "utf8");

describe("Task 45/46: ownership gate (slimmed)", () => {
  it("admin garage: crew-scoped loader, no cross-crew fallback, gated denial before fetch", () => {
    const src = read("app/franchize/components/FranchizeAdminClient.tsx");
    // crew-scoped fleet loader
    expect(src).toContain("await getCrewVehicles(crew.slug)");
    // no personal cross-crew fallback anymore (comments stripped: the Task 45
    // explanation mentions the old loader by name — code must not use it)
    expect(src.replace(/^[ \t]*\/\/.*$/gm, "")).not.toContain("getEditableVehiclesForUser(");
    expect(src).not.toContain('from "@/app/rentals/actions"');
    // platform-admin hook still feeds the gate
    expect(src).toContain("const userIsPlatformAdmin = useIsAdmin();");
    // gate = crew membership admin OR platform admin; denial waits for the
    // membership check to settle and returns BEFORE the Supabase call
    expect(src).toContain("const canManageCrewFleet = isCrewFleetAdmin || userIsPlatformAdmin;");
    expect(src).toMatch(
      /if \(!canManageCrewFleet\) \{[\s\S]{0,200}?if \(userCrewMembershipsLoaded\) \{[\s\S]{0,300}?setFleetAccessDenied\(true\);[\s\S]{0,200}?return;[\s\S]{0,200}?setFleetAccessDenied\(false\);[\s\S]{0,300}?await getCrewVehicles\(crew\.slug\);/,
    );
    // the gate text exists (renders instead of fleet data for non-admins)
    expect(src).toContain("Панель владельца экипажа недоступна");
  });

  it("profile dropdown: canViewCrewLinks honours membership admins", () => {
    const src = read("app/franchize/components/FranchizeProfileButton.tsx");
    expect(src).toContain(
      "const canViewCrewLinks = userIsAdmin || isCurrentCrewAdmin || isCurrentCrewMember;",
    );
    expect(src).toMatch(
      /isCurrentCrewAdmin = useMemo\(\(\) => \{[\s\S]*?userCrewMemberships\.some\([\s\S]*?\["owner", "admin", "co_owner"\]\.includes\(m\.role\)/,
    );
    expect(src).toMatch(
      /\{canViewCrewLinks && effectiveSlug && \(\s*<DropdownMenuItem asChild>\s*<Link href=\{`\/franchize\/\$\{effectiveSlug\}\/rentals-analytics`\}/,
    );
  });

  it("AppContext: userCrewMembershipsLoaded settles even when the fetch fails", () => {
    const src = read("contexts/AppContext.tsx");
    expect(src).toContain("userCrewMembershipsLoaded: boolean;");
    expect(src).toMatch(/finally \{[\s\S]*?setUserCrewMembershipsLoaded\(true\);[\s\S]*?\}/);
  });

  it("condition migration: pins all 12 owner-confirmed bikes, idempotent", () => {
    const sql = read(
      "supabase/migrations/20260923210000_set_bike_condition_specs.sql",
    );
    for (const id of [
      // new
      "falcon-lite-2026",
      "falcon-lynx-purple",
      "falcon-gt-2026",
      "falcon-pro-2026",
      "sequence-zero",
      "y-volt-surge-v",
      // not new
      "jilang-max-pro",
      "leopard-asaka",
      "livewire-one",
      "motoland-breakout",
      "nibbler-regumoto-4v",
      "sotion-em01",
    ]) {
      expect(sql).toContain(`('${id}',`);
    }
    expect(sql).toContain("coalesce(c.specs ->> 'condition', '') <> cond.value");
    // cars has no updated_at — the UPDATE must not assign it (indented
    // comments stripped too: ^\s* catches nested -- lines)
    expect(sql.replace(/^[ \t]*--.*$/gm, "")).not.toContain("updated_at");
  });
});
