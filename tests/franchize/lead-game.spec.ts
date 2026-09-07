/**
 * tests/franchize/lead-game.spec.ts
 *
 * Волна Lead Game («обслуживание лидов — соревнование»). Тесты ЧИСТОЙ
 * логики трёх новых модулей:
 *  1. lead-client-facts — накопительные факты клиента («подготовка за
 *     5 минут»): санитайзер, мердж между сообщениями, лог чата с капой.
 *  2. lead-events — прозрачный лидерборд: очки считаются по журналу,
 *     служебный actor "avito-agent" очков не получает, разбивка по типам.
 *  3. lead-history — мердж записанных фактов (lead_events) с производной
 *     клиентской хронологией: записанное первично, дубли не плодятся.
 */

import { describe, expect, it } from "vitest";

import {
  appendMessageLog,
  mergeClientFacts,
  sanitizeClientFacts,
} from "@/app/franchize/lib/lead-client-facts";
import {
  computeLeadLeaderboard,
  LEAD_EVENT_POINTS,
} from "@/app/franchize/lib/lead-event-core";
import { computeLeadHistory } from "@/app/franchize/[slug]/leads/lib/lead-history";
import type { LeadRow, LeadTodoRow, LeadEventRow } from "@/app/franchize/[slug]/leads/leads-types";

// ── 1. Клиентские факты ──────────────────────────────────────────────────────

describe("lead-client-facts · sanitizeClientFacts", () => {
  it("принимает известные ключи и обрезает длину", () => {
    const out = sanitizeClientFacts({
      name: "  Дмитрий  ",
      budget: "x".repeat(300),
      junk: undefined,
      n: 42,
    });
    expect(out).not.toBeNull();
    expect(out!.name).toBe("Дмитрий");
    expect(out!.budget!.length).toBeLessThanOrEqual(160);
    expect(Object.keys(out!)).not.toContain("junk");
    expect(Object.keys(out!)).not.toContain("n");
  });

  it("мусор (не объект / массив / пусто) → null", () => {
    expect(sanitizeClientFacts(null)).toBeNull();
    expect(sanitizeClientFacts("имя")).toBeNull();
    expect(sanitizeClientFacts([1, 2])).toBeNull();
    expect(sanitizeClientFacts({ name: "   " })).toBeNull();
  });

  it("кастомные ключи — только [a-z0-9_], максимум 6", () => {
    const custom = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [`custom_key_${i}`, `значение ${i}`]),
    );
    const out = sanitizeClientFacts({ ...custom, "плохой ключ!": "x" });
    expect(out).not.toBeNull();
    const customKeys = Object.keys(out!).filter((k) => k.startsWith("custom_key_"));
    expect(customKeys.length).toBe(6);
    expect(out!["плохой ключ!"]).toBeUndefined();
  });
});

describe("lead-client-facts · mergeClientFacts (накопление)", () => {
  it("первое значение живёт, явное обновление перезаписывает", () => {
    const first = mergeClientFacts(null, { name: "Дмитрий", budget: "до 8000" } as never);
    expect(first).toMatchObject({ name: "Дмитрий", budget: "до 8000" });

    const second = mergeClientFacts(first, { budget: "до 12000", city: "Сочи" } as never);
    expect(second).toMatchObject({
      name: "Дмитрий", // не перезаписан — обновления не было
      budget: "до 12000", // явное обновление
      city: "Сочи", // добралось
    });
  });

  it("next=null не теряет накопленное (sanitize prev)", () => {
    const prev = { name: "Дмитрий" };
    expect(mergeClientFacts(prev, null)).toMatchObject({ name: "Дмитрий" });
    expect(mergeClientFacts(null, null)).toBeNull();
    expect(mergeClientFacts("мусор", null)).toBeNull();
  });

  it("пустые значения не создают ключей", () => {
    const out = mergeClientFacts({ name: "Дмитрий" }, { city: "" } as never);
    expect(out).toMatchObject({ name: "Дмитрий" });
    expect(Object.keys(out!)).not.toContain("city");
  });
});

describe("lead-client-facts · appendMessageLog", () => {
  it("копит реплики и обрезает хвост до 12", () => {
    let log: unknown = null;
    for (let i = 0; i < 15; i++) {
      log = appendMessageLog(log, { at: `2026-09-08T10:${String(i).padStart(2, "0")}`, from: "buyer", text: `msg ${i}` });
    }
    const list = log as Array<{ text: string }>;
    expect(list.length).toBe(12);
    expect(list[0].text).toBe("msg 3");
    expect(list[11].text).toBe("msg 14");
  });

  it("не-массив prev → начинает заново", () => {
    const out = appendMessageLog("мусор", { at: "2026-09-08T10:00", from: "seller", text: "ответ" });
    expect(out.length).toBe(1);
    expect(out[0].from).toBe("seller");
  });
});

// ── 2. Прозрачный лидерборд ─────────────────────────────────────────────────

function ev(partial: Partial<LeadEventRow> & { actor: string; type: string }): LeadEventRow {
  return {
    id: `${partial.actor}-${partial.type}-${Math.random()}`,
    createdAt: "2026-09-08T10:00:00.000Z",
    leadId: "avito:chat-1",
    actor: partial.actor,
    actorName: null,
    label: "событие",
    detail: null,
    points: partial.points ?? 0,
    ...partial,
  };
}

