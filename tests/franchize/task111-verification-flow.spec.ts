// Task 111 — verification flow hardening + Aug/Sep/Oct backfill.
//
// Paul's report: closed falcon_gt (17:11) — NO verification notification and
// NO rental_verifications row. Forensics: the rental went through
// confirmVehicleReturn (odometer/deposit/return stamps all present), but the
// verification request sat at the TAIL of the awaited notify chain (receipt
// TG ≤10s + review nudge + ride-share + achievements) under Vercel's ~10s
// default budget — a slow run died before reaching it. Only 2 rows ever
// existed (both return_page luck). Same incident class as bd948bd0.
//
// Fixes pinned here:
//   • maxDuration=60 on BOTH pages hosting closure/verify actions
//     (rental page → confirmVehicleReturn; analytics page → updateRentalStatus
//     + resend/verify/bulk actions);
//   • the verification request is the FIRST awaited step after the money
//     writes in confirmVehicleReturn — BEFORE notifyRentalLifecycle / receipt /
//     nudge / ride-share / achievements (the TG tail can no longer starve it);
//   • updateRentalStatus: exactly ONE requestRentalVerification call site,
//     right after the completion cascade, BEFORE the renter-notify block;
//   • staff cc: requestRentalVerification also notifies crew owner+admins
//     (boss: «notification for verification is sent to crew owner, crew
//     admins») — READ-ONLY copy: no ✅/⚠️ callback buttons in the cc payload
//     (the state machine only accepts the two parties);
//   • resendVerificationDmsAction cc's the staff only when it CREATED the row
//     (pure resends stay party-only);
//   • bulkVerifyFineAction: owner-tier gate, grade='fine' filter, optimistic
//     .eq(status,'pending') lock, dryRun-first contract;
//   • backfill SQL: every row pending + source='backfill_audit' +
//     snapshot.audit.grade, ON CONFLICT DO NOTHING.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repo = (...p: string[]) => path.resolve(process.cwd(), ...p);
const src = (p: string) => readFileSync(repo(p), "utf8");

describe("task111: verification closure triggers run before the TG tail", () => {
  const actions = src("app/rentals/actions.ts");

  it("rental page segment pins maxDuration=60", () => {
    const page = src("app/franchize/[slug]/rental/[id]/page.tsx");
    expect(page).toMatch(/export const maxDuration = 60;/);
  });

  it("confirmVehicleReturn: verification request comes BEFORE notifyRentalLifecycle", () => {
    const vi = actions.indexOf('requestRentalVerification({');
    const ni = actions.indexOf("await notifyRentalLifecycle(rentalId, 'return_confirmed')");
    expect(vi).toBeGreaterThan(-1);
    expect(ni).toBeGreaterThan(-1);
    expect(vi).toBeLessThan(ni);
  });

  it("confirmVehicleReturn: verification block sits after the return event insert (money writes done)", () => {
    const ei = actions.indexOf("type: 'return_confirmed'");
    const vi = actions.indexOf('requestRentalVerification({');
    expect(ei).toBeGreaterThan(-1);
    expect(vi).toBeGreaterThan(ei);
  });

  it("old tail block removed — no verification call after the ride-share/achievements tail", () => {
    // The moved-out block must NOT linger at the tail: after the achievements
    // catch there may be no second requestRentalVerification before `return`.
    const tail = actions.slice(actions.indexOf("[confirmVehicleReturn] Achievement grant failed"));
    expect(tail.indexOf("requestRentalVerification({")).toBe(-1);
  });
});

describe("task111: dashboard closure path", () => {
  const dash = src("app/franchize/server-actions/rentals-dashboard.ts");

  it("analytics page segment pins maxDuration=60", () => {
    const page = src("app/franchize/[slug]/rentals-analytics/page.tsx");
    expect(page).toMatch(/export const maxDuration = 60;/);
  });

  it("exactly ONE requestRentalVerification call site in the dashboard actions", () => {
    const calls = dash.split("requestRentalVerification({").length - 1;
    expect(calls).toBe(1);
  });

  it("the call sits AFTER the completion cascade and BEFORE the renter notify block", () => {
    const cascade = dash.indexOf("auto-close linked equipment rentals on completion");
    const call = dash.indexOf("requestRentalVerification({");
    const renter = dash.indexOf("ALWAYS notify renter on status change");
    expect(cascade).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(cascade);
    expect(renter).toBeGreaterThan(call);
  });

  it("fires on every completed closure (no !silent gate on the verification block)", () => {
    const call = dash.indexOf("requestRentalVerification({");
    const block = dash.slice(Math.max(0, call - 900), call);
    expect(block).toMatch(/status === "completed" && rentalRow\?\.crew_id/);
    expect(block).not.toMatch(/!silent/);
  });
});

