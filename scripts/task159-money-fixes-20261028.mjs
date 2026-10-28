#!/usr/bin/env node
/**
 * TASK159 (boss 2026-10-28) — one-off money fixes, three sections:
 *
 *  1. СУБАРЕНДА: три байка с specs.subrenter_chat_id, но без specs.salary
 *     (yamaha-r6-2007, ducati-1199-panigale-2012, ducati-panigale-s-electro-green)
 *     → specs.salary = партнёрские категории + пересчёт замороженных сверок
 *     (base = партнёрский коэффициент × (часы<24 ? 0.5 : 1)).
 *  2. FALCON: falcon-pro-2026 + falcon-gt-2026 → specs.salary.saleCategory =
 *     'enduro_moped' (5000 ₽) — комиссия за продажу прошивается в байк,
 *     профиль/выплаты считают её на лету, ретро-фикс всех прошлых продаж.
 *  3. ДИЛ→СНАПШОТ: строки rental_verifications, где принятый дил НОВЕЕ правки
 *     снапшота (agreed.at > correction.at), а снапшот всё ещё держит старые
 *     деньги → переписываем деньги снапшота на принятый дил (код-эквивалент
 *     accept-флоу task159; для старых строк, принятых до фикса).
 *
 * DRY RUN по умолчанию; `--apply` — запись. Пишет только snapshot/specs,
 * статусы сверок не трогает.
 */
import { readFileSync } from 'node:fs';

try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* env уже в окружении */ }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('нет SUPABASE_URL/SERVICE_KEY'); process.exit(2); }
const APPLY = process.argv.includes('--apply');
const H = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

async function sb(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path}: ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}

const SUBRENT_BIKES = {
  'yamaha-r6-2007': { tier: 'regular', rental: 'partner_regular', base: 500 },
  'ducati-1199-panigale-2012': { tier: 'premium', rental: 'partner_premium', base: 750 },
  'ducati-panigale-s-electro-green': { tier: 'regular', rental: 'partner_regular', base: 500 },
};
const FALCON_BIKES = ['falcon-pro-2026', 'falcon-gt-2026'];
const NOW = new Date().toISOString();

console.log(`== TASK159 money fixes — ${APPLY ? 'APPLY' : 'DRY RUN'} ==\n`);

// ── 1. Субаренда: specs.salary + пересчёт сверок ────────────────────────────
const bikeIds = Object.keys(SUBRENT_BIKES);
const cars = await sb('GET', `/rest/v1/cars?id=in.(${bikeIds.map(encodeURIComponent).join(',')})&select=id,daily_price,specs`);
for (const car of cars) {
  const cfg = SUBRENT_BIKES[car.id];
  if (!cfg) continue;
  const specs = (car.specs && typeof car.specs === 'object') ? { ...car.specs } : {};
  const saleCat = cfg.tier === 'premium' ? 'premium' : 'regular';
  specs.salary = {
    tier: cfg.tier,
    subrented: true,
    rentalCategory: cfg.rental,
    saleCategory: specs.salary?.saleCategory || saleCat,
    dailyPriceAtSet: Number(car.daily_price) || 0,
    setAt: NOW,
  };
  console.log(`[1] ${car.id}: specs.salary = ${JSON.stringify(specs.salary)}${APPLY ? '' : '  (dry)'}`);
  if (APPLY) await sb('PATCH', `/rest/v1/cars?id=eq.${encodeURIComponent(car.id)}`, { specs });
}

