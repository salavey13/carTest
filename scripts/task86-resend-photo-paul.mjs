// Task 86 fix: re-send the cover photo + TL;DR to salavey13 (photo leg failed first run)
import { readFileSync } from "node:fs";

const COVER = "/home/z/my-project/download/vip-bike-report-cover.png";
const FORWARD_URL = "https://v0-car-test.vercel.app/api/forward-telegram";
const FORWARD_ORIGIN = "https://v0-car-test.vercel.app";

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

const coverB64 = readFileSync(COVER).toString("base64");
const resp = await fetch(FORWARD_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: FORWARD_ORIGIN },
  body: JSON.stringify({
    chat_id: "413553377",
    method: "sendPhoto",
    payload: { caption: TLDR, parse_mode: "HTML" },
    files: { photo: { data: coverB64, filename: "vip-bike-summer-2026-cover.png", contentType: "image/png" } },
  }),
  signal: AbortSignal.timeout(60000),
});
const text = await resp.text();
console.log(`salavey13 (413553377): sendPhoto HTTP ${resp.status} body=${text.slice(0, 400)}`);
