/**
 * tests/franchize/lead-kpi.spec.ts
 *
 * Тесты KPI-воронки (lib/lead-kpi.ts) — оцифровка отдела продаж из протокола:
 *  1. Воронка: Лиды → Диалог (отработан) → КЭВ (договор/бронь) → Сделка.
 *  2. Заглушки операторов исключены из воронки.
 *  3. Fallback стадии: без stageKey считается computeLeadStage локально.
 *  4. Активность дня: leadsToday / handledToday / прогресс нормы.
 *  5. Конверсии: responseRate/kevRate/dealRate (null при нулевом знаменателе).
 *  6. «Горячие ждут»: temperature=hot без обработки/конверсии/перезвона.
 *  7. Тест-драйвы из avito intent, выручка и средний чек.
 *  8. Скоростные метрики встроены (speed.medianMs).
 */

import { describe, expect, it } from "vitest";
import { computeLeadKpi, NORM_HANDLED_PER_DAY } from "@/app/franchize/[slug]/leads/lib/lead-kpi";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/[slug]/leads/leads-types";

const NOW = Date.parse("2026-09-04T12:00:00.000Z");

function buildLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    user_id: "lead-1",
    full_name: "Тест Лид",
    username: null,
    phone: null,
    source: "callback_request",
    bikeTitle: null,
    createdAt: "2026-09-04T10:00:00.000Z",
    lastSeenAt: null,
    verified: false,
    rentals: [],
    sales: [],
    ...overrides,
  };
}

function handledTodo(leadId: string, completedAt = "2026-09-04T10:30:00.000Z"): LeadTodoRow {
  return {
    id: `todo-h-${leadId}`,
    lead_id: leadId,
    user_id: null,
    phone: null,
    rental_id: null,
    title: "✅ Лид обработан",
    description: '{"kind":"handled"}',
    status: "done",
    priority: "normal",
    category: "lead_handling",
    created_at: completedAt,
    completed_at: completedAt,
    assigned_to: null,
    due_date: null,
  };
}

function callbackTodo(leadId: string, dueAt: string): LeadTodoRow {
  return {
    id: `todo-cb-${leadId}`,
    lead_id: leadId,
    user_id: null,
    phone: null,
    rental_id: null,
    title: "📞 Перезвонить",
    description: '{"kind":"callback"}',
    status: "pending",
    priority: "normal",
    category: "lead_handling",
    created_at: "2026-09-04T10:30:00.000Z",
    completed_at: null,
    assigned_to: null,
    due_date: dueAt,
  };
}

