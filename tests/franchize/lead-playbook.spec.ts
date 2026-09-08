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
 *  6. Пульс-чек (курс 2026): тишина ≥ 7 дней → ghost-long с поводом из
 *     факта (сезон/модель) вместо «куда пропали»; вес ниже ghost.
 *  7. Pull-up: бронь стартует >36 ч при договорной стадии → «подтянуть».
 *  8. Договор висит >24 ч без аренды → contract-hanging.
 *  9. Лимит действий и сортировка по весу; заглушки и битые данные — чисто.
 * 10. Бенчмарки курса присутствуют (60 сек / 5 мин / 50% / +29%).
 * 11. Recency polish (2026-09-09, «the recenter the better»): потолки
 *     давности у ожидающих вёдер (hot 24 ч, перезвон неделя, договор
 *     2 недели), демотировка старого перезвона до 65, tie-break
 *     «свежее — раньше» при равном весе.
 */

import { describe, expect, it } from "vitest";
import {
  buildNextActions,
  PLAYBOOK_BENCHMARKS,
  GHOST_LONG_SILENCE_MS,
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
      stageKey: "contract_sent",
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

// ── Пульс-чек по долго пропавшим (курс 2026, «no ≠ no forever») ────────────

describe("lead-playbook: пульс-чек (ghost-long)", () => {
  function ghostLead(daysSilent: number, bikeTitle: string | null = null): LeadRow {
    const lastMessageAt = new Date(NOW - daysSilent * 24 * 60 * 60 * 1000).toISOString();
    return buildLead({
      createdAt: lastMessageAt,
      bikeTitle,
      avito: {
        chatId: "chat-1", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Я подумаю", firstMessage: "Здравствуйте!",
        itemPrice: 2500, messagesCount: 4, lastMessageAt,
      },
    });
  }

  it("тишина 8 дней → ghost-long с сезонным сообщением (не «куда пропали»)", () => {
    const actions = buildNextActions([ghostLead(8, "79BIKE Falcon GT")], [], NOW, 6);
    const pulse = actions.find((a) => a.key === "ghost-long");
    expect(pulse).toBeDefined();
    expect(pulse!.weight).toBe(50);
    expect(pulse!.emoji).toBe("🍂");
    expect(pulse!.message).toContain("Сезон в разгаре");
    expect(pulse!.message).toContain("79BIKE Falcon GT как раз свободен");
    expect(actions.find((a) => a.key === "ghost")).toBeUndefined();
  });

  it("граница: ровно 7 дней — уже ghost-long; сутки–неделя — обычный ghost", () => {
    const at7 = buildNextActions([ghostLead(7)], [], NOW, 6);
    expect(at7.find((a) => a.key === "ghost-long")).toBeDefined();
    const at6 = buildNextActions([ghostLead(6)], [], NOW, 6);
    expect(at6.find((a) => a.key === "ghost-long")).toBeUndefined();
    expect(at6.find((a) => a.key === "ghost")).toBeDefined();
    expect(GHOST_LONG_SILENCE_MS).toBe(7 * GHOST_SILENCE_MS);
  });

  it("пульс-чек без модели — «байки в наличии», без «undefined»", () => {
    const actions = buildNextActions([ghostLead(10)], [], NOW, 6);
    const pulse = actions.find((a) => a.key === "ghost-long")!;
    expect(pulse.message).toContain("байки в наличии");
    expect(pulse.message).not.toContain("undefined");
  });

  it("вес 50: свежие проблемы (горячий 110) выше пульса в очереди", () => {
    const hot = buildLead({
      user_id: "avito:hot",
      full_name: "Хот Хотов",
      createdAt: "2026-09-04T11:58:00.000Z",
      avito: {
        chatId: "hot", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Беру!", firstMessage: "Беру!",
        itemPrice: 2500, messagesCount: 2, lastMessageAt: "2026-09-04T11:58:00.000Z",
        analysis: { temperature: "hot", confidence: 90 },
      },
    });
    const actions = buildNextActions([ghostLead(9), hot], [], NOW, 6);
    expect(actions[0].key).toBe("hot-waiting");
    expect(actions[actions.length - 1].key).toBe("ghost-long");
  });

  it("конвертированный лид не получает пульс-чек", () => {
    const lead = buildLead({
      createdAt: "2026-08-20T06:00:00.000Z",
      contractCount: 1,
      avito: {
        chatId: "chat-1", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Спасибо!", firstMessage: "Здравствуйте!",
        itemPrice: 2500, messagesCount: 4,
        lastMessageAt: new Date(NOW - 9 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    expect(buildNextActions([lead], [], NOW, 6)).toHaveLength(0);
  });
});

// ── Плейбук 2026 волна 3: «1+1=11» — рекомендация после закрытой аренды ──
describe("lead-playbook: рекомендация (referral, «10 Steps» Squibb)", () => {
  const closedLead = (endIso: string, status = "completed") =>
    buildLead({
      stageKey: "closed_won",
      rentals: [
        {
          rentalId: "r-1",
          status,
          paymentStatus: "paid",
          startDate: "2026-08-25T10:00:00.000Z",
          endDate: endIso,
          bikeTitle: "Y-VOLT Surge V",
          totalCost: 12000,
        },
      ],
    });

  it("завершённая аренда 3 дня назад → действие «Попросить рекомендацию»", () => {
    const end = new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString();
    const actions = buildNextActions([closedLead(end)], [], NOW, 6);
    const ref = actions.find((a) => a.key === "referral")!;
    expect(ref).toBeDefined();
    expect(ref.title).toContain("Иван");
    expect(ref.message).toContain("перешлите");
  });

  it("аренда закрыта ровно на границе 7 дней — действие ещё показывается", () => {
    const end = new Date(NOW - 7 * 24 * 60 * 60 * 1000).toISOString();
    const actions = buildNextActions([closedLead(end)], [], NOW, 6);
    expect(actions.find((a) => a.key === "referral")).toBeDefined();
  });

  it("аренда закрыта 8 дней назад — окно истекло, действия нет", () => {
    const end = new Date(NOW - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(buildNextActions([closedLead(end)], [], NOW, 6)).toHaveLength(0);
  });

  it("ОТМЕНЁННАЯ аренда (endDate недавно) — НЕ считается успешным опытом", () => {
    const end = new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(buildNextActions([closedLead(end, "cancelled")], [], NOW, 6)).toHaveLength(0);
  });

  it("несколько аренд: берётся свежайшая ЗАВЕРШЁННАЯ, отменённая не мешает", () => {
    const completedOld = new Date(NOW - 6 * 24 * 60 * 60 * 1000).toISOString();
    const lead = buildLead({
      stageKey: "closed_won",
      rentals: [
        {
          rentalId: "r-old", status: "completed", paymentStatus: "paid",
          startDate: "2026-08-20T10:00:00.000Z", endDate: completedOld,
          bikeTitle: null, totalCost: 9000,
        },
        {
          rentalId: "r-cancelled", status: "cancelled", paymentStatus: "none",
          startDate: "2026-09-03T10:00:00.000Z",
          endDate: new Date(NOW - 1 * 24 * 60 * 60 * 1000).toISOString(),
          bikeTitle: null, totalCost: 0,
        },
      ],
    });
    const actions = buildNextActions([lead], [], NOW, 6);
    const ref = actions.find((a) => a.key === "referral")!;
    expect(ref).toBeDefined();
    expect(ref.detail).toContain("6 д"); // свежайшая completed, не отменённая
  });

  it("не-closed_won лид даже со свежей completed-арендой — действий нет", () => {
    const end = new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString();
    const lead = closedLead(end);
    lead.stageKey = "active_rental";
    expect(buildNextActions([lead], [], NOW, 6)).toHaveLength(0);
  });

  it("вес 45: рекомендация ниже ghost (55) — не вытесняет операционку из очереди", () => {
    const end = new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString();
    // Локальная ghost-фикстура (ghostLead из другого describe не видна):
    // авито-диалог молчит 1 день → действие ghost (вес 55).
    const lastMessageAt = new Date(NOW - 1 * 24 * 60 * 60 * 1000).toISOString();
    const ghost = buildLead({
      createdAt: lastMessageAt,
      avito: {
        chatId: "chat-ghost", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Я подумаю", firstMessage: "Здравствуйте!",
        itemPrice: 2500, messagesCount: 4, lastMessageAt,
      },
    });
    const actions = buildNextActions([closedLead(end), ghost], [], NOW, 4);
    expect(actions.findIndex((a) => a.key === "ghost"))
      .toBeLessThan(actions.findIndex((a) => a.key === "referral"));
  });

  it("операторская заглушка (operator_placeholder) — рекомендации нет", () => {
    const end = new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString();
    const lead = closedLead(end);
    lead.identityState = "operator_placeholder";
    expect(buildNextActions([lead], [], NOW, 6)).toHaveLength(0);
  });
});

// ── 2026-09-09 recency polish: «the recenter the better» ────────────────────
// Раньше у ожидающих вёдер не было потолка давности: старые hot-лиды,
// недельные просроченные перезвоны и полугодовые «висящие договоры»
// занимали топ очереди, а при равном весе старые ситуации вставали ПЕРЕД
// свежими. Теперь: потолки давности + демотировка старых обещаний +
// свежее-раньше внутри одного веса.
describe("lead-playbook: recency polish (2026-09-09)", () => {
  const hotAvito = (createdAtIso: string) => ({
    createdAt: createdAtIso,
    avito: {
      chatId: "chat-1", itemUrl: null, profileUrl: null, itemId: null,
      lastMessage: "Беру сегодня!", firstMessage: "Беру сегодня!",
      itemPrice: 2500, messagesCount: 3, lastMessageAt: createdAtIso,
      analysis: { intent: "availability", confidence: 90, temperature: "hot" as const },
    },
  });

  it("hot-лид ждёт 25 ч → «Спасти горячего» НЕТ: он уже ghost 👻, не оперативка", () => {
    const old = new Date(NOW - 25 * 60 * 60 * 1000).toISOString();
    const lead = buildLead(hotAvito(old));
    const actions = buildNextActions([lead], [], NOW, 6);
    expect(actions.find((a) => a.key === "hot-waiting")).toBeUndefined();
    const ghost = actions.find((a) => a.key === "ghost");
    expect(ghost).toBeDefined();
    expect(ghost!.weight).toBe(55);
  });

  it("hot-лид ждёт 23 ч — ещё «Спасти горячего» (граница потолка)", () => {
    const almostOld = new Date(NOW - 23 * 60 * 60 * 1000).toISOString();
    const lead = buildLead(hotAvito(almostOld));
    const actions = buildNextActions([lead], [], NOW, 6);
    const hot = actions.find((a) => a.key === "hot-waiting");
    expect(hot).toBeDefined();
    expect(hot!.weight).toBe(90);
    expect(actions.find((a) => a.key === "ghost")).toBeUndefined();
  });

  it("перезвон просрочен на 3 дня → демотирован: вес 65 (ниже «договора висит»), warning", () => {
    const lead = buildLead({ createdAt: "2026-09-01T09:00:00.000Z" });
    const todo = callbackTodo(lead.user_id, new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString());
    const actions = buildNextActions([lead], [todo], NOW, 6);
    const cb = actions.find((a) => a.key === "callback-overdue");
    expect(cb).toBeDefined();
    expect(cb!.weight).toBe(65);
    expect(cb!.tone).toBe("warning");
  });

  it("перезвон просрочен на 8 дней → в очереди его НЕТ (туду остаётся в «Работе»)", () => {
    const lead = buildLead({ createdAt: "2026-08-20T09:00:00.000Z" });
    const todo = callbackTodo(lead.user_id, new Date(NOW - 8 * 24 * 60 * 60 * 1000).toISOString());
    const actions = buildNextActions([lead], [todo], NOW, 6);
    expect(actions.find((a) => a.key === "callback-overdue")).toBeUndefined();
    // С активным перезвоном лид не попадает и в ghost — очередь по нему пуста.
    expect(actions).toHaveLength(0);
  });

  it("перезвон просрочен на 2 часа → по-прежнему полный вес 100 (свежее обещание)", () => {
    const lead = buildLead({ createdAt: "2026-09-03T09:00:00.000Z" });
    const todo = callbackTodo(lead.user_id, "2026-09-04T10:00:00.000Z");
    const actions = buildNextActions([lead], [todo], NOW, 6);
    const cb = actions.find((a) => a.key === "callback-overdue");
    expect(cb!.weight).toBe(100);
    expect(cb!.tone).toBe("danger");
  });

  it("договор без движения 20 дней → НЕ «Договор висит» (архивная пыль)", () => {
    const lead = buildLead({
      createdAt: new Date(NOW - 20 * 24 * 60 * 60 * 1000).toISOString(),
      stageKey: "contract_sent",
      contractCount: 1,
    });
    const actions = buildNextActions([lead], [], NOW, 6);
    expect(actions.find((a) => a.key === "contract-hanging")).toBeUndefined();
  });

  it("договор без движения 3 дня → «Договор висит» на месте (регресс)", () => {
    const lead = buildLead({
      createdAt: new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString(),
      stageKey: "contract_sent",
      contractCount: 1,
    });
    const actions = buildNextActions([lead], [], NOW, 6);
    expect(actions.find((a) => a.key === "contract-hanging")).toBeDefined();
  });

  it("равный вес → СВЕЖАЯ ситуация раньше старой (tie-break перевёрнут)", () => {
    const fresh = buildLead({ user_id: "avito:fresh", full_name: "Свежий Свеж", ...hotAvito("2026-09-04T11:58:00.000Z") });
    const older = buildLead({ user_id: "avito:older", full_name: "Старый Стар", ...hotAvito("2026-09-04T11:56:00.000Z") });
    const actions = buildNextActions([older, fresh], [], NOW, 6);
    expect(actions[0].leadId).toBe("avito:fresh");
    expect(actions[1].leadId).toBe("avito:older");
  });

  it("демотированный перезвон (65) всё ещё выше ghost (55) — обещание важнее реанимации", () => {
    const cbLead = buildLead({
      user_id: "avito:cb",
      full_name: "Обещалка Обещ",
      createdAt: "2026-09-01T09:00:00.000Z",
    });
    const ghostLead = buildLead({
      user_id: "avito:ghost",
      full_name: "Тихий Тих",
      createdAt: new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString(),
      avito: {
        chatId: "ghost", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Ну что, думает?", firstMessage: "Здравствуйте!",
        itemPrice: 2500, messagesCount: 2,
        lastMessageAt: new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    const todos = [callbackTodo(cbLead.user_id, new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString())];
    const actions = buildNextActions([cbLead, ghostLead], todos, NOW, 6);
    expect(actions[0].key).toBe("callback-overdue");
    expect(actions[0].leadId).toBe("avito:cb");
    expect(actions[1].key).toBe("ghost");
  });
});

// ── 2026-09-09 SUPER DUPER («todays work = super duper leads») ──────────────
// Потолки давности у оставшихся «вечных» вёдер + новое ведро
// «💰 Деньги на столе» (частичная оплата / бронь вот-вот стартует).

describe("Playbook — super duper caps (the recenter the better, wave 2)", () => {
  it("ghost-тишина старше GHOST_MAX_MS (30 д) — не сегодняшняя работа: действия нет", () => {
    const lead = buildLead({
      user_id: "avito:archeology",
      full_name: "Древний Древ",
      createdAt: "2026-05-01T06:00:00.000Z",
      lastSeenAt: new Date(NOW - 45 * 24 * 60 * 60 * 1000).toISOString(),
      avito: {
        chatId: "archeology", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Ну что?", firstMessage: "Здравствуйте!",
        itemPrice: 2500, messagesCount: 4,
        lastMessageAt: new Date(NOW - 45 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    const actions = buildNextActions([lead], [], NOW, 6);
    expect(actions.find((a) => a.key === "ghost")).toBeUndefined();
    expect(actions.find((a) => a.key === "ghost-long")).toBeUndefined();
  });

  it("ghost-тишина 10 дней — внутри потолка: ghost-long на месте", () => {
    const lead = buildLead({
      user_id: "avito:ten-days",
      full_name: "Тихий Десять",
      createdAt: "2026-08-20T06:00:00.000Z",
      avito: {
        chatId: "ten-days", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Подумаю", firstMessage: "Здравствуйте!",
        itemPrice: 2500, messagesCount: 3,
        lastMessageAt: new Date(NOW - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    const actions = buildNextActions([lead], [], NOW, 6);
    expect(actions.find((a) => a.key === "ghost-long")).toBeDefined();
  });

  it("реактивация «Потеряно» старше LOST_REACTIVATE_MAX_MS (90 д) — молчим", () => {
    const lead = buildLead({
      user_id: "lost-year-ago",
      full_name: "Потеряшка Год",
      createdAt: "2025-06-01T06:00:00.000Z",
      intentStage: "closed",
      lastModifiedAt: new Date(NOW - 180 * 24 * 60 * 60 * 1000).toISOString(),
      stageKey: "closed_lost",
    });
    const actions = buildNextActions([lead], [], NOW, 6);
    expect(actions.find((a) => a.key === "reactivation")).toBeUndefined();
  });

  it("pull-up: бронь дальше PULLUP_MAX_HORIZON_MS (7 д) — не «подтягиваем на сегодня»", () => {
    const lead = buildLead({
      user_id: "avito:far-pullup",
      full_name: "Дальний Далёк",
      createdAt: "2026-09-01T06:00:00.000Z",
      stageKey: "contract_sent",
      contractCount: 1,
      rentals: [
        {
          rentalId: "r-far", status: "confirmed", paymentStatus: "unpaid",
          startDate: "2026-09-20T10:00:00.000Z", // через 16 дней
          endDate: "2026-09-23T10:00:00.000Z",
          bikeTitle: "79BIKE Falcon GT", totalCost: 21000,
        },
      ],
    });
    const actions = buildNextActions([lead], [], NOW, 6);
    expect(actions.find((a) => a.key === "pull-up")).toBeUndefined();
  });

  it("частичная оплата (saleProgress.partial_paid) → «💰 Деньги на столе» весом 105 на вершине очереди", () => {
    const money = buildLead({
      user_id: "y-volt-buyer",
      full_name: "Покупатель Вольт",
      createdAt: "2026-09-03T09:00:00.000Z",
      saleProgress: { status: "partial_paid", paidRub: 300000, totalRub: 450000, note: "ждёт остаток" },
    });
    const hot = buildLead({
      user_id: "avito:hot-distractor",
      full_name: "Горячий Мешающий",
      createdAt: new Date(NOW - 3 * 60_000).toISOString(),
      avito: {
        ...buildLead().avito!,
        analysis: { temperature: "hot", confidence: 90, suggestedReply: null, shortReply: null, nextBestAction: null, objection: null, entities: null, notes: null, model: null, analyzedAt: null },
      },
    });
    const actions = buildNextActions([hot, money], [], NOW, 6);
    const moneyAction = actions.find((a) => a.key === "money-on-table");
    expect(moneyAction).toBeDefined();
    expect(moneyAction!.weight).toBe(105);
    expect(moneyAction!.detail).toContain("300\u00A0000");
    expect(moneyAction!.detail).toContain("450\u00A0000");
    // Деньги на столе (105) — сразу после «горячего <5 мин» (110), выше всех остальных.
    expect(actions[0].key).toBe("hot-waiting");
    expect(actions[1].key).toBe("money-on-table");
    // Готовое сообщение называет остаток.
    expect(moneyAction!.message).toContain("150\u00A0000");
  });

  it("частичная оплата без totalRub — сообщение без остатка, но ведро на месте", () => {
    const lead = buildLead({
      user_id: "y-volt-min",
      full_name: "Покупатель Мин",
      createdAt: "2026-09-03T09:00:00.000Z",
      saleProgress: { status: "partial_paid", paidRub: 300000 },
    });
    const actions = buildNextActions([lead], [], NOW, 6);
    const moneyAction = actions.find((a) => a.key === "money-on-table");
    expect(moneyAction).toBeDefined();
    expect(moneyAction!.message).toContain("300\u00A0000");
  });

  it("подтверждённая бронь стартует через 12 ч → «💰 Встретить клиента» (принять оплату и выдать)", () => {
    const lead = buildLead({
      user_id: "web:meet",
      full_name: "Скорый Скор",
      createdAt: "2026-09-03T09:00:00.000Z",
      contractCount: 1,
      rentals: [
        {
          rentalId: "r-soon", status: "confirmed", paymentStatus: "unpaid",
          startDate: new Date(NOW + 12 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(NOW + 60 * 60 * 60 * 1000).toISOString(),
          bikeTitle: "Kawasaki EX650", totalCost: 18000,
        },
      ],
    });
    const actions = buildNextActions([lead], [], NOW, 6);
    const meet = actions.find((a) => a.key === "money-on-table");
    expect(meet).toBeDefined();
    expect(meet!.title).toContain("Встретить клиента");
    expect(meet!.detail).toContain("12 ч");
  });

  it("ведро «Деньги на столе» и «Подтянуть» не пересекаются: 12 ч → деньги, 3 дня → подтянуть", () => {
    const soon = buildLead({
      user_id: "web:soon",
      full_name: "Скорый Ранний",
      createdAt: "2026-09-03T09:00:00.000Z",
      stageKey: "contract_sent",
      contractCount: 1,
      rentals: [
        {
          rentalId: "r-soon2", status: "confirmed", paymentStatus: "unpaid",
          startDate: new Date(NOW + 12 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(NOW + 60 * 60 * 60 * 1000).toISOString(),
          bikeTitle: "Kawasaki EX650", totalCost: 18000,
        },
      ],
    });
    const mid = buildLead({
      user_id: "web:mid",
      full_name: "Средний Срок",
      createdAt: "2026-09-03T09:00:00.000Z",
      stageKey: "contract_sent",
      contractCount: 1,
      rentals: [
        {
          rentalId: "r-mid", status: "confirmed", paymentStatus: "unpaid",
          startDate: new Date(NOW + 3 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(NOW + 5 * 24 * 60 * 60 * 1000).toISOString(),
          bikeTitle: "Kawasaki EX650", totalCost: 18000,
        },
      ],
    });
    const soonActions = buildNextActions([soon], [], NOW, 6);
    expect(soonActions.find((a) => a.key === "money-on-table")).toBeDefined();
    expect(soonActions.find((a) => a.key === "pull-up")).toBeUndefined();

    const midActions = buildNextActions([mid], [], NOW, 6);
    expect(midActions.find((a) => a.key === "pull-up")).toBeDefined();
    expect(midActions.find((a) => a.key === "money-on-table")).toBeUndefined();
  });
});