//_verification snapshots for rentals on those bikes
if (bikeIds.length > 0) {
  const rentals = await sb('GET', `/rest/v1/rentals?vehicle_id=in.(${bikeIds.map(encodeURIComponent).join(',')})&select=rental_id,vehicle_id,requested_start_date,requested_end_date,agreed_start_date,agreed_end_date&status=neq.cancelled`);
  const hoursOf = new Map(rentals.map(r => {
    const s = Date.parse(r.requested_start_date || r.agreed_start_date || '');
    const e = Date.parse(r.requested_end_date || r.agreed_end_date || '');
    const h = Number.isFinite(s) && Number.isFinite(e) ? (e - s) / 3.6e6 : NaN;
    return [String(r.rental_id), h];
  }));
  const vehOf = new Map(rentals.map(r => [String(r.rental_id), r.vehicle_id]));
  if (rentals.length === 0) { console.log('[1v] аренд на этих байках нет'); }

  const verRows = rentals.length > 0
    ? await sb('GET', `/rest/v1/rental_verifications?select=rental_id,status,snapshot,negotiation&rental_id=in.(${rentals.map(r => encodeURIComponent(String(r.rental_id))).join(',')})`)
    : [];
  let fixed = 0;
  for (const row of verRows) {
    const cfg = SUBRENT_BIKES[vehOf.get(String(row.rental_id)) || ''];
    const snap = (row.snapshot && typeof row.snapshot === 'object') ? row.snapshot : {};
    const hasMoney = snap.base != null || snap.equipment != null || snap.overprice != null || snap.total != null;
    if (!cfg || !hasMoney) continue;
    const h = hoursOf.get(String(row.rental_id));
    const short = Number.isFinite(h) && h > 0 && h < 24;
    const newBase = short ? Math.round(cfg.base / 2) : cfg.base;
    if (Number(snap.base) === newBase) continue;
    const from = { base: Number(snap.base) || 0, equipment: Number(snap.equipment) || 0, overprice: Number(snap.overprice) || 0, total: Number(snap.total) || 0 };
    const newTotal = newBase + from.equipment + from.overprice;
    const newSnap = { ...snap, base: newBase, total: newTotal, correction: { at: NOW, by: 'boss (task159: субаренда)', from, reason: `байк субарендный — партнёрский коэффициент${short ? ' (часы<24, ×0.5)' : ''}` } };
    console.log(`[1v] ${row.rental_id.slice(0, 8)} [${row.status}] base ${from.base}→${newBase}, total ${from.total}→${newTotal}${APPLY ? '' : '  (dry)'}`);
    if (APPLY) await sb('PATCH', `/rest/v1/rental_verifications?rental_id=eq.${encodeURIComponent(String(row.rental_id))}`, { snapshot: newSnap });
    fixed += 1;
  }
  console.log(`[1v] сверок к пересчёту: ${fixed}`);
}

// ── 2. Falcon: saleCategory → enduro_moped ──────────────────────────────────
const falcons = await sb('GET', `/rest/v1/cars?id=in.(${FALCON_BIKES.map(encodeURIComponent).join(',')})&select=id,daily_price,specs`);
for (const car of falcons) {
  const specs = (car.specs && typeof car.specs === 'object') ? { ...car.specs } : {};
  const salary = { ...(specs.salary || {}), saleCategory: 'enduro_moped', setAt: NOW };
  if (!salary.tier) salary.tier = 'premium';
  if (!salary.rentalCategory) salary.rentalCategory = 'premium';
  if (salary.subrented === undefined) salary.subrented = false;
  if (!salary.dailyPriceAtSet) salary.dailyPriceAtSet = Number(car.daily_price) || 0;
  specs.salary = salary;
  console.log(`[2] ${car.id}: specs.salary.saleCategory = enduro_moped (5000 ₽)${APPLY ? '' : '  (dry)'}`);
  if (APPLY) await sb('PATCH', `/rest/v1/cars?id=eq.${encodeURIComponent(car.id)}`, { specs });
}

// ── 3. Дил→снапшот: agreed.at > correction.at → переписать деньги ────────────
const withAgreed = await sb('GET', `/rest/v1/rental_verifications?select=rental_id,status,snapshot,negotiation&negotiation->agreed->>at=not.is.null&limit=500`);
let rewritten = 0;
for (const row of withAgreed) {
  const nego = (row.negotiation && typeof row.negotiation === 'object') ? row.negotiation : {};
  const agreed = nego.agreed;
  if (!agreed || !agreed.split || !agreed.at) continue;
  const snap = (row.snapshot && typeof row.snapshot === 'object') ? row.snapshot : {};
  const corrAt = snap?.correction?.at ? Date.parse(snap.correction.at) : 0;
  if (Date.parse(agreed.at) <= corrAt) continue; // правка новее — снапшот уже истина
  const split = agreed.split;
  const parts = { base: Number(split.base) || 0, equipment: Number(split.equipment) || 0, overprice: Number(split.overprice) || 0 };
  const sameAsFrozen =
    Number(snap.base ?? 0) === parts.base &&
    Number(snap.equipment ?? 0) === parts.equipment &&
    Number(snap.overprice ?? 0) === parts.overprice;
  if (sameAsFrozen) continue;
  const from = { base: Number(snap.base) || 0, equipment: Number(snap.equipment) || 0, overprice: Number(snap.overprice) || 0, total: Number(snap.total) || 0 };
  const newSnap = {
    ...snap, base: parts.base, equipment: parts.equipment, overprice: parts.overprice,
    total: parts.base + parts.equipment + parts.overprice,
    correction: { at: agreed.at, by: 'дил по сверке (task159 бэкфилл)', from, reason: 'принято предложение по сверке' },
  };
  console.log(`[3] ${String(row.rental_id).slice(0, 8)} [${row.status}] total ${from.total}→${newSnap.total} (дил ${agreed.at})${APPLY ? '' : '  (dry)'}`);
  if (APPLY) await sb('PATCH', `/rest/v1/rental_verifications?rental_id=eq.${encodeURIComponent(String(row.rental_id))}`, { snapshot: newSnap });
  rewritten += 1;
}
console.log(`[3] строк к переписыванию: ${rewritten}`);
console.log('\nГотово.');
