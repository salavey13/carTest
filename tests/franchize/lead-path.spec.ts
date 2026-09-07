// tests/franchize/lead-path.spec.ts
//
// Спеки «Пути оператора» (wave «steps one by one»): drip по сменам,
// catch-up по очкам прозрачного лидерборда, видимость шагов и прогресс.

import { describe, expect, it } from "vitest";
import {
  LEAD_PATH_STEPS,
  applyLeadPathDrip,
  computeLeadPathProgress,
  countLeadPathDone,
  DEFAULT_LEAD_PATH_STATE,
  isLeadPathStepDone,
  leadPathTodayKey,
  type LeadPathStats,
  type LeadPathState,
} from "@/app/franchize/[slug]/leads/lib/lead-path";

const stats = (over: Partial<LeadPathStats> = {}): LeadPathStats => ({
  myPoints: 0,
  myRank: null,
  crewSize: 1,
  ...over,
});

describe("leadPathTodayKey", () => {
  it("форматирует YYYY-MM-DD с ведущими нулями", () => {
    expect(leadPathTodayKey(new Date(2026, 8, 8))).toBe("2026-09-08");
    expect(leadPathTodayKey(new Date(2026, 0, 3))).toBe("2026-01-03");
  });
});

describe("isLeadPathStepDone", () => {
  it("пороговые шаги — по очкам", () => {
    const step = LEAD_PATH_STEPS[1]; // first-touch, 3 очка
    expect(isLeadPathStepDone(step, stats({ myPoints: 2 }))).toBe(false);
    expect(isLeadPathStepDone(step, stats({ myPoints: 3 }))).toBe(true);
    expect(isLeadPathStepDone(step, stats({ myPoints: 50 }))).toBe(true);
  });

  it("«Легенда смены» — честный топ-3 при экипаже ≥ 3", () => {
    const top3 = LEAD_PATH_STEPS[LEAD_PATH_STEPS.length - 1];
    expect(isLeadPathStepDone(top3, stats({ myPoints: 500, myRank: 2, crewSize: 5 }))).toBe(true);
    expect(isLeadPathStepDone(top3, stats({ myPoints: 500, myRank: 4, crewSize: 5 }))).toBe(false);
    // В экипаже из двух человек «топ-3» — это все: шаг не должен закрываться даром
    expect(isLeadPathStepDone(top3, stats({ myPoints: 500, myRank: 1, crewSize: 2 }))).toBe(false);
  });
});

describe("applyLeadPathDrip: один новый шаг за смену", () => {
  it("первая смена открывает второй шаг", () => {
    const { state, advanced } = applyLeadPathDrip(DEFAULT_LEAD_PATH_STATE, LEAD_PATH_STEPS.length, "2026-09-08");
    expect(advanced).toBe(true);
    expect(state.revealed).toBe(2);
    expect(state.lastRevealDay).toBe("2026-09-08");
  });

  it("в ту же смену повторно не открывает", () => {
    const after: LeadPathState = { revealed: 2, lastRevealDay: "2026-09-08", celebrated: [] };
    const { state, advanced } = applyLeadPathDrip(after, LEAD_PATH_STEPS.length, "2026-09-08");
    expect(advanced).toBe(false);
    expect(state.revealed).toBe(2);
  });

  it("новая смена открывает следующий шаг", () => {
    const after: LeadPathState = { revealed: 2, lastRevealDay: "2026-09-08", celebrated: [] };
    const { state, advanced } = applyLeadPathDrip(after, LEAD_PATH_STEPS.length, "2026-09-09");
    expect(advanced).toBe(true);
    expect(state.revealed).toBe(3);
  });

  it("не выходит за количество шагов", () => {
    const all: LeadPathState = { revealed: LEAD_PATH_STEPS.length, lastRevealDay: "2026-09-08", celebrated: [] };
    const { state, advanced } = applyLeadPathDrip(all, LEAD_PATH_STEPS.length, "2026-09-09");
    expect(advanced).toBe(false);
    expect(state.revealed).toBe(LEAD_PATH_STEPS.length);
  });

  it("чинит отрицательный/перекрученный revealed из metadata", () => {
    const broken: LeadPathState = { revealed: -5, lastRevealDay: null, celebrated: [] };
    const { state } = applyLeadPathDrip(broken, LEAD_PATH_STEPS.length, "2026-09-08");
    expect(state.revealed).toBe(1);
  });
});

