/**
 * tests/franchize/helpers/lead-kpi-fixture.ts
 *
 * Общий fixture LeadKpiMetrics для спеков геймификации (достижения,
 * путь оператора). Значения подобраны так, что бейджи из карты кормления
 * (PLAYBOOK_FEEDS) находятся в осмысленных уровнях: серебро «Пяти минут»,
 * серебро «Клоузера» и т.д. Данные — все числовые, БД не трогаем.
 */

import type { LeadKpiMetrics } from "@/app/franchize/[slug]/leads/lib/lead-kpi";
import type { LeadSpeedMetrics } from "@/app/franchize/[slug]/leads/lib/lead-speed";

export function buildSpeed(overrides: Partial<LeadSpeedMetrics> = {}): LeadSpeedMetrics {
  return {
    handledTotal: 10,
    handledToday: 4,
    activeDaysThisWeek: 5,
    converted: 3,
    medianMs: 30 * 60_000, // 30 мин — серебро «Скорострела»
    avgMs: 40 * 60_000,
    fastestMs: 5 * 60_000,
    handledTimedTotal: 10,
    under5m: 6,
    under5mRate: 0.6, // серебро «Пяти минут»
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

export function buildKpi(overrides: Partial<LeadKpiMetrics> = {}): LeadKpiMetrics {
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
    avitoLeads: 20,
    weekendLeads: 4,
    weekendHandled: 3,
    ghostsTotal: 2,
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
