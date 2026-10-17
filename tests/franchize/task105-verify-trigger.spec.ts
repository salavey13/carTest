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
  });

  it("resend action exists, owner-gated, sends from the STORED snapshot", () => {
    const s = src("app/franchize/server-actions/rental-verify-actions.ts");
    expect(s).toContain("export async function resendVerificationDmsAction");
    expect(s).toContain("loadOrCreateVerificationRow");
    // sends the frozen numbers, not freshly recomputed ones
    expect(s).toMatch(/formatVerificationSummary\(\{[\s\S]*?row\.snapshot/);
    expect(s).toContain("access.isOwner !== true");
  });

  it("drawer exposes the resend button wired to the action", () => {
    const drawer = src("app/franchize/[slug]/rentals-analytics/components/RentalDetailDrawer.tsx");
    expect(drawer).toContain("onResendDms");
    expect(drawer).toContain("выслать сверку в TG");
    const client = src("app/franchize/[slug]/rentals-analytics/components/AnalyticsClient.tsx");
    expect(client).toContain("handleResendDms");
    expect(client).toContain("resendVerificationDmsAction({ slug: initialSlug, rentalId: selectedRentalId })");
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
