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
  matchBikeTariff,
  parseDurationDays,
  parseDurationHours,
  scoreIntents,
  tariffDailyRate,
  tierDailyRate,
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

describe("lead-scripts: мгновенный расчёт по сроку (Straight Line)", () => {
  const flat = (s: string) => s.replace(/\s+/g, "");

  it("«на 3 месяца» → long_term + расчёт по тарифу 11–30 дней (ставка 12 000 ₽)", () => {
    const res = buildSuggestedResponse(buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Хочу взять байк на 3 месяца, сколько выйдет?",
        firstMessage: null,
        itemPrice: 12000,
      },
    }));
    expect(res?.intent.key).toBe("long_term");
    expect(res?.source).toBe("rules");
    const f = flat(res?.script ?? "");
    expect(f).toContain("8000₽");    // 12 000 × 0.67 → 8 000 ₽/сутки
    expect(f).toContain("240000₽");  // около 240 000 ₽ в месяц
    expect(f).toContain("720000₽");  // 90 дней → ~720 000 ₽
    expect(res?.script).toContain("3 месяца");
  });

  it("«на 2 недели» → 14 дней попадает в тариф 11–30 дней: 12 000 × 0.67 = 8 000 ₽ × 14 = 112 000 ₽", () => {
    const res = buildSuggestedResponse(buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "А есть смысл брать на 2 недели?", firstMessage: null,
        itemPrice: 12000,
      },
    }));
    expect(res?.intent.key).toBe("long_term");
    const f = flat(res?.script ?? "");
    expect(f).toContain("8000₽");
    expect(f).toContain("112000₽");
  });

  it("«свободен на выходные?» → availability с расчётом 2 дней сразу", () => {
    const res = buildSuggestedResponse(buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Свободен на выходные?", firstMessage: null,
        itemPrice: 12000,
      },
    }));
    expect(res?.intent.key).toBe("availability");
    const f = flat(res?.script ?? "");
    expect(f).toContain("20400₽"); // 12 000 × 0.85 = 10 200 × 2 дня
  });

  it("tierDailyRate: границы тарифных слоёв (1 / 2 / 5 / 11 дней)", () => {
    expect(tierDailyRate(1, 10000)).toBe(10000);
    expect(tierDailyRate(2, 10000)).toBe(8500);
    expect(tierDailyRate(5, 10000)).toBe(7500);
    expect(tierDailyRate(11, 10000)).toBe(6700);
  });

  it("parseDurationDays: спец-случаи, множители и null", () => {
    expect(parseDurationDays("можно на выходные")?.days).toBe(2);
    expect(parseDurationDays("на сутки")?.days).toBe(1);
    expect(parseDurationDays("свободно на завтра?")?.days).toBe(1);
    expect(parseDurationDays("на месяц")?.days).toBe(30);
    expect(parseDurationDays("на 3 месяца")?.days).toBe(90);
    expect(parseDurationDays("на 2 недели")?.days).toBe(14);
    expect(parseDurationDays("пять дней")?.days).toBe(5);
    expect(parseDurationDays("на полгода")?.days).toBe(180);
    expect(parseDurationDays("на лето")?.days).toBe(90);
    expect(parseDurationDays("сколько стоит?")).toBeNull();
    expect(parseDurationDays("")).toBeNull();
  });

  it("без цены расчёта нет — но срок всё равно признаётся текстом", () => {
    const res = buildSuggestedResponse(buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Хочу на 3 месяца", firstMessage: null,
      },
    }));
    expect(res?.intent.key).toBe("long_term");
    expect(res?.script).toContain("3 месяца");
    expect(res?.script).not.toContain("undefined");
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

// ── Тарифы парка: bikeTitle → модель CSV → точные ставки ────────────────────

