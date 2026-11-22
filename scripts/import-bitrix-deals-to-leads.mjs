#!/usr/bin/env node
// import-bitrix-deals-to-leads.mjs
//
// Импорт сделок из Bitrix24 (CSV-экспорт сделок, «;»-разделитель, quoted-поля)
// в franchize_intents, чтобы они появились на странице лидов (/franchize/<slug>/leads).
//
// ЗАЧЕМ: менеджеры вели клиентов в старом Bitrix24 — при переезде в Meta-CRM
// эти обращения должны попасть в очередь лидов, а не потеряться. Импорт
// «аккуратный»: дедупликация, существующие лиды ОБНОВЛЯЮТСЯ, дублей нет.
//
// ДЕДУПЛИКАЦИЯ (внутри файла и против БД):
//   1. Телефон (E.164, +7XXXXXXXXXX) — основной ключ. Фиктивные номера
//      (например +79999999999, под которым в Bitrix сидят 6 разных людей)
//      считаются ОТСУТСТВУЮЩИМИ — по ним людей не схлопывают.
//   2. ФИО (фамилия+имя+отчество, нормализованное) — ключ для контактов
//      без телефона; сливается с контактом, у которого телефон есть.
//      Против БД matching по ФИО делается ТОЛЬКО для строк без телефона,
//      чтобы не склеить разных людей с одинаковыми фамилиями.
//   3. Против БД: сначала ищем существующий intent по телефону (колонка
//      phone или metadata.phone), затем (для безтелефонных) по metadata.name.
//
// СЛИЯНИЕ ПРИ ОБНОВЛЕНИИ (никогда не портиим существующие данные):
//   • telegram_user_id — не трогаем НИКОГДА (это TG-identity лида);
//   • phone — только заполняем, если в существующей строке пусто;
//   • urgency_score — только max(существующий, расчётный) — не понижаем;
//   • intent_type/stage — апгрейдим только «слабые» стадии (viewed/clicked/
//     discovered/lead_captured + contact_click); договорные/чековые стадии
//     (contract_generated, checkout_started, …) НИКОГДА не перетираем;
//   • created_at — min(существующий, самая ранняя сделка) — сохраняем историю;
//   • last_seen_at — max(существующий, последняя активность в Bitrix);
//   • metadata — merge: дополняем name/phone/bikeTitle, добавляем блок
//     `bitrix` (список сделок с id/суммами/датами) — не затираем чужие ключи.
//
// БЕЗ ТЕЛЕФОНА (4 контакта в выгрузке + «фиктивные» номера): пишем intent
// с phone=null — серверная выборка лидов такие строки пока пропускает, но
// данные сохранены в БД и подхватятся, как только оператор добавит телефон
// (или сделку создадут через /doc). Скрипт печатает их список для ручной
// доработки.
//
// ЗАПУСК:
//   node scripts/import-bitrix-deals-to-leads.mjs --csv path/to/DEAL.csv            # dry-run (по умолчанию)
//   node scripts/import-bitrix-deals-to-leads.mjs --csv path/to/DEAL.csv --commit   # запись в БД
//   ENV: NEXT_PUBLIC_SUPABASE_URL (или SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
//   Опции: --slug vip-bike (по умолчанию), --csv <file> (по умолчанию берёт
//          последний upload/DEAL_*.csv, если он есть)
//
// Идемпотентен: повторный запуск обновит те же строки, дублей не создаст.

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
  // fallback: latest upload/DEAL_*.csv
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  // В dry-run без БД можно продолжить (parsed-only отчёт), для --commit — фейл.
  if (COMMIT) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (нужны для --commit)");
    process.exit(1);
  }
  console.log("[dry-run] ENV ключи Supabase не заданы — отчёт только по разбору CSV (без сверки с БД).\n");
}

