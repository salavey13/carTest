// tests/franchize/mapriders-no-legacy-nav.spec.ts
// 2026-10-01 — boss report: «please check links on mapriders in bottom nav,
// seems some lead to legacy non franchize pages».
//
// AUDIT RESULT: the mapriders surface (page, sheet, wall, drawer, popups,
// FranchizeMapBottomNav) was franchize-scoped EXCEPT one leak — the
// admin-only «Маршруты» button in the sheet ride strip navigated to the
// LEGACY /admin/map-routes shell. Landing there swaps in the legacy
// bike-theme bottom nav whose items are all legacy non-franchize pages
// (/leaderboard, /crews, /paddock, /admin) — exactly what the boss saw.
//
// FIX: the shortcut left the user-facing mapriders sheet (restores the
// original «no admin route leakage into user-facing nav» policy) and the
// route editor entry point moved to the STAFF surface — the franchize admin
// page now carries a «Маршруты карты» link button next to «← Общий админ».
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const read = (p: string) => readFileSync(join(repo, p), "utf8");

describe("mapriders — no legacy non-franchize navigation leaks", () => {
  it("the sheet ride strip no longer links to the legacy /admin/map-routes", () => {
    const client = read("components/map-riders/MapRidersClientRefactored.tsx");
    expect(client.includes('href="/admin/map-routes"')).toBe(false);
    // the dead hook import goes too (no unused-var lint debt)
    expect(client.includes('from "@/app/franchize/hooks/useIsAdmin"')).toBe(false);
  });

  it("the route editor keeps a staff entry point on the franchize admin page", () => {
    const admin = read("app/franchize/components/FranchizeAdminClient.tsx");
    expect(admin.includes('href="/admin/map-routes"')).toBe(true);
  });

  it("FranchizeMapBottomNav never navigates off the franchize namespace", () => {
    const nav = read("components/layout/FranchizeMapBottomNav.tsx");
    // every href the nav can emit must be franchize-scoped
    const hrefs = [...nav.matchAll(/href=\{?`([^`]+)`/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith("/franchize/")).toBe(true);
    }
  });
});
