// Task 114 — service records are not rentals + auto-audit grade at request time.
//
// Paul: «some rentals are really service records disguised as rentals, for
// example: 24277629 — VIP_BIKE Уборка шланга (за метр) … so exclude such from
// sus in audit». Forensics: the backfill (2026-10-18) created pending
// verification rows for 44 cars.type='service' records + 2 equipment docs
// (Meta Universal Helmet ×2) — the LIVE flow skips those at closure
// («no operator bonus — nothing to verify»), so the rows would linger as
// pending noise forever and poison every future month's tally.
//
// Fixes pinned here:
//   • cleanup SQL deletes ONLY svc/equipment + pending + backfill_audit rows
//     (verified/disputed/operator_confirmed are never touched; live-flow rows
//     are never touched);
//   • the auto-trigger (requestRentalVerification) keeps skipping
//     service/equipment docs — and now stamps snapshot.audit for every row it
//     DOES create, so bulkVerifyFineAction («✅ fine за ГГГГ-ММ») keeps
//     working for months created after the backfill;
//   • loadOrCreateVerificationRow (drawer manual/resend) refuses to spawn
//     rows for service/equipment docs and stamps audit too;
//   • getVerificationStatusMap carries snapshot->audit so the drawer shows
//     WHY a row is almost/sus (visible notes, not hover-only);
//   • computeRentalAuditGrade = the backfill audit's 8 checks (C0–C8),
//     deposit-aware, pure and unit-tested.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildAuditStamp, computeRentalAuditGrade } from "@/app/franchize/lib/rental-audit";

const repo = (...p: string[]) => path.resolve(process.cwd(), ...p);
const src = (p: string) => readFileSync(repo(p), "utf8");

// ── pure grader ───────────────────────────────────────────────────────────────

const base = {
  status: "completed",
  totalCost: 10000,
  depositAmount: null,
  depositReturned: null,
  metadata: {},
};

