/**
 * Evening Summary — Rental Commissions Section (pure tests, no DB)
 *
 * The jq program lives inline in boss-commands/evening-summary.sh between the
 * COMMISSION_JQ_START / COMMISSION_JQ_END markers. These tests EXTRACT it
 * verbatim (same extraction the shell performs) and run it on fixtures, so
 * the canonical program is what's tested — not a copy.
 *
 * Semantics under test (re-baselined 2026-10-26 after boss challenge:
 * «verified means rental is finished, yes, and today was such day»):
 *
 * The section counts rental_verifications rows CLOSED today (requested_at
 * window, applied by the shell query) — NOT rows that became fully verified.
 * Reality: the dual-confirm pipeline stalls (131 rows → 3 verified ever),
 * so counting only verified hid real money (600 ₽ on 2026-10-25).
 *
 *   - Every non-disputed closure with amt > 0 counts toward the sum;
 *   - verify state is shown honestly: ✅ verified (both parties) ·
 *     👍 exactly one of two confirmed (operator_confirmed/owner_confirmed) ·
 *     ⏳ pending (none confirmed yet);
 *   - disputed rows are excluded from the sum and flagged on a ⚠️ line;
 *   - amount mirrors app/franchize/lib/rental-payout-core.ts commissionOf:
 *     1. negotiation.agreed.split wins; 2. else snapshot.total (>0);
 *     3. else snapshot parts clamped ≥0 and summed;
 *   - paid-out stamps (payout.operator.marked) stay an informational subtotal;
 *   - operator attribution fallback + users names + top-5 + «… ещё N»;
 *   - graceful collapses (empty array / PostgREST error object → "").
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
  it('sums ALL non-disputed closures, marks verify state, groups per operator, counts paid stamps', () => {
    const out = runJq(
      [
        { rental_id: 'a1', status: 'verified', operator_chat_id: '413553377', snapshot: { total: 1500, base: 1200, equipment: 300, overprice: 0 }, payout: { operator: { marked: true } } },
        { rental_id: 'a2', status: 'pending', operator_chat_id: '413553377', snapshot: { total: 900 }, payout: null },
        { rental_id: 'a3', status: 'operator_confirmed', operator_chat_id: '244736261', snapshot: { total: 700 }, payout: { operator: { marked: false } } },
      ],
      USERS,
    )
    // total = 3100 across all three states; marks ✅1 · 👍1 · ⏳1; paid = ONLY the marked row
    expect(out).toContain('Комиссий: 3100 ₽ · ✅ 1 · 👍 1 · ⏳ 1 · выплачено: 1500 ₽')
    expect(out).toContain('• salavey13: 2400 ₽ (2)')
    expect(out).toContain('• Roman_Vip_Bike_Electro: 700 ₽ (1)')
    // most-earning operator first
    expect(out.indexOf('salavey13')).toBeLessThan(out.indexOf('Roman_Vip_Bike_Electro'))
  })

  it('THE BOSS CASE: unverified same-day closure (operator confirmed, owner silent) still shows 500+100', () => {
    // Mirrors order-mvnr3g9c-bz30mf on 2026-10-25: operator=salavey13 pressed ✅
    // at 17:20 MSK, owner never did → operator_confirmed; old logic hid 600 ₽.
    const out = runJq(
      [{ rental_id: 'mvnr', status: 'operator_confirmed', operator_chat_id: '413553377', owner_chat_id: '356282674', snapshot: { base: 500, equipment: 100, overprice: 0, total: 600 }, negotiation: {}, payout: null }],
      USERS,
    )
    expect(out).toContain('Комиссий: 600 ₽ · 👍 1')
    expect(out).toContain('• salavey13: 600 ₽ (1)')
  })

  it('owner_confirmed counts too (the other half of the pipeline)', () => {
    const out = runJq(
      [{ rental_id: 'h1', status: 'owner_confirmed', operator_chat_id: '244736261', snapshot: { total: 300 } }],
      USERS,
    )
    expect(out).toContain('Комиссий: 300 ₽ · 👍 1')
  })

  it('pending rows are counted and marked ⏳ (nothing confirmed yet)', () => {
    const out = runJq(
      [{ rental_id: 'p1', status: 'pending', operator_chat_id: '413553377', snapshot: { total: 1200 } }],
      USERS,
    )
    expect(out).toContain('Комиссий: 1200 ₽ · ⏳ 1')
  })

  it('excludes disputed rows from the sum and flags them on a separate ⚠️ line', () => {
    const out = runJq(
      [
        { rental_id: 'g1', status: 'disputed', operator_chat_id: '413553377', snapshot: { total: 700 } },
        { rental_id: 'g2', status: 'verified', operator_chat_id: '413553377', snapshot: { total: 600 } },
      ],
      USERS,
    )
    expect(out).toContain('Комиссий: 600 ₽ · ✅ 1')
    expect(out).toContain('⚠️ Спорных: 1 (на 700 ₽) — вне итога')
    expect(out).toContain('• salavey13: 600 ₽ (1)')
    // the disputed 700 must not appear as an operator row
    expect(out).not.toContain('• salavey13: 700')
  })

  it('shows ONLY the ⚠️ line when nothing billable closed but a dispute exists', () => {
    const out = runJq(
      [{ rental_id: 'x1', status: 'disputed', operator_chat_id: '413553377', snapshot: { total: 500 } }],
      USERS,
    )
    expect(out).toBe('⚠️ Спорных: 1 (на 500 ₽) — вне итога')
  })

  it('prefers negotiation.agreed.split over the frozen snapshot.total (task-106 deals)', () => {
    const out = runJq(
      [{ rental_id: 'b1', status: 'pending', operator_chat_id: '413553377', snapshot: { total: 1500 }, negotiation: { agreed: { split: { base: 500, equipment: 200, overprice: 100 } } } }],
      USERS,
    )
    expect(out).toContain('Комиссий: 800 ₽')
    expect(out).toContain('800 ₽ · ⏳ 1')
    expect(out).not.toContain('1500')
  })

  it('falls back to snapshot parts clamped ≥0 when total is missing/negative', () => {
    const out = runJq(
      [{ rental_id: 'c1', status: 'pending', operator_chat_id: '413553377', snapshot: { base: -50, equipment: 300, overprice: 120 } }],
      USERS,
    )
    expect(out).toContain('Комиссий: 420 ₽')
  })

  it('resolves operator via snapshot.attribution.createdByChatId fallback', () => {
    const out = runJq(
      [{ rental_id: 'd1', status: 'pending', operator_chat_id: null, snapshot: { total: 650, attribution: { createdByChatId: '7813830016' } } }],
      USERS,
    )
    expect(out).toContain('• оператор …0016: 650 ₽ (1)')
  })

  it('shows at most 5 operator lines + «… ещё N» tail', () => {
    const rows = [111, 222, 333, 444, 555, 666].map((id, i) => ({
      rental_id: `e${i}`,
      status: 'pending',
      operator_chat_id: String(id),
      snapshot: { total: (6 - i) * 100 },
    }))
    const out = runJq(rows, [])
    expect(out).toContain('Комиссий: 2100 ₽ · ⏳ 6')
    expect(out).toContain('… ещё 1')
    expect(out).toContain('оператор …111: 600 ₽')
    expect(out).not.toContain('оператор …666')
  })

  it('collapses to an empty string when nothing closed today', () => {
    expect(runJq([], USERS)).toBe('')
  })

  it('collapses to an empty string on a PostgREST error object (table not applied)', () => {
    expect(runJq({ message: 'relation "rental_verifications" does not exist', code: '42P01' }, USERS)).toBe('')
  })

  it('never crashes on a garbage snapshot row', () => {
    const out = runJq([{ rental_id: 'f1', status: 'pending', operator_chat_id: '413553377', snapshot: 'garbage' }], USERS)
    expect(out).toBe('')
  })

  it('treats a missing status field as ⏳ (defensive)', () => {
    const out = runJq(
      [{ rental_id: 'm1', operator_chat_id: '413553377', snapshot: { total: 450 } }],
      USERS,
    )
    expect(out).toContain('Комиссий: 450 ₽ · ⏳ 1')
  })
})
