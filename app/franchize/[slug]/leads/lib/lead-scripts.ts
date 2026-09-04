// /app/franchize/[slug]/leads/lib/lead-scripts.ts
//
// ГОТОВЫЙ ОТВЕТ (Suggested Response) — скриптовый движок для авито-лидов.
// =============================================================================
//
// Каждый лид, пришедший из Авито (webhook / bot_forward), несёт в metadata
// текст покупателя (firstMessage / lastMessage), объявление (bikeTitle,
// itemPrice) и счётчик сообщений. На их основе ДИАГНОСТИРУЕМ интент вопроса
// и выдаём оператору ПОЛНЫЙ готовый текст ответа — не «шаблон с пропусками»,
// а откалиброванный скрипт продажи, который можно копировать в чат Авито
// одним нажатием.
//
// ИСТОЧНИК ФАКТОВ (не выдумка — реальные условия экипажа VIP BIKE):
//   • public/docs/autoreply/vip-bike-rent.csv    — флот 27 байков, прайс
//     почасово/3ч/6ч/12ч, будни/выходные, слои 2–4д/5–10д/11–30д (реальные
//     скидки за срок: медианно −15% / −25…30% / −33…40%), залоги 10–50 тыс.;
//   • docs/crewDocs/vip-bike_COMMERCIAL_PROPOSAL_TEMPLATE.html — залог
//     возвращается за 3 рабочих дня, залог СТС вместо наличных, лимиты
//     пробега 150/200 км/сутки, доставка по Нижнему Новгороду 500 ₽;
//     ПРАВКА БОССА (2026-09-04): шлем и перчатки НЕ бесплатные — шлем
//     500 ₽ к почасовой аренде / 1 000 ₽ за сутки, перчатки 250–500 ₽;
//   • docs/crewDocs/vip-bike_TESTDRIVE_DEAL_TEMPLATE.html — тест-драйв
//     бесплатный (по записи), шоурум в Н. Новгороде;
//   • docs/gold-standard-electro-bike-spec-schema.md — категории прав по
//     типам ТС (А — бензин, В/М — дорожное электро, без прав — эндуро);
//   • docs/crewDocs/vip-bike-sale.csv — официальный дилер 79Bike, гарантия;
//   • docs/crewDocs/vip-bike-service-items.csv — мотосервис (прайс работ).
//
// Практики колл-центров, заложенные в движок:
//   1. Скрипт под интент, а не «универсальное здравствуйте».
//   2. Next Best Action (NBA) — «что делать после ответа».
//   3. Quick Replies — быстрые однострочники под типовые микро-вопросы.
//   4. Отработка возражений: «дорого» → ценность → альтернатива, не скидка.
//   5. Скорость: раздел разворачивается в шторке РЯДОМ с кнопкой
//      «Открыть чат Авито» — «прочитал → скопировал → вставил» за секунды.
//   6. ПРАВКА БОССА (2026-09-04, Straight Line): цифра — сразу. Срок из
//      сообщения («3 месяца», «2 недели», «на выходные») парсится в дни →
//      ставка по тарифному слою из rent-CSV → сумма в первом же ответе,
//      без «приезжайте — обсудим».
//
// AI-ПЕРВЫЙ (не хардкод): если внешний AI-агент (см.
// public/docs/autoreply/vip-bike-avito-agent-prompt.md) приложил к webhook'у
// analysis-envelope, ДВИЖОК ПРЕДПОЧИТАЕТ ЕГО:
//     analysis.suggestedReply            → source "ai"      (текст агента)
//     analysis.intent + наш шаблон       → source "hybrid"  (AI классифицировал)
//     иначе локальный keyword-детектор   → source "rules"   (fallback)
// Так скрипты не «застывают»: агент живёт отдельно, библиотека — страховка.
//
// ── ТЕКСТЫ СКРИПТОВ ── бизнес-фразы вынесены в константы ниже; правьте
// их под реальные условия экипажа — вся библиотека живёт в этом файле.

import type { LeadRow } from "../leads-types";

// ── Бизнес-константы VIP BIKE (едины для всех скриптов) ─────────────────────
const BRAND = "VIP BIKE";
const CITY = "Нижний Новгород";
const WORK_HOURS = "ежедневно 10:00–20:00";
/** Telegram Mini App для самостоятельного бронирования. */
const BOOKING_LINK = "t.me/oneBikePlsBot";
/** Мастер сервиса (прайс услуг — docs/crewDocs/vip-bike-service-items.csv). */
const SERVICE_CONTACT = "t.me/I_O_S_NN";
const DEPOSIT_PHRASE =
  "залог зависит от модели — от 10 000 ₽ на лёгких байках до 50 000 ₽ на флагманах (на большинстве 15–20 тысяч). Возвращаем в течение 3 рабочих дней после возврата байка. Вместо наличных можно оставить залог СТС — свидетельства о регистрации";
const DOCS_PHRASE =
  "из документов — паспорт и права. По категориям просто: бензиновые мотоциклы — категория А; дорожные электро — достаточно В или М; на электроэндуро (класс М, 49 см³) подойдут даже автомобильные права, регистрация и страховка не нужны";
const INCLUDED_PHRASE =
  "в стоимость входит техосмотр перед выездом, лимит пробега 150 км/сутки на электро и 200 км/сутки на бензине";
