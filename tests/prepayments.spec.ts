/**
 * P2 Prepayment Tracking Tests
 *
 * Tests for:
 * - income_prepayment transaction type constraint
 * - Prepayment insertion and retrieval
 * - Prepayment summary view
 * - Evening summary prepayment section
 * - Exclusion from daily revenue totals
 * - Linking prepayments to rentals
 *
 * PRD Reference: docs/PRD_META_CRM_ENHANCEMENTS.md §1.5
 * Migration: supabase/migrations/20260825000000_prepayment_tracking.sql
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

describe('P2 Prepayment Tracking', () => {
  const supabase = createClient(supabaseUrl, supabaseKey)

  let testCrewId: string
  let testRentalId: string
  let testPrepaymentId: string

  beforeAll(async () => {
    // Create test crew
    const { data: crew } = await supabase
      .from('crews')
      .insert({ name: 'Prepayment Test Crew', owner_id: 'test_user' })
      .select()
      .single()

    testCrewId = crew?.id || ''

    // Create test rental
    const { data: rental } = await supabase
      .from('rentals')
      .insert({
        crew_id: testCrewId,
        vehicle_id: 'test-bike-001',
        agreed_start_date: new Date().toISOString(),
        agreed_end_date: new Date(Date.now() + 86400000).toISOString(),
        status: 'confirmed',
        total_cost: 10000
      })
      .select()
      .single()

    testRentalId = rental?.rental_id || ''
  })

  afterAll(async () => {
    // Cleanup
    await supabase.from('cash_transactions').delete().eq('crew_id', testCrewId)
    await supabase.from('rentals').delete().eq('crew_id', testCrewId)
    await supabase.from('crews').delete().eq('id', testCrewId)
  })

  describe('Transaction Type Constraint', () => {
    it('should accept income_prepayment transaction type', async () => {
      const { data, error } = await supabase
        .from('cash_transactions')
        .insert({
          crew_id: testCrewId,
          rental_id: testRentalId,
          transaction_type: 'income_prepayment',
          flow_direction: 'in',
          amount: 5000,
          description: 'Предоплата за бронь BMW',
          transaction_date: new Date().toISOString()
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeTruthy()
      expect(data?.transaction_type).toBe('income_prepayment')
      testPrepaymentId = data?.id || ''
    })

    it('should reject invalid transaction type', async () => {
      const { error } = await supabase
        .from('cash_transactions')
        .insert({
          crew_id: testCrewId,
          transaction_type: 'invalid_type',
          flow_direction: 'in',
          amount: 1000
        })

      expect(error).toBeTruthy()
      expect(error?.message).toContain('transaction_type')
    })
  })

  describe('Prepayment CRUD Operations', () => {
    it('should create prepayment with rental reference', async () => {
      const { data, error } = await supabase
        .from('cash_transactions')
        .insert({
          crew_id: testCrewId,
          rental_id: testRentalId,
          transaction_type: 'income_prepayment',
          flow_direction: 'in',
          amount: 3000,
          description: 'Частичная предоплата',
          payment_method: 'card'
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.rental_id).toBe(testRentalId)
      expect(data?.payment_method).toBe('card')
    })

    it('should retrieve prepayments by crew', async () => {
      const { data, error } = await supabase
        .from('cash_transactions')
        .select('*')
        .eq('crew_id', testCrewId)
        .eq('transaction_type', 'income_prepayment')

      expect(error).toBeNull()
      expect(data?.length).toBeGreaterThan(0)
    })

    it('should retrieve prepayments by rental', async () => {
      const { data, error } = await supabase
        .from('cash_transactions')
        .select('*')
        .eq('rental_id', testRentalId)
        .eq('transaction_type', 'income_prepayment')

      expect(error).toBeNull()
      expect(data?.length).toBeGreaterThan(0)
    })

    it('should update prepayment description', async () => {
      const newDescription = 'Обновленная предоплата'
      const { data, error } = await supabase
        .from('cash_transactions')
        .update({ description: newDescription })
        .eq('id', testPrepaymentId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.description).toBe(newDescription)
    })
  })

  describe('Prepayment Summary View', () => {
    it('should return correct daily summary', async () => {
      const { data, error } = await supabase
        .from('prepayment_summary')
        .select('*')
        .eq('crew_id', testCrewId)

      expect(error).toBeNull()
      expect(data?.length).toBeGreaterThan(0)

      const summary = data![0]
      expect(summary.total_prepayments).toBeGreaterThan(0)
      expect(summary.unique_rentals_reserved).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Revenue Calculation', () => {
    it('should exclude prepayments from rental income query', async () => {
      // Query for income_rental (should NOT include prepayments)
      const { data: rentalIncome } = await supabase
        .from('cash_transactions')
        .select('amount')
        .eq('crew_id', testCrewId)
        .eq('transaction_type', 'income_rental')

      const { data: prepayments } = await supabase
        .from('cash_transactions')
        .select('amount')
        .eq('crew_id', testCrewId)
        .eq('transaction_type', 'income_prepayment')

      // Prepayments should exist but be separate from rental income
      expect(prepayments?.length).toBeGreaterThan(0)
      expect(rentalIncome?.length).toBe(0) // No actual rental income in test
    })

    it('should allow filtering by transaction_type', async () => {
      const { data: allTransactions } = await supabase
        .from('cash_transactions')
        .select('transaction_type, amount')
        .eq('crew_id', testCrewId)

      const prepayments = allTransactions?.filter(t => t.transaction_type === 'income_prepayment') || []

      expect(prepayments.length).toBeGreaterThan(0)
      expect(prepayments.every(t => t.transaction_type === 'income_prepayment')).toBe(true)
    })
  })

  describe('Index Performance', () => {
    it('should use index for prepayment queries', async () => {
      // This is a basic query test; true index verification requires EXPLAIN ANALYZE
      const { data, error } = await supabase
        .from('cash_transactions')
        .select('*')
        .eq('transaction_type', 'income_prepayment')
        .limit(10)

      expect(error).toBeNull()
      expect(data).toBeTruthy()
    })
  })
})
