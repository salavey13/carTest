// tests/franchize/lead-win-patterns.spec.ts
//
// Спеки «общих факторов побед» (wave «Hormozi Blueprint», шаг 9 — common
// factors analysis): сравнение closed_won vs closed_lost по честным
// факторам, n-гварды против примет на малых выборках, гигиена расчёта.

import { describe, expect, it } from "vitest";
import {
  computeWinPatterns,
  type WinPattern,
} from "@/app/franchize/[slug]/leads/lib/lead-win-patterns";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/[slug]/leads/leads-types";

let seq = 0;

const handledTodo = (userId: string, handledAt: string): LeadTodoRow => ({
  id: `t-${++seq}`,
  lead_id: null,
  user_id: userId,
  phone: null,
  rental_id: null,
  title: "✅ Лид обработан",
  description: JSON.stringify({ kind: "handled" }),
  status: "done",
  priority: "normal",
  category: "lead_handling",
  created_at: handledAt,
  completed_at: handledAt,
  assigned_to: null,
  due_date: null,
});

const lead = (
  stage: "closed_won" | "closed_lost",
  over: Partial<LeadRow> = {},
): LeadRow => ({
  user_id: String(300000 + ++seq), // числовой TG-подобный id — matchTodosToLead матчит только числовые
  full_name: `Лид ${seq}`,
  username: null,
  phone: null,
  source: "avito",
  bikeTitle: "Falcon GT",
  createdAt: "2026-09-01T10:00:00Z", // понедельник
  lastSeenAt: null,
  verified: false,
  rentals: [],
  sales: [],
  stageKey: stage,
  ...over,
});

const run = (leads: LeadRow[], todos: LeadTodoRow[] = []): WinPattern[] =>
  computeWinPatterns(leads, todos);

/** 6 побед + 6 потерь без прочих особенностей — минимально валидная база. */
const baseSet = (): LeadRow[] => [
  ...Array.from({ length: 6 }, () => lead("closed_won")),
  ...Array.from({ length: 6 }, () => lead("closed_lost")),
];

describe("computeWinPatterns — n-гварды (честность вместо примет)", () => {
  it("пустые входы → без паттернов", () => {
    expect(run([], [])).toEqual([]);
  });

  it("меньше 6 побед или 6 потерь → пусто (панель молчит)", () => {
    expect(run([...Array.from({ length: 5 }, () => lead("closed_won")), ...Array.from({ length: 6 }, () => lead("closed_lost"))])).toEqual([]);
    expect(run([...Array.from({ length: 6 }, () => lead("closed_won")), ...Array.from({ length: 2 }, () => lead("closed_lost"))])).toEqual([]);
  });

  it("операторские заглушки не участвуют в группах", () => {
    const leads = [
      ...baseSet(),
      ...Array.from({ length: 5 }, () =>
        lead("closed_won", { identityState: "operator_placeholder" as const }),
      ),
    ];
    // 6 реальных побед + 6 потерь → база живая, заглушки не добавили ничего
    const patterns = run(leads);
    const avito = patterns.find((p) => p.key === "avito");
    expect(avito?.wonN).toBe(6);
    expect(avito?.lostN).toBe(6);
  });
});

