// tests/franchize/iter33-leads-round1.spec.ts
//
// Iter33 «leads build→critic loop, round 1»:
//   1. filterLeads — нормализация телефонного запроса (8/7/+7/пробелы-дефисы),
//      поиск по ключу лида и текстам авито-диалога.
//   2. todosByLead-ведро: результаты computeLeadKpi / computeLeadSpeedMetrics /
//      buildNextActions с ведром ИДЕНТИЧНЫ легаси-пути matchTodosToLead
//      (фолбэк сохранён — это контракт для клиентских вызовов).
//   3. computeAssignee с ведром = легаси.

import { describe, expect, it } from "vitest";
import {
  filterLeads,
} from "@/app/franchize/[slug]/leads/lib/leads-query-core";
import { computeLeadKpi } from "@/app/franchize/[slug]/leads/lib/lead-kpi";
import { computeLeadSpeedMetrics } from "@/app/franchize/[slug]/leads/lib/lead-speed";
import { buildNextActions } from "@/app/franchize/[slug]/leads/lib/lead-playbook";
import { computeAssignee, matchTodosToLead } from "@/app/franchize/[slug]/leads/lib/pipeline-stages";
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
  } as LeadRow;
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

/** Строит ведро «lead.user_id → туду» серверными правилами (leads.ts). */
function buildBucket(leads: LeadRow[], todos: LeadTodoRow[]): Map<string, LeadTodoRow[]> {
  const bucket = new Map<string, LeadTodoRow[]>();
  for (const t of todos) {
    for (const lead of leads) {
      if (matchTodosToLead(lead, [t]).length > 0) {
        const arr = bucket.get(lead.user_id);
        if (arr) arr.push(t);
        else bucket.set(lead.user_id, [t]);
      }
    }
  }
  return bucket;
}

// ── 1. filterLeads: телефонная нормализация и расширенное сено ──────────────

describe("iter33: filterLeads phone normalization", () => {
  const leads = [
    buildLead({ user_id: "a", full_name: "Иван Петров", phone: "+79991234567" }),
    buildLead({ user_id: "b", full_name: "Мария", phone: "+79121112222" }),
    buildLead({ user_id: "c", full_name: "Олег", phone: null }),
  ];

  it("«89991234567» находит лид с «+79991234567»", () => {
    expect(filterLeads(leads, "89991234567", "all", "all", () => []).map((l) => l.user_id)).toEqual(["a"]);
  });

  it("«+7 (999) 123-45-67» находит тот же лид", () => {
    expect(filterLeads(leads, "+7 (999) 123-45-67", "all", "all", () => []).map((l) => l.user_id)).toEqual(["a"]);
  });

  it("короткий цифровой запрос ищется как подстрока (легаси-поведение)", () => {
    // «912» входит в ОБА номера: +79991234567 (…912…) и +79121112222 (912…).
    expect(filterLeads(leads, "912", "all", "all", () => []).map((l) => l.user_id)).toEqual(["a", "b"]);
    expect(filterLeads(leads, "1122", "all", "all", () => []).map((l) => l.user_id)).toEqual(["b"]);
  });

  it("поиск смотрит в ключ лида (user_id) и тексты авито-диалога", () => {
    const avitoLead = buildLead({
      user_id: "avito:chat-777",
      phone: null,
      avito: {
        chatId: "chat-777",
        itemId: null,
        itemTitle: null,
        itemUrl: null,
        profileUrl: null,
        lastMessage: "Есть ли скидка на неделю?",
        firstMessage: "Здравствуйте",
        lastMessageAt: "2026-09-08T11:00:00.000Z",
        messagesCount: 3,
        analysis: null,
      },
    } as Partial<LeadRow>);
    expect(filterLeads([avitoLead], "chat-777", "all", "all", () => []).length).toBe(1);
    expect(filterLeads([avitoLead], "скидка", "all", "all", () => []).length).toBe(1);
    expect(filterLeads([avitoLead], "нет такого слова", "all", "all", () => []).length).toBe(0);
  });
});

// ── 2. todosByLead: паритет ведра и легаси-пути ─────────────────────────────

describe("iter33: todosByLead bucket parity", () => {
  const leads = [
    buildLead({ user_id: "+79991234567", phone: "+79991234567", full_name: "С ФИО" }),
    buildLead({
      user_id: "375111223",
      phone: null,
      full_name: "TG-клиент",
      rentals: [
        {
          rentalId: "rent-1",
          status: "active",
          startDate: "2026-09-07T10:00:00.000Z",
          endDate: "2026-09-10T10:00:00.000Z",
          totalCost: 3000,
          bikeTitle: "Honda Dio",
        } as LeadRow["rentals"][number],
      ],
    }),
  ];
  const todos = [
    buildTodo({ id: "t1", lead_id: "+79991234567", user_id: "+79991234567", title: "Перезвонить" }),
    buildTodo({ id: "t2", lead_id: null, user_id: "375111223", title: "Документы" }),
    buildTodo({
      id: "t3",
      lead_id: null,
      user_id: "999",
      rental_id: "rent-1",
      title: "Аренда активна",
    }),
    buildTodo({ id: "t4", lead_id: "nobody", user_id: "nobody", title: "Чужой" }),
  ];

  it("speed/kpi/playbook/assignee с ведром идентичны легаси-пути", () => {
    const bucket = buildBucket(leads, todos);

    const speedLegacy = computeLeadSpeedMetrics(leads, todos, NOW);
    const speedBucket = computeLeadSpeedMetrics(leads, todos, NOW, bucket);
    expect(speedBucket).toEqual(speedLegacy);

    const kpiLegacy = computeLeadKpi(leads, todos, NOW);
    const kpiBucket = computeLeadKpi(leads, todos, NOW, bucket);
    expect(kpiBucket).toEqual(kpiLegacy);

    const actionsLegacy = buildNextActions(leads, todos, NOW, 6);
    const actionsBucket = buildNextActions(leads, todos, NOW, 6, bucket);
    expect(actionsBucket).toEqual(actionsLegacy);

    for (const lead of leads) {
      expect(computeAssignee(lead, todos, bucket)).toEqual(computeAssignee(lead, todos));
    }
  });

  it("ведение раскладывает туду по лидам (rental_id сильнее, identity — иначе)", () => {
    const bucket = buildBucket(leads, todos);
    expect((bucket.get("+79991234567") || []).map((t) => t.id)).toEqual(["t1"]);
    const tgBucket = (bucket.get("375111223") || []).map((t) => t.id).sort();
    expect(tgBucket).toEqual(["t2", "t3"]);
    expect(bucket.has("nobody")).toBe(false);
  });
});
