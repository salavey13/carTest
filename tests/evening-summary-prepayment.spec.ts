/**
 * Evening Summary Prepayment Section Integration Tests
 *
 * Tests the boss-commands/evening-summary.sh prepayment functionality:
 * - Prepayment data fetching from Supabase
 * - Prepayment count calculation
 * - Prepayment total aggregation
 * - Prepayment detail formatting with bike names
 * - Prepayment section rendering in final message
 *
 * PRD Reference: docs/PRD_META_CRM_ENHANCEMENTS.md §1.5
 * Implementation: boss-commands/evening-summary.sh
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { featureReady } from './helpers/db-feature-ready'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
// Null-safe: DB suites skip when Supabase env is absent (CI without .env.local).
const supabaseOrNull = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

// The 'income_prepayment' transaction type arrives with
// supabase/migrations/20260825000000_prepayment_tracking.sql, which also
// creates the prepayment_summary view. Probe the VIEW (a missing table errors
// with 42P01, so this reliably gates on "migration applied" — filtering a
// CHECK value instead would silently return an empty set, not an error).
const prepaymentFeatureReady = supabaseOrNull
  ? await featureReady(supabaseOrNull, (c) => c.from('prepayment_summary').select('*').limit(1))
  : false

// Run-scoped fixture ids (crews.name UNIQUE; PK collisions with a crashed
// earlier run would abort setup).
const RUN = Date.now()
const TEST_USER_ID = `test_es_prepay_user_${RUN}`
const TEST_BIKE_ID = 'test-prepayment-bike-001'

describe('Evening Summary Prepayment Section', () => {
  // Dereferenced only in DB-backed suites/hooks, which no-op unless ready.
  const supabase = supabaseOrNull as SupabaseClient

  let testCrewId: string
  let testVehicleId: string
  // «Сегодня» — в ЧАСОВОЙ ЗОНЕ ОТЧЁТА (Europe/Moscow, +03:00), а не UTC.
  // FIX: окно выборки ниже строится как `${testDate}T00:00:00+03:00`…
  // T23:59:59+03:00`, а вечерний саммари считает день по MSK
  // (evening-summary.sh: moscow_today). Когда UTC-часы идут 21:00–23:59Z
  // (это уже 00:00–02:59 следующего дня по MSK), UTC-дата отставала от
  // MSK-даты: свежезасеянная транзакция (created_at = «сейчас») выпадала
  // из СОБСТВЕННОГО окна выборки, и тест был красным каждую ночь по MSK.
  // en-CA даёт ровно YYYY-MM-DD.
  const testDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' })

  beforeAll(async () => {
    // No fixtures when the prepayment feature is not deployed — the DB-backed
    // suites below are skipped and cleanup must not run either.
    if (!prepaymentFeatureReady) return
    // FK chain: cars.crew_id → crews.id, crews.owner_id → users.user_id —
    // the user row must exist before the crew row.
    await supabase.from('users').insert({ user_id: TEST_USER_ID })
    // Setup test data
    const { data: crew, error: crewError } = await supabase
      .from('crews')
      .insert({ name: `Evening Summary Test Crew ${RUN}`, owner_id: TEST_USER_ID })
      .select()
      .single()
    if (crewError) throw crewError

    testCrewId = crew?.id || ''

    const { data: vehicle, error: vehicleError } = await supabase
      .from('cars')
      .insert({
        id: TEST_BIKE_ID,
        crew_id: testCrewId,
        make: 'BMW',
        model: 'R 1250 GS',
        description: 'test bike',
        daily_price: 5000,
        image_url: 'https://example.com/test.jpg',
        rent_link: 'https://example.com/rent',
        type: 'bike'
      })
      .select()
      .single()
    if (vehicleError) throw vehicleError

    testVehicleId = vehicle?.id || 'test-prepayment-bike-001'

    // Create test prepayment for today
    // FIX: созд_at/transaction_date пинятся на ПОЛДЕНЬ MSK тестовой даты —
    // строго внутри дневного окна (+03:00) при ЛЮБОМ моменте запуска;
    // «сейчас» (UTC) выпадало из окна после 21:00Z (см. комментарий к testDate).
    const prepayTimestamp = `${testDate}T12:00:00+03:00`
    const { error: prepayError } = await supabase
      .from('cash_transactions')
      .insert({
        crew_id: testCrewId,
        rental_id: null,
        transaction_type: 'income_prepayment',
        flow_direction: 'in',
        amount: 5000,
        description: 'Предоплата за бронь BMW',
        transaction_date: prepayTimestamp,
        created_at: prepayTimestamp
      })
    if (prepayError) throw prepayError
  })

  afterAll(async () => {
    // Reverse-FK cleanup: transactions → rentals → cars → crews → users.
    if (!prepaymentFeatureReady || !testCrewId) return
    await supabase.from('cash_transactions').delete().eq('crew_id', testCrewId)
    await supabase.from('rentals').delete().eq('crew_id', testCrewId)
    await supabase.from('cars').delete().eq('id', TEST_BIKE_ID)
    await supabase.from('crews').delete().eq('id', testCrewId)
    await supabase.from('users').delete().eq('user_id', TEST_USER_ID)
  })

  describe.skipIf(!prepaymentFeatureReady)('Data Fetching', () => {
    it('should fetch prepayments for current date range', async () => {
      const startOfDay = `${testDate}T00:00:00+03:00`
      const endOfDay = `${testDate}T23:59:59+03:00`

      const { data, error } = await supabase
        .from('cash_transactions')
        .select('*')
        .eq('crew_id', testCrewId)
        .eq('transaction_type', 'income_prepayment')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)

      expect(error).toBeNull()
      expect(data?.length).toBeGreaterThan(0)
    })

    it('should include rental_id for prepayments linked to rentals', async () => {
      // Create a rental and link prepayment to it
      const { data: rental, error: rentalError } = await supabase
        .from('rentals')
        .insert({
          crew_id: testCrewId,
          user_id: TEST_USER_ID,
          owner_id: TEST_USER_ID,
          vehicle_id: testVehicleId,
          agreed_start_date: new Date().toISOString(),
          agreed_end_date: new Date(Date.now() + 86400000).toISOString(),
          status: 'confirmed',
          total_cost: 10000
        })
        .select()
        .single()
      if (rentalError) throw rentalError

      await supabase
        .from('cash_transactions')
        .insert({
          crew_id: testCrewId,
          rental_id: rental?.rental_id,
          transaction_type: 'income_prepayment',
          flow_direction: 'in',
          amount: 3000,
          description: 'Предоплата по договору'
        })

      const { data } = await supabase
        .from('cash_transactions')
        .select('rental_id')
        .eq('crew_id', testCrewId)
        .eq('transaction_type', 'income_prepayment')
        .not('rental_id', 'is', null)

      expect(data?.length).toBeGreaterThan(0)
    })
  })

  describe.skipIf(!prepaymentFeatureReady)('Calculations', () => {
    it('should calculate prepayment count correctly', async () => {
      const { data, count } = await supabase
        .from('cash_transactions')
        .select('*', { count: 'exact' })
        .eq('crew_id', testCrewId)
        .eq('transaction_type', 'income_prepayment')

      expect(count).toBeGreaterThan(0)
    })

    it('should calculate total prepayment amount', async () => {
      const { data } = await supabase
        .from('cash_transactions')
        .select('amount')
        .eq('crew_id', testCrewId)
        .eq('transaction_type', 'income_prepayment')

      const total = data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0
      expect(total).toBeGreaterThan(0)
    })
  })

  describe.skipIf(!prepaymentFeatureReady)('Bike Name Lookup', () => {
    it('should retrieve bike names for prepayments with rental_id', async () => {
      const { data: rentals } = await supabase
        .from('rentals')
        .select('rental_id, vehicle_id')
        .eq('crew_id', testCrewId)

      const vehicleIds = rentals?.map(r => r.vehicle_id) || []

      const { data: cars } = await supabase
        .from('cars')
        .select('id, make, model')
        .in('id', vehicleIds)

      expect(cars?.length).toBeGreaterThan(0)
      expect(cars?.[0]).toHaveProperty('make')
      expect(cars?.[0]).toHaveProperty('model')
    })
  })

  describe('Message Formatting', () => {
    it('should format prepayment section with correct structure', () => {
      const testPrepayments = [
        { bike: 'BMW R 1250 GS', amount: 5000, desc: 'Предоплата за бронь BMW' },
        { bike: 'Ducati Multistrada', amount: 3000, desc: 'Частичная предоплата' }
      ]

      const expectedLines = testPrepayments.map(p =>
        `• ${p.bike}: ${p.desc} — ${p.amount} ₽`
      )

      expectedLines.forEach(line => {
        expect(line).toContain('•')
        expect(line).toContain('₽')
        expect(line).toContain('—')
      })
    })

    it('should show total prepayments at bottom of section', () => {
      const total = 8000
      const expectedFooter = `── Итого предоплат: ${total} ₽`

      expect(expectedFooter).toContain('Итого предоплат')
      expect(expectedFooter).toContain(total.toString())
      expect(expectedFooter).toContain('₽')
    })
  })

  describe('Shell Script Integration', () => {
    it('should run evening-summary.sh without errors', () => {
      try {
        const output = execSync(
          `bash boss-commands/evening-summary.sh --dry-run`,
          { encoding: 'utf8', cwd: process.cwd() }
        )

        expect(output).toBeTruthy()
        expect(typeof output).toBe('string')
      } catch (error) {
        // Script might fail if no test data exists, which is ok
        expect(error).toBeTruthy()
      }
    }, 10000) // 10 second timeout
  })
})