// ── Supabase client (lazy: parsed-only dry-run не требует пакета) ───────────
let supabaseAdmin = null;
if (supabaseUrl && serviceKey) {
  const { createClient } = await import("@supabase/supabase-js");
  supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

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

// ── Helpers ─────────────────────────────────────────────────────────────────
/** E.164 (+7XXXXXXXXXX). Короткие/фиктивные номера → null. */
function normalizePhone(raw) {
  if (!raw) return null;
  const d = String(raw).replace(/\D/g, "");
  if (d.length < 11) return null;
  const last11 = d.slice(-11);
  const phone = "+" + last11;
  // Фиктивные номера Bitrix (заглушка оператора под разными людьми) — не ключ.
  if (/^\+7(9999999999|0000000000|1111111111|1234567890)$/.test(phone)) return null;
  return phone;
}

/** «Рыжаков Александр Григорьевич» → «name:рыжаков александр григорьевич». */
function nameIdentityKey(fullName) {
  const n = (fullName || "")
    .trim()
    .toLowerCase()
    .replace(/[.\s]+/g, " ")
    .replace(/[.]/g, "")
    .trim();
  return n ? `name:${n}` : "";
}

/** «10.08.2026 10:49:19» → «2026-08-10T10:49:19+03:00»-независимо: Date (UTC-agnostic, возвращаем как есть в ISO локали не важно — важно сопоставимость). */
function parseBitrixDate(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) {
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const [, dd, mm, yyyy, hh = "00", mi = "00", ss = "00"] = m;
  // Даты в Bitrix локальные (МСК). Сохраняем как UTC-независимую метку:
  // интерпретируем как локальное время машины — для сортировки/сравнения ок.
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss));
}

/** «10.08 Продажа Falcon Light» → «Falcon Light». */
function cleanBikeTitle(dealTitle) {
  if (!dealTitle) return null;
  let t = String(dealTitle).trim();
  // ведущая дата «10.08», «27.06», время «11:07»
  t = t.replace(/^\d{1,2}[.:]\d{2}\s*/g, "");
  // слова-типы сделок
  t = t.replace(/^(аренда|продажа|тест[\s-]?драйв|покупка)\s*/gi, "");
  t = t.replace(/\s{2,}/g, " ").trim();
  return t || null;
}

const STAGE_TO_INTENT = {
  "аренда": { intent_type: "rent", rank: 4 },
  "продажа": { intent_type: "sale", rank: 3 },
  "тест драйв": { intent_type: "test_drive", rank: 2 },
  "тест-драйв": { intent_type: "test_drive", rank: 2 },
  "новая": { intent_type: "callback_request", rank: 1 },
};

// «слабые» стадии существующих интентов, которые можно апгрейдить импортом
const WEAK_STAGES = new Set(["viewed", "clicked", "discovered", "lead_captured", "contacted"]);
const WEAK_INTENT_TYPES = new Set(["contact_click", "callback_request", "map_click"]);

function urgencyFromLastActivity(lastActivityDate) {
  if (!lastActivityDate) return 20;
  const days = (Date.now() - lastActivityDate.getTime()) / 86400000;
  if (days <= 7) return 65;
  if (days <= 30) return 50;
  if (days <= 60) return 35;
  return 20;
}

// ── 1. Parse CSV → contacts ─────────────────────────────────────────────────
const raw = fs.readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, "");
const table = parseCsv(raw);
const header = table.shift();
const col = (name) => header.indexOf(name);
const g = (row, name) => {
  const i = col(name);
  return i >= 0 ? String(row[i] || "").trim() : "";
};

const deals = [];
for (const r of table) {
  const contactName = g(r, "Контакт");
  const phone = normalizePhone(g(r, "Контакт: Рабочий телефон") || g(r, "Контакт: Мобильный телефон"));
  const created = parseBitrixDate(g(r, "Дата создания"));
  const modified = parseBitrixDate(g(r, "Дата изменения"));
  const lastActivity = parseBitrixDate(g(r, "Последняя активность")) || modified || created;
  const dealStageRaw = g(r, "Стадия сделки").toLowerCase();
  const stageInfo = STAGE_TO_INTENT[dealStageRaw] || STAGE_TO_INTENT["новая"];
  const amountRaw = g(r, "Сумма").replace(/[^\d.,]/g, "").replace(",", ".");
  const amount = amountRaw ? Number(amountRaw) || 0 : 0;
  deals.push({
    dealId: g(r, "ID"),
    dealTitle: g(r, "Название сделки"),
    bikeTitle: cleanBikeTitle(g(r, "Название сделки")),
    stage: g(r, "Стадия сделки"),
    contactName,
    phone,
    created,
    modified,
    lastActivity,
    amount,
    intentRank: stageInfo.rank,
    intentType: stageInfo.intent_type,
    contactSource: g(r, "Контакт: Источник") || null,
  });
}
console.log(`CSV: ${CSV_PATH}`);
console.log(`Сделок в файле: ${deals.length}\n`);

