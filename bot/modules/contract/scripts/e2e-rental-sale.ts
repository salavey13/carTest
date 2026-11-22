/**
 * scripts/e2e-rental-sale.ts
 * E2E проверка фичи contract_type: временная БД → миграция → seed lessor+bike →
 * createContract (rental + sale) → генерация .docx → проверка contract_type в SQLite + отсутствие сырых тегов.
 *
 * Запуск: npx tsx modules/contract/scripts/e2e-rental-sale.ts
 * Использует свежую временную БД (CONTRACTS_DB_PATH), реальные данные не трогает.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'node:module';

// Свежая временная БД ДО первого импорта db.js (path читается в resolvedDbPath при getDb).
const TMP_DB = path.join(os.tmpdir(), `vipbot-e2e-${process.pid}.db`);
for (const f of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) fs.rmSync(f, { force: true });
process.env.CONTRACTS_DB_PATH = TMP_DB;
delete process.env.CONTRACTS_DB_KEY; // без шифрования (dev/тест)
process.env.NODE_ENV = 'test';

const { getDb } = await import('../lib/db.js');
const { createContract } = await import('../lib/contracts.js');
const { generateContract } = await import('../lib/contractDoc.js');
const _require = createRequire(import.meta.url);
const PizZip = _require('pizzip');

const db = getDb();

// ── Проверка миграции: колонка contract_type существует ──────────────────────
const cols = (db.prepare(`PRAGMA table_info(rental_contracts)`).all() as { name: string }[]).map((c) => c.name);
assert(cols.includes('contract_type'), 'миграция 002: колонка contract_type есть');
assert(cols.includes('sale_price'), 'миграция 002: колонка sale_price есть');
assert(cols.includes('warranty_months'), 'миграция 002: колонка warranty_months есть');

// ── Идемпотентность: повторный getDb не падает ───────────────────────────────
getDb();
const applied = db.prepare(`SELECT COUNT(*) n FROM schema_migrations WHERE filename = '002_add_contract_type.sql'`).get() as { n: number };
assert(applied.n === 1, 'миграция 002 записана ровно один раз');

// ── Seed lessor + bike ───────────────────────────────────────────────────────
db.prepare(
  `INSERT INTO lessor (id, entity_type, name, ogrn, inn, address, signatory, basis, contacts, is_active)
   VALUES (1, 'ИП', 'Мотосалон ВипБайкЭлектро', '326527500025145', '525813643035',
           '603132 Н.Новгород ул. Молитовская 6/1-42', 'Р.В. Воробьев', 'свидетельства', 'test', 1)`,
).run();
db.prepare(
  `INSERT INTO bike_units (id, model_slug, make_model, vin, year, color, power_kw, max_speed_kmh, battery, status)
   VALUES ('bike-1', 'falcon-gt-2025', '79 Bike Falcon GT', 'H2YLEVZNXT1A11332', 2026, 'чёрный', '3000', '50', 'Li-ion', 'available')`,
).run();
// клиент
const clientId = '00000000-0000-0000-0000-0000000000aa';
db.prepare(
  `INSERT INTO clients (id, entity_type, full_name, birth_date, passport_series, passport_number,
     passport_issued_by, passport_issued_date, registration_address, phone)
   VALUES (?, 'гражданин', 'Тестов Тест Тестович', '1990-01-15', '1234', '567890',
           'УФМС Тест', '2015-03-10', 'г. Тест, ул. Тест, д.1', '+79000000000')`,
).run(clientId);

function loadFixtures() {
  const lessor = { id: 1, entityType: 'ИП' as const, name: 'Мотосалон ВипБайкЭлектро', ogrn: '326527500025145',
    inn: '525813643035', address: '603132 Н.Новгород ул. Молитовская 6/1-42', signatory: 'Р.В. Воробьев',
    basis: 'свидетельства', contacts: 'test', isActive: true };
  const client = { id: clientId, entityType: 'гражданин' as const, fullName: 'Тестов Тест Тестович',
    birthDate: '1990-01-15', passportSeries: '1234', passportNumber: '567890', passportIssuedBy: 'УФМС Тест',
    passportIssuedDate: '2015-03-10', passportDeptCode: null, registrationAddress: 'г. Тест, ул. Тест, д.1',
    licenseNumber: null, licenseCategories: null, licenseIssuedDate: null, licenseValidUntil: null,
    inn: null, ogrn: null, legalAddress: null, phone: '+79000000000', telegram: null, docFiles: [],
    rawOcr: null, pdnConsentAt: null };
  const bike = { id: 'bike-1', modelSlug: 'falcon-gt-2025', makeModel: '79 Bike Falcon GT',
    vin: 'H2YLEVZNXT1A11332', year: 2026, color: 'чёрный', powerKw: '3000', maxSpeedKmh: '50',
    battery: 'Li-ion', status: 'available' as const };
  return { lessor, client, bike };
}

function residualTags(buffer: Buffer): string[] {
  const zip = new PizZip(buffer);
  const xml: string = zip.file('word/document.xml')?.asText() ?? '';
  return [...xml.matchAll(/\{[a-zA-Z][^}]{1,40}\}/g)].map((m) => m[0]);
}

// ── RENTAL ───────────────────────────────────────────────────────────────────
{
  const { lessor, client, bike } = loadFixtures();
  const c = createContract({
    clientId: client.id, bikeUnitId: bike.id, lessorId: 1,
    rentStart: '2026-05-30T07:00:00.000Z', rentEnd: '2026-05-31T07:00:00.000Z',
    rateType: 'day', priceDay: 9000, deposit: 20000,
    // contractType не задан → дефолт rental
  });
  assert(c.contractType === 'rental', `rental: contract_type='rental' (got ${c.contractType})`);
  const dbType = (db.prepare(`SELECT contract_type t FROM rental_contracts WHERE id=?`).get(c.id) as { t: string }).t;
  assert(dbType === 'rental', `rental: SQLite contract_type='rental' (got ${dbType})`);
  const { buffer } = generateContract({ contract: c, lessor, client, bike });
  const tags = residualTags(buffer);
  assert(tags.length === 0, `rental: 0 сырых тегов (got ${tags.length}: ${tags.slice(0, 5).join(',')})`);
  assert(buffer.length > 10000, 'rental: docx непустой');
}

// ── SALE ─────────────────────────────────────────────────────────────────────
{
  const { lessor, client, bike } = loadFixtures();
  // Цена 555000 ≠ эталонные 610000 — чтобы доказать отсутствие захардкоженного литерала (B1).
  const c = createContract({
    clientId: client.id, bikeUnitId: bike.id, lessorId: 1,
    contractType: 'sale',
    salePrice: 555000, salePriceWords: 'Пятьсот пятьдесят пять тысяч',
    prepayment: 200000, prepaymentWords: 'Двести тысяч',
    warrantyMonths: 6,
  });
  assert(c.contractType === 'sale', `sale: contract_type='sale' (got ${c.contractType})`);
  assert(c.salePrice === 555000, `sale: salePrice сохранён (got ${c.salePrice})`);
  const row = db.prepare(`SELECT contract_type t, sale_price p FROM rental_contracts WHERE id=?`).get(c.id) as { t: string; p: number };
  assert(row.t === 'sale', `sale: SQLite contract_type='sale' (got ${row.t})`);
  assert(Number(row.p) === 555000, `sale: SQLite sale_price=555000 (got ${row.p})`);
  const { buffer, sha256 } = generateContract({ contract: c, lessor, client, bike });
  const tags = residualTags(buffer);
  assert(tags.length === 0, `sale: 0 сырых тегов (got ${tags.length}: ${tags.slice(0, 8).join(',')})`);
  assert(buffer.length > 10000, 'sale: docx непустой');
  // B1: в видимом ТЕКСТЕ (w:t) docx НЕТ эталонной цены 610 (RSID-атрибуты не считаем — берём только текст)
  const saleXml: string = new PizZip(buffer).file('word/document.xml')?.asText() ?? '';
  const visibleText = (saleXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).join(' ');
  assert(!visibleText.includes('610'), 'sale: НЕТ захардкоженной цены 610 из эталона (B1)');
  // salePrice подставлен в спецификацию (Цена за единицу + Стоимость = 2 числовые ячейки + тело)
  const priceHits = (visibleText.match(/555000/g) || []).length;
  assert(priceHits >= 2, `sale: salePrice 555000 подставлен в спецификацию (вхождений: ${priceHits})`);
  console.log(`   sale docx sha256: ${sha256}`);
}

// ── Сквозная нумерация rental+sale ───────────────────────────────────────────
{
  const nums = (db.prepare(`SELECT contract_number FROM rental_contracts ORDER BY contract_number`).all() as { contract_number: string }[])
    .map((r) => r.contract_number);
  assert(new Set(nums).size === nums.length, `номера уникальны (${nums.join(', ')})`);
}

// cleanup
for (const f of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) fs.rmSync(f, { force: true });
console.log('\n✅ E2E rental+sale: ВСЕ ПРОВЕРКИ ПРОШЛИ');

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`❌ ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}