describe("lead-scripts: matchBikeTariff (bikeTitle → модель CSV)", () => {
  it("прямые совпадения: с брендом, без бренда, в нижнем регистре", () => {
    expect(matchBikeTariff("79BIKE Falcon GT")?.id).toBe("falcon-gt-2026");
    expect(matchBikeTariff("79bike Falcon GT 2026")?.id).toBe("falcon-gt-2026");
    expect(matchBikeTariff("Falcon Pro")?.id).toBe("falcon-pro-2026");
    expect(matchBikeTariff("79bike Falcon PRO")?.id).toBe("falcon-pro-2026");
    expect(matchBikeTariff("Yamaha R7")?.id).toBe("yamaha-r7");
    expect(matchBikeTariff("BMW F800R")?.id).toBe("bmw-f800r");
  });

  it("алиасы из скобок и плюсы в названиях", () => {
    expect(matchBikeTariff("Kawasaki Ninja 650")?.id).toBe("kawasaki-ex650k");
    expect(matchBikeTariff("Ninja 650")?.id).toBe("kawasaki-ex650k");
    expect(matchBikeTariff("Rerode R1+")?.id).toBe("rerode-r1-plus");
  });

  it("цветовые варианты Ducati: самый специфичный побеждает", () => {
    expect(matchBikeTariff("Ducati Panigale S Electro Black Aero")?.id).toBe(
      "ducati-panigale-s-electro-black-aero",
    );
    // В CSV модель «Panigale S Electro Black» — это вариант black-chain;
    // «Black Z» (id …-black) не матчится без «Z» в заголовке.
    expect(matchBikeTariff("Ducati Panigale S Electro Black")?.id).toBe(
      "ducati-panigale-s-electro-black-chain",
    );
  });

  it("неизвестная модель → null (медианные оценки)", () => {
    expect(matchBikeTariff("Kugoo Kirin M4 Pro")).toBeNull();
    expect(matchBikeTariff("Электровелосипед кросс")).toBeNull();
    expect(matchBikeTariff(null)).toBeNull();
    expect(matchBikeTariff("")).toBeNull();
  });
});