/** ПРАВКА БОССА: экипировка НЕ входит в цену — только за доплату. */
const GEAR_PHRASE =
  "экипировка — за отдельную плату: шлем 500 ₽ при почасовой аренде и 1 000 ₽ за сутки, перчатки 250–500 ₽";
const DELIVERY_PHRASE = `доставка по Нижнему Новгороду — 500 ₽, за город — по договорённости`;
/** ПРАВКА БОССА: тест-драйв бесплатный — без обеспечительных платежей. */
const TESTDRIVE_PHRASE =
  "бесплатный, по записи — приезжайте, покатайтесь и решите уже на месте. С собой паспорт и права";
const PRICE_TIERS_PHRASE =
  "чем дольше срок, тем ниже цена суток: 2–4 дня — минус ~15%, 5–10 дней — минус ~25%, 11–30 дней — минус ~33%. Даём байки и почасово — от 1 часа";
const SALE_PHRASE =
  "мы — официальный дилер 79Bike: гарантия на раму, мотор и батарею, собственный мотосервис и запчасти всегда в наличии";

// ── Типы ────────────────────────────────────────────────────────────────────

export type ScriptIntentKey =
  | "availability"
  | "price"
  | "deposit"
  | "documents"
  | "delivery"
  | "discount"
  | "test_drive"
  | "sale"
  | "service"
  | "long_term"
  | "greeting"
  | "generic";

export interface ScriptIntentMeta {
  key: ScriptIntentKey;
  /** Человекочитаемая метка для плашки в UI. */
  label: string;
  emoji: string;
}

export const INTENT_META: Record<ScriptIntentKey, ScriptIntentMeta> = {
  availability: { key: "availability", label: "Наличие и бронь", emoji: "📅" },
  price: { key: "price", label: "Вопрос о цене", emoji: "💰" },
  deposit: { key: "deposit", label: "Про залог", emoji: "🛡" },
  documents: { key: "documents", label: "Документы и права", emoji: "📄" },
  delivery: { key: "delivery", label: "Доставка", emoji: "🚚" },
  discount: { key: "discount", label: "Возражение: дорого", emoji: "🤝" },
  test_drive: { key: "test_drive", label: "Тест-драйв", emoji: "👀" },
  sale: { key: "sale", label: "Покупка байка", emoji: "🏷" },
  service: { key: "service", label: "Мотосервис", emoji: "🔧" },
  long_term: { key: "long_term", label: "Длительная аренда", emoji: "📆" },
  greeting: { key: "greeting", label: "Первое касание", emoji: "👋" },
  generic: { key: "generic", label: "Общий скрипт", emoji: "🎯" },
};

/** Однострочник быстрого ответа. */
export interface QuickReply {
  label: string;
  text: string;
}

/** Откуда взят ответ — для плашки в шторке. */
export type SuggestedSource = "ai" | "hybrid" | "rules";

export interface SuggestedResponse {
  /** Распознанный интент (плашка в UI). */
  intent: ScriptIntentMeta;
  /** Полный скрипт ответа — копируется одной кнопкой. */
  script: string;
  /** Короткий вариант — одна-две строки для быстрой реакции. */
  short: string;
  /** Next Best Action — подсказка колл-центра «что после ответа». */
  nextBestAction: string;
  /** Быстрые однострочники: сначала под интент, затем универсальные. */
  quickReplies: QuickReply[];
  /** Сработавшие ключевые слова (для title-подсказки оператору). */
  matched: string[];
  /** Источник: ai — текст AI-агента, hybrid — его интент + наш шаблон, rules — локальный детектор. */
  source: SuggestedSource;
  /** Заметка AI-агента для оператора (если передана). */
  aiNotes?: string | null;
}

// ── Словарь интентов: стемы-ключевые слова (lowercase, ё→е) ────────────────
// Порядок массива = приоритет при равном счёте: наличие/бронь — самая
// «горячая» формулировка, общее приветствие — самая холодная.
const INTENT_KEYWORDS: ReadonlyArray<{
  key: ScriptIntentKey;
  words: readonly string[];
}> = [
  {
    key: "availability",
    words: [
      "свободен", "свободно", "свободны", "в наличии", "наличие",
      "актуальн", "доступен", "забронир", "бронь", "забрать",
      "арендовать", "еще есть", "ещё есть", "на сегодня", "на завтра",
      "на выходные", "в эти выходные", "когда можно",
    ],
  },
  {
    key: "price",
    words: [
      "цен", "сколько стоит", "скольк стоит", "стоимость", "почем", "почём",
      "прайс", "тариф", "расценк", "за сутки", "в сутки", "за день", "в день",
      "сколько обойд", "сколько будет стоить", "цена?",
    ],
  },
  {
    key: "deposit",
    words: ["залог", "залогова", "депозит", "заклад"],
  },
  {
    key: "documents",
    words: [
      "документ", "права нужны", "нужны ли права", "какие права", "паспорт",
      "удостоверение", "справка", "без прав", "категория",
    ],
  },
  {
    key: "delivery",
    words: [
      "достав", "привез", "привезё", "привезе", "до дома", "до подъезда",
      "адрес можете", "можно ли к нам", "подъезд",
    ],
  },
  {
    key: "discount",
    words: [
      "скидк", "дешевле", "подешевле", "дорого", "дороговато", "акция",
      "торг", "уступите", "снизите", "меньше за",
    ],
  },
  {
    key: "test_drive",
    words: [
      "тест", "покататься", "пробн", "попробова", "осмотреть",
      "можно глянуть", "где находитес", "как проехать", "посмотреть вживую",
      "показать байк",
    ],
  },
  {
    key: "sale",
    words: [
      "купить", "куплю", "продаё", "продаж", "приобрести", "в собственность",
      "цена покупки", "новый байк купить",
    ],
  },
  {
    key: "service",
    words: [
      "ремонт", "обслужива", "шиномонтаж", "диагностик", "заменить масло",
      "замена масла", "цепь натянуть", "подготовить байк к сезону", "сервис",
    ],
  },
  {
    key: "long_term",
    words: [
      "месяц", "недел", "полгода",
      "долгосроч", "длительн", "посуточно", "надолго", "на лето", "на сезон", "помесячн",
    ],
  },
  {
    key: "greeting",
    words: [
      "здравству", "добрый день", "добрый вечер", "доброе утро",
      "привет", "hello",
    ],
  },
];

