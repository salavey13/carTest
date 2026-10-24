// tests/franchize/task131-catalog-speed-pc-polish.spec.ts
//
// task131 (2026-10-24) — «выбрать байк takes forever» + rental-analytics PC
// polish. Source-contract pins (the runtime modules pull the whole app
// context graph, so unit-importing them is heavier than asserting the
// source; established pattern in this repo):
//
//   1. getFranchizeBySlug runs THREE times per /franchize/[slug] navigation
//      (layout + page + metadata), each = 4 sequential cross-region Supabase
//      roundtrips → the shim memo dedupes them (60s TTL, clone-on-return,
//      bust on markCrewBikesAvailable).
//   2. The landing CTA prefetches the catalog route (next/link) instead of
//      cold router.push (pinned in fast-auth-routing.spec.ts).
//   3. The table-view modal opens at desktop width (max-w-7xl) with a
//      readable 13px table font on ≥sm screens.
//   4. /analytics_pass replies with the PC link next to the emailed password
//      (same env chain as /api/send-analytics-password).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("catalog read memo (triple-fetch fix)", () => {
  const shim = read("app/franchize/server-actions/catalog.ts");

  it("memoizes getFranchizeBySlug with a short TTL", () => {
    expect(shim).toContain("CATALOG_MEMO_TTL_MS = 60_000");
    expect(shim).toContain("catalogMemo.get(key)");
    expect(shim).toContain("writeCatalogMemo(key, data)");
  });

  it("returns clones so no caller can mutate the shared cache entry", () => {
    expect(shim).toContain("structuredClone(hit.data)");
    expect(shim).toContain("structuredClone(data)");
  });

  it("never caches empty-crew misses (transient DB failures self-heal)", () => {
    expect(shim).toContain("if (!data?.crew?.id) return;");
  });

  it("busts the memo around markCrewBikesAvailable (availability mutations)", () => {
    expect(shim).toContain("catalogMemo.delete(key);\n  const result = await markCrewBikesAvailableRuntime(slug);\n  catalogMemo.delete(key);");
  });

  it("all three [slug] call sites still go through the shim", () => {
    // layout.tsx / page.tsx / metadata.ts keep importing from "../actions"
    // → the memo covers every one of them without touching the call sites.
    for (const f of [
      "app/franchize/[slug]/layout.tsx",
      "app/franchize/[slug]/page.tsx",
      "app/franchize/[slug]/metadata.ts",
    ]) {
      expect(read(f)).toContain('from "../actions"');
    }
  });
});

describe("table-view modal PC width + readability", () => {
  const modal = read(
    "app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx",
  );

  it("opens at max-w-7xl on sm+ (was 5xl — the wide table stayed cramped)", () => {
    expect(modal).toContain("sm:max-w-7xl");
    expect(modal).not.toContain("sm:max-w-5xl");
  });

  it("bumps the table font to 13px on sm+ (both flat and sectioned tables)", () => {
    expect(modal.match(/text-xs sm:text-\[13px\]/g)?.length).toBe(2);
  });
});

describe("/analytics_pass reply carries the PC link", () => {
  const cmd = read("app/webhook-handlers/commands/analytics_pass.ts");

  it("builds the rentals-analytics URL with the same env chain as the email", () => {
    expect(cmd).toContain("function buildAnalyticsPcLink(slug: string)");
    expect(cmd).toContain("process.env.NEXT_PUBLIC_APP_URL ||");
    expect(cmd).toContain("/franchize/${slug}/rentals-analytics");
  });

  it("includes the link in the success line (password still goes to email)", () => {
    expect(cmd).toContain("Пароль отправлен на эл. почту экипажа.\\n` +");
    expect(cmd).toContain("buildAnalyticsPcLink(slug)");
  });
});
