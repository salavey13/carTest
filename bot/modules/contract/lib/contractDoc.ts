/**
 * lib/contractDoc.ts
 * Генератор договора аренды электромотоцикла на базе docxtemplater.
 * Вход: Lessor + Client + BikeUnit + RentalContract (из БД).
 * Выход: { buffer: Buffer, sha256: string }
 *
 * Шаблон: templates/contract-rental.docx
 * Плейсхолдеры: см. _planning/TRACK-A-docx-log.md
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// createRequire нужен для CJS-пакетов в ESM-модуле
const _require = createRequire(import.meta.url);
/* eslint-disable @typescript-eslint/no-explicit-any */
const PizZip = _require('pizzip') as new (data: Buffer) => any;
const Docxtemplater = _require('docxtemplater') as new (zip: any, opts: any) => any;
/* eslint-enable @typescript-eslint/no-explicit-any */

import type { Lessor, Client, BikeUnit, RentalContract } from './types.js';

const TEMPLATES_DIR = path.resolve(__dirname, '..', 'templates');

/**
 * Выбор шаблона:
 *   sale → templates/sale/contract-sale.docx
 *   rental per-model (templates/by-model/<slug>.docx) → если есть для этой модели
 *   rental fallback → templates/contract-rental.docx
 * Per-model шаблоны содержат байк/реквизиты/тарифы литералом, плейсхолдеры только клиент+сделка.
 */
function resolveTemplatePath(
  modelSlug: string | null,
  contractType: 'rental' | 'sale' = 'rental',
): string {
  if (contractType === 'sale') {
    return path.join(TEMPLATES_DIR, 'sale', 'contract-sale.docx');
  }
  if (modelSlug) {
    // path.basename — защита от traversal, если в БД оказался кривой slug ('../..')
    const safeSlug = path.basename(modelSlug);
    const perModel = path.join(TEMPLATES_DIR, 'by-model', `${safeSlug}.docx`);
    if (fs.existsSync(perModel)) return perModel;
  }
  return path.join(TEMPLATES_DIR, 'contract-rental.docx');
}

// ── Date formatting helpers ────────────────────────────────────────────────

const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

// Договор оформляется в Нижнем Новгороде → все даты/время фиксируем в МСК,
// независимо от таймзоны сервера (на UTC-VPS иначе сдвиг −3ч + нестабильный sha256).
const TZ = 'Europe/Moscow';

/** Разбор ISO-строки на компоненты даты/времени в зоне Europe/Moscow. */
function moscowParts(iso: string): {
  day: string; monthIdx: number; mm: string; year: string; hh: string; min: string;
} | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return {
    day: p.day, monthIdx: Number(p.month) - 1, mm: p.month, year: p.year,
    hh: p.hour, min: p.minute,
  };
}

/** ISO date/datetime string → «ДД» месяц ГГГГ  (for contract date in header) */
function fmtContractDate(iso: string | null): string {
  if (!iso) return '____';
  const p = moscowParts(iso);
  if (!p) return iso!;
  return `«${p.day}» ${MONTHS_GEN[p.monthIdx]} ${p.year}`;
}

/** ISO datetime string → «ДД» месяц ГГГГ г. ЧЧ:ММ  (for rent start/end, МСК) */
function fmtDatetime(iso: string | null): string {
  if (!iso) return '____';
  const p = moscowParts(iso);
  if (!p) return iso!;
  return `«${p.day}» ${MONTHS_GEN[p.monthIdx]} ${p.year} г. ${p.hh}:${p.min}`;
}

/** ISO date string → ДД.ММ.ГГГГ  (for passport dates, birthDate) */
function fmtDate(iso: string | null): string {
  if (!iso) return '____';
  const p = moscowParts(iso);
  if (!p) return iso!;
  return `${p.day}.${p.mm}.${p.year}`;
}

/** Null/undefined/empty → '____' fallback */
function safe(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '____';
  return String(v);
}

