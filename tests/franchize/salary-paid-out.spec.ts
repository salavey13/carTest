// tests/franchize/salary-paid-out.spec.ts
//
// 2026-09-26 salary audit (vip-bike, pay period 25th) follow-up specs:
//   • msk-time: date-only inputs anchor to MOSCOW day boundaries (not UTC) —
//     the crew's «период 10–25» must include a shift clocked in at 00:30 MSK
//     on the 25th (21:30Z on the 24th);
//   • salary-paid-out: «уже выплачено» sums BOTH books (formal ledger +
//     owner wallet) and never double counts a payout via the mirror links
//     (metadata.mirrorOfTx / metadata.mirroredToTx / legacy profile rows).

import { describe, expect, it, vi } from "vitest";

import {
  MSK_OFFSET_MS,
  mskDateFromUtcIso,
  mskDayBoundsUtcIso,
  mskMonthWindowUtcIso,
  normalizePeriodEndMsk,
  normalizePeriodStartMsk,
} from "@/app/franchize/lib/msk-time";
import {
  computeShiftAccrued,
  isWalletRowMirroredToFormal,
  isWalletSalaryTitle,
  sumMemberPaidOut,
} from "@/app/franchize/lib/salary-paid-out";

// ── msk-time ────────────────────────────────────────────────────────────────

describe("mskDayBoundsUtcIso", () => {
  it("anchors a calendar day to Moscow midnight (21:00Z the day before)", () => {
    const { startUtcIso, endUtcIso } = mskDayBoundsUtcIso("2026-08-25");
    expect(startUtcIso).toBe("2026-08-24T21:00:00.000Z");
    expect(endUtcIso).toBe("2026-08-25T20:59:59.999Z");
  });

  it("covers a shift clocked in at 00:30 MSK (the 2026-09-09 regression in MSK)", () => {
    const { startUtcIso, endUtcIso } = mskDayBoundsUtcIso("2026-08-25");
    const shift = new Date("2026-08-24T21:30:00.000Z").getTime(); // 00:30 MSK on the 25th
    expect(shift >= Date.parse(startUtcIso)).toBe(true);
    expect(shift <= Date.parse(endUtcIso)).toBe(true);
  });

  it("keeps the 24h span (minus 1 ms) regardless of the date", () => {
    const { startUtcIso, endUtcIso } = mskDayBoundsUtcIso("2026-01-01");
    expect(Date.parse(endUtcIso) - Date.parse(startUtcIso)).toBe(24 * 3600 * 1000 - 1);
  });
});

describe("normalizePeriodStartMsk / normalizePeriodEndMsk", () => {
  it("date-only inputs → MSK day bounds", () => {
    expect(normalizePeriodStartMsk("2026-08-10")).toBe("2026-08-09T21:00:00.000Z");
    expect(normalizePeriodEndMsk("2026-08-25")).toBe("2026-08-25T20:59:59.999Z");
  });

  it("timestamped inputs pass through unchanged", () => {
    expect(normalizePeriodStartMsk("2026-08-01T00:00:00.000Z")).toBe("2026-08-01T00:00:00.000Z");
    expect(normalizePeriodEndMsk("2026-09-01T12:34:56.789Z")).toBe("2026-09-01T12:34:56.789Z");
  });

  it("empty input returns as-is (callers validate)", () => {
    expect(normalizePeriodStartMsk("")).toBe("");
    expect(normalizePeriodEndMsk("")).toBe("");
  });
});

describe("mskMonthWindowUtcIso", () => {
  it("maps a mid-month MSK moment to the [1st, 1st) MSK month window", () => {
    // 2026-09-26 12:00 UTC = 15:00 MSK → September MSK month.
    const { startUtcIso, endUtcIso } = mskMonthWindowUtcIso(new Date("2026-09-26T12:00:00.000Z"));
    expect(startUtcIso).toBe("2026-08-31T21:00:00.000Z");
    expect(endUtcIso).toBe("2026-09-30T21:00:00.000Z");
  });

  it("the first 3 MSK hours of a month belong to THAT month, not the previous one", () => {
    // 2026-09-01 00:30 MSK = 2026-08-31T21:30Z → must be INSIDE September.
    const { startUtcIso } = mskMonthWindowUtcIso(new Date("2026-08-31T21:30:00.000Z"));
    expect(startUtcIso).toBe("2026-08-31T21:00:00.000Z");
  });
});

describe("mskDateFromUtcIso", () => {
  it("translates UTC timestamps to the MSK calendar date (wallet entry_date)", () => {
    expect(mskDateFromUtcIso("2026-08-24T21:30:00.000Z")).toBe("2026-08-25");
    expect(mskDateFromUtcIso("2026-08-24T20:59:59.999Z")).toBe("2026-08-24");
  });

  it("MSK_OFFSET_MS is +3h (Russia has no DST)", () => {
    expect(MSK_OFFSET_MS).toBe(3 * 3600 * 1000);
  });
});

