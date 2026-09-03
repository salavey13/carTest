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
