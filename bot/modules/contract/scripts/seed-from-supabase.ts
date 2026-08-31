/**
 * scripts/seed-from-supabase.ts
 * Мигрирует байки из Supabase (cars WHERE type='bike' AND is_test_result=false)
 * в локальный SQLite (bike_units).
 * Реквизиты арендодателя (lessor) — ИП Воробьев Р.В. ОГРНИП 326527500025145.
 *
 * Запуск:
 *   CONTRACTS_DB_KEY=<key> \
 *   SUPABASE_URL=https://inmctohsodgdohamhzag.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   CONTRACTS_DB_PATH=workspace/store/contracts.db \
 *   npx tsx modules/contract/scripts/seed-from-supabase.ts
 *
 * ⛔ Credentials — ТОЛЬКО из env. Не хардкодить в этот файл.
 * ⛔ Supabase — только чтение (GET). Запись запрещена.
 */

import { randomUUID } from 'node:crypto';
import { getDb } from '../lib/db.js';

// ── Supabase credentials (из env) ────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SRK) {
  console.error('❌ Не заданы SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// ── Тип строки из Supabase (cars) ────────────────────────────────────────────
interface SupabaseCar {
  id: string;
  make: string;
  model: string;
  is_test_result: boolean;
  type: string;
  specs: Record<string, unknown> | null;
  availability_rules: Record<string, unknown> | null;
}

// ── Маппинг статуса → наш enum ────────────────────────────────────────────────
function mapStatus(rules: Record<string, unknown> | null): 'available' | 'rented' | 'service' {
  const s = (rules?.manual_status ?? '') as string;
  if (s === 'rented')  return 'rented';
  if (s === 'service') return 'service';
  return 'available';
}

// ── Извлечь строковое значение из specs по набору ключей ─────────────────────
function specStr(specs: Record<string, unknown> | null, ...keys: string[]): string | null {
  if (!specs) return null;
  for (const key of keys) {
    const v = specs[key];
    if (v !== null && v !== undefined && v !== '') return String(v);
  }
  return null;
}

// ── Fetch: только байки, только не-тестовые ──────────────────────────────────
async function fetchBikes(): Promise<SupabaseCar[]> {
  // PostgREST: type=eq.bike&is_test_result=eq.false
  const url = new URL(`${SUPABASE_URL}/rest/v1/cars`);
  url.searchParams.set('select', '*');
  url.searchParams.set('type', 'eq.bike');
  url.searchParams.set('is_test_result', 'eq.false');
  // Только АРЕНДНЫЙ парк VIP BIKE (owner_id), а не продажные/чужие байки общего Supabase.
  // SUPABASE_OWNER_ID=356282674 — owner аренды VIP BIKE (у них rent_link + суточная цена).
  const ownerId = process.env.SUPABASE_OWNER_ID ?? '356282674';
  if (ownerId) url.searchParams.set('owner_id', `eq.${ownerId}`);
  url.searchParams.set('limit', '200');

  const res = await fetch(url.toString(), {
    headers: {
      apikey: SRK!,
      Authorization: `Bearer ${SRK}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Supabase REST error ${res.status}: ${await res.text()}`);
  }

  return (await res.json()) as SupabaseCar[];
}

// ── Seed bike_units ───────────────────────────────────────────────────────────
// Стратегия идемпотентности: DELETE все старые + INSERT свежие.
// Почему не UPSERT по id: id — это наш UUID, генерируется каждый раз.
// Почему не UPSERT по model_slug: проще полный пересид при ре-запуске.
function seedBikeUnits(bikes: SupabaseCar[]): number {
  const db = getDb();

  const existingCount = (
    db.prepare('SELECT COUNT(*) as n FROM bike_units').get() as { n: number }
  ).n;

  if (existingCount > 0) {
    console.log(
      `⚠️  bike_units: уже ${existingCount} записей — очищаю перед пересидом`,
    );
    db.prepare('DELETE FROM bike_units').run();
  }

  const stmt = db.prepare(`
    INSERT INTO bike_units
      (id, model_slug, make_model, vin, year, color, power_kw, max_speed_kmh, battery, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction((rows: SupabaseCar[]) => {
    let n = 0;
    for (const bike of rows) {
      const specs = bike.specs ?? {};
      const yearRaw = specStr(specs, 'year');
      const year = yearRaw ? parseInt(yearRaw, 10) : null;

      stmt.run(
        randomUUID(),                                     // id
        bike.id,                                          // model_slug = Supabase slug
        `${bike.make} ${bike.model}`.trim(),              // make_model (NOT NULL)
        null,                                             // vin — {{уточнить у клиента}}
        year && !isNaN(year) ? year : null,               // year
        specStr(specs, 'color'),                          // color
        specStr(specs, 'motor_peak_kw', 'power_kw'),      // power_kw (пик → номинал)
        specStr(specs, 'top_speed_kmh'),                  // max_speed_kmh
        specStr(specs, 'battery'),                        // battery
        mapStatus(bike.availability_rules),               // status
      );
      n++;
    }
    return n;
  });

  return insertAll(bikes) as number;
}

// ── Seed lessor (только если таблица пуста) ───────────────────────────────────
// Реквизиты ИП из эталонных договоров. ИНН/адрес — {{уточнить}} у клиента.
function seedLessor(): 'created' | 'skipped' {
  const db = getDb();
  const existing = (
    db.prepare('SELECT COUNT(*) as n FROM lessor WHERE is_active = 1').get() as { n: number }
  ).n;

  if (existing > 0) {
    console.log(`ℹ️  lessor: ${existing} активная запись уже есть — пропускаю`);
    return 'skipped';
  }

  db.prepare(`
    INSERT INTO lessor
      (entity_type, name, ogrn, inn, address, signatory, basis, contacts, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    'ИП',
    'Воробьев Роман Владимирович',
    '326527500025145',                                    // ОГРНИП (из эталонных договоров)
    null,                                                 // ИНН — {{уточнить}}
    null,                                                 // адрес — {{уточнить}}
    'Воробьев Роман Владимирович',                        // signatory
    'на основании Свидетельства о государственной регистрации ИП', // basis
    null,                                                 // contacts — {{уточнить}}
  );

  return 'created';
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const dbPath = process.env.CONTRACTS_DB_PATH ?? 'workspace/store/contracts.db (default)';
  console.log('🚀 seed-from-supabase.ts');
  console.log(`   Supabase : ${SUPABASE_URL}`);
  console.log(`   SQLite   : ${dbPath}`);
  console.log();

  // 1. Fetch bikes
  console.log('📡 Загружаю cars (type=bike, is_test_result=false) из Supabase...');
  const bikes = await fetchBikes();
  console.log(`   Получено : ${bikes.length} байков`);

  if (bikes.length === 0) {
    console.error('❌ Нет байков для миграции — проверь Supabase credentials и фильтры');
    process.exit(1);
  }

  // 2. Seed bike_units
  const inserted = seedBikeUnits(bikes);
  console.log(`✅ bike_units : вставлено ${inserted} записей`);

  // 3. Seed lessor
  const lessorResult = seedLessor();
  if (lessorResult === 'created') {
    console.log('✅ lessor    : ИП Воробьев Р.В. ОГРНИП 326527500025145 создан');
    console.log('   ⚠️  ИНН/адрес/контакты — {{уточнить}} у клиента и обновить вручную');
  }

  // 4. Итоговая статистика
  const db = getDb();
  const bikeCount = (
    db.prepare('SELECT COUNT(*) as n FROM bike_units').get() as { n: number }
  ).n;
  const lessorCount = (
    db.prepare('SELECT COUNT(*) as n FROM lessor').get() as { n: number }
  ).n;

  console.log();
  console.log('📊 Итог:');
  console.log(`   bike_units : ${bikeCount}`);
  console.log(`   lessor     : ${lessorCount}`);

  // 5. Примеры для отчёта
  console.log();
  console.log('🔍 Примеры (bike_units, первые 3):');
  const samples = db
    .prepare('SELECT * FROM bike_units ORDER BY make_model LIMIT 3')
    .all();
  for (const s of samples) {
    console.log(JSON.stringify(s, null, 2));
  }

  console.log();
  console.log('🔍 lessor:');
  const lessor = db.prepare('SELECT * FROM lessor LIMIT 1').get();
  console.log(JSON.stringify(lessor, null, 2));
}

main().catch((err: unknown) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