// ── salary-paid-out ─────────────────────────────────────────────────────────

describe("isWalletSalaryTitle", () => {
  it("matches «зарплата…» titles case-insensitively", () => {
    expect(isWalletSalaryTitle("Зарплата админа salavey13", null)).toBe(true);
    expect(isWalletSalaryTitle("зарплата механика", null)).toBe(true);
  });

  it("matches the explicit book tag even with a neutral title", () => {
    expect(isWalletSalaryTitle("Выплата", { book: "salary" })).toBe(true);
  });

  it("rejects unrelated wallet moves", () => {
    expect(isWalletSalaryTitle("Вывод себе", null)).toBe(false);
    expect(isWalletSalaryTitle("Выплата механику", null)).toBe(false);
    expect(isWalletSalaryTitle(null, null)).toBe(false);
  });
});

describe("isWalletRowMirroredToFormal", () => {
  it("skips rows the code forward-mirrored (metadata.mirrorOfTx)", () => {
    expect(isWalletRowMirroredToFormal({ source: "profile", metadata: { mirrorOfTx: "tx-1" } })).toBe(true);
  });

  it("skips rows the trigger/backfill already mirrored (metadata.mirroredToTx)", () => {
    expect(isWalletRowMirroredToFormal({ source: "assistant_bot", metadata: { mirroredToTx: "tx-9" } })).toBe(true);
  });

  it("skips LEGACY forward-mirror rows (source=profile, no metadata)", () => {
    expect(isWalletRowMirroredToFormal({ source: "profile", metadata: null })).toBe(true);
  });

  it("keeps bot/manual salary rows without a mirror link", () => {
    expect(isWalletRowMirroredToFormal({ source: "assistant_bot", metadata: null })).toBe(false);
    expect(isWalletRowMirroredToFormal({ source: "manual", metadata: null })).toBe(false);
  });
});

describe("computeShiftAccrued", () => {
  it("prefers stored salary_amount", () => {
    expect(
      computeShiftAccrued([{ clock_in_time: "2026-08-19T10:00:00.000Z", clock_out_time: "2026-08-19T14:00:00.000Z", hourly_rate: 999, salary_amount: 676 }]),
    ).toBe(676);
  });

  it("falls back to duration × hourly_rate", () => {
    expect(
      computeShiftAccrued([{ clock_in_time: "2026-08-19T10:00:00.000Z", clock_out_time: "2026-08-19T14:00:00.000Z", hourly_rate: 169 }]),
    ).toBeCloseTo(676, 6);
  });

  it("clamps negative durations to 0 (corrupt rows never pay out)", () => {
    expect(
      computeShiftAccrued([{ clock_in_time: "2026-08-19T14:00:00.000Z", clock_out_time: "2026-08-19T10:00:00.000Z", hourly_rate: 169 }]),
    ).toBe(0);
  });
});

// Mock Supabase client: minimal chain that records filters and returns
// per-table fixtures. Mirrors the buildChain pattern of salary-calculations.
function makeClient(tables: Record<string, any[]>, captured: { calls: string[] }) {
  function chainFor(table: string) {
    const chain: any = {
      data: tables[table] ?? [],
      error: null,
      select: vi.fn(() => chain),
      eq: vi.fn((col: string, val: any) => {
        captured.calls.push(`${table}.eq(${col})`);
        return chain;
      }),
      gt: vi.fn(() => chain),
      gte: vi.fn((col: string, val: any) => {
        captured.calls.push(`${table}.gte(${col}=${val})`);
        return chain;
      }),
      lte: vi.fn((col: string, val: any) => {
        captured.calls.push(`${table}.lte(${col}=${val})`);
        return chain;
      }),
      ilike: vi.fn((col: string, val: string) => {
        captured.calls.push(`${table}.ilike(${col}=${val})`);
        return chain;
      }),
    };
    chain.then = (resolve: (v: any) => any) => resolve({ data: chain.data, error: chain.error });
    return chain;
  }
  return { from: (table: string) => chainFor(table) };
}

const CREW = "crew-1";
const MEMBER = "413553377";
const WINDOW = { startUtcIso: "2026-08-09T21:00:00.000Z", endUtcIso: "2026-08-25T20:59:59.999Z" };