// ── 2. Merge inside CSV ─────────────────────────────────────────────────────
// По валидному телефону; безтелефонные — по ФИО (и сливаются с телефонными
// тёзками, если такие найдутся в файле).
const byPhone = new Map(); // phone → contact
const byName = new Map(); // nameKey → contact (только без телефона)
const mergeDeals = (contact, d) => {
  contact.dealIds.push(d.dealId);
  contact.deals.push({ id: d.dealId, title: d.dealTitle, stage: d.stage, amount: d.amount, created_at: d.created ? d.created.toISOString() : null });
  if (d.intentRank > contact.intentRank) {
    contact.intentRank = d.intentRank;
    contact.intentType = d.intentType;
  }
  if (d.bikeTitle && !contact.bikeTitle) contact.bikeTitle = d.bikeTitle;
  if (!contact.created || (d.created && d.created < contact.created)) contact.created = d.created;
  if (!contact.lastActivity || (d.lastActivity && d.lastActivity > contact.lastActivity)) contact.lastActivity = d.lastActivity;
};

for (const d of deals) {
  if (d.phone) {
    let c = byPhone.get(d.phone);
    if (!c) {
      c = {
        phone: d.phone,
        fullName: d.contactName || null,
        bikeTitle: null,
        created: null,
        lastActivity: null,
        dealIds: [],
        deals: [],
        intentRank: 0,
        intentType: "callback_request",
        contactSource: null,
      };
      byPhone.set(d.phone, c);
    }
    // самое полное ФИО
    if (d.contactName && (!c.fullName || d.contactName.length > c.fullName.length)) c.fullName = d.contactName;
    if (d.contactSource && !c.contactSource) c.contactSource = d.contactSource;
    mergeDeals(c, d);
  } else {
    const nk = nameIdentityKey(d.contactName);
    if (!nk) continue; // нет ни телефона, ни ФИО — некуда привязать
    let c = byName.get(nk);
    if (!c) {
      c = {
        phone: null,
        fullName: d.contactName || null,
        bikeTitle: null,
        created: null,
        lastActivity: null,
        dealIds: [],
        deals: [],
        intentRank: 0,
        intentType: "callback_request",
        contactSource: null,
      };
      byName.set(nk, c);
    }
    if (d.contactSource && !c.contactSource) c.contactSource = d.contactSource;
    mergeDeals(c, d);
  }
}

// Безтелефонные, у которых нашёлся телефонный тёзка в файле → слить туда.
const mergedNoPhone = [];
for (const [nk, c] of [...byName.entries()]) {
  let phoneTwin = null;
  for (const [p, pc] of byPhone.entries()) {
    if (nameIdentityKey(pc.fullName) === nk) {
      phoneTwin = pc;
      break;
    }
  }
  if (phoneTwin) {
    phoneTwin.dealIds.push(...c.dealIds);
    phoneTwin.deals.push(...c.deals);
    if (!phoneTwin.created || (c.created && c.created < phoneTwin.created)) phoneTwin.created = c.created;
    if (!phoneTwin.lastActivity || (c.lastActivity && c.lastActivity > phoneTwin.lastActivity)) phoneTwin.lastActivity = c.lastActivity;
    if (c.intentRank > phoneTwin.intentRank) {
      phoneTwin.intentRank = c.intentRank;
      phoneTwin.intentType = c.intentType;
    }
    mergedNoPhone.push(`${c.fullName} → ${phoneTwin.phone} (слиян в файле)`);
    byName.delete(nk);
  }
}

const contacts = [...byPhone.values(), ...byName.values()];
console.log(`Уникальных контактов: ${contacts.length} (с телефоном: ${byPhone.size}, без телефона: ${byName.size})`);
if (mergedNoPhone.length) {
  console.log(`Слияний внутри файла (ФИО → телефон): ${mergedNoPhone.length}`);
  for (const m of mergedNoPhone) console.log(`  • ${m}`);
}
console.log("");

// ── 3. Match against DB & build upsert plan ─────────────────────────────────
let toInsert = [];
let toUpdate = [];