describe("task114: computeRentalAuditGrade (the 8 backfill checks, ported)", () => {
  it("service records grade fine with an explicit note — never sus", () => {
    const hose = computeRentalAuditGrade({
      ...base,
      totalCost: 10.35,
      metadata: { source: "doc_command", doc_vehicle_title: "Уборка шланга (за метр)" },
      vehicleType: "service",
    });
    expect(hose.grade).toBe("fine");
    expect(hose.notes.join(" ")).toContain("услуги");
  });

  it("equipment docs (item_type or car type) grade fine too", () => {
    expect(
      computeRentalAuditGrade({ ...base, metadata: { item_type: "equipment" } }).grade,
    ).toBe("fine");
    expect(computeRentalAuditGrade({ ...base, vehicleType: "equipment" }).grade).toBe("fine");
  });

  it("C1: bike_price+equipment ≠ total_cost → sus", () => {
    const r = computeRentalAuditGrade({
      ...base,
      metadata: { bike_price: 4450, equipment_price: 0 },
      totalCost: 3500,
    });
    expect(r.grade).toBe("sus");
    expect(r.notes.join(" ")).toContain("bike_price");
  });

  it("C2: payment_split coherent with total → fine; mismatch → sus; deposit in split.cash → almost", () => {
    const ret = { return_confirmed_by: "x", odometer_after: 1 };
    const ok = computeRentalAuditGrade({
      ...base,
      metadata: { payment_split: { bank: 10000, cash: 0 }, ...ret },
    });
    expect(ok.grade).toBe("fine");

    const sus = computeRentalAuditGrade({
      ...base,
      totalCost: 7750,
      depositAmount: 20000,
      metadata: { payment_split: { bank: 8500, cash: 0 }, ...ret },
    });
    expect(sus.grade).toBe("sus");
    expect(sus.notes.join(" ")).toContain("payment_split");

    // deposit visible only in the artifact → the almost-note fires, but the
    // books stay coherent (bank+cash == total+deposit) → grade almost.
    const depInCash = computeRentalAuditGrade({
      ...base,
      totalCost: 5000,
      depositAmount: 0,
      metadata: { payment_split: { bank: 5000, cash: 10000 }, ...ret },
      artifact: { totalSum: 5000, depositRub: 10000 },
    });
    expect(depInCash.grade).toBe("almost");
    expect(depInCash.notes.join(" ")).toContain("payment_split.cash");

    // deposit-aware: bank+cash == total+deposit is COHERENT (old /doc template)
    const oldDoc = computeRentalAuditGrade({
      ...base,
      totalCost: 5000,
      depositAmount: 10000,
      depositReturned: true,
      metadata: { payment_split: { bank: 5000, cash: 10000 }, ...ret },
    });
    expect(oldDoc.grade).toBe("fine");
  });

  it("C3: completed without return stamps / odometer → almost", () => {
    const r = computeRentalAuditGrade({ ...base, metadata: {} });
    expect(r.grade).toBe("almost");
    expect(r.notes).toHaveLength(2);

    const withReturn = computeRentalAuditGrade({
      ...base,
      metadata: { return_confirmed_by: "555000111", return_confirmed_at: "2026-10-18T14:00:00Z", odometer_after: 970 },
    });
    expect(withReturn.grade).toBe("fine");
  });

  it("C4: doc_command artifact missing → sus; paper-vs-books mismatch → sus; deposit-aware ok", () => {
    const noArt = computeRentalAuditGrade({
      ...base,
      metadata: { source: "doc_command", return_confirmed_by: "x", odometer_after: 1 },
    });
    expect(noArt.grade).toBe("sus");

    const mismatch = computeRentalAuditGrade({
      ...base,
      totalCost: 3500,
      depositAmount: 10000,
      metadata: { source: "doc_command", return_confirmed_by: "x", odometer_after: 1 },
      artifact: { totalSum: 14450, depositRub: 10000 },
    });
    expect(mismatch.grade).toBe("sus");
    expect(mismatch.notes.join(" ")).toContain("бумага");

    const oldTemplate = computeRentalAuditGrade({
      ...base,
      totalCost: 3500,
      depositAmount: 10000,
      depositReturned: true,
      metadata: { source: "doc_command", return_confirmed_by: "x", odometer_after: 1 },
      artifact: { totalSum: 13500, depositRub: 10000 },
      createdByOperatorChatId: "123",
    });
    expect(oldTemplate.grade).toBe("fine");
  });

  it("C5: doc_command without operator attribution → almost", () => {
    const r = computeRentalAuditGrade({
      ...base,
      metadata: { source: "doc_command", return_confirmed_by: "x", odometer_after: 1 },
      artifact: { totalSum: 10000, depositRub: null },
      createdByOperatorChatId: null,
    });
    expect(r.grade).toBe("almost");
    expect(r.notes.join(" ")).toContain("атрибутирован");
  });

  it("C6: unreturned deposit on a closed rental → almost", () => {
    const r = computeRentalAuditGrade({
      ...base,
      depositAmount: 10000,
      depositReturned: null,
      metadata: { return_confirmed_by: "x", odometer_after: 1 },
    });
    expect(r.notes.join(" ")).toContain("залог");
  });

  it("C0: test rides cap at almost (never sus when otherwise clean)", () => {
    const r = computeRentalAuditGrade({
      ...base,
      metadata: { renter_name: "тест 69", return_confirmed_by: "x", odometer_after: 1 },
    });
    expect(r.grade).toBe("almost");
    expect(r.notes.join(" ")).toContain("тестовая");
  });

  it("C7: end before start → sus; C8: zero total without override → almost", () => {
    expect(
      computeRentalAuditGrade({
        ...base,
        metadata: { return_confirmed_by: "x", odometer_after: 1 },
        requestedStartDate: "2026-10-05T10:00:00Z",
        requestedEndDate: "2026-10-04T10:00:00Z",
      }).grade,
    ).toBe("sus");

    const gift = computeRentalAuditGrade({
      ...base,
      totalCost: 0,
      metadata: { return_confirmed_by: "x", odometer_after: 1 },
    });
    expect(gift.grade).toBe("almost");

    const giftMarked = computeRentalAuditGrade({
      ...base,
      totalCost: 0,
      metadata: { return_confirmed_by: "x", odometer_after: 1, price_overridden: true },
    });
    expect(giftMarked.grade).toBe("fine");
  });

  it("cancelled rentals never stay sus", () => {
    const r = computeRentalAuditGrade({
      ...base,
      status: "cancelled",
      metadata: { bike_price: 5000 },
      totalCost: 100,
    });
    expect(r.grade).toBe("almost");
  });

  it("buildAuditStamp freezes grade + notes + checker", () => {
    const stamp = buildAuditStamp({ grade: "fine", notes: [] }, "2026-10-19T10:00:00.000Z", "auto-audit-2026-10-19");
    expect(stamp).toEqual({ grade: "fine", notes: [], checked_at: "2026-10-19T10:00:00.000Z", checker: "auto-audit-2026-10-19" });
  });
});

// ── wiring pins ───────────────────────────────────────────────────────────────

