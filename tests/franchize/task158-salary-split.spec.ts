// tests/franchize/task158-salary-split.spec.ts
//
// TASK158 — the GENERATED «Оператор (ЗП)» split (boss 2026-10-29).
//
// «instead of adding dropdown to this column lets make this column generated;
// it should contain automatically generated list of operators who were
// engaged somehow in rental: we have 3 other columns to base this list on:
// "Оператор создал", "Оператор выдал", "Оператор принял" — lets make these
// three dropdowns instead. If all 3 are same everything goes to same dude,
// and in case columns contain several dudes — split equally … EDGE CASE:
// when rider created rental himself via web app then "Оператор создал" is
// empty — then split 1/2 between who handed out/in.»
//
// The money rule: each FILLED role carries an EQUAL weight (1/N of the
// commission), an operator holding several roles accumulates them. The
// retired task157 single-operator override is gone — editing the roles IS
// the reassignment now. Pinned here: the split engine, the cell format the
// CSV builder writes and the tableview parses, the integer-ruble remainder
// rule, and the source-level wiring (role dropdowns + shared write core +
// TG ✍️ buttons).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  ATTRIBUTION_SOURCE_LABELS,
  resolveRentalOperator,
  resolveRentalOperatorSplit,
  rentalRoleIds,
  type ShiftLike,
} from "@/app/franchize/lib/operator-attribution";
import {
  formatSalarySplitCell,
  parseSalarySplitCell,
  splitAmountByFractions,
} from "@/lib/salary-split";

const PAUL = "413553377";
const ILYA = "356282674";
const GUNDER = "5219192922";

const SHIFTS: ShiftLike[] = [
  { member_id: PAUL, clock_in_time: "2026-10-09T06:00:00Z", clock_out_time: "2026-10-09T18:00:00Z" },
];

