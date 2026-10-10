// task90: classify electric vs ICE per bike
// run: node --env-file=.env.local scripts/task90-classify.mjs
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CREW = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746';
const { data: bikes } = await sb.from('cars').select('id, make, model, daily_price, specs').eq('crew_id', CREW).eq('type', 'bike').order('id');

for (const b of bikes) {
  const s = b.specs || {};
  const evMarkers = {};
  for (const k of ['battery_kwh', 'motor_peak_kw', 'motor_nominal_kw', 'motor_hp', 'range_km', 'voltage_v', 'charging_kw', 'charge_time_h']) {
    if (s[k] !== undefined && s[k] !== null && s[k] !== '') evMarkers[k] = s[k];
  }
  const fuel = s.fuel_type || s.fuel || '';
  const displacement = s.engine_cc || s.displacement_cc || s.engine_displacement_cc || s.bike_engine_cc || '';
  console.log(
    b.id.padEnd(28),
    '| fuel:', String(fuel).slice(0, 18).padEnd(18),
    '| cc:', String(displacement).padEnd(5),
    '| ev:', Object.keys(evMarkers).length ? JSON.stringify(evMarkers).slice(0, 110) : '-'
  );
}