describe("task111: staff cc (owner+admins) — read-only copy", () => {
  const lib = src("app/franchize/lib/rental-verify.ts");

  it("ccVerificationToCrewStaff exists and is called from requestRentalVerification", () => {
    expect(lib).toMatch(/export async function ccVerificationToCrewStaff/);
    expect(lib).toMatch(/await ccVerificationToCrewStaff\(\{/);
  });

  it("the staff copy has NO verification game buttons", () => {
    const fn = lib.slice(lib.indexOf("export async function ccVerificationToCrewStaff"));
    const body = fn.slice(0, fn.indexOf("\n}\n\n// ── Callback handling"));
    expect(body).not.toMatch(/vrf_ok_/);
    expect(body).not.toMatch(/vrf_dis_/);
    expect(body).toMatch(/includeMembers: false/); // owner+admins only, no member fanout
  });

  it("resend action cc's the staff only when it CREATED the row", () => {
    const acts = src("app/franchize/server-actions/rental-verify-actions.ts");
    const resend = acts.slice(acts.indexOf("export async function resendVerificationDmsAction"));
    const ccIdx = resend.indexOf("ccVerificationToCrewStaff");
    const createdGate = resend.slice(resend.indexOf("logger.info(`[rental-verify] DMs resent"), ccIdx);
    expect(createdGate).toMatch(/if \(created\) \{/);
  });
});

describe("task111: bulk FINE confirm action", () => {
  const acts = src("app/franchize/server-actions/rental-verify-actions.ts");

  it("exists with owner-tier gate", () => {
    expect(acts).toMatch(/export async function bulkVerifyFineAction/);
    const fn = acts.slice(acts.indexOf("export async function bulkVerifyFineAction"));
    // task151 — the gate moved into the shared resolveVerifyOwnerActor (TG
    // cookie first, password identity as the second accepted path); the
    // owner-only verdict lives inside it (access.isOwner !== true).
    expect(fn).toMatch(/resolveVerifyOwnerActor\(/);
    expect(fn).toMatch(/Массовое подтверждение доступно владельцу или администратору экипажа\./);
    expect(acts).toMatch(/access\.isOwner !== true/);
  });

  it("only grade=fine pending rows, optimistic-locked", () => {
    const fn = acts.slice(acts.indexOf("export async function bulkVerifyFineAction"));
    expect(fn).toMatch(/audit\?\.grade !== "fine"/);
    expect(fn).toMatch(/\.eq\("status", "pending"\)/); // optimistic lock
  });

  it("dry-run first: default dryRun !== false returns the list without writing", () => {
    const fn = acts.slice(acts.indexOf("export async function bulkVerifyFineAction"));
    expect(fn).toMatch(/const dryRun = params\.dryRun !== false;/);
  });

  it("wired into the analytics toolbar with owner-tier gate", () => {
    const client = src("app/franchize/[slug]/rentals-analytics/components/AnalyticsClient.tsx");
    expect(client).toMatch(/bulkVerifyFineAction/);
    expect(client).toMatch(/viewerIsOwnerTier && verStrip\.waiting > 0/);
  });
});

describe("task111: backfill SQL (Aug/Sep/Oct)", () => {
  const sql = src("docs/crewDocs/rental-verifications-backfill-aug-oct-2026-10-18.sql");

  it("168 inserts, all pending backfill rows with audit grades, conflict-safe", () => {
    const inserts = sql.split("insert into public.rental_verifications").length - 1;
    expect(inserts).toBe(168);
    expect(sql).toMatch(/on conflict \(rental_id\) do nothing/gi);
    expect((sql.match(/'backfill_audit'/g) || []).length).toBeGreaterThanOrEqual(168 * 2);
    expect((sql.match(/'pending'/g) || []).length).toBeGreaterThanOrEqual(168);
  });

  it("every snapshot carries the audit block", () => {
    const inserts = sql.split("$snap$");
    // pairs: open/close per statement → odd chunks are the JSON payloads
    const payloads = inserts.filter((_, i) => i % 2 === 1);
    expect(payloads.length).toBe(168);
    for (const p of payloads) {
      const snap = JSON.parse(p);
      expect(snap.audit).toBeDefined();
      expect(["fine", "almost", "sus"]).toContain(snap.audit.grade);
      expect(Array.isArray(snap.audit.notes)).toBe(true);
      expect(typeof snap.total).toBe("number");
    }
  });

  it("carries no secrets", () => {
    expect(sql).not.toMatch(/eyJ|ghp_|sk-/);
  });
});
