// Task 105 — regression pins for the verification TRIGGER (the bd948bd0 incident).
//
// Incident: confirmVehicleReturn started requestRentalVerification with `void`
// (fire-and-forget). The server action returned, Vercel froze the lambda, and
// the whole verification (row insert + both ✅/⚠️ DMs) died silently — the
// rental closed with ZERO verification rows and no notifications. Same class
// as the f800r /doc kill (task 102). The analytics-dashboard closure path
// (updateRentalStatus) never even called it.
//
// These pins are deliberately source-level (precedent: ride-share-notify.spec
// "toContain" pins): the failure mode is invisible to unit tests because it
// only manifests when the process is frozen after the response.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  verificationStatusNote,
  type RentalVerificationStatus,
} from "@/app/franchize/lib/rental-verify-core";

const repo = (...p: string[]) => path.resolve(process.cwd(), ...p);
const src = (p: string) => readFileSync(repo(p), "utf8");

describe("task105 · verification trigger survives the serverless invocation", () => {
  it("rental page closure AWAITS the verification request (no `void` fire-and-forget)", () => {
    const s = src("app/rentals/actions.ts");
    expect(s).toContain("await requestRentalVerification({");
    expect(s).not.toContain("void requestRentalVerification");
  });

  it("analytics dashboard closure ALSO requests verification (task105 parity)", () => {
    const s = src("app/franchize/server-actions/rentals-dashboard.ts");
    expect(s).toContain("await requestRentalVerification({");
    expect(s).toContain('source: "analytics_dashboard"');
    // task109: the task102-era `void` twin (source "dashboard") fired a SECOND,
    // dead-on-Vercel request per closure — dedup hid it, but it was waste in
    // the frozen zone and a zombie-DM landmine. Exactly one trigger, awaited.
    expect(s).not.toContain("void requestRentalVerification");
    expect(s).not.toContain('source: "dashboard"');
  });

  it("telegram webhook route pins maxDuration=60 at route level (task109)", () => {
    const s = src("app/api/telegramWebhook/route.ts");
    expect(s).toContain("export const maxDuration = 60");
  });

  it("resend action exists, owner-gated, sends from the STORED snapshot", () => {
    const s = src("app/franchize/server-actions/rental-verify-actions.ts");
    expect(s).toContain("export async function resendVerificationDmsAction");
    expect(s).toContain("loadOrCreateVerificationRow");
    // sends the frozen numbers, not freshly recomputed ones
    expect(s).toMatch(/formatVerificationSummary\(\{[\s\S]*?row\.snapshot/);
    expect(s).toContain("access.isOwner !== true");
  });

  it("resend reports honest delivery + proof copy for the presser (boss 2026-10-20)", () => {
    const s = src("app/franchize/server-actions/rental-verify-actions.ts");
    const fn = s.slice(s.indexOf("export async function resendVerificationDmsAction"));
    // per-chat Telegram failures are collected and returned, never swallowed
    expect(fn).toContain("failed.push");
    expect(fn).toMatch(/sentTo, failed, created, status: row\.status, actorCopied/);
    // 0 delivered is an ERROR now, not a lying success toast
    expect(fn).toMatch(/if \(sentTo\.length === 0\) \{/);
    // keyboardless proof copy when the presser is not operator/owner
    expect(fn).toMatch(/!recipients\.includes\(actorChatId\)/);
    // stale backfill rows (operator_chat_id = NULL) heal before sending
    expect(fn).toMatch(/resolveRentalOperator/);
    expect(fn).toMatch(/update\(\{ operator_chat_id: healed \}\)/);
  });

  it("drawer exposes the resend affordance (task 126: via the сверка card)", () => {
    const drawer = src("app/franchize/[slug]/rentals-analytics/components/RentalDetailDrawer.tsx");
    expect(drawer).toContain("CommissionVerificationCard");
    expect(drawer).toContain("onChanged");
    // the card owns the actions: same server actions, honest labels
    const card = src("app/franchize/components/CommissionVerificationCard.tsx");
    // task151 — the card carries the password-identity params (...verifyActorParams)
    expect(card).toContain("resendVerificationDmsAction({ slug, rentalId, ...verifyActorParams });");
    expect(card).toContain("Завести сверку в TG");
    expect(card).toContain("Выслать сверку");
  });
});

describe("task105 · verificationStatusNote (shared by first DM and resend)", () => {
  const base = { singleParty: false, operatorLabel: "@op", ownerLabel: "@owner" };

  const cases: Array<[RentalVerificationStatus, string, RegExp]> = [
    ["pending", "pending", /@op \(оператор\) и @owner \(владелец\)/],
    ["operator_confirmed", "operator_confirmed", /@op \(оператор\) уже за, осталось @owner/],
    ["owner_confirmed", "owner_confirmed", /@owner \(владелец\) уже за, осталось @op/],
    ["verified", "verified", /подтверждена обеими сторонами/],
    ["disputed", "disputed", /оспорен|спор|разбор/],
  ];

  for (const [status, , re] of cases) {
    it(`maps ${status}`, () => {
      expect(verificationStatusNote({ ...base, status })).toMatch(re);
    });
  }

  it("single-party rentals ask for one ✅ regardless of waiting states", () => {
    for (const status of ["pending", "operator_confirmed", "owner_confirmed"] as RentalVerificationStatus[]) {
      expect(verificationStatusNote({ ...base, singleParty: true, status })).toMatch(/после вашего ✅/);
    }
  });

  it("escapes html in labels", () => {
    expect(verificationStatusNote({ ...base, status: "pending", operatorLabel: "<script>x</script>" })).not.toContain(
      "<script>",
    );
  });
});
