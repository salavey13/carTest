/**
 * tests/franchize/lead-scripts.spec.ts
 *
 * Тесты движка «Готовый ответ» (suggested response для авито-лидов):
 *  1. Не-авито лид → null (секция в шторке не рендерится).
 *  2. Диагностика интента по ключевым словам: последнее сообщение весит ×2.
 *  3. Пустой текст → generic-скрипт (не null для авито-канала).
 *  4. Персонализация: имя покупателя в приветствии, псевдоним «Покупатель
 *     Avito #…» не попадает в текст.
 *  5. Цена объявления попадает в скрипт с форматированием ru-RU.
 *  6. Быстрые ответы (quick replies) непустые, ≤5, универсальные в конце.
 *  7. Скрипт и короткий вариант непустые и различаются.
 *  8. Next Best Action всегда заполнен.
 *  9. ПРАВКА БОССА 2026-09-04: экипировка платная (шлем 500/1 000 ₽,
 *     перчатки 250–500 ₽), тест-драйв бесплатный — без 5 000 ₽ залога.
 */

import { describe, expect, it } from "vitest";
import {
  buildSuggestedResponse,
  intentChip,
  scoreIntents,
} from "@/app/franchize/[slug]/leads/lib/lead-scripts";
import type { LeadRow } from "@/app/franchize/[slug]/leads/leads-types";

function buildLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    user_id: "avito:chat-123",
    full_name: "Иван Петров",
    username: null,
    phone: null,
    source: "callback_request",
    bikeTitle: "Kugoo Kirin M4 Pro",
    createdAt: "2026-09-02T10:00:00.000Z",
    lastSeenAt: "2026-09-02T11:00:00.000Z",
    verified: false,
    rentals: [],
    sales: [],
    contactChannel: "avito",
    avito: {
      chatId: "chat-123",
      itemUrl: null,
      profileUrl: null,
      itemId: null,
      lastMessage: "Здравствуйте, сколько стоит аренда?",
      firstMessage: "Здравствуйте, сколько стоит аренда?",
      itemPrice: 2500,
      messagesCount: 1,
      lastMessageAt: "2026-09-02T11:00:00.000Z",
    },
    ...overrides,
  };
}

describe("lead-scripts: доступность", () => {
  it("не-авито лид → null", () => {
    const lead = buildLead({ contactChannel: undefined, avito: null, user_id: "413553377" });
    expect(buildSuggestedResponse(lead)).toBeNull();
    expect(intentChip(lead)).toBeNull();
  });

  it("авито-лид без текста → generic-скрипт (не null)", () => {
    const lead = buildLead({
      avito: { chatId: "chat-123", itemUrl: null, profileUrl: null, itemId: null, lastMessage: null },
    });
    const res = buildSuggestedResponse(lead);
    expect(res).not.toBeNull();
    expect(res?.intent.key).toBe("generic");
    expect(res?.script.length).toBeGreaterThan(20);
  });
});

describe("lead-scripts: диагностика интента", () => {
  it("цена: «сколько стоит» в последнем сообщении", () => {
    const res = buildSuggestedResponse(buildLead());
    expect(res?.intent.key).toBe("price");
  });

  it("наличие приоритетнее при равном весе (порядок словаря)", () => {
    const lead = buildLead({
      avito: {
        chatId: "chat-123",
        itemUrl: null,
        profileUrl: null,
        itemId: null,
        lastMessage: "А это свободно на завтра? И какая цена?",
        firstMessage: null,
      },
    });
    // «свободно»/«на завтра» (×2 за последнее сообщение) vs «цена» (тоже ×2)
    // → приоритет availability по порядку словаря.
    expect(buildSuggestedResponse(lead)?.intent.key).toBe("availability");
  });

  it("последнее сообщение весит ×2: вопрос о доставке побеждает старую цену", () => {
    const lead = buildLead({
      avito: {
        chatId: "chat-123",
        itemUrl: null,
        profileUrl: null,
        itemId: null,
        lastMessage: "А вы сможете привезти байк мне?",
        firstMessage: "Сколько стоит аренда?",
      },
    });
    const ranked = scoreIntents(lead);
    expect(ranked[0]?.key).toBe("delivery");
  });

  it("возражение «дорого» распознаётся", () => {
    const lead = buildLead({
      avito: {
        chatId: "chat-123",
        itemUrl: null,
        profileUrl: null,
        itemId: null,
        lastMessage: "Это дорого, есть вариант дешевле?",
        firstMessage: null,
      },
    });
    expect(buildSuggestedResponse(lead)?.intent.key).toBe("discount");
  });

  it("документы и залог распознаются", () => {
    const docs = buildSuggestedResponse(buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Какие документы нужны для аренды?", firstMessage: null,
      },
    }));
    expect(docs?.intent.key).toBe("documents");

    const deposit = buildSuggestedResponse(buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Какой залог оставлять?", firstMessage: null,
      },
    }));
    expect(deposit?.intent.key).toBe("deposit");
  });

  it("простое приветствие → первое касание", () => {
    const lead = buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Здравствуйте", firstMessage: null,
      },
    });
    expect(buildSuggestedResponse(lead)?.intent.key).toBe("greeting");
  });
});

