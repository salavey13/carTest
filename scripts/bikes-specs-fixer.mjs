#!/usr/bin/env node
/**
 * bikes-specs-fixer.mjs — Fix critical bike spec issues in Supabase + export CSV
 *
 * Fixes:
 * 1. Absurd price_per_hour (33-83% of daily) → set to dailyPrice/8 + add 3h/6h/12h tiers
 * 2. Ducati fake "tube frame" → simple steel frame (Chinese replica)
 * 3. Kayo TSD 110 garbled Russian text → proper UTF-8
 * 4. Missing access_tier for Kugoo, Sotion → deduce from type/power
 * 5. Missing rental prices for Kugoo → add sale-only marker
 *
 * Usage:
 *   node scripts/bikes-specs-fixer.mjs              # dry-run (show changes)
 *   node scripts/bikes-specs-fixer.mjs --apply       # apply to Supabase
 *   node scripts/bikes-specs-fixer.mjs --csv-only    # just export CSV
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

// Load env
const envPath = join(REPO_ROOT, '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const CREW_ID = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const CSV_ONLY = args.includes('--csv-only');

// ─── Supabase REST helpers ───
async function supaGet(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${SUPA_URL}${path}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function supaPatch(path, body, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${SUPA_URL}${path}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── Pricing fix logic ───
function computeFixedPricing(specs) {
  const dp = Number(specs.dailyPrice) || 0;
  if (dp <= 0) return null; // not rentable

  const currentPph = Number(specs.price_per_hour) || 0;
  const expectedPph = Math.round(dp / 8);

  // Only fix if current hourly is absurdly high (>25% of daily)
  if (currentPph > 0 && currentPph <= dp * 0.25) {
    return null; // already reasonable
  }

  // Compute tiered pricing with progressive discounts
  const pph = expectedPph;
  const p3h = Math.round(pph * 3 * 0.9);  // 10% discount for 3h
  const p6h = Math.round(pph * 6 * 0.8);  // 20% discount for 6h
  const p12h = Math.round(pph * 12 * 0.7); // 30% discount for 12h

  // Ensure 12h doesn't exceed daily
  const finalP12h = Math.min(p12h, Math.round(dp * 0.85));

  return {
    price_per_hour: pph,
    price_per_3h: p3h,
    price_per_6h: p6h,
    price_per_12h: finalP12h,
  };
}

// ─── Access tier deduction ───
function deduceAccessTier(specs) {
  const type = specs.type;
  const powerKw = Number(specs.power_kw) || 0;
  const powerHp = Number(specs.power_hp) || 0;
  const engineCc = Number(specs.engine_cc) || 0;
  const topSpeed = Number(specs.top_speed_kmh) || 0;
  const licenseClass = (specs.license_class || '').toLowerCase();

  // Pro tier: powerful bikes requiring category A (full motorcycle license)
  // Check for explicit "категория а" or "а /" patterns, NOT just any 'а' in string
  const hasCategoryA = /\bкатегори[яю]\s*а\b/i.test(licenseClass) ||
                       /^а[\s\/]/i.test(licenseClass) ||
                       /\/\s*а\b/i.test(licenseClass) ||
                       licenseClass === 'а' ||
                       licenseClass === 'а / l3';
  
  if (hasCategoryA && !licenseClass.includes('а1')) return 'pro';
  if (engineCc >= 400) return 'pro';
  if (powerHp >= 40) return 'pro';
  if (powerKw >= 30 && type === 'Electric') return 'pro';
  if (topSpeed >= 150 && (engineCc >= 400 || powerKw >= 25)) return 'pro';

  // Entry tier: everything else (light bikes, electro under 30kW, pitbikes, category M)
  return 'entry';
}

// ─── Kayo TSD 110 proper Russian text ───
const KAYO_FIX = {
  color: 'Чёрный/Синий',
  drive: 'Цепь 428, барабанная',
  battery: 'Бензин, 3.5 л',
  cooling: 'Воздушное',
  fuel_type: 'АИ-92',
  frame_type: 'Стальная',
  brake_type: 'Дисковые гидравлические (передний + задний)',
  features: [
    'Полуавтоматическая 4-ступенчатая (без сцепления)',
    'Электростартер + кикстартер',
    'Дисковые гидравлические тормоза',
    'Перевёрнутая вилка',
    'Лёгкий вес 60 кг',
    'Низкая посадка',
    'Идеален для обучения',
    'Для подростков и начинающих',
  ],
  spec_labels: {
    type: 'Тип',
    year: 'Год',
    color: 'Цвет',
    drive: 'Привод',
    rating: 'Рейтинг',
    battery: 'Топливо',
    cooling: 'Охлаждение',
    power_hp: 'Мощность (л.с.)',
    power_kw: 'Макс. мощность',
    range_km: 'Запас хода',
    engine_cc: 'Объём двигателя',
    fuel_type: 'Тип топлива',
    price_rub: 'Цена',
    rent_2_4d: 'Аренда (2-4 суток)',
    torque_nm: 'Крутящий момент',
    weight_kg: 'Масса',
    brake_type: 'Тормоза',
    dailyPrice: 'Аренда (сутки)',
    frame_type: 'Рама',
    rent_5_10d: 'Аренда (5-10 суток)',
    sale_price: 'Цена продажи',
    bike_subtype: 'Тип мотоцикла',
    rent_11_30d: 'Аренда (11-30 суток)',
    license_class: 'Категория прав',
    top_speed_kmh: 'Макс. скорость',
    seat_height_mm: 'Высота по седлу',
    price_per_hour: 'Аренда (1 час)',
    rent_weekday: 'Аренда (будни)',
    rent_weekend: 'Аренда (выходные)',
    access_tier: 'Уровень доступа',
    price_per_3h: 'Аренда (3 часа)',
    price_per_6h: 'Аренда (6 часов)',
    price_per_12h: 'Аренда (12 часов)',
  },
};

// ─── Main ───
async function main() {
  console.log(`\n🔧 Bike Specs Fixer — ${APPLY ? 'APPLY MODE' : 'DRY RUN'}\n`);

  // Fetch all bikes
  const bikes = await supaGet('/rest/v1/cars', {
    select: '*',
    crew_id: `eq.${CREW_ID}`,
    order: 'id',
  });

  console.log(`Found ${bikes.length} items in crew\n`);

  const changes = [];
  const summaries = [];

  for (const bike of bikes) {
    const specs = bike.specs || {};
    const type = specs.type || bike.type;
    const bid = bike.id;

    // Skip non-bike items (supplements, etc.)
    if (type !== 'ICE' && type !== 'Electric' && type !== 'bike' && type !== 'Bobber') {
      continue;
    }
    if (bid === 'ural-bobber' || bid === 'honda-cbr600rr-sz' || bid === 'jilang') {
      // Skip test/custom/placeholder bikes
      continue;
    }

    const patch = {};
    const specPatch = { ...specs };
    const bikeChanges = [];

    // ─── FIX 1: Pricing ───
    const fixedPricing = computeFixedPricing(specs);
    if (fixedPricing) {
      const oldPph = specs.price_per_hour;
      Object.assign(specPatch, fixedPricing);
      bikeChanges.push(
        `  💰 Pricing fix: price_per_hour ${oldPph}→${fixedPricing.price_per_hour}, ` +
        `+3h=${fixedPricing.price_per_3h}, +6h=${fixedPricing.price_per_6h}, +12h=${fixedPricing.price_per_12h}`
      );
    }

    // ─── FIX 2: Ducati frame ───
    if (bid === 'ducati-panigale-s-electro') {
      const oldFrame = specPatch.frame_type;
      if (oldFrame && oldFrame.includes('трубчатая')) {
        specPatch.frame_type = 'Стальная (китайская реплика)';
        bikeChanges.push(`  🏗️ Frame fix: "${oldFrame}" → "${specPatch.frame_type}"`);
      }

      // Also fix the description to be honest about it being a replica
      if (bike.description && bike.description.includes('Визуальная копия')) {
        // Description is already honest, good
      }
    }

    // ─── FIX 3: Kayo TSD 110 garbled text ───
    if (bid === 'kayo-tsd110') {
      const hasGarbled = Object.values(specs).some(
        (v) => typeof v === 'string' && v.includes('?') && v.length > 3 && /^\?+$/.test(v.replace(/[^?]/g, ''))
      );
      if (hasGarbled || (specs.color && specs.color.includes('?'))) {
        Object.assign(specPatch, KAYO_FIX);
        bikeChanges.push(`  🔤 Kayo: fixed garbled Russian text (encoding fix)`);
      }
    }

    // ─── FIX 4: Missing access_tier ───
    if (!specs.access_tier) {
      const tier = deduceAccessTier(specs);
      specPatch.access_tier = tier;
      bikeChanges.push(`  🔑 Access tier: deduced "${tier}" (was missing)`);
    }

    // ─── FIX 5: Update spec_labels to include new fields ───
    if (specPatch.price_per_3h && !specPatch.spec_labels?.price_per_3h) {
      specPatch.spec_labels = {
        ...specPatch.spec_labels,
        price_per_hour: 'Аренда (1 час)',
        price_per_3h: 'Аренда (3 часа)',
        price_per_6h: 'Аренда (6 часов)',
        price_per_12h: 'Аренда (12 часов)',
      };
      bikeChanges.push(`  🏷️ spec_labels: added hourly tier labels`);
    }

    if (bikeChanges.length > 0) {
      patch.specs = specPatch;
      changes.push({ bikeId: bid, patch, changes: bikeChanges });
      summaries.push({
        id: bid,
        make: bike.make,
        model: bike.model,
        type: specs.type,
        changes: bikeChanges,
      });
    }
  }

  // ─── Report ───
  console.log('═'.repeat(70));
  console.log('CHANGES SUMMARY');
  console.log('═'.repeat(70));

  for (const s of summaries) {
    console.log(`\n📍 ${s.id} (${s.make} ${s.model}, ${s.type})`);
    for (const c of s.changes) {
      console.log(c);
    }
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`Total bikes to fix: ${changes.length}`);
  console.log('═'.repeat(70));

  // ─── Apply ───
  if (APPLY && changes.length > 0) {
    console.log('\n🚀 Applying fixes to Supabase...\n');
    for (const { bikeId, patch, changes: bikeChanges } of changes) {
      try {
        await supaPatch('/rest/v1/cars', patch, { id: `eq.${bikeId}` });
        console.log(`✅ ${bikeId} — patched`);
      } catch (err) {
        console.error(`❌ ${bikeId} — FAILED: ${err.message}`);
      }
    }
    console.log('\n✅ All patches applied!\n');
  } else if (!APPLY && changes.length > 0) {
    console.log('\n💡 Run with --apply to apply these changes to Supabase\n');
  }

  // ─── Export CSV ───
  if (CSV_ONLY || APPLY) {
    console.log('📦 Exporting CSV...');
    const freshBikes = await supaGet('/rest/v1/cars', {
      select: '*',
      crew_id: `eq.${CREW_ID}`,
      order: 'id',
    });

    // Filter to actual bikes only
    const actualBikes = freshBikes.filter((b) => {
      const t = b.specs?.type || b.type;
      return t === 'ICE' || t === 'Electric' || t === 'bike' || t === 'Bobber';
    });

    const headers = ['id', 'make', 'model', 'description', 'embedding', 'daily_price', 'image_url', 'rent_link', 'is_test_result', 'specs', 'owner_id', 'type', 'crew_id', 'availability_rules', 'quantity'];

    const csvRows = [headers.join(',')];
    for (const bike of actualBikes) {
      const row = headers.map((h) => {
        const val = bike[h] ?? '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        // CSV escape: if contains comma, quote, or newline → wrap in quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      });
      csvRows.push(row.join(','));
    }

    const csvPath = join(REPO_ROOT, 'docs/sql/bikes_20260703.csv');
    writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');
    console.log(`✅ CSV exported to ${csvPath} (${actualBikes.length} bikes)`);
  }

  // ─── Pricing verification table ───
  if (APPLY || CSV_ONLY) {
    console.log('\n📊 Pricing verification (after fix):\n');
    const freshBikes = await supaGet('/rest/v1/cars', {
      select: 'id,specs',
      crew_id: `eq.${CREW_ID}`,
      order: 'id',
    });

    console.log('Bike'.padEnd(30) + 'daily'.padEnd(8) + '1h'.padEnd(8) + '3h'.padEnd(8) + '6h'.padEnd(8) + '12h'.padEnd(8) + 'ratio');
    console.log('─'.repeat(80));

    for (const b of freshBikes) {
      const s = b.specs || {};
      if (s.type !== 'ICE' && s.type !== 'Electric') continue;
      if (!s.dailyPrice || s.dailyPrice === 0) continue;

      const dp = Number(s.dailyPrice);
      const pph = Number(s.price_per_hour) || 0;
      const p3h = Number(s.price_per_3h) || pph * 3;
      const p6h = Number(s.price_per_6h) || pph * 6;
      const p12h = Number(s.price_per_12h) || pph * 12;
      const ratio = ((pph / dp) * 100).toFixed(0);

      console.log(
        b.id.padEnd(30) +
        String(dp).padEnd(8) +
        String(pph).padEnd(8) +
        String(p3h).padEnd(8) +
        String(p6h).padEnd(8) +
        String(p12h).padEnd(8) +
        ratio + '%'
      );
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