describe("task114: every new verification row is graded + svc/equipment stay out", () => {
  it("auto-trigger still skips service/equipment docs before any insert", () => {
    const s = src("app/franchize/lib/rental-verify.ts");
    expect(s).toMatch(/meta\.item_type === "equipment" \|\| vehicle\?\.type === "equipment" \|\| vehicle\?\.type === "service"/);
    // skip sits BEFORE the insert payload build
    const skip = s.indexOf('reason: "equipment/service doc — no operator bonus"');
    const insert = s.indexOf('status: "pending" as const,');
    expect(skip).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(skip);
  });

  it("auto-trigger stamps snapshot.audit from the pure grader before the insert", () => {
    const s = src("app/franchize/lib/rental-verify.ts");
    expect(s).toContain('import { buildAuditStamp, computeRentalAuditGrade } from "@/app/franchize/lib/rental-audit";');
    const stamp = s.indexOf("snapshot.audit = buildAuditStamp(");
    const insert = s.indexOf("const insertPayload = {");
    expect(stamp).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(stamp);
    expect(s).toContain('"auto-audit-2026-10-19"');
    // the stamp is wrapped in try/catch — an audit failure must never kill the request
    expect(s).toMatch(/catch \(auditErr\) \{[\s\S]{0,200}non-fatal/s);
    // artifact lookup for /doc rentals (paper-vs-books check needs it)
    expect(s).toMatch(/rental_contract_artifacts"\)\s*\n?\s*\.select\("total_sum, deposit_rub"\)/);
    // audit needs deposit columns — the rental select now carries them
    expect(s).toMatch(/deposit_amount, deposit_returned,\n\s*created_by_operator_chat_id/);
  });

  it("drawer load-or-create refuses svc/equipment docs and stamps audit too", () => {
    const s = src("app/franchize/server-actions/rental-verify-actions.ts");
    expect(s).toContain("Документы услуг и экипировки не требуют сверки — бонуса оператора нет.");
    const skip = s.indexOf("не требуют сверки");
    const snap = s.indexOf("await computeRentalVerificationSnapshot({", skip);
    expect(skip).toBeGreaterThan(-1);
    expect(snap).toBeGreaterThan(skip);
    expect(s).toContain("snapshot.audit = buildAuditStamp(");
    // both rental selects carry the deposit columns for the grader
    expect(s.match(/deposit_amount, deposit_returned,/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("status map carries snapshot->audit so the drawer can show the WHY", () => {
    const s = src("app/franchize/lib/rental-verify.ts");
    expect(s).toContain("audit:snapshot->audit");
    expect(src("app/franchize/lib/rental-verify-core.ts")).toContain("audit?: { grade?: string; notes?: string[] } | null;");
  });

  it("dashboard enrich attaches verificationAudit", () => {
    const s = src("app/franchize/server-actions/rentals-dashboard.ts");
    expect(s).toContain("verificationAudit: verificationMap.get(item.rental_id)?.audit ?? null,");
  });

  it("drawer shows the audit grade chip + visible notes (not hover-only)", () => {
    const s = src("app/franchize/[slug]/rentals-analytics/components/RentalDetailDrawer.tsx");
    expect(s).toContain("audit: sus");
    expect(s).toContain("audit: почти ок");
    expect(s).toMatch(/verificationAudit!\.notes!\.map/);
  });

  it("cards prefix sus/almost on the verification chip", () => {
    const s = src("app/franchize/[slug]/rentals-analytics/components/AnalyticsRentalCard.tsx");
    expect(s).toMatch(/verificationAudit\?\.grade === "sus"\s*\n?\s*\? "🚨 "/);
    expect(s).toMatch(/verificationAudit\?\.grade === "almost"/);
  });

  it("bulk fine sweep still only touches pending + grade=fine (unchanged)", () => {
    const s = src("app/franchize/server-actions/rental-verify-actions.ts");
    expect(s).toMatch(/audit\?\.grade !== "fine"/);
    expect(s).toMatch(/\.eq\("status", "pending"\)/);
  });
});

// ── cleanup SQL pins ──────────────────────────────────────────────────────────

describe("task114: svc/equipment cleanup SQL is triple-guarded", () => {
  const sql = src("docs/crewDocs/verification-svc-eq-cleanup-2026-10-19.sql");

  it("deletes only svc/equipment docs", () => {
    expect(sql).toMatch(/c\.type = 'service'/);
    expect(sql).toMatch(/c\.type = 'equipment'\s+or coalesce\(r\.metadata->>'item_type', ''\) = 'equipment'/);
  });

  it("never touches verified/disputed/live rows — pending + backfill_audit only", () => {
    expect((sql.match(/v\.status = 'pending'/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((sql.match(/v\.source = 'backfill_audit'/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it("is idempotent + has post-checks and expected counts documented", () => {
    expect(sql).toContain("44 service rows + 2 equipment rows");
    expect(sql).toContain("remaining_on_service_cars");
    expect(sql).toContain("remaining_on_equipment_docs");
    expect(sql).toContain("2026-09-30T21:00:00Z"); // October sanity window
  });

  it("carries no secrets", () => {
    expect(sql).not.toMatch(/eyJ|ghp_|sk-/);
  });
});