describe("lead-scripts: точные ставки модели в скриптах (Straight Line)", () => {
  const flat = (s: string) => s.replace(/\s+/g, "");

  it("«на 3 месяца» Falcon GT → точный тариф 11–30 дней 7 000 ₽ (не медиана 8 000)", () => {
    const res = buildSuggestedResponse(buildLead({
      bikeTitle: "79BIKE Falcon GT",
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Здравствуйте, а на 3 месяца можно взять?", firstMessage: null,
        itemPrice: 12000,
      },
    }));
    expect(res?.intent.key).toBe("long_term");
    const f = flat(res?.script ?? "");
    expect(f).toContain("7000₽");     // rent_11_30d = 7 000 (медиана была бы 8 000)
    expect(f).toContain("210000₽");   // месяц
    expect(f).toContain("630000₽");   // 90 дней
    expect(f).not.toContain("8000₽"); // медиана не должна просачиваться
    // Точный залог модели вместо вилки.
    expect(f).toContain("15000₽");
    // Электро → только лимит 150 км/сутки, без «на бензине».
    expect(res?.script).toContain("150 км/сутки");
    expect(res?.script).not.toContain("200 км/сутки");
  });

  it("«на выходные» с моделью → тариф выходных (Falcon GT 14 000 × 2 = 28 000)", () => {
    const res = buildSuggestedResponse(buildLead({
      bikeTitle: "79BIKE Falcon GT",
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Свободен на выходные?", firstMessage: null,
        itemPrice: 12000,
      },
    }));
    expect(res?.intent.key).toBe("availability");
    const f = flat(res?.script ?? "");
    expect(f).toContain("28000₽");
    expect(f).toContain("14000₽");
    expect(res?.script).toContain("тариф выходных");
  });

  it("tariffDailyRate: слои по CSV и тариф выходных", () => {
    const gt = matchBikeTariff("79BIKE Falcon GT");
    expect(gt).not.toBeNull();
    expect(tariffDailyRate(1, gt!)).toBe(12000);          // будни
    expect(tariffDailyRate(1, gt!, true)).toBe(14000);    // выходные
    expect(tariffDailyRate(2, gt!)).toBe(10000);          // rent_2_4d
    expect(tariffDailyRate(7, gt!)).toBe(8000);           // rent_5_10d
    expect(tariffDailyRate(14, gt!)).toBe(7000);          // 11–30d (14 дней тут)
    expect(tariffDailyRate(90, gt!)).toBe(7000);          // >30 дней → максимум слоя
  });

  it("тариф выходных применяется к паре дней «на выходные» (rent_weekend ≥ слоя 2–4д)", () => {
    const gt = matchBikeTariff("79BIKE Falcon GT");
    expect(tariffDailyRate(2, gt!, true)).toBe(14000); // выходные, не 10 000 из слоя 2–4д
    expect(tariffDailyRate(2, gt!, false)).toBe(10000); // будни → слой 2–4д
  });

  it("залог по конкретной модели (Yamaha R7 → 20 000 ₽), без вилки", () => {
    const res = buildSuggestedResponse(buildLead({
      bikeTitle: "Yamaha R7",
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Какой залог оставлять?", firstMessage: null,
        itemPrice: 10000,
      },
    }));
    expect(res?.intent.key).toBe("deposit");
    expect(flat(res?.script ?? "")).toContain("20000₽");
    expect(res?.script).toContain("Yamaha R7");
    expect(res?.script).not.toContain("от 10 000 ₽ на лёгких");
    expect(flat(res?.short ?? "")).toContain("20000₽");
  });

  it("права на электроэндуро: персональное «права НЕ нужны» под модель", () => {
    const res = buildSuggestedResponse(buildLead({
      bikeTitle: "79BIKE Falcon GT",
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "У меня только категория B, подойдёт?", firstMessage: null,
        itemPrice: 12000,
      },
    }));
    expect(res?.intent.key).toBe("documents");
    expect(res?.script).toContain("права НЕ нужны");
    expect(res?.script).toContain("49 см³");
    expect(res?.short).toContain("только паспорт");
  });
});

// ── Почасовые пакеты (1ч / 3ч / 6ч / 12ч) ───────────────────────────────────

describe("lead-scripts: почасовые пакеты", () => {
  const flat = (s: string) => s.replace(/\s+/g, "");

  it("parseDurationHours: числа, инверсия, полдня, весь день, null-кейсы", () => {
    expect(parseDurationHours("нужно на 3 часа")?.hours).toBe(3);
    expect(parseDurationHours("А почасово можно? Нужно часа на 3")?.hours).toBe(3);
    expect(parseDurationHours("пару часов")?.hours).toBe(2);
    expect(parseDurationHours("на полдня")?.hours).toBe(6);
    expect(parseDurationHours("возьму на весь день")?.hours).toBe(12);
    expect(parseDurationHours("на 12 часов")?.hours).toBe(12);
    expect(parseDurationHours("можно почасово?")?.hours).toBeNull();
    expect(parseDurationHours("на часок")?.hours).toBe(1);
    expect(parseDurationHours("на час")?.hours).toBe(1);
    expect(parseDurationHours("сколько стоит?")).toBeNull();
    expect(parseDurationHours("")).toBeNull();
  });

  it("«почасово можно? нужно часа на 3» → price + точный пакет 3 часа (Falcon Pro 7 000 ₽)", () => {
    const res = buildSuggestedResponse(buildLead({
      bikeTitle: "79BIKE Falcon Pro",
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "А почасово можно? Нужно часа на 3", firstMessage: null,
        itemPrice: 10000,
      },
    }));
    expect(res?.intent.key).toBe("price");
    const f = flat(res?.script ?? "");
    // Прицельный расчёт под названные часы.
    expect(f).toContain("На3часа—пакет«3часа»,7000₽");
    // Точный день + тариф выходных модели.
    expect(f).toContain("10000₽всутки");
    expect(f).toContain("ввыходные12000₽");
    // CTA под часы, а не под даты.
    expect(res?.script).toContain("На какое время нужен байк?");
    expect(flat(res?.short ?? "")).toContain("пакет«3часа»,7000₽");
  });

  it("«можно почасово арендовать?» → price с блоком пакетов (не availability)", () => {
    const res = buildSuggestedResponse(buildLead({
      bikeTitle: "Ducati 1199 Panigale",
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Можно почасово арендовать?", firstMessage: null,
        itemPrice: 18000,
      },
    }));
    expect(res?.intent.key).toBe("price");
    const f = flat(res?.script ?? "");
    expect(f).toContain("1час—7200₽");
    expect(f).toContain("3часа—9000₽");
    expect(f).toContain("6часов—13000₽");
    expect(f).toContain("12часов—16200₽");
  });

  it("оценка пакетов без модели: 3ч = 0.7 × сутки, 1ч = сутки/8", () => {
    const res = buildSuggestedResponse(buildLead({
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Можно почасово?", firstMessage: null,
        itemPrice: 10000,
      },
    }));
    expect(res?.intent.key).toBe("price");
    const f = flat(res?.script ?? "");
    expect(f).toContain("1час—1300₽");   // 10 000 / 8 = 1250 → округление до 100
    expect(f).toContain("3часа—7000₽");  // 10 000 × 0.7
    expect(f).toContain("12часов—9000₽"); // 10 000 × 0.9
    // Избыточного хвоста «Почасово тоже даём» рядом с блоком пакетов нет.
    expect(f).not.toContain("Почасовотожедаём");
  });
});