describe("task158 · resolveRentalOperatorSplit — the money rule", () => {
  it("all 3 roles same dude → 100% to him (reduced 1/1)", () => {
    const { shares, source } = resolveRentalOperatorSplit(
      {
        created_by_operator_chat_id: PAUL,
        created_at: "2026-10-09T12:00:00Z",
        metadata: { pickup_freeze: { frozen_by: PAUL }, return_confirmed_by: PAUL },
      },
      SHIFTS,
    );
    expect(shares).toEqual([
      { operatorId: PAUL, fraction: { n: 1, d: 1 }, roles: ["doc_command", "handout", "return"] },
    ]);
    expect(source).toBe("doc_command");
  });

  it("created by another, handed out AND received by one dude → 1/3 creator + 2/3 hander", () => {
    // THE BOSS CASE: «if handed out AND handed in by same dude, and created
    // by another then maybe split 1/3 to creator and 2/3 comission».
    const { shares, source } = resolveRentalOperatorSplit(
      {
        created_by_operator_chat_id: ILYA,
        created_at: "2026-10-09T12:00:00Z",
        metadata: { pickup_freeze: { frozen_by: PAUL }, return_confirmed_by: PAUL },
      },
      SHIFTS,
    );
    expect(source).toBe("split");
    expect(shares.map((s) => [s.operatorId, s.fraction.n, s.fraction.d])).toEqual([
      [ILYA, 1, 3],
      [PAUL, 2, 3],
    ]);
  });

  it("EDGE CASE — empty creator (rider self-ordered via web app): 1/2 + 1/2", () => {
    const { shares, source } = resolveRentalOperatorSplit(
      {
        created_at: "2026-10-09T12:00:00Z",
        metadata: { pickup_freeze: { frozen_by: PAUL }, return_confirmed_by: ILYA },
      },
      SHIFTS,
    );
    expect(source).toBe("split");
    expect(shares.map((s) => [s.fraction.n, s.fraction.d])).toEqual([
      [1, 2],
      [1, 2],
    ]);
  });

  it("three DIFFERENT dudes → 1/3 each, in the создал → выдал → принял order", () => {
    const { shares } = resolveRentalOperatorSplit(
      {
        created_by_operator_chat_id: ILYA,
        created_at: "2026-10-09T12:00:00Z",
        metadata: { pickup_freeze: { frozen_by: PAUL }, return_confirmed_by: GUNDER },
      },
      SHIFTS,
    );
    expect(shares.map((s) => s.operatorId)).toEqual([ILYA, PAUL, GUNDER]);
    expect(shares.every((s) => s.fraction.n === 1 && s.fraction.d === 3)).toBe(true);
  });

  it("only the receiver filled (no creator, no handout) → 100% to him", () => {
    const { shares, source } = resolveRentalOperatorSplit(
      { created_at: "2026-10-09T12:00:00Z", metadata: { return_confirmed_by: GUNDER } },
      SHIFTS,
    );
    expect(source).toBe("return");
    expect(shares).toEqual([
      { operatorId: GUNDER, fraction: { n: 1, d: 1 }, roles: ["return"] },
    ]);
  });

  it("NO role evidence → the shift cross-ref covers 100% (the old last resort)", () => {
    const { shares, source } = resolveRentalOperatorSplit(
      { created_at: "2026-10-09T12:00:00Z", metadata: {} },
      SHIFTS,
    );
    expect(source).toBe("shift");
    expect(shares).toEqual([
      { operatorId: PAUL, fraction: { n: 1, d: 1 }, roles: ["shift"] },
    ]);
  });

  it("the legacy override metadata is IGNORED (retired source) — roles rule the money", () => {
    const { shares } = resolveRentalOperatorSplit(
      {
        created_by_operator_chat_id: ILYA,
        created_at: "2026-10-09T12:00:00Z",
        metadata: {
          pickup_freeze: { frozen_by: PAUL },
          return_confirmed_by: PAUL,
          salary_operator_override: { user_id: GUNDER, by: "1", at: "2026-10-28T18:00:00Z" },
        },
      },
      SHIFTS,
    );
    expect(shares.map((s) => s.operatorId)).toEqual([ILYA, PAUL]);
  });

  it("rentalRoleIds trims and tolerates garbage", () => {
    expect(
      rentalRoleIds({
        created_by_operator_chat_id: ` ${PAUL} `,
        metadata: { pickup_freeze: { frozen_by: 42 }, return_confirmed_by: "   " },
      }),
    ).toEqual({ created: PAUL, handedOut: null, received: null });
  });

  it("top shareholder: largest fraction wins the single face; source «раздел ЗП»", () => {
    expect(ATTRIBUTION_SOURCE_LABELS.split).toBe("раздел ЗП");
    const top = resolveRentalOperator(
      {
        created_by_operator_chat_id: ILYA,
        created_at: "2026-10-09T12:00:00Z",
        metadata: { pickup_freeze: { frozen_by: PAUL }, return_confirmed_by: PAUL },
      },
      SHIFTS,
    );
    expect(top).toEqual({ operatorId: PAUL, source: "split" });
  });
});

describe("task158 · salary-split cell format (CSV ↔ tableview round-trip)", () => {
  it("single operator prints bare; splits print «label (n/d)» joined by ' + '", () => {
    expect(formatSalarySplitCell([{ label: "@salavey13", fraction: { n: 1, d: 1 } }])).toBe("@salavey13");
    expect(
      formatSalarySplitCell([
        { label: "@I_O_S_NN", fraction: { n: 2, d: 3 } },
        { label: "Гундермурд", fraction: { n: 1, d: 3 } },
      ]),
    ).toBe("@I_O_S_NN (2/3) + Гундермурд (1/3)");
  });

  it("parses back losslessly; degrades unknown formats to 1/1", () => {
    const parts = parseSalarySplitCell("@I_O_S_NN (2/3) + Гундермурд (1/3)");
    expect(parts).toEqual([
      { label: "@I_O_S_NN", fraction: { n: 2, d: 3 } },
      { label: "Гундермурд", fraction: { n: 1, d: 3 } },
    ]);
    expect(parseSalarySplitCell("@salavey13")).toEqual([
      { label: "@salavey13", fraction: { n: 1, d: 1 } },
    ]);
    expect(parseSalarySplitCell("")).toEqual([]);
    expect(parseSalarySplitCell("weird cell")).toEqual([
      { label: "weird cell", fraction: { n: 1, d: 1 } },
    ]);
  });

  it("splitAmountByFractions: integer rubles, remainder to the largest share, Σ = total", () => {
    // 1000 × 1/3 → 333/333/333, remainder 1 → first largest (all equal → index 0)
    expect(splitAmountByFractions(1000, [{ n: 1, d: 3 }, { n: 1, d: 3 }, { n: 1, d: 3 }])).toEqual([334, 333, 333]);
    // 1250 × 2/3 + 1/3 → 833 + 417 = 1250 exactly
    expect(splitAmountByFractions(1250, [{ n: 2, d: 3 }, { n: 1, d: 3 }])).toEqual([833, 417]);
    // rounding overshoot (5 × 1/2 → 3+3) pulls back on the largest share → Σ = 5
    expect(splitAmountByFractions(5, [{ n: 1, d: 2 }, { n: 1, d: 2 }])).toEqual([2, 3]);
    expect(splitAmountByFractions(0, [{ n: 1, d: 2 }])).toEqual([0]);
  });
});

