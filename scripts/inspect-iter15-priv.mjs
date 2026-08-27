// iter15d: private schema via raw REST fetch
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RENTAL_ID = 'e4791134-de27-4ca0-a782-9408137599dc';

async function q(schema, table, params = '') {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Accept-Profile': schema,
      'Content-Profile': schema,
    },
  });
  console.log(`${schema}.${table} → ${r.status}`);
  if (!r.ok) { console.log(await r.text()); return null; }
  return r.json();
}

// 1. rental artifacts
const arts = await q('private', 'rental_contract_artifacts', `rental_id=eq.${RENTAL_ID}`);
if (arts?.length) {
  const a = arts[0];
  console.log('cols:', Object.keys(a).join(', '));
  const am = a.metadata || {};
  console.log('meta keys:', Object.keys(am).join(', '));
  console.log('deposit_amount:', am.deposit_amount, '| deposit_method:', am.deposit_method, '| deposit_returned:', am.deposit_returned);
  console.log('renter_name:', am.renter_name, '| renter_phone:', am.renter_phone);
  console.log('equipment:', JSON.stringify(am.equipment));
  console.log('storage_path:', a.storage_path, '| doc_url:', a.doc_url, '| kind:', a.kind);
}

// 2. latest rental artifacts (reference)
const latest = await q('private', 'rental_contract_artifacts', 'order=created_at.desc&limit=5');
for (const a of latest || []) {
  const am = a.metadata || {};
  console.log('---', String(a.artifact_id).slice(0, 8), 'rental:', String(a.rental_id).slice(0, 8), '| created:', a.created_at, '| deposit:', am.deposit_amount, '| phone:', am.renter_phone);
}

// 3. sale artifacts
const sales = await q('private', 'sale_contract_artifacts', 'order=created_at.desc&limit=3');
for (const s of sales || []) {
  const sm = s.metadata || {};
  console.log('=== SALE', String(s.artifact_id).slice(0, 8), 'created:', s.created_at);
  console.log('cols:', Object.keys(s).join(', '));
  console.log('meta (3k):', JSON.stringify(sm).slice(0, 3000));
}

// 4. sales rows
const salesRows = await q('public', 'sales', 'order=created_at.desc&limit=3');
for (const s of salesRows || []) console.log('SALE ROW:', JSON.stringify(s).slice(0, 1000));
