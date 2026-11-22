// Task 87: send the regenerated Aprilia contract to the client (561091269)
// via the project forward API (token stays on Vercel). Run: node --env-file=.env.local scripts/task87-send-doc.mjs
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const FORWARD_URL = "https://v0-car-test.vercel.app/api/forward-telegram";
const FORWARD_ORIGIN = "https://v0-car-test.vercel.app";

const STORAGE_PATH = "vip-bike/rental-aprilia-shiver-1791646366332.docx";
const CLIENT = "561091269";

const { data: blob, error } = await sb.storage.from("rental-contracts").download(STORAGE_PATH);
if (error || !blob) { console.error("download failed:", error?.message); process.exit(1); }
const buf = Buffer.from(await blob.arrayBuffer());
console.log(`doc downloaded: ${buf.length} B`);

const caption = [
  "Виктория, добрый день! 👋",
  "",
  "Фиксируем замену мотоцикла: в начале аренды вместо Honda CBR600RR вы катались на <b>Aprilia Shiver 750</b>. Договор переоформлен — условия те же: период 09.10–10.10, тариф 10 000 ₽/день + шлем, залог 20 000 ₽. Одометр зафиксирован: 49 547 → 49 755 км (208 км).",
  "",
  "Файлом — обновлённый договор с актом приёма-передачи; прежний договор по Honda считается расторгнутым.",
  "",
  "Спасибо, что выбираете VIP-BIKE! 🏍",
].join("\n");

const resp = await fetch(FORWARD_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: FORWARD_ORIGIN },
  body: JSON.stringify({
    chat_id: CLIENT,
    method: "sendDocument",
    payload: { caption, parse_mode: "HTML" },
    files: { document: { data: buf.toString("base64"), filename: "dogovor-arenda-aprilia-shiver-10.10.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } },
  }),
  signal: AbortSignal.timeout(60000),
});
const text = await resp.text();
console.log(`client 561091269: HTTP ${resp.status} ${text.slice(0, 300)}`);
