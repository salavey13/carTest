// scripts/selftrain_runner.ts
//
// Раннер самообучения движка «Готовый ответ»: прогоняет N реальных сценариев
// покупателя через buildSuggestedResponse и печатает готовые тексты.
// Запуск: bun scripts/selftrain_runner.ts
// Используется для цикла «сгенерировать → оценить по rubric → улучшить».

import { buildSuggestedResponse } from "../app/franchize/[slug]/leads/lib/lead-scripts";
import type { LeadRow } from "../app/franchize/[slug]/leads/leads-types";

interface Scenario {
  n: number;
  note: string;
  bikeTitle: string | null;
  itemPrice: number | null;
  message: string;
}

const SCENARIOS: Scenario[] = [
  { n: 1, note: "3 месяца — должна быть цифра сразу", bikeTitle: "79BIKE Falcon GT", itemPrice: 12000, message: "Здравствуйте, а на 3 месяца можно взять?" },
  { n: 2, note: "выходные, без названия модели", bikeTitle: "Электровелосипед кросс", itemPrice: 2500, message: "Сколько стоит на выходные?" },
  { n: 3, note: "почасово, пакет часов", bikeTitle: "79BIKE Falcon Pro", itemPrice: 10000, message: "А почасово можно? Нужно часа на 3" },
  { n: 4, note: "залог по конкретной модели", bikeTitle: "Yamaha R7", itemPrice: 10000, message: "Какой залог оставлять?" },
  { n: 5, note: "возражение дорого + конкурент", bikeTitle: "BMW F800R", itemPrice: 10000, message: "Дорого. За эти деньги лучше у частника возьму" },
  { n: 6, note: "права на эндуро", bikeTitle: "79BIKE Falcon GT", itemPrice: 12000, message: "У меня только категория B, подойдёт?" },
  { n: 7, note: "доставка в другой город", bikeTitle: "Sequence Zero", itemPrice: 15000, message: "Привезёте в Дзержинск?" },
  { n: 8, note: "наличие на завтра", bikeTitle: "Aprilia Shiver 750", itemPrice: 12000, message: "Свободен на завтра?" },
  { n: 9, note: "покупка байка", bikeTitle: "LiveWire ONE", itemPrice: 20000, message: "Хочу такой же купить, сколько стоит?" },
  { n: 10, note: "почасово без количества часов", bikeTitle: "Ducati 1199 Panigale", itemPrice: 18000, message: "Можно почасово арендовать?" },
];

function buildLead(s: Scenario): LeadRow {
  return {
    user_id: "avito:chat-selftrain",
    full_name: "Иван Петров",
    username: null,
    phone: null,
    source: "callback_request",
    bikeTitle: s.bikeTitle,
    createdAt: "2026-09-04T10:00:00.000Z",
    lastSeenAt: "2026-09-04T11:00:00.000Z",
    verified: false,
    rentals: [],
    sales: [],
    contactChannel: "avito",
    avito: {
      chatId: "chat-selftrain",
      itemUrl: null,
      profileUrl: null,
      itemId: null,
      lastMessage: s.message,
      firstMessage: s.message,
      itemPrice: s.itemPrice,
      messagesCount: 1,
      lastMessageAt: "2026-09-04T11:00:00.000Z",
    },
  };
}

for (const s of SCENARIOS) {
  const res = buildSuggestedResponse(buildLead(s));
  if (!res) continue;
  console.log(`\n${"=".repeat(76)}`);
  console.log(`СЦЕНАРИЙ ${s.n}: ${s.note}`);
  console.log(`Покупатель (${s.bikeTitle ?? "без модели"}, ${s.itemPrice ?? "—"} ₽): «${s.message}»`);
  console.log(`--- intent=${res.intent.key} source=${res.source}`);
  console.log(`--- ПОЛНЫЙ:\n${res.script}`);
  console.log(`--- КОРОТКИЙ: ${res.short}`);
  console.log(`--- NBA: ${res.nextBestAction}`);
}