describe("lead-scripts: контент скрипта", () => {
  it("имя покупателя в приветствии", () => {
    const res = buildSuggestedResponse(buildLead());
    expect(res?.script.startsWith("Здравствуйте, Иван!")).toBe(true);
  });

  it("псевдоним «Покупатель Avito #123» не попадает в текст", () => {
    const res = buildSuggestedResponse(buildLead({ full_name: "Покупатель Avito #123" }));
    expect(res?.script.startsWith("Здравствуйте!")).toBe(true);
    expect(res?.script).not.toContain("Покупатель");
  });

  it("цена объявления с ru-RU форматированием", () => {
    // NBSP-заметка: Intl ru-RU ставит неразрывный пробел (U+00A0/U+202F в
    // зависимости от ICU) между группами разрядов — сравниваем «в плоском»
    // виде без пробелов, чтобы тест не зависел от версии ICU.
    const res = buildSuggestedResponse(buildLead());
    const flat = (s: string) => s.replace(/\s+/g, "");
    expect(flat(res?.script ?? "")).toContain("2500₽");
    expect(flat(res?.short ?? "")).toContain("2500₽");
  });

  it("без цены — скрипт просит даты, а не молчит", () => {
    const res = buildSuggestedResponse(buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Сколько стоит?", firstMessage: null,
      },
    }));
    expect(res?.script).not.toContain("undefined");
    expect(res?.script.toLowerCase()).toContain("даты");
  });

  it("байк из объявления упоминается", () => {
    const res = buildSuggestedResponse(buildLead());
    expect(res?.script).toContain("Kugoo Kirin M4 Pro");
  });

  it("скрипт и короткий вариант непустые и различаются", () => {
    const res = buildSuggestedResponse(buildLead());
    expect(res?.script.length).toBeGreaterThan(50);
    expect(res?.short.length).toBeGreaterThan(10);
    expect(res?.script.length).toBeGreaterThan(res?.short.length ?? 0);
  });

  it("next best action всегда заполнен", () => {
    const res = buildSuggestedResponse(buildLead());
    expect(res?.nextBestAction.length).toBeGreaterThan(20);
  });
});

describe("lead-scripts: быстрые ответы", () => {
  it("непустые, ≤5, без пустых текстов", () => {
    const res = buildSuggestedResponse(buildLead());
    expect(res?.quickReplies.length).toBeGreaterThan(0);
    expect(res?.quickReplies.length).toBeLessThanOrEqual(5);
    for (const qr of res?.quickReplies ?? []) {
      expect(qr.label.length).toBeGreaterThan(0);
      expect(qr.text.length).toBeGreaterThan(10);
    }
  });

  it("универсальный «попросить телефон» присутствует (capture — цель диалога)", () => {
    const res = buildSuggestedResponse(buildLead());
    expect(
      res?.quickReplies.some((qr) => qr.text.includes("номер телефона")),
    ).toBe(true);
  });

  it("чип интента в списке соответствует распознанному интенту", () => {
    const chip = intentChip(buildLead());
    expect(chip).not.toBeNull();
    expect(chip?.emoji.length).toBeGreaterThan(0);
    expect(chip?.label.length).toBeGreaterThan(0);
  });
});

// ── AI-первый: analysis-envelope от внешнего агента ─────────────────────────

describe("lead-scripts: sale и service (реальные линии бизнеса)", () => {
  it("покупка байка → sale-скрипт с фактом официального дилера", () => {
    const res = buildSuggestedResponse(buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Хочу купить этот байк, сколько отдадите?", firstMessage: null,
      },
    }));
    expect(res?.intent.key).toBe("sale");
    expect(res?.script).toContain("официальный дилер 79Bike");
  });

  it("обслуживание своего мотоцикла → service-скрипт с прайсом", () => {
    const res = buildSuggestedResponse(buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Нужна замена масла и диагностика, сколько стоит?", firstMessage: null,
      },
    }));
    expect(res?.intent.key).toBe("service");
    expect(res?.script).toContain("2 000 ₽");
    expect(res?.script).toContain("2 400 ₽");
  });
});

