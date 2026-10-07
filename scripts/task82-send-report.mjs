// Task 82: send the summer dev report HTML via the project's forwarding API
// (lib/telegram-transport.ts FORWARD mode — token stays on Vercel).
// Recipients (boss order): salavey13 = 413553377, DJORUDJOV = 7813830016.
// Run: node scripts/task82-send-report.mjs
import { readFileSync } from "node:fs";

const FILE = "/home/z/my-project/download/vip-bike-dev-summer-2026.html";
const FORWARD_URL = process.env.FORWARD_TELEGRAM_URL || "https://v0-car-test.vercel.app/api/forward-telegram";
const FORWARD_ORIGIN = process.env.FORWARD_TELEGRAM_ORIGIN || "https://v0-car-test.vercel.app";
const RECIPIENTS = ["413553377", "7813830016"]; // salavey13 (Paul), DJORUDJOV

const b64 = readFileSync(FILE).toString("base64");
console.log(`file size: ${Buffer.byteLength(readFileSync(FILE))} B, base64: ${b64.length} chars`);

const caption =
  "📄 Отчёт по разработке франшизы VIP-BIKE за лето 2026 — что построено, сколько часов, и почему всё это стоит 169 000 ₽ (спойлер: на рынке — от 1,5 млн). Открывать в браузере 😉";

for (const chatId of RECIPIENTS) {
  try {
    const resp = await fetch(FORWARD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: FORWARD_ORIGIN },
      body: JSON.stringify({
        chat_id: chatId,
        method: "sendDocument",
        payload: { caption, parse_mode: "HTML" },
        files: { document: { data: b64, filename: "vip-bike-dev-summer-2026.html", contentType: "text/html" } },
      }),
      signal: AbortSignal.timeout(30000),
    });
    const text = await resp.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    console.log(`chat ${chatId}: HTTP ${resp.status} ok=${json?.ok} message_id=${json?.message_id ?? json?.result?.message_id ?? "-"} ${json?.ok ? "" : "body=" + text.slice(0, 220)}`);
  } catch (e) {
    console.log(`chat ${chatId}: FAILED — ${e.message}`);
  }
}
console.log("done");