// ── Регрессии самообучения (прогон 1 → правки → прогон 2) ──────────────────

describe("lead-scripts: регрессии самообучения", () => {
  it("«дорого, лучше у частника» → discount (а не price из-за «час» внутри «частника»)", () => {
    const lead = buildLead({
      bikeTitle: "BMW F800R",
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Дорого. За эти деньги лучше у частника возьму", firstMessage: null,
        itemPrice: 10000,
      },
    });
    const res = buildSuggestedResponse(lead);
    expect(res?.intent.key).toBe("discount");
    // Точные слои F800R из CSV (медианы давали 8 500 / 7 500 / 6 700).
    const f = (res?.script ?? "").replace(/\s+/g, "");
    expect(f).toContain("9000₽");
    expect(f).toContain("7000₽");
    // Никакого «На час» из ложного парсинга «частника».
    expect(res?.script).not.toContain("На час —");
  });

  it("«хочу такой же купить, сколько стоит?» → sale при равном счёте с price", () => {
    const lead = buildLead({
      bikeTitle: "LiveWire ONE",
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Хочу такой же купить, сколько стоит?", firstMessage: null,
        itemPrice: 20000,
      },
    });
    expect(scoreIntents(lead)[0]?.key).toBe("sale");
    const res = buildSuggestedResponse(lead);
    expect(res?.intent.key).toBe("sale");
    expect(res?.script).toContain("официальный дилер 79Bike");
    // Падеж: «в Нижнем Новгороде», не «в Нижний Новгород».
    expect(res?.script).toContain("в Нижнем Новгороде");
    expect(res?.script).not.toContain("в Нижний Новгород");
  });

  it("price-скрипт не дублирует слои скидок, когда цифры уже в строке модели", () => {
    const res = buildSuggestedResponse(buildLead({
      bikeTitle: "LiveWire ONE",
      avito: {
        chatId: "c", itemUrl: null, profileUrl: null, itemId: null,
        lastMessage: "Сколько стоит аренда?", firstMessage: null,
        itemPrice: 20000,
      },
    }));
    expect(res?.intent.key).toBe("price");
    const occurrences = (res?.script.match(/2–4 дня/g) ?? []).length;
    expect(occurrences).toBe(1);
  });
});
