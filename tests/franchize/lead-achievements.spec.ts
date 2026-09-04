/**
 * tests/franchize/lead-achievements.spec.ts
 *
 * Тесты геймификации KPI (lib/lead-achievements.ts):
 *  1. «max»-метрики: уровень растёт с ростом значения, прогресс к следующему.
 *  2. «min»-метрики: уровень растёт при снижении (очередь, просрочки).
 *  3. Заблокированные бейджи: progress 0, unlocked false.
 *  4. MAX: золотой уровень взят — nextTarget null, maxed true.
 *  5. Недоступная метрика (нет точек скорости) → available false.
 *  6. «Горячий спасатель» скрыт, когда горячих лидов нет.
 *  7. «Идеальная смена» — легенда: все условия → открыто, иначе закрыто.
 *  8. countUnlocked и монотонность по сделкам.
 *  9. ПАКЕТ 2: тест-драйвы, средний чек, продажи, норма недели, магнит недели,
 *     юнит-экономика, дожим, марафон, глубина диалога, «Идеальная неделя».
 */

import { describe, expect, it } from "vitest";
import {
  computeLeadAchievements,
  countUnlocked,
} from "@/app/franchize/[slug]/leads/lib/lead-achievements";
import type { LeadKpiMetrics } from "@/app/franchize/[slug]/leads/lib/lead-kpi";
import type { LeadSpeedMetrics } from "@/app/franchize/[slug]/leads/lib/lead-speed";

function buildSpeed(overrides: Partial<LeadSpeedMetrics> = {}): LeadSpeedMetrics {
  return {
    handledTotal: 10,
    handledToday: 4,
    converted: 3,
    medianMs: 30 * 60_000, // 30 мин — серебро «Скорострела»
    avgMs: 40 * 60_000,
    fastestMs: 5 * 60_000,
    waitingTotal: 0,
    waitingOver1h: 0,
    waitingOver24h: 0,
    callbacksPending: 0,
    callbacksOverdue: 0,
    buckets: [],
    worstWaiting: [],
    ...overrides,
  };
}

function buildKpi(overrides: Partial<LeadKpiMetrics> = {}): LeadKpiMetrics {
  return {
    funnel: { leads: 40, dialogs: 20, kev: 10, deals: 5 },
    leadsToday: 3,
    leadsThisWeek: 15,
    kevThisWeek: 8,
    salesTotal: 1,
    handledToday: 4,
    hotTotal: 4,
    hotWaiting: 0,
    testdrives: 2,
    revenue: 200_000,
    avgDealCheck: 25_000,
    revenuePerLead: 5_000,
    avgDialogDepth: 3,
    responseRate: 0.5,
    kevRate: 0.25,
    dealRate: 0.125,
    normProgress: 1,
    speed: buildSpeed(),
    ...overrides,
  };
}

function find(list: ReturnType<typeof computeLeadAchievements>, id: string) {
  const a = list.find((x) => x.id === id);
  if (!a) throw new Error(`achievement ${id} not found`);
  return a;
}

describe("lead-achievements: max-метрики", () => {
  it("Касса: 200к ₽ — серебро (≥150к), прогресс к золоту 300к", () => {
    const list = computeLeadAchievements(buildKpi());
    const cashier = find(list, "cashier");
    expect(cashier.unlocked).toBe(true);
    expect(cashier.tier).toBe("silver");
    expect(cashier.maxed).toBe(false);
    expect(cashier.progress).toBeCloseTo((200_000 - 150_000) / (300_000 - 150_000), 6);
  });

  it("Клоузер: 5 сделок — серебро (≥3), прогресс к золоту 6", () => {
    const list = computeLeadAchievements(buildKpi());
    const closer = find(list, "closer");
    expect(closer.tier).toBe("silver");
    expect(closer.progress).toBeCloseTo((5 - 3) / (6 - 3), 6);
  });

  it("Клоузер: 0 сделок — заблокирован, прогресс = доля от бронзы", () => {
    const list = computeLeadAchievements(buildKpi({ funnel: { leads: 40, dialogs: 20, kev: 10, deals: 0 } }));
    const closer = find(list, "closer");
    expect(closer.unlocked).toBe(false);
    expect(closer.progress).toBe(0);
    expect(closer.nextTarget).toBe(1);
  });

  it("Монотонность: больше сделок — уровень не ниже", () => {
    const rank = { bronze: 0, silver: 1, gold: 2, legend: 3 } as const;
    const a = find(computeLeadAchievements(buildKpi({ funnel: { leads: 40, dialogs: 20, kev: 10, deals: 1 } })), "closer");
    const b = find(computeLeadAchievements(buildKpi({ funnel: { leads: 40, dialogs: 20, kev: 10, deals: 6 } })), "closer");
    expect(rank[b.tier]).toBeGreaterThan(rank[a.tier]);
  });

  it("MAX: золотой уровень — maxed true, nextTarget null, progress 1", () => {
    const list = computeLeadAchievements(buildKpi({ revenue: 500_000 }));
    const cashier = find(list, "cashier");
    expect(cashier.maxed).toBe(true);
    expect(cashier.nextTarget).toBeNull();
    expect(cashier.progress).toBe(1);
    expect(cashier.tier).toBe("gold");
  });
});