describe("lead-scripts: скрипты используют реальные факты экипажа", () => {
  it("доставка: Нижний Новгород + 500 ₽ (коммерческое предложение)", () => {
    const res = buildSuggestedResponse(buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "А вы сможете привезти байк мне?", firstMessage: null,
      },
    }));
    expect(res?.intent.key).toBe("delivery");
    expect(res?.script).toContain("Нижнему Новгороду");
    expect(res?.script).toContain("500 ₽");
  });

  it("тест-драйв: бесплатный, 10:00–20:00, без обеспечительного платежа", () => {
    const res = buildSuggestedResponse(buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Можно ли покататься перед арендой?", firstMessage: null,
      },
    }));
    expect(res?.intent.key).toBe("test_drive");
    expect(res?.script).toContain("10:00–20:00");
    expect(res?.script.toLowerCase()).toContain("бесплатн");
    expect(res?.script).not.toContain("5 000");
    expect(res?.script).not.toContain("обеспечительны");
  });

  it("экипировка платная: шлем 500/1 000 ₽, перчатки 250–500 ₽ — не бесплатно", () => {
    const res = buildSuggestedResponse(buildLead());
    expect(res?.intent.key).toBe("price");
    expect(res?.script.toLowerCase()).toContain("экипировка");
    expect(res?.script.toLowerCase()).toContain("перчатки");
    const flat = (res?.script ?? "").replace(/\s+/g, "");
    expect(flat).toContain("500₽");
    expect(flat).toContain("1000₽");
    expect(flat).toContain("250–500₽");
    expect(res?.script.toLowerCase()).not.toContain("бесплатно");
  });

  it("залог: возврат за 3 рабочих дня + СТС вместо наличных", () => {
    const res = buildSuggestedResponse(buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Какой залог оставлять?", firstMessage: null,
      },
    }));
    expect(res?.intent.key).toBe("deposit");
    expect(res?.script).toContain("3 рабочих дней");
    expect(res?.script).toContain("СТС");
  });

  it("документы: категории А / В / М / без прав по типам ТС", () => {
    const res = buildSuggestedResponse(buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Какие документы нужны для аренды?", firstMessage: null,
      },
    }));
    expect(res?.intent.key).toBe("documents");
    expect(res?.script).toContain("категория А");
    expect(res?.script).toContain("В или М");
    expect(res?.script).toContain("автомобильные права");
  });
});

describe("lead-scripts: AI-анализ главнее локального детектора", () => {
  it("suggested_reply агента используется дословно, source = ai", () => {
    const lead = buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Здравствуйте, сколько стоит аренда?",
        firstMessage: null,
        analysis: {
          intent: "price",
          confidence: 95,
          suggestedReply: "Здравствуйте! Полный текст от агента про цену и сроки.",
          shortReply: "Короткий текст агента.",
          nextBestAction: "Перезвонить",
          model: "glm-4.6/avito-agent-v1",
        },
      },
    });
    const res = buildSuggestedResponse(lead);
    expect(res?.source).toBe("ai");
    expect(res?.script).toBe("Здравствуйте! Полный текст от агента про цену и сроки.");
    expect(res?.short).toBe("Короткий текст агента.");
    expect(res?.nextBestAction).toBe("Перезвонить");
    expect(res?.aiNotes).toBeNull();
  });

  it("intent агента без текста → наш шаблон под него, source = hybrid", () => {
    const lead = buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Добрый день", firstMessage: null,
        analysis: { intent: "delivery", confidence: 80 },
      },
    });
    const res = buildSuggestedResponse(lead);
    expect(res?.source).toBe("hybrid");
    expect(res?.intent.key).toBe("delivery");
    expect(res?.script).toContain("доставляем");
  });

  it("низкая уверенность (<40) → fallback на локальный детектор", () => {
    const lead = buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Здравствуйте, сколько стоит аренда?",
        firstMessage: null,
        analysis: { intent: "delivery", confidence: 30, suggestedReply: "не должен победить" },
      },
    });
    const res = buildSuggestedResponse(lead);
    expect(res?.source).toBe("rules");
    expect(res?.intent.key).toBe("price");
    expect(res?.script).not.toContain("не должен победить");
  });

  it("невалидный intent агента → fallback на локальный детектор", () => {
    const lead = buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Здравствуйте, сколько стоит аренда?",
        firstMessage: null,
        analysis: { intent: "nonexistent_intent", confidence: 99 },
      },
    });
    const res = buildSuggestedResponse(lead);
    expect(res?.source).toBe("rules");
    expect(res?.intent.key).toBe("price");
  });

  it("intentChip показывает интент агента, а не ключевые слова", () => {
    const lead = buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Здравствуйте, сколько стоит аренда?",
        firstMessage: null,
        analysis: { intent: "deposit", confidence: 90 },
      },
    });
    const chip = intentChip(lead);
    expect(chip?.label).toBe("Про залог");
  });

  it("notes агента доезжают до оператора", () => {
    const lead = buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Здравствуйте, сколько стоит аренда?",
        firstMessage: null,
        analysis: { intent: "price", suggestedReply: "Текст", notes: "Сравнивает с конкурентом" },
      },
    });
    const res = buildSuggestedResponse(lead);
    expect(res?.aiNotes).toBe("Сравнивает с конкурентом");
  });
});
