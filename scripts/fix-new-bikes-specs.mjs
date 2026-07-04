#!/usr/bin/env node
/**
 * fix-new-bikes-specs.mjs — Fix escaped quotes in specs JSON for newly added bikes
 *
 * The add-new-bikes.mjs script passed specs as JSON.stringify(specs) which
 * caused Supabase to double-escape the JSON. This script:
 * 1. Deletes the 6 broken bikes
 * 2. Re-inserts them with specs as a plain JS object (correct JSONB)
 * 3. Deactivates the original ducati-panigale-s-electro
 *
 * Usage:
 *   node scripts/fix-new-bikes-specs.mjs            # dry-run
 *   node scripts/fix-new-bikes-specs.mjs --apply     # fix in Supabase
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const envContent = readFileSync(join(REPO_ROOT, '.env.local'), 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const CREW_ID = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746';
const APPLY = process.argv.slice(2).includes('--apply');

const STORAGE_BASE = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public';

async function supaGet(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${SUPA_URL}${path}${qs ? '?' + qs : ''}`, {
    headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` },
  });
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
  return res.json();
}

async function supaDelete(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${SUPA_URL}${path}${qs ? '?' + qs : ''}`, {
    method: 'DELETE',
    headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` },
  });
  if (!res.ok) throw new Error(`DELETE ${path}: ${res.status} ${await res.text()}`);
  // DELETE often returns empty body — don't try to parse JSON
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function supaPost(path, body) {
  const res = await fetch(`${SUPA_URL}${path}`, {
    method: 'POST',
    headers: {
      'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json', 'Prefer': 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function supaPatch(path, body, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${SUPA_URL}${path}${qs ? '?' + qs : ''}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json', 'Prefer': 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── Bike definitions (same as add-new-bikes.mjs but with specs as OBJECT) ───

const RU_LABELS = {
  type: 'Тип', year: 'Год', make: 'Производитель', model: 'Модель',
  color: 'Цвет', drive: 'Привод', rating: 'Рейтинг',
  battery: 'Батарея', power_kw: 'Мощность', range_km: 'Запас хода',
  power_hp: 'Мощность (л.с.)', engine_cc: 'Объём двигателя',
  fuel_type: 'Тип топлива', price_rub: 'Цена',
  torque_nm: 'Крутящий момент', voltage_v: 'Напряжение',
  weight_kg: 'Масса', brake_type: 'Тормоза', dailyPrice: 'Аренда (сутки)',
  frame_type: 'Рама', sale_price: 'Цена продажи',
  bike_subtype: 'Тип мотоцикла', license_class: 'Категория прав',
  top_speed_kmh: 'Макс. скорость', seat_height_mm: 'Высота по седлу',
  price_per_hour: 'Аренда (1 час)', rent_weekday: 'Аренда (будни)',
  rent_weekend: 'Аренда (выходные)', access_tier: 'Уровень доступа',
  price_per_3h: 'Аренда (3 часа)', price_per_6h: 'Аренда (6 часов)',
  price_per_12h: 'Аренда (12 часов)', transmission: 'Трансмиссия',
  charge_time_h: 'Время зарядки', suspension_type: 'Подвеска',
  tires_front: 'Передняя резина', tires_rear: 'Задняя резина',
  ground_clearance_mm: 'Дорожный просвет', wheelbase_mm: 'Колёсная база',
  cooling: 'Охлаждение', rent_2_4d: 'Аренда (2–4 суток)',
  rent_5_10d: 'Аренда (5–10 суток)', rent_11_30d: 'Аренда (11–30 суток)',
  brand_type: 'Тип бренда', motor_peak_kw: 'Пиковая мощность',
  motor_nominal_kw: 'Номинальная мощность',
};

function buildLabels(specKeys) {
  const labels = {};
  for (const k of specKeys) {
    if (RU_LABELS[k]) labels[k] = RU_LABELS[k];
  }
  return labels;
}

// Ducati base
const DUCATI_BASE = {
  rent: 1, sale: true, type: 'Electric', year: '2025',
  drive: 'Hub motor (мотор-колесо)', battery: '72V 120Ah (Li-Ion)',
  power_kw: '5', range_km: '150', torque_nm: '280', voltage_v: '72',
  weight_kg: '150', brake_type: 'Гидравлические дисковые',
  frame_type: 'Стальная (китайская реплика)',
  bike_subtype: 'Электроспортбайк (реплика)',
  license_class: 'М (права В или М1, без регистрации)',
  top_speed_kmh: '90', seat_height_mm: '800', charge_time_h: '6–8',
  access_tier: 'entry', brand_type: 'dealer_data',
  features: [
    'Мотор-колесо 5 кВт на мономаятнике',
    'Визуальная копия Ducati Panigale S',
    '3 режима мощности',
    'Гидравлические дисковые тормоза',
    'Перевернутая вилка',
    'Задний моноамортизатор',
    'Класс М — права В или М1, без регистрации',
    'Светодиодная оптика',
  ],
  price_rub: 600000, sale_price: 600000,
  dailyPrice: 10000, price_per_hour: 1000, price_per_3h: 7000,
  price_per_6h: 8000, price_per_12h: 9000,
  rent_weekday: 10000, rent_weekend: 11500,
  rent_2_4d: 8500, rent_5_10d: 8000, rent_11_30d: 7000,
};

const DUCATI_VARIANTS = [
  {
    id: 'ducati-panigale-s-electro-red', make: 'Ducati',
    model: 'Panigale S Electro Red', color: 'Красный',
    description: 'Электроспортбайк Ducati Panigale S Electro Red — китайская реплика легендарного Panigale в культовом красном цвете. Мотор-колесо 5 кВт, батарея 72V 120Ah, запас хода до 150 км. Права В или М1, без регистрации.',
    rating: 4.7, subtitle: 'Ducati Panigale S Electro Red',
  },
  {
    id: 'ducati-panigale-s-electro-gold', make: 'Ducati',
    model: 'Panigale S Electro Gold', color: 'Золотой',
    description: 'Электроспортбайк Ducati Panigale S Electro Gold — стильная китайская реплика Panigale в золотом цвете. Мотор-колесо 5 кВт, батарея 72V 120Ah, запас хода 150 км. Права В или М1, без регистрации.',
    rating: 4.7, subtitle: 'Ducati Panigale S Electro Gold',
  },
  {
    id: 'ducati-panigale-s-electro-black', make: 'Ducati',
    model: 'Panigale S Electro Black', color: 'Чёрный',
    description: 'Электроспортбайк Ducati Panigale S Electro Black — классическая китайская реплика Panigale в чёрном. Мотор-колесо 5 кВт, батарея 72V 120Ah, запас хода до 150 км. Права В или М1, без регистрации.',
    rating: 4.6, subtitle: 'Ducati Panigale S Electro Black',
  },
  {
    id: 'ducati-panigale-s-electro-black-aero', make: 'Ducati',
    model: 'Panigale S Electro Black Aero', color: 'Чёрный матовый',
    description: 'Электроспортбайк Ducati Panigale S Electro Black Aero — китайская реплика Panigale в матовом чёрном с аэрографией. Мотор-колесо 5 кВт, батарея 72V 120Ah, запас хода 150 км. Права В или М1, без регистрации.',
    rating: 4.8, subtitle: 'Ducati Panigale S Electro Black Aero',
  },
];

const NEW_BIKES = [
  ...DUCATI_VARIANTS.map(v => {
    const specs = { ...DUCATI_BASE, ...v };
    specs.spec_labels = buildLabels(Object.keys(specs));
    specs.gallery = [`${STORAGE_BASE}/carpix/${v.id}/image_1.jpg`];
    return { id: v.id, make: v.make, model: v.model, description: v.description, specs };
  }),
  {
    id: 'hmd-m02', make: 'HMD', model: 'M02 (GT-EM07)',
    description: 'HMD M02 (GT-EM07) — современный электрический эндуро для леса, грунта и активного отдыха. Лёгкий (71 кг), манёвренный, бесшумный. Колёса 17/14, запас хода до 60 км.',
    specs: {
      rent: 1, sale: true, type: 'Electric', year: '2025', color: 'Чёрный',
      drive: 'Цепь', battery: '48V 25Ah', power_kw: '3',
      motor_peak_kw: '4.5', motor_nominal_kw: '3', range_km: '60',
      torque_nm: '120', voltage_v: '48', weight_kg: '71',
      brake_type: 'Гидравлические дисковые', frame_type: 'Стальная',
      bike_subtype: 'Электроэндуро', license_class: 'М (права не требуются)',
      top_speed_kmh: '75', seat_height_mm: '780', charge_time_h: '4–5',
      access_tier: 'entry', brand_type: 'community',
      features: ['Мгновенная тяга', 'Бесшумная работа', 'Без бензина и масла',
        'Лёгкий — 71 кг', 'Колёса 17/14', 'Класс М'],
      price_rub: 180000, sale_price: 180000, rating: 4.5,
      dailyPrice: 6000, price_per_hour: 600, price_per_3h: 4200,
      price_per_6h: 4800, price_per_12h: 5400,
      rent_weekday: 6000, rent_weekend: 7000,
      rent_2_4d: 5000, rent_5_10d: 4500, rent_11_30d: 4000,
    },
  },
  {
    id: 'falcon-lynx-purple', make: '79BIKE', model: 'Falcon Lynx Purple',
    description: '79BIKE Falcon Lynx Purple — электроэндуро премиум-класса. Mid-drive мотор 10 кВт (пик 12 кВт), батарея 72V 40Ah LG, запас хода 120 км. Рама 6061 T4/T6, подвеска FastAce 200 мм.',
    specs: {
      rent: 1, sale: true, type: 'Electric', year: '2025', color: 'Фиолетовый',
      drive: 'Цепь 428', battery: '72V 40Ah', power_kw: '10',
      motor_peak_kw: '12', motor_nominal_kw: '10', range_km: '120',
      torque_nm: '410', voltage_v: '72', weight_kg: '66',
      brake_type: 'Гидравлические дисковые', frame_type: 'Алюминиевый сплав 6061',
      bike_subtype: 'Электроэндуро', license_class: 'М (права не требуются)',
      top_speed_kmh: '90', seat_height_mm: '855', charge_time_h: '4',
      ground_clearance_mm: '295', wheelbase_mm: '1260',
      tires_front: '80/100-19', tires_rear: '3.0-18',
      access_tier: 'entry', brand_type: 'official_reseller',
      features: ['Mid-drive 10 кВт (пик 12 кВт)', '410 Нм', '90 км/ч',
        '120 км запас', '4ч зарядка', 'FastAce 200 мм', 'IP67'],
      price_rub: 450000, sale_price: 450000, rating: 4.9,
      dailyPrice: 11000, price_per_hour: 1100, price_per_3h: 7700,
      price_per_6h: 8800, price_per_12h: 9900,
      rent_weekday: 11000, rent_weekend: 13000,
      rent_2_4d: 9500, rent_5_10d: 8000, rent_11_30d: 7000,
    },
  },
];

// Add spec_labels + gallery to HMD and Lynx
for (const bike of NEW_BIKES) {
  if (!bike.specs.spec_labels) {
    bike.specs.spec_labels = buildLabels(Object.keys(bike.specs));
  }
  if (!bike.specs.gallery) {
    bike.specs.gallery = [`${STORAGE_BASE}/carpix/${bike.id}/image_1.jpg`];
  }
}

async function main() {
  const ids = NEW_BIKES.map(b => b.id);
  console.log(`\n🔧 Fix New Bikes Specs — ${APPLY ? 'APPLY' : 'DRY RUN'}\n`);
  console.log('Bikes to fix:', ids.join(', '));

  // Check current state
  const existing = await supaGet('/rest/v1/cars', {
    select: 'id,specs',
    crew_id: `eq.${CREW_ID}`,
    id: `in.(${ids.join(',')})`,
  });

  console.log(`Found ${existing.length} bikes in DB`);

  // Check if specs are strings (broken)
  let brokenCount = 0;
  for (const bike of existing) {
    if (typeof bike.specs === 'string') {
      brokenCount++;
      console.log(`  ⚠️  ${bike.id}: specs is STRING (broken)`);
    } else {
      console.log(`  ✅ ${bike.id}: specs is OBJECT (ok)`);
    }
  }

  if (brokenCount === 0) {
    console.log('\n✅ All bikes already have correct specs format. Nothing to fix.');
  } else if (APPLY) {
    console.log(`\n🚀 Fixing ${brokenCount} broken bikes...\n`);

    // Delete broken bikes
    for (const id of ids) {
      await supaDelete('/rest/v1/cars', { id: `eq.${id}`, crew_id: `eq.${CREW_ID}` });
      console.log(`  🗑️  Deleted: ${id}`);
    }

    // Re-insert with correct format (specs as plain object)
    for (const bike of NEW_BIKES) {
      const row = {
        id: bike.id,
        make: bike.make,
        model: bike.model,
        description: bike.description,
        embedding: null,
        daily_price: bike.specs.dailyPrice,
        image_url: `${STORAGE_BASE}/carpix/${bike.id}/image_1.jpg`,
        rent_link: `/rent/${bike.id}`,
        is_test_result: false,
        specs: bike.specs, // ← PLAIN OBJECT, not JSON.stringify!
        owner_id: 413553377,
        type: 'bike',
        crew_id: CREW_ID,
        availability_rules: {},
        quantity: 1,
      };

      await supaPost('/rest/v1/cars', row);
      console.log(`  ✅ Inserted: ${bike.id}`);
    }

    // Deactivate original Ducati
    console.log('\n📦 Deactivating original ducati-panigale-s-electro...');
    await supaPatch('/rest/v1/cars', {
      is_test_result: true,
      specs: {
        ...existing.find(b => b.id === 'ducati-panigale-s-electro')?.specs,
        deactivated: true,
        deactivatedReason: 'Replaced by 4 color variants',
      },
    }, { id: 'eq.ducati-panigale-s-electro', crew_id: `eq.${CREW_ID}` });
    console.log('  ✅ Deactivated original Ducati');
  } else {
    console.log('\n💡 Run with --apply to fix');
  }

  // Verify
  console.log('\n📊 Verification:');
  const verify = await supaGet('/rest/v1/cars', {
    select: 'id,specs',
    crew_id: `eq.${CREW_ID}`,
    id: `in.(${ids.join(',')})`,
  });

  for (const bike of verify) {
    const type = typeof bike.specs === 'string' ? 'STRING ❌' : 'OBJECT ✅';
    console.log(`  ${bike.id}: ${type}`);
  }

  // Check original Ducati
  const origDucati = await supaGet('/rest/v1/cars', {
    select: 'id,is_test_result',
    crew_id: `eq.${CREW_ID}`,
    id: 'eq.ducati-panigale-s-electro',
  });
  if (origDucati.length) {
    console.log(`\n  Original Ducati: is_test_result=${origDucati[0].is_test_result}`);
  }
}

main().catch(console.error);
