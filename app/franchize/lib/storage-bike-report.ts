// /app/franchize/lib/storage-bike-report.ts
// ─────────────────────────────────────────────────────────────────────────────
// «Отчёт по хранению» — pure markdown builder for the «Хранение» wall/story
// report pill (2026-09-27). Мотопарк-parity: every storage bike ships a
// one-pager the owner (or crew) can keep/forward, boss format — summary +
// table + links:
//
//   # Хранение — SYM LM 25 (1110 XX52)
//
//   - Экипаж: VIP BIKE
//   - Статус: 🧊 На хранении
//   - Отчёт сформирован: 27.09.2026 14:02 МСК
//
//   ## Сводка
//   - Сезон: 15.10.2026 — 01.06.2027 (7,5 месяца)
//   - Ставка: 2 000 ₽/мес · Итого за сезон: **15 000 ₽**
//   - Оплата: **оплачено до 01.06.2027**
//   - Оценочная стоимость (ответственность Хранителя): **200 000 ₽**
//   - Место хранения: Стригинский переулок, 13Б
//
//   ## Мотоцикл / ## Владелец / ## История (events table) / ## Документы
//
// Pure by design: NO supabase, NO React — the server action loads the VM and
// resolves the bot username, this module only formats. Tests import directly.
// All wall-clock rendering is MSK (+03:00 fixed offset — the app tz).
// ─────────────────────────────────────────────────────────────────────────────

import {
  STORAGE_STATUS_META,
  storageEventLabel,
  storageIsoToRu,
  storagePaidCovered,
  type StorageBikeVM,
} from "@/app/franchize/lib/storage";

export interface StorageReportInput {
  bike: StorageBikeVM;
  /** «VIP_BIKE» — crews.name; underscores prettified to spaces. */
  crewName: string;
  /** bot username for the wall deep link, default «oneBikePlsBot». */
  botUsername?: string;
  /** Absolute wall URL (server action builds the startapp link — it knows the slug). */
  wallUrl?: string;
  /** Absolute contract URL — a 1h SIGNED url minted by the gated server action. */
  docUrl?: string;
  /** injectable clock (tests); defaults to Date.now() */
  nowMs?: number;
}

