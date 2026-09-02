/**
 * tests/franchize/lead-handling.spec.ts
 *
 * Тесты «Отработан» + «Перезвонить в ...» и виртуальной колонки «Авито»:
 *  1. getLeadHandling — разбор handling-строк из todos (категория lead_handling).
 *  2. isCallbackOverdue / callbackInMinutes / formatCallbackTime.
 *  3. Приоритет: просроченный перезвон +30, подоспевший (≤3 ч) +15 —
 *     лид подпрыгивает в очереди.
 *  4. Канбан: авито-лиды на дотрудовой стадии → колонка «Авито»;
 *     договорные стадии — обычные колонки воронки.
 *  5. Матчинг todo→lead для avito:-ключей (прежний normalizePhone ломал
 *     «avito:123» в «+avito:123»).
 */

import { describe, expect, it } from "vitest";
import {
  getLeadHandling,
  isHandlingTodo,
  isHandledTodo,
  isCallbackTodo,
  isCallbackOverdue,
  callbackInMinutes,
  formatCallbackTime,
  LEAD_HANDLING_CATEGORY,
  type LeadHandling,
} from "@/app/franchize/[slug]/leads/lib/lead-handling";
import {
  computeLeadPriority,
  CALLBACK_OVERDUE_BOOST,
  CALLBACK_SOON_BOOST,
} from "@/app/franchize/[slug]/leads/lib/lead-priority";
import { groupLeadsForBoard, getTodoLeadId } from "@/app/franchize/[slug]/leads/leads-utils";
import { AVITO_COLUMN_STAGES, BOARD_COLUMNS } from "@/app/franchize/[slug]/leads/leads-constants";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/[slug]/leads/leads-types";

// ── Builders ────────────────────────────────────────────────────────────────

const NOW = new Date("2026-09-02T12:00:00.000Z").getTime();

function buildLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    user_id: "413553377",
    full_name: "Иван Иванов",
    username: null,
    phone: "+79998887766",
    source: "web_callback",
    bikeTitle: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    lastSeenAt: "2026-09-02T11:00:00.000Z",
    verified: false,
    rentals: [],
    sales: [],
    ...overrides,
  };
}

function buildTodo(overrides: Partial<LeadTodoRow> = {}): LeadTodoRow {
  return {
    id: `todo-${Math.random().toString(36).slice(2, 8)}`,
    lead_id: "413553377",
    user_id: null,
    phone: null,
    rental_id: null,
    title: "Задача",
    description: null,
    status: "pending",
    priority: "medium",
    category: "lead_followup",
    created_at: "2026-09-02T10:00:00.000Z",
    completed_at: null,
    assigned_to: null,
    due_date: null,
    ...overrides,
  };
}

function handledTodo(overrides: Partial<LeadTodoRow> = {}): LeadTodoRow {
  return buildTodo({
    title: "✅ Лид обработан",
    category: LEAD_HANDLING_CATEGORY,
    status: "done",
    completed_at: "2026-09-02T10:30:00.000Z",
    description: JSON.stringify({ kind: "handled", lead_id: "413553377" }),
    ...overrides,
  });
}

function callbackTodo(due: string, note?: string, overrides: Partial<LeadTodoRow> = {}): LeadTodoRow {
  return buildTodo({
    title: "📞 Перезвонить",
    category: LEAD_HANDLING_CATEGORY,
    status: "pending",
    priority: "high",
    due_date: due,
    description: JSON.stringify({ kind: "callback", note: note ?? null, callback_at: due }),
    ...overrides,
  });
}

const handling = (cb: LeadHandling["callback"], h = false): LeadHandling => ({
  handled: h,
  handledAt: h ? "2026-09-02T10:30:00.000Z" : null,
  callback: cb,
});

// ── 1. getLeadHandling ──────────────────────────────────────────────────────