describe("lead-achievements: min-метрики", () => {
  it("Чистая очередь: 3 ждут — бронза (≤5), прогресс к серебру ≤2", () => {
    const kpi = buildKpi({ speed: buildSpeed({ waitingTotal: 3 }) });
    const a = find(computeLeadAchievements(kpi), "queue-cleaner");
    expect(a.unlocked).toBe(true);
    expect(a.tier).toBe("bronze");
    expect(a.progress).toBeCloseTo((5 - 3) / (5 - 2), 6);
  });

  it("Чистая очередь: 0 ждут — золото MAX", () => {
    const a = find(computeLeadAchievements(buildKpi()), "queue-cleaner");
    expect(a.tier).toBe("gold");
    expect(a.maxed).toBe(true);
  });

  it("SLA-щит: 6 ждут >24 ч (двойная бронза) — заблокирован, прогресс 0", () => {
    const kpi = buildKpi({ speed: buildSpeed({ waitingOver24h: 6 }) });
    const a = find(computeLeadAchievements(kpi), "sla-shield");
    expect(a.unlocked).toBe(false);
    // Формула заблокированного min-бейджа: 0% на двойном пороге бронзы,
    // 100% у самого порога — 6 при цели ≤3 даёт ровно ноль.
    expect(a.progress).toBe(0);
    expect(a.nextTarget).toBe(3);
  });

  it("Перезвон-ниндзя: 1 просрочка — серебро (≤1), не золото", () => {
    const kpi = buildKpi({ speed: buildSpeed({ callbacksOverdue: 1, callbacksPending: 2 }) });
    const a = find(computeLeadAchievements(kpi), "callback-ninja");
    expect(a.tier).toBe("silver");
    expect(a.maxed).toBe(false);
  });
});

describe("lead-achievements: доступность и легенда", () => {
  it("Скорострел недоступен, если нет ни одной точки скорости (median null)", () => {
    const kpi = buildKpi({ speed: buildSpeed({ medianMs: null, avgMs: null, fastestMs: null }) });
    const a = find(computeLeadAchievements(kpi), "speedster");
    expect(a.available).toBe(false);
    expect(a.unlocked).toBe(false);
  });

  it("Горячий спасатель скрыт, когда горячих лидов нет вообще", () => {
    const kpi = buildKpi({ hotTotal: 0, hotWaiting: 0 });
    const a = find(computeLeadAchievements(kpi), "hot-rescuer");
    expect(a.available).toBe(false);
  });

  it("Горячий спасатель: все горячие отвечены — золото 100%", () => {
    const a = find(computeLeadAchievements(buildKpi()), "hot-rescuer");
    expect(a.tier).toBe("gold");
    expect(a.maxed).toBe(true);
    expect(a.valueLabel).toBe("100 %");
  });

  it("Идеальная смена: все условия (медиана ≤1ч, нули SLA, норма 4) — легенда открыта", () => {
    const a = find(computeLeadAchievements(buildKpi()), "perfect-shift");
    expect(a.tier).toBe("legend");
    expect(a.unlocked).toBe(true);
    expect(a.maxed).toBe(true);
    expect(a.valueLabel).toBe("выполнено");
  });

  it("Идеальная смена: просроченные перезвоны — закрыта", () => {
    const kpi = buildKpi({ speed: buildSpeed({ callbacksOverdue: 1 }) });
    const a = find(computeLeadAchievements(kpi), "perfect-shift");
    expect(a.unlocked).toBe(false);
    expect(a.progress).toBe(0);
  });

  it("Идеальная смена: медиана выше часа — закрыта", () => {
    const kpi = buildKpi({ speed: buildSpeed({ medianMs: 2 * 60 * 60_000 }) });
    const a = find(computeLeadAchievements(kpi), "perfect-shift");
    expect(a.unlocked).toBe(false);
  });
});

