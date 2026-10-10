// task91: fresh fetch of vip-bike bikes with EXTENDED specs → task91-bikes.json
// run: node --env-file=.env.local scripts/task91-fetch-bikes.mjs
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CREW = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746';

const { data: bikes, error } = await sb
  .from('cars')
  .select('id, make, model, type, daily_price, image_url, specs, description')
  .eq('crew_id', CREW)
  .eq('type', 'bike')
  .order('id');
if (error) { console.error('err:', error.message); process.exit(1); }

const rows = bikes.map((b) => {
  const s = b.specs || {};
  const fuel = String(s.fuel_type || s.fuel || '').toLowerCase();
  const cc = s.engine_cc || s.displacement_cc || s.engine_displacement_cc || s.bike_engine_cc || '';
  const truthy = (v) => v === true || v === 1 || String(v).toLowerCase() === 'true' || String(v).toLowerCase() === '1';
  const isICE = /аи|бенз|диз|petrol|gasoline/.test(fuel) || (cc !== '' && Number(cc) > 0);
  const saleFlag = truthy(s.sale);
  const salePrice = Number(s.sale_price) > 0 ? Number(s.sale_price) : (Number(s.purchase_price) > 0 ? Number(s.purchase_price) : 0);
  const originalPrice = Number(s.original_price_rub) > 0 ? Number(s.original_price_rub) : 0;
  return {
    id: b.id,
    make: b.make || s.make || '',
    model: b.model || s.model || '',
    year: s.year || '',
    color: s.color || '',
    subtype: s.bike_subtype || s.type || '',
    powertrain: isICE ? 'ice' : 'ev',
    fuel: s.fuel_type || s.fuel || '',
    engine_cc: String(cc || ''),
    engine_type: s.engine_type || '',
    power_hp: s.power_hp || s.bike_power_hp || s.motor_hp || '',
    torque_nm: s.torque_nm || '',
    motor_peak_kw: s.motor_peak_kw || '',
    motor_nominal_kw: s.motor_nominal_kw || '',
    battery_kwh: s.battery_kwh || '',
    range_km: s.range_km || s.range_combined_km || s.range_mixed_km || '',
    voltage_v: s.voltage_v || '',
    charge_time_h: s.charge_time_h || '',
    charging: s.charging || '',
    top_speed_kmh: s.top_speed_kmh || '',
    acceleration: s.acceleration_0_100_s || s.acceleration_0_96_s || s.acceleration_0_96_km_h_s || '',
    transmission: s.transmission || '',
    cooling: s.cooling || '',
    drive: s.drive || '',
    weight_kg: s.weight_kg || '',
    seat_height_cm: s.seat_height_cm || (s.seat_height_mm ? String(Math.round(Number(s.seat_height_mm) / 10)) : ''),
    fuel_tank_l: s.fuel_tank_l || s.fuel_capacity_l || '',
    brake_type: s.brake_type || s.brakes_front || s.front_brakes || '',
    wheel_size_inch: s.wheel_size_inch || '',
    daily_price: b.daily_price,
    price_per_hour: s.price_per_hour || '',
    deposit_rub: s.deposit_rub || '',
    sale_flag: saleFlag,
    sale_price: salePrice,
    original_price_rub: originalPrice,
    for_sale: saleFlag && salePrice > 0,
    for_rent: truthy(s.rent) && Number(b.daily_price) > 0,
    hidden: !!s.hidden,
    odometer: s.last_known_odometer ?? s.odometer ?? null,
    vin: s.vin || '',
    image_url: b.image_url || (Array.isArray(s.gallery) ? s.gallery[0] : null) || null,
    description: (b.description || s.description || '').slice(0, 200),
    underscore_in_id: b.id.includes('_'),
  };
});

console.log(`TOTAL: ${rows.length}`);
const vis = rows.filter((r) => !r.hidden);
console.log(`visible: ${vis.length} | hidden: ${rows.length - vis.length}`);
const cnt = { ev: vis.filter((r) => r.powertrain === 'ev').length, ice: vis.filter((r) => r.powertrain === 'ice').length };
console.log(`EV: ${cnt.ev} | ICE: ${cnt.ice} | for_sale: ${vis.filter((r) => r.for_sale).length} | for_rent: ${vis.filter((r) => r.for_rent).length}`);
for (const r of vis) console.log(`${r.powertrain.toUpperCase().padEnd(3)} ${r.for_rent ? 'R' : '-'}${r.for_sale ? 'S' : '-'} ${r.id.padEnd(30)} ${(r.make + ' ' + r.model).padEnd(32)} rent:${String(r.daily_price).padStart(6)}₽ sale:${String(r.sale_price).padStart(9)}₽`);
writeFileSync('/home/z/cartest/scripts/task91-bikes.json', JSON.stringify(rows, null, 2));
console.log('saved → scripts/task91-bikes.json');
