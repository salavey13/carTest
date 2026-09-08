// tests/franchize/lead-closer.spec.ts
//
// Спеки CLOSER-коуча (wave «Hormozi Blueprint»): структура фреймворка,
// контекстная шпаргалка buildCloserCoach — сигналы возражений (AI-агент,
// ключевые слова), reinforce-only для конвертированных, дефолты и гигиена.

import { describe, expect, it } from "vitest";
import {
  buildCloserCoach,
  CLOSER_OBJECTIONS,
  CLOSER_OBJECTION_BY_KEY,
  CLOSER_STEPS,
  type CloserStepKey,
} from "@/app/franchize/[slug]/leads/lib/lead-closer";
import type { LeadRow } from "@/app/franchize/[slug]/leads/leads-types";

const lead = (over: Partial<LeadRow> = {}): LeadRow => ({
  user_id: "u1",
  full_name: "Иван",
  username: null,
  phone: null,
  source: "avito",
  bikeTitle: "79Bike Falcon GT",
  createdAt: "2026-09-08T10:00:00Z",
  lastSeenAt: null,
  verified: false,
  rentals: [],
  sales: [],
  ...over,
});

const avitoLead = (
  msg: { first?: string | null; last?: string | null } = {},
  over: Partial<LeadRow> = {},
): LeadRow =>
  lead({
    avito: {
      chatId: "c1",
      itemUrl: null,
      profileUrl: null,
      itemId: null,
      lastMessage: msg.last ?? null,
      firstMessage: msg.first ?? null,
      messagesCount: 1,
    },
    ...over,
  });

describe("структура CLOSER", () => {
  it("шесть шагов в порядке фреймворка C-L-O-S-E-R", () => {
    expect(CLOSER_STEPS.map((s) => s.key)).toEqual([
      "clarify",
      "label",
      "overview",
      "sell",
      "explain",
      "reinforce",
    ] as CloserStepKey[]);
  });

  it("у каждого шага есть цель и готовые фразы; у explain — ссылка на карточки", () => {
    for (const step of CLOSER_STEPS) {
      expect(step.title.length).toBeGreaterThan(3);
      expect(step.goal.length).toBeGreaterThan(10);
      if (step.key !== "explain") {
        expect(step.moves.length).toBeGreaterThan(0);
      }
    }
  });

  it("шесть типов возражений с уникальными ключами и готовым ответом", () => {
    expect(CLOSER_OBJECTIONS).toHaveLength(6);
    const keys = new Set(CLOSER_OBJECTIONS.map((o) => o.key));
    expect(keys.size).toBe(6);
    for (const o of CLOSER_OBJECTIONS) {
      expect(o.response.length).toBeGreaterThan(30);
      expect(o.principle.length).toBeGreaterThan(15);
      expect(CLOSER_OBJECTION_BY_KEY[o.key]).toBe(o);
    }
  });
});