// ── Быстрые ответы ──────────────────────────────────────────────────────────

/** Универсальные однострочники (добавляются в конец каждого набора). */
const UNIVERSAL_QUICK_REPLIES: readonly QuickReply[] = [
  {
    label: "📞 Попросить телефон",
    text: "Оставьте, пожалуйста, номер телефона — перезвоню за пару минут, отвечу на все вопросы и оформлю бронь.",
  },
  {
    label: "📍 Шоурум",
    text: `Работаем ${WORK_HOURS}, шоурум в ${CITY}. Приезжайте — покажем байки вживую и оформим аренду за 10 минут.`,
  },
  {
    label: "📄 Документы",
    text: `${DOCS_PHRASE.charAt(0).toUpperCase()}${DOCS_PHRASE.slice(1)}. Нужны только даты — остальное сделаем сами.`,
  },
];

const INTENT_QUICK_REPLIES: Record<ScriptIntentKey, readonly QuickReply[]> = {
  availability: [
    {
      label: "🗓 Зафиксировать даты",
      text: "Напишите даты, когда планируете кататься, — сразу проверю и зафиксирую бронь за вами.",
    },
    {
      label: "📲 Бронь в Telegram",
      text: `Забронировать можно и самостоятельно — вот наш Telegram с каталогом: ${BOOKING_LINK}. Или оставьте телефон, оформлю за вас.`,
    },
  ],
  price: [
    {
      label: "📉 Прайс по срокам",
      text: `${PRICE_TIERS_PHRASE.charAt(0).toUpperCase()}${PRICE_TIERS_PHRASE.slice(1)}. Напишите срок — пришлю точную стоимость.`,
    },
    {
      label: "💸 Цена + ценность",
      text: "Техосмотр и лимит пробега уже в цене. Шлем при желании — 500 ₽ (почасово) или 1 000 ₽ за сутки, перчатки — 250–500 ₽.",
    },
  ],
  deposit: [
    {
      label: "🛡 Залог вернём",
      text: "Залог возвращаем в течение 3 рабочих дней после возврата байка — это стандартная страховка, не доплата.",
    },
    {
      label: "🚙 Залог СТС",
      text: "Наличные можно не готовить: допускаем залог СТС (свидетельства о регистрации) вместо денежного депозита.",
    },
  ],
  documents: [
    {
      label: "🪪 Категории прав",
      text: "Бензин — категория А; дорожные электро — В или М; на электроэндуро (класс М, 49 см³) права не нужны вовсе.",
    },
    {
      label: "📄 Без прав",
      text: "Если прав нет — есть модели, которые можно арендовать без них. Подскажу варианты.",
    },
  ],
  delivery: [
    {
      label: "🚚 Посчитать доставку",
      text: `Доставка по ${CITY} — 500 ₽, за город — по договорённости. Напишите адрес, согласуем время.`,
    },
  ],
  discount: [
    {
      label: "🤝 Ценность, не скидка",
      text: "Техосмотр, лимит пробега и подменный байк на форс-мажор уже в цене, залог можно оставить СТС. Плюс срок снижает цену суток.",
    },
    {
      label: "🔁 Альтернатива дешевле",
      text: "Есть модели от 4–6 тысяч в сутки (питбайк, электроэндуро попроще, скутер) — напишите бюджет и даты, подберу.",
    },
  ],
  test_drive: [
    {
      label: "👀 Записать на тест",
      text: `Тест-драйв бесплатный, по записи. Работаем ${WORK_HOURS}.`,
    },
    {
      label: "🪪 Что с собой",
      text: "Возьмите паспорт и права — этого достаточно, участие бесплатное.",
    },
  ],
  sale: [
    {
      label: "🏷 Гарантия дилера",
      text: `${SALE_PHRASE.charAt(0).toUpperCase()}${SALE_PHRASE.slice(1)}.`,
    },
    {
      label: "👀 Тест перед покупкой",
      text: "Перед покупкой обязательно прокатитесь — тест-драйв бесплатный, приезжайте в шоурум.",
    },
  ],
  service: [
    {
      label: "🔧 Записаться",
      text: `Опишите, что с байком, — назову работы и запишу на удобное время (${WORK_HOURS}).`,
    },
    {
      label: "👨‍🔧 Мастер напрямую",
      text: `Можно написать мастеру напрямую: ${SERVICE_CONTACT}`,
    },
  ],
  long_term: [
    {
      label: "📆 Тарифы от 11 дней",
      text: `От 11 дней цена суток минус ~33%, от 2–4 дней — минус ~15%. Напишите даты — посчитаю итог и зафиксирую ставку за вами.`,
    },
    {
      label: "🧮 Расчёт на мой срок",
      text: "Напишите даты начала и конца — пришлю расчёт по тарифу длительной аренды и зафиксирую байк за вами.",
    },
  ],
  greeting: [
    {
      label: "🎯 Два вопроса",
      text: "Подскажите, на какие даты нужен байк и для каких задач (город / лес / трасса), — подберу вариант и посчитаю цену.",
    },
  ],
  generic: [
    {
      label: "🎯 Даты",
      text: "Напишите удобные даты — проверю наличие и пришлю точную цену с условиями.",
    },
  ],
};

