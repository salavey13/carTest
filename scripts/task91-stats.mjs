// task91: season-2026 stats per vip-bike bike → task91-stats.json
// season = all 2026 rentals (actual range 17.06 → 10.10.2026); statuses completed+active count
// run: node --env-file=.env.local scripts/task91-stats.mjs
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CREW = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746';

const { data: bikes, error: eb } = await sb
  .from('cars')
  .select('id, make, model, daily_price, specs')
  .eq('crew_id', CREW)
  .eq('type', 'bike');
if (eb) { console.error('bikes err:', eb.message); process.exit(1); }
const ids = bikes.map((b) => b.id);

const { data: rs, error: er } = await sb.from('rentals').select('*').in('vehicle_id', ids);
if (er) { console.error('rentals err:', er.message); process.exit(1); }

const DAY = 24 * 3600 * 1000;
const ts = (s) => (s ? new Date(s).getTime() : null);
const valid = (r) => ['completed', 'active'].includes(r.status);

const per = {};
for (const b of ids) per[b] = { rentals: 0, days: 0, revenue: 0, last_end: null, longest_rental_days: 0, unique_riders: new Set() };
let seen = new Set();
for (const r of rs) {
  if (!valid(r) || seen.has(r.rental_id)) continue;
  seen.add(r.rental_id);
  const p = per[r.vehicle_id];
  if (!p) continue;
  const s = ts(r.agreed_start_date) ?? ts(r.requested_start_date);
  const e = ts(r.agreed_end_date) ?? ts(r.requested_end_date) ?? s;
  const days = s && e ? Math.max(1, Math.round((e - s) / DAY)) : 1;
  p.rentals += 1;
  p.days += days;
  p.revenue += Number(r.total_cost) || 0;
  p.unique_riders.add(r.user_id);
  if (days > p.longest_rental_days) p.longest_rental_days = days;
  const endTs = e || 0;
  if (endTs && (!p.last_end || endTs > ts(p.last_end))) p.last_end = new Date(endTs).toISOString().slice(0, 10);
}

const out = {};
for (const b of bikes) {
  const p = per[b.id];
  out[b.id] = {
    rentals: p.rentals,
    days: p.days,
    revenue: p.revenue,
    riders: p.unique_riders.size,
    longest_rental_days: p.longest_rental_days,
    last_end: p.last_end,
  };
}

const totals = {
  bikes: bikes.length,
  rentals: Object.values(out).reduce((a, x) => a + x.rentals, 0),
  days: Object.values(out).reduce((a, x) => a + x.days, 0),
  revenue: Object.values(out).reduce((a, x) => a + x.revenue, 0),
  riders: new Set(rs.filter(valid).map((r) => r.user_id)).size,
  window: '17.06.2026 — 10.10.2026',
  cancelled: rs.filter((r) => r.status === 'cancelled').length,
  monthly: {},
};
{
  const seenM = new Set();
  for (const r of rs) {
    if (!valid(r) || seenM.has(r.rental_id)) continue;
    seenM.add(r.rental_id);
    const s = r.agreed_start_date || r.requested_start_date;
    if (!s) continue;
    const k = s.slice(0, 7);
    totals.monthly[k] = (totals.monthly[k] || 0) + 1;
  }
}

writeFileSync('/home/z/cartest/scripts/task91-stats.json', JSON.stringify({ per: out, totals }, null, 2));
console.log('TOTALS:', JSON.stringify(totals, null, 1));
const top = Object.entries(out).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 6);
for (const [id, s] of top) console.log(id.padEnd(30), 'rentals:', String(s.rentals).padStart(3), 'days:', String(s.days).padStart(4), 'revenue:', String(s.revenue).padStart(9), 'riders:', s.riders);
console.log('saved → scripts/task91-stats.json');