// ── docxtemplater parser: resolves 'a.b.c' dot notation ───────────────────

function makeParser() {
  return (tag: string) => {
    const keys = tag.split('.');
    return {
      get(scope: Record<string, unknown>): string {
        let obj: unknown = scope;
        for (const key of keys) {
          if (obj == null || typeof obj !== 'object') return '____';
          obj = (obj as Record<string, unknown>)[key];
        }
        if (obj === null || obj === undefined) return '____';
        return String(obj);
      },
    };
  };
}

// ── Public types ──────────────────────────────────────────────────────────

/** Appendix 3 data — tariffs/fines (ask client to fill, leave '____' if absent). */
export interface P3Data {
  vehicleValue?:   string;   // стоимость ТС для возмещения, руб.
  tariffDescription?: string; // описание тарифов
  idleRate?:       string;   // тариф простоя, руб./сутки
  idleDays?:       string;   // макс. суток простоя
  fine_transfer?:  string;   // штраф: передача управления
  fine_boundary?:  string;   // штраф: выезд за границу
  fine_tracker?:   string;   // штраф: отключение трекера
  fine_accident?:  string;   // штраф: сокрытие ДТП
  fine_charging?:  string;   // штраф: нарушение правил зарядки
}

export interface ContractDocInput {
  contract: RentalContract;
  lessor:   Lessor;
  client:   Client;
  bike:     BikeUnit;
  p3?:      P3Data;
}

export interface GeneratedContract {
  buffer: Buffer;
  sha256: string;
}

// ── Fix: "растянутый по ширине" текст ───────────────────────────────────────
// Выравнивание по ширине (w:jc both/distribute) рендерится по-разному в разных
// приложениях: Word Windows / Android Word / WPS / Google Docs растягивают
// межсловными пробелами короткие однострочные абзацы и строки перед жёстким
// переносом (<w:br/>) — а macOS Word / LibreOffice нет. Чтобы договор выглядел
// ОДИНАКОВО ВЕЗДЕ, снимаем justify со ВСЕГО документа → выравнивание влево
// (center/right у заголовков и подписей не трогаем). Покрывает и таблицы, т.к.
// правка по строке document.xml. Детерминирована → стабильность sha256 сохраняется.
function forceLeftAlign(documentXml: string): string {
  return documentXml.replace(
    /<w:jc\b[^>]*\bw:val="(?:both|distribute)"[^>]*\/>/g,
    '<w:jc w:val="left"/>',
  );
}

// ── Main generator ────────────────────────────────────────────────────────