describe("buildCloserCoach — сигналы возражений", () => {
  it("операторская заглушка → null (секция не рендерится)", () => {
    expect(
      buildCloserCoach(lead({ identityState: "operator_placeholder" })),
    ).toBeNull();
  });

  it("без сигналов — типовые «дорого» и «подумаю» без «почему»", () => {
    const coach = buildCloserCoach(avitoLead());
    expect(coach).not.toBeNull();
    expect(coach!.reinforceOnly).toBe(false);
    expect(coach!.steps).toHaveLength(6);
    expect(coach!.objections.map((h) => h.objection.key)).toEqual([
      "money",
      "stall",
    ]);
    expect(coach!.objections[0].reason).toBeNull();
  });

  it("ключевое слово «дорого» поднимает money-карточку с причиной", () => {
    const coach = buildCloserCoach(
      avitoLead({ first: "Здравствуйте! А почему так дорого?" }),
    );
    expect(coach!.objections[0].objection.key).toBe("money");
    expect(coach!.objections[0].reason).toContain("дорого");
  });

  it("«подумаю» и «спрошу жену» поднимают stall и decision (порядок списка сигналов)", () => {
    const coach = buildCloserCoach(
      avitoLead({ first: "Я подумаю, надо ещё спросу жену", last: "спрошу жену" }),
    );
    const keys = coach!.objections.map((h) => h.objection.key);
    expect(keys).toContain("stall");
    expect(keys).toContain("decision");
    expect(keys[0]).toBe("stall"); // stall раньше decision в списке сигналов
  });

  it("AI-агент (analysis.objection=price) приоритетнее локальных слов", () => {
    const coach = buildCloserCoach(
      lead({
        avito: {
          chatId: "c1",
          itemUrl: null,
          profileUrl: null,
          itemId: null,
          lastMessage: "ну я подумаю",
          messagesCount: 2,
          analysis: {
            intent: "price",
            confidence: 80,
            suggestedReply: null,
            shortReply: null,
            nextBestAction: null,
            temperature: "warm",
            objection: "price",
            entities: null,
            notes: null,
            model: null,
            analyzedAt: null,
          },
        },
      }),
    );
    expect(coach!.objections[0].objection.key).toBe("money");
    expect(coach!.objections[0].reason).toContain("AI-агент");
    // Локальный сигнал «подумаю» всё равно попал в топ (дедуп по ключу не съел)
    expect(coach!.objections.map((h) => h.objection.key)).toContain("stall");
  });

  it("дедупликация: AI и ключевое слово одного типа не дублируют карточку", () => {
    const coach = buildCloserCoach(
      lead({
        avito: {
          chatId: "c1",
          itemUrl: null,
          profileUrl: null,
          itemId: null,
          lastMessage: "дорого",
          messagesCount: 1,
          analysis: {
            intent: null,
            confidence: null,
            suggestedReply: null,
            shortReply: null,
            nextBestAction: null,
            temperature: null,
            objection: "price",
            entities: null,
            notes: null,
            model: null,
            analyzedAt: null,
          },
        },
      }),
    );
    const moneyHits = coach!.objections.filter((h) => h.objection.key === "money");
    expect(moneyHits).toHaveLength(1);
    expect(moneyHits[0].reason).toContain("AI-агент"); // первый сигнал сохранён
  });

  it("возражений максимум три", () => {
    const coach = buildCloserCoach(
      avitoLead({
        first: "дорого, подумаю, спросу жену, в прошлый раз обманули, без залога, некогда",
      }),
    );
    expect(coach!.objections).toHaveLength(3);
  });
});

describe("buildCloserCoach — конвертированный лид", () => {
  it("аренда → reinforce-only: один шаг, без возражений", () => {
    const coach = buildCloserCoach(
      lead({
        rentals: [
          {
            id: "r1",
            status: "active",
            startDate: "2026-09-08T12:00:00Z",
            endDate: "2026-09-10T12:00:00Z",
            bikeTitle: "Falcon",
            total_price: 8000,
          } as unknown as LeadRow["rentals"][number],
        ],
      }),
    );
    expect(coach!.reinforceOnly).toBe(true);
    expect(coach!.steps).toHaveLength(1);
    expect(coach!.steps[0].key).toBe("reinforce");
    expect(coach!.objections).toHaveLength(0);
  });

  it("договор без аренды тоже считается конверсией", () => {
    const coach = buildCloserCoach(lead({ contractCount: 1 }));
    expect(coach!.reinforceOnly).toBe(true);
  });
});

describe("гигиена текстов", () => {
  it("готовые ответы возражений копируемо-самодостаточны (нет плейсхолдеров в стиле {{}})", () => {
    for (const o of CLOSER_OBJECTIONS) {
      expect(o.response).not.toMatch(/\{\{[^}]*\}\}/);
    }
    for (const s of CLOSER_STEPS) {
      for (const m of s.moves) expect(m).not.toMatch(/\{\{[^}]*\}\}/);
    }
  });
});
