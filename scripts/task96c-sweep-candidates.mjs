// task96c — the 8 October rentals that still attribute to Paul/owner
// (per boss's «все rental bonuses → djorudjov» rule, candidates for the sweep SQL)
import { createClient } from '@supabase/supabase-js';
const SB = 'https://inmctohsodgdohamhzag.supabase.co';
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SB, SR, { auth: { persistSession: false } });
const H = { apikey: SR, Authorization: `Bearer ${SR}` };

const { data: c } = await sb.from('crews').select('id,slug').eq('slug', 'vip-bike').maybeSingle();
const { data: rows } = await sb.from('rentals').select('rental_id,total_cost,status,requested_start_date,created_by_operator_chat_id,metadata,user_id,vehicle:cars!inner(crew_id)').eq('vehicle.crew_id', c.id).gte('requested_start_date', '2026-10-01T00:00:00+03:00').lt('requested_start_date', '2026-11-01T00:00:00+03:00').neq('status', 'cancelled').order('requested_start_date');
const notDj = (rows ?? []).filter((r) => r.created_by_operator_chat_id !== '7813830016');
console.log(`non-djorudjov October rentals: ${notDj.length}`);
const artsRes = await fetch(`${SB}/rest/v1/rental_contract_artifacts?select=rental_id,created_by_operator_chat_id&rental_id=in.(${notDj.map((r) => r.rental_id).join(',')})`, { headers: { ...H, 'Accept-Profile': 'private' } });
const arts = artsRes.ok ? await artsRes.json() : [];
for (const r of notDj) {
  const md = r.metadata ?? {};
  const freeze = md.pickup_freeze && typeof md.pickup_freeze === 'object' ? md.pickup_freeze.frozen_by : null;
  const art = arts.find((a) => a.rental_id === r.rental_id);
  console.log(`${r.rental_id} start=${String(r.requested_start_date).slice(0, 10)} status=${r.status} op=${r.created_by_operator_chat_id} cost=${r.total_cost} user=${r.user_id} frozen_by=${freeze ?? '-'} return_by=${md.return_confirmed_by ?? '-'} artifact=${art ? art.created_by_operator_chat_id : 'none'}`);
}
