// task102: audit private schema artifacts for f800r + today's doc flow
// READ-ONLY. node --env-file=.env.local scripts/task102-f800r-audit2.mjs
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const priv = sb.schema('private');
const fmt = (o) => JSON.stringify(o, null, 2);

// 1. rental_contract_artifacts since Oct 16
const { data: arts, error: artErr } = await priv
  .from('rental_contract_artifacts')
  .select('*')
  .gte('created_at', '2026-10-16T00:00:00Z')
  .order('created_at', { ascending: false })
  .limit(15);
console.log('=== private.rental_contract_artifacts since Oct 16 ===', artErr ? fmt(artErr) : '');
for (const a of arts || []) {
  console.log(fmt({
    id: a.id, contract_key: a.contract_key, requested_bike: a.requested_bike_id, resolved_bike: a.resolved_bike_id,
    rental_id: a.rental_id, crew_slug: a.crew_slug, operator: a.created_by_operator_chat_id,
    chat: a.telegram_chat_id, renter: a.renter_full_name, start: a.rent_start_date, total: a.total_sum,
    storage: a.storage_path, created_at: a.created_at,
  }));
}

// 2. user_rental_secrets since Oct 16
const { data: secrets } = await priv
  .from('user_rental_secrets')
  .select('id, source_doc_key, source_rental_id, renter_full_name, renter_phone, verification_status, created_at')
  .gte('created_at', '2026-10-16T00:00:00Z')
  .order('created_at', { ascending: false })
  .limit(15);
console.log('\n=== private.user_rental_secrets since Oct 16 ===');
for (const s of secrets || []) console.log(fmt(s));

// 3. doc_verifier records — registerVerifierOriginalForBuffer writes where?
const { data: dv, error: dvErr } = await priv
  .from('doc_verifier_originals')
  .select('id, integration_scope, document_key, source_file_name, created_at, uploaded_by')
  .gte('created_at', '2026-10-16T00:00:00Z')
  .order('created_at', { ascending: false })
  .limit(15);
console.log('\n=== private.doc_verifier_originals since Oct 16 ===', dvErr ? fmt(dvErr) : '');
for (const d of dv || []) console.log(fmt(d));

// 4. rental_verifications (public) — should be empty
const { data: rv, error: rvErr } = await sb
  .from('rental_verifications')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(10);
console.log('\n=== public.rental_verifications ===', rvErr ? fmt(rvErr) : '');
for (const r of rv || []) console.log(fmt({ id: r.id, rental: r.rental_id, status: r.status }));
