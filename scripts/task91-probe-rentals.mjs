// task91: probe rentals schema + statuses + season window for vip-bike stats
// run: node --env-file=.env.local scripts/task91-probe-rentals.mjs
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CREW = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746';

const { data: bikes } = await sb.from('cars').select('id, daily_price').eq('crew_id', CREW).eq('type', 'bike');
const ids = bikes.map((b) => b.id);
console.log('bikes:', ids.length);

// probe columns
const { data: r0, error: e0 } = await sb.from('rentals').select('*').limit(2);
if (e0) { console.error('rentals err:', e0.message); process.exit(1); }
console.log('RENTAL KEYS:', Object.keys(r0[0] || {}).sort().join(', '));
console.log('SAMPLE:', JSON.stringify(r0[0], null, 1).slice(0, 900));

const { data: rs } = await sb.from('rentals').select('*').in('vehicle_id', ids);
console.log('rentals for vip-bike bikes:', rs?.length);
const st = {};
for (const r of rs) st[r.status] = (st[r.status] || 0) + 1;
console.log('STATUSES:', JSON.stringify(st));

// earliest / latest
const dates = rs.map((r) => r.asd || r.requested_start_date).filter(Boolean).sort();
console.log('RANGE:', dates[0], '→', dates[dates.length - 1]);

// year distribution
const yr = {};
for (const d of dates) yr[d.slice(0, 4)] = (yr[d.slice(0, 4)] || 0) + 1;
console.log('BY YEAR:', JSON.stringify(yr));

// 2026 season by month (May-Oct)
const mo = {};
for (const d of dates) { const k = d.slice(0, 7); if (k >= '2026-04') mo[k] = (mo[k] || 0) + 1; }
console.log('2026 BY MONTH:', JSON.stringify(mo));

// per-bike top-5 sample
const per = {};
for (const r of rs) { if (!r.asd || r.asd < '2026-04-01') continue; if (/cancel/i.test(r.status || '')) continue; per[r.vehicle_id] = (per[r.vehicle_id] || 0) + 1; }
const top = Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log('TOP (2026, non-cancelled):', JSON.stringify(top));
