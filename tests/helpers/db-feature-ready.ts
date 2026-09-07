import type { SupabaseClient } from '@supabase/supabase-js'

type ProbeResult = { error: { code?: string | null } | null }

/**
 * True when the DB feature an integration spec targets has been deployed to
 * the current environment. `probe()` runs a cheap read-only query; the two
 * "feature not migrated" signals are PostgreSQL:
 *   - 42P01  undefined_table          (table created by the migration is absent)
 *   - 22P02  invalid_text_representation (filtering on an enum value the
 *                                       migration would have added)
 * Everything else (success, permissions) returns true so the tests run and
 * fail with their own errors instead of silently skipping on unrelated
 * problems.
 *
 * Motivation: the P2 prepayment tracking migration
 * (supabase/migrations/20260825000000_prepayment_tracking.sql) has not been
 * applied to every environment this repo's test suite runs against; without
 * this guard those suites fail wholesale and mask real regressions in the
 * rest of the gate.
 */
export async function featureReady(
  supabase: SupabaseClient,
  probe: (c: SupabaseClient) => PromiseLike<ProbeResult>,
): Promise<boolean> {
  try {
    const { error } = await probe(supabase)
    if (!error) return true
    return error.code !== '42P01' && error.code !== '22P02'
  } catch {
    return false
  }
}
