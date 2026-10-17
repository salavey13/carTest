// tests/franchize/task103-verify-analytics.spec.ts
//
// Task 103 — on-the-fly verification UI helpers (rentals analytics):
//   • verificationStripData  — the «🤝 Сверка: N ✅ · M ⏳ · K ⚠️» numbers;
//   • applyVerificationListFilter — the quick-filter buckets;
//   • isVerificationState    — guard against unknown/absent status values.
// Pure module (zero imports) — no mocks needed. The semantics that MATTER:
// rows WITHOUT verification data are invisible to every non-«all» bucket, and
// the strip stays hidden until at least one row carries data (pre-feature
// crews / missing SQL must see no new UI, task101 degradation lesson).
import { describe, expect, it } from "vitest";
import {
  applyVerificationListFilter,
  isVerificationState,
  verificationStripData,
} from "@/app/franchize/[slug]/rentals-analytics/components/lib/verification-utils";

type Row = { rental_id: string; verificationStatus?: string | null };

const R = (id: string, verificationStatus?: string | null): Row => ({ rental_id: id, verificationStatus });

describe("task103: isVerificationState", () => {
  it("accepts the five rental_verifications states", () => {
    for (const s of ["pending", "operator_confirmed", "owner_confirmed", "verified", "disputed"]) {
      expect(isVerificationState(s)).toBe(true);
    }
  });

  it("rejects null/undefined/unknown strings (doc-verification «verified» of a DIFFERENT feature included)", () => {
    expect(isVerificationState(null)).toBe(false);
    expect(isVerificationState(undefined)).toBe(false);
    expect(isVerificationState("")).toBe(false);
    expect(isVerificationState("revoked")).toBe(false);
    expect(isVerificationState(42)).toBe(false);
  });
});

describe("task103: verificationStripData", () => {
  it("counts verified/waiting/disputed; both single-sided confirms are «waiting»", () => {
    const rows = [
      R("a", "verified"),
      R("b", "verified"),
      R("c", "pending"),
      R("d", "operator_confirmed"),
      R("e", "owner_confirmed"),
      R("f", "disputed"),
    ];
    expect(verificationStripData(rows)).toEqual({
      hasAny: true,
      verified: 2,
      waiting: 3,
      disputed: 1,
    });
  });

  it("hasAny=false when NO row carries verification data → strip stays hidden", () => {
    const rows = [R("a", null), R("b", undefined), R("c")];
    const strip = verificationStripData(rows);
    expect(strip.hasAny).toBe(false);
    expect(strip.verified + strip.waiting + strip.disputed).toBe(0);
  });

  it("ignores foreign status strings instead of counting them (defensive vs newer DB enums)", () => {
    const rows = [R("a", "verified"), R("b", "some_future_state"), R("c", null)];
    expect(verificationStripData(rows)).toEqual({ hasAny: true, verified: 1, waiting: 0, disputed: 0 });
  });
});

describe("task103: applyVerificationListFilter", () => {
  const rows = [
    R("verified-1", "verified"),
    R("waiting-pending", "pending"),
    R("waiting-op", "operator_confirmed"),
    R("waiting-owner", "owner_confirmed"),
    R("disputed-1", "disputed"),
    R("no-data", null),
  ];

  it("«all» returns the list untouched (same array semantics for render stability)", () => {
    expect(applyVerificationListFilter(rows, "all")).toBe(rows);
  });

  it("«waiting» = pending + both single-sided confirms, NO no-data rows", () => {
    const out = applyVerificationListFilter(rows, "waiting");
    expect(out.map((r) => r.rental_id)).toEqual(["waiting-pending", "waiting-op", "waiting-owner"]);
  });

  it("«disputed» shows only disputed rows", () => {
    expect(applyVerificationListFilter(rows, "disputed").map((r) => r.rental_id)).toEqual(["disputed-1"]);
  });

  it("«verified» shows only verified rows", () => {
    expect(applyVerificationListFilter(rows, "verified").map((r) => r.rental_id)).toEqual(["verified-1"]);
  });

  it("empty result for buckets with no matches (UI renders the friendly empty state)", () => {
    expect(applyVerificationListFilter([R("x", null)], "disputed")).toEqual([]);
  });
});