export function generateContract(input: ContractDocInput): GeneratedContract {
  const { contract, lessor, client, bike, p3 = {} } = input;

  const templateBuf = fs.readFileSync(
    resolveTemplatePath(bike.modelSlug, contract.contractType ?? 'rental'),
  );
  const zip = new PizZip(templateBuf) as InstanceType<typeof PizZip>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = new Docxtemplater(zip, {
    parser:        makeParser(),
    paragraphLoop: true,
    linebreaks:    true,
    // Return '____' for tags not found in data
    nullGetter():  string { return '____'; },
  });

  const data: Record<string, unknown> = {
    // ── Contract header ────────────────────────────────────────────────
    contractNumber: safe(contract.contractNumber),
    contractDate:   fmtContractDate(contract.contractDate),

    // ── Rental period ─────────────────────────────────────────────────
    rentStart:     fmtDatetime(contract.rentStart),
    rentEnd:       fmtDatetime(contract.rentEnd),
    returnAddress: safe(contract.returnAddress),

    // ── Price & deposit ───────────────────────────────────────────────
    priceHour: contract.priceHour != null ? String(contract.priceHour) : '____',
    priceDay:  contract.priceDay  != null ? String(contract.priceDay)  : '____',
    deposit:   contract.deposit   != null ? String(contract.deposit)   : '____',

    // ── Lessor ────────────────────────────────────────────────────────
    lessor: {
      entityType: safe(lessor.entityType),
      name:       safe(lessor.name),
      ogrn:       safe(lessor.ogrn),
      inn:        safe(lessor.inn),
      address:    safe(lessor.address),
      signatory:  safe(lessor.signatory),
      basis:      safe(lessor.basis),
      contacts:   safe(lessor.contacts),
    },

    // ── Client ────────────────────────────────────────────────────────
    client: {
      entityType:          safe(client.entityType),
      fullName:            safe(client.fullName),
      birthDate:           fmtDate(client.birthDate),
      passportSeries:      safe(client.passportSeries),
      passportNumber:      safe(client.passportNumber),
      passportIssuedBy:    safe(client.passportIssuedBy),
      passportIssuedDate:  fmtDate(client.passportIssuedDate),
      passportDeptCode:    safe(client.passportDeptCode),
      registrationAddress: safe(client.registrationAddress),
      phone:               safe(client.phone),
      telegram:            client.telegram ? client.telegram : '____',
      inn:                 safe(client.inn),
      ogrn:                safe(client.ogrn),
    },

    // ── Bike unit ─────────────────────────────────────────────────────
    bike: {
      makeModel:   safe(bike.makeModel),
      vin:         safe(bike.vin),
      year:        bike.year != null ? String(bike.year) : '____',
      color:       safe(bike.color),
      powerKw:     safe(bike.powerKw),
      maxSpeedKmh: safe(bike.maxSpeedKmh),
      battery:     safe(bike.battery),
    },

    // ── Appendix 1 — Act fields (filled at signing) ───────────────────
    p1_chargeIn:  '____',
    p1_chargeOut: '____',
    p1_odometer:  '____',

    // ── Appendix 3 — Tariffs / fines ─────────────────────────────────
    p3_vehicleValue:      safe(p3.vehicleValue),
    p3_tariffDescription: safe(p3.tariffDescription),
    p3_idleRate:          safe(p3.idleRate),
    p3_idleDays:          safe(p3.idleDays),
    p3_fine_transfer:     safe(p3.fine_transfer),
    p3_fine_boundary:     safe(p3.fine_boundary),
    p3_fine_tracker:      safe(p3.fine_tracker),
    p3_fine_accident:     safe(p3.fine_accident),
    p3_fine_charging:     safe(p3.fine_charging),

    // ── Купля-продажа (sale) — плейсхолдеры '____' если аренда ──────
    salePrice:        contract.salePrice      != null ? String(contract.salePrice)      : '____',
    salePriceWords:   safe(contract.salePriceWords),
    prepayment:       contract.prepayment     != null ? String(contract.prepayment)     : '____',
    prepaymentWords:  safe(contract.prepaymentWords),
    warrantyMonths:   contract.warrantyMonths != null ? String(contract.warrantyMonths) : '____',
  };

  doc.render(data);

  const generatedZip = doc.getZip();

  // ── Fix: убрать выравнивание по ширине (растягивается в Word/Android/Google) ──
  const docXmlFile = generatedZip.file('word/document.xml');
  if (docXmlFile) {
    generatedZip.file('word/document.xml', forceLeftAlign(docXmlFile.asText()));
  }

  // ── Fix 3: deterministic SHA256 ──────────────────────────────────────────
  // PizZip stamps each zip entry with the current timestamp by default,
  // making the output non-deterministic even for identical inputs.
  // We reset ALL entry dates to a fixed epoch so sha256 is stable.
  const EPOCH = new Date('2000-01-01T00:00:00.000Z');
  for (const filename of Object.keys(generatedZip.files)) {
    generatedZip.files[filename].date = EPOCH;
  }

  const buffer: Buffer = generatedZip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    // compressionOptions level fixed to ensure byte-stable output
    compressionOptions: { level: 6 },
  });

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  return { buffer, sha256 };
}