describe("task158 · source pins — the wiring that cannot drift silently", () => {
  const read = (p: string): string => readFileSync(p, "utf8");

  it("CSV builder: «Оператор (ЗП)» is GENERATED via formatSalarySplitCell + the split chain", () => {
    const src = read("lib/csv-builders/rentals-csv.ts");
    expect(src).toContain("resolveRentalOperatorSplit");
    expect(src).toContain("formatSalarySplitCell");
    expect(src).not.toContain("salary_operator_override");
  });

  it("profile math: computeCategoryBonuses credits the member's FRACTION", () => {
    const src = read("app/franchize/lib/salary-category-bonuses.ts");
    expect(src).toContain("splitAmountByFractions");
    expect(src).toContain("share: allFractions.length > 1 ? fraction : undefined");
  });

  it("my-work: the day card counts the member's share too", () => {
    const src = read("app/franchize/server-actions/my-work.ts");
    expect(src).toContain("resolveRentalOperatorSplit");
    expect(src).toContain("splitAmountByFractions");
  });

  it("shared role write: ONE core for the tableview dropdowns AND the TG buttons", () => {
    const actions = read("app/franchize/server-actions/rental-verify-actions.ts");
    expect(actions).toContain("setRentalRoleOperatorAction");
    expect(actions).toContain("writeRentalRoleOperator");
    // both auth paths — the TG cookie AND the PC password session
    expect(actions).toContain("isPasswordAuth");
    expect(actions).not.toContain("reassignRentalOperatorAction");
    const lib = read("app/franchize/lib/rental-verify.ts");
    expect(lib).toContain("export async function writeRentalRoleOperator");
    expect(lib).toContain("export async function handleRentalVerifyReassignCallback");
    // the write retires any stale override
    expect(lib).toContain("delete meta.salary_operator_override");
  });

  it("verification DM: «👥 ЗП по долям» line + ✍️ reassign buttons in the keyboard", () => {
    const core = read("app/franchize/lib/rental-verify-core.ts");
    expect(core).toContain("ЗП по долям");
    expect(core).toContain("vrf_re_h_");
    expect(core).toContain("vrf_re_r_");
    expect(core).toContain("salarySplit?");
  });

  it("webhook router: vrf_re_ reaches the reassign handler BEFORE the vrf_ net", () => {
    const router = read("app/webhook-handlers/commands/command-handler.ts");
    expect(router.indexOf('text.startsWith("vrf_re_")')).toBeGreaterThan(-1);
    expect(router.indexOf('text.startsWith("vrf_re_")')).toBeLessThan(router.indexOf('text.startsWith("vrf_ok_")'));
  });

  it("tableview: dropdowns live in the THREE role columns, the ЗП cell is plain text", () => {
    const modal = read("app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx");
    expect(modal).toContain("roleCols: { created: 22, handed_out: 23, received: 24 }");
    expect(modal).toContain("RENTAL_ROLE_COL_LABELS");
    expect(modal).toContain("onRoleEdit(rowRentalId, roleForCell, v, quickCtx)");
    // the old ЗП-cell select is gone
    expect(modal).not.toContain("Переназначить оператора (ЗП)");
  });
});
