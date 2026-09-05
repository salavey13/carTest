/**
 * tests/franchize/lead-playbook.spec.ts
 *
 * Тесты плейбука смены (lib/lead-playbook.ts) — off-the-call SOP из курса
 * The Ultimate Sales Training 2026:
 *  1. Горячий ждёт < 5 мин → действие hot-waiting «золотое окно» (+391%).
 *  2. Горячий ждёт ≥ 5 мин → hot-waiting «зона смерти» (−80%), вес ниже.
 *  3. Свежий не-горячий ≤ 60 мин → fresh-waiting («кто первый»).
 *  4. Просроченный перезвон → callback-overdue с приоритетом над свежими.
 *  5. Ghost: авито-диалог молчит >24 ч → ghost с мем-сообщением; обработан/
 *     сконвертирован/перезвон назначен — не ghost.
 *  6. Pull-up: бронь стартует >36 ч при договорной стадии → «подтянуть».
 *  7. Договор висит >24 ч без аренды → contract-hanging.
 *  8. Лимит действий и сортировка по весу; заглушки и битые данные — чисто.
 *  9. Бенчмарки курса присутствуют (60 сек / 5 мин / 50% / +29%).
 */

import { describe, expect, it } from "vitest";
import {
  buildNextActions,
  PLAYBOOK_BENCHMARKS,
  GHOST_SILENCE_MS,
} from "@/app/franchize/[slug]/leads/lib/lead-playbook";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/[slug]/leads/leads-types";

const NOW = Date.parse("2026-09-04T12:00:00.000Z"); // пятница

function buildLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    user_id: "avito:chat-1",
    full_name: "Иван Петров",
    username: null,
    phone: null,
    source: "callback_request",
    bikeTitle: null,
    createdAt: "2026-09-04T11:50:00.000Z", // 10 мин назад
    lastSeenAt: null,
    verified: false,
    rentals: [],
    sales: [],
    contactChannel: "avito",
    avito: {
      chatId: "chat-1",
      itemUrl: null,
      profileUrl: null,
      itemId: null,
      lastMessage: "Здравствуйте, актуально?",
      firstMessage: "Здравствуйте, актуально?",
      itemPrice: 2500,
      messagesCount: 2,
      lastMessageAt: "2026-09-04T11:50:00.000Z",
    },
    ...overrides,
  };
}

function handledTodo(leadId: string, completedAt = "2026-09-04T11:55:00.000Z"): LeadTodoRow {
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
    description: '{"kind":"callback","note":"после 18:00"}',
    status: "pending",
    priority: "normal",
    category: "lead_handling",
    created_at: "2026-09-04T10:30:00.000Z",
    completed_at: null,
    assigned_to: null,
    due_date: dueAt,
  };
}

describe("lead-playbook: скорость первого ответа", () => {
  it("Горячий ждёт 10 мин → hot-waiting «зона смерти» с фактом −80%", () => {
    const lead = buildLead({
      createdAt: "2026-09-04T11:50:00.000Z",
      avito: {
        chatId: "chat-1", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Беру сегодня!", firstMessage: "Беру сегодня!",
        itemPrice: 2500, messagesCount: 3, lastMessageAt: "2026-09-04T11:50:00.000Z",
        analysis: { intent: "availability", confidence: 90, temperature: "hot" },
      },
    });
    const actions = buildNextActions([lead], [], NOW, 4);
    const hot = actions.find((a) => a.key === "hot-waiting");
    expect(hot).toBeDefined();
    expect(hot!.weight).toBe(90); // hotLate
    expect(hot!.tone).toBe("warning");
    expect(hot!.detail).toContain("−80%");
    expect(hot!.title).toContain("Иван");
    expect(hot!.message).toBeTruthy();
  });

  it("Горячий ждёт 2 мин → «золотое окно» с фактом +391% и весом 110", () => {
    const lead = buildLead({
      createdAt: "2026-09-04T11:58:00.000Z",
      avito: {
        chatId: "chat-1", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Готов забрать!", firstMessage: "Готов забрать!",
        itemPrice: 2500, messagesCount: 3, lastMessageAt: "2026-09-04T11:58:00.000Z",
        analysis: { intent: "availability", confidence: 90, temperature: "hot" },
      },
    });
    const actions = buildNextActions([lead], [], NOW, 4);
    const hot = actions.find((a) => a.key === "hot-waiting");
    expect(hot).toBeDefined();
    expect(hot!.weight).toBe(110); // hotFresh — самая верхняя позиция
    expect(hot!.tone).toBe("danger");
    expect(hot!.detail).toContain("+391%");
  });

  it("Свежий не-горячий (10 мин) → fresh-waiting «кто первый»", () => {
    const lead = buildLead({ avito: { chatId: "chat-1", itemUrl: null, profileUrl: null, itemId: null, lastMessage: "Актуально?", firstMessage: "Актуально?", itemPrice: 2500, messagesCount: 2, lastMessageAt: "2026-09-04T11:50:00.000Z" } });
    const actions = buildNextActions([lead], [], NOW, 4);
    const fresh = actions.find((a) => a.key === "fresh-waiting");
    expect(fresh).toBeDefined();
    expect(fresh!.detail).toContain("первым");
    expect(fresh!.weight).toBe(85);
  });

  it("Горячий приоритетнее свежего при одинаковом возрасте", () => {
    const hot = buildLead({
      user_id: "avito:hot",
      avito: {
        chatId: "hot", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Беру!", firstMessage: "Беру!", itemPrice: 2500,
        messagesCount: 2, lastMessageAt: "2026-09-04T11:50:00.000Z",
        analysis: { intent: "availability", confidence: 90, temperature: "hot" },
      },
    });
    const warm = buildLead({ user_id: "avito:warm", full_name: "Пётр", createdAt: "2026-09-04T11:50:00.000Z" });
    const actions = buildNextActions([warm, hot], [], NOW, 4);
    expect(actions[0]?.key).toBe("hot-waiting");
    expect(actions[0]?.leadId).toBe("avito:hot");
  });
});

