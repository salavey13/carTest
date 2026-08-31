/**
 * scripts/update-bike-vins.ts
 * Идемпотентно проставляет VIN юнитам парка по model_slug из эталонов 2026-06-09 (ANALYSIS.md §6.2).
 * VIN — юр-идентификатор ТС в договоре; в БД у юнитов пусто. Покрывает generic-fallback
 * (contract-rental.docx через {bike.vin}) для всех слагов.
 *
 * Запуск (ПОСЛЕ сидинга bike_units): npx tsx modules/contract/scripts/update-bike-vins.ts
 * Re-runnable: ставит VIN ТОЛЬКО там, где он пуст (NULL/''), не затирает вручную исправленный.
 */

import { getDb } from '../lib/db.js';

// Карта slug → VIN (из согласованных клиентом эталонов, ANALYSIS.md §5.1/§6.2).
const VINS: Record<string, string> = {
  'falcon-gt-2025': 'H2YLEVZNXT1A11332',
  'falcon-pro-2025': 'H3YLEVZN4T1A11848',
  'kawasaki-ex650k': 'JKAEX650KKDA31636',
  'sequence-zero': 'LCSGBMS67R1000066',
  'nibbler-regumoto-4v': 'LGVSNP802SOE36101',
};

const db = getDb();
const stmt = db.prepare(
  `UPDATE bike_units SET vin = ? WHERE model_slug = ? AND (vin IS NULL OR vin = '')`,
);

let updated = 0;
const skipped: string[] = [];
for (const [slug, vin] of Object.entries(VINS)) {
  const res = stmt.run(vin, slug);
  if (res.changes > 0) {
    updated += res.changes;
    console.log(`✅ ${slug} → ${vin} (${res.changes} юнит)`);
  } else {
    // либо слага нет в парке, либо VIN уже задан — не трогаем
    const row = db.prepare(`SELECT vin FROM bike_units WHERE model_slug = ?`).get(slug) as { vin: string | null } | undefined;
    skipped.push(row ? `${slug} (VIN уже задан: ${row.vin})` : `${slug} (нет юнита в парке)`);
  }
}

console.log(`\nОбновлено VIN: ${updated}`);
if (skipped.length) {
  console.log('Пропущено:');
  for (const s of skipped) console.log(`  - ${s}`);
}