describe("getLeadHandling: разбор состояния", () => {
  it("обычные задачи не создают состояния", () => {
    const h = getLeadHandling([buildTodo(), buildTodo({ status: "done" })]);
    expect(h.handled).toBe(false);
    expect(h.callback).toBeNull();
  });

  it("строка «отработан» распознаётся по kind и по title", () => {
    const byKind = getLeadHandling([handledTodo()]);
    expect(byKind.handled).toBe(true);
    expect(byKind.handledAt).toBe("2026-09-02T10:30:00.000Z");

    // legacy: без description, но с правильным title + категорией
    const byTitle = getLeadHandling([
      handledTodo({ description: null, completed_at: null }),
    ]);
    expect(byTitle.handled).toBe(true);
  });

  it("активный перезвон распознаётся, заметка читается", () => {
    const due = new Date(NOW + 60 * 60 * 1000).toISOString();
    const h = getLeadHandling([callbackTodo(due, "после 18:00")]);
    expect(h.callback).not.toBeNull();
    expect(h.callback!.dueAt).toBe(due);
    expect(h.callback!.note).toBe("после 18:00");
  });

  it("завершённый (done) перезвон не показывается активным", () => {
    const due = new Date(NOW - 60 * 60 * 1000).toISOString();
    const h = getLeadHandling([callbackTodo(due, null, { status: "done", completed_at: due })]);
    expect(h.callback).toBeNull();
  });

  it("из двух активных перезвонов берётся самый поздний", () => {
    const earlier = new Date(NOW + 60 * 60 * 1000).toISOString();
    const later = new Date(NOW + 3 * 60 * 60 * 1000).toISOString();
    const h = getLeadHandling([callbackTodo(earlier), callbackTodo(later)]);
    expect(h.callback!.dueAt).toBe(later);
  });

  it("isHandlingTodo/isHandledTodo/isCallbackTodo — фильтры категорий", () => {
    const ht = handledTodo();
    const ct = callbackTodo(new Date(NOW + 3600e3).toISOString());
    const plain = buildTodo();
    expect(isHandlingTodo(ht) && isHandledTodo(ht)).toBe(true);
    expect(isHandlingTodo(ct) && isCallbackTodo(ct)).toBe(true);
    expect(isHandlingTodo(plain)).toBe(false);
    expect(isHandledTodo(ct)).toBe(false);
    expect(isCallbackTodo(ht)).toBe(false);
  });
});

// ── 2. Время перезвона ──────────────────────────────────────────────────────

describe("время перезвона: overdue / inMinutes / формат", () => {
  it("isCallbackOverdue: только прошлые даты", () => {
    expect(isCallbackOverdue({ dueAt: new Date(NOW - 1).toISOString(), note: null, todoId: "t" }, NOW)).toBe(true);
    expect(isCallbackOverdue({ dueAt: new Date(NOW + 1).toISOString(), note: null, todoId: "t" }, NOW)).toBe(false);
    expect(isCallbackOverdue(null, NOW)).toBe(false);
  });

  it("callbackInMinutes: минут до звонка, null без перезвона", () => {
    expect(callbackInMinutes({ dueAt: new Date(NOW + 25 * 60 * 1000).toISOString(), note: null, todoId: "t" }, NOW)).toBe(25);
    expect(callbackInMinutes({ dueAt: new Date(NOW - 25 * 60 * 1000).toISOString(), note: null, todoId: "t" }, NOW)).toBe(-25);
    expect(callbackInMinutes(null, NOW)).toBeNull();
  });

  it("formatCallbackTime: сегодня — только время", () => {
    const today = new Date(2026, 8, 2, 15, 30);
    expect(formatCallbackTime(today.toISOString())).toBe("15:30");
  });
});

// ── 3. Приоритет: перезвон поднимает лид ────────────────────────────────────

