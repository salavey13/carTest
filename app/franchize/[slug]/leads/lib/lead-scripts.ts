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
// Практики колл-центров, заложенные в движок:
//   1. Скрипт под интент, а не «универсальное здравствуйте» — оператор
//      отвечает на ВОПРОС покупателя, а не на свой страх.
//   2. Next Best Action (NBA) — подсказка «что делать после ответа»:
//      цель первого ответа всегда даты + телефон/предоплата, не сделка.
//   3. Quick Replies — быстрые однострочники (телефон, шоурум, документы),
//      которые закрывают типовые микро-вопросы без набора текста.
//   4. Отработка возражений: «дорого» → ценность → альтернатива, а не скидка.
//   5. Скорость: раздел разворачивается в шторке лида РЯДОМ с кнопкой
//      «Открыть чат Авито» — путь «прочитал → скопировал → вставил»
//      занимает секунды (first response time решает конверсию).
//
// Архитектура: ЧИСТЫЙ клиент-безопасный модуль (без server-only импортов,
// без React, без Date.now() в логике). Считается на лету при рендере шторки
// и карточки — НЕ пишется в БД. Плюсы: работает ретроактивно для всех
// существующих авито-лидов (без backfill), тексты скриптов улучшаются
// без переимпорта, легко покрывается тестами.
//
// ── ТЕКСТЫ СКРИПТОВ ── бизнес-фразы вынесены в константы ниже; правьте
// их под реальные условия экипажа — вся библиотека живёт в этом файле.

import type { LeadRow } from "../leads-types";

// ── Бизнес-константы (едины для всех скриптов — правятся здесь) ────────────
const BRAND = "VIP BIKE";
const WORK_HOURS = "ежедневно 10:00–20:00";
const DOCS_PHRASE =
  "Из документов нужны только паспорт и права (если они есть) — оформляем за 10 минут прямо в шоуруме.";
const DEPOSIT_PHRASE =
  "Залог минимальный и оформляется на месте по паспорту: вернёте байк в целости — вернём залог полностью в тот же день.";
const INCLUDED_PHRASE =
  "В аренду уже входят шлемы, техосмотр перед выездом и подменный байк на случай форс-мажора.";

// ── Типы ────────────────────────────────────────────────────────────────────

export type ScriptIntentKey =
  | "availability"
  | "price"
  | "deposit"
  | "documents"
  | "delivery"
  | "discount"
  | "test_drive"
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
  documents: { key: "documents", label: "Документы", emoji: "📄" },
  delivery: { key: "delivery", label: "Доставка", emoji: "🚚" },
  discount: { key: "discount", label: "Возражение: дорого", emoji: "🤝" },
  test_drive: { key: "test_drive", label: "Посмотреть / тест", emoji: "👀" },
  long_term: { key: "long_term", label: "Длительная аренда", emoji: "📆" },
  greeting: { key: "greeting", label: "Первое касание", emoji: "👋" },
  generic: { key: "generic", label: "Общий скрипт", emoji: "🎯" },
};

/** Однострочник быстрого ответа. */
export interface QuickReply {
  label: string;
  text: string;
}

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
    words: ["залог", "залогова", "депозит", "заклад", "залогом"],
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
      "посмотреть", "вживую", "покататься", "тест", "пробн", "попробова",
      "осмотреть", "можно глянуть", "где находитес", "как проехать", "адрес",
    ],
  },
  {
    key: "long_term",
    words: [
      "на месяц", "на неделю", "на две недели", "долгосроч", "длительн",
      "посуточно", "надолго", "на лето", "на сезон", "помесячн",
    ],
  },
  {
    key: "greeting",
    words: [
      "здравству", "добрый день", "добрый вечер", "доброе утро",
      "привет", "hello", "hi ",
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
    text: `Работаем ${WORK_HOURS}. Приезжайте — покажем байки вживую и оформим аренду за 10 минут.`,
  },
  {
    label: "📄 Документы",
    text: `${DOCS_PHRASE} Нужны только даты — остальное сделаем сами.`,
  },
];

