#!/usr/bin/env node
/**
 * add-new-bikes.mjs — Add 4 Ducati variants + HMD M02 + Falcon Lynx Purple
 *
 * Deduce prices using the v2 formula (halve time, lose 10%):
 *   1h=10%, 3h=70%, 6h=80%, 12h=90%, daily=100%
 *
 * Usage:
 *   node scripts/add-new-bikes.mjs            # dry-run
 *   node scripts/add-new-bikes.mjs --apply     # insert to Supabase + export CSV
 */

import { readFileSync, writeFileSync } from 'fs';
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

// ─── v2 Pricing Formula ───
function computePricing(dailyPrice, weekendPrice = null) {
  const d = Number(dailyPrice);
  return {
    price_per_hour: Math.round(d * 0.10),
    price_per_3h: Math.round(d * 0.70),
    price_per_6h: Math.round(d * 0.80),
    price_per_12h: Math.round(d * 0.90),
    dailyPrice: d,
    rent_weekday: d,
    rent_weekend: weekendPrice ? Number(weekendPrice) : Math.round(d * 1.15),
    rent_2_4d: Math.round(d * 0.85),
    rent_5_10d: Math.round(d * 0.80),
    rent_11_30d: Math.round(d * 0.70),
  };
}

// ─── Russian spec labels ───
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
  charge_time_h: 'Время зарядки', fuel_capacity_l: 'Объём бака',
  suspension_type: 'Подвеска', tires_front: 'Передняя резина',
  tires_rear: 'Задняя резина', ground_clearance_mm: 'Дорожный просвет',
  wheelbase_mm: 'Колёсная база', dimensions_mm: 'Габариты',
  recommend_percent: 'Рекомендация', motor_peak_kw: 'Пиковая мощность',
  motor_nominal_kw: 'Номинальная мощность', cooling: 'Охлаждение',
  rent_2_4d: 'Аренда (2–4 суток)', rent_5_10d: 'Аренда (5–10 суток)',
  rent_11_30d: 'Аренда (11–30 суток)', brand_type: 'Тип бренда',
};

function buildLabels(specKeys) {
  const labels = {};
  for (const k of specKeys) {
    if (RU_LABELS[k]) labels[k] = RU_LABELS[k];
  }
  return labels;
}

// ─── Bike definitions ───

// Ducati base specs (shared across 4 color variants)
const DUCATI_BASE = {
  type: 'Electric',
  year: '2025',
  drive: 'Hub motor (мотор-колесо)',
  battery: '72V 120Ah (Li-Ion)',
  power_kw: '5',
  range_km: '150',
  torque_nm: '280',
  voltage_v: '72',
  weight_kg: '150',
  brake_type: 'Гидравлические дисковые',
  frame_type: 'Стальная (китайская реплика)',
  bike_subtype: 'Электроспортбайк (реплика)',
  license_class: 'М (права В или М1, без регистрации)',
  top_speed_kmh: '90',
  seat_height_mm: '800',
  charge_time_h: '6–8',
  access_tier: 'entry',
  brand_type: 'dealer_data',
  source: 'https://eco-moto.shop/elektromototsikly/gorodskie-elektrosamokaty/electro-ducati-panigale-s',
  rent: 1,
  sale: true,
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
  // Pricing
  price_rub: 600000,
  sale_price: 600000,
  // Per-variant: dailyPrice = 10000
  // Tiers: 1h=1000, 3h=7000, 6h=8000, 12h=9000
  // Multi-day: 2-4=8500, 5-10=8000, 11-30=7000
  // Weekend: 11500
};

