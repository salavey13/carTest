import { describe, it, expect } from "vitest";
import { crewSlugKey, hasCrewMembership, hasCrewRole } from "@/lib/crew-slug";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Task 97 — «Аналитика аренд» hidden-forever hardening (djorudjov / vip-bike):
 *
 * The DB row was verified correct (crew_members.role=admin,
 * membership_status=active, slug lowercase). The freeze was client-side:
 *   • fetchUserCrewMembershipsAction ignored Supabase {data, error} — a
 *     transient REST failure silently returned [] which every consumer
 *     treated as ground truth (no retry, no revalidation);
 *   • AppContext coupled snapshot + memberships in one Promise.all — a
 *     snapshot throw discarded a healthy memberships response;
 *   • the dropdown never revalidated an empty cached list on open.
 *
 * These tests cover the pure matching helpers and the structural guarantees
 * of the hardened chain.
 */

const repoRoot = resolve(__dirname, "../..");
const read = (rel: string): string => readFileSync(resolve(repoRoot, rel), "utf8");

describe("crewSlugKey", () => {
  it("trims + lowercases for comparison", () => {
    expect(crewSlugKey("  VIP-Bike ")).toBe("vip-bike");
    expect(crewSlugKey("vip-bike")).toBe("vip-bike");
  });

  it("is null-safe → empty string", () => {
    expect(crewSlugKey(null)).toBe("");
    expect(crewSlugKey(undefined)).toBe("");
    expect(crewSlugKey("")).toBe("");
  });
});

describe("hasCrewMembership", () => {
  const memberships = [
    { slug: "vip-bike" },
    { slug: "  NN-MotoGor  " },
  ];

  it("matches normalized slugs", () => {
    expect(hasCrewMembership(memberships, "vip-bike")).toBe(true);
    expect(hasCrewMembership(memberships, "VIP-BIKE")).toBe(true);
    expect(hasCrewMembership(memberships, "nn-motogor")).toBe(true);
  });

  it("returns false for non-members and empty inputs", () => {
    expect(hasCrewMembership(memberships, "antanta52.ru")).toBe(false);
    expect(hasCrewMembership(memberships, "")).toBe(false);
    expect(hasCrewMembership(memberships, null)).toBe(false);
    expect(hasCrewMembership([], "vip-bike")).toBe(false);
  });

  it("tolerates malformed membership rows (no throw)", () => {
    expect(hasCrewMembership([{ slug: null }, {} as { slug: string }], "vip-bike")).toBe(false);
  });
});

describe("hasCrewRole", () => {
  const memberships = [
    { slug: "vip-bike", role: "admin" },
    { slug: "sly13", role: "Co_Owner" },
  ];

  it("matches roles case-insensitively", () => {
    expect(hasCrewRole(memberships, "vip-bike", ["admin"])).toBe(true);
    expect(hasCrewRole(memberships, "sly13", ["co_owner"])).toBe(true);
  });

  it("matches the full owner/admin/co_owner set used by the dropdown gate", () => {
    const set = ["owner", "admin", "co_owner"];
    expect(hasCrewRole(memberships, "vip-bike", set)).toBe(true);
    expect(hasCrewRole([{ slug: "x", role: "member" }], "x", set)).toBe(false);
  });

  it("returns false for member-role users asking for admin roles", () => {
    expect(hasCrewRole([{ slug: "vip-bike", role: "member" }], "vip-bike", ["admin"])).toBe(false);
  });
});

describe("Task 97 structural guarantees (source-grep)", () => {
  it("fetchUserCrewMembershipsAction checks Supabase errors and re-throws instead of returning silent []", () => {
    const src = read("contexts/actions.ts");
    expect(src).toContain("error: ownedErr");
    expect(src).toContain("error: memberErr");
    expect(src).toContain("if (ownedErr) throw ownedErr;");
    expect(src).toContain("if (memberErr) throw memberErr;");
    // the swallow-to-[] fallback is gone from this action
    const action = src.slice(src.indexOf("fetchUserCrewMembershipsAction"), src.indexOf("fetchActiveGameAction"));
    expect(action).toContain("throw error;");
  });

  it("AppContext decouples snapshot/memberships, retries with backoff, exposes refresh", () => {
    const src = read("contexts/AppContext.tsx");
    expect(src).toContain("Promise.allSettled([snapshotTask, membershipsTask])");
    // flat retry loop (no recursion into the in-flight guard → no deadlock)
    expect(src).toContain("for (let attempt = 0; attempt < 3; attempt++)");
    expect(src).toContain("refreshUserCrewMemberships: () => Promise<void>;");
    // exposed to consumers + defaulted outside the provider
    expect(src).toContain("refreshUserCrewMemberships,");
    expect(src).toContain("defaultRefreshCrewMemberships");
  });

  it("profile dropdown revalidates on open and matches slugs via lib/crew-slug", () => {
    const src = read("app/franchize/components/FranchizeProfileButton.tsx");
    expect(src).toContain("from \"@/lib/crew-slug\"");
    expect(src).toContain("onOpenChange=");
    expect(src).toContain("refreshUserCrewMemberships()");
    expect(src).toContain("hasCrewMembership(userCrewMemberships, effectiveSlug)");
  });
});
