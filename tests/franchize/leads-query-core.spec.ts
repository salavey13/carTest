// tests/franchize/leads-query-core.spec.ts
//
// Спеки изоморфного ядра запросов лидов (wave «load best leads first»):
// ТЕ ЖЕ правила фильтрации/сортировки применяет сервер при оконной выдаче,
// поэтому контракты filterLeads/sortLeads/matchers/агрегатов — критичные.

import { describe, expect, it } from "vitest";
import {
  filterLeads,
  sortLeads,
  categorizeLeads,
  getAvailableSources,
  matchStageFilter,
  matchOwnerFilter,
  matchNotesFilter,
  placeholderHasActivity,
  computeLeadsKpiCardsStats,
} from "@/app/franchize/[slug]/leads/lib/leads-query-core";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/[slug]/leads/leads-types";

const NOW = new Date("2026-09-08T12:00:00.000Z").getTime();

function buildLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    user_id: "lead-1",
    full_name: "Иван Иванов",
    username: null,
    phone: "+79998887766",
    source: "web_callback",
    bikeTitle: null,
    createdAt: "2026-09-08T10:00:00.000Z",
    lastSeenAt: "2026-09-08T11:55:00.000Z",
    verified: false,
    rentals: [],
    sales: [],
    ...overrides,
  };
}

function buildTodo(overrides: Partial<LeadTodoRow> = {}): LeadTodoRow {
  return {
    id: "todo-1",
    lead_id: "lead-1",
    user_id: "lead-1",
    phone: null,
    rental_id: null,
    title: "Перезвонить",
    description: null,
    status: "pending",
    priority: "normal",
    category: "lead_followup",
    created_at: "2026-09-08T10:00:00.000Z",
    completed_at: null,
    assigned_to: null,
    due_date: null,
    ...overrides,
  } as LeadTodoRow;
}

const noTodos = () => [] as LeadTodoRow[];

// ── filterLeads ─────────────────────────────────────────────────────────────

describe("filterLeads: поиск и источники", () => {
  const leads = [
    buildLead({ user_id: "a", full_name: "Иван Петров", phone: "+70000000001", source: "rental_contract" }),
    buildLead({ user_id: "b", full_name: "Мария", phone: "+79121112222", source: "rent" }),
    buildLead({ user_id: "c", full_name: "Олег", source: "test_drive" }),
  ];

  it("ищет по подстроке имени и телефона (без регистра)", () => {
    expect(filterLeads(leads, "петров", "all", "all", noTodos).map((l) => l.user_id)).toEqual(["a"]);
    expect(filterLeads(leads, "912", "all", "all", noTodos).map((l) => l.user_id)).toEqual(["b"]);
  });

  it("каноническая группа «rent» покрывает rental_contract И rent", () => {
    expect(filterLeads(leads, "", "rent", "all", noTodos).map((l) => l.user_id)).toEqual(["a", "b"]);
  });

  it("виртуальный источник «avito» выбирает по каналу (isAvitoLead)", () => {
    const avitoLead = buildLead({
      user_id: "avito:123",
      source: "callback_request",
      sourceRoute: "avito",
    });
    const res = filterLeads([avitoLead, ...leads], "", "avito", "all", noTodos);
    expect(res.map((l) => l.user_id)).toEqual(["avito:123"]);
  });
});

describe("filterLeads: сегменты и заглушки", () => {
  const hot = buildLead({ user_id: "hot", urgencyScore: 80 });
  const verified = buildLead({ user_id: "ver", verified: true });
  const warm = buildLead({ user_id: "warm", urgencyScore: 10 });
  const troubled = buildLead({ user_id: "tr", troubled: true, urgencyScore: 10 });
  const leads = [hot, verified, warm, troubled];

  it("hot = не verified и (urgency ≥ 60 или есть задачи или платил); troubled сам по себе не hot", () => {
    expect(filterLeads(leads, "", "all", "hot", noTodos).map((l) => l.user_id)).toEqual(["hot"]);
  });

  it("задача делает тёплый лид горячим", () => {
    const withTodo = buildLead({ user_id: "warm-todo", urgencyScore: 0 });
    const todos = [buildTodo({ lead_id: "warm-todo", user_id: "warm-todo" })];
    const getTodos = (l: LeadRow) => (l.user_id === "warm-todo" ? todos : []);
    expect(filterLeads([withTodo], "", "all", "hot", getTodos)).toHaveLength(1);
  });

  it("troubled-сегмент — только troubled", () => {
    expect(filterLeads(leads, "", "all", "troubled", noTodos).map((l) => l.user_id)).toEqual(["tr"]);
  });

  it("hidePlaceholders прячет операторскую заглушку без активности", () => {
    const placeholder = buildLead({ user_id: "op", identityState: "operator_placeholder" });
    const active = placeholderHasActivity(placeholder, []);
    expect(active).toBe(false);
    const visible = filterLeads([placeholder, hot], "", "all", "all", noTodos, true);
    expect(visible.map((l) => l.user_id)).toEqual(["hot"]);
    // Но заглушка с арендой остаётся видимой
    const richPlaceholder = buildLead({
      user_id: "op2",
      identityState: "operator_placeholder",
      rentals: [{ rentalId: "r1", status: "active", paymentStatus: "paid", startDate: null, endDate: null, bikeTitle: null, totalCost: 0 }],
    });
    expect(filterLeads([richPlaceholder], "", "all", "all", noTodos, true)).toHaveLength(1);
  });
});

