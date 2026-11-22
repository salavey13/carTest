/**
 * scripts/recognize-sample.ts
 * Проверка lib/recognize.ts в МОК-режиме (без Z_AI_API_KEY) + нормализации дат
 * + композиции recognize → generateContract (распознанные поля идут в договор).
 *
 * Запуск:  RECOGNIZE_MOCK=1 npx tsx scripts/recognize-sample.ts
 */

import { createRequire } from 'node:module';
import { recognizeClient, recognizeDocument, normalizeDate, recognizeConfigured } from '../lib/recognize.js';
import { generateContract } from '../lib/contractDoc.js';
import type { Client, Lessor, BikeUnit, RentalContract } from '../lib/types.js';
const _require = createRequire(import.meta.url);

let failures = 0;
function check(label: string, cond: boolean, detail?: string) {
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}

async function main() {
  console.log(`recognizeConfigured() = ${recognizeConfigured()} (ожидаем false в моке)\n`);

  // ── 1. normalizeDate edge cases ───────────────────────────────────────────
  check('normalizeDate ДД.ММ.ГГГГ', normalizeDate('15.05.1990') === '1990-05-15');
  check('normalizeDate ДД-ММ-ГГГГ', normalizeDate('5-1-2020') === '2020-01-05');
  check('normalizeDate ГГГГ-ММ-ДД', normalizeDate('2031-07-10') === '2031-07-10');
  check('normalizeDate мусор → null', normalizeDate('не дата') === null);
  check('normalizeDate пусто → null', normalizeDate('') === null);

  // ── 2. recognizeDocument (паспорт, мок) ───────────────────────────────────
  const passport = await recognizeDocument('passport', { base64: 'ZmFrZQ==' });
  check('паспорт: mock=true', passport.mock === true);
  check('паспорт: ФИО распознано', Boolean(passport.fields.fullName), passport.fields.fullName);
  check('паспорт: дата ISO', passport.fields.birthDate === '1990-05-15', String(passport.fields.birthDate));
  check('паспорт: нет ключей ВУ', !('licenseNumber' in passport.fields));

  // ── 3. recognizeClient (паспорт + ВУ, мок) ────────────────────────────────
  const { fields, raw, mock } = await recognizeClient({
    passport: { base64: 'ZmFrZQ==' },
    license: { url: 'https://example.test/license.jpg' },
  });
  check('merge: mock=true', mock === true);
  check('merge: паспортные поля есть', fields.passportSeries === '2222');
  check('merge: поля ВУ есть', fields.licenseCategories === 'A,B,M');
  check('merge: даты ВУ ISO', fields.licenseValidUntil === '2031-07-10', String(fields.licenseValidUntil));
  check('merge: raw содержит оба дока', Boolean(raw.passport && raw.license));

  // ── 4. recognizeClient без документов → ошибка ────────────────────────────
  let threw = false;
  try { await recognizeClient({}); } catch { threw = true; }
  check('recognizeClient без доков → throw', threw);

  // ── 5. Композиция: распознанные поля → договор (без сырых плейсхолдеров) ───
  const client: Client = {
    id: '00000000-0000-0000-0000-000000000099',
    entityType: 'гражданин',
    fullName: fields.fullName,
    birthDate: fields.birthDate ?? null,
    passportSeries: fields.passportSeries ?? null,
    passportNumber: fields.passportNumber ?? null,
    passportIssuedBy: fields.passportIssuedBy ?? null,
    passportIssuedDate: fields.passportIssuedDate ?? null,
    passportDeptCode: fields.passportDeptCode ?? null,
    registrationAddress: fields.registrationAddress ?? null,
    licenseNumber: fields.licenseNumber ?? null,
    licenseCategories: fields.licenseCategories ?? null,
    licenseIssuedDate: fields.licenseIssuedDate ?? null,
    licenseValidUntil: fields.licenseValidUntil ?? null,
    inn: null, ogrn: null, legalAddress: null,
    phone: null, telegram: null,
    docFiles: [], rawOcr: raw, pdnConsentAt: null,
  };
  const lessor: Lessor = {
    id: 1, entityType: 'ИП', name: 'Тестов Т.Т. (ФИКТ.)',
    ogrn: '000000000000001', inn: '000000000001',
    address: 'г. Нижний Новгород', signatory: 'Тестов Т.Т.',
    basis: 'Свидетельства ИП', contacts: '+7 900 000 00 00', isActive: true,
  };
  const bike: BikeUnit = {
    id: '00000000-0000-0000-0000-000000000098', modelSlug: 'falcon-pro-yellow',
    makeModel: '79bike Falcon PRO', vin: 'TESTFAKE1', year: 2024, color: 'Жёлтый',
    powerKw: '5', maxSpeedKmh: '85', battery: 'Li-ion 72V 30Ah', status: 'available',
  };
  const contract: RentalContract = {
    id: '00000000-0000-0000-0000-000000000097', contractNumber: 'VB-2026-MOCK',
    contractDate: '2026-05-31', city: 'Нижний Новгород', lessorId: 1,
    clientId: client.id, bikeUnitId: bike.id,
    rentStart: '2026-05-31T07:00:00.000Z', rentEnd: '2026-06-01T07:00:00.000Z',
    returnAddress: 'г. Нижний Новгород', rateType: 'day',
    priceHour: 500, priceDay: 3000, deposit: 10000, status: 'draft',
    docxPath: null, pdfPath: null, originalSha256: null, createdBy: null, rawInputs: null,
    contractType: 'rental', salePrice: null, salePriceWords: null,
    prepayment: null, prepaymentWords: null, warrantyMonths: null,
  };
  const { buffer, sha256 } = generateContract({ contract, lessor, client, bike });
  const PizZip = _require('pizzip');
  const docXml: string = new PizZip(buffer).file('word/document.xml')?.asText() ?? '';
  const residual = [...docXml.matchAll(/\{[a-zA-Z][^}]{1,40}\}/g)].map((m) => m[0]);
  check('договор: ФИО из распознавания в документе', docXml.includes('Иванов Иван Иванович'));
  check('договор: rentStart в МСК (10:00 для 07:00Z)', docXml.includes('10:00'));
  check('договор: нет сырых плейсхолдеров', residual.length === 0, residual.join(', '));
  console.log(`   контракт sha256: ${sha256}`);

  console.log(`\n${failures === 0 ? '✅ ВСЕ ПРОВЕРКИ ПРОШЛИ' : `❌ ПРОВАЛЕНО: ${failures}`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
