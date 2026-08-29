import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

// ─────────────────────────────────────────────────────────────────────────────
// iter20 — deposit capture + subrenter in sheet + table columns + weekly
// report to self + salary operator attribution + free-text subrenter search.
//   1. getDepositInfo / resolveDepositBadge (analytics-utils)
//   2. operator-attribution lib (rental chain + sales + shift tie-breaks)
//   3. rental-csv-columns (notes / photos / subrenter labels)
//   4. subrenter-user-search findExactSubrenterUserCandidate
//   5. source guards for every wiring point
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

import {
  getDepositInfo,
  resolveDepositBadge,
  type AnalyticsRentalRow,
} from "@/app/franchize/[slug]/rentals-analytics/components/lib/analytics-utils";
import {
  resolveRentalOperator,
  resolveSaleOperator,
  pickShiftAt,
  ATTRIBUTION_SOURCE_LABELS,
  type ShiftLike,
} from "@/app/franchize/lib/operator-attribution";
import {
  rentalNotesSummary,
  rentalPhotoCountsLabel,
  subrenterChatIdFromSpecs,
  subrenterCsvLabel,
} from "@/lib/csv-builders/rental-csv-columns";
import {
  findExactSubrenterUserCandidate,
  type SubrenterUserCandidate,
} from "@/app/franchize/lib/subrenter-user-search";

const read = (p: string) => readFileSync(p, "utf8");

function rentalWith(md: Record<string, unknown>, extra: Partial<AnalyticsRentalRow> = {}): AnalyticsRentalRow {
  return {
    rental_id: "r1",
    user_id: "u",
    owner_id: "u",
    vehicle_id: "b",
    status: "active",
    payment_status: "",
    total_cost: 0,
    requested_start_date: null,
    requested_end_date: null,
    agreed_start_date: null,
    agreed_end_date: null,
    created_at: "2026-08-29T10:00:00Z",
    metadata: md,
    passport_mainpage_photo: null,
    passport_registration_photo: null,
    drivers_licence_frontal_photo: null,
    crew_id: null,
    created_by_operator_chat_id: null,
    ...extra,
  };
}

// ── 1. Deposit info + badge ──────────────────────────────────────────────────

describe("iter20 · getDepositInfo (deposit capture display chain)", () => {
  it("reads amount + method + returned from metadata (web order with iter20 capture)", () => {
    const info = getDepositInfo(
      rentalWith({
        deposit_amount: 20000,
        deposit_method: "cash",
        deposit_returned: false,
      }),
    );
    expect(info.amount).toBe(20000);
    expect(info.method).toBe("cash");
    expect(info.methodLabel).toBe("наличные");
    expect(info.returned).toBe(false);
    expect(info.source).toBe("metadata");
  });

  it("iter20 backfill: derives the expected method from payment_split when deposit_method is absent", () => {
    // card/sbp web order: bank rent + cash deposit (split heuristic)
    const info = getDepositInfo(
      rentalWith({
        deposit_amount: 20000,
        payment_split: { bank: 6003, cash: 20000, card_destination: "tbank" },
      }),
    );
    expect(info.method).toBe("cash");
    expect(info.methodLabel).toBe("наличные");
    // all-cash order
    const cashInfo = getDepositInfo(
      rentalWith({
        deposit_amount: 20000,
        payment_split: { bank: 0, cash: 37000, card_destination: null },
      }),
    );
    expect(cashInfo.method).toBe("cash");
  });

  it("card_destination becomes the method when the split's cash part is below the deposit", () => {
    const info = getDepositInfo(
      rentalWith({
        deposit_amount: 20000,
        payment_split: { bank: 25000, cash: 0, card_destination: "tbank" },
      }),
    );
    expect(info.method).toBe("tbank");
    expect(info.methodLabel).toBe("Т-Банк карта");
  });

  it("/doc rental: artifact fallback marks source=artifact, no invented method", () => {
    const info = getDepositInfo(
      rentalWith(
        {},
        { contract: { renter_full_name: "X", renter_phone: null, deposit_rub: "20 000", total_sum: null, daily_price: null, rent_start_date: null, rent_end_date: null, created_by_operator_chat_id: null } },
      ),
    );
    expect(info.amount).toBe(20000);
    expect(info.source).toBe("artifact");
    expect(info.method).toBeNull();
  });

  it("metadata.deposit_rub (number) is a metadata source before the artifact", () => {
    const info = getDepositInfo(
      rentalWith(
        { deposit_rub: 15000 },
        { contract: { renter_full_name: "X", renter_phone: null, deposit_rub: "20 000", total_sum: null, daily_price: null, rent_start_date: null, rent_end_date: null, created_by_operator_chat_id: null } },
      ),
    );
    expect(info.amount).toBe(15000);
    expect(info.source).toBe("metadata");
  });

  it("nothing recorded → amount null", () => {
    const info = getDepositInfo(rentalWith({}));
    expect(info.amount).toBeNull();
    expect(info.source).toBeNull();
    expect(info.method).toBeNull();
  });
});

