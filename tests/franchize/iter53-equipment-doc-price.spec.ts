/**
 * iter53 — reference prices for standalone equipment docs in the ЭКИП CSV
 * block (lib/csv-builders/equipment-doc-price.ts).
 * =============================================================================
 *
 * Client wish (VIP Bike owner, 2026-10-08):
 *   «...restore non zero prices for equipment SPECIFICALLY FOR DOWNLOADABLE
 *    EXPORTED TABLE keeping counters on rentals-analytics page intact (don't
 *    reintroduce double accounting for equipment, just fix table equipment
 *    subtable with proper equipment prices — calculate properly, kinda hourly
 *    rental - half price, same for 1+ day rentals - starting from second day
 *    of rental equipment is half priced as well;)»
 *
 * The formula is the ONE canon (rental-price-split.ts durationAwareUnitPrice):
 *   <24h → half daily price; ≥24h → day 1 full + halves after; broken
 *   window → flat. Price basis: equipment_items[].daily_price →
 *   metadata.daily_price → cars.daily_price; × metadata.quantity.
 */

import { describe, expect, it } from 'vitest';
import {
  equipmentDocDailyPriceBasis,
  equipmentDocQuantity,
  estimateEquipmentDocPrice,
} from '../../lib/csv-builders/equipment-doc-price';

const meta = (extra: Record<string, unknown>) => ({ ...extra });

describe('iter53: equipmentDocDailyPriceBasis', () => {
  it('prefers the summed equipment_items[].daily_price (web multi-item docs)', () => {
    const m = meta({
      daily_price: 999, // ignored — items win
      equipment_items: [{ id: 'a', daily_price: 1000 }, { id: 'b', daily_price: 500 }],
    });
    expect(equipmentDocDailyPriceBasis(m)).toBe(1500);
  });

  it('falls back to metadata.daily_price (the /ekip + /doc snapshot)', () => {
    expect(equipmentDocDailyPriceBasis(meta({ daily_price: 500 }))).toBe(500);
  });

  it('then to the cars.daily_price column value passed by the builder', () => {
    expect(equipmentDocDailyPriceBasis(meta({}), '1000')).toBe(1000);
    expect(equipmentDocDailyPriceBasis(meta({}), 500)).toBe(500);
  });

  it('returns 0 when no basis exists (caller keeps the stored value)', () => {
    expect(equipmentDocDailyPriceBasis(meta({}))).toBe(0);
    expect(equipmentDocDailyPriceBasis(null)).toBe(0);
    expect(equipmentDocDailyPriceBasis(meta({ daily_price: 0 }))).toBe(0);
    expect(equipmentDocDailyPriceBasis(meta({ daily_price: 'garbage' }))).toBe(0);
  });
});

describe('iter53: equipmentDocQuantity', () => {
  it('uses metadata.quantity when positive, else 1', () => {
    expect(equipmentDocQuantity(meta({ quantity: 3 }))).toBe(3);
    expect(equipmentDocQuantity(meta({ quantity: '2' }))).toBe(2);
    expect(equipmentDocQuantity(meta({}))).toBe(1);
    expect(equipmentDocQuantity(meta({ quantity: 0 }))).toBe(1);
    expect(equipmentDocQuantity(null)).toBe(1);
  });
});

describe('iter53: estimateEquipmentDocPrice — the pricing canon', () => {
  it('hourly rental (<24h) → HALF price («kinda hourly rental - half price»)', () => {
    // 3-hour helmet doc, catalog 1000 ₽/day → 500 ₽
    expect(
      estimateEquipmentDocPrice({
        metadata: meta({ daily_price: 1000 }),
        startIso: '2026-09-27T11:30:00+03:00',
        endIso: '2026-09-27T14:30:00+03:00',
      }),
    ).toBe(500);
    // 23.9h still counts as hourly
    expect(
      estimateEquipmentDocPrice({
        metadata: meta({ daily_price: 1000 }),
        startIso: '2026-09-27T10:00:00+03:00',
        endIso: '2026-09-28T09:55:00+03:00',
      }),
    ).toBe(500);
  });

  it('exactly 24h → day 1 full price', () => {
    expect(
      estimateEquipmentDocPrice({
        metadata: meta({ daily_price: 1000 }),
        startIso: '2026-09-14T09:00:00+03:00',
        endIso: '2026-09-15T09:00:00+03:00',
      }),
    ).toBe(1000);
  });

  it('1+ day rentals: starting from the SECOND day equipment is half priced', () => {
    // 48h helmet 1000 ₽ → 1000 + 500 = 1500
    expect(
      estimateEquipmentDocPrice({
        metadata: meta({ daily_price: 1000 }),
        startIso: '2026-09-18T16:30:00+03:00',
        endIso: '2026-09-20T16:30:00+03:00',
      }),
    ).toBe(1500);
    // 72h → 1000 + 500 + 500 = 2000
    expect(
      estimateEquipmentDocPrice({
        metadata: meta({ daily_price: 1000 }),
        startIso: '2026-09-18T16:30:00+03:00',
        endIso: '2026-09-21T16:30:00+03:00',
      }),
    ).toBe(2000);
    // odd window 27h → day 1 full + one half-day = 1500 (ceil to 2 days)
    expect(
      estimateEquipmentDocPrice({
        metadata: meta({ daily_price: 1000 }),
        startIso: '2026-09-11T11:00:00+03:00',
        endIso: '2026-09-12T14:00:00+03:00',
      }),
    ).toBe(1500);
  });

  it('broken/absent window → flat daily price (safe canon fallback)', () => {
    expect(
      estimateEquipmentDocPrice({
        metadata: meta({ daily_price: 1000 }),
        startIso: '2026-09-18T16:30:00+03:00',
        endIso: 'brokén',
      }),
    ).toBe(1000);
    expect(
      estimateEquipmentDocPrice({ metadata: meta({ daily_price: 1000 }), startIso: null, endIso: null }),
    ).toBe(1000);
    // end before start → flat
    expect(
      estimateEquipmentDocPrice({
        metadata: meta({ daily_price: 1000 }),
        startIso: '2026-09-18T16:30:00+03:00',
        endIso: '2026-09-18T10:00:00+03:00',
      }),
    ).toBe(1000);
  });

  it('multi-item docs: per-item bases summed, then the duration rule applied', () => {
    // helmet 1000 + jacket 500, 3h → (1500)/2 = 750
    expect(
      estimateEquipmentDocPrice({
        metadata: meta({
          equipment_items: [{ id: 'a', daily_price: 1000 }, { id: 'b', daily_price: 500 }],
        }),
        startIso: '2026-09-27T11:30:00+03:00',
        endIso: '2026-09-27T14:30:00+03:00',
      }),
    ).toBe(750);
  });

  it('quantity multiplies the priced unit', () => {
    expect(
      estimateEquipmentDocPrice({
        metadata: meta({ daily_price: 500, quantity: 2 }),
        startIso: '2026-09-27T11:30:00+03:00',
        endIso: '2026-09-27T14:30:00+03:00',
      }),
    ).toBe(500); // 250 × 2
  });

  it('no price basis → 0 (never invents money)', () => {
    expect(
      estimateEquipmentDocPrice({
        metadata: meta({}),
        vehicleDailyPrice: 0,
        startIso: '2026-09-27T11:30:00+03:00',
        endIso: '2026-09-27T14:30:00+03:00',
      }),
    ).toBe(0);
  });
});
