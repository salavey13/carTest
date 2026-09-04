/**
 * Self-training harness (NOT shipped — dev-only script):
 * генерирует ответы движка по гайдлайнам, печатает для самооценки.
 * Запуск: bunx tsx scripts/self-train-eval.ts
 */
import { buildSuggestedResponse } from "../app/franchize/[slug]/leads/lib/lead-scripts";
import type { LeadRow } from "../app/franchize/[slug]/leads/leads-types";

type Case = {
  id: string;
  name: string;
  lead: Partial<LeadRow> & { avitoMsg: { last: string; first?: string; price?: number } };
};

const mkLead = (c: Case): LeadRow => ({
  user_id: `avito:chat-${c.id}`,
  full_name: "Иван Петров",
  username: null,
  phone: null,
  source: "callback_request",
  bikeTitle: null,
  createdAt: "2026-09-04T10:00:00.000Z",
  lastSeenAt: null,
  verified: false,
  rentals: [],
  sales: [],
  contactChannel: "avito",
  ...c.lead,
  bikeTitle: c.lead.bikeTitle ?? null,
  avito: {
    chatId: `chat-${c.id}`,
    itemUrl: null,
    profileUrl: null,
    itemId: null,
    lastMessage: c.lead.avitoMsg.last,
    firstMessage: c.lead.avitoMsg.first ?? c.lead.avitoMsg.last,
    itemPrice: c.lead.avitoMsg.price ?? null,
    messagesCount: 1,
    lastMessageAt: "2026-09-04T11:00:00.000Z",
    ...(c.lead.avito ?? {}),
  },
} as LeadRow);

const CASES: Case[] = [
  { id: "1", name: "3 месяца (мгновенный расчёт)", lead: { bikeTitle: "79BIKE Falcon GT", avitoMsg: { last: "Здравствуйте! А на 3 месяца сколько выйдет?", price: 12000 } } },
  { id: "2", name: "Полгода без модели", lead: { avitoMsg: { last: "Арендую на полгода, сколько будет стоить?", price: 5000 } } },
  { id: "3", name: "Выходные + модель", lead: { bikeTitle: "Yamaha R7", avitoMsg: { last: "Свободен на выходные? Сколько за два дня?", price: 10000 } } },
  { id: "4", name: "Почасово 3 часа", lead: { bikeTitle: "79BIKE Falcon Pro", avitoMsg: { last: "Почасово можно? Нужно часа на 3", price: 10000 } } },
  { id: "5", name: "Бюджет", lead: { avitoMsg: { last: "Бюджет до 6 тысяч, что подскажете на 2 дня?", price: null } } },
  { id: "6", name: "Дорого (возражение)", lead: { bikeTitle: "Ducati 1199 Panigale", avitoMsg: { last: "Дорого. У частника вдвое дешевле будет", price: 18000 } } },
  { id: "7", name: "Нет прав", lead: { avitoMsg: { last: "Прав категории А нет, только B. Есть что-то для меня?", price: 6000 } } },
  { id: "8", name: "Доверие", lead: { bikeTitle: "Kugoo Kirin M4 Pro", avitoMsg: { last: "А вы не кинете? Какой залог и вернёте ли?", price: 2500 } } },
  { id: "9", name: "Горячий с телефоном", lead: { avitoMsg: { last: "Всё устраивает, беру на 2 дня! Мой номер +7 999 123-45-67", price: 4500 }, avito: { analysis: { intent: "availability", confidence: 95, temperature: "hot", objection: "none", entities: { phone: "+7 999 123-45-67", duration: "2 дня" } } } } },
  { id: "10", name: "Холодный «просто смотрю»", lead: { avitoMsg: { last: "Привет, просто смотрю что почём", price: 4500 } } },
  { id: "11", name: "AI забыл цифру (аудит)", lead: { bikeTitle: "79BIKE Falcon GT", avitoMsg: { last: "На 3 месяца интересно", price: 12000, }, avito: { analysis: { intent: "long_term", confidence: 90, suggestedReply: "Здравствуйте, Иван! Да, у нас отличные условия долгосрочной аренды, приезжайте обсудим.", temperature: "warm", objection: "none" } } } },
  { id: "12", name: "Опыт низкий", lead: { bikeTitle: "HMD M02 (GT-EM07)", avitoMsg: { last: "Никогда не катал на мото, страшновато. Можно попробовать?", price: 6000 } } },
];

for (const c of CASES) {
  const lead = mkLead(c);
  const res = buildSuggestedResponse(lead);
  console.log("=".repeat(100));
  console.log(`#${c.id} ${c.name}`);
  if (!res) { console.log("  → null"); continue; }
  console.log(`  intent=${res.intent.key} source=${res.source} matched=[${res.matched.join(", ")}]`);
  console.log("  ── SCRIPT ──");
  for (const p of (res.script || "").split("\n\n")) console.log(`  │ ${p}`);
  console.log("  ── SHORT ──");
  console.log(`  │ ${res.short}`);
  console.log(`  ── NBA: ${res.nextBestAction}`);
}