describe("iter20 · resolveDepositBadge (status-aware sheet badge)", () => {
  it("never claims «возвращён» when the return state is unknown (the old bug)", () => {
    // ACTIVE web order, deposit_returned not yet written by the closure modal
    expect(resolveDepositBadge("active", null).label).toBe("у держателя");
    expect(resolveDepositBadge("active", null).color).toBe("#f59e0b");
    expect(resolveDepositBadge("pending_confirmation", null).label).toBe("не получен");
    expect(resolveDepositBadge("confirmed", null).label).toBe("не получен");
    expect(resolveDepositBadge("completed", null).label).toBe("состояние неизвестно");
  });

  it("explicit flags win over status", () => {
    expect(resolveDepositBadge("completed", true).label).toBe("возвращён");
    expect(resolveDepositBadge("active", false).label).toBe("у держателя");
    expect(resolveDepositBadge("completed", false).label).toBe("у держателя");
  });
});

// ── 2. Operator attribution ──────────────────────────────────────────────────

describe("iter20 · operator-attribution (salary credit chain)", () => {
  const PAUL = "413553377";
  const ILYA = "356282674";

  it("priority 1 — /doc creator wins over everything", () => {
    const attr = resolveRentalOperator(
      {
        created_by_operator_chat_id: ILYA,
        created_at: "2026-08-29T12:00:00Z",
        metadata: { pickup_freeze: { frozen_by: PAUL }, return_confirmed_by: PAUL },
      },
      [{ member_id: "999", clock_in_time: "2026-08-29T06:00:00Z", clock_out_time: "2026-08-29T18:00:00Z" }],
    );
    expect(attr).toEqual({ operatorId: ILYA, source: "doc_command" });
  });

  it("priority 2 — pickup-freeze operator (web order handout) beats shift + return", () => {
    const attr = resolveRentalOperator(
      {
        created_at: "2026-08-29T14:22:00Z",
        metadata: { pickup_freeze: { frozen_by: PAUL }, return_confirmed_by: ILYA },
      },
      [{ member_id: "999", clock_in_time: "2026-08-29T07:41:00Z", clock_out_time: "2026-08-29T18:07:00Z" }],
    );
    expect(attr).toEqual({ operatorId: PAUL, source: "handout" });
  });

  it("priority 3 — return confirmer when no handout was frozen", () => {
    const attr = resolveRentalOperator(
      { created_at: "2026-08-29T09:32:00Z", metadata: { return_confirmed_by: ILYA } },
      [],
    );
    expect(attr).toEqual({ operatorId: ILYA, source: "return" });
  });

  it("priority 4 — shift covering created_at (the web-order case the user reported)", () => {
    const attr = resolveRentalOperator(
      { created_at: "2026-08-29T14:22:00Z", metadata: {} },
      [{ member_id: PAUL, clock_in_time: "2026-08-29T07:41:00Z", clock_out_time: "2026-08-29T18:07:00Z" }],
    );
    expect(attr).toEqual({ operatorId: PAUL, source: "shift" });
  });

  it("overlapping shifts → longest shift wins; tie → earliest clock_in", () => {
    const at = "2026-08-28T15:00:00Z";
    const shifts: ShiftLike[] = [
      { member_id: "SHORT", clock_in_time: "2026-08-28T14:00:00Z", clock_out_time: "2026-08-28T16:00:00Z" },
      { member_id: "LONG", clock_in_time: "2026-08-28T13:00:00Z", clock_out_time: "2026-08-28T19:00:00Z" },
    ];
    expect(pickShiftAt(shifts, Date.parse(at))?.member_id).toBe("LONG");
    // equal durations → earlier clock_in
    const equal: ShiftLike[] = [
      { member_id: "LATER", clock_in_time: "2026-08-28T12:00:00Z", clock_out_time: "2026-08-28T18:00:00Z" },
      { member_id: "EARLIER", clock_in_time: "2026-08-28T10:00:00Z", clock_out_time: "2026-08-28T16:00:00Z" },
    ];
    expect(pickShiftAt(equal, Date.parse(at))?.member_id).toBe("EARLIER");
  });

  it("shift boundaries are inclusive of the moment; outside → no attribution", () => {
    const shifts: ShiftLike[] = [
      { member_id: "A", clock_in_time: "2026-08-28T10:00:00Z", clock_out_time: "2026-08-28T18:00:00Z" },
    ];
    expect(pickShiftAt(shifts, Date.parse("2026-08-28T10:00:00Z"))?.member_id).toBe("A");
    expect(pickShiftAt(shifts, Date.parse("2026-08-28T09:59:59Z"))).toBeNull();
    expect(pickShiftAt(shifts, Date.parse("2026-08-28T18:00:01Z"))).toBeNull();
    // open shift covers everything after clock_in
    const open: ShiftLike[] = [{ member_id: "B", clock_in_time: "2026-08-28T10:00:00Z", clock_out_time: null }];
    expect(pickShiftAt(open, Date.parse("2026-08-29T23:00:00Z"))?.member_id).toBe("B");
  });

  it("nothing matches → none", () => {
    expect(resolveRentalOperator({ created_at: "2026-08-29T23:59:00Z", metadata: {} }, [])).toEqual({
      operatorId: null,
      source: "none",
    });
  });

  it("sales: member telegram_chat_id first, shift fallback second", () => {
    const memberIds = new Set([PAUL, ILYA]);
    const shifts: ShiftLike[] = [
      { member_id: ILYA, clock_in_time: "2026-08-27T08:00:00Z", clock_out_time: "2026-08-27T18:00:00Z" },
    ];
    expect(resolveSaleOperator({ telegram_chat_id: PAUL, created_at: "2026-08-27T12:00:00Z" }, memberIds, shifts))
      .toEqual({ operatorId: PAUL, source: "doc_command" });
    // buyer/foreign chat id → shift cross-reference
    expect(resolveSaleOperator({ telegram_chat_id: "777000", created_at: "2026-08-27T12:00:00Z" }, memberIds, shifts))
      .toEqual({ operatorId: ILYA, source: "shift" });
    expect(resolveSaleOperator({ telegram_chat_id: null, created_at: null }, memberIds, shifts))
      .toEqual({ operatorId: null, source: "none" });
  });

  it("source labels are human-readable", () => {
    expect(ATTRIBUTION_SOURCE_LABELS.doc_command).toBe("/doc");
    expect(ATTRIBUTION_SOURCE_LABELS.handout).toBe("выдача");
    expect(ATTRIBUTION_SOURCE_LABELS.shift).toBe("смена");
  });
});

