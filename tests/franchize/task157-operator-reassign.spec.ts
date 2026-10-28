// tests/franchize/task157-operator-reassign.spec.ts
//
// Task157 — salary-operator reassignment from the analytics tableview.
//
// Boss (2026-10-28): the «Оператор (ЗП)» column cells get a dropdown; choosing
// a different operator reassigns the rental's commission to them — «proper
// full reassignment», quick counters recalc, and it must work in the
// analytics opened on PC via the /analytics_pass password (no TG cookie).
//
// The write itself is reassignRentalOperatorAction (server action — gated by
// resolveVerifyOwnerActor, needs Supabase; covered by live-prod checks). What
// vitest CAN pin — and what breaks the money math silently if regressed — is
// the PURE attribution layer: the metadata override must sit at the TOP of
// resolveRentalOperator's chain so EVERY consumer (CSV builder's «Оператор
// (ЗП)» column + operator-split pills, computeCategoryBonuses profile math,
// my-work, verification snapshot) flips together.

import { describe, expect, it } from "vitest";

import {
  ATTRIBUTION_SOURCE_LABELS,
  pickShiftAt,
  readSalaryOperatorOverride,
  resolveRentalOperator,
  type ShiftLike,
} from "@/app/franchize/lib/operator-attribution";

describe("task157 · readSalaryOperatorOverride", () => {
  it("reads user_id from the override object", () => {
    expect(
      readSalaryOperatorOverride({
        salary_operator_override: { user_id: "413553377", by: "1", at: "2026-10-28T18:00:00Z" },
      }),
    ).toBe("413553377");
  });

  it("trims and rejects blank ids", () => {
    expect(readSalaryOperatorOverride({ salary_operator_override: { user_id: "  " } })).toBeNull();
    expect(readSalaryOperatorOverride({ salary_operator_override: { user_id: " 42 " } })).toBe("42");
  });

  it("tolerates garbage metadata (missing / wrong shapes)", () => {
    expect(readSalaryOperatorOverride(null)).toBeNull();
    expect(readSalaryOperatorOverride(undefined)).toBeNull();
    expect(readSalaryOperatorOverride({})).toBeNull();
    expect(readSalaryOperatorOverride({ salary_operator_override: "not-an-object" })).toBeNull();
    expect(readSalaryOperatorOverride({ salary_operator_override: 42 })).toBeNull();
    expect(readSalaryOperatorOverride({ salary_operator_override: { nope: true } })).toBeNull();
  });
});

describe("task157 · resolveRentalOperator — override sits at the TOP of the chain", () => {
  const OWNER_ACTOR = "999000111";
  const OLD_OP = "413553377"; // physically worked the rental (/doc creator)
  const NEW_OP = "356282674"; // who the ЗП goes to after the reassignment

  const SHIFTS: ShiftLike[] = [
    { member_id: OLD_OP, clock_in_time: "2026-10-03T06:00:00Z", clock_out_time: "2026-10-03T18:00:00Z" },
  ];

  it("override beats EVERY automatic source (doc_command / handout / return / shift)", () => {
    const metadata = {
      created_by_operator_chat_id: OLD_OP,
      pickup_freeze: { frozen_by: OLD_OP },
      return_confirmed_by: OLD_OP,
      salary_operator_override: { user_id: NEW_OP, by: OWNER_ACTOR, at: "2026-10-28T18:00:00Z" },
    };
    const attr = resolveRentalOperator(
      { created_by_operator_chat_id: OLD_OP, created_at: "2026-10-03T12:00:00Z", metadata },
      SHIFTS,
    );
    expect(attr).toEqual({ operatorId: NEW_OP, source: "override" });
  });

  it("override works on a rental with NO other attribution evidence at all", () => {
    const attr = resolveRentalOperator(
      { created_at: "2026-10-04T12:00:00Z", metadata: { salary_operator_override: { user_id: NEW_OP } } },
      [],
    );
    expect(attr).toEqual({ operatorId: NEW_OP, source: "override" });
  });

  it("without the override the chain behaves exactly as before (doc_command wins)", () => {
    const attr = resolveRentalOperator(
      {
        created_by_operator_chat_id: OLD_OP,
        created_at: "2026-10-03T12:00:00Z",
        metadata: { salary_operator_override: { user_id: "" } }, // blank → ignored
      },
      SHIFTS,
    );
    expect(attr).toEqual({ operatorId: OLD_OP, source: "doc_command" });
  });

  it("the label for the new source is «переназначено» (Атрибуция ЗП cell)", () => {
    expect(ATTRIBUTION_SOURCE_LABELS.override).toBe("переназначено");
  });

  it("shift picking itself is untouched (guard against accidental regressions)", () => {
    expect(pickShiftAt(SHIFTS, Date.parse("2026-10-03T12:00:00Z"))?.member_id).toBe(OLD_OP);
  });
});