const DUCATI_VARIANTS = [
  {
    id: 'ducati-panigale-s-electro-red',
    make: 'Ducati',
    model: 'Panigale S Electro Red',
    color: 'Красный',
    colorHex: '#c0392b',
    colorLabel: 'Ducati Red',
    subtitle: 'Ducati Panigale S Electro Red',
    description: 'Электроспортбайк Ducati Panigale S Electro Red — китайская реплика легендарного Panigale в культовом красном цвете. Мотор-колесо 5 кВт, батарея 72V 120Ah, запас хода до 150 км. Визуальная копия оригинала, посадка и обвес — как у бензинового 400-450 кубового. Достаточно прав категории В или М1.',
    rating: 4.7,
  },
  {
    id: 'ducati-panigale-s-electro-gold',
    make: 'Ducati',
    model: 'Panigale S Electro Gold',
    color: 'Золотой',
    colorHex: '#d4a843',
    colorLabel: 'Gold',
    subtitle: 'Ducati Panigale S Electro Gold',
    description: 'Электроспортбайк Ducati Panigale S Electro Gold — стильная китайская реплика Panigale в золотом цвете. Мотор-колесо 5 кВт, батарея 72V 120Ah, запас хода 150 км. Спортивный силуэт и обвес оригинала, едет как 400-450 кубовый бензин. Права В или М1, без регистрации.',
    rating: 4.7,
  },
  {
    id: 'ducati-panigale-s-electro-black',
    make: 'Ducati',
    model: 'Panigale S Electro Black',
    color: 'Чёрный',
    colorHex: '#1a1a1a',
    colorLabel: 'Чёрный',
    subtitle: 'Ducati Panigale S Electro Black',
    description: 'Электроспортбайк Ducati Panigale S Electro Black — классическая китайская реплика Panigale в чёрном. Мотор-колесо 5 кВт, батарея 72V 120Ah, запас хода до 150 км. Агрессивный силуэт, посадка спортбайка, обтекатели — как у легендарного оригинала. Права В или М1, без регистрации.',
    rating: 4.6,
  },
  {
    id: 'ducati-panigale-s-electro-black-aero',
    make: 'Ducati',
    model: 'Panigale S Electro Black Aero',
    color: 'Чёрный матовый',
    colorHex: '#0d0d0d',
    colorLabel: 'Чёрный Aero (матовый)',
    subtitle: 'Ducati Panigale S Electro Black Aero',
    description: 'Электроспортбайк Ducati Panigale S Electro Black Aero — китайская реплика Panigale в матовом чёрном с аэрографией. Мотор-колесо 5 кВт, батарея 72V 120Ah, запас хода 150 км. Спортивный обвес и посадка, уникальная матовая отделка. Права В или М1, без регистрации.',
    rating: 4.8,
  },
];

// HMD M02 specs from user
const HMD_M02 = {
  id: 'hmd-m02',
  make: 'HMD',
  model: 'M02 (GT-EM07)',
  type: 'Electric',
  year: '2025',
  color: 'Чёрный',
  drive: 'Цепь',
  battery: '48V 25Ah',
  power_kw: '3',
  motor_peak_kw: '4.5',
  motor_nominal_kw: '3',
  range_km: '60',
  torque_nm: '120',
  voltage_v: '48',
  weight_kg: '71',
  brake_type: 'Гидравлические дисковые',
  frame_type: 'Стальная',
  bike_subtype: 'Электроэндуро / электропитбайк',
  license_class: 'М (права не требуются)',
  top_speed_kmh: '75',
  seat_height_mm: '780',
  charge_time_h: '4–5',
  access_tier: 'entry',
  brand_type: 'community',
  source: 'https://hmd-bikes.com/m02',
  rent: 1,
  sale: true,
  features: [
    'Мгновенная тяга с места',
    'Практически бесшумная работа',
    'Без бензина, масла и сложного обслуживания',
    'Лёгкий — всего 71 кг',
    'Колёса 17/14 (перед/зад)',
    'Класс М — без регистрации и прав',
  ],
  // Pricing — similar tier to Kugoo (60V 27Ah) but slightly lower
  // dailyPrice = 6000, 1h=600, 3h=4200, 6h=4800, 12h=5400
  price_rub: 180000,
  sale_price: 180000,
  rating: 4.5,
  dailyPrice: 6000,
  rent_weekday: 6000,
  rent_weekend: 7000,
  rent_2_4d: 5000,
  rent_5_10d: 4500,
  rent_11_30d: 4000,
  price_per_hour: 600,
  price_per_3h: 4200,
  price_per_6h: 4800,
  price_per_12h: 5400,
};