// ── 3. CSV table columns ──────────────────────────────────────────────────────

describe("iter20 · rental-csv-columns (table view columns)", () => {
  it("notes: operator comment thread + pickup notes + return notes, joined", () => {
    const s = rentalNotesSummary({
      comments: [
        { at: "2026-08-29T13:35:33+00:00", text: "Перчатки 1 шт — в подарок", author: "owner" },
        { at: "2026-08-29T14:00:00+00:00", text: "Второй  комментарий ", author: "owner" },
      ],
      pickup_freeze: { notes: "шлем, перчатки и боты!:)" },
      return_notes: "Царапина на баке",
    });
    expect(s).toBe("Перчатки 1 шт — в подарок | Второй комментарий | шлем, перчатки и боты!:) | Царапина на баке");
  });

  it("notes: caps at 200 chars with ellipsis; non-string parts skipped", () => {
    const long = "x".repeat(300);
    const s = rentalNotesSummary({ comments: [{ text: long }, { text: null }, "junk"], pickup_freeze: { notes: "" } });
    expect(s.length).toBe(200);
    expect(s.endsWith("…")).toBe(true);
    expect(rentalNotesSummary(null)).toBe("");
    expect(rentalNotesSummary({})).toBe("");
    expect(rentalNotesSummary({ comments: "not-an-array" })).toBe("");
  });

  it("photos: start+end label, empty when none", () => {
    expect(rentalPhotoCountsLabel(3, 2)).toBe("3+2");
    expect(rentalPhotoCountsLabel(0, 4)).toBe("0+4");
    expect(rentalPhotoCountsLabel(0, 0)).toBe("");
    expect(rentalPhotoCountsLabel(null, null)).toBe("");
    expect(rentalPhotoCountsLabel("8", "4")).toBe("8+4"); // string-tolerant
  });

  it("subrenter id extraction + labels", () => {
    expect(subrenterChatIdFromSpecs({ subrenter_chat_id: "425137783" })).toBe("425137783");
    expect(subrenterChatIdFromSpecs({ subrenter_chat_id: 425137783 })).toBe("425137783");
    expect(subrenterChatIdFromSpecs({})).toBeNull();
    expect(subrenterChatIdFromSpecs(null)).toBeNull();
    expect(subrenterCsvLabel({ user_id: "425137783", username: "K0r_Al", full_name: "Александр Корнилов" }))
      .toBe("@K0r_Al · Александр Корнилов");
    expect(subrenterCsvLabel({ user_id: "42", username: null, full_name: "Партнёр" })).toBe("Партнёр");
    expect(subrenterCsvLabel({ user_id: "42", username: null, full_name: null })).toBe("42");
    expect(subrenterCsvLabel(null)).toBe("");
  });
});