// ── matchStageFilter / matchOwnerFilter ─────────────────────────────────────

describe("matchStageFilter", () => {
  it("«all» матчит всё; stageKey — по ВЫЧИСЛЕННОЙ стадии", () => {
    const lead = buildLead({ stageKey: "active_rental" });
    expect(matchStageFilter(lead, "all")).toBe(true);
    expect(matchStageFilter(lead, "active_rental")).toBe(true);
    expect(matchStageFilter(lead, "new")).toBe(false);
  });

  it("без stageKey — «new» по умолчанию", () => {
    expect(matchStageFilter(buildLead(), "new")).toBe(true);
  });
});

describe("matchOwnerFilter", () => {
  const lead = buildLead({
    assigneeId: "op-1",
    ownerId: "op-2",
    originalOperatorChatId: "op-3",
    lastTouchedBy: "Ольга",
  });

  it("матчит по assignee / owner / originalOperatorChatId", () => {
    expect(matchOwnerFilter(lead, "op-1", null)).toBe(true);
    expect(matchOwnerFilter(lead, "op-2", null)).toBe(true);
    expect(matchOwnerFilter(lead, "op-3", null)).toBe(true);
  });

  it("матчит по имени последнего оператора и легаси-имени", () => {
    expect(matchOwnerFilter(lead, "op-9", "Ольга")).toBe(true);
    const legacy = buildLead({ ownerName: "Старый Босс" });
    expect(matchOwnerFilter(legacy, "Старый Босс", null)).toBe(true);
  });

  it("не матчит чужого оператора", () => {
    expect(matchOwnerFilter(lead, "op-42", null)).toBe(false);
  });
});

describe("matchNotesFilter", () => {
  it("«all» матчит всё (фильтр выключен)", () => {
    expect(matchNotesFilter(buildLead(), "all")).toBe(true);
    expect(matchNotesFilter(buildLead({ notesCount: 3 }), "all")).toBe(true);
  });

  it("«human» — только лиды с человеческими заметками", () => {
    expect(matchNotesFilter(buildLead({ humanNotesCount: 1 }), "human")).toBe(true);
    expect(matchNotesFilter(buildLead({ humanNotesCount: 4 }), "human")).toBe(true);
  });

  it("«human» скрывает лиды без заметок и лидов только с авто-квизом", () => {
    // заметок нет вовсе
    expect(matchNotesFilter(buildLead(), "human")).toBe(false);
    // notesCount > 0, но все заметки служебные (квиз «подбор с сайта»)
    expect(matchNotesFilter(buildLead({ notesCount: 1, humanNotesCount: 0 }), "human")).toBe(false);
    // поле не приехало (легаси-ответ сервера) — не рисуем «есть заметки»
    expect(matchNotesFilter(buildLead({ notesCount: 2 }), "human")).toBe(false);
  });
});

// ── sortLeads: «лучшие сверху» ──────────────────────────────────────────────