describe("computeWinPatterns — факторы", () => {
  it("база без особенностей: все факторы 0 против 0 (доли честные)", () => {
    const patterns = run(baseSet());
    // weekend: все лиды в понедельник → 0% у обеих групп, но ячейки полные
    const weekend = patterns.find((p) => p.key === "weekend");
    expect(weekend).toBeDefined();
    expect(weekend!.wonShare).toBe(0);
    expect(weekend!.lostShare).toBe(0);
    expect(weekend!.wonN).toBe(6);
    // fast-response: отметок обработки нет → фактора нет (делитель нулевой)
    const fast = patterns.find((p) => p.key === "fast-response");
    expect(fast).toBeUndefined();
  });

  it("быстрый ответ: у побед чаще ≤ 5 мин, чем у потерь", () => {
    const won = Array.from({ length: 6 }, (_, i) => {
      const l = lead("closed_won", { createdAt: "2026-09-01T10:00:00Z" });
      return l;
    });
    const lost = Array.from({ length: 6 }, () =>
      lead("closed_lost", { createdAt: "2026-09-01T10:00:00Z" }),
    );
    // 4 из 6 побед отвечены за 3 мин; 3 потерь с отметками — только 1 уложилась
    const todos: LeadTodoRow[] = [
      ...won.slice(0, 4).map((l) => handledTodo(l.user_id, "2026-09-01T10:03:00Z")),
      ...lost.slice(0, 1).map((l) => handledTodo(l.user_id, "2026-09-01T10:04:00Z")),
      ...lost.slice(1, 3).map((l) => handledTodo(l.user_id, "2026-09-01T11:00:00Z")),
    ];
    const fast = run(won.concat(lost), todos).find((p) => p.key === "fast-response")!;
    expect(fast).toBeDefined();
    expect(fast.wonN).toBe(4); // только с отметками времени
    expect(fast.lostN).toBe(3);
    expect(fast.wonShare).toBe(1); // 4/4 уложились
    expect(fast.lostShare).toBeCloseTo(1 / 3, 5); // 1 из 3
  });

  it("ячейка фактора < 3 → фактор не показывается (примета не рендерится)", () => {
    const won = baseSet().slice(0, 6);
    const lost = baseSet().slice(6);
    // Только 2 победы с отметкой скорости — ячейка меньше MIN_CELL_N
    const todos = won
      .slice(0, 2)
      .map((l) => handledTodo(l.user_id, "2026-09-01T10:03:00Z"));
    const fast = run(won.concat(lost), todos).find((p) => p.key === "fast-response");
    expect(fast).toBeUndefined();
  });

  it("выходные обращения: сб/вс считаются по createdAt", () => {
    // 3 победы в субботу (2026-09-05), 0 потерь в выходные
    const won = baseSet().slice(0, 6);
    const lost = baseSet().slice(6);
    won[0] = { ...won[0], createdAt: "2026-09-05T12:00:00Z" };
    won[1] = { ...won[1], createdAt: "2026-09-06T12:00:00Z" };
    won[2] = { ...won[2], createdAt: "2026-09-06T15:00:00Z" };
    const weekend = run(won.concat(lost)).find((p) => p.key === "weekend")!;
    expect(weekend.wonShare).toBeCloseTo(3 / 6, 5);
    expect(weekend.lostShare).toBe(0);
  });

  it("глубокий диалог: avito.messagesCount ≥ 3 считается; не-авито не ломает", () => {
    const won = baseSet().slice(0, 6);
    const lost = baseSet().slice(6);
    won[0] = {
      ...won[0],
      avito: {
        chatId: "c",
        itemUrl: null,
        profileUrl: null,
        itemId: null,
        lastMessage: null,
        messagesCount: 5,
      },
    };
    lost[0] = {
      ...lost[0],
      avito: {
        chatId: "c",
        itemUrl: null,
        profileUrl: null,
        itemId: null,
        lastMessage: null,
        messagesCount: 1,
      },
    };
    const deep = run(won.concat(lost)).find((p) => p.key === "deep-dialog")!;
    expect(deep.wonShare).toBeCloseTo(1 / 6, 5);
    expect(deep.lostShare).toBe(0);
  });

  it("структура паттерна полная: label/hint/shares/n заполнены", () => {
    for (const p of run(baseSet())) {
      expect(p.label.length).toBeGreaterThan(2);
      expect(p.hint.length).toBeGreaterThan(10);
      expect(p.wonShare).toBeGreaterThanOrEqual(0);
      expect(p.wonShare).toBeLessThanOrEqual(1);
      expect(p.lostShare).toBeGreaterThanOrEqual(0);
      expect(p.lostShare).toBeLessThanOrEqual(1);
      expect(p.wonN).toBeGreaterThan(0);
      expect(p.lostN).toBeGreaterThan(0);
    }
  });
});
