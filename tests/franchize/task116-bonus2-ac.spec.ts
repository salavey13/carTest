// Task 116 — BONUS2 lock-in (boss 2026-10-20: «yes to Task A + Task C»).
//
// Task A («уведомления при закрытии из модалки»): closing a rental from the
// rentals-analytics drawer MUST produce the verification notification chain —
// the awaited requestRentalVerification right after the completion cascade
// (before the cosmetic TG tail — the falcon-gt lesson), which DMs both parties
// with the ✅/⚠️ keyboard and cc's the crew owner + admins (read-only copy +
// deeplink). Pinned here so a future reorder can never starve it again.
//
// Task C («кнопка "发起 verification"»): the analytics drawer's button
// initiates the сверка when the row is missing and re-sends otherwise — and
// since the review round the LABEL says which one it does («➕ завести сверку
// и выслать в TG» vs «📤 выслать сверку в TG»).
//
// All assertions are source pins (repo convention) — no server imports.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repo = (...p: string[]) => path.resolve(process.cwd(), ...p);
const src = (p: string) => readFileSync(repo(p), "utf8");

const dashboardSrc = src("app/franchize/server-actions/rentals-dashboard.ts");
const verifySrc = src("app/franchize/lib/rental-verify.ts");
const botSrc = src("app/rentals/actions.ts");
const drawerSrc = src("app/franchize/[slug]/rentals-analytics/components/RentalDetailDrawer.tsx");

// ── Task A: modal close → verification notification chain ───────────────────

describe("task116 · Task A: modal close fires the verification chain", () => {
  it("updateRentalStatus requests verification on EVERY completed closure (before the TG tail)", () => {
    const parity = dashboardSrc.slice(
      dashboardSrc.indexOf("Task 105 PARITY: verification request on dashboard closures"),
    );
    const head = parity.slice(0, parity.indexOf("Always notify renter on status change"));
    expect(head).toContain('status === "completed" && rentalRow?.crew_id');
    expect(head).toContain('source: "analytics_dashboard"');
    // awaited (Vercel lambda freeze lesson, bd948bd0)
    expect(head).toContain("await requestRentalVerification(");
  });

  it("the request sits ABOVE the renter-notify tail (falcon-gt ordering, task111 parity)", () => {
    const verifyAt = dashboardSrc.indexOf("Task 105 PARITY: verification request on dashboard closures");
    const tailAt = dashboardSrc.indexOf("ALWAYS notify renter on status change");
    expect(verifyAt).toBeGreaterThan(-1);
    expect(tailAt).toBeGreaterThan(verifyAt);
  });

  it("the verification request DMs both parties and cc's crew owner + admins (read-only copy)", () => {
    // parties with the ✅/⚠️ keyboard
    expect(verifySrc).toContain("verificationKeyboard(rental.rental_id)");
    // staff cc: owner + admins/co_owner only (no member fanout)
    expect(verifySrc).toContain("ccVerificationToCrewStaff(");
    expect(verifySrc).toContain("resolveLeadNotifyRecipients(params.crewSlug, { includeMembers: false })");
    // the actor + attribution chain never double-receives
    expect(verifySrc).toContain("exclude: [");
  });

  it("the BOT close path (return page) fires the same chain — parity", () => {
    expect(botSrc).toContain('source: "return_page"');
    expect(botSrc).toContain("await requestRentalVerification(");
    // the falcon ordering comment: FIRST after the money writes, before the TG tail
    expect(botSrc).toContain("VF-FIX 2026-10-18 (falcon-gt)");
    expect(botSrc).toContain("the FIRST thing after the money writes");
  });
});

// ── Task C: drawer initiate/resend button ────────────────────────────────────

describe("task116 · Task C: drawer initiate-or-resend", () => {
  it("the button renders for completed non-verified rentals (rowless included) at owner-tier", () => {
    expect(drawerSrc).toContain('canVerify && rental.status === "completed" && ver !== "verified" && onResendDms');
  });

  it("the label says what the tap does: initiate (no row) vs resend (row exists)", () => {
    expect(drawerSrc).toContain('"➕ завести сверку и выслать в TG"');
    expect(drawerSrc).toContain('"📤 выслать сверку в TG"');
    expect(drawerSrc).toContain("ver === null");
  });

  it("the server action still creates the missing row + staff cc (loadOrCreateVerificationRow)", () => {
    const actions = src("app/franchize/server-actions/rental-verify-actions.ts");
    expect(actions).toContain("loadOrCreateVerificationRow");
    expect(actions).toContain("resendVerificationDmsAction");
  });
});
