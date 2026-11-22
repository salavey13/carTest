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
 *  9. ПАКЕТ 2: недельные метрики (leadsThisWeek/kevThisWeek), продажи,
 *     выручка на лид, глубина диалога, startOfWeek.
 */

import { describe, expect, it } from "vitest";
import {
  computeLeadKpi,
  NORM_HANDLED_PER_DAY,
  NORM_KEV_PER_WEEK,
  startOfWeek,
} from "@/app/franchize/[slug]/leads/lib/lead-kpi";
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

describe("lead-kpi: пакет 2 — неделя, продажи, юнит-экономика, диалог", () => {
  it("startOfWeek: четверг/воскресенье → понедельник 00:00 той же недели", () => {
    // 2026-09-04 (пт) и 2026-09-06 (вс) строятся ЛОКАЛЬНО: UTC-константа
    // («2026-09-06T23:00Z») в MSK — уже понедельник, тест ломался от таймзоны
    // машины. startOfWeek работает в локальном календаре — вход тоже локальный.
    const fridayLocal = new Date(2026, 8, 4, 12, 0, 0, 0).getTime();
    const sundayLocal = new Date(2026, 8, 6, 23, 0, 0, 0).getTime();
    // 2026-09-04 — пятница; неделя начинается в пн 2026-08-31 (локально).
    const monday = startOfWeek(fridayLocal);
    const d = new Date(monday);
    expect(d.getDay()).toBe(1); // понедельник
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getMonth()).toBe(7); // август (пн 2026-08-31)
    // Воскресенье 2026-09-06 — та же неделя (неделя начинается в пн).
    expect(startOfWeek(sundayLocal)).toBe(monday);
  });

  it("leadsThisWeek/kevThisWeek: только текущая рабочая неделя; заглушки исключены", () => {
    const leads: LeadRow[] = [
      // На этой неделе, КЭВ (договор отправлен).
      buildLead({ user_id: "l-kev-week", createdAt: "2026-09-02T09:00:00.000Z", stageKey: "contract_sent" }),
      // На этой неделе, без КЭВ.
      buildLead({ user_id: "l-new-week", createdAt: "2026-09-03T09:00:00.000Z" }),
      // Прошлая неделя, КЭВ — в недельные счётчики не попадает.
      buildLead({ user_id: "l-kev-old", createdAt: "2026-08-25T09:00:00.000Z", stageKey: "closed_won" }),
      // Заглушка оператора — вообще не в воронке.
      buildLead({ user_id: "l-ph", createdAt: "2026-09-03T09:00:00.000Z", identityState: "operator_placeholder", stageKey: "active_rental" }),
    ];
    const kpi = computeLeadKpi(leads, [], NOW);
    expect(kpi.leadsThisWeek).toBe(2);
    expect(kpi.kevThisWeek).toBe(1);
    // Недельная норма связана с дневной: 4/д × 5 дней.
    expect(NORM_KEV_PER_WEEK).toBe(NORM_HANDLED_PER_DAY * 5);
  });

  it("лид с битой/пустой датой создания не роняет недельные метрики", () => {
    const leads: LeadRow[] = [
      buildLead({ user_id: "l-1", createdAt: null, stageKey: "contract_sent" }),
      buildLead({ user_id: "l-2", createdAt: "не дата", stageKey: "active_rental" }),
    ];
    const kpi = computeLeadKpi(leads, [], NOW);
    expect(kpi.leadsThisWeek).toBe(0);
    expect(kpi.kevThisWeek).toBe(0);
    expect(kpi.funnel.kev).toBe(2); // в общую воронку КЭВ всё же входит
  });

  it("salesTotal — сумма продаж по лидам; revenuePerLead — выручка на лид", () => {
    const leads: LeadRow[] = [
      buildLead({
        user_id: "l-sale-1",
        totalSpent: 180_000,
        stageKey: "closed_won",
        sales: [{ saleId: "s-1", bikeTitle: "Talaria Sting", salePrice: 180_000, createdAt: "2026-09-01T10:00:00.000Z" }],
      }),
      buildLead({
        user_id: "l-sale-2",
        totalSpent: 60_000,
        stageKey: "closed_won",
        sales: [
          { saleId: "s-2", bikeTitle: "Hurricane", salePrice: 40_000, createdAt: "2026-09-02T10:00:00.000Z" },
          { saleId: "s-3", bikeTitle: "Surge", salePrice: 20_000, createdAt: "2026-09-03T10:00:00.000Z" },
        ],
      }),
      buildLead({ user_id: "l-rent", totalSpent: 22_000, stageKey: "active_rental" }),
    ];
    const kpi = computeLeadKpi(leads, [], NOW);
    expect(kpi.salesTotal).toBe(3); // 1 + 2 продажи, лиды без продаж — 0
    expect(kpi.funnel.leads).toBe(3);
    expect(kpi.revenuePerLead).toBeCloseTo(262_000 / 3, 6);
  });

  it("revenuePerLead: null при пустой воронке", () => {
    const empty = computeLeadKpi([], [], NOW);
    expect(empty.revenuePerLead).toBeNull();
    expect(empty.avgDialogDepth).toBeNull();
  });

  it("avgDialogDepth — среднее сообщений покупателя (авито); 0 и без авито — не считаются", () => {
    const avito = (messagesCount: number | null | undefined) => ({
      chatId: null,
      itemUrl: null,
      profileUrl: null,
      itemId: null,
      lastMessage: null,
      ...(messagesCount === undefined ? {} : { messagesCount }),
    });
    const leads: LeadRow[] = [
      buildLead({ user_id: "l-1", avito: avito(3) }),
      buildLead({ user_id: "l-2", avito: avito(5) }),
      buildLead({ user_id: "l-zero", avito: avito(0) }), // ноль не считаем
      buildLead({ user_id: "l-none", avito: avito(null) }), // нет данных
      buildLead({ user_id: "l-noavito" }), // не авито-канал
    ];
    const kpi = computeLeadKpi(leads, [], NOW);
    expect(kpi.avgDialogDepth).toBe(4); // (3 + 5) / 2
  });
});

