#!/usr/bin/env node
/**
 * bikes-specs-bulk-fix.mjs — Comprehensive spec fixes from PDF review feedback
 *
 * Fixes:
 * 1. All 12 bike corrections from the review list
 * 2. New pricing formula: each halving = -10% of daily (3h=70%, 6h=80%, 12h=90%)
 * 3. Consistent spec representation across bikes
 * 4. All spec_labels in Russian
 *
 * Usage:
 *   node scripts/bikes-specs-bulk-fix.mjs              # dry-run
 *   node scripts/bikes-specs-bulk-fix.mjs --apply       # apply to Supabase
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

async function supaGet(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${SUPA_URL}${path}${qs ? '?' + qs : ''}`, {
    headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` },
  });
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
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

// ─── NEW PRICING FORMULA ───
// User's concept: each halving of time = lose 10% of daily price
// 24h → D (100%)
// 12h → D × 0.90 (90%)
// 6h  → D × 0.80 (80%)
// 3h  → D × 0.70 (70%)
// 1h  → D × 0.10 (10%)
function computeNewPricing(dailyPrice) {
  const d = Number(dailyPrice);
  if (!d || d <= 0) return null;
  return {
    price_per_hour: Math.round(d * 0.10),
    price_per_3h: Math.round(d * 0.70),
    price_per_6h: Math.round(d * 0.80),
    price_per_12h: Math.round(d * 0.90),
  };
}

// ─── CONSISTENT SPEC LABELS (Russian) ───
const RU_SPEC_LABELS = {
  type: 'Тип', year: 'Год', color: 'Цвет', drive: 'Привод',
  rating: 'Рейтинг', battery: 'Батарея', cooling: 'Охлаждение',
  power_hp: 'Мощность (л.с.)', power_kw: 'Макс. мощность',
  range_km: 'Запас хода', engine_cc: 'Объём двигателя',
  fuel_type: 'Тип топлива', price_rub: 'Цена',
  rent_2_4d: 'Аренда (2–4 суток)', torque_nm: 'Крутящий момент',
  voltage_v: 'Напряжение', weight_kg: 'Масса', brake_type: 'Тормоза',
  dailyPrice: 'Аренда (сутки)', frame_type: 'Рама',
  rent_5_10d: 'Аренда (5–10 суток)', sale_price: 'Цена продажи',
  bike_subtype: 'Тип мотоцикла', rent_11_30d: 'Аренда (11–30 суток)',
  license_class: 'Категория прав', top_speed_kmh: 'Макс. скорость',
  seat_height_mm: 'Высота по седлу', price_per_hour: 'Аренда (1 час)',
  rent_weekday: 'Аренда (будни)', rent_weekend: 'Аренда (выходные)',
  access_tier: 'Уровень доступа', price_per_3h: 'Аренда (3 часа)',
  price_per_6h: 'Аренда (6 часов)', price_per_12h: 'Аренда (12 часов)',
  transmission: 'Трансмиссия', charge_time_h: 'Время зарядки',
  fuel_capacity_l: 'Объём бака', suspension_type: 'Подвеска',
  tires_front: 'Передняя резина', tires_rear: 'Задняя резина',
  ground_clearance_mm: 'Дорожный просвет', wheelbase_mm: 'Колёсная база',
  dimensions_mm: 'Габариты', recommend_percent: 'Рекомендация',
  motor_peak_kw: 'Пиковая мощность мотора', motor_nominal_kw: 'Номинальная мощность',
  acceleration_0_100_s: 'Разгон 0–100 км/ч', acceleration_0_50_s: 'Разгон 0–50 км/ч',
  fuel_consumption_l_100km: 'Расход топлива', make: 'Производитель',
  model: 'Модель', brand_type: 'Тип бренда',
};

// ─── PER-BIKE FIXES ───
const BIKE_FIXES = {
  'jilang-max-pro': {
    bike_subtype: 'Макси-скутер',
    brake_type: 'Дисковые',
    suspension_type: 'Телескопическая вилка спереди, двойные амортизаторы сзади',
    license_class: 'М',
    make: 'Jilang',
  },
  'bmw-f800r': {
    color: 'Белый/Чёрный',
    license_class: 'А (полноценный мотоцикл, требуется категория А)',
    frame_type: 'Алюминиевая',
    suspension_type: 'Перевёрнутая вилка, моноамортизатор (регулируемые)',
    brake_type: 'Дисковые Brembo',
  },
  'kayo-tsd110': {
    suspension_type: 'Телескопическая вилка + задний моноамортизатор',
    make: 'Kayo',
    model: 'TSD 110',
    bike_subtype: 'Питбайк',
    license_class: 'А1',
  },
  'falcon-pro-2025': {
    rent_weekend: 12000,
  },
  'kugoo-wish-02-pro': {
    brake_type: 'Гидравлические дисковые',
    suspension_type: 'Телескопическая вилка спереди, пружинный амортизатор сзади',
    frame_type: 'Стальная трубчатая',
    license_class: 'М (права не требуются)',
    bike_subtype: 'Электроэндуро',
    make: 'Kugoo',
    battery: '60V 27Ah Li-Ion',
  },
  'motoland-breakout': {
    make: 'Motoland',
    model: 'Breakout 300',
    bike_subtype: 'Круизер, бензиновый',
    suspension_type: 'Телескопическая вилка, задний амортизатор',
  },
  'rerode-r1-plus': {
    battery: '72V 40Ah',
    brake_type: 'Гидравлические дисковые',
    suspension_type: 'Телескопическая вилка',
    license_class: 'Права не нужны (класс М)',
  },
  'sotion-em01': {
    make: 'Sotion',
    bike_subtype: 'Электрический мини-байк',
    license_class: 'М (права не требуются)',
  },
  'nibbler-regumoto-4v': {
    bike_subtype: 'Бензиновый нейкед',
    power_hp: '27',  // 19.9 kW ≈ 27 HP — already set, just ensure consistency
    make: 'Regulmoto',
    model: 'Nibbler 300 4V',
  },
  'falcon-gt-2025': {
    charge_time_h: '3.5–4',
    battery: '72V 40Ah',
  },
  'ducati-panigale-s-electro': {
    battery: '72V 120Ah (Li-Ion)',
    charge_time_h: '6–8',
  },
  'y-volt-surge-v': {
    make: 'Y-VOLT',
    model: 'Surge V',
    battery: '72V 45Ah',
    suspension_type: 'FASTACE — телескопическая вилка, задний моноамортизатор',
    charge_time_h: '3',
    license_class: 'А (35 кВт, эквивалент 125+ сс)',
  },
  'kawasaki-ex650k': {
    make: 'Kawasaki',
    model: 'EX650K (Ninja 650)',
  },
  'suzuki-gsx-s1000f': {
    brake_type: 'Дисковые Brembo (радиальные), ABS',
    suspension_type: 'Перевёрнутая вилка 43 мм, задний моноамортизатор (регулируемые)',
  },
};

// ─── FIELDS TO REMOVE FROM SPECS (consistency cleanup) ───
const REMOVE_FIELDS = {
  'kugoo-wish-02-pro': ['dealer_date', 'model'],
};

// ─── MAIN ───
async function main() {
  console.log(`\n🔧 Bikes Bulk Spec Fix — ${APPLY ? 'APPLY MODE' : 'DRY RUN'}\n`);

  const bikes = await supaGet('/rest/v1/cars', {
    select: '*',
    crew_id: `eq.${CREW_ID}`,
    order: 'id',
  });

  const changes = [];

  for (const bike of bikes) {
    const specs = { ...(bike.specs || {}) };
    const bid = bike.id;
    const type = specs.type;

    if (type !== 'ICE' && type !== 'Electric') continue;

    const fix = BIKE_FIXES[bid];
    if (!fix && bid !== 'kawasaki-ex650k') {
      // Still apply pricing + spec_labels to all bikes
    }

    const bikeChanges = [];
    const newSpecs = { ...specs };

    // ─── Apply per-bike field fixes ───
    if (fix) {
      for (const [key, value] of Object.entries(fix)) {
        const oldValue = newSpecs[key];
        if (key === 'rent_weekend') {
          newSpecs[key] = value;
          if (oldValue !== value) {
            bikeChanges.push(`  ${key}: ${oldValue} → ${value}`);
          }
          continue;
        }
        if (oldValue !== value) {
          newSpecs[key] = value;
          bikeChanges.push(`  ${key}: ${String(oldValue).substring(0, 50)} → ${String(value).substring(0, 50)}`);
        }
      }
    }

    // ─── Apply to top-level make/model too ───
    const patch = {};
    if (fix?.make && bike.make !== fix.make) {
      patch.make = fix.make;
      bikeChanges.push(`  make (column): ${bike.make} → ${fix.make}`);
    }
    if (fix?.model && bike.model !== fix.model) {
      patch.model = fix.model;
      bikeChanges.push(`  model (column): ${bike.model} → ${fix.model}`);
    }

    // ─── Remove unwanted fields ───
    const removeList = REMOVE_FIELDS[bid] || [];
    for (const field of removeList) {
      if (newSpecs[field] !== undefined) {
        delete newSpecs[field];
        bikeChanges.push(`  ✂️ removed field: ${field}`);
      }
      if (newSpecs.spec_labels?.[field] !== undefined) {
        delete newSpecs.spec_labels[field];
      }
    }

    // ─── Apply new pricing formula ───
    const dp = Number(newSpecs.dailyPrice) || 0;
    if (dp > 0) {
      const newPricing = computeNewPricing(dp);
      const oldPph = newSpecs.price_per_hour;
      const oldP3h = newSpecs.price_per_3h;
      const oldP6h = newSpecs.price_per_6h;
      const oldP12h = newSpecs.price_per_12h;

      // Only update if different
      if (newPricing.price_per_hour !== oldPph ||
          newPricing.price_per_3h !== oldP3h ||
          newPricing.price_per_6h !== oldP6h ||
          newPricing.price_per_12h !== oldP12h) {
        Object.assign(newSpecs, newPricing);
        bikeChanges.push(
          `  💰 Pricing: 1h=${oldPph}→${newPricing.price_per_hour}, ` +
          `3h=${oldP3h}→${newPricing.price_per_3h}, ` +
          `6h=${oldP6h}→${newPricing.price_per_6h}, ` +
          `12h=${oldP12h}→${newPricing.price_per_12h}`
        );
      }
    }

    // ─── Ensure all spec_labels are in Russian ───
    const currentLabels = newSpecs.spec_labels || {};
    let labelsChanged = false;
    const newLabels = {};
    for (const [key, label] of Object.entries(currentLabels)) {
      // If the label is an English key name (e.g., "type" as label), replace with Russian
      if (RU_SPEC_LABELS[key]) {
        if (label !== RU_SPEC_LABELS[key]) {
          newLabels[key] = RU_SPEC_LABELS[key];
          labelsChanged = true;
        } else {
          newLabels[key] = label;
        }
      } else {
        newLabels[key] = label; // keep custom labels
      }
    }

    // Also add labels for any spec keys that don't have labels yet
    for (const key of Object.keys(newSpecs)) {
      if (key === 'spec_labels' || key.startsWith('bike_engine_spec_line')) continue;
      if (!newLabels[key] && RU_SPEC_LABELS[key]) {
        newLabels[key] = RU_SPEC_LABELS[key];
        labelsChanged = true;
      }
    }

    if (labelsChanged) {
      newSpecs.spec_labels = newLabels;
      bikeChanges.push('  🏷️ spec_labels: translated to Russian');
    }

    if (bikeChanges.length > 0) {
      patch.specs = newSpecs;
      changes.push({ bikeId: bid, patch, changes: bikeChanges });
    }
  }

  // ─── Report ───
  console.log('═'.repeat(70));
  for (const { bikeId, changes: bikeChanges } of changes) {
    console.log(`\n📍 ${bikeId}`);
    for (const c of bikeChanges) console.log(c);
  }
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`Total bikes to fix: ${changes.length}\n`);

  // ─── Apply ───
  if (APPLY) {
    console.log('🚀 Applying to Supabase...\n');
    for (const { bikeId, patch } of changes) {
      try {
        await supaPatch('/rest/v1/cars', patch, { id: `eq.${bikeId}` });
        console.log(`✅ ${bikeId}`);
      } catch (err) {
        console.error(`❌ ${bikeId}: ${err.message}`);
      }
    }

    // ─── Export CSV ───
    console.log('\n📦 Exporting CSV...');
    const freshBikes = await supaGet('/rest/v1/cars', {
      select: '*',
      crew_id: `eq.${CREW_ID}`,
      order: 'id',
    });

    const actualBikes = freshBikes.filter((b) => {
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
    const csvPath = join(REPO_ROOT, 'docs/sql/bikes_20260704.csv');
    writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');
    console.log(`✅ CSV: ${csvPath} (${actualBikes.length} bikes)`);

    // ─── Pricing verification ───
    console.log('\n📊 New pricing ladder:\n');
    console.log('Bike'.padEnd(30) + 'daily'.padStart(7) + '1h'.padStart(7) + '3h'.padStart(7) + '6h'.padStart(7) + '12h'.padStart(7));
    console.log('─'.repeat(65));
    for (const b of actualBikes) {
      const s = b.specs || {};
      const dp = Number(s.dailyPrice) || 0;
      if (!dp) continue;
      console.log(
        b.id.padEnd(30) +
        String(dp).padStart(7) +
        String(s.price_per_hour || 0).padStart(7) +
        String(s.price_per_3h || 0).padStart(7) +
        String(s.price_per_6h || 0).padStart(7) +
        String(s.price_per_12h || 0).padStart(7)
      );
    }
  } else {
    console.log('💡 Run with --apply to apply\n');
  }
}

main().catch(console.error);