describe("countLeadPathDone: подряд с начала", () => {
  it("считает выполненные подряд и останавливается на первом невыполненном", () => {
    // 0 очков → только «Старт смены» (порог 0)
    expect(countLeadPathDone(LEAD_PATH_STEPS, stats({ myPoints: 0 }))).toBe(1);
    // 10 очков → старт + первый контакт + перезвон (порог 9)
    expect(countLeadPathDone(LEAD_PATH_STEPS, stats({ myPoints: 10 }))).toBe(3);
    // 100 очков, но rank вне топ-3 → «Легенда» не закрыта
    expect(countLeadPathDone(LEAD_PATH_STEPS, stats({ myPoints: 200, myRank: 7, crewSize: 6 })))
      .toBe(LEAD_PATH_STEPS.length - 1);
  });
});

describe("computeLeadPathProgress: видимость и catch-up", () => {
  it("locked-шаги остаются скрыты при нулевом прогрессе", () => {
    const res = computeLeadPathProgress(
      { revealed: 2, lastRevealDay: "2026-09-08", celebrated: [] },
      LEAD_PATH_STEPS,
      stats({ myPoints: 0 }),
    );
    // Шаг 0 («Старт смены», порог 0) уже завершён → done; шаг 1 — текущий;
    // шаг 2 — за пределами revealed=2 → locked.
    expect(res.views[0]).toBe("done");
    expect(res.views[1]).toBe("current");
    expect(res.views[2]).toBe("locked");
    expect(res.revealed).toBe(2);
  });

  it("catch-up: завершение шага открывает следующий СРАЗУ (не ждём смену)", () => {
    const res = computeLeadPathProgress(
      { revealed: 2, lastRevealDay: "2026-09-08", celebrated: [] },
      LEAD_PATH_STEPS,
      stats({ myPoints: 25 }), // закрывает шаги с порогами 0, 3, 9, 20
    );
    expect(res.doneCount).toBe(4);
    // revealed подтянут до doneCount+1 = 5, хотя drip дал только 2
    expect(res.revealed).toBe(5);
    expect(res.views[3]).toBe("done");
    expect(res.views[4]).toBe("current");
    expect(res.currentIndex).toBe(4);
  });

  it("прогресс текущего шага — доля от порога", () => {
    const res = computeLeadPathProgress(
      { revealed: 2, lastRevealDay: null, celebrated: [] },
      LEAD_PATH_STEPS,
      stats({ myPoints: 0 }),
    );
    // Текущий шаг — «Первый контакт» (3 очка), 0 очков → 0%
    expect(res.currentIndex).toBe(1);
    expect(res.currentPct).toBe(0);

    const half = computeLeadPathProgress(DEFAULT_LEAD_PATH_STATE, LEAD_PATH_STEPS, stats({ myPoints: 1 }));
    expect(half.currentPct).toBe(33);
  });

  it("всё завершено → currentIndex null, pct 100", () => {
    const res = computeLeadPathProgress(
      { revealed: LEAD_PATH_STEPS.length, lastRevealDay: null, celebrated: [] },
      LEAD_PATH_STEPS,
      stats({ myPoints: 500, myRank: 1, crewSize: 4 }),
    );
    expect(res.doneCount).toBe(LEAD_PATH_STEPS.length);
    expect(res.currentIndex).toBeNull();
    expect(res.currentPct).toBe(100);
  });

  it("state.revealed не теряется при catch-up вниз (drip ≥ doneCount+1 сохраняется)", () => {
    // Оператор много смен подряд открывал шаги, но очков мало — лестница
    // НЕ должна схлопываться обратно.
    const res = computeLeadPathProgress(
      { revealed: 5, lastRevealDay: null, celebrated: [] },
      LEAD_PATH_STEPS,
      stats({ myPoints: 0 }),
    );
    expect(res.revealed).toBe(5);
    // Шаг 1 — текущий (первый незакрытый), шаги 2–4 — открытые подсказки.
    expect(res.views[1]).toBe("current");
    expect(res.views[2]).toBe("open");
  });
});
