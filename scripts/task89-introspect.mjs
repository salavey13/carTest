// Task 89: introspect schema for Avito agent code review
// run: node --env-file=.env.local scripts/task89-introspect.mjs
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// ── 1. OpenAPI: column types for users / rentals / cars ──
const res = await fetch(`${URL}/rest/v1/`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});
const spec = await res.json();
const want = ['users', 'rentals', 'cars', 'crews'];
for (const t of want) {
  const def = spec.definitions?.[t];
  if (!def) { console.log(`TABLE ${t}: NOT IN SPEC`); continue; }
  const cols = Object.entries(def.properties).map(([k, v]) => {
    const fk = v.description?.match(/\[([^\]]+)\]/)?.[1]; // fk hints live in description
    return `${k}:${v.format || v.type}${fk ? `→${fk}` : ''}`;
  });
  console.log(`\n== ${t} ==\n  ${cols.join('\n  ')}`);
}

// ── 2. Real status / payment_status enums in rentals ──
const { data: rentals } = await sb.from('rentals').select('status, payment_status').limit(5000);
const st = {}, ps = {};
for (const r of rentals ?? []) {
  st[r.status ?? 'NULL'] = (st[r.status ?? 'NULL'] || 0) + 1;
  ps[r.payment_status ?? 'NULL'] = (ps[r.payment_status ?? 'NULL'] || 0) + 1;
}
console.log('\nrentals.status values:', JSON.stringify(st));
console.log('rentals.payment_status values:', JSON.stringify(ps));

// ── 3. Sample rental row (column names in practice) ──
const { data: one } = await sb.from('rentals').select('*').order('created_at', { ascending: false }).limit(1);
if (one?.[0]) {
  const r = one[0];
  console.log('\nLATEST RENTAL sample keys:', Object.keys(r).join(', '));
  console.log('sample:', JSON.stringify({
    rental_id: r.rental_id, user_id: r.user_id, vehicle_id: r.vehicle_id,
    crew_id: r.crew_id, status: r.status, payment_status: r.payment_status,
    start_date: r.start_date, end_date: r.end_date,
    requested_start_date: r.requested_start_date, requested_end_date: r.requested_end_date,
    created_by_operator_chat_id: r.created_by_operator_chat_id,
  }, null, 1));
}

// ── 4. users.user_id sample (type check) ──
const { data: u } = await sb.from('users').select('user_id, language_code').limit(3);
console.log('\nusers sample:', JSON.stringify(u));
