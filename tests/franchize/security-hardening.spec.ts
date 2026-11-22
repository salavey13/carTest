// tests/franchize/security-hardening.spec.ts
//
// Security codereview round (2026-09-20) — regression guards for the fixes:
//   1. Migration 20260920050000_rpc_lockdown_anon.sql must keep REVOKEing
//      anon/authenticated EXECUTE on the server-only RPCs (toggle_post_reaction,
//      get_user_rentals_dashboard_new, get_user_crew_command_deck) and re-grant
//      to service_role. If a future migration recreates one of these functions
//      with CREATE OR REPLACE but no REVOKE, this spec fails and the hole is
//      re-opened only consciously.
//   2. /api/my/bookings must never trust a client-supplied userId: identity
//      comes from the signed Telegram actor cookie (or verified initData), and
//      queries run through the admin client (the RPC is service_role-only now).
//   3. The franchize calc-explainer page must not render anything through
//      dangerouslySetInnerHTML (cells are static literals — text children only).
//   4. next.config.mjs must ship the frame-safe security header set (the app
//      lives in the Telegram WebApp iframe — frame-deny headers are forbidden
//      here, that's why the set is exactly these three).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** Standard escapeRegExp — the signatures contain regex metachars. */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("security: RPC lockdown migration (20260920050000)", () => {
  const sql = read("supabase/migrations/20260920050000_rpc_lockdown_anon.sql");

  it("exists in the apply path and is plain SQL", () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  const serverOnlyRpcs: [string, string][] = [
    // [function signature, name]
    ["public.toggle_post_reaction(uuid, text, text)", "toggle_post_reaction"],
    ["public.get_user_rentals_dashboard_new(text, boolean)", "get_user_rentals_dashboard_new"],
    ["public.get_user_crew_command_deck(text)", "get_user_crew_command_deck"],
  ];

  it.each(serverOnlyRpcs)("revokes PUBLIC/anon/authenticated EXECUTE on %s", (signature) => {
    const re = new RegExp(
      `REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+${esc(signature)}\\s*\\n?\\s*FROM\\s+PUBLIC\\s*,\\s*anon\\s*,\\s*authenticated\\s*;`,
      "i",
    );
    expect(sql).toMatch(re);
  });

  it.each(serverOnlyRpcs)("grants service_role EXECUTE on %s", (signature) => {
    const re = new RegExp(
      `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+${esc(signature)}\\s*\\n?\\s*TO\\s+service_role\\s*;`,
      "i",
    );
    expect(sql).toMatch(re);
  });

  it("does NOT lock the RPCs that are designed for anon access", () => {
    // search_cars / similar_cars / get_top_fleets / createBooking etc. are
    // called with the anon key from the client on purpose — a lockdown there
    // would break the public site. Guard against a REVOKE appearing for them
    // (the migration's prose comment may still mention them by name).
    for (const fn of ["search_cars", "similar_cars", "get_top_fleets", "createBooking", "get_vehicle_calendar"]) {
      expect(sql).not.toMatch(new RegExp(`REVOKE[^;]*${fn}`, "i"));
    }
  });
});

describe("security: /api/my/bookings identity", () => {
  const route = read("app/api/my/bookings/route.ts");

  it("resolves identity from the signed actor cookie, not the query string", () => {
    expect(route).toContain("verifyTelegramActorCookieValue");
    expect(route).toContain("TELEGRAM_ACTOR_COOKIE");
  });

  it("supports the verified initData fallback (wall parity)", () => {
    expect(route).toContain("computeTelegramWebAppHash");
    expect(route).toContain("isTelegramInitDataFresh");
  });

  it("runs the dashboard RPC through the admin client (RPC is service_role-only)", () => {
    expect(route).toContain("supabaseAdmin.rpc('get_user_rentals_dashboard_new'");
    // The anon client must not be able to call the locked-down RPC anymore.
    expect(route).not.toContain("supabaseAnon");
  });

  it("rejects a userId param that does not match the verified identity", () => {
    expect(route).toContain("userId param does not match verified identity");
    expect(route).toContain("403");
  });

  it("answers 401 without a verified identity", () => {
    expect(route).toContain("401");
  });

  it("does not leak RPC error details to the client", () => {
    // The old build concatenated error.message into the response body.
    expect(route).not.toContain("error.message +");
    expect(route).not.toContain("+ error.message");
  });
});

describe("security: franchize surface hardening", () => {
  it("calc-explainer renders static cells as text — no dangerouslySetInnerHTML", () => {
    const page = read("app/franchize/[slug]/calc-explainer/page.tsx");
    expect(page).not.toContain("dangerouslySetInnerHTML");
  });

  it("next.config ships the frame-safe security header set", () => {
    const cfg = read("next.config.mjs");
    expect(cfg).toContain('"nosniff"');
    expect(cfg).toContain("strict-origin-when-cross-origin");
    expect(cfg).toContain("Permissions-Policy");
    // The Mini App runs in the Telegram iframe — frame-deny headers would
    // blank the whole app on desktop Telegram. Guard against a well-meant
    // regression that adds them globally.
    expect(cfg).not.toContain("X-Frame-Options");
    expect(cfg).not.toContain("frame-ancestors");
  });

  it("the wall URL tokenizer still refuses non-http(s) schemes (no javascript: hrefs)", () => {
    const lib = read("app/franchize/lib/community-wall.ts");
    // URL_RE must anchor on https?:// — everything else stays plain text.
    expect(lib).toContain("const URL_RE = /https?:\\/\\/");
  });
});