// ── 4. Free-text subrenter search ─────────────────────────────────────────────

describe("iter20 · findExactSubrenterUserCandidate (free-text assignment input)", () => {
  const candidates: SubrenterUserCandidate[] = [
    { userId: "425137783", username: "K0r_Al", fullName: "Александр Корнилов" },
    { userId: "687580818", username: "Goollil", fullName: "Георгий" },
    { userId: "111", username: null, fullName: "Александр Корнилов" }, // duplicate name
  ];

  it("exact username match, case-insensitive + @-stripped", () => {
    expect(findExactSubrenterUserCandidate(candidates, "@K0r_Al")?.userId).toBe("425137783");
    expect(findExactSubrenterUserCandidate(candidates, "k0r_al")?.userId).toBe("425137783");
    expect(findExactSubrenterUserCandidate(candidates, "Goollil")?.userId).toBe("687580818");
  });

  it("ambiguous full name → null (admin must pick from the list)", () => {
    expect(findExactSubrenterUserCandidate(candidates, "Александр Корнилов")).toBeNull();
  });

  it("unique full name resolves; substring / miss / empty → null", () => {
    expect(findExactSubrenterUserCandidate(candidates, "Георгий")?.userId).toBe("687580818");
    expect(findExactSubrenterUserCandidate(candidates, "Корн")).toBeNull();
    expect(findExactSubrenterUserCandidate(candidates, "")).toBeNull();
    expect(findExactSubrenterUserCandidate([], "K0r_Al")).toBeNull();
  });
});

// ── 5. Source guards (wiring) ─────────────────────────────────────────────────

