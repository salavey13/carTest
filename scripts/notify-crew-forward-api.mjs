#!/usr/bin/env node
// scripts/notify-crew-forward-api.mjs
// Boss hint (2026-10-11): use the repo's TG MESSAGE FORWARDING API
// (/api/forward-telegram on the Vercel deployment — lib/telegram-transport.ts
// pattern: forward-first, token stays on Vercel) instead of direct Bot API.
// Notifies the crew about the wheel codereview iteration shipping.

const FORWARD_URL = "https://v0-car-test.vercel.app/api/forward-telegram";
const ORIGIN = "https://v0-car-test.vercel.app";

const RECIPIENTS = [
  ["413553377", "salavey13"],
  ["7813830016", "DJORUDJOV"],
  ["356282674", "I_O_S_NN"],
];

const TEXT = [
  "🎰 <b>Колесо фортуны — апдейт после кодревью</b>",
  "",
  "Прогнали реализацию через 4 раунда босс-ревью (6 → 7 → 8.5 → <b>9.5/10</b>, shippable):",
  "",
  "💰 <b>Цены промокодов — перепроверены и зафиксированы тестами</b>",
  "Корзина теперь пересчитывает скидку ровно как сервер: WHEEL5000 больше не превращается в «заказ бесплатно», WHEEL15 пересчитывается при изменении корзины. Подделка суммы скидки на чекауте отклоняется сервером.",
  "",
  "🔔 <b>Уведомления о победителях</b>",
  "Победитель получает личку с промокодом и кнопкой «В корзину», owner/админы — сводку, кто и что выиграл. Анонимные веб-крутки молча пропускаются, спам-защита: 1 пакет уведомлений в сутки.",
  "",
  "🛠 <b>Быстрая админка карточек каталога</b>",
  "На главной витрины — плавающая кнопка «Карточки» для owner/co_owner/admin: правка промо-баннеров и анонсов (текст, промокод, %/₽, окна действия) прямо с витрины.",
  "",
  "❤️ <b>Лайки</b> — простые пользователи (не арендаторы) могут ставить реакции на стене экипажа: зафиксировано спекой.",
  "📢 <b>Пост-челлендж</b> на стене: >13 лайков — бесплатная поездка для друга.",
  "",
  "✅ Тесты: 159 файлов / 2996 зелёных. Коммит <code>408e3e6c9</code>, деплой через Vercel.",
  "",
  "🔗 https://v0-car-test.vercel.app/franchize/vip-bike/wheel",
].join("\n");

async function deliver(chatId, name) {
  try {
    const res = await fetch(FORWARD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": ORIGIN },
      body: JSON.stringify({
        chat_id: chatId,
        method: "sendMessage",
        payload: {
          text: TEXT,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        },
      }),
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.json().catch(() => null);
    const ok = res.ok && body?.ok !== false;
    console.log(`${name} (${chatId}): ${ok ? "DELIVERED via forwarding API" : `FAILED: ${JSON.stringify(body)?.slice(0, 200)}`}`);
    return ok;
  } catch (error) {
    console.log(`${name} (${chatId}): ERROR ${error.message}`);
    return false;
  }
}

let delivered = 0;
for (const [chatId, name] of RECIPIENTS) {
  if (await deliver(chatId, name)) delivered += 1;
}
console.log(`\nDone: ${delivered}/${RECIPIENTS.length} delivered.`);
process.exit(delivered === RECIPIENTS.length ? 0 : 1);