// Falcon Lynx Purple specs from web search
const FALCON_LYNX_PURPLE = {
  id: 'falcon-lynx-purple',
  make: '79BIKE',
  model: 'Falcon Lynx Purple',
  type: 'Electric',
  year: '2025',
  color: 'Фиолетовый',
  drive: 'Цепь 428',
  battery: '72V 40Ah (LG Lithium)',
  power_kw: '10',
  motor_peak_kw: '12',
  motor_nominal_kw: '10',
  range_km: '120',
  torque_nm: '410',
  voltage_v: '72',
  weight_kg: '66', // 146 lbs ≈ 66 kg
  brake_type: 'Гидравлические дисковые (220 мм, 2.8 мм)',
  frame_type: 'Алюминиевый сплав 6061 T4 & T6',
  bike_subtype: 'Электроэндуро (кросс)',
  license_class: 'М (права не требуются, off-road)',
  top_speed_kmh: '90', // 56 mph
  seat_height_mm: '855',
  ground_clearance_mm: '295',
  wheelbase_mm: '1260',
  tires_front: '80/100-19',
  tires_rear: '3.0-18',
  charge_time_h: '4',
  transmission: '1-ступенчатая (прямой привод)',
  cooling: 'Воздушное',
  access_tier: 'entry',
  brand_type: 'official_reseller',
  source: 'https://79bike.com/products/lynx',
  rent: 1,
  sale: true,
  features: [
    'Мотор mid-drive 10 кВт (пик 12 кВт)',
    'Крутящий момент 410 Нм',
    'Скорость до 90 км/ч (56 mph)',
    'Запас хода до 120 км',
    'Время зарядки 4 часа',
    'Рама 6061 T4 & T6 алюминиевый сплав',
    'FastAce вилка 200 мм хода',
    'Задний амортизатор 200 мм хода',
    'Цепь 428 (106 звеньев)',
    'IP67 защита от воды и пыли',
    'Bluetooth-динамик',
    'Встроенный Bluetooth',
  ],
  // Pricing — between Falcon Pro and Falcon GT
  // dailyPrice = 11000, 1h=1100, 3h=7700, 6h=8800, 12h=9900
  price_rub: 450000,
  sale_price: 450000,
  rating: 4.9,
  dailyPrice: 11000,
  rent_weekday: 11000,
  rent_weekend: 13000,
  rent_2_4d: 9500,
  rent_5_10d: 8000,
  rent_11_30d: 7000,
  price_per_hour: 1100,
  price_per_3h: 7700,
  price_per_6h: 8800,
  price_per_12h: 9900,
};

function buildDucatiSpec(variant) {
  const pricing = computePricing(DUCATI_BASE.price_rub * 0.0167, 0); // ~10000 daily for €600k worth
  // Actually, Ducati dailyPrice should be 10000 (same as original)
  const daily = 10000;
  const tier = computePricing(daily, 11500);
  return {
    ...DUCATI_BASE,
    ...variant,
    dailyPrice: daily,
    ...tier,
    // Spec labels
    spec_labels: buildLabels([
      ...Object.keys(DUCATI_BASE), 'color', 'subtitle', 'description', 'source',
    ]),
  };
}

function buildHmdSpec() {
  return {
    ...HMD_M02,
    // Pricing already set
    spec_labels: buildLabels(Object.keys(HMD_M02)),
  };
}

function buildLynxSpec() {
  return {
    ...FALCON_LYNX_PURPLE,
    spec_labels: buildLabels(Object.keys(FALCON_LYNX_PURPLE)),
  };
}