describe("lead-playbook: перезвоны и обработанные", () => {
  it("Просроченный перезвон → callback-overdue с note в детали", () => {
    const lead = buildLead({ createdAt: "2026-09-03T09:00:00.000Z" });
    const todo = callbackTodo(lead.user_id, "2026-09-04T10:00:00.000Z"); // 2 ч назад
    const actions = buildNextActions([lead], [todo], NOW, 4);
    const cb = actions.find((a) => a.key === "callback-overdue");
    expect(cb).toBeDefined();
    expect(cb!.weight).toBe(100);
    expect(cb!.detail).toContain("после 18:00");
    expect(cb!.tone).toBe("danger");
  });

  it("Будущий перезвон — лид контролируемый: никаких действий по очереди", () => {
    const lead = buildLead({ createdAt: "2026-09-03T09:00:00.000Z" });
    const todo = callbackTodo(lead.user_id, "2026-09-04T18:00:00.000Z"); // через 6 ч
    const actions = buildNextActions([lead], [todo], NOW, 6);
    expect(actions.find((a) => a.key === "fresh-waiting")).toBeUndefined();
    expect(actions.find((a) => a.key === "ghost")).toBeUndefined();
  });

  it("Обработанный лид не попадает ни в очередь, ни в ghost", () => {
    const lead = buildLead({ createdAt: "2026-09-02T09:00:00.000Z" });
    const actions = buildNextActions([lead], [handledTodo(lead.user_id)], NOW, 6);
    expect(actions).toHaveLength(0);
  });
});

