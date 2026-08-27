// iter15e: latest sale artifact values + sales analytics source
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function q(schema, table, params = '') {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Accept-Profile': schema, 'Content-Profile': schema },
  });
  if (!r.ok) { console.log(`${schema}.${table} → ${r.status}: ${(await r.text()).slice(0, 200)}`); return null; }
  return r.json();
}

// 1. latest sale artifact — full values
const sales = await q('private', 'sale_contract_artifacts', 'order=created_at.desc&limit=2');
for (const s of sales || []) {
  console.log('=== SALE', s.contract_key, 'created:', s.created_at);
  console.log(JSON.stringify({ requested_bike_id: s.requested_bike_id, resolved_bike_id: s.resolved_bike_id, buyer_full_name: s.buyer_full_name, buyer_phone: s.buyer_phone, sale_price: s.sale_price, total_sum: s.total_sum, crew_slug: s.crew_slug, storage_path: s.storage_path, telegram_chat_id: s.telegram_chat_id, created_by_operator_chat_id: s.created_by_operator_chat_id, delivery_method: s.delivery_method, warranty_months: s.warranty_months }, null, 1));
}

// 2. where do sales-analytics read from? try franchize_sales table
for (const t of ['franchize_sales', 'sales_analytics', 'crew_sales']) {
  const rows = await q('public', t, 'order=created_at.desc&limit=2&select=*');
  if (rows) { console.log(`\n=== ${t} EXISTS ===`); for (const r of rows) console.log(JSON.stringify(r).slice(0, 1500)); }
}
