// tests/franchize/lead-path.spec.ts
//
// Спеки «Пути оператора» (wave «steps one by one»): drip по сменам,
// catch-up по очкам прозрачного лидерборда, видимость шагов и прогресс.

import { describe, expect, it } from "vitest";
import {
  LEAD_PATH_STEPS,
  OPERATOR_GUIDES,
  applyGuideRead,
  applyLeadPathDrip,
  computeLeadPathProgress,
  countLeadPathDone,
  DEFAULT_LEAD_PATH_STATE,
  guidesStorageKey,
  isLeadPathStepDone,
  leadPathTodayKey,
  mergeLeadPathState,
  parseGuidesReadIds,
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

  it("«Теория» закрывается ТОЛЬКО гайдами библиотеки — очками не купить", () => {
    const theory = LEAD_PATH_STEPS.find((s) => s.id === "theory");
    if (!theory) throw new Error("шаг theory обязан существовать (wave «next step reveal»)");
    // 500 очков, но гайды не открыты — шаг не закрыт
    expect(isLeadPathStepDone(theory, stats({ myPoints: 500, guidesRead: 0 }))).toBe(false);
    // Частично прочитанные гайды не закрывают
    expect(isLeadPathStepDone(theory, stats({ myPoints: 500, guidesRead: OPERATOR_GUIDES.length - 1 }))).toBe(false);
    // Все гайды — шаг закрыт (даже с нулём очков)
    expect(isLeadPathStepDone(theory, stats({ myPoints: 0, guidesRead: OPERATOR_GUIDES.length }))).toBe(true);
    // undefined (не-crew/старый снимок) — шаг не закрыт
    expect(isLeadPathStepDone(theory, stats({ myPoints: 100 }))).toBe(false);
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
    // 100 очков, но гайды не открыты → «Теория» не закрыта (стоп на ней)
    expect(countLeadPathDone(LEAD_PATH_STEPS, stats({ myPoints: 200, myRank: 7, crewSize: 6 })))
      .toBe(LEAD_PATH_STEPS.length - 2);
    // Те же очки + все гайды → «Теория» закрыта, стоп на «Легенде» (rank вне топ-3)
    expect(countLeadPathDone(LEAD_PATH_STEPS, stats({ myPoints: 200, myRank: 7, crewSize: 6, guidesRead: OPERATOR_GUIDES.length })))
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
      stats({ myPoints: 500, myRank: 1, crewSize: 4, guidesRead: OPERATOR_GUIDES.length }),
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

describe("mergeLeadPathState: прогресс не откатывается старым снимком", () => {
  it("revealed — максимум из двух состояний", () => {
    const local: LeadPathState = { revealed: 4, lastRevealDay: "2026-09-08", celebrated: ["first-touch"] };
    const remote: LeadPathState = { revealed: 2, lastRevealDay: "2026-09-05", celebrated: [] };
    const merged = mergeLeadPathState(local, remote);
    expect(merged.revealed).toBe(4);
    // Обратный порядок — тот же результат (коммутативность).
    expect(mergeLeadPathState(remote, local).revealed).toBe(4);
  });

  it("lastRevealDay — более поздняя дата; null не затирает значение", () => {
    const local: LeadPathState = { revealed: 2, lastRevealDay: "2026-09-08", celebrated: [] };
    const remote: LeadPathState = { revealed: 2, lastRevealDay: "2026-09-10", celebrated: [] };
    expect(mergeLeadPathState(local, remote).lastRevealDay).toBe("2026-09-10");
    expect(mergeLeadPathState(remote, local).lastRevealDay).toBe("2026-09-10");
    // null с одной стороны — берём ненулевое значение
    const fresh: LeadPathState = { revealed: 1, lastRevealDay: null, celebrated: [] };
    expect(mergeLeadPathState(local, fresh).lastRevealDay).toBe("2026-09-08");
    expect(mergeLeadPathState(fresh, local).lastRevealDay).toBe("2026-09-08");
    // оба null — остаётся null
    expect(mergeLeadPathState(fresh, fresh).lastRevealDay).toBeNull();
  });

  it("celebrated — объединение без дублей", () => {
    const local: LeadPathState = { revealed: 3, lastRevealDay: null, celebrated: ["start", "first-touch"] };
    const remote: LeadPathState = { revealed: 2, lastRevealDay: null, celebrated: ["first-touch", "call-back"] };
    const merged = mergeLeadPathState(local, remote);
    expect(merged.celebrated).toEqual(["start", "first-touch", "call-back"]);
  });

  it("дефолт + серверное состояние → серверный прогресс сохраняется", () => {
    const remote: LeadPathState = { revealed: 6, lastRevealDay: "2026-09-07", celebrated: ["start", "first-touch", "call-back"] };
    const merged = mergeLeadPathState(DEFAULT_LEAD_PATH_STATE, remote);
    expect(merged.revealed).toBe(6);
    expect(merged.lastRevealDay).toBe("2026-09-07");
    expect(merged.celebrated).toHaveLength(3);
  });
});

describe("«Теория» (wave next-step-reveal): структура лестницы и гайды", () => {
  it("теория вставлена между «подготовкой» и короной; всего 8 шагов", () => {
    expect(LEAD_PATH_STEPS).toHaveLength(8);
    expect(LEAD_PATH_STEPS[LEAD_PATH_STEPS.length - 1].id).toBe("top3"); // корона осталась финалом
    expect(LEAD_PATH_STEPS[6].id).toBe("theory");
    expect(LEAD_PATH_STEPS[5].id).toBe("prep");
    expect(LEAD_PATH_STEPS[6].kind).toBe("guides");
  });

  it("catch-up сквозь теорию: очки + все гайды → текущий — «Легенда», revealed = 8", () => {
    const res = computeLeadPathProgress(
      { revealed: 2, lastRevealDay: "2026-09-08", celebrated: [] },
      LEAD_PATH_STEPS,
      stats({ myPoints: 100, myRank: null, crewSize: 4, guidesRead: OPERATOR_GUIDES.length }),
    );
    // Закрыты пороги 0/3/9/20/35/60 + теория (гайды) = 7 подряд
    expect(res.doneCount).toBe(7);
    expect(res.views[6]).toBe("done");
    expect(res.views[7]).toBe("current");
    expect(res.revealed).toBe(LEAD_PATH_STEPS.length);
  });

  it("прогресс текущей «Теории» — доля открытых гайдов, не очков", () => {
    const one = computeLeadPathProgress(
      DEFAULT_LEAD_PATH_STATE,
      LEAD_PATH_STEPS,
      stats({ myPoints: 100, guidesRead: 1 }), // пороги до 60 закрыты очками → текущая теория
    );
    expect(one.currentIndex).toBe(6);
    expect(one.currentPct).toBe(Math.round((1 / OPERATOR_GUIDES.length) * 100));

    const none = computeLeadPathProgress(
      DEFAULT_LEAD_PATH_STATE,
      LEAD_PATH_STEPS,
      stats({ myPoints: 100, guidesRead: 0 }),
    );
    expect(none.currentIndex).toBe(6);
    expect(none.currentPct).toBe(0);
  });

  it("OPERATOR_GUIDES: три гайда с уникальными id и офлайн-ссылками /docs/", () => {
    expect(OPERATOR_GUIDES).toHaveLength(3);
    const ids = new Set(OPERATOR_GUIDES.map((g) => g.id));
    expect(ids.size).toBe(3);
    for (const g of OPERATOR_GUIDES) {
      expect(g.href).toMatch(/^\/docs\/.+\.html$/);
      expect(g.title.length).toBeGreaterThan(0);
    }
    expect(OPERATOR_GUIDES.map((g) => g.href)).toEqual([
      "/docs/avito-leads-guide.html",
      "/docs/brutal-business-truths-2026.html",
      "/docs/ultimate-sales-playbook-2026.html",
    ]);
  });

  it("сторы отметок гайдов: парс валидирует id, apply не дублирует", () => {
    expect(guidesStorageKey("motorpark")).toBe("leads-guides:motorpark");
    expect(parseGuidesReadIds(null)).toEqual([]);
    expect(parseGuidesReadIds("не json")).toEqual([]);
    expect(parseGuidesReadIds("{}" )).toEqual([]);
    // неизвестные id и дубли отбрасываются
    expect(parseGuidesReadIds(JSON.stringify(["avito-guide", "avito-guide", "hack", 42, "ultimate-sales"]) as unknown as string))
      .toEqual(["avito-guide", "ultimate-sales"]);
    // apply добавляет только известный id и только один раз
    expect(applyGuideRead([], "brutal-truths")).toEqual(["brutal-truths"]);
    expect(applyGuideRead(["brutal-truths"], "brutal-truths")).toEqual(["brutal-truths"]);
    expect(applyGuideRead([], "неизвестный")).toEqual([]);
  });
});