export interface StorageReportResult {
  markdown: string;
  filename: string;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Header/cell strings are crew/owner-controlled DB inputs — keep single-line. */
function line(s: string): string {
  return String(s || "")
    .replace(/\s*[\r\n]+\s*/g, " ")
    .trim();
}

/** Table cells must never break the markdown table: strip pipes/newlines. */
function cell(text: string): string {
  return line(text).replace(/\|/g, "/");
}

function mskParts(iso: string | null | undefined): { d: number; m: number; y: number; hh: number; mm: number } | null {
  const ts = Date.parse(iso || "");
  if (Number.isNaN(ts)) return null;
  const d = new Date(ts + 3 * 60 * 60 * 1000);
  return { d: d.getUTCDate(), m: d.getUTCMonth() + 1, y: d.getUTCFullYear(), hh: d.getUTCHours(), mm: d.getUTCMinutes() };
}

/** «27.09.2026 14:02» (MSK) or «—». */
export function storageReportDateTime(iso: string | null | undefined): string {
  const p = mskParts(iso);
  return p ? `${pad2(p.d)}.${pad2(p.m)}.${p.y} ${pad2(p.hh)}:${pad2(p.mm)}` : "—";
}

/** «21 000 ₽» — ru-RU grouping with plain ASCII spaces (file-safe, no NBSP). */
export function storageReportMoney(rub: number): string {
  return `${Math.round(rub || 0).toLocaleString("ru-RU").replace(/\u00A0/g, " ")} ₽`;
}

/** 📝 Заявка / 🧊 На хранении / 🤝 Возвращён / ✖ Отменена — meta emoji vocabulary. */
export function storageReportStatusLabel(status: string | null | undefined): string {
  const key = (String(status || "") || "requested") as keyof typeof STORAGE_STATUS_META;
  const meta = STORAGE_STATUS_META[key];
  return meta ? `${meta.emoji} ${meta.label}` : `⚪️ ${String(status || "—")}`;
}

/** «оплачено до 01.06.2027» / «ОПЛАТА ПРОСРОЧЕНА (до 01.06.2027)» / «не оплачено». */
export function storageReportPaymentLine(paidUntil: string | null | undefined, nowMs: number): string {
  if (!paidUntil) return "не оплачено";
  const ru = storageIsoToRu(String(paidUntil));
  if (!ru) return "не оплачено";
  return storagePaidCovered(String(paidUntil), nowMs)
    ? `оплачено до ${ru}`
    : `ОПЛАТА ПРОСРОЧЕНА (была до ${ru})`;
}

const MAX_REPORT_EVENTS = 500;

export function buildStorageBikeReport(input: StorageReportInput): StorageReportResult {
  const now = input.nowMs ?? Date.now();
  const bot = (input.botUsername || "oneBikePlsBot").trim() || "oneBikePlsBot";
  const bike = input.bike;
  const crewPretty = line(String(input.crewName || "").trim().replace(/_/g, " ")) || "—";

  const titleBits = [line(bike.bikeTitle || "Мотоцикл")];
  if (bike.regNumber) titleBits.push(line(bike.regNumber));

  const season =
    bike.seasonStart && bike.seasonEnd
      ? `${storageIsoToRu(bike.seasonStart)} — ${storageIsoToRu(bike.seasonEnd)}${bike.monthsLabel ? ` (${bike.monthsLabel})` : ""}`
      : "—";

  const events = [...(Array.isArray(bike.events) ? bike.events : [])].sort(
    (a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""),
  );
  const truncated = events.length - MAX_REPORT_EVENTS;
  const rows = truncated > 0 ? events.slice(0, MAX_REPORT_EVENTS) : events;

  // Фотофиксация counts (v3): photos ride on any event — the summary names the
  // acceptance/return anchor points, the history table marks each event.
  // Totals run over the FULL history (pre-slice) — the summary line claims a
  // total, so truncation must not undercount it (boss review R1 finding #5).
  const photoCount = (list: StorageBikeVM["events"]) =>
    list.reduce((sum, e) => sum + (Array.isArray(e.photoUrls) ? e.photoUrls.length : 0), 0);
  const photosByStatus = (status: string, list: StorageBikeVM["events"]): number =>
    photoCount(list.filter((e) => e.type === "status_changed" && e.status === status));
  const photosTotal = photoCount(events);
  const photosAccepted = photosByStatus("in_storage", events);
  const photosReturned = photosByStatus("returned", events);

  const L: string[] = [];
  L.push(`# Хранение — ${titleBits.join(" (")}${titleBits.length > 1 ? ")" : ""}`);
  L.push("");
  L.push(`- Экипаж: ${crewPretty}`);
  L.push(`- Статус: ${storageReportStatusLabel(bike.status)}`);
  L.push(`- Отчёт сформирован: ${storageReportDateTime(new Date(now).toISOString())} МСК`);
  L.push("");
  L.push("## Сводка");
  L.push("");
  L.push(`- Сезон: ${season}`);
  L.push(
    `- Ставка: ${storageReportMoney(bike.monthlyPriceRub)}/мес · Итого за сезон: **${storageReportMoney(bike.totalPriceRub)}**`,
  );
  L.push(`- Оплата: **${storageReportPaymentLine(bike.paidUntil, now)}**`);
  L.push(`- Оценочная стоимость (ответственность Хранителя): **${storageReportMoney(bike.estimatedValueRub)}**`);
  L.push(`- Место хранения: ${line(bike.storageAddress) || "—"} · не для аренды ❄️`);
  if (photosTotal > 0) {
    L.push(`- Фотофиксация: **${photosTotal} фото** (приём — ${photosAccepted}, возврат — ${photosReturned}, остальное — осмотры)`);
  }
  L.push("");
  L.push("## Мотоцикл");
  L.push("");
  L.push(`- Марка/модель: ${line(bike.bikeTitle) || "—"}`);
  L.push(`- Год: ${bike.year ?? "—"} · Цвет: ${line(bike.color) || "—"}`);
  L.push(`- Гос. номер: ${line(bike.regNumber) || "—"} · VIN: ${line(bike.vin) || "—"}`);
  L.push(`- Пробег: ${bike.mileageKm != null ? `${bike.mileageKm} км` : "—"}`);
  L.push(`- Комплектность: ${line(bike.accessories) || "—"}`);
  L.push(`- Адрес для уведомлений: ${line(bike.noticeAddress) || "—"}`);
  L.push("");
  L.push("## Владелец");
  L.push("");
  L.push(`- ФИО: ${line(bike.ownerName) || "—"}`);
  L.push(`- Телефон: ${line(bike.ownerPhone) || "—"}`);
  L.push(`- ПЭП: ${bike.pepSigned ? "подписан (ст. 5–6 63-ФЗ)" : "не подписан"}`);
  L.push("");
  L.push("## История");
  L.push("");
  if (rows.length === 0) {
    L.push("Событий пока не было.");
    L.push("");
  } else {
    L.push("| # | Когда (МСК) | Событие | Кто | Комментарий |");
    L.push("|---|---|---|---|---|");
    rows.forEach((event, i) => {
      const what =
        event.type === "status_changed" && event.status
          ? `${storageEventLabel(event.type)}: ${storageReportStatusLabel(event.status)}`
          : storageEventLabel(event.type);
      const whatWithPhotos =
        Array.isArray(event.photoUrls) && event.photoUrls.length > 0 ? `${what} · 📸 ${event.photoUrls.length}` : what;
      L.push(
        `| ${i + 1} | ${cell(storageReportDateTime(event.createdAt))} | ${cell(whatWithPhotos)} | ${cell(event.actorName || "—")} | ${cell(event.message || "—")} |`,
      );
    });
    if (truncated > 0) {
      L.push("");
      L.push(`_Показаны последние ${MAX_REPORT_EVENTS} событий — всего ${truncated + MAX_REPORT_EVENTS}, более старые усечены._`);
    }
    L.push("");
  }

  L.push("## Документы и ссылки");
  L.push("");
  let docIndex = 1;
  L.push(`${docIndex}. Стена «Хранение» в мини-аппе: ${input.wallUrl || `t.me/${bot}/app`}`);
  if (input.docUrl) {
    docIndex += 1;
    // R3: the url is a 1-hour signed link (PII inside) — say so in the report.
    L.push(`${docIndex}. Договор хранения (DOCX): ${input.docUrl}`);
    L.push(`   ссылка действует 1 час — свежую выдаст кнопка «Договор» в карточке`);
  }

  const day = new Date(now + 3 * 60 * 60 * 1000);
  const stamp = `${day.getUTCFullYear()}-${pad2(day.getUTCMonth() + 1)}-${pad2(day.getUTCDate())}`;
  const fileKey = (bike.regNumber || bike.id || "bike").replace(/[^a-zA-Z0-9._-]+/g, "-");
  const filename = `storage_${fileKey}_${stamp}.md`;

  return { markdown: `${L.join("\n")}\n`, filename };
}