// ── Хелперы ─────────────────────────────────────────────────────────────────

/** Нормализация текста для поиска: lowercase + ё→е. */
function norm(text: string): string {
  return text.toLowerCase().replace(/ё/g, "е");
}

/** Имя покупателя для персонализации, или null (псевдоним «Покупатель Avito #…»). */
function buyerFirstName(lead: LeadRow): string | null {
  const raw = (lead.full_name || "").trim();
  if (!raw || /^покупатель/i.test(raw)) return null;
  const first = raw.split(/\s+/)[0]?.replace(/[^\p{L}\-]/gu, "") ?? "";
  if (first.length < 2 || first.length > 24) return null;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function fmtPrice(price: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(price))} ₽`;
}

/** Абзац с заглавной буквы (для вставки констант в середину предложений). */
function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Канал авито? Дублирует isAvitoLead() из leads-utils (та .tsx-цепочка тянет
 * React-импорты) — тут лёгкая локальная копия тех же трёх проверок.
 */
function isAvitoLeadLike(lead: LeadRow): boolean {
  return (
    lead.contactChannel === "avito" ||
    !!lead.avito?.chatId ||
    lead.user_id.startsWith("avito:")
  );
}

/** Склеивание абзацев: пустые строки выкидываются. */
function joinParas(...paras: Array<string | null | undefined>): string {
  return paras.map((p) => (p || "").trim()).filter(Boolean).join("\n\n");
}

// ── Мгновенный расчёт цены по сроку (Straight Line: цифра — сразу) ─────────
// Тарифные слои — медианы по всему парку из public/docs/autoreply/vip-bike-
// rent.csv (27 моделей, поля rent_2_4d / rent_5_10d / rent_11_30d, см.
// docs/gold-standard-electro-bike-spec-schema.md): ставка суток 2–4 суток
// = 0.85 от цены суток, 5–10 суток = 0.75, 11–30 суток = 0.67. Цена
// объявления (itemPrice) = суточная ставка будней — считаем от неё.
const TIER_RATIO_2_4_DAYS = 0.85;
const TIER_RATIO_5_10_DAYS = 0.75;
const TIER_RATIO_11_30_DAYS = 0.67;

/** Ставка суток в тарифном слое под срок (округление до 100 ₽). */
export function tierDailyRate(days: number, listingPrice: number): number {
  const ratio =
    days >= 11
      ? TIER_RATIO_11_30_DAYS
      : days >= 5
        ? TIER_RATIO_5_10_DAYS
        : days >= 2
          ? TIER_RATIO_2_4_DAYS
          : 1;
  return Math.round((listingPrice * ratio) / 100) * 100;
}

/** Строка «2–4 дня — по X ₽, 5–10 дней — по Y ₽, 11–30 дней — по Z ₽ за сутки». */
function tierLineFor(listingPrice: number): string {
  return `2–4 дня — по ${fmtPrice(tierDailyRate(2, listingPrice))}, 5–10 дней — по ${fmtPrice(
    tierDailyRate(7, listingPrice),
  )}, 11–30 дней — по ${fmtPrice(tierDailyRate(30, listingPrice))} за сутки`;
}

/** Срок аренды, распознанный из текста покупателя. */
export interface DurationHint {
  days: number;
  /** Человекочитаемая метка для вставки в ответ («3 месяца», «выходные»). */
  label: string;
}

const DURATION_NUM_WORDS: Record<string, number> = {
  "один": 1, "одну": 1, "одна": 1, "одни": 1,
  "два": 2, "две": 2, "пара": 2,
  "три": 3, "четыре": 4, "пять": 5, "шесть": 6,
  "семь": 7, "восемь": 8, "девять": 9, "десять": 10,
};

function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/**
 * Срок аренды из текста («на 3 месяца», «2 недели», «на выходные»,
 * «полгода», «на сутки»…) → дни. null — срок не назван.
 */
export function parseDurationDays(rawText: string): DurationHint | null {
  const text = norm(rawText);
  if (!text) return null;

  // Спец-случаи (порядок важен).
  if (text.includes("полгода")) return { days: 180, label: "полгода" };
  if (text.includes("выходн")) return { days: 2, label: "выходные" };
  if (/(на лето|на сезон|сезон)/.test(text)) return { days: 90, label: "сезон (~3 месяца)" };
  if (/сутки|завтра|сегодня|на день/.test(text)) return { days: 1, label: "сутки" };

  // «N дней / N недели / N месяца» — числом или словом.
  const m = text.match(
    /(одну|один|одна|одни|две|два|пара|три|четыре|пять|шесть|семь|восемь|девять|десять|\d{1,3})\s*(дн|недел|месяц)/,
  );
  if (m) {
    const n = /^\d/.test(m[1]) ? parseInt(m[1], 10) : DURATION_NUM_WORDS[m[1]] ?? 0;
    if (n > 0) {
      if (m[2].startsWith("дн")) {
        const days = Math.max(1, n);
        return { days, label: `${n} ${pluralRu(days, "день", "дня", "дней")}` };
      }
      if (m[2].startsWith("недел")) {
        const days = Math.max(2, n * 7);
        return { days, label: `${n} ${pluralRu(n, "неделю", "недели", "недель")}` };
      }
      const days = Math.max(2, n * 30);
      return { days, label: `${n} ${pluralRu(n, "месяц", "месяца", "месяцев")}` };
    }
  }

  // Единица без числа: «на месяц», «на неделю».
  if (text.includes("месяц")) return { days: 30, label: "месяц" };
  if (text.includes("недел")) return { days: 7, label: "неделя" };
  return null;
}

/**
 * Фраза-расчёт для вставки в ответ: ставка по тарифному слою + итог за срок.
 * Для сроков больше 30 дней — ещё и сумма за месяц (вопрос «на 3 месяца?»
 * получает конкретную цифру ПЕРВЫМ же ответом, а не «приезжайте — обсудим»).
 */
function durationEstimateLine(days: number, label: string, listingPrice: number): string {
  const rate = tierDailyRate(days, listingPrice);
  const total = rate * days;
  if (days < 2) return `на ${label} — ${fmtPrice(rate)}`;
  if (days > 30) {
    return `на ${label} — ставка длительной аренды, примерно ${fmtPrice(rate)} в сутки: это около ${fmtPrice(
      rate * 30,
    )} в месяц, за весь срок — примерно ${fmtPrice(total)}. И это не потолок: под такой срок сделаю индивидуальную цену ещё ниже`;
  }
  if (days >= 11) {
    return `на ${label} — ставка длительной аренды, примерно ${fmtPrice(rate)} в сутки: итого около ${fmtPrice(total)}`;
  }
  return `на ${label} выйдет примерно ${fmtPrice(total)} — по ${fmtPrice(rate)} в сутки уже со скидкой за срок`;
}

// ── Распознавание интента (fallback после AI) ──────────────────────────────

interface IntentScore {
  key: ScriptIntentKey;
  score: number;
  matched: string[];
}

/**
 * Диагностика интента по текстам покупателя. Последнее сообщение весит ×2 —
 * отвечать нужно на АКТУАЛЬНЫЙ вопрос диалога, а не на первый.
 * Возвращаются ВСЕ набравшие вес интенты (по убыванию) — main берёт первый.
 */
export function scoreIntents(lead: LeadRow): IntentScore[] {
  const last = norm(lead.avito?.lastMessage || "");
  const first = norm(lead.avito?.firstMessage || "");
  if (!last && !first) return [];

  const scores = new Map<ScriptIntentKey, IntentScore>();
  for (const { key, words } of INTENT_KEYWORDS) {
    let score = 0;
    const matched: string[] = [];
    for (const w of words) {
      const needle = norm(w);
      if (last.includes(needle)) {
        score += 2;
        matched.push(w);
      } else if (first.includes(needle)) {
        score += 1;
        matched.push(w);
      }
    }
    if (score > 0) scores.set(key, { key, score, matched });
  }
  // Порядок массива INTENT_KEYWORDS = приоритет при равном счёте.
  return Array.from(scores.values()).sort(
    (a, b) => b.score - a.score ||
      INTENT_KEYWORDS.findIndex((k) => k.key === a.key) -
        INTENT_KEYWORDS.findIndex((k) => k.key === b.key),
  );
}

// ── Сборка скриптов (шаблоны под интент, реальные факты экипажа) ───────────

interface ScriptCtx {
  greet: string;
  name: string | null;
  bike: string | null;
  price: number | null;
  /** Сообщений в диалоге (≥2 = диалог уже идёт). */
  messagesCount: number;
  priceLine: string;
  bikeRef: string;
  /** Срок из сообщения покупателя («3 месяца» → 90 дней), если назван. */
  duration: DurationHint | null;
}

function buildScript(ctx: ScriptCtx, key: ScriptIntentKey): {
  script: string;
  short: string;
  nextBestAction: string;
} {
  const { greet, bike, price, priceLine, bikeRef, duration } = ctx;
  switch (key) {
    case "availability": {
      const est =
        duration && price
          ? `${cap(durationEstimateLine(duration.days, duration.label, price))}.`
          : null;
      return {
        script: joinParas(
          `${greet} Да, ${bikeRef} свободен!`,
          est ?? priceLine,
          `Напишите точные даты — сразу зафиксирую бронь за вами: ${BOOKING_LINK}. Или оставьте телефон — оформлю за 10 минут и перезвоню.`,
          `${cap(INCLUDED_PHRASE)}. ${cap(DEPOSIT_PHRASE)}.`,
        ),
        short: est
          ? `${greet} Да, свободен! ${est} Даты скажете — забронирую.`
          : `${greet} Да, свободен! Напишите даты — сразу забронирую за вами.`,
        nextBestAction:
          "Пик интереса: если срок назван — итог в деньгах уже в ответе. Взять даты → зафиксировать бронь (ссылка или телефон для оформления).",
      };
    }
    case "price": {
      const est =
        duration && price
          ? `${cap(durationEstimateLine(duration.days, duration.label, price))}.`
          : null;
      return {
        script: joinParas(
          `${greet}`,
          bike
            ? `${bike} — ${price ? `${fmtPrice(price)} в сутки. Чем дольше срок, тем ниже цена суток: ${tierLineFor(price)}. Почасово тоже даём — от 1 часа.` : "цена зависит от срока — напишите даты, посчитаю точно."}`
            : priceLine,
          est ?? `${cap(PRICE_TIERS_PHRASE)}.`,
          `${cap(INCLUDED_PHRASE)}.`,
          `${cap(GEAR_PHRASE)}. Залог можно оставить СТС — наличные готовить не нужно.`,
          `На какие даты считать? Назову точную сумму и сразу зафиксирую бронь: ${BOOKING_LINK}.`,
        ),
        short: est
          ? `${greet} ${est} Даты скажете — зафиксирую точную цену.`
          : price
            ? `${greet} ${fmtPrice(price)}/сутки. На какие даты? Проверю наличие.`
            : `${greet} Цена зависит от дат и срока — напишите, когда планируете, и пришлю точную стоимость.`,
        nextBestAction:
          "Сначала цифра (ставка + итог за названный срок), затем ценность (что входит) — и один вопрос: даты. Цель — даты и телефон, не сделка в один чат.",
      };
    }
    case "deposit":
      return {
        script: joinParas(
          `${greet}`,
          `${cap(DEPOSIT_PHRASE)}.`,
          `Скрытых удержаний нет: подписываем акт возврата — залог возвращается полностью, точно в срок из договора.`,
          `${cap(DOCS_PHRASE)}.`,
          `Напишите модель и даты — назову точный залог и посчитаю стоимость.`,
        ),
        short: `${greet} Залог — от 10 до 50 тысяч по модели, возвращаем в течение 3 рабочих дней, можно СТС вместо наличных. Модель подскажете?`,
        nextBestAction:
          "Снять тревогу полностью → сразу перевести к датам и модели: «модель подскажете — назову точный залог».",
      };
    case "documents":
      return {
        script: joinParas(
          `${greet}`,
          `${cap(DOCS_PHRASE)}.`,
          `Оформление — договор за 10 минут, подписываем даже электронной подписью (ПЭП), приезжать достаточно один раз.`,
          `Подскажите даты — подберу байк под ваши документы.`,
        ),
        short: `${greet} Нужны только паспорт и права (на электро — В или М, на эндуро не нужны вовсе). На какие даты?`,
        nextBestAction:
          "Страх бюрократии снят → сразу предложить даты или приезд в шоурум с документами.",
      };
    case "delivery":
      return {
        script: joinParas(
          `${greet}`,
          `Да, доставляем! ${cap(DELIVERY_PHRASE)}. Привезём байк полностью готовым к поездке — шлем можно добавить к аренде.`,
          `Возврат — в шоуруме или закажем обратную доставку.`,
          `Напишите адрес и даты — посчитаю стоимость и согласую время.`,
        ),
        short: `${greet} Да, доставляем: по городу 500 ₽, за город — по договорённости. Адрес подскажете?`,
        nextBestAction: "Уточнить адрес → назвать стоимость доставки → закрыть на даты и время.",
      };
    case "discount": {
      return {
        script: joinParas(
          `${greet} Понимаю, бюджет важен — давайте считать фактами, а не на ощупь.`,
          price
            ? `Сутки — ${fmtPrice(price)}, но срок уже снижает цену: ${tierLineFor(price)}. Нужен байк на пару часов — почасово от 1 часа, это совсем другие деньги.`
            : `${cap(PRICE_TIERS_PHRASE)}.`,
          `${cap(INCLUDED_PHRASE)}, плюс свой мотосервис и подменный байк на форс-мажор — у частников этого нет, а по отдельности это вышло бы дороже.`,
          `И есть модели проще — от 4–6 тысяч в сутки. Назовите бюджет и даты — подберу вариант и зафиксирую бронь.`,
        ),
        short: price
          ? `${greet} Срок снижает цену: ${tierLineFor(price)}. Какой бюджет и даты?`
          : `${greet} Срок снижает цену суток (от 11 дней — минус треть). Какой бюджет и даты?`,
        nextBestAction:
          "Возражение «дорого»: НЕ скидка — пересчёт (срок/часы/модель проще). Дать 2 конкретных варианта под бюджет → вопрос про даты.",
      };
    }
    case "test_drive":
      return {
        script: joinParas(
          `${greet}`,
          `Приезжайте на тест-драйв в наш шоурум в ${CITY}! Работаем ${WORK_HOURS}. ${cap(TESTDRIVE_PHRASE)}.`,
          `Если понравится — оформим аренду прямо на месте за 10 минут.`,
          `Когда вам удобно подъехать?`,
        ),
        short: `${greet} Приезжайте на бесплатный тест — ${WORK_HOURS}. Возьмите паспорт и права.`,
        nextBestAction: "Назначить конкретное время визита → паспорт/права с собой → оформление на месте.",
      };
    case "sale":
      return {
        script: joinParas(
          `${greet}`,
          `${bike ? `${bike} — в наличии в нашем шоуруме в ${CITY}. ` : `Да, продаём — вся техника в наличии в шоуруме в ${CITY}. `}${cap(SALE_PHRASE)}.`,
          `Перед покупкой обязательно прокатитесь — тест-драйв бесплатный, работаем ${WORK_HOURS}.`,
          `Пришлю актуальную цену и комплектации? Оплата — наличные или карта, поможем с доставкой.`,
        ),
        short: `${greet} Да, продаём — официальный дилер 79Bike, гарантия на раму/мотор/батарею. Приезжайте на бесплатный тест!`,
        nextBestAction: "Пригласить на тест-драйв → показать комплектации → зафиксировать цену и бронь.",
      };
    case "service":
      return {
        script: joinParas(
          `${greet}`,
          `Да, у нас свой мотосервис в ${CITY}: обслуживание и регулировка цепи — 3 000 ₽, замена масла — 2 000 ₽, компьютерная диагностика — 2 400 ₽, шиномонтаж — от 3 600 ₽, нормо-час — 2 000 ₽.`,
          `Работаем ${WORK_HOURS}, запчасти в наличии.`,
          `Опишите, что с байком, — назову работы и запишу на удобное время. Или пишите мастеру напрямую: ${SERVICE_CONTACT}`,
        ),
        short: `${greet} Да, свой мотосервис: диагностика 2 400 ₽, масло 2 000 ₽, цепь 3 000 ₽. Что с байком?`,
        nextBestAction: "Собрать симптомы → озвучить вилку работ → записать на слот 10:00–20:00.",
      };
    case "long_term": {
      const est =
        duration && price
          ? `${cap(durationEstimateLine(duration.days, duration.label, price))}.`
          : null;
      return {
        script: joinParas(
          `${greet}`,
          est ??
            (duration
              ? `На ${duration.label} — наши лучшие условия: ${PRICE_TIERS_PHRASE}.`
              : `Для долгого срока у нас лучшие условия: ${PRICE_TIERS_PHRASE}.`),
          `${cap(INCLUDED_PHRASE)}.`,
          est
            ? `Залог — от 10 до 50 тысяч по модели (можно СТС), оформление за 10 минут по паспорту, приезжаете один раз.`
            : `Для аренды от недели сделаю индивидуальную цену.`,
          `Напишите даты начала и конца — зафиксирую ${bikeRef} за вами и пришлю точную смету: ${BOOKING_LINK}.`,
        ),
        short: est
          ? `${greet} ${est} Даты скажете — зафиксирую лучшую цену.`
          : `${greet} Для долгого срока цена суток заметно ниже, от недели — индивидуально. Напишите даты.`,
        nextBestAction: duration
          ? "Цифра названа → взять даты старта/финиша → проверить календарь → зафиксировать ставку и бронь (телефон для подтверждения)."
          : "Получить срок и даты → назвать ставку по тарифу → зафиксировать бронь.",
      };
    }
    case "greeting":
      return {
        script: joinParas(
          `${greet} Рад помочь!`,
          `Подскажите, на какие даты нужен байк — пришлю свободные варианты с ценами. В парке 27 мотоциклов: электроэндуро, спортбайки, круизеры и скутеры — от 4 000 ₽/сутки, почасово тоже можно.${bike ? ` Кстати, ${bike} из объявления как раз в наличии.` : ""}`,
          `Отвечаю быстро, можно прямо здесь.`,
        ),
        short: `${greet} Подскажите даты — покажу варианты и посчитаю цену. ${bike ? `${bike} пока в наличии!` : "В парке 27 байков от 4 000 ₽/сутки."}`,
        nextBestAction:
          "Не отвечать встречным «что интересно?» — сразу 1-2 конкретных варианта с ценами и вопросом про даты.",
      };
    // generic
    default:
      return {
        script: joinParas(
          `${greet} Спасибо, что написали!`,
          `Напишите удобные даты — проверю наличие ${bikeRef} и пришлю точную цену с условиями.`,
          `Отвечаем быстро: обычно в течение пары минут. Забронировать можно и самому: ${BOOKING_LINK}`,
        ),
        short: `${greet} Подскажите даты — проверю наличие и пришлю точную цену.`,
        nextBestAction:
          "Скорость решает: ответ в первые минуты. Цель — получить даты и телефон, остальное приложится.",
      };
  }
}

// ── AI-анализ: валидация и приоритет ───────────────────────────────────────

/** Максимальная длина текста, принимаемого от AI-агента (защита от мусора). */
const AI_REPLY_MAX = 4000;
/** Порог доверия к анализу агента: ниже — работаем по своим ключевым словам. */
const AI_CONFIDENCE_MIN = 40;

/** Доверять ли анализу агента вообще (отсутствие confidence = 100). */
function aiTrusted(lead: LeadRow): boolean {
  const a = lead.avito?.analysis;
  if (!a) return false;
  const c = typeof a.confidence === "number" && Number.isFinite(a.confidence)
    ? a.confidence
    : 100;
  return c >= AI_CONFIDENCE_MIN;
}

/** Валидный интент агента (словарный ключ) или null. */
function aiIntent(lead: LeadRow): ScriptIntentKey | null {
  if (!aiTrusted(lead)) return null;
  const raw = (lead.avito?.analysis?.intent || "").trim().toLowerCase();
  if (!raw || !(raw in INTENT_META)) return null;
  return raw as ScriptIntentKey;
}

// ── Публичное API ───────────────────────────────────────────────────────────

/**
 * Готовый ответ для авито-лида. null — лид НЕ авито-канал (раздел в шторке
 * не рендерим). Чистая функция: на вход только данные лида.
 *
 * Приоритет источников:
 *   1. analysis.suggestedReply от AI-агента   → source "ai"
 *   2. analysis.intent (наш шаблон под него)  → source "hybrid"
 *   3. Локальный keyword-детектор             → source "rules"
 */
export function buildSuggestedResponse(lead: LeadRow): SuggestedResponse | null {
  if (!isAvitoLeadLike(lead)) return null;

  const analysis = lead.avito?.analysis ?? null;
  const aiReply = (analysis?.suggestedReply || "").trim();
  const name = buyerFirstName(lead);
  const greet = `Здравствуйте${name ? `, ${name}` : ""}!`;
  const bike = (lead.bikeTitle || "").trim() || null;
  const priceRaw = lead.avito?.itemPrice;
  const price = typeof priceRaw === "number" && Number.isFinite(priceRaw) && priceRaw > 0
    ? priceRaw
    : null;

  const ctx: ScriptCtx = {
    greet,
    name,
    bike,
    price,
    messagesCount:
      typeof lead.avito?.messagesCount === "number" ? lead.avito.messagesCount : 1,
    priceLine: price
      ? `Стоимость — ${fmtPrice(price)} в сутки.`
      : "Стоимость зависит от срока — напишите даты, пришлю точную цену.",
    bikeRef: bike || "наш байк",
    // Срок из сообщения («на 3 месяца», «на выходные») → мгновенный расчёт
    // ставки и суммы прямо в ответе. Последнее сообщение главнее первого.
    duration:
      parseDurationDays(lead.avito?.lastMessage || "") ??
      parseDurationDays(lead.avito?.firstMessage || ""),
  };

  // 1. Полный текст от AI-агента — он главнее шаблона (только при доверии).
  const intentFromAi = aiIntent(lead);
  if (aiTrusted(lead) && aiReply && aiReply.length <= AI_REPLY_MAX) {
    const intentKey: ScriptIntentKey = intentFromAi ?? "generic";
    const built = buildScript(ctx, intentKey);
    const short = (analysis?.shortReply || "").trim() || built.short;
    return {
      intent: INTENT_META[intentKey],
      script: aiReply,
      short,
      nextBestAction: (analysis?.nextBestAction || "").trim() || built.nextBestAction,
      quickReplies: [...INTENT_QUICK_REPLIES[intentKey], ...UNIVERSAL_QUICK_REPLIES].slice(0, 5),
      matched: [],
      source: "ai",
      aiNotes: (analysis?.notes || "").trim() || null,
    };
  }

  // 2. AI распознал интент (без текста) → наш шаблон под его интент.
  const ranked = scoreIntents(lead);
  const keywordPrimary = ranked[0] ?? { key: "generic" as ScriptIntentKey, score: 0, matched: [] };
  if (intentFromAi) {
    const built = buildScript(ctx, intentFromAi);
    return {
      intent: INTENT_META[intentFromAi],
      script: built.script,
      short: built.short,
      nextBestAction: (analysis?.nextBestAction || "").trim() || built.nextBestAction,
      quickReplies: [...INTENT_QUICK_REPLIES[intentFromAi], ...UNIVERSAL_QUICK_REPLIES].slice(0, 5),
      matched: keywordPrimary.matched.slice(0, 4),
      source: "hybrid",
      aiNotes: (analysis?.notes || "").trim() || null,
    };
  }

  // 3. Локальный fallback: keyword-детектор (или generic, если текст пуст).
  const intentKey: ScriptIntentKey = ranked.length > 0 ? keywordPrimary.key : "generic";
  const built = buildScript(ctx, intentKey);
  return {
    intent: INTENT_META[intentKey],
    script: built.script,
    short: built.short,
    nextBestAction: built.nextBestAction,
    quickReplies: [...INTENT_QUICK_REPLIES[intentKey], ...UNIVERSAL_QUICK_REPLIES].slice(0, 5),
    matched: keywordPrimary.matched.slice(0, 4),
    source: "rules",
    aiNotes: null,
  };
}

/** Метка интента для плашки в списке (эмодзи + короткое слово). null — не авито/нет данных. */
export function intentChip(lead: LeadRow): { emoji: string; label: string } | null {
  if (!isAvitoLeadLike(lead)) return null;
  // AI-интент главнее keyword-детектора — плашка в списке честная.
  const fromAi = aiIntent(lead);
  if (fromAi) return INTENT_META[fromAi];
  const ranked = scoreIntents(lead);
  if (ranked.length === 0) return null;
  const meta = INTENT_META[ranked[0].key];
  return { emoji: meta.emoji, label: meta.label };
}