describe("lead-playbook: ghost и договоры", () => {
  it("Авито-диалог молчит 30 ч → ghost с реанимационным сообщением", () => {
    const lead = buildLead({
      createdAt: "2026-09-02T06:00:00.000Z",
      avito: {
        chatId: "chat-1", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Я подумаю", firstMessage: "Здравствуйте!",
        itemPrice: 2500, messagesCount: 4, lastMessageAt: "2026-09-03T06:00:00.000Z",
      },
    });
    const actions = buildNextActions([lead], [], NOW, 6);
    const ghost = actions.find((a) => a.key === "ghost");
    expect(ghost).toBeDefined();
    expect(ghost!.message).toContain("Куда пропали");
    expect(ghost!.detail).toContain("1 д"); // 30 ч = «1 д 6 ч»
  });

  it("Тишина < 24 ч — ещё не ghost", () => {
    const lead = buildLead({
      createdAt: "2026-09-04T09:00:00.000Z",
      avito: {
        chatId: "chat-1", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Актуально?", firstMessage: "Актуально?",
        itemPrice: 2500, messagesCount: 2, lastMessageAt: "2026-09-04T09:00:00.000Z",
      },
    });
    const actions = buildNextActions([lead], [], NOW, 6);
    // 3 ч тишины: не ghost, но и не fresh (>60 мин) → действий нет.
    expect(actions.find((a) => a.key === "ghost")).toBeUndefined();
  });

  it("Не-авито лид с авито-подобным user_id тоже ловится, не-авито без метаданных — нет", () => {
    const plain = buildLead({ user_id: "user-plain", contactChannel: "web", avito: undefined });
    const actions = buildNextActions([plain], [], NOW, 6);
    expect(actions.find((a) => a.key === "ghost")).toBeUndefined();
  });

  it("Договорная стадия без аренды и без движения 2 дня → contract-hanging", () => {
    const lead = buildLead({
      user_id: "avito:contract",
      full_name: "Договор Иванов",
      createdAt: "2026-09-02T06:00:00.000Z",
      stageKey: "contract_sent",
      contractCount: 1,
    });
    const actions = buildNextActions([lead], [], NOW, 6);
    const hang = actions.find((a) => a.key === "contract-hanging");
    expect(hang).toBeDefined();
    expect(hang!.detail).toContain("2 д");
  });

  it("Бронь стартует через 3 дня при договорной стадии → pull-up «подтянуть на сегодня»", () => {
    const lead = buildLead({
      user_id: "avito:pullup",
      full_name: "Бронь Сергеев",
      createdAt: "2026-09-03T06:00:00.000Z",
      stageKey: "awaiting_qr_claim",
      contractCount: 1,
      rentals: [
        {
          rentalId: "r-9",
          status: "scheduled",
          paymentStatus: "unpaid",
          startDate: "2026-09-07T10:00:00.000Z", // через 3 дня
          endDate: "2026-09-10T10:00:00.000Z",
          bikeTitle: "79BIKE Falcon GT",
          totalCost: 21000,
        },
      ],
    });
    const actions = buildNextActions([lead], [], NOW, 6);
    const pull = actions.find((a) => a.key === "pull-up");
    expect(pull).toBeDefined();
    expect(pull!.message).toContain("сегодня или завтра");
  });

  it("Активная аренда (сделка) — никаких действий", () => {
    const lead = buildLead({
      stageKey: "active_rental",
      rentals: [
        {
          rentalId: "r-1", status: "active", paymentStatus: "paid",
          startDate: "2026-09-03T10:00:00.000Z", endDate: "2026-09-20T10:00:00.000Z",
          bikeTitle: "79BIKE Falcon GT", totalCost: 21000,
        },
      ],
    });
    expect(buildNextActions([lead], [], NOW, 6)).toHaveLength(0);
  });
});

describe("lead-playbook: очередь и границы", () => {
  it("Лимит: много проблем — максимум limit действий, отсортированы по весу", () => {
    const leads: LeadRow[] = [
      buildLead({ user_id: "avito:a", full_name: "А А", createdAt: "2026-09-04T11:58:00.000Z", avito: { chatId: "a", itemUrl: null, profileUrl: null, itemId: null, lastMessage: "Беру!", firstMessage: "Беру!", itemPrice: 2500, messagesCount: 2, lastMessageAt: "2026-09-04T11:58:00.000Z", analysis: { temperature: "hot", confidence: 90 } } }),
      buildLead({ user_id: "avito:b", full_name: "Б Б", createdAt: "2026-09-04T11:59:00.000Z" }),
      buildLead({ user_id: "avito:c", full_name: "В В", createdAt: "2026-09-04T09:00:00.000Z" }),
      buildLead({ user_id: "avito:d", full_name: "Г Г", createdAt: "2026-09-02T06:00:00.000Z", stageKey: "contract_sent", contractCount: 1 }),
    ];
    const overdueLead = buildLead({ user_id: "avito:e", full_name: "Д Д", createdAt: "2026-09-03T06:00:00.000Z" });
    const todos = [callbackTodo(overdueLead.user_id, "2026-09-04T10:00:00.000Z")];
    const actions = buildNextActions([...leads, overdueLead], todos, NOW, 3);
    expect(actions).toHaveLength(3);
    for (let i = 1; i < actions.length; i += 1) {
      expect(actions[i - 1].weight).toBeGreaterThanOrEqual(actions[i].weight);
    }
    // Золотое окно (110) главнее просроченного перезвона (100) — порядок курса.
    expect(actions[0].key).toBe("hot-waiting");
    expect(actions[1].key).toBe("callback-overdue");
  });

  it("Операторские заглушки и битые массивы не роняют расчёт", () => {
    const placeholder = buildLead({ user_id: "op:1", identityState: "operator_placeholder" });
    const broken = buildLead({ user_id: "avito:broken", rentals: null as unknown as LeadRow["rentals"] });
    expect(() => buildNextActions([placeholder, broken], null as unknown as LeadTodoRow[], NOW, 4)).not.toThrow();
  });

  it("Пустые данные → пустая очередь; бенчмарки курса на месте", () => {
    expect(buildNextActions([], [], NOW, 4)).toEqual([]);
    const keys = PLAYBOOK_BENCHMARKS.map((b) => b.key);
    expect(keys).toEqual(["sec60", "min5", "first", "weekend"]);
    expect(GHOST_SILENCE_MS).toBe(24 * 60 * 60 * 1000);
  });
});
