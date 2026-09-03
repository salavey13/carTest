#!/usr/bin/env node
// import-bitrix-deal-notes.mjs
//
// Импорт ИСТОРИИ СДЕЛОК из Bitrix24 (CSV-экспорт сделок, «;»-разделитель) как
// ЗАМЕТОК (lead_notes) к уже импортированным лидам.
//
// ЗАЧЕМ: сделки Bitrix импортировались в franchize_intents
// (scripts/import-bitrix-deals-to-leads.mjs) — контекст сделок (стадии, суммы,
// даты, последняя активность) сохранился только в metadata.bitrix, где
// оператор его НЕ видит. На странице лидов видны только заметки — этот скрипт
// переносит контекст каждой сделки в lead_notes, чтобы оператор сразу видел
// «что происходило с этим человеком в Bitrix».
//
// ВАЖНО ПРО «КОММЕНТАРИИ»: колонки «Комментарий» / «Контакт: Комментарий» /
// «Описание события» в CSV-экспорте сделок пустые — Bitrix24 не выгружает
// timeline-комментарии в стандартном экспорте сделок. Если комментарии велись
// в timeline, их нужно экспортировать отдельно. Этот скрипт переносит ВСЁ,
// что выгрузка реально содержит: список сделок контакта (стадия, сумма,
// название, даты создания/изменения, последняя активность, источник).
//
// МАТЧИНГ (идентичен основному импорту):
//   1. Телефон (E.164) — основной ключ. Фиктивные номера пропускаются.
//   2. ФИО (metadata.name, нормализованное) — для контактов без телефона.
//   lead_id заметки = intent.phone (UI-ключ лида). Лиды без телефона в UI
//   не видны — для них заметка не создаётся (печатается в отчёт).
//
// ИДЕМПОТЕНТНОСТЬ: повторный запуск пропускает лидов, у которых уже есть
// заметка-импорт (маркер created_by = BITRIX_NOTES_AUTHOR).
//
// ЗАПУСК:
//   node scripts/import-bitrix-deal-notes.mjs --csv path/to/DEAL.csv            # dry-run
//   node scripts/import-bitrix-deal-notes.mjs --csv path/to/DEAL.csv --commit   # запись
//   ENV: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import fs from "node:fs";
import path from "node:path";

// ── CLI args ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const argValue = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
};
const COMMIT = argv.includes("--commit");
const SLUG = argValue("slug") || "vip-bike";
let CSV_PATH = argValue("csv");
if (!CSV_PATH) {
  const uploadDir = path.join(process.cwd(), "upload");
  if (fs.existsSync(uploadDir)) {
    const candidates = fs
      .readdirSync(uploadDir)
      .filter((f) => /^DEAL_.*\.csv$/i.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(uploadDir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    if (candidates.length > 0) CSV_PATH = path.join(uploadDir, candidates[0].f);
  }
}

if (!CSV_PATH || !fs.existsSync(CSV_PATH)) {
  console.error("CSV не найден. Укажите --csv <путь> или положите файл в upload/DEAL_*.csv");
  process.exit(1);
}

// Автор заметки-импорта. Нечисловое значение НЕ резолвится через users и
// отображается в UI как есть — честная подпись «это системный импорт».
const BITRIX_NOTES_AUTHOR = "Bitrix24 импорт";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");
const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// ── CSV parsing (semicolon-separated, quoted fields, UTF-8 BOM) ─────────────
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ";") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c !== "\r") field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ── Helpers (как в import-bitrix-deals-to-leads.mjs) ────────────────────────
function normalizePhone(raw) {
  if (!raw) return null;
  const d = String(raw).replace(/\D/g, "");
  if (d.length < 11) return null;
  const phone = "+" + d.slice(-11);
  if (/^\+7(9999999999|0000000000|1111111111|1234567890)$/.test(phone)) return null;
  return phone;
}

function nameIdentityKey(fullName) {
  const n = (fullName || "")
    .trim()
    .toLowerCase()
    .replace(/[.\s]+/g, " ")
    .replace(/[.]/g, "")
    .trim();
  return n ? `name:${n}` : "";
}

function fmtMoney(amount) {
  if (!amount) return null;
  return amount.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " ₽";
}