function toCarRow(bikeSpec) {
  const id = bikeSpec.id;
  const make = bikeSpec.make;
  const model = bikeSpec.model;
  const description = bikeSpec.description || '';
  const dailyPrice = bikeSpec.dailyPrice;
  const rentLink = `/rent/${id}`;
  const imageUrl = `${STORAGE_BASE}/carpix/${id}/image_1.jpg`;
  const gallery = [imageUrl];
  const subtitle = bikeSpec.subtitle || `${make} ${model}`;

  // Build final specs object
  const specs = { ...bikeSpec };
  delete specs.id;
  delete specs.make;
  delete specs.model;
  delete specs.description;
  specs.subtitle = subtitle;
  specs.rent_link = rentLink;
  specs.gallery = gallery;
  specs.image_url = imageUrl;

  return {
    id,
    make,
    model,
    description: bikeSpec.description || '',
    embedding: null,
    daily_price: dailyPrice,
    image_url: imageUrl,
    rent_link: rentLink,
    is_test_result: false,
    specs: JSON.stringify(specs),
    owner_id: 413553377, // Paul (Паша)
    type: 'bike',
    crew_id: CREW_ID,
    availability_rules: {},
    quantity: 1,
  };
}

async function main() {
  console.log(`\n🏍 Add New Bikes — ${APPLY ? 'APPLY MODE' : 'DRY RUN'}\n`);

  const newBikes = [
    ...DUCATI_VARIANTS.map(buildDucatiSpec),
    buildHmdSpec(),
    buildLynxSpec(),
  ];

  // Check for duplicates
  const existing = await supaGet('/rest/v1/cars', {
    select: 'id',
    crew_id: `eq.${CREW_ID}`,
    id: `in.(${newBikes.map(b => b.id).join(',')})`,
  });
  const existingIds = new Set(existing.map(b => b.id));

  console.log(`Bikes to add: ${newBikes.length}`);
  console.log(`Already in DB: ${existingIds.size || 0}\n`);

  for (const bike of newBikes) {
    const status = existingIds.has(bike.id) ? '⚠️ EXISTS' : '✅ NEW';
    console.log(`${status}  ${bike.id} — ${bike.make} ${bike.model} (${bike.type})`);
    console.log(`        color: ${bike.color} | daily: ${bike.dailyPrice}₽ | price: ${bike.price_rub}₽`);
  }

  if (APPLY) {
    console.log('\n🚀 Inserting to Supabase...\n');
    for (const bike of newBikes) {
      if (existingIds.has(bike.id)) {
        console.log(`⏭  ${bike.id} — already exists, skipping`);
        continue;
      }
      const row = toCarRow(bike);
      try {
        await supaPost('/rest/v1/cars', row);
        console.log(`✅ ${bike.id}`);
      } catch (err) {
        console.error(`❌ ${bike.id}: ${err.message}`);
      }
    }

    // Export CSV
    console.log('\n📦 Exporting CSV...');
    const allBikes = await supaGet('/rest/v1/cars', {
      select: '*',
      crew_id: `eq.${CREW_ID}`,
      order: 'id',
    });
    const actualBikes = allBikes.filter((b) => {
      const t = b.specs?.type;
      return t === 'ICE' || t === 'Electric';
    });
    const headers = ['id','make','model','description','embedding','daily_price','image_url','rent_link','is_test_result','specs','owner_id','type','crew_id','availability_rules','quantity'];
    const csvRows = [headers.join(',')];
    for (const bike of actualBikes) {
      const row = headers.map((h) => {
        const val = bike[h] ?? '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return (str.includes(',') || str.includes('"') || str.includes('\n'))
          ? '"' + str.replace(/"/g, '""') + '"'
          : str;
      });
      csvRows.push(row.join(','));
    }
    const csvPath = join(REPO_ROOT, 'docs/sql/bikes_20260704_with_new.csv');
    writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');
    console.log(`✅ CSV: ${csvPath} (${actualBikes.length} bikes)`);
  } else {
    console.log('\n💡 Run with --apply to insert\n');
  }
}

main().catch(console.error);
