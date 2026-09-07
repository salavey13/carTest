// Probe live DB state after user applied 20260825000000_prepayment_tracking.sql
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

async function main() {
  // 1. income_prepayment filter accepted? (CHECK constraint applied?)
  const r1 = await sb.from('cash_transactions').select('id').eq('transaction_type', 'income_prepayment').limit(1)
  console.log('income_prepayment filter:', r1.error ? { code: r1.error.code, msg: r1.error.message.slice(0, 100) } : { ok: true, rows: r1.data.length })

  // 2. prepayment_summary view readable?
  const r2 = await sb.from('prepayment_summary').select('*').limit(1)
  console.log('prepayment_summary view:', r2.error ? { code: r2.error.code, msg: r2.error.message.slice(0, 100) } : { ok: true, rows: r2.data.length })

  // 3. income_transactions table (test readiness probe)?
  const r3 = await sb.from('income_transactions').select('id').limit(1)
  console.log('income_transactions probe:', r3.error ? { code: r3.error.code, msg: r3.error.message.slice(0, 100) } : { ok: true, rows: r3.data.length })

  // 4. FK cash_transactions.rental_id -> rentals for embed test?
  const r4 = await sb.from('cash_transactions').select('id,rental_id,rentals(vehicle_id)').not('rental_id', 'is', null).limit(1)
  console.log('cash->rentals embed:', r4.error ? { code: r4.error.code, msg: r4.error.message.slice(0, 100) } : { ok: true })

  // 5. rentals -> cars embed?
  const r5 = await sb.from('rentals').select('rental_id,cars(make,model)').not('vehicle_id', 'is', null).limit(1)
  console.log('rentals->cars embed:', r5.error ? { code: r5.error.code, msg: r5.error.message.slice(0, 100) } : { ok: true })

  // 6. FK to crews? (crew_id)
  const r6 = await sb.from('cash_transactions').select('id,crews(id)').limit(1)
  console.log('cash->crews embed:', r6.error ? { code: r6.error.code, msg: r6.error.message.slice(0, 100) } : { ok: true })
}

main().catch((e) => { console.error('probe failed:', e.message); process.exit(1) })