/** «Аренда Зубика» → «Зубика» — человекочитаемое название без типа сделки. */
function cleanDealTitle(title) {
  if (!title) return null;
  let t = String(title).trim();
  t = t.replace(/^\d{1,2}[.:]\d{2}\s*/g, "");
  t = t.replace(/^(аренда|продажа|тест[\s-]?драйв|покупка)\s*/gi, "");
  t = t.replace(/\s{2,}/g, " ").trim();
  return t || String(title).trim();
}

// ── 1. Parse CSV → deals per contact ────────────────────────────────────────
const raw = fs.readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, "");
const table = parseCsv(raw);
const header = table.shift();
const col = (name) => header.indexOf(name);
const g = (row, name) => {
  const i = col(name);
  return i >= 0 ? String(row[i] || "").trim() : "";
};

// Диагностика «комментариев» — честно сообщаем, что выгрузка содержит.
const commentCols = ["Комментарий", "Контакт: Комментарий", "Описание события", "Дата события"];
const commentStats = {};
for (const c of commentCols) {
  const i = col(c);
  commentStats[c] = i >= 0 ? table.filter((r) => String(r[i] || "").trim()).length : -1;
}

const contacts = new Map(); // key (phone | nameKey) → contact
const dealRows = [];
for (const r of table) {
  const phone = normalizePhone(g(r, "Контакт: Рабочий телефон") || g(r, "Контакт: Мобильный телефон"));
  const contactName = g(r, "Контакт") || null;
  const key = phone || nameIdentityKey(contactName);
  if (!key) continue;
  let c = contacts.get(key);
  if (!c) {
    c = { phone, fullName: contactName, deals: [], lastActivity: null, contactSource: null };
    contacts.set(key, c);
  }
  if (contactName && (!c.fullName || contactName.length > c.fullName.length)) c.fullName = contactName;
  const src = g(r, "Контакт: Источник");
  if (src && !c.contactSource) c.contactSource = src;
  const activity = g(r, "Последняя активность");
  if (activity && (!c.lastActivity || activity > c.lastActivity)) c.lastActivity = activity;

  c.deals.push({
    id: g(r, "ID"),
    title: g(r, "Название сделки"),
    shortTitle: cleanDealTitle(g(r, "Название сделки")),
    stage: g(r, "Стадия сделки"),
    amount: Number(g(r, "Сумма").replace(/[^\d.,]/g, "").replace(",", ".")) || 0,
    created: g(r, "Дата создания"),
    modified: g(r, "Дата изменения"),
    closed: g(r, "Сделка закрыта"),
  });
  dealRows.push(1);
}

const withComments = Object.entries(commentStats)
  .map(([c, n]) => `${c}: ${n < 0 ? "нет колонки" : n}`)
  .join("; ");
console.log(`CSV: ${CSV_PATH}`);
console.log(`Сделок: ${dealRows.length}, уникальных контактов: ${contacts.size}`);
console.log(`Комментарии в выгрузке → ${withComments}`);
console.log("");

// ── 2. Match against DB ─────────────────────────────────────────────────────
const { data: existing, error } = await supabaseAdmin
  .from("franchize_intents")
  .select("id, phone, telegram_user_id, metadata")
  .eq("slug", SLUG)
  .neq("stage", "dismissed")
  .limit(3000);

if (error) {
  console.error("Не удалось прочитать franchize_intents:", error.message);
  process.exit(1);
}

const byPhone = new Map();
const byName = new Map();
for (const row of existing || []) {
  const meta = (row.metadata && typeof row.metadata === "object") ? row.metadata : {};
  const p = normalizePhone(row.phone) || normalizePhone(meta.phone);
  if (p && !byPhone.has(p)) byPhone.set(p, row);
  const nk = nameIdentityKey(meta.name);
  if (!p && nk && !byName.has(nk)) byName.set(nk, row);
}
console.log(`Интентов в БД (slug=${SLUG}): ${(existing || []).length}; с телефоном: ${byPhone.size}`);

// ── 3. Idempotency: пропускаем лидов, у которых импорт-заметка уже есть ──────
const { data: crew } = await supabaseAdmin
  .from("crews")
  .select("id")
  .eq("slug", SLUG)
  .maybeSingle();
