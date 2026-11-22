// task90: fresh fetch of vip-bike bikes with full specs → task90-bikes.json
// run: node --env-file=.env.local scripts/task90-fetch-bikes.mjs
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CREW = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746';

const { data: bikes, error } = await sb
  .from('cars')
  .select('id, make, model, type, daily_price, image_url, specs')
  .eq('crew_id', CREW)
  .eq('type', 'bike')
  .order('id');
if (error) { console.error('err:', error.message); process.exit(1); }

const rows = bikes.map(b => {
  const s = b.specs || {};
  const fuel = String(s.fuel_type || s.fuel || '').toLowerCase();
  const cc = s.engine_cc || s.displacement_cc || s.engine_displacement_cc || s.bike_engine_cc || '';
  const truthy = (v) => v === true || v === 1 || String(v).toLowerCase() === 'true' || String(v).toLowerCase() === '1';
  const isICE = /аи|бенз|диз|petrol|gasoline/.test(fuel) || (cc !== '' && Number(cc) > 0);
  const saleFlag = truthy(s.sale);
  const salePrice = Number(s.sale_price) > 0 ? Number(s.sale_price) : (Number(s.purchase_price) > 0 ? Number(s.purchase_price) : 0);
  return {
    id: b.id,
    make: b.make || s.make || '',
    model: b.model || s.model || '',
    year: s.year || '',
    color: s.color || '',
    powertrain: isICE ? 'ice' : 'ev',
    fuel: s.fuel_type || s.fuel || '',
    engine_cc: String(cc || ''),
    power_hp: s.power_hp || s.bike_power_hp || '',
    motor_peak_kw: s.motor_peak_kw || '',
    motor_nominal_kw: s.motor_nominal_kw || '',
    battery_kwh: s.battery_kwh || '',
    range_km: s.range_km || '',
    voltage_v: s.voltage_v || '',
    charge_time_h: s.charge_time_h || '',
    top_speed_kmh: s.top_speed_kmh || '',
    daily_price: b.daily_price,
    sale_flag: saleFlag,
    sale_price: salePrice,
    for_sale: saleFlag && salePrice > 0,
    for_rent: truthy(s.rent) && Number(b.daily_price) > 0,
    hidden: !!s.hidden,
    odometer: s.last_known_odometer ?? null,
    vin: s.vin || '',
    image_url: b.image_url || (Array.isArray(s.gallery) ? s.gallery[0] : null) || null,
    underscore_in_id: b.id.includes('_'),
  };
});

console.log(`TOTAL: ${rows.length}`);
const cnt = { ev: rows.filter(r => r.powertrain === 'ev').length, ice: rows.filter(r => r.powertrain === 'ice').length };
const sale = rows.filter(r => r.for_sale), rent = rows.filter(r => r.for_rent);
console.log(`EV: ${cnt.ev} | ICE: ${cnt.ice} | for_sale: ${sale.length} | for_rent: ${rent.length}`);
for (const r of rows) console.log(`${r.powertrain.toUpperCase().padEnd(3)} ${r.for_rent ? 'R' : '-'}${r.for_sale ? 'S' : '-'}${r.hidden ? 'H' : ' '} ${r.id.padEnd(28)} ${(r.make + ' ' + r.model).padEnd(30)} rent:${String(r.daily_price).padStart(6)}₽ sale:${String(r.sale_price).padStart(9)}₽`);
const hazards = rows.filter(r => r.underscore_in_id);
console.log('UNDERSCORE IDS:', hazards.length ? hazards.map(r => r.id).join(', ') : 'none');
writeFileSync('/home/z/cartest/scripts/task90-bikes.json', JSON.stringify(rows, null, 2));
console.log('saved → scripts/task90-bikes.json');