describe("lead-achievements: пакет 2 — регулярные бейджи", () => {
  it("Тест-драйвер: 2 заявки — бронза, прогресс к серебру (3)", () => {
    const a = find(computeLeadAchievements(buildKpi()), "drive-master");
    expect(a.unlocked).toBe(true);
    expect(a.tier).toBe("bronze");
    expect(a.progress).toBeCloseTo((2 - 1) / (3 - 1), 6);
  });

  it("Средний чек: 25к — золото MAX; без сделок (null) — скрыт", () => {
    const a = find(computeLeadAchievements(buildKpi()), "avg-check");
    expect(a.tier).toBe("gold");
    expect(a.maxed).toBe(true);

    const hidden = find(computeLeadAchievements(buildKpi({ avgDealCheck: null })), "avg-check");
    expect(hidden.available).toBe(false);
    expect(hidden.unlocked).toBe(false);
  });

  it("Продажник: 2 продажи — серебро; 0 — заблокирован с прогрессом 0", () => {
    const a = find(computeLeadAchievements(buildKpi({ salesTotal: 2 })), "seller");
    expect(a.tier).toBe("silver");
    expect(a.maxed).toBe(false);

    const locked = find(computeLeadAchievements(buildKpi({ salesTotal: 0 })), "seller");
    expect(locked.unlocked).toBe(false);
    expect(locked.progress).toBe(0);
    expect(locked.nextTarget).toBe(1);
  });

  it("Норма недели: 8 КЭВ — бронза (≥5), прогресс к серебру (10)", () => {
    const a = find(computeLeadAchievements(buildKpi()), "week-kev");
    expect(a.tier).toBe("bronze");
    expect(a.progress).toBeCloseTo((8 - 5) / (10 - 5), 6);
  });

  it("Норма недели: 20 КЭВ — золото MAX (недельное нормирование выполнено)", () => {
    const a = find(computeLeadAchievements(buildKpi({ kevThisWeek: 20 })), "week-kev");
    expect(a.tier).toBe("gold");
    expect(a.maxed).toBe(true);
  });

  it("Магнит недели: 15 лидов — бронза; 50 — золото MAX", () => {
    const a = find(computeLeadAchievements(buildKpi()), "week-magnet");
    expect(a.tier).toBe("bronze");
    const max = find(computeLeadAchievements(buildKpi({ leadsThisWeek: 50 })), "week-magnet");
    expect(max.tier).toBe("gold");
    expect(max.maxed).toBe(true);
  });

  it("Юнит-экономика: 5000 ₽ на лид — золото MAX; без лидов (null) — скрыт", () => {
    const a = find(computeLeadAchievements(buildKpi()), "unit-econ");
    expect(a.tier).toBe("gold");
    expect(a.maxed).toBe(true);

    const hidden = find(computeLeadAchievements(buildKpi({ revenuePerLead: null })), "unit-econ");
    expect(hidden.available).toBe(false);
  });

  it("Дожиматель: 12.5% сделок — серебро (≥10%), прогресс к золоту (20%)", () => {
    const a = find(computeLeadAchievements(buildKpi()), "squeeze");
    expect(a.tier).toBe("silver");
    expect(a.progress).toBeCloseTo((0.125 - 0.1) / (0.2 - 0.1), 6);
  });

  it("Марафонец: 10 обработано — заблокирован, прогресс = доля от бронзы (20)", () => {
    const a = find(computeLeadAchievements(buildKpi()), "marathon");
    expect(a.unlocked).toBe(false);
    expect(a.progress).toBeCloseTo(10 / 20, 6);
    expect(a.nextTarget).toBe(20);
  });

  it("Глубокий диалог: 3 сообщения в среднем — бронза; нет данных (null) — скрыт", () => {
    const a = find(computeLeadAchievements(buildKpi()), "dialog-depth");
    expect(a.unlocked).toBe(true);
    expect(a.tier).toBe("bronze");

    const hidden = find(computeLeadAchievements(buildKpi({ avgDialogDepth: null })), "dialog-depth");
    expect(hidden.available).toBe(false);
  });
});

describe("lead-achievements: легенда 2 — идеальная неделя", () => {
  it("Норма недели КЭВ выполнена и нули SLA/перезвонов — легенда открыта", () => {
    const a = find(computeLeadAchievements(buildKpi({ kevThisWeek: 20 })), "perfect-week");
    expect(a.tier).toBe("legend");
    expect(a.unlocked).toBe(true);
    expect(a.maxed).toBe(true);
    expect(a.valueLabel).toBe("выполнено");
  });

  it("КЭВ за неделю ниже нормы — закрыта", () => {
    const a = find(computeLeadAchievements(buildKpi({ kevThisWeek: 15 })), "perfect-week");
    expect(a.unlocked).toBe(false);
    expect(a.progress).toBe(0);
  });

  it("Просроченные перезвоны — закрыта, даже при выполненной норме", () => {
    const kpi = buildKpi({ kevThisWeek: 25, speed: buildSpeed({ callbacksOverdue: 1 }) });
    const a = find(computeLeadAchievements(kpi), "perfect-week");
    expect(a.unlocked).toBe(false);
  });
});

describe("lead-achievements: сводка", () => {
  it("countUnlocked считает только доступные и открытые", () => {
    const kpi = buildKpi({
      speed: buildSpeed({ medianMs: null, avgMs: null, fastestMs: null }), // скорострел скрыт
      hotTotal: 0, // горячий спасатель скрыт
      funnel: { leads: 40, dialogs: 20, kev: 10, deals: 5 },
      revenue: 500_000, // касса — золото
    });
    const list = computeLeadAchievements(kpi);
    // 23 достижения всего (13 пакета 1 + 10 пакета 2), 2 скрыты → 21 доступно.
    // Открыты с фикстурой: очередь, SLA, перезвон, КЭВ-мастер, клоузер, разгон,
    // диалог, воронка, касса, магнит, тест-драйвер, средний чек, продажник,
    // норма недели, магнит недели, юнит-экономика, дожим, глубокий диалог = 18;
    // закрыты: марафон (10 < 20), идеальная смена (медиана null),
    // идеальная неделя (8 < 20).
    expect(countUnlocked(list)).toBe(18);
    expect(list.filter((a) => !a.available)).toHaveLength(2);
    expect(list).toHaveLength(23);
  });
});
