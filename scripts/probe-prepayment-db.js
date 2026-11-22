// Diagnostic: replicate the evening-summary probe query exactly and print
// the PostgREST error code so we know what the live DB actually returns.
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// load the two keys from .env.local (same as vitest.config does)
const envPath = path.join(__dirname, '..', '.env.local')
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].includes(m[1]) && !process.env[m[1]]) {
    process.env[m[1]] = m[2]
  }
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  const r1 = await sb.from('cash_transactions').select('id').eq('transaction_type', 'income_prepayment').limit(1)
  console.log('cash_transactions + income_prepayment filter:', JSON.stringify(r1.error ? { code: r1.error.code, message: r1.error.message.slice(0, 80) } : { ok: true, rows: r1.data.length }))

  const r2 = await sb.from('cash_transactions').select('transaction_type', { count: 'exact' }).limit(1)
  console.log('cash_transactions plain:', JSON.stringify(r2.error ? { code: r2.error.code } : { ok: true }))

  // distinct transaction_type values actually present
  if (!r2.error) {
    const { data } = await sb.from('cash_transactions').select('transaction_type').limit(200)
    console.log('existing transaction_type values:', JSON.stringify([...new Set((data || []).map(d => d.transaction_type))]))
  }

  const r3 = await sb.from('income_transactions').select('id').limit(1)
  console.log('income_transactions table:', JSON.stringify(r3.error ? { code: r3.error.code } : { ok: true }))
}

main()