if (supabaseAdmin) {
  const { data: existing, error } = await supabaseAdmin
    .from("franchize_intents")
    .select("id, phone, telegram_user_id, intent_type, stage, urgency_score, metadata, created_at, last_seen_at")
    .eq("slug", SLUG)
    .neq("stage", "dismissed")
    .order("last_seen_at", { ascending: false })
    .limit(2000);

  if (error) {
    console.error("Не удалось прочитать franchize_intents:", error.message);
    process.exit(1);
  }

  // index existing by phone and by name
  const existingByPhone = new Map();
  const existingByName = new Map();
  for (const row of existing || []) {
    const meta = (row.metadata && typeof row.metadata === "object") ? row.metadata : {};
    const p = normalizePhone(row.phone) || normalizePhone(meta.phone);
    if (p && !existingByPhone.has(p)) existingByPhone.set(p, row);
    const nk = nameIdentityKey(meta.name);
    // по имени индексируем ТОЛЬКО строки без телефона (чтобы не склеивать
    // разных людей), т.к. matching по имени допустим лишь для безтелефонных
    if (!p && nk && !existingByName.has(nk)) existingByName.set(nk, row);
  }
  console.log(`В БД найдено интентов по slug=${SLUG}: ${existing?.length || 0} (с телефоном: ${existingByPhone.size})\n`);

  for (const c of contacts) {
    const bitrixBlock = {
      source: "bitrix24_csv",
      importedAt: new Date().toISOString(),
      dealCount: c.deals.length,
      deals: c.deals.slice(0, 20), // не раздуваем metadata безмерно
      contactSource: c.contactSource,
    };
    const existingRow = (c.phone && existingByPhone.get(c.phone)) || (c.phone ? null : existingByName.get(nameIdentityKey(c.fullName)));

    if (existingRow) {
      // ── UPDATE: аккуратное слияние, ничего не ломаем ──
      const meta = { ...(existingRow.metadata && typeof existingRow.metadata === "object" ? existingRow.metadata : {}) };
      if (!meta.name && c.fullName) meta.name = c.fullName;
      if (!meta.phone && c.phone) meta.phone = c.phone;
      if (!meta.bikeTitle && c.bikeTitle) meta.bikeTitle = c.bikeTitle;
      meta.bitrix = bitrixBlock;

      const patch = {
        id: existingRow.id,
        slug: SLUG,
        metadata: meta,
        updated_at: new Date().toISOString(),
      };
      // телефон — только заполняем пустое
      if (c.phone && !existingRow.phone) patch.phone = c.phone;
      // история: создан раньше — оставляем как есть (не подменяем);
      // last_seen — самое позднее
      const csvLast = c.lastActivity ? c.lastActivity.toISOString() : null;
      if (csvLast && (!existingRow.last_seen_at || csvLast > existingRow.last_seen_at)) {
        patch.last_seen_at = csvLast;
      }
      const csvFirst = c.created ? c.created.toISOString() : null;
      if (csvFirst && (!existingRow.created_at || csvFirst < existingRow.created_at)) {
        patch.created_at = csvFirst;
      }
      // срочность — не понижаем
      const u = urgencyFromLastActivity(c.lastActivity);
      if (u > (existingRow.urgency_score ?? 0)) patch.urgency_score = u;
      // intent_type/stage — апгрейд только слабых
      const isWeak = WEAK_STAGES.has(existingRow.stage || "") || WEAK_INTENT_TYPES.has(existingRow.intent_type || "");
      if (isWeak) {
        patch.intent_type = c.intentType;
        patch.stage = "contacted";
      }
      if (!existingRow.source_route) patch.source_route = "bitrix24-import";
      if (!existingRow.contact_channel) patch.contact_channel = "phone";

      toUpdate.push({ patch, contact: c, existingRow });
    } else {
      // ── INSERT: нового лида ──
      const meta = {
        name: c.fullName || null,
        phone: c.phone || null,
        bikeTitle: c.bikeTitle || null,
        bitrix: bitrixBlock,
      };
      toInsert.push({
        slug: SLUG,
        bike_id: null,
        intent_type: c.intentType,
        stage: "contacted", // менеджер уже общался (источник «Звонок») → «Нужен контакт» в воронке
        source_route: "bitrix24-import",
        contact_channel: "phone",
        urgency_score: urgencyFromLastActivity(c.lastActivity),
        telegram_user_id: null,
        phone: c.phone || null,
        metadata: meta,
        created_at: c.created ? c.created.toISOString() : new Date().toISOString(),
        last_seen_at: c.lastActivity ? c.lastActivity.toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }
} else {
  // parsed-only отчёт (нет ENV) — всё считаем «новыми» для планирования
  toInsert = contacts.map((c) => ({
    slug: SLUG,
    intent_type: c.intentType,
    stage: "contacted",
    phone: c.phone || null,
    urgency_score: urgencyFromLastActivity(c.lastActivity),
    metadata: { name: c.fullName, phone: c.phone, bikeTitle: c.bikeTitle, bitrix: { source: "bitrix24_csv", dealCount: c.deals.length } },
    created_at: c.created ? c.created.toISOString() : null,
    last_seen_at: c.lastActivity ? c.lastActivity.toISOString() : null,
  }));
}

// ── 4. Report ───────────────────────────────────────────────────────────────
console.log("──────────────────────────────────────────────────────────────");
console.log(`ПЛАН ИМПОРТА (slug=${SLUG}${COMMIT ? ", COMMIT" : ", DRY-RUN"}):`);
console.log(`  • обновить существующих лидов: ${toUpdate.length}`);
console.log(`  • создать новых лидов:         ${toInsert.length}`);
const noPhone = toInsert.filter((r) => !r.phone);
if (noPhone.length) {
  console.log(`  • из них БЕЗ ТЕЛЕФОНА (в UI появятся после добавления телефона): ${noPhone.length}`);
  for (const r of noPhone) {
    console.log(`      — ${r.metadata?.name || r.metadata?.bitrix?.contactSource || "(без имени)"} (сделок: ${r.metadata?.bitrix?.dealCount ?? "?"})`);
  }
}
console.log("");

if (toUpdate.length) {
  console.log("ОБНОВЛЯЕМЫЕ (телефон → что произойдёт):");
  for (const { patch, contact, existingRow } of toUpdate.slice(0, 30)) {
    const bits = [];
    if (patch.phone) bits.push("phone заполнен");
    if (patch.intent_type) bits.push(`${existingRow.intent_type}/${existingRow.stage} → ${patch.intent_type}/${patch.stage}`);
    if (patch.urgency_score) bits.push(`urgency → ${patch.urgency_score}`);
    if (patch.last_seen_at) bits.push(`last_seen → ${patch.last_seen_at.slice(0, 10)}`);
    console.log(`  • ${contact.phone || "(без тел)"} ${contact.fullName || ""}: ${bits.join("; ") || "только metadata.bitrix"}`);
  }
  if (toUpdate.length > 30) console.log(`  … и ещё ${toUpdate.length - 30}`);
  console.log("");
}

if (toInsert.length) {
  console.log("НОВЫЕ (телефон, ФИО, intent, срочность):");
  for (const r of toInsert.slice(0, 40)) {
    console.log(`  • ${r.phone || "(без телефона)"} — ${r.metadata?.name || "—"} [${r.intent_type}/${r.stage}, u=${r.urgency_score}]`);
  }
  if (toInsert.length > 40) console.log(`  … и ещё ${toInsert.length - 40}`);
  console.log("");
}

// ── 5. Commit ───────────────────────────────────────────────────────────────
if (!COMMIT) {
  console.log("DRY-RUN: записи нет. Для записи запустите с --commit.");
  process.exit(0);
}

if (!supabaseAdmin) {
  console.error("Нет ключей Supabase — commit невозможен.");
  process.exit(1);
}

let inserted = 0;
let updated = 0;
const errors = [];

if (toInsert.length) {
  // чанками по 100
  for (let i = 0; i < toInsert.length; i += 100) {
    const chunk = toInsert.slice(i, i + 100);
    const { error } = await supabaseAdmin.from("franchize_intents").insert(chunk);
    if (error) {
      errors.push(`insert chunk ${i / 100 + 1}: ${error.message}`);
      console.error("Insert error:", error.message, JSON.stringify(error.details || ""));
    } else inserted += chunk.length;
  }
}

if (toUpdate.length) {
  for (const { patch } of toUpdate) {
    const { id, ...fields } = patch;
    const { error } = await supabaseAdmin
      .from("franchize_intents")
      .update(fields)
      .eq("id", id);
    if (error) {
      errors.push(`update ${id}: ${error.message}`);
      console.error(`Update error (${id}):`, error.message);
    } else updated++;
  }
}

console.log("──────────────────────────────────────────────────────────────");
console.log(`ГОТОВО: создано ${inserted}, обновлено ${updated}${errors.length ? `, ошибок: ${errors.length}` : ""}.`);
if (errors.length) {
  for (const e of errors.slice(0, 10)) console.error("  •", e);
  process.exit(1);
}