describe("lead-kpi: воронка", () => {
  it("считает ступени: лиды → диалог (отметка) → КЭВ (stageKey) → сделка (активная аренда)", () => {
    const leads: LeadRow[] = [
      // Просто входящий — только «Лиды».
      buildLead({ user_id: "l-new" }),
      // Отработан отметкой → «Диалог».
      buildLead({ user_id: "l-handled" }),
      // КЭВ: договор отправлен.
      buildLead({ user_id: "l-kev", stageKey: "contract_sent" }),
      // Сделка: активная аренда (конец далеко → active_rental).
      buildLead({
        user_id: "l-deal",
        stageKey: "active_rental",
        rentals: [
          {
            rentalId: "r-1",
            status: "active",
            paymentStatus: "paid",
            startDate: "2026-09-03T10:00:00.000Z",
            endDate: "2026-09-20T10:00:00.000Z",
            bikeTitle: "79BIKE Falcon GT",
            totalCost: 25000,
          },
        ],
      }),
    ];
    const todos = [
      handledTodo("l-handled"),
      handledTodo("l-kev"), // КЭВ-лид также отработан оператором
    ];

    const kpi = computeLeadKpi(leads, todos, NOW);

    expect(kpi.funnel.leads).toBe(4);
    // Диалог = отметка «обработан» ИЛИ конверсия: l-handled (отметка),
    // l-kev (отметка), l-deal (конверсия в аренду).
    expect(kpi.funnel.dialogs).toBe(3);
    expect(kpi.funnel.kev).toBe(2);
    expect(kpi.funnel.deals).toBe(1);
  });

  it("заглушки операторов (operator_placeholder) не попадают в воронку", () => {
    const leads: LeadRow[] = [
      buildLead({ user_id: "l-1" }),
      buildLead({ user_id: "l-ph", identityState: "operator_placeholder", stageKey: "active_rental" }),
    ];
    const kpi = computeLeadKpi(leads, [], NOW);
    expect(kpi.funnel.leads).toBe(1);
    expect(kpi.funnel.kev).toBe(0);
    expect(kpi.funnel.deals).toBe(0);
  });

  it("fallback стадии без stageKey: confirmed-аренда без оператора → contract_sent (КЭВ)", () => {
    const leads: LeadRow[] = [
      buildLead({
        user_id: "l-1",
        rentals: [
          {
            rentalId: "r-1",
            status: "confirmed",
            paymentStatus: "pending",
            startDate: "2026-09-05T10:00:00.000Z",
            endDate: "2026-09-08T10:00:00.000Z",
            bikeTitle: null,
            totalCost: 12000,
          },
        ],
      }),
    ];
    const kpi = computeLeadKpi(leads, [], NOW);
    expect(kpi.funnel.kev).toBe(1);
    expect(kpi.funnel.deals).toBe(0);
  });

  it("продажа без аренд → closed_won → сделка", () => {
    const leads: LeadRow[] = [
      buildLead({
        user_id: "l-1",
        stageKey: "closed_won",
        sales: [{ saleId: "s-1", bikeTitle: "Talaria Sting", salePrice: 180000, createdAt: "2026-09-01T10:00:00.000Z" }],
      }),
    ];
    const kpi = computeLeadKpi(leads, [], NOW);
    expect(kpi.funnel.deals).toBe(1);
    expect(kpi.funnel.kev).toBe(1);
  });
});

describe("lead-kpi: активность и конверсии", () => {
  it("leadsToday считает только сегодняшние создания; handledToday — из отметок", () => {
    const leads: LeadRow[] = [
      buildLead({ user_id: "l-1", createdAt: "2026-09-04T09:00:00.000Z" }),
      buildLead({ user_id: "l-2", createdAt: "2026-09-02T09:00:00.000Z" }), // не сегодня
      buildLead({ user_id: "l-3", createdAt: "2026-09-04T11:00:00.000Z" }),
    ];
    const kpi = computeLeadKpi(leads, [handledTodo("l-1")], NOW);
    expect(kpi.leadsToday).toBe(2);
    expect(kpi.handledToday).toBe(1);
    expect(kpi.normProgress).toBeCloseTo(1 / NORM_HANDLED_PER_DAY, 6);
  });

  it("конверсии: response/kev/deal rates; null при пустой воронке", () => {
    const empty = computeLeadKpi([], [], NOW);
    expect(empty.responseRate).toBeNull();
    expect(empty.kevRate).toBeNull();
    expect(empty.dealRate).toBeNull();

    const leads: LeadRow[] = [
      buildLead({ user_id: "l-1" }),
      buildLead({ user_id: "l-2", stageKey: "contract_sent" }),
      buildLead({ user_id: "l-3", stageKey: "active_rental" }),
      buildLead({ user_id: "l-4", stageKey: "closed_lost" }),
    ];
    const kpi = computeLeadKpi(leads, [handledTodo("l-1"), handledTodo("l-2")], NOW);
    expect(kpi.responseRate).toBeCloseTo(0.5, 6);
    expect(kpi.kevRate).toBeCloseTo(0.5, 6);
    expect(kpi.dealRate).toBeCloseTo(0.25, 6);
  });

  it("прогресс нормы дня может превышать 1 (перевыполнение)", () => {
    const leads = ["a", "b", "c", "d", "e"].map((id) => buildLead({ user_id: `l-${id}` }));
    const todos = leads.map((l) => handledTodo(l.user_id));
    const kpi = computeLeadKpi(leads, todos, NOW);
    expect(kpi.normProgress).toBeGreaterThan(1);
  });
});