describe("sumMemberPaidOut", () => {
  it("sums formal expense_salary + non-mirrored wallet salary rows", async () => {
    const client = makeClient(
      {
        cash_transactions: [{ amount: 10000 }],
        owner_cash_entries: [
          { amount: 5000, title: "Зарплата админа salavey13", person: "salavey13 (admin 413553377)", kind: "other", source: "assistant_bot", metadata: null },
        ],
      },
      { calls: [] },
    );
    const r = await sumMemberPaidOut(client, { crewId: CREW, memberId: MEMBER, ...WINDOW });
    expect(r.formalTotal).toBe(10000);
    expect(r.walletTotal).toBe(5000);
    expect(r.total).toBe(15000);
  });

  it("does NOT double count: forward-mirror wallet rows (mirrorOfTx) are skipped", async () => {
    const client = makeClient(
      {
        cash_transactions: [{ amount: 13000 }],
        owner_cash_entries: [
          { amount: 13000, title: "Зарплата Илья I.O.S.", person: "Илья I.O.S. (356282674)", kind: "other", source: "profile", metadata: { book: "salary", mirrorOfTx: "tx-1" } },
        ],
      },
      { calls: [] },
    );
    const r = await sumMemberPaidOut(client, { crewId: CREW, memberId: MEMBER, ...WINDOW });
    expect(r.total).toBe(13000);
  });

  it("does NOT double count: legacy profile rows without metadata are skipped", async () => {
    const client = makeClient(
      {
        cash_transactions: [{ amount: 7000 }],
        owner_cash_entries: [
          { amount: 7000, title: "Зарплата X", person: `X (${MEMBER})`, kind: "other", source: "profile", metadata: null },
        ],
      },
      { calls: [] },
    );
    const r = await sumMemberPaidOut(client, { crewId: CREW, memberId: MEMBER, ...WINDOW });
    expect(r.total).toBe(7000);
  });

  it("does NOT double count: trigger-mirrored wallet rows (mirroredToTx) are skipped", async () => {
    const client = makeClient(
      {
        cash_transactions: [{ amount: 10000 }],
        owner_cash_entries: [
          { amount: 10000, title: "Зарплата админа salavey13", person: "salavey13 (admin 413553377)", kind: "other", source: "assistant_bot", metadata: { mirroredToTx: "tx-9" } },
        ],
      },
      { calls: [] },
    );
    const r = await sumMemberPaidOut(client, { crewId: CREW, memberId: MEMBER, ...WINDOW });
    expect(r.total).toBe(10000);
  });

  it("ignores non-salary wallet moves even when they name the member", async () => {
    const client = makeClient(
      {
        cash_transactions: [],
        owner_cash_entries: [
          { amount: 2000, title: "Вывод себе", person: null, kind: "personal", source: "assistant_bot", metadata: null },
          { amount: 3000, title: "Занёс на кофе", person: `X (${MEMBER})`, kind: "other", source: "manual", metadata: null },
          { amount: 4000, title: "Зарплата", person: `X (${MEMBER})`, kind: "subrenter_payout", source: "assistant_bot", metadata: null },
        ],
      },
      { calls: [] },
    );
    const r = await sumMemberPaidOut(client, { crewId: CREW, memberId: MEMBER, ...WINDOW });
    expect(r.walletTotal).toBe(0);
  });

  it("wallet query filters by crew, out-direction, positive amount, person id and MSK entry_date window", async () => {
    const captured = { calls: [] as string[] };
    const client = makeClient({ cash_transactions: [], owner_cash_entries: [] }, captured);
    await sumMemberPaidOut(client, { crewId: CREW, memberId: MEMBER, ...WINDOW });
    expect(captured.calls).toContain(`cash_transactions.eq(crew_id)`);
    expect(captured.calls).toContain(`owner_cash_entries.eq(crew_id)`);
    expect(captured.calls).toContain(`owner_cash_entries.ilike(person=%(${MEMBER})%)`);
    // Wallet window is translated to MSK calendar dates for entry_date.
    expect(captured.calls).toContain("owner_cash_entries.gte(entry_date=2026-08-10)");
    expect(captured.calls).toContain("owner_cash_entries.lte(entry_date=2026-08-25)");
  });

  it("propagates the formal-ledger query error (fail loud, caller decides)", async () => {
    const broken: any = {
      from: () => {
        const chain: any = {
          data: null,
          error: { message: "boom" },
          select: () => chain,
          eq: () => chain,
          gt: () => chain,
          gte: () => chain,
          lte: () => chain,
          ilike: () => chain,
        };
        chain.then = (resolve: (v: any) => any) => resolve({ data: chain.data, error: chain.error });
        return chain;
      },
    };
    await expect(
      sumMemberPaidOut(broken, { crewId: CREW, memberId: MEMBER, ...WINDOW }),
    ).rejects.toBeTruthy();
  });
});