describe("sortLeads", () => {
  it("priority: свежий горячий выше старого холодного (детерминированно)", () => {
    const freshHot = buildLead({
      user_id: "fresh-hot",
      lastSeenAt: new Date(NOW - 5 * 60 * 1000).toISOString(),
      urgencyScore: 90,
      source: "callback_request",
      sourceRoute: "avito",
    });
    const staleCold = buildLead({
      user_id: "stale-cold",
      lastSeenAt: "2026-06-01T00:00:00.000Z",
      urgencyScore: 0,
      source: "app_open",
    });
    const sorted = sortLeads([staleCold, freshHot], "priority", noTodos, undefined, NOW);
    expect(sorted.map((l) => l.user_id)).toEqual(["fresh-hot", "stale-cold"]);
    // Детерминизм: повторный вызов даёт тот же порядок
    const again = sortLeads([freshHot, staleCold], "priority", noTodos, undefined, NOW);
    expect(again.map((l) => l.user_id)).toEqual(sorted.map((l) => l.user_id));
  });

  it("recent: по lastSeenAt/createdAt, свежие сверху", () => {
    const a = buildLead({ user_id: "a", lastSeenAt: "2026-09-08T09:00:00.000Z" });
    const b = buildLead({ user_id: "b", lastSeenAt: "2026-09-08T11:00:00.000Z" });
    expect(sortLeads([a, b], "recent", noTodos).map((l) => l.user_id)).toEqual(["b", "a"]);
  });

  it("spent: по суммарной выручке убыванию", () => {
    const small = buildLead({ user_id: "s", totalSpent: 1000 });
    const big = buildLead({ user_id: "b", totalSpent: 50_000 });
    expect(sortLeads([small, big], "spent", noTodos).map((l) => l.user_id)).toEqual(["b", "s"]);
  });

  it("Конкатенация окон сохраняет глобальный порядок (контракт сервера)", () => {
    const leads = [
      buildLead({ user_id: "l1", lastSeenAt: "2026-09-08T11:00:00.000Z" }),
      buildLead({ user_id: "l2", lastSeenAt: "2026-09-08T10:30:00.000Z" }),
      buildLead({ user_id: "l3", lastSeenAt: "2026-09-08T10:00:00.000Z" }),
      buildLead({ user_id: "l4", lastSeenAt: "2026-09-08T09:30:00.000Z" }),
    ];
    const full = sortLeads(leads, "recent", noTodos);
    const windowConcat = [
      ...sortLeads(leads, "recent", noTodos).slice(0, 2),
      ...sortLeads(leads, "recent", noTodos).slice(2, 4),
    ];
    expect(windowConcat.map((l) => l.user_id)).toEqual(full.map((l) => l.user_id));
  });
});

// ── categorizeLeads / getAvailableSources ───────────────────────────────────

describe("categorizeLeads и getAvailableSources", () => {
  it("раскладывает по корзинам verified/hot/warm", () => {
    const hot = buildLead({ user_id: "h", urgencyScore: 70 });
    const ver = buildLead({ user_id: "v", verified: true });
    const warm = buildLead({ user_id: "w", urgencyScore: 5 });
    const cats = categorizeLeads([hot, ver, warm], noTodos);
    expect(cats.verified.map((l) => l.user_id)).toEqual(["v"]);
    expect(cats.hot.map((l) => l.user_id)).toEqual(["h"]);
    expect(cats.warm.map((l) => l.user_id)).toEqual(["w"]);
  });

  it("sources уникальны", () => {
    const leads = [buildLead({ source: "rent" }), buildLead({ source: "rent" }), buildLead({ source: "sale" })];
    expect(getAvailableSources(leads).sort()).toEqual(["rent", "sale"]);
  });
});

// ── computeLeadsKpiCardsStats (агрегат плиток по ПОЛНОМУ набору) ────────────

describe("computeLeadsKpiCardsStats", () => {
  it("считает totals и 7-дневные тренды по окнам", () => {
    const now = new Date("2026-09-08T12:00:00.000Z");
    const inCur = new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString();
    const inPrev = new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString();
    const leads = [
      buildLead({ user_id: "c1", createdAt: inCur, verified: true, totalSpent: 5000 }),
      buildLead({ user_id: "p1", createdAt: inPrev, totalSpent: 1000 }),
    ];
    const todos = [buildTodo({ status: "pending" }), buildTodo({ id: "t2", status: "done" })];
    const stats = computeLeadsKpiCardsStats(leads, todos, now.getTime());

    expect(stats.totalLeads).toBe(2);
    expect(stats.verified).toBe(1);
    expect(stats.revenue).toBe(6000);
    expect(stats.pendingTodos).toBe(1);
    expect(stats.trends.leadsCur).toBe(1);
    expect(stats.trends.leadsPrev).toBe(1);
  });

  it("«Активность сегодня» — по createdAt/lastSeenAt локального дня", () => {
    const now = new Date(2026, 8, 8, 12, 0, 0); // локальный день
    const todayLead = buildLead({ createdAt: new Date(2026, 8, 8, 9, 0).toISOString() });
    const oldLead = buildLead({ user_id: "old", createdAt: "2026-09-01T09:00:00.000Z", lastSeenAt: null });
    const stats = computeLeadsKpiCardsStats([todayLead, oldLead], [], now.getTime());
    expect(stats.todayActive).toBe(1);
  });
});