describe("lead-kpi: горячие лиды и юнит-экономика", () => {
  it("hotWaiting: горячий без ответа считается; с перезвоном/конверсией — нет", () => {
    const leads: LeadRow[] = [
      buildLead({ user_id: "l-wait", avito: { chatId: null, itemUrl: null, profileUrl: null, itemId: null, lastMessage: null, analysis: { temperature: "hot", intent: "price", confidence: 90, suggestedReply: null, shortReply: null, nextBestAction: null, objection: null, entities: null, notes: null, model: null, analyzedAt: null } } }),
      buildLead({ user_id: "l-cb", avito: { chatId: null, itemUrl: null, profileUrl: null, itemId: null, lastMessage: null, analysis: { temperature: "hot", intent: "availability", confidence: 90, suggestedReply: null, shortReply: null, nextBestAction: null, objection: null, entities: null, notes: null, model: null, analyzedAt: null } } }),
      buildLead({ user_id: "l-deal", avito: { chatId: null, itemUrl: null, profileUrl: null, itemId: null, lastMessage: null, analysis: { temperature: "hot", intent: "testdrive", confidence: 90, suggestedReply: null, shortReply: null, nextBestAction: null, objection: null, entities: null, notes: null, model: null, analyzedAt: null } }, rentals: [{ rentalId: "r-9", status: "active", paymentStatus: "paid", startDate: "2026-09-03T00:00:00.000Z", endDate: "2026-09-20T00:00:00.000Z", bikeTitle: null, totalCost: 20000 }] }),
      buildLead({ user_id: "l-cold", avito: { chatId: null, itemUrl: null, profileUrl: null, itemId: null, lastMessage: null, analysis: { temperature: "cold", intent: "generic", confidence: 50, suggestedReply: null, shortReply: null, nextBestAction: null, objection: null, entities: null, notes: null, model: null, analyzedAt: null } } }),
    ];
    const todos = [callbackTodo("l-cb", "2026-09-04T15:00:00.000Z")];

    const kpi = computeLeadKpi(leads, todos, NOW);
    expect(kpi.hotTotal).toBe(3);
    expect(kpi.hotWaiting).toBe(1); // только l-wait
  });

  it("тест-драйвы считаются из avito intent; выручка и средний чек — из totalSpent", () => {
    const leads: LeadRow[] = [
      buildLead({ user_id: "l-1", avito: { chatId: null, itemUrl: null, profileUrl: null, itemId: null, lastMessage: null, analysis: { intent: "testdrive", temperature: "hot", confidence: 90, suggestedReply: null, shortReply: null, nextBestAction: null, objection: null, entities: null, notes: null, model: null, analyzedAt: null } } }),
      buildLead({ user_id: "l-2", totalSpent: 30000, stageKey: "active_rental" }),
      buildLead({ user_id: "l-3", totalSpent: 25000, stageKey: "closed_won" }),
    ];
    const kpi = computeLeadKpi(leads, [], NOW);
    expect(kpi.testdrives).toBe(1);
    expect(kpi.revenue).toBe(55000);
    expect(kpi.avgDealCheck).toBe(27500);
  });

  it("скоростные метрики встроены: медиана по отметке «обработан»", () => {
    const leads = [buildLead({ user_id: "l-1", createdAt: "2026-09-04T10:00:00.000Z" })];
    const kpi = computeLeadKpi(leads, [handledTodo("l-1", "2026-09-04T10:45:00.000Z")], NOW);
    expect(kpi.speed.medianMs).toBe(45 * 60_000);
    expect(kpi.handledToday).toBe(1);
  });
});