describe("iter20 · source guards", () => {
  it("web order insert captures deposit_method (metadata + table column)", () => {
    const src = read("app/franchize/actions-runtime.ts");
    expect(src).toContain("expectedDepositMethod");
    expect(src).toContain('...(expectedDepositMethod ? { deposit_method: expectedDepositMethod } : {})');
    // table-column mirror so the cron CSV stops showing 0 for web orders
    expect(src).toMatch(/\.\.\.\(expectedDepositRub \? \{ deposit_amount: expectedDepositRub \} : \{\}\),/);
  });

  it("DepositSection uses the status-aware badge + provenance line", () => {
    const src = read("app/franchize/[slug]/rentals-analytics/components/DepositSection.tsx");
    expect(src).toContain("resolveDepositBadge(rentalStatus, metadataDeposit.returned)");
    expect(src).toContain('metadataDeposit.source === "artifact" ? "из данных договора" : "по данным заказа"');
  });

  it("dashboard resolves subrenterLabel and the sheet renders the tile", () => {
    const dash = read("app/franchize/server-actions/rentals-dashboard.ts");
    expect(dash).toContain("subrenterLabel");
    expect(dash).toMatch(/subrenterLabelById\.get\(id\) \?\? id/);
    const v2 = read("app/franchize/[slug]/rentals-analytics/AnalyticsClientV2.tsx");
    expect(v2).toContain("subrenterLabel: item.subrenterLabel ?? null");
    const drawer = read("app/franchize/[slug]/rentals-analytics/components/RentalDetailDrawer.tsx");
    expect(drawer).toContain('label: "Субарендатор"');
  });

  it("rentals CSV builder emits the 4 new columns on every row shape", () => {
    const src = read("lib/csv-builders/rentals-csv.ts");
    expect(src).toContain('"Заметки", "Субарендатор", "Фото", "ID"');
    expect(src).toContain("start_photo_count, end_photo_count");
    expect(src).toContain("rentalNotesSummary(meta)");
    expect(src).toContain("rentalPhotoCountsLabel(r.start_photo_count, r.end_photo_count)");
    expect(src).toContain("subrenterCsvLabel(subrenterUserById.get(subrenterId)");
    // rental rows carry the rental id in the hidden column
    expect(src).toMatch(/notesStr, subrenterStr, photosStr, r\.rental_id \|\| ""/);
  });

  it("ExportCsvModal hides the id column, supports tap-through and photo glyph", () => {
    const src = read("app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx");
    expect(src).toContain("const RENTALS_HIDE_COLS = new Set([7, 20])");
    expect(src).toContain("RENTALS_ID_COL");
    expect(src).toContain("router.push(`/franchize/${slug}/rental/${rentalId}`)");
    expect(src).toContain("Camera");
    expect(src).toContain("`${visibleColCount} столбцов`");
  });

  it("weekly report: sendToSelf mode wired end-to-end, download button replaced", () => {
    const action = read("app/franchize/server-actions/subrenter-monitoring.ts");
    expect(action).toContain("sendToSelf: z.boolean().optional()");
    expect(action).toContain("sendTelegramDocument(actorUserId");
    expect(action).toContain("sentToSelf");
    const panel = read("app/franchize/components/SubrenterManagerPanel.tsx");
    expect(panel).toContain('runWeeklyReport("self")');
    expect(panel).toContain("Послать себе в ТГ");
    expect(panel).toContain('sendToSelf: mode === "self"');
    // the dead blob-download path is gone
    expect(panel).not.toContain('mode === "download"');
    expect(panel).not.toContain("FileDown");
  });

  it("salary attribution: fetch-all + resolve chain, no member-filtered query", () => {
    const src = read("app/franchize/server-actions/salary-calculations.ts");
    expect(src).toContain("resolveRentalOperator(r, shifts)");
    expect(src).toContain("resolveSaleOperator(s, memberIds, shifts)");
    expect(src).toContain('from("crew_member_shifts")');
    expect(src).toContain("ATTRIBUTION_SOURCE_LABELS");
    // the old direct member filter must be gone from the rentals query
    expect(src).not.toContain('.eq("created_by_operator_chat_id", memberId)');
    // breakdown exposes the attribution sources for audit
    expect(src).toMatch(/\$\{agg\.count\} × бонусы\$\{sourceParts/);
  });

  it("subrenter panel: free-text input + inline suggestions + exact-match resolution", () => {
    const src = read("app/franchize/components/SubrenterManagerPanel.tsx");
    // the digits-only filter is GONE from the MAIN assignment field (the
    // percentage input legitimately keeps its own numeric filter + inputMode)
    expect(src).not.toContain("[bike.bikeId]: e.target.value.replace");
    expect(src).toContain('placeholder="Telegram id или @username"');
    expect(src).toContain("findExactSubrenterUserCandidate");
    expect(src).toContain("pickInlineUser");
    expect(src).toContain("setInlineSearch({ bikeId: bike.bikeId, query: trimmed })");
  });
});
