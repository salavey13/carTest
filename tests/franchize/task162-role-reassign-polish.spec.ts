// tests/franchize/task162-role-reassign-polish.spec.ts
//
// TASK162 — polish codereview of the operator-REASSIGNMENT feature (the
// tableview role dropdowns + the generated «Оператор (ЗП)» split + the TG
// ✍️ buttons) after the crew ran a full verification day on it (boss:
// «we'll use today's feature of reassigning rental operators right in
// tableview … Please polish codereview this feature once more»).
//
// Found + fixed by this pass, pinned here so they cannot regress:
//   1. STALE OWNER STAMP — the realign after a role write reset
//      operator_confirmed_at but KEPT owner_confirmed_at; the verify state
//      machine auto-verifies an owner-confirmed row on the operator's tap,
//      so the NEW top shareholder could close the сверка with ONE ✅ the
//      owner never re-confirmed. Both stamps reset now.
//   2. CROSS-CREW WRITE — setRentalRoleOperatorAction gated the ACTOR but
//      never checked the rental belongs to the slug's crew; an owner of
//      crew A could rewrite crew B's roles with a foreign rentalId. The
//      core now takes expectedCrewId from the web action.
//   3. LABEL PARITY — the CSV builder prints raw-id labels for members
//      without username/full_name; the write core used labelFromUsersMap
//      («id356…») — the tableview expectRole check compared the two and
//      NEVER cleared (permanent stuck warning + wrong optimistic label).
//      compactLabelFromUsersMap is the CSV dialect; split labels + roster
//      + picker all speak it now.
//   4. CLEAR (UNDO) — the web dropdowns could never empty a role (the
//      action rejected an empty id), yet the boss's own 1/2+1/2 rule needs
//      an EMPTY «создал» to be reachable after a mistaken fill. The
//      «__clear__» sentinel → operatorUserId null → the sanctioned clear.
//   5. TG CALLBACK LIMIT — Telegram drops callback_data > 64 bytes; the
//      crew picker filters roster entries that would overflow instead of
//      rendering dead buttons.
//   6. Optimistic presence check — a cleared role's optimistic label is
//      the empty string; truthiness checks would let the stale CSV label
//      shine through until the refetch.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  resolveRentalOperatorSplit,
  type ShiftLike,
} from "@/app/franchize/lib/operator-attribution";
import { compactLabelFromUsersMap } from "@/app/franchize/lib/rental-verify-core";
import { formatSalarySplitCell } from "@/lib/salary-split";

const PAUL = "413553377";
const ILYA = "356282674";
const GUNDER = "5219192922";

const SHIFTS: ShiftLike[] = [
  { member_id: PAUL, clock_in_time: "2026-10-09T06:00:00Z", clock_out_time: "2026-10-09T18:00:00Z" },
];

describe("task162 · compactLabelFromUsersMap — the CSV dialect", () => {
  const map = new Map<string, { username?: string | null; full_name?: string | null }>([
    [PAUL, { username: "Paul_Valor", full_name: "Пауль Валор" }],
    [ILYA, { username: null, full_name: "Илья Золотов" }],
    [GUNDER, { username: null, full_name: null }],
  ]);

  it("username wins, then full_name, then the RAW id (no «id» prefix)", () => {
    expect(compactLabelFromUsersMap(map, PAUL)).toBe("@Paul_Valor");
    expect(compactLabelFromUsersMap(map, ILYA)).toBe("Илья Золотов");
    expect(compactLabelFromUsersMap(map, GUNDER)).toBe(GUNDER);
  });

  it("unknown user / null chat id — raw id / empty (never «id…», never «—»)", () => {
    expect(compactLabelFromUsersMap(map, "999")).toBe("999");
    expect(compactLabelFromUsersMap(map, null)).toBe("");
    expect(compactLabelFromUsersMap(map, undefined)).toBe("");
  });

  it("PARITY with the CSV builder's compactUserLabel — the expectRole contract", () => {
    // lib/csv-builders/rentals-csv.ts: @username → full_name || user_id → raw id.
    // The split cell is built from THESE labels; the action's operatorLabel
    // must be byte-equal or the tableview's expectRole check never clears.
    const csvDialect = (u?: { username?: string | null; full_name?: string | null } | null, id = "") =>
      u ? (u.username ? `@${u.username}` : u.full_name || id) : id;
    for (const id of [PAUL, ILYA, GUNDER, "999"]) {
      expect(compactLabelFromUsersMap(map, id)).toBe(csvDialect(map.get(id), id));
    }
  });

  it("split cells built from compact labels round-trip through the tableview parser", () => {
    const cell = formatSalarySplitCell([
      { label: compactLabelFromUsersMap(map, PAUL), fraction: { n: 2, d: 3 } },
      { label: compactLabelFromUsersMap(map, GUNDER), fraction: { n: 1, d: 3 } },
    ]);
    expect(cell).toBe(`@Paul_Valor (2/3) + ${GUNDER} (1/3)`);
  });
});

