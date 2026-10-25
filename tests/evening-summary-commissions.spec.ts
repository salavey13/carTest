/**
 * Evening Summary — Verified-Rental Commissions Section (pure tests, no DB)
 *
 * The jq program lives inline in boss-commands/evening-summary.sh between the
 * COMMISSION_JQ_START / COMMISSION_JQ_END markers. These tests EXTRACT it
 * verbatim (same extraction the shell performs) and run it on fixtures, so
 * the canonical program is what's tested — not a copy.
 *
 * Semantics under test mirror app/franchize/lib/rental-payout-core.ts
 * commissionOf (task 107 payout hub):
 *   1. negotiation.agreed.split (base+equipment+overprice) wins;
 *   2. else snapshot.total when a positive number;
 *   3. else snapshot parts clamped ≥0 and summed.
 * Plus: paid-out stamps (payout.operator.marked), operator attribution
 * fallback (operator_chat_id → snapshot.attribution.createdByChatId),
 * name resolution via the users payload, top-5 + «… ещё N», and the two
 * graceful collapses (empty array / PostgREST error object → "").
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const SH_PATH = path.join(process.cwd(), 'boss-commands', 'evening-summary.sh')

function extractJqProgram(): string {
  const sh = readFileSync(SH_PATH, 'utf8')
  const start = sh.indexOf('# COMMISSION_JQ_START')
  const end = sh.indexOf('# COMMISSION_JQ_END')
  expect(start, 'COMMISSION_JQ_START marker present').toBeGreaterThan(-1)
  expect(end, 'COMMISSION_JQ_END marker present').toBeGreaterThan(start)
  const block = sh.slice(start, end)
  const openToken = `--argjson users "$USERS_DATA" '`
  const p0 = block.indexOf(openToken)
  expect(p0, 'jq invocation found inside markers').toBeGreaterThan(-1)
  const p1 = block.lastIndexOf(`' 2>/dev/null || echo "")`)
  expect(p1, 'jq closing found inside markers').toBeGreaterThan(p0)
  return block.slice(p0 + openToken.length, p1)
}

function runJq(input: unknown, users: unknown[]): string {
  return execFileSync(
    'jq',
    ['-r', '--argjson', 'users', JSON.stringify(users), extractJqProgram()],
    { input: JSON.stringify(input), encoding: 'utf8' },
  ).replace(/\n$/, '')
}

const USERS = [
  { user_id: '413553377', username: 'salavey13', full_name: null },
  { user_id: '244736261', username: 'Roman_Vip_Bike_Electro', full_name: 'Роман' },
]

describe('evening-summary commissions jq (extracted verbatim)', () => {
  it('sums snapshot.total, groups per operator, counts paid-out stamps', () => {
    const out = runJq(
      [
        { rental_id: 'a1', operator_chat_id: '413553377', snapshot: { total: 1500, base: 1200, equipment: 300, overprice: 0 }, payout: { operator: { marked: true } } },
        { rental_id: 'a2', operator_chat_id: '413553377', snapshot: { total: 900 }, payout: null },
        { rental_id: 'a3', operator_chat_id: '244736261', snapshot: { total: 700 }, payout: { operator: { marked: false } } },
      ],
      USERS,
    )
    // total = 3100; paid = ONLY the marked row (1500), not the whole group
    expect(out).toContain('Проверено: 3 · комиссий: 3100 ₽ · выплачено: 1500 ₽')
    expect(out).toContain('• salavey13: 2400 ₽ (2)')
    expect(out).toContain('• Roman_Vip_Bike_Electro: 700 ₽ (1)')
    // most-earning operator first
    expect(out.indexOf('salavey13')).toBeLessThan(out.indexOf('Roman_Vip_Bike_Electro'))
  })

  it('prefers negotiation.agreed.split over the frozen snapshot.total (task-106 deals)', () => {
    const out = runJq(
      [{ rental_id: 'b1', operator_chat_id: '413553377', snapshot: { total: 1500 }, negotiation: { agreed: { split: { base: 500, equipment: 200, overprice: 100 } } } }],
      USERS,
    )
    expect(out).toContain('комиссий: 800 ₽')
    expect(out).not.toContain('1500')
  })

  it('falls back to snapshot parts clamped ≥0 when total is missing/negative', () => {
    const out = runJq(
      [{ rental_id: 'c1', operator_chat_id: '413553377', snapshot: { base: -50, equipment: 300, overprice: 120 } }],
      USERS,
    )
    expect(out).toContain('комиссий: 420 ₽')
  })

  it('resolves operator via snapshot.attribution.createdByChatId fallback', () => {
    const out = runJq(
      [{ rental_id: 'd1', operator_chat_id: null, snapshot: { total: 650, attribution: { createdByChatId: '7813830016' } } }],
      USERS,
    )
    expect(out).toContain('• оператор …0016: 650 ₽ (1)')
  })

  it('shows at most 5 operator lines + «… ещё N» tail', () => {
    const rows = [111, 222, 333, 444, 555, 666].map((id, i) => ({
      rental_id: `e${i}`,
      operator_chat_id: String(id),
      snapshot: { total: (6 - i) * 100 },
    }))
    const out = runJq(rows, [])
    expect(out).toContain('Проверено: 6 · комиссий: 2100 ₽')
    expect(out).toContain('… ещё 1')
    expect(out).toContain('оператор …111: 600 ₽')
    expect(out).not.toContain('оператор …666')
  })

  it('collapses to an empty string when nothing was verified today', () => {
    expect(runJq([], USERS)).toBe('')
  })

  it('collapses to an empty string on a PostgREST error object (table not applied)', () => {
    expect(runJq({ message: 'relation "rental_verifications" does not exist', code: '42P01' }, USERS)).toBe('')
  })

  it('never crashes on a garbage snapshot row', () => {
    const out = runJq([{ rental_id: 'f1', operator_chat_id: '413553377', snapshot: 'garbage' }], USERS)
    expect(out).toBe('')
  })
})
