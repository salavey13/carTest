// /app/franchize/[slug]/leads/lib/lead-prep.ts
//
// ПОДГОТОВКА К КОНТАКТУ — «5 минут подготовки» из курса 2026 (план B5,
// ПРИОРИТЕТ БОССА). Ключевой тезис курса: «подготовка настолько несексуальна,
// что её никто не делает — поэтому она и приносит деньги». Правило:
//   1. НИКОГДА не позволять клиенту повторяться — МЫ повторяем ЕМУ то, что
//      он сказал («you repeating to them what they told you is exceptionally
//      positive; them repeating themselves is really negative»).
//   2. Перед контактом прочитать заметки/историю — 5 минут — и начать
//      разговор с эхо-фразы: «Вы писали про X на даты Y…».
//
// Что здесь: чистая функция buildLeadPrep(lead) — собирает из уже
// загруженных данных лида (авито-сообщения, AI-сущности, цены, заметки)
//   • echoLine   — готовая первая строка ответа (эхо последнего сообщения);
//   • facts      — 2–4 строки фактов («что уже известно»), читаются за
//                  секунды перед звонком/ответом;
//   • hasPrep    — есть ли вообще что показывать (не-авито лид без заметок
//                  и без фактов секцию не рендерит).
// Модуль чистый: без React, без Date.now() — только данные лида.

import type { LeadRow } from "../leads-types";

export interface LeadPrepFact {
  /** Иконка-эмодзи для строки факта. */
  icon: string;
  /** Человекочитаемый факт: «Байк: 79Bike Falcon GT — 6 000 ₽/сутки». */
  text: string;
}

export interface LeadPrep {
  /**
   * Эхо-первая строка ответа: «Вы писали про {байк} — {суть}».
   * null — нет последнего сообщения клиента (эхо строить не из чего).
   */
  echoLine: string | null;
  /** Факты из диалога/карточки — «что уже известно, не переспрашивать». */
  facts: LeadPrepFact[];
  /** Заметки операторов (последние 2) — эстафета контекста между сменами. */
  notesHint: string | null;
  /** Есть ли что показывать в секции «Подготовка». */
  hasPrep: boolean;
}

/** Сжатие текста сообщения до 1 строки эха (кусок без переноса, ≤90 знаков). */
function squeeze(text: string, max = 90): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1).trimEnd()}…`;
}

/** «6 000 ₽» — цена объявления в человеческом виде. */
function fmtPrice(price: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(price))} ₽`;
}

/**
 * Подготовка к контакту по данным лида. Для не-авито лидов факты собираются
 * из карточки (байк/аренда/продажа), эхо — только из авито-переписки.
 */
export function buildLeadPrep(lead: LeadRow): LeadPrep {
  const av = lead.avito;
  const facts: LeadPrepFact[] = [];

  // ── Факт: объявление (байк + цена) ──
  const bike = (lead.bikeTitle || "").trim();
  const price =
    typeof av?.itemPrice === "number" && Number.isFinite(av.itemPrice) && av.itemPrice > 0
      ? av.itemPrice
      : null;
  if (bike) {
    facts.push({
      icon: "🏍",
      text: price ? `${bike} — ${fmtPrice(price)}` : bike,
    });
  }

  // ── Факты из AI-сущностей (dates/budget/phone/license) ──
  const entities = av?.analysis?.entities ?? null;
  if (entities) {
    if (entities.dates) facts.push({ icon: "📅", text: `Даты: ${squeeze(entities.dates, 60)}` });
    if (entities.budget) facts.push({ icon: "💵", text: `Бюджет: ${squeeze(entities.budget, 60)}` });
    if (entities.license) facts.push({ icon: "🪪", text: `Права: ${squeeze(entities.license, 60)}` });
  }

  // ── Факт: прогресс по сделке (аренда/продажа) ──
  if (lead.rentals.length > 0) {
    const r = lead.rentals[0];
    const sum = typeof r.totalCost === "number" && Number.isFinite(r.totalCost) ? ` на ${fmtPrice(r.totalCost)}` : "";
    facts.push({ icon: "🤝", text: `Аренда в работе${sum}` });
  }
  if (lead.sales.length > 0) {
    facts.push({ icon: "🏷", text: "Покупка байка в работе" });
  }

  // ── Эхо-строка: последнее сообщение клиента ──
  const lastMsg = (av?.lastMessage || av?.firstMessage || "").trim();
  const name = (lead.full_name || "").trim();
  const firstName =
    name && !/^покупатель/i.test(name)
      ? name.split(/\s+/)[0]?.replace(/[^\p{L}\-]/gu, "") ?? ""
      : "";
  const who = firstName.length >= 2 ? `, ${firstName.charAt(0).toUpperCase()}${firstName.slice(1)}` : "";
  const echoLine = lastMsg
    ? `${bike ? `Вы писали про «${bike}»` : "Вы писали нам"}${who} — ${squeeze(lastMsg)}`
    : null;

  return {
    echoLine,
    facts,
    notesHint: null,
    hasPrep: facts.length > 0 || !!echoLine,
  };
}
