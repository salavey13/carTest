// Task 86: send the summer dev report to boss + vip-bike owners.
// Album = cover picture (caption = TL;DR, HTML) + report HTML document.
// Route: /api/forward-telegram (token stays on Vercel), like task 82.
// Run: node --env-file=.env.local scripts/task86-send-report.mjs
import { readFileSync } from "node:fs";

const REPORT = "/home/z/my-project/download/vip-bike-dev-summer-2026.html";
const COVER = "/home/z/my-project/download/vip-bike-report-cover.png";
const FORWARD_URL = process.env.FORWARD_TELEGRAM_URL || "https://v0-car-test.vercel.app/api/forward-telegram";
const FORWARD_ORIGIN = process.env.FORWARD_TELEGRAM_ORIGIN || "https://v0-car-test.vercel.app";

// salavey13 (Paul) · DJORUDJOV · I_O_S_NN (owner) · Roman_Vip_Bike_Electro (co_owner)
const RECIPIENTS = [
  { chat: "413553377", who: "salavey13" },
  { chat: "7813830016", who: "DJORUDJOV" },
  { chat: "356282674", who: "I_O_S_NN" },
  { chat: "244736261", who: "Roman_Vip_Bike_Electro" },
];

const TLDR = [
  "🏍 <b>VIP-BIKE × разработка — итоги лета 2026</b>",
  "",
  "Ребята, держите отчёт о том, что построено для экипажа за сезон (130 дней) — файлом ниже, открывается в браузере.",
  "",
  "<b>Коротко:</b>",
  "• 💰 Деньги, зарплаты, партнёрские — один контур, цифра сходится везде",
  "• 📄 Договоры — DOCX за минуту, подписи и архив в базе",
  "• ❄️ Зимнее хранение — статусы, таймлайны, «оплачено до»",
  "• 🗺 Живая карта райдеров — со скинами RDR2 и Vice City 😎",
  "• 📣 Стена экипажа + рассылка постов прошлым арендаторам — 256 тёплых клиентов, 0 ₽",
  "• 🎬 Блогеры — редкость аудитории, промо-посты на карте",
  "",
  "<b>Цена — без IT-жаргона:</b> в отчёте 14 закрытых бизнес-проблем, у рынка это 2,1–3,3 млн ₽. Запрошено — <b>169 000 ₽</b> (~12 100 ₽ за проблему).",
  "",
  "И главное: платформа уже несёт 18 экипажей — построенное для вас работает как актив, а не разовая работа.",
  "",
  "Как добраться до 3 млн — тоже в отчёте: софт готов, и первый шаг бесплатный 😉",
].join("\n");

const DOC_CAPTION = "📎 Полный отчёт — открыть в браузере. Внутри: 14 проблем → решения → рыночные цены, разбор «почему пока не 3 млн» и бесплатный первый шаг.";

const tldrLen = [...TLDR].length;
console.log(`TL;DR length: ${tldrLen} chars (limit 1024)`);
if (tldrLen > 1024) { console.error("TL;DR too long for photo caption — aborting"); process.exit(1); }

const reportB64 = readFileSync(REPORT).toString("base64");
const coverB64 = readFileSync(COVER).toString("base64");
console.log(`report: ${Buffer.byteLength(readFileSync(REPORT))} B, cover: ${Buffer.byteLength(readFileSync(COVER))} B`);

async function forward(chatId, method, payload, files) {
  const resp = await fetch(FORWARD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: FORWARD_ORIGIN },
    body: JSON.stringify({ chat_id: chatId, method, payload, files }),
    signal: AbortSignal.timeout(60000),
  });
  const text = await resp.text();
  try { return { status: resp.status, json: JSON.parse(text) }; }
  catch { return { status: resp.status, json: { ok: false, raw: text.slice(0, 200) } }; }
}

for (const { chat, who } of RECIPIENTS) {
  try {
    // Primary: one album — cover photo with TL;DR + report document
    let r = await forward(chat, "sendMediaGroup", {
      media: [
        { type: "photo", media: "attach://cover", caption: TLDR, parse_mode: "HTML" },
        { type: "document", media: "attach://report", title: "VIP-BIKE · Отчёт по разработке · лето 2026", caption: DOC_CAPTION, parse_mode: "HTML" },
      ],
    }, {
      cover: { data: coverB64, filename: "vip-bike-summer-2026-cover.png", contentType: "image/png" },
      report: { data: reportB64, filename: "vip-bike-dev-summer-2026.html", contentType: "text/html" },
    });
    let ok = r.json?.ok === true;
    console.log(`${who} (${chat}): mediaGroup HTTP ${r.status} ok=${ok} id=${r.json?.message_id ?? "-"}${ok ? "" : " body=" + JSON.stringify(r.json).slice(0, 220)}`);
    // Fallback: two separate messages
    if (!ok) {
      r = await forward(chat, "sendPhoto", { caption: TLDR, parse_mode: "HTML" }, { photo: { data: coverB64, filename: "vip-bike-summer-2026-cover.png", contentType: "image/png" } });
      console.log(`${who} (${chat}): fallback sendPhoto ok=${r.json?.ok} id=${r.json?.message_id ?? r.json?.result?.message_id ?? "-"}`);
      r = await forward(chat, "sendDocument", { caption: DOC_CAPTION, parse_mode: "HTML" }, { document: { data: reportB64, filename: "vip-bike-dev-summer-2026.html", contentType: "text/html" } });
      console.log(`${who} (${chat}): fallback sendDocument ok=${r.json?.ok} id=${r.json?.message_id ?? r.json?.result?.message_id ?? "-"}`);
    }
  } catch (e) {
    console.log(`${who} (${chat}): FAILED — ${e.message}`);
  }
  await new Promise((res) => setTimeout(res, 1200));
}
console.log("done");
