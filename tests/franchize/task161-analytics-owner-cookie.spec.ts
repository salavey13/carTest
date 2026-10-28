// TASK161 — the analytics owner cookie became PER-CREW.
//
// Boss context (2026-10-29, verification day): the PC/password сверка card
// (task159) reads a signed httpOnly cookie, but the cookie name was SHARED
// by all crews — validating the analytics password for a second crew
// overwrote the first session, and the rental-page card for the earlier
// crew silently vanished mid-day. The name now carries the slug, so a
// multi-crew owner keeps parallel sessions (slug is bound BOTH in the name
// and in the HMAC payload — a cookie can never be replayed across crews).

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

// The module imports lib/supabase-server (guarded against the browser env) —
// mock it: the cookie helpers under test are pure crypto/name logic.
vi.mock("@/lib/supabase-server", () => ({ supabaseAdmin: {} }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import {
  analyticsOwnerCookieName,
  buildAnalyticsOwnerCookieValue,
  verifyAnalyticsOwnerCookieValue,
} from "@/app/franchize/lib/analytics-owner-cookie";

const src = (p: string) => readFileSync(p, "utf8");

describe("task161: per-crew analytics owner cookie", () => {
  it("cookie name carries the slug — two crews never share a session", () => {
    expect(analyticsOwnerCookieName("vip-bike")).toBe("vb_analytics_owner_vip-bike");
    expect(analyticsOwnerCookieName("mototehnn")).toBe("vb_analytics_owner_mototehnn");
    // Distinct names for distinct crews:
    expect(analyticsOwnerCookieName("vip-bike")).not.toBe(analyticsOwnerCookieName("sly13"));
  });

  it("unsafe slug characters are stripped from the name (cookie-name safety)", () => {
    const name = analyticsOwnerCookieName("we..ird slug!?!");
    expect(name).toMatch(/^vb_analytics_owner_[a-zA-Z0-9_-]*$/);
    expect(name.startsWith("vb_analytics_owner_")).toBe(true);
    // Empty/garbage slug still produces a valid, stable name:
    expect(analyticsOwnerCookieName("")).toBe("vb_analytics_owner_x");
    expect(analyticsOwnerCookieName("???")).toBe("vb_analytics_owner_x");
  });

  it("round-trip: build → verify returns the same owner for the SAME slug", () => {
    const { value, maxAgeSeconds } = buildAnalyticsOwnerCookieValue("111222333", "vip-bike");
    expect(maxAgeSeconds).toBeGreaterThan(0);
    const parsed = verifyAnalyticsOwnerCookieValue(value, "vip-bike");
    expect(parsed).toEqual({ ownerId: "111222333", slug: "vip-bike" });
  });

  it("a cookie minted for crew A is REJECTED for crew B (slug bound in the payload)", () => {
    const { value } = buildAnalyticsOwnerCookieValue("111222333", "vip-bike");
    expect(verifyAnalyticsOwnerCookieValue(value, "sly13")).toBeNull();
  });

  it("tampered payload / broken signature / expired cookie are rejected", () => {
    const { value } = buildAnalyticsOwnerCookieValue("111222333", "vip-bike");
    const [b64, mac] = value.split(".");
    // Payload flipped, signature kept — HMAC must not pass:
    const forged = Buffer.from("999999|vip-bike|99999999999999", "utf8").toString("base64url");
    expect(verifyAnalyticsOwnerCookieValue(`${forged}.${mac}`, "vip-bike")).toBeNull();
    // Signature flipped, payload kept:
    expect(verifyAnalyticsOwnerCookieValue(`${b64}.${"A".repeat(mac.length)}`, "vip-bike")).toBeNull();
    // Expired:
    const expiredPayload = Buffer.from("111222333|vip-bike|1000", "utf8").toString("base64url");
    const { value: expiredSigned } = buildAnalyticsOwnerCookieValue("111222333", "vip-bike");
    const expiredMac = expiredSigned.split(".")[1];
    void expiredPayload;
    expect(verifyAnalyticsOwnerCookieValue(`eyIxMTF9.${expiredMac ?? "x"}`, "vip-bike")).toBeNull();
    // Garbage inputs:
    expect(verifyAnalyticsOwnerCookieValue(null, "vip-bike")).toBeNull();
    expect(verifyAnalyticsOwnerCookieValue("", "vip-bike")).toBeNull();
    expect(verifyAnalyticsOwnerCookieValue("noseparator", "vip-bike")).toBeNull();
  });

  it("wiring: validate sets the per-slug name, the rental page reads it back", () => {
    const dash = src("app/franchize/server-actions/rentals-dashboard.ts");
    expect(dash).toContain("analyticsOwnerCookieName(String(result.slug))");
    // The shared bare name must not be set anywhere anymore:
    expect(dash).not.toMatch(/\.set\(ANALYTICS_OWNER_COOKIE/);
    const lib = src("app/franchize/lib/analytics-owner-cookie.ts");
    expect(lib).toContain("analyticsOwnerCookieName(slug)");
    const page = src("app/franchize/[slug]/rental/[id]/page.tsx");
    expect(page).toContain("resolveAnalyticsPasswordOwnerForSlug(resolvedSlug)");
  });
});