describe("lead-kpi: edge cases — битые данные не роняют аналитику", () => {
  it("totalSpent Infinity/отрицательный/NaN исключены: касса считает только конечные положительные", () => {
    // NaN отсекался и раньше (`NaN || 0` → 0); Infinity просачивался в
    // revenue → avgDealCheck = Infinity → «Infinity ₽» в чипе панели.
    const leads: LeadRow[] = [
      buildLead({ user_id: "l-ok", stageKey: "active_rental", totalSpent: 100_000 }),
      buildLead({ user_id: "l-inf", stageKey: "active_rental", totalSpent: Number.POSITIVE_INFINITY }),
      buildLead({ user_id: "l-neg", stageKey: "closed_won", totalSpent: -5_000 }),
      buildLead({ user_id: "l-nan", stageKey: "closed_won", totalSpent: Number.NaN }),
    ];
    const kpi = computeLeadKpi(leads, [], NOW);
    expect(kpi.revenue).toBe(100_000);
    expect(kpi.avgDealCheck).toBe(100_000 / 4); // 4 сделки, деньги только с одной
    expect(Number.isFinite(kpi.avgDealCheck as number)).toBe(true);
  });

  it("messagesCount = Infinity не портит avgDialogDepth", () => {
    const avito = (messagesCount: number) => ({
      chatId: null,
      itemUrl: null,
      profileUrl: null,
      itemId: null,
      lastMessage: null,
      messagesCount,
    });
    const leads: LeadRow[] = [
      buildLead({ user_id: "l-inf", avito: avito(Number.POSITIVE_INFINITY) }),
      buildLead({ user_id: "l-ok", avito: avito(6) }),
    ];
    const kpi = computeLeadKpi(leads, [], NOW);
    expect(kpi.avgDialogDepth).toBe(6); // Infinity исключён, среднее по одному
  });

  it("битая строка (rentals/sales = null) не роняет расчёт — воронка считает дальше", () => {
    const broken = buildLead({ user_id: "l-broken" }) as unknown as Record<string, unknown>;
    broken.rentals = null;
    broken.sales = null;
    const ok = buildLead({ user_id: "l-ok", stageKey: "contract_sent" });
    const kpi = computeLeadKpi([broken as unknown as LeadRow, ok], [], NOW);
    expect(kpi.funnel.leads).toBe(2);
    expect(kpi.funnel.kev).toBe(1); // битый лид не КЭВ (но и не крэш), ok-лид КЭВ
    // Оба лидa ждут ответа: битый — не обработан; ok-лид в contract_sent без
    // аренды/отметки тоже в очереди (КЭВ-стадия ≠ «обработан»).
    expect(kpi.speed.waitingTotal).toBe(2);
  });

  it("allTodos = null (битый срез) не роняет расчёт", () => {
    const kpi = computeLeadKpi([buildLead({ user_id: "l-1" })], null as unknown as LeadTodoRow[], NOW);
    expect(kpi.funnel.leads).toBe(1);
    expect(kpi.speed.callbacksPending).toBe(0);
  });
});

// ── Плейбук 2026: выходные, ghost, авито-канал ─────────────────────────────