const INTENT_QUICK_REPLIES: Record<ScriptIntentKey, readonly QuickReply[]> = {
  availability: [
    {
      label: "🗓 Зафиксировать даты",
      text: "Напишите даты, когда планируете кататься, — сразу проверю и зафиксирую бронь за вами.",
    },
    {
      label: "⚡ Предоплата",
      text: "Для брони нужна небольшая предоплата — после неё байк закрепляется только за вами.",
    },
  ],
  price: [
    {
      label: "💸 Цена + ценность",
      text: "В цену уже входят шлемы, техосмотр и подменный байк — никаких доплат на месте.",
    },
    {
      label: "📊 Прайс по срокам",
      text: "Чем больше срок — тем ниже цена суток. Напишите, на сколько дней, — пришлю точную стоимость.",
    },
  ],
  deposit: [
    {
      label: "🛡 Залог вернём",
      text: "Залог возвращаем полностью в день возврата байка — это стандартная страховка, не доплата.",
    },
  ],
  documents: [
    {
      label: "📄 Список документов",
      text: DOCS_PHRASE,
    },
    {
      label: "🪪 Без прав",
      text: "Если прав нет — есть модели, которые можно арендовать без них. Подскажу варианты.",
    },
  ],
  delivery: [
    {
      label: "🚚 Посчитать доставку",
      text: "Напишите адрес — посчитаю стоимость доставки и согласую удобное время.",
    },
  ],
  discount: [
    {
      label: "🤝 Ценность, не скидка",
      text: "В цену входят шлемы, обслуживание и подменный байк — по отдельности это дороже. Плюс срок снижает цену суток.",
    },
    {
      label: "🔁 Альтернатива",
      text: "Могу предложить модель дешевле из наличия — напишите бюджет и даты.",
    },
  ],
  test_drive: [
    {
      label: "📍 Пригласить",
      text: `Приезжайте, работает ${WORK_HOURS} — прокатитесь и решайте на месте.`,
    },
    {
      label: "🪪 С собой",
      text: "Возьмите паспорт — если понравится, оформим аренду прямо на месте за 10 минут.",
    },
  ],
  long_term: [
    {
      label: "📆 Индивидуальный расчёт",
      text: "Для срока от недели сделаю индивидуальную цену — напишите даты начала и конца.",
    },
  ],
  greeting: [
    {
      label: "🎯 Два вопроса",
      text: "Подскажите, на какие даты нужен байк и сколько человек будет кататься, — подберу вариант и посчитаю цену.",
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

// ── Распознавание интента ───────────────────────────────────────────────────

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

// ── Сборка скриптов ─────────────────────────────────────────────────────────

interface ScriptCtx {
  greet: string;
  name: string | null;
  bike: string | null;
  price: number | null;
  /** Сообщений в диалоге (≥2 = диалог уже идёт). */
  messagesCount: number;
  priceLine: string;
  bikeRef: string;
}

function buildScript(ctx: ScriptCtx, key: ScriptIntentKey): {
  script: string;
  short: string;
  nextBestAction: string;
} {
  const { greet, bike, price, priceLine, bikeRef } = ctx;
  switch (key) {
    case "availability":
      return {
        script: joinParas(
          `${greet} Да, ${bikeRef} свободен на нужные вам даты!`,
          `Напишите, когда планируете забрать и на сколько дней, — сразу зафиксирую бронь за вами.${price ? ` ${priceLine}` : ""}`,
          INCLUDED_PHRASE,
          `На выходные брони уходят быстро, поэтому предлагаю зафиксировать даты сегодня: нужна только небольшая предоплата, всё остальное оформим за 10 минут.`,
        ),
        short: `${greet} Да, свободен! Напишите даты — сразу забронирую за вами.`,
        nextBestAction:
          "Цель ответа — даты + предоплата: уточнить срок → назвать цену → предложить зафиксировать бронь сегодня. Без телефона — попросить номер для подтверждения.",
      };
    case "price":
      return {
        script: joinParas(
          `${greet}`,
          bike
            ? `${bike} — аренда ${price ? `${fmtPrice(price)} в сутки` : "от цены в объявлении"}.`
            : priceLine,
          `${INCLUDED_PHRASE} ${DEPOSIT_PHRASE}`,
          `Если даты ещё свободны, готов зафиксировать байк за вами — напишите, когда планируете кататься.`,
        ),
        short: price
          ? `${greet} ${fmtPrice(price)}/сутки, шлемы и обслуживание включены. На какие даты? Проверю наличие.`
          : `${greet} Цена зависит от дат и срока — напишите, когда планируете, и пришлю точную стоимость.`,
        nextBestAction:
          "Не голая цифра: цена → ценность (что входит) → вопрос про даты. Цель первого ответа — даты, а не сделка.",
      };
    case "deposit":
      return {
        script: joinParas(
          `${greet}`,
          `${DEPOSIT_PHRASE} Никаких скрытых удержаний: вернёте байк в целости — залог вернётся в тот же день.`,
          `${DOCS_PHRASE}`,
          `Напишите даты — посчитаю итоговую стоимость и забронирую байк за вами.`,
        ),
        short: `${greet} Залог возвращаем полностью в день возврата — это стандартная страховка. Даты подскажете?`,
        nextBestAction:
          "Снять тревогу полностью → сразу перевести к датам: «даты подскажете — зафиксирую бронь».",
      };
    case "documents":
      return {
        script: joinParas(
          `${greet}`,
          `${DOCS_PHRASE} Приехать нужно один раз — всё остальное оформляем сами.`,
          `Если прав нет, подскажем модели, которые можно арендовать без них.`,
          `Когда планируете кататься? Подберу байк под ваши даты.`,
        ),
        short: `${greet} Нужны только паспорт и права (если есть), оформление — 10 минут. На какие даты?`,
        nextBestAction:
          "Страх бюрократии снят → сразу предложить даты или приезд в шоурум с документами.",
      };
    case "delivery":
      return {
        script: joinParas(
          `${greet}`,
          `Да, доставляем! Привезём байк полностью готовым к поездке, со шлемами — прямо к подъезду. Напишите адрес, посчитаю стоимость доставки и согласую удобное время.`,
          `Обратную доставку тоже можно заказать — вернём байк из шоурума сами.`,
          `На какие даты привезти?`,
        ),
        short: `${greet} Да, доставляем! Напишите адрес — посчитаю стоимость и согласую время.`,
        nextBestAction: "Уточнить адрес → назвать стоимость доставки → закрыть на даты и время.",
      };
    case "discount":
      return {
        script: joinParas(
          `${greet} Понимаю, бюджет важен!`,
          `Смотрите, что уже включено в цену: ${INCLUDED_PHRASE.toLowerCase().replace(/\.$/, "")} — по отдельности всё это вышло бы заметно дороже.`,
          `Плюс чем дольше срок, тем ниже цена суток: могу предложить выгодный вариант на ваши даты или модель попроще из наличия.`,
          `Напишите срок и даты — подберу лучший вариант.`,
        ),
        short: `${greet} Срок снижает цену суток, и в аренду всё уже включено. Напишите даты — подберу оптимальный вариант.`,
        nextBestAction:
          "Возражение «дорого»: сначала ценность → потом альтернатива (срок/модель) → НЕ скидка. Спросить даты.",
      };
    case "test_drive":
      return {
        script: joinParas(
          `${greet}`,
          `Конечно, приезжайте посмотреть и прокатиться! Мы работаем ${WORK_HOURS}, адрес — в объявлении, могу продублировать.`,
          `Возьмите с собой паспорт — если понравится, оформим аренду прямо на месте за 10 минут.`,
          `Когда вам удобно подъехать?`,
        ),
        short: `${greet} Приезжайте прокатиться — работаем ${WORK_HOURS}. Возьмите паспорт, оформим на месте.`,
        nextBestAction: "Назначить конкретное время визита → паспорт с собой → оформление на месте.",
      };
    case "long_term":
      return {
        script: joinParas(
          `${greet}`,
          `Да, на длительный срок условия лучше: чем больше дней — тем ниже цена суток. Для аренды от недели сделаю индивидуальную цену.`,
          `${INCLUDED_PHRASE}`,
          `Напишите даты начала и конца — посчитаю и зафиксирую байк за вами.`,
        ),
        short: `${greet} Для долгого срока сделаю индивидуальную цену — напишите даты начала и конца.`,
        nextBestAction: "Посчитать индивидуально → зафиксировать даты → взять телефон для подтверждения.",
      };
    case "greeting":
      return {
        script: joinParas(
          `${greet} Рад помочь!`,
          `Подскажите, на какие даты нужен байк — покажу свободные варианты и сразу посчитаю стоимость.${bike ? ` Кстати, ${bike} из объявления как раз в наличии.` : ""}`,
          `Отвечаю быстро, можно прямо здесь.`,
        ),
        short: `${greet} Подскажите даты — покажу свободные варианты и посчитаю цену. ${bike ? `${bike} пока в наличии!` : ""}`,
        nextBestAction:
          "Не отвечать встречным «что интересно?» — сразу 1-2 конкретных варианта с ценами и вопросом про даты.",
      };
    // generic
    default:
      return {
        script: joinParas(
          `${greet} Спасибо, что написали!`,
          `Напишите удобные даты — проверю наличие ${bikeRef} и пришлю точную цену с условиями.`,
          `Отвечаем быстро: обычно в течение пары минут.`,
        ),
        short: `${greet} Подскажите даты — проверю наличие и пришлю точную цену.`,
        nextBestAction:
          "Скорость решает: ответ в первые минуты. Цель — получить даты и телефон, остальное приложится.",
      };
  }
}

// ── Публичное API ───────────────────────────────────────────────────────────

/**
 * Готовый ответ для авито-лида. null — лид НЕ авито-канал (раздел в шторке
 * не рендерим). Чистая функция: на вход только данные лида.
 */
export function buildSuggestedResponse(lead: LeadRow): SuggestedResponse | null {
  if (!isAvitoLeadLike(lead)) return null;

  const name = buyerFirstName(lead);
  const greet = `Здравствуйте${name ? `, ${name}` : ""}!`;
  const bike = (lead.bikeTitle || "").trim() || null;
  const priceRaw = lead.avito?.itemPrice;
  const price = typeof priceRaw === "number" && Number.isFinite(priceRaw) && priceRaw > 0
    ? priceRaw
    : null;
  const messagesCount =
    typeof lead.avito?.messagesCount === "number" ? lead.avito.messagesCount : 1;

  // Диагностика: последний вопрос весит вдвое; пустой текст → generic.
  const ranked = scoreIntents(lead);
  const primary: IntentScore = ranked[0] ?? { key: "generic", score: 0, matched: [] };
  const intentKey: ScriptIntentKey = ranked.length > 0 ? primary.key : "generic";

  const ctx: ScriptCtx = {
    greet,
    name,
    bike,
    price,
    messagesCount,
    priceLine: price
      ? `Стоимость — ${fmtPrice(price)} в сутки.`
      : "Стоимость зависит от срока — напишите даты, пришлю точную цену.",
    bikeRef: bike || "наш байк",
  };

  const { script, short, nextBestAction } = buildScript(ctx, intentKey);

  // Quick replies: под интент → универсальные, срезаем до 5 чтобы секция
  // не превращалась в каталог.
  const quickReplies = [
    ...INTENT_QUICK_REPLIES[intentKey],
    ...UNIVERSAL_QUICK_REPLIES,
  ].slice(0, 5);

  return {
    intent: INTENT_META[intentKey],
    script,
    short,
    nextBestAction,
    quickReplies,
    matched: primary.matched.slice(0, 4),
  };
}

/** Метка интента для плашки в списке (эмодзи + короткое слово). null — не авито/нет данных. */
export function intentChip(lead: LeadRow): { emoji: string; label: string } | null {
  if (!isAvitoLeadLike(lead)) return null;
  const ranked = scoreIntents(lead);
  if (ranked.length === 0) return null;
  const meta = INTENT_META[ranked[0].key];
  return { emoji: meta.emoji, label: meta.label };
}