if (!crew) {
  console.error(`Экипаж ${SLUG} не найден.`);
  process.exit(1);
}
const { data: importedNotes } = await supabaseAdmin
  .from("lead_notes")
  .select("lead_id")
  .eq("crew_id", crew.id)
  .eq("created_by", BITRIX_NOTES_AUTHOR);
const alreadyImported = new Set((importedNotes || []).map((n) => n.lead_id));
console.log(`Уже с импорт-заметкой: ${alreadyImported.size} (пропускаем — идемпотентность)`);

// ── 4. Build notes plan ─────────────────────────────────────────────────────
const notesToInsert = [];
const skipped = [];
for (const [key, c] of contacts.entries()) {
  const intent = (c.phone && byPhone.get(c.phone)) || (!c.phone && byName.get(key)) || null;
  if (!intent) {
    skipped.push(`нет лида в БД: ${c.phone || c.fullName}`);
    continue;
  }
  // UI-ключ лида: telegram_user_id || нормализованный телефон. У импортированных
  // bitrix-лидов telegram_user_id = null → ключ = телефон. Без телефона лид в
  // UI не виден — заметка бессмысленна.
  const leadId = intent.telegram_user_id || normalizePhone(intent.phone) || normalizePhone(intent.metadata?.phone);
  if (!leadId) {
    skipped.push(`лид без телефона (не виден в UI): ${c.fullName || key}`);
    continue;
  }
  if (alreadyImported.has(leadId)) continue;

  const lines = [];
  lines.push(`[Bitrix24 · история сделок — импорт из CRM]`);
  for (const d of c.deals.slice(0, 10)) {
    const bits = [`№${d.id}`];
    if (d.shortTitle) bits.push(`«${d.shortTitle}»`);
    bits.push(`стадия: ${d.stage || "—"}`);
    const money = fmtMoney(d.amount);
    if (money && d.amount > 0) bits.push(money);
    if (d.created) bits.push(`создана ${d.created}`);
    if (d.modified && d.modified !== d.created) bits.push(`изменена ${d.modified}`);
    lines.push(`• ${bits.join(" — ")}`);
  }
  if (c.deals.length > 10) lines.push(`… ещё ${c.deals.length - 10} сделок`);
  const tail = [];
  if (c.contactSource) tail.push(`источник: ${c.contactSource}`);
  if (c.lastActivity) tail.push(`последняя активность в Bitrix: ${c.lastActivity}`);
  if (tail.length) lines.push(tail.join("; ") + ".");

  notesToInsert.push({
    lead_id: leadId,
    crew_id: crew.id,
    text: lines.join("\n"),
    created_by: BITRIX_NOTES_AUTHOR,
  });
}

console.log("");
console.log(`──────────────────────────────────────────────────────────────`);
console.log(`ПЛАН (slug=${SLUG}${COMMIT ? ", COMMIT" : ", DRY-RUN"}):`);
console.log(`  • создать заметок: ${notesToInsert.length}`);
console.log(`  • пропущено (нет лида/без телефона): ${skipped.length}`);
for (const s of skipped.slice(0, 15)) console.log(`      — ${s}`);
if (skipped.length > 15) console.log(`      … ещё ${skipped.length - 15}`);
console.log("");
if (notesToInsert.length > 0) {
  console.log("Пример заметки:");
  console.log(notesToInsert[0].text.split("\n").map((l) => "    | " + l).join("\n"));
}
console.log("");

if (!COMMIT) {
  console.log("DRY-RUN: записи нет. Для записи запустите с --commit.");
  process.exit(0);
}

let inserted = 0;
const errors = [];
for (let i = 0; i < notesToInsert.length; i += 50) {
  const chunk = notesToInsert.slice(i, i + 50);
  const { error: insErr } = await supabaseAdmin.from("lead_notes").insert(chunk);
  if (insErr) {
    errors.push(`chunk ${i / 50 + 1}: ${insErr.message}`);
    console.error("Insert error:", insErr.message, JSON.stringify(insErr.details || ""));
  } else inserted += chunk.length;
}

console.log(`──────────────────────────────────────────────────────────────`);
console.log(`ГОТОВО: создано ${inserted} заметок${errors.length ? `, ошибок: ${errors.length}` : ""}.`);
if (errors.length) {
  for (const e of errors.slice(0, 10)) console.error("  •", e);
  process.exit(1);
}
