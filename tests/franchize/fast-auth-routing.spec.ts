// tests/franchize/fast-auth-routing.spec.ts
//
// 2026-09-22 speed & SPA fixes (source contracts — the router/auth modules
// pull the whole app context graph, so unit-importing them is heavier than
// asserting the source; established pattern in this repo):
//
//   1. STATIC startapp fast path — self-contained params (page map,
//      mapriders_<slug>, crew_<slug>, viz_<id>) route BEFORE the auth gate,
//      so the entry page doesn't finish loading before the transition.
//   2. Auth in ONE roundtrip — /api/validate-telegram-auth resolves the
//      users-table row server-side; useTelegramAuth consumes it and skips
//      the legacy fetchDbUser→upsert chain.
//   3. Strikeball lobby probe deferred out of the auth window.
//   4. Landing internal links navigate client-side (no full reload → no
//      repeated "authentication happening" on every page change).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("startapp router: STATIC fast path", () => {
  const src = read("hooks/useStartParamRouter.ts");

  it("exports computeStaticFastTarget with self-contained rules", () => {
    expect(src).toContain("export function computeStaticFastTarget(param: string): string | null");
    // Page-map claim…
    expect(src).toContain("if (START_PARAM_PAGE_MAP[param]) return START_PARAM_PAGE_MAP[param];");
    // …slug-carried mapriders…
    expect(src).toContain("param.startsWith(\"mapriders_\")");
    // …self-contained crew_ / viz_ rules.
    expect(src).toContain("param.startsWith(\"crew_\")");
    expect(src).toContain("param.startsWith(\"viz_\")");
  });

  it("static fast path runs BEFORE the auth gate (like the wall fast path)", () => {
    const staticIdx = src.indexOf("computeStaticFastTarget(paramToProcess)");
    const wallIdx = src.indexOf("computeFastWallTarget(paramToProcess)");
    const gateIdx = src.indexOf("if (isAppLoading || isAuthenticating)");
    expect(staticIdx).toBeGreaterThan(-1);
    expect(wallIdx).toBeGreaterThan(staticIdx);
    expect(gateIdx).toBeGreaterThan(wallIdx);
  });

  it("fast path marks the param handled and clears it (no double routing)", () => {
    expect(src).toContain("[ClientLayout] FAST routing static deep link");
    expect(src).toContain("never fall through to the gated logic");
  });

  it("keeps the gated page-map fallback (defence in depth)", () => {
    expect(src).toContain("START_PARAM_PAGE_MAP[paramToProcess]");
  });

  it("does NOT claim wb_dashboard on the static fast path (needs userCrewInfo)", () => {
    // wb_dashboard routes crew users to /wb/<crewSlug> via the GATED branch
    // (the viewer's crew is only known after auth). A START_PARAM_PAGE_MAP
    // entry would let computeStaticFastTarget lock it to /wblanding for
    // everyone — regression caught in the 41-b code review (bot /howto sends
    // ?startapp=wb_dashboard).
    expect(src).not.toContain('wb_dashboard: "/wblanding"');
    expect(src).toContain('paramToProcess === "wb_dashboard"');
  });
});

describe("auth in one roundtrip", () => {
  it("validate-telegram-auth resolves and returns the dbUser inline", () => {
    const route = read("app/api/validate-telegram-auth/route.ts");
    expect(route).toContain('import { fetchUserData, createOrUpdateUser } from "@/lib/supabase-server";');
    expect(route).toContain("AUTH IN ONE ROUNDTRIP");
    // profile sync mirrors the legacy upsert contract (changed → upsert)
    expect(route).toContain("existing.username !== username");
    expect(route).toContain("NextResponse.json({ ...result, dbUser }, { status })");
  });

  it("useTelegramAuth consumes the inline dbUser and falls back to legacy chain", () => {
    const hook = read("hooks/telegram/useTelegramAuth.ts");
    expect(hook).toContain("apiAuth?.dbUser ?? null");
    // fast path wins; legacy handleAuthentication only when the row is missing
    expect(hook).toContain("fastDbUser ?? (await handleAuthentication(candidate))");
  });
});

describe("deferred non-critical auth-window work", () => {
  it("AppContext probes the strikeball lobby AFTER the auth window", () => {
    const ctx = read("contexts/AppContext.tsx");
    expect(ctx).toContain("ROUTING SPEED (2026-09-22)");
    expect(ctx).toContain("setTimeout(() => {\n      void refreshActiveLobby();\n    }, 2000)");
  });
});

describe("landing SPA linking", () => {
  it("MagneticButton routes internal hrefs client-side (no full reload)", () => {
    const page = read("app/page.tsx");
    expect(page).toContain("SPA LINKING FIX (2026-09-22)");
    // internal CTA goes through router.push with preventDefault…
    expect(page).toContain("router.push(href)");
    // …and the mobile-menu catalog CTA does too…
    expect(page).toContain("router.push(CATALOG_HREF)");
    // …while keeping the anchor for middle-click/new-tab semantics.
    expect(page).toContain('href={href}');
  });
});
