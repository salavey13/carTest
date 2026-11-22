// Task 92: demo rental row for the Russian "how to rent" tutorial screenshots.
// insert → pending_confirmation demo rental (fake renter, fake phone, test user 910910910)
// activate → flip to active (для скрина «Активна» / одометр / фото ДО)
// cleanup → remove demo rental + demo user + demo intents (по окончании скриншотов)
// run: node --env-file=.env.local scripts/task92-demo-rental.mjs <insert|activate|cleanup>
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const CREW = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'; // vip-bike
const RENTAL_ID = '91e5a7c0-1091-4109-8109-202610110001';
const USER_ID = '910910910'; // демо-арендатор (только для скриншотов, удаляется)
const VEHICLE = 'kawasaki-ex650k';
const AUDIT_KEY = 'owner_fix_20261011_tutorial_demo_rental';

const mode = process.argv[2] || 'insert';

async function audit(action, details) {
  const { data: crew } = await sb.from('crews').select('id, metadata').eq('id', CREW).single();
  const meta = crew?.metadata || {};
  meta.specs = meta.specs || {};
  meta.specs[AUDIT_KEY] = {
    ...(meta.specs[AUDIT_KEY] || {}),
    [`${new Date().toISOString()}`]: { action, details },
    last_action: action,
    last_at: new Date().toISOString(),
  };
  const { error } = await sb.from('crews').update({ metadata: meta }).eq('id', CREW);
  console.log('AUDIT:', action, error ? 'FAILED: ' + error.message : 'ok');
}

if (mode === 'insert') {
  // 1) demo user (клиентский upsert при скриншотах подтянет эту строку)
  const { error: uErr } = await sb.from('users').upsert({
    user_id: USER_ID,
    username: 'test_rider_demo',
    full_name: 'Пётр Демо',
  }, { onConflict: 'user_id' });
  console.log('USER upsert:', uErr ? 'FAILED: ' + uErr.message : 'ok');

  // 2) real bike prices for realism
  const { data: bike } = await sb.from('cars').select('id, make, model, daily_price, specs').eq('id', VEHICLE).single();
  console.log('BIKE:', bike?.make, bike?.model, 'daily:', bike?.daily_price, 'deposit:', bike?.specs?.deposit ?? bike?.specs?.['Залог']);

  const deposit = Number(bike?.specs?.deposit_rub) || 20000;
  const meta = {
    source: 'franchize_web_order',
    order_id: 'order-demo-instrukcia-0001',
    bike_name: `${bike?.make || 'Kawasaki'} ${bike?.model || 'Ninja 650'}`.trim(),
    flow_type: 'rental',
    renter_name: 'Тест Тестовый (демо-инструкция)',
    renter_phone: '+7 (900) 111-22-33',
    renter_telegram_id: USER_ID,
    deposit_rub: deposit,
    deposit_amount: deposit,
    deposit_method: 'cash',
    equipment: { helmets: 1, gloves: 1, bag: false, net: false, boots: false, jacket: false, charger: false, backpack: false },
    pep_signature: {
      method: 'order_checkout',
      username: 'test_rider_demo',
      telegram_id: USER_ID,
      auth_date: '1760000000',
      signed_at: new Date().toISOString(),
      doc_sha256: 'demo0000000000000000000000000000000000000000000000000000000000',
    },
    demo: true,
  };

  const row = {
    rental_id: RENTAL_ID,
    user_id: USER_ID,
    vehicle_id: VEHICLE,
    crew_id: CREW,
    owner_id: '413553377',
    status: 'pending_confirmation',
    payment_status: 'pending',
    interest_amount: 9000,
    total_cost: 9000,
    deposit_amount: deposit,
    requested_start_date: '2026-10-15T10:00:00+00:00',
    requested_end_date: '2026-10-17T10:00:00+00:00',
    agreed_start_date: '2026-10-15T10:00:00+00:00',
    agreed_end_date: '2026-10-17T10:00:00+00:00',
    metadata: meta,
  };

  const { error } = await sb.from('rentals').upsert(row, { onConflict: 'rental_id' });
  console.log('RENTAL insert:', error ? 'FAILED: ' + error.message : 'ok ' + RENTAL_ID);
  if (!error) await audit('insert', { rental_id: RENTAL_ID, user_id: USER_ID, vehicle: VEHICLE, purpose: 'task92 tutorial screenshots', cleanup: 'auto via task92-demo-rental.mjs cleanup' });
}

if (mode === 'activate') {
  const { error } = await sb.from('rentals').update({
    status: 'active',
    payment_status: 'interest_paid',
    metadata: {
      source: 'franchize_web_order',
      order_id: 'order-demo-instrukcia-0001',
      flow_type: 'rental',
      demo: true,
      history: [
        { status: 'created', at: '2026-10-11T09:30:00+00:00' },
        { status: 'confirmed', at: '2026-10-11T09:35:00+00:00' },
        { status: 'active', at: '2026-10-15T10:05:00+00:00' },
      ],
    },
  }).eq('rental_id', RENTAL_ID);
  console.log('RENTAL activate:', error ? 'FAILED: ' + error.message : 'ok');
  if (!error) await audit('activate', { rental_id: RENTAL_ID });
}

if (mode === 'cleanup') {
  const del1 = await sb.from('rentals').delete().eq('rental_id', RENTAL_ID);
  console.log('RENTAL delete:', del1.error ? 'FAILED: ' + del1.error.message : 'ok');
  const del2 = await sb.from('users').delete().eq('user_id', USER_ID);
  console.log('USER delete:', del2.error ? 'FAILED: ' + del2.error.message : 'ok');
  const del3 = await sb.from('franchize_intents').delete().eq('telegram_user_id', USER_ID);
  console.log('INTENTS delete:', del3.error ? 'FAILED: ' + del3.error.message : 'ok');
  // demo storage photos if any were uploaded
  const { data: files } = await sb.storage.from('carpix').list('demo-tutorial', { limit: 50 }).catch(() => ({ data: null }));
  if (files?.length) {
    await sb.storage.from('carpix').remove(files.map((f) => `demo-tutorial/${f.name}`));
    console.log('STORAGE demo-tutorial removed:', files.length);
  }
  await audit('cleanup', { rental_id: RENTAL_ID, user_id: USER_ID });
}
console.log('DONE', mode);
