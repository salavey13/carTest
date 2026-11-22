/**
 * scripts/gen-contract-sample.ts
 * Генерирует тестовый договор аренды с ЯВНО ФИКТИВНЫМИ данными.
 * Используется для проверки шаблона: все {плейсхолдеры} должны быть заменены.
 *
 * Запуск:
 *   npx tsx scripts/gen-contract-sample.ts
 *
 * Результат: _tmp/sample-contract.docx  (SHA-256 выводится в stdout)
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'node:module';
import { generateContract } from '../lib/contractDoc.js';
import type { Lessor, Client, BikeUnit, RentalContract } from '../lib/types.js';
const _require = createRequire(import.meta.url);

// ── ЯВНО ФИКТИВНЫЕ тестовые данные ────────────────────────────────────────
// ⚠️  Все имена, ОГРН, ИНН, VIN — вымышленные, не совпадают с реальными лицами.

const lessor: Lessor = {
  id:         1,
  entityType: 'ИП',
  name:       'Тестов Тест Тестович',          // ФИКТИВНЫЙ
  ogrn:       '000000000000001',               // ФИКТИВНЫЙ
  inn:        '000000000001',                   // ФИКТИВНЫЙ
  address:    'г. Нижний Новгород, ул. Тестовая, д. 1',
  signatory:  'Тестов Т.Т.',
  basis:      'Свидетельства о государственной регистрации ИП',
  contacts:   '+7 900 000 00 00, test@vipbike.test',
  isActive:   true,
};

const client: Client = {
  id:                  '00000000-0000-0000-0000-000000000002',
  entityType:          'гражданин',
  fullName:            'Арендаторов Арендатор Арендаторович',  // ФИКТИВНЫЙ
  birthDate:           '1990-01-15',
  passportSeries:      '1234',
  passportNumber:      '567890',
  passportIssuedBy:    'УФМС России по г. Тестовск (ФИКТИВНЫЙ)',
  passportIssuedDate:  '2015-03-10',
  passportDeptCode:    '000-000',
  registrationAddress: 'г. Нижний Новгород, ул. Тестовая, д. 2, кв. 10',
  licenseNumber:       null,
  licenseCategories:   null,
  licenseIssuedDate:   null,
  licenseValidUntil:   null,
  inn:                 null,
  ogrn:                null,
  legalAddress:        null,
  phone:               '+7 900 000 00 01',
  telegram:            '@test_renter_fake',
  docFiles:            [],
  rawOcr:              null,
  pdnConsentAt:        null,
};

const bike: BikeUnit = {
  id:          '00000000-0000-0000-0000-000000000003',
  modelSlug:   'falcon-pro-yellow',
  makeModel:   '79bike Falcon PRO',
  vin:         'TESTFAKE000000001',   // ФИКТИВНЫЙ
  year:        2024,
  color:       'Жёлтый',
  powerKw:     '5',
  maxSpeedKmh: '85',
  battery:     'Li-ion 72V 30Ah',
  status:      'available',
};

const contract: RentalContract = {
  id:             '00000000-0000-0000-0000-000000000001',
  contractNumber: 'VB-2026-TEST',
  contractDate:   '2026-05-30',
  city:           'Нижний Новгород',
  lessorId:       1,
  clientId:       client.id,
  bikeUnitId:     bike.id,
  rentStart:      '2026-05-30T10:00:00.000Z',
  rentEnd:        '2026-05-31T10:00:00.000Z',
  returnAddress:  'г. Нижний Новгород, ул. Тестовая, д. 1',
  rateType:       'day',
  priceHour:      500,
  priceDay:       3000,
  deposit:        10000,
  status:         'draft',
  docxPath:       null,
  pdfPath:        null,
  originalSha256: null,
  createdBy:      null,
  rawInputs:      null,
  contractType:   'rental',
  salePrice:       null,
  salePriceWords:  null,
  prepayment:      null,
  prepaymentWords: null,
  warrantyMonths:  null,
};

// ── Generate ───────────────────────────────────────────────────────────────

const outDir = path.resolve(process.cwd(), '_tmp');
const outPath = path.join(outDir, 'sample-contract.docx');

fs.mkdirSync(outDir, { recursive: true });

const { buffer, sha256 } = generateContract({
  contract,
  lessor,
  client,
  bike,
  p3: {
    vehicleValue:      '250000',
    tariffDescription: 'Почасовой: 500 руб./ч; суточный: 3000 руб./сут.',
    idleRate:          '3000',
    idleDays:          '5',
    fine_transfer:     '5000',
    fine_boundary:     '5000',
    fine_tracker:      '10000',
    fine_accident:     '5000',
    fine_charging:     '5000',
  },
});

fs.writeFileSync(outPath, buffer);

console.log('✅ Sample contract generated:');
console.log(`   Path:   ${outPath}`);
console.log(`   Size:   ${buffer.length.toLocaleString()} bytes`);
console.log(`   SHA256: ${sha256}`);

// ── Verify: no raw {placeholder} tags remain ──────────────────────────────
// (docxtemplater replaces ALL recognized {tags}; residual tags = mapping error)
const PizZip = _require('pizzip');
const zip = new PizZip(buffer);
const docXml: string = zip.file('word/document.xml')?.asText() ?? '';
const residual = [...docXml.matchAll(/\{[a-zA-Z][^}]{1,40}\}/g)].map(m => m[0]);

if (residual.length > 0) {
  console.error(`\n❌ WARNING: ${residual.length} unresolved placeholder(s) found:`);
  for (const tag of residual) console.error(`   ${tag}`);
  process.exit(1);
} else {
  console.log('\n✅ Verification: всe {плейсхолдеры} заменены — сырых тегов нет.');
}