describe("Priority Score + перезвон", () => {
  const lead = buildLead({ urgencyScore: 30 });

  it("без перезвона буста нет, callbackDue = null", () => {
    const p = computeLeadPriority(lead, 0, NOW);
    expect(p.callbackDue).toBeNull();
    const withNothing = computeLeadPriority(lead, 0, NOW, handling(null));
    expect(withNothing.score).toBe(p.score);
  });

  it("просроченный перезвон: +30 и callbackDue проставлен", () => {
    const base = computeLeadPriority(lead, 0, NOW).score;
    const overdue = new Date(NOW - 30 * 60 * 1000).toISOString();
    const p = computeLeadPriority(lead, 0, NOW, handling({ dueAt: overdue, note: null, todoId: "t" }));
    expect(p.score).toBe(Math.min(100, base + CALLBACK_OVERDUE_BOOST));
    expect(p.callbackDue).toBe(overdue);
  });

  it("подоспевший (≤3 ч) перезвон: +15", () => {
    const base = computeLeadPriority(lead, 0, NOW).score;
    const soon = new Date(NOW + 60 * 60 * 1000).toISOString();
    const p = computeLeadPriority(lead, 0, NOW, handling({ dueAt: soon, note: null, todoId: "t" }));
    expect(p.score).toBe(Math.min(100, base + CALLBACK_SOON_BOOST));
  });

  it("далёкий перезвон (завтра) не даёт буста", () => {
    const base = computeLeadPriority(lead, 0, NOW).score;
    const far = new Date(NOW + 26 * 60 * 60 * 1000).toISOString();
    const p = computeLeadPriority(lead, 0, NOW, handling({ dueAt: far, note: null, todoId: "t" }));
    expect(p.score).toBe(base);
  });

  it("score остаётся в 0–100 при любом бусте", () => {
    const hot = buildLead({ urgencyScore: 100, totalSpent: 500_000, stageKey: "return_due", contactChannel: "avito", avito: { chatId: "1", itemUrl: null, profileUrl: null, itemId: null, lastMessage: null } });
    const overdue = new Date(NOW - 60 * 60 * 1000).toISOString();
    const p = computeLeadPriority(hot, 10, NOW, handling({ dueAt: overdue, note: null, todoId: "t" }));
    expect(p.score).toBeLessThanOrEqual(100);
    expect(p.score).toBeGreaterThanOrEqual(0);
  });
});

// ── 4. Канбан: виртуальная колонка «Авито» ──────────────────────────────────

describe("board: колонка «Авито»", () => {
  const avitoLead = (stageKey: string) =>
    buildLead({
      user_id: `avito:12345`,
      stageKey,
      contactChannel: "avito",
      avito: { chatId: "12345", itemUrl: null, profileUrl: null, itemId: null, lastMessage: null },
      phone: null,
    });

  it("BOARD_COLUMNS содержит «Авито» первой колонкой", () => {
    expect(BOARD_COLUMNS[0].key).toBe("avito");
    expect(BOARD_COLUMNS.map((c) => c.key)).toContain("needs_contact");
  });

  it("авито-лид на дотрудовой стадии попадает в колонку «Авито»", () => {
    const grouped = groupLeadsForBoard([avitoLead("new"), avitoLead("needs_contact")]);
    expect(grouped.avito).toHaveLength(2);
    expect(grouped.new).toHaveLength(0);
  });

  it("авито-лид с договорной стадией живёт в обычной колонке воронки", () => {
    const grouped = groupLeadsForBoard([avitoLead("contract_sent"), avitoLead("active_rental")]);
    expect(grouped.avito).toHaveLength(0);
    expect(grouped.contract_sent).toHaveLength(1);
    expect(grouped.active_rental).toHaveLength(1);
  });

  it("обычные лиды в «Авито» не попадают", () => {
    const grouped = groupLeadsForBoard([buildLead({ stageKey: "new" })]);
    expect(grouped.avito).toHaveLength(0);
    expect(grouped.new).toHaveLength(1);
  });

  it("AVITO_COLUMN_STAGES — только дотрудовые стадии", () => {
    expect([...AVITO_COLUMN_STAGES].sort()).toEqual(["needs_contact", "new"]);
  });
});

// ── 5. Матчинг todo→lead для avito:-ключей ─────────────────────────────────

describe("todo→lead матчинг: avito:-ключи", () => {
  it("getTodoLeadId возвращает avito: как есть (не «+avito:»)", () => {
    expect(getTodoLeadId(buildTodo({ lead_id: "avito:12345" }))).toBe("avito:12345");
  });

  it("телефонные lead_id по-прежнему нормализуются", () => {
    // отформатированный телефон → E.164 (чистые 11 цифр — это TG-id, как раньше)
    expect(getTodoLeadId(buildTodo({ lead_id: "8 (999) 888-77-66" }))).toBe("+79998887766");
    expect(getTodoLeadId(buildTodo({ lead_id: "8-999-888-77-66" }))).toBe("+79998887766");
  });

  it("описание с avito: ключом тоже читается", () => {
    const t = buildTodo({
      lead_id: null,
      description: JSON.stringify({ kind: "callback", lead_id: "avito:777" }),
    });
    expect(getTodoLeadId(t)).toBe("avito:777");
  });
});