describe("task162 · clear-role re-derives the split from the remaining roles", () => {
  it("clearing «создал» from a 3×1/3 split falls back to 1/2+1/2 (the boss's self-order rule)", () => {
    const before = resolveRentalOperatorSplit(
      {
        created_by_operator_chat_id: PAUL,
        metadata: { pickup_freeze: { frozen_by: ILYA }, return_confirmed_by: GUNDER },
      },
      SHIFTS,
    );
    expect(before.shares.map((s) => s.fraction)).toEqual([{ n: 1, d: 3 }, { n: 1, d: 3 }, { n: 1, d: 3 }]);

    const after = resolveRentalOperatorSplit(
      {
        created_by_operator_chat_id: null,
        metadata: { pickup_freeze: { frozen_by: ILYA }, return_confirmed_by: GUNDER },
      },
      SHIFTS,
    );
    expect(after.shares.map((s) => [s.operatorId, s.fraction])).toEqual([
      [ILYA, { n: 1, d: 2 }],
      [GUNDER, { n: 1, d: 2 }],
    ]);
  });

  it("clearing the ONLY filled role → the shift cross-ref (100% to the shift holder)", () => {
    const after = resolveRentalOperatorSplit(
      { created_by_operator_chat_id: null, created_at: "2026-10-09T10:00:00Z", metadata: {} },
      SHIFTS,
    );
    expect(after.source).toBe("shift");
    expect(after.shares).toEqual([{ operatorId: PAUL, fraction: { n: 1, d: 1 }, roles: ["shift"] }]);
  });
});

describe("task162 · source pins — the fixes cannot drift silently", () => {
  const read = (p: string): string => readFileSync(p, "utf8");

  it("realign resets BOTH confirm stamps (no one-tap auto-verify after a role swap)", () => {
    const lib = read("app/franchize/lib/rental-verify.ts");
    const fnStart = lib.indexOf("export async function writeRentalRoleOperator");
    const fnEnd = lib.indexOf("export async function handleRentalVerifyReassignCallback");
    const body = lib.slice(fnStart, fnEnd);
    expect(body).toContain("patch.operator_confirmed_at = null;");
    expect(body).toContain("patch.owner_confirmed_at = null;");
  });

  it("cross-crew guard: the web action passes expectedCrewId, the core enforces it", () => {
    const lib = read("app/franchize/lib/rental-verify.ts");
    expect(lib).toContain("expectedCrewId?: string;");
    expect(lib).toContain("Эта аренда принадлежит другому экипажу.");
    const actions = read("app/franchize/server-actions/rental-verify-actions.ts");
    expect(actions).toContain("expectedCrewId: String(crew.id)");
  });

  it("split labels speak the CSV dialect (compactLabelFromUsersMap, never the id-prefixed one)", () => {
    const lib = read("app/franchize/lib/rental-verify.ts");
    const fnStart = lib.indexOf("export async function writeRentalRoleOperator");
    const fnEnd = lib.indexOf("export async function handleRentalVerifyReassignCallback");
    const body = lib.slice(fnStart, fnEnd);
    expect(body).toContain("compactLabelFromUsersMap(allLabels");
    expect(body).not.toContain("labelFromUsersMap(allLabels");
    // the TG crew picker offers the same dialect
    expect(lib).toContain("compactLabelFromUsersMap(usersMap, userId)");
  });

  it("web clear: «__clear__» sentinel → action null → «✕ очистить роль» option", () => {
    const actions = read("app/franchize/server-actions/rental-verify-actions.ts");
    expect(actions).toContain("operatorUserId: string | null;");
    expect(actions).not.toContain("Не выбран оператор.");
    const modal = read("app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx");
    expect(modal).toContain('"__clear__"');
    expect(modal).toContain("operatorUserId: clearing ? null : nextUserId");
    expect(modal).toContain("✕ очистить роль");
    // the optimistic slot tolerates the empty label (presence, not truthiness)
    expect(modal).toContain("optimistic !== undefined ? optimistic");
  });

  it("TG picker: apply-callbacks stay within Telegram's 64-byte callback_data limit", () => {
    const lib = read("app/franchize/lib/rental-verify.ts");
    expect(lib).toContain(".length <= 64");
    expect(lib).toContain("Слишком длинный идентификатор");
  });
});