describe("lead-kpi: плейбук 2026 (weekend / ghosts / avitoLeads)", () => {
  // Локальная суббота/воскресенье через new Date(y, m, d) — независимо от TZ
  // раннера: ISO строится от ЛОКАЛЬНОГО полудня субботы, getDay() вернёт 6.
  const SAT_ISO = new Date(2026, 7, 29, 12, 0, 0).toISOString(); // сб 29 авг
  const SUN_ISO = new Date(2026, 7, 30, 12, 0, 0).toISOString(); // вс 30 авг
  const FRI_ISO = "2026-09-04T10:00:00.000Z"; // пятница (NOW)

  it("Выходные лиды считаются, будни — нет", () => {
    const leads = [
      buildLead({ user_id: "l-sat", createdAt: SAT_ISO }),
      buildLead({ user_id: "l-sun", createdAt: SUN_ISO }),
      buildLead({ user_id: "l-fri", createdAt: FRI_ISO }),
    ];
    const kpi = computeLeadKpi(leads, [], NOW);
    expect(kpi.weekendLeads).toBe(2);
    expect(kpi.weekendHandled).toBe(0);
  });

  it("Обработанность выходных лидов: отметка или конверсия засчитывается", () => {
    const todo = handledTodo("l-sat", "2026-08-31T10:00:00.000Z"); // отметка в понедельник
    const converted = buildLead({
      user_id: "l-sun-conv",
      createdAt: SUN_ISO,
      rentals: [
        {
          rentalId: "r-1", status: "active", paymentStatus: "paid",
          startDate: "2026-09-01T10:00:00.000Z", endDate: "2026-09-20T10:00:00.000Z",
          bikeTitle: "79BIKE Falcon GT", totalCost: 21000,
        },
      ],
    });
    const kpi = computeLeadKpi(
      [buildLead({ user_id: "l-sat", createdAt: SAT_ISO }), converted],
      [todo],
      NOW,
    );
    expect(kpi.weekendLeads).toBe(2);
    expect(kpi.weekendHandled).toBe(2);
  });

  it("avitoLeads: считаются по каналу/chatId/user_id, прочие — нет", () => {
    const leads = [
      buildLead({ user_id: "avito:a", contactChannel: "avito" }),
      buildLead({ user_id: "plain-b", contactChannel: "web" }),
      buildLead({ user_id: "avito:c", contactChannel: "web" }), // префикс user_id
    ];
    const kpi = computeLeadKpi(leads, [], NOW);
    expect(kpi.avitoLeads).toBe(2);
  });

  it("Ghost: авито-диалог молчит >24 ч без обработки → ghostsTotal 1", () => {
    const ghost = buildLead({
      user_id: "avito:ghost",
      createdAt: "2026-09-02T06:00:00.000Z",
      avito: {
        chatId: "g", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Я подумаю", firstMessage: "Здравствуйте!",
        itemPrice: 2500, messagesCount: 3, lastMessageAt: "2026-09-02T12:00:00.000Z", // 48 ч тишины
      },
    });
    const kpi = computeLeadKpi([ghost], [], NOW);
    expect(kpi.ghostsTotal).toBe(1);
  });

  it("Не ghost: свежий диалог, обработанный, конвертированный или с перезвоном", () => {
    const fresh = buildLead({
      user_id: "avito:fresh",
      avito: {
        chatId: "f", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Актуально?", firstMessage: "Актуально?",
        itemPrice: 2500, messagesCount: 2, lastMessageAt: "2026-09-04T11:00:00.000Z",
      },
    });
    const handled = buildLead({
      user_id: "avito:handled",
      createdAt: "2026-09-02T06:00:00.000Z",
      avito: {
        chatId: "h", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Подумаю", firstMessage: "Привет",
        itemPrice: 2500, messagesCount: 3, lastMessageAt: "2026-09-02T12:00:00.000Z",
      },
    });
    const withCb = buildLead({
      user_id: "avito:cb",
      createdAt: "2026-09-02T06:00:00.000Z",
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Подумаю", firstMessage: "Привет",
        itemPrice: 2500, messagesCount: 3, lastMessageAt: "2026-09-02T12:00:00.000Z",
      },
    });
    const todos = [handledTodo("avito:handled"), callbackTodo("avito:cb", "2026-09-05T10:00:00.000Z")];
    const kpi = computeLeadKpi([fresh, handled, withCb], todos, NOW);
    expect(kpi.ghostsTotal).toBe(0);
  });

  it("Без переписки (нет сообщений) — не ghost даже при старом createdAt", () => {
    const empty = buildLead({
      user_id: "avito:empty",
      createdAt: "2026-08-25T06:00:00.000Z",
      avito: {
        chatId: "e", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: null, firstMessage: null,
        itemPrice: 2500, messagesCount: 0, lastMessageAt: null,
      },
    });
    const kpi = computeLeadKpi([empty], [], NOW);
    expect(kpi.ghostsTotal).toBe(0);
  });
});