describe("lead-events · computeLeadLeaderboard", () => {
  it("агрегирует очки и разбивку по типам", () => {
    const rows = [
      ev({ actor: "100", type: "lead_handled", points: 3 }),
      ev({ actor: "100", type: "callback_completed", points: 5 }),
      ev({ actor: "100", type: "lead_handled", points: 3 }),
      ev({ actor: "200", type: "closed_won", points: 10 }),
      ev({ actor: "200", type: "note_added", points: 1 }),
    ];
    const board = computeLeadLeaderboard(rows, new Map([["100", "Аня"], ["200", "Борис"]]));
    // Паритет очков → алфавит: Аня первая. Разбивки считаются по типам.
    expect(board[0]).toMatchObject({ id: "100", name: "Аня", points: 11, handled: 2, callbacks: 1 });
    expect(board[1]).toMatchObject({ id: "200", name: "Борис", points: 11, closed: 1, notes: 1 });
    // 10 + 1 == 3 + 5 + 3 — «не только закрытия» держат паритет
    expect(board[0].points).toBe(board[1].points);
  });

  it("служебный actor avito-agent и нечисловые — не попадают", () => {
    const rows = [
      ev({ actor: "avito-agent", type: "lead_created", points: 0 }),
      ev({ actor: "password-auth", type: "note_added", points: 1 }),
      ev({ actor: "413553377", type: "lead_handled", points: 3 }),
    ];
    const board = computeLeadLeaderboard(rows, new Map());
    expect(board.length).toBe(1);
    expect(board[0].id).toBe("413553377");
  });

  it("имя-фолбэк берётся из actor_name событий, если ростера нет", () => {
    const rows = [
      { ...ev({ actor: "100", type: "note_added", points: 1 }), actorName: "Аня с события" },
    ];
    const board = computeLeadLeaderboard(rows, new Map());
    expect(board[0].name).toBe("Аня с события");
  });

  it("lastActionAt — максимум по createdAt", () => {
    const rows = [
      ev({ actor: "100", type: "note_added", points: 1, createdAt: "2026-09-08T08:00:00.000Z" }),
      ev({ actor: "100", type: "lead_handled", points: 3, createdAt: "2026-09-08T12:00:00.000Z" }),
    ];
    expect(computeLeadLeaderboard(rows, new Map())[0].lastActionAt).toBe("2026-09-08T12:00:00.000Z");
  });

  it("веса согласованы: закрытие дороже реакции, реакция дороже нуля", () => {
    expect(LEAD_EVENT_POINTS.closed_won).toBeGreaterThan(LEAD_EVENT_POINTS.lead_handled);
    expect(LEAD_EVENT_POINTS.lead_handled).toBeGreaterThan(0);
    expect(LEAD_EVENT_POINTS.callback_completed).toBeGreaterThanOrEqual(LEAD_EVENT_POINTS.callback_set);
  });
});

// ── 3. История: записанные факты + производные, без дублей ──────────────────

function leadFixture(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    user_id: "avito:chat-1",
    full_name: "Покупатель Avito",
    phone: null,
    bikeTitle: null,
    source: "avito",
    contactChannel: "avito",
    sourceRoute: "avito_webhook",
    intentStage: "lead_captured",
    stageKey: "new",
    qrStatus: "unclaimed",
    urgencyScore: 50,
    createdAt: "2026-09-08T09:00:00.000Z",
    lastSeenAt: "2026-09-08T09:30:00.000Z",
    rentals: [],
    sales: [],
    ...overrides,
  } as unknown as LeadRow;
}

describe("lead-history · computeLeadHistory (мердж журнала)", () => {
  const todos: LeadTodoRow[] = [];

  it("записанные факты попадают в таймлайн с recorded=true", () => {
    const recorded: LeadEventRow[] = [
      {
        id: "1",
        createdAt: "2026-09-08T09:00:05.000Z",
        leadId: "avito:chat-1",
        type: "lead_created",
        actor: "avito-agent",
        actorName: null,
        label: "Лид захвачен из Авито",
        detail: "Falcon GT",
        points: 0,
      },
      {
        id: "2",
        createdAt: "2026-09-08T10:00:00.000Z",
        leadId: "avito:chat-1",
        type: "lead_handled",
        actor: "413553377",
        actorName: "Паша",
        label: "Отработан — взят в работу",
        detail: null,
        points: 3,
      },
    ];
    const history = computeLeadHistory(leadFixture(), todos, [], recorded);
    const handled = history.find((e) => e.type === "lead_handled");
    expect(handled).toBeDefined();
    expect(handled!.recorded).toBe(true);
    expect(handled!.actorName).toBe("Паша");
    // производный «Лид создан» и записанный захват в одном окне → дубль выкинут
    const created = history.filter((e) => e.type === "lead_created");
    expect(created.length).toBe(1);
    expect(created[0].recorded).toBe(true);
  });

  it("производные события вне окон журнала остаются (не теряем историю)", () => {
    const recorded: LeadEventRow[] = [
      {
        id: "1",
        createdAt: "2026-09-08T07:00:00.000Z",
        leadId: "avito:chat-1",
        type: "note_added",
        actor: "413553377",
        actorName: null,
        label: "Заметка: утром звонил",
        detail: null,
        points: 1,
      },
    ];
    const notes = [{ text: "вечером ещё раз", created_at: "2026-09-08T18:00:00.000Z", created_by: "Паша" }];
    const history = computeLeadHistory(leadFixture(), todos, notes, recorded);
    const noteEvents = history.filter((e) => e.type === "note_added");
    expect(noteEvents.length).toBe(2);
    // сортировка — свежие сверху
    expect(history[0].timestamp >= history[history.length - 1].timestamp).toBe(true);
  });

  it("без журнала работает как раньше (производные события)", () => {
    const history = computeLeadHistory(leadFixture({ createdAt: "2026-09-08T09:00:00.000Z" }), todos, [], []);
    expect(history.some((e) => e.type === "lead_created")).toBe(true);
  });
});
