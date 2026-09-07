// Measure the real DB time of getFranchizeLeads' query batch (vip-bike crew)
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].includes(m[1]) && !process.env[m[1]]) {
    process.env[m[1]] = m[2]
  }
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const CREW_ID = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
const SLUG = 'vip-bike'

async function timed(label, fn) {
  const t0 = Date.now()
  const r = await fn()
  const ms = Date.now() - t0
  const size = r.data ? JSON.stringify(r.data).length : 0
  console.log(`${label.padEnd(28)} ${String(ms).padStart(5)}ms  rows=${(r.data || []).length}  json=${(size / 1024).toFixed(1)}KB  err=${r.error ? r.error.message.slice(0, 60) : 'no'}`)
  return r
}

async function main() {
  const { data: crew } = await sb.from('crews').select('id').eq('slug', SLUG).maybeSingle()
  console.log('crew:', crew?.id)

  await timed('intents (800 cap)', () =>
    sb.from('franchize_intents').select('id, telegram_user_id, phone, intent_type, stage, urgency_score, source_route, contact_channel, last_seen_at, created_at, updated_at, metadata, bike_id').eq('slug', SLUG).neq('stage', 'dismissed').order('last_seen_at', { ascending: false }).limit(800))

  await timed('rental artifacts (300)', () =>
    sb.from('rental_contract_artifacts').select('telegram_chat_id, renter_full_name, renter_phone, rental_id, rent_start_date, rent_end_date, requested_bike_id, resolved_bike_id, total_sum, created_at, created_by_operator_chat_id').eq('crew_slug', SLUG).order('created_at', { ascending: false }).limit(300))

  await timed('rentals (500)', () =>
    sb.from('rentals').select('rental_id, user_id, status, payment_status, requested_start_date, requested_end_date, total_cost, metadata, passport_mainpage_photo, passport_registration_photo, drivers_licence_frontal_photo, crew_id, created_by_operator_chat_id, created_at, vehicle:cars(make, model)').eq('crew_id', CREW_ID).order('created_at', { ascending: false }).limit(500))

  await timed('crew_todos', () =>
    sb.from('crew_todos').select('id, lead_id, user_id, phone, rental_id, title, description, status, priority, category, created_at, completed_at, assigned_to, due_date').eq('crew_id', CREW_ID).in('category', ['lead_followup', 'rental_verification', 'lead_handling']).order('created_at', { ascending: false }))

  await timed('lead_notes (all)', () =>
    sb.from('lead_notes').select('lead_id, created_at, updated_at, created_by').eq('crew_id', CREW_ID))

  // row counts to understand table sizes
  for (const [t, col, v] of [['franchize_intents', 'slug', SLUG], ['crew_todos', 'crew_id', CREW_ID], ['lead_notes', 'crew_id', CREW_ID]]) {
    const { count } = await sb.from(t).select('*', { count: 'exact', head: true })
    console.log(`table ${t.padEnd(22)} total_rows=${count}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
