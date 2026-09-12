/**
 * iter32 — equipment parity in the WEB UI + subrenter/salary leveling.
 * =============================================================================
 *
 * Grounds (real code, no invention):
 *   • d3fcbe5 unified equipment rentals into `rentals` with
 *     metadata.item_type='equipment' — but the web UI still read ONLY the
 *     legacy metadata.equipment flags, so standalone gear rows rendered as
 *     fake bike rentals with «Экипировка: не включена» and a zero gear part.
 *   • /api/franchize/deposit-summary started requiring `slug` during the
 *     2026-08-19 auth hardening; the drawer callers never sent it → the
 *     deposit panel was dead in practice (silent 400 fallback).
 *   • ExO (Salim Ismail, «Exponential Organizations») attributes applied to
 *     the subrenter experience: Dashboards (6-month cut trend), Interfaces
 *     (history → what matters), Engagement (completion TG message),
 *     Autonomy (payout bookkeeping without asking the crew).
 *   • Crew salaries leveled to the same bar: member payout history +
 *     shared DEFAULT_HOURLY_RATE (500, the DB default) instead of the
 *     drifted 169 literals.
 *
 * What this file pins:
 *   1. rental-price-split: item_type='equipment' → the whole total is gear.
 *   2. subrenter-economics.getEquipmentCostPart(metadata, total) — exact gear
 *      revenue for standalone rows, legacy fallbacks kept.
 *   3. analytics-utils.getGearPanelData — the unified 3-source gear view
 *      (snapshot → title → flags) + subject title.
 *   4. Analytics KPIs count gear-only revenue as GEAR, not bike.
 *   5. buildSubrenterCompletionMessage — close-the-loop partner message.
 *   6. Salary leveling: DEFAULT_HOURLY_RATE + the 169 literals are gone.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  splitRentalPrice,
  computePartnerSplit,
  isEquipmentOnlyRental,
  isLinkedEquipmentRow,
} from '@/app/franchize/lib/rental-price-split';
import {
  getEquipmentCostPart,
  getSubrenterCut,
  buildSubrenterCompletionMessage,
  summarizeSubrenterMonth,
} from '@/app/franchize/lib/subrenter-economics';
import {
  computeAnalyticsKpis,
  getEquipmentSummary,
  getGearPanelData,
  getRentalSubjectTitle,
  equipmentConditionColor,
} from '@/app/franchize/[slug]/rentals-analytics/components/lib/analytics-utils';
import { DEFAULT_HOURLY_RATE } from '@/app/franchize/lib/salary-constants';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

// ─── 1. Standalone gear rows: the whole total is equipment revenue ──────────

describe('iter32: equipment-only money split', () => {
  it('item_type=equipment → equipmentPart = total, bikePart = 0, exact source', () => {
    const split = splitRentalPrice(3000, { item_type: 'equipment' });
    expect(split.equipmentPartRub).toBe(3000);
    expect(split.bikePartRub).toBe(0);
    expect(split.source).toBe('equipment_total');
  });

  it('isEquipmentOnlyRental is strict (no false positives from other rows)', () => {
    expect(isEquipmentOnlyRental({ item_type: 'equipment' })).toBe(true);
    expect(isEquipmentOnlyRental({})).toBe(false);
    expect(isEquipmentOnlyRental({ item_type: 'service' })).toBe(false);
    expect(isEquipmentOnlyRental(null)).toBe(false);
    expect(isEquipmentOnlyRental(undefined)).toBe(false);
  });

  it('bike rows keep the legacy split chain (stored wins, then estimate)', () => {
    const stored = splitRentalPrice(8000, { equipment_price: 1500 });
    expect(stored.source).toBe('stored');
    expect(stored.equipmentPartRub).toBe(1500);
    expect(stored.bikePartRub).toBe(6500);
    const estimated = splitRentalPrice(5000, { equipment: { helmets: 1, charger: true } });
    expect(estimated.source).toBe('estimated');
    expect(estimated.equipmentPartRub).toBe(1000);
    expect(estimated.bikePartRub).toBe(4000);
  });

  it('partner split on a gear row: no partner → everything is company money', () => {
    const ps = computePartnerSplit({ totalCost: 3000, metadata: { item_type: 'equipment' } });
    expect(ps.isPartnerBike).toBe(false);
    expect(ps.partnerRub).toBe(0);
    expect(ps.companyRub).toBe(3000);
  });

  it('getEquipmentCostPart: standalone + total → total; without total → fallbacks kept', () => {
    // exact: the whole rental total is gear revenue
    expect(getEquipmentCostPart({ item_type: 'equipment' }, 3000)).toBe(3000);
    // without a total the old stored → estimate chain still applies
    expect(getEquipmentCostPart({ item_type: 'equipment' })).toBe(0);
    expect(getEquipmentCostPart({ item_type: 'equipment', equipment_price: 700 }, null)).toBe(700);
    // flag rows unchanged (one-arg calls stay behavior-compatible)
    expect(getEquipmentCostPart({ equipment: { helmets: 2, gloves: 1 } })).toBe(2500);
    expect(getEquipmentCostPart({ equipment: { helmets: 2, gloves: 1 } }, 99999)).toBe(2500);
  });

  it('summarizeSubrenterMonth treats a stray gear row as gear (never partner money)', () => {
    const summary = summarizeSubrenterMonth('2026-08', [
      {
        rentalId: 'r1', bikeId: 'b1', bikeLabel: 'Yamaha R7', status: 'completed',
        totalCost: 8000, agreedStartDate: '2026-08-02T10:00:00+03:00',
        agreedEndDate: '2026-08-03T10:00:00+03:00',
        metadata: { equipment_price: 2000, bike_price: 6000 },
      },
      {
        rentalId: 'r2', bikeId: 'b1', bikeLabel: 'Yamaha R7', status: 'completed',
        totalCost: 1500, agreedStartDate: '2026-08-09T10:00:00+03:00',
        agreedEndDate: '2026-08-09T20:00:00+03:00',
        metadata: { item_type: 'equipment' }, // degenerate: gear row on a partner bike
      },
    ]);
    expect(summary.rentals[0].cutRub).toBe(3000);
    // gear row: equipment part = 1500 → bike part 0 → partner cut 0
    expect(summary.rentals[1].equipmentRub).toBe(1500);
    expect(summary.rentals[1].bikePartRub).toBe(0);
    expect(summary.rentals[1].cutRub).toBe(0);
  });
});

// ─── 2. The unified gear view (3 sources, fallback chain) ───────────────────

describe('iter32: getGearPanelData — one reader for all gear dialects', () => {
  const day = '2026-08-30';

  function row(over: Record<string, unknown>) {
    return {
      status: 'completed',
      total_cost: 0,
      requested_start_date: `${day}T10:00:00+03:00`,
      agreed_start_date: `${day}T10:00:00+03:00`,
      metadata: {},
      ...over,
    };
  }

  it('source 1: equipment_items snapshot (web checkout) — titles + daily prices', () => {
    const rental = row({
      total_cost: 4500,
      metadata: {
        item_type: 'equipment',
        equipment_count: 2,
        equipment_items: [
          { id: 'equip-helmet-ls2-vip-bike', title: 'LS2 OF602', daily_price: 1000 },
          { id: 'equip-gloves-tourer-vip-bike', title: 'Перчатки Tourer', daily_price: 500 },
        ],
      },
    }) as never;
    const gear = getGearPanelData(rental);
    expect(gear.standalone).toBe(true);
    expect(gear.items).toHaveLength(2);
    expect(gear.items[0]).toMatchObject({ label: 'LS2 OF602', qty: 1, unitPrice: 1000, source: 'snapshot', priceUnknown: false });
    expect(gear.items[1].source).toBe('snapshot');
    // exact: the whole total is gear revenue
    expect(gear.cost).toBe(4500);
    expect(gear.exact).toBe(true);
    expect(gear.text).toBe('LS2 OF602, Перчатки Tourer');
  });

  it('source 2: equipment_title (bot /ekip + unified actions) — count + daily price + meta', () => {
    const rental = row({
      total_cost: 2000,
      metadata: {
        item_type: 'equipment',
        source: 'ekip_command',
        equipment_title: 'Шлем LS2',
        equipment_size: 'L',
        equipment_count: 2,
        daily_price: 1000,
        equipment_condition: 'Выдан',
        issued_at: '2026-08-30T10:00:00+03:00',
        returned_at: '2026-08-31T19:00:00+03:00',
        primary_rental_id: '11111111-1111-1111-1111-111111111111',
        damage_reports: [{ phase: 'return', severity: 'light', notes: 'Царапина на визоре', created_at: '2026-08-31T19:00:00+03:00' }],
      },
    }) as never;
    const gear = getGearPanelData(rental);
    expect(gear.standalone).toBe(true);
    expect(gear.items).toHaveLength(1);
    expect(gear.items[0]).toMatchObject({ label: 'Шлем LS2', qty: 2, unitPrice: 1000, source: 'title' });
    expect(gear.condition).toBe('Выдан');
    expect(gear.size).toBe('L');
    expect(gear.issuedAt).toBe('2026-08-30T10:00:00+03:00');
    expect(gear.returnedAt).toBe('2026-08-31T19:00:00+03:00');
    expect(gear.primaryRentalId).toBe('11111111-1111-1111-1111-111111111111');
    expect(gear.damageReports).toHaveLength(1);
    expect(gear.damageReports[0].notes).toBe('Царапина на визоре');
    expect(gear.cost).toBe(2000);
    expect(equipmentConditionColor(gear.condition)).toBe('#3b82f6');
  });

  it('source 3: legacy flags stay EXACTLY as before (fallback kept)', () => {
    const rental = row({
      total_cost: 6000,
      metadata: { equipment: { helmets: 2, gloves: 1, charger: true }, equipment_price: 2500 },
    }) as never;
    const gear = getGearPanelData(rental);
    expect(gear.standalone).toBe(false);
    expect(gear.items.map((i) => i.key)).toEqual(['helmets', 'gloves', 'charger']);
    expect(gear.cost).toBe(2500); // stored wins over the estimate
    expect(gear.exact).toBe(true);
    // and without a stored price → unit-price estimate (old behavior)
    const legacy = getGearPanelData(row({ metadata: { equipment: { helmets: 2, gloves: 1, charger: true } } }) as never);
    expect(legacy.cost).toBe(2500);
    expect(legacy.exact).toBe(false);
  });

  it('getEquipmentSummary wrapper keeps its old shape for flag rows', () => {
    const summary = getEquipmentSummary(row({ metadata: { equipment: { helmets: 2 } } }) as never);
    expect(summary.text).toBe('2 шлема');
    expect(summary.cost).toBe(2000);
    expect(summary.exact).toBe(false);
    expect(summary.items[0]).toEqual({ key: 'helmets', label: 'шлем', qty: 2, unitPrice: 1000, free: false });
  });

  it('subject title: gear rows come from the snapshot, bike rows keep «Байк» chain', () => {
    const gearRow = row({
      metadata: {
        item_type: 'equipment',
        equipment_title: 'Шлем LS2',
        equipment_items: [
          { id: 'a', title: 'LS2 OF602', daily_price: 1000 },
          { id: 'b', title: 'Перчатки', daily_price: 500 },
        ],
      },
    }) as never;
    expect(getRentalSubjectTitle(gearRow)).toBe('LS2 OF602 + ещё 1');
    const emptyGear = row({ metadata: { item_type: 'equipment' } }) as never;
    expect(getRentalSubjectTitle(emptyGear)).toBe('Снаряжение');
    const bikeRow = row({ metadata: {} }) as never;
    expect(getRentalSubjectTitle(bikeRow)).toBe('Байк');
  });

  it('condition colors stay inside the status whitelist', () => {
    expect(equipmentConditionColor('Выдан')).toBe('#3b82f6');
    expect(equipmentConditionColor('Норм')).toBe('#22c55e');
    expect(equipmentConditionColor('Есть повреждения')).toBe('#f59e0b');
    expect(equipmentConditionColor('Утерян')).toBe('#ef4444');
    expect(equipmentConditionColor('что-то новое')).toBe('#64748b');
    expect(equipmentConditionColor(null)).toBeNull();
  });
});

// ─── 3. Analytics KPIs: gear-only revenue is GEAR revenue ────────────────────

describe('iter32: analytics KPI with standalone gear rows', () => {
  const day = '2026-08-30';

  function row(over: Record<string, unknown>) {
    return {
      status: 'completed',
      total_cost: 0,
      requested_start_date: `${day}T10:00:00+03:00`,
      agreed_start_date: `${day}T10:00:00+03:00`,
      metadata: {},
      ...over,
    };
  }

  it('equipmentPartToday counts a gear row in full; partner cut stays 0 for it', () => {
    const kpis = computeAnalyticsKpis(
      [
        // bike 6000, no gear
        row({ total_cost: 6000 }),
        // standalone gear 3000 (bot /ekip shape)
        row({ total_cost: 3000, metadata: { item_type: 'equipment' } }),
      ],
      day,
    );
    expect(kpis.revenueToday).toBe(9000);
    expect(kpis.equipmentPartToday).toBe(3000);
    expect(kpis.owedToSubrentersToday).toBe(0);
    expect(kpis.companyPartToday).toBe(9000);
  });

  it('subrenter cut still excludes the gear part on mixed rows', () => {
    const kpis = computeAnalyticsKpis(
      [row({ total_cost: 8000, subrenterChatId: '413553377', metadata: { equipment_price: 1500 } })],
      day,
    );
    // bike part 6500 → partner 3250
    expect(kpis.equipmentPartToday).toBe(1500);
    expect(kpis.owedToSubrentersToday).toBe(3250);
    // company = revenue − partner cut = 8000 − 3250
    expect(kpis.companyPartToday).toBe(4750);
  });
});

// ─── 4. Subrenter completion message (ExO «Engagement») ──────────────────────

describe('iter32: buildSubrenterCompletionMessage', () => {
  it('shows the final earned amount, excludes gear from the split, escapes html', () => {
    const msg = buildSubrenterCompletionMessage({
      bikeTitle: '<b>Yamaha</b> R7',
      renterName: 'Иван',
      totalRub: 8000,
      equipmentRub: 1500,
      cutRub: 3250,
      shortRentalId: 'abcd1234',
      startDate: '2026-08-30T10:00:00+03:00',
      endDate: '2026-08-31T10:00:00+03:00',
      crewName: 'Vip Bike',
    });
    // ru-RU thousands are formatted with NBSP — normalize before matching
    const flat = msg.replace(/\u00A0/g, " ");
    expect(flat).toContain('Байк вернулся из аренды');
    expect(flat).toContain('Сумма аренды: <b>8 000 ₽</b>');
    expect(flat).toContain('Экипировка (не делится): 1 500 ₽');
    expect(flat).toContain('Ваш заработок (50% от аренды байка 6 500 ₽): <b>3 250 ₽</b>');
    expect(msg).toContain('<code>abcd1234</code>');
    // renter-visible text is escaped
    expect(msg).toContain('&lt;b&gt;Yamaha&lt;/b&gt; R7');
    expect(msg).not.toContain('<b>Yamaha</b>');
  });

  it('minimal input: no renter/dates → no empty lines, still correct math', () => {
    const msg = buildSubrenterCompletionMessage({
      bikeTitle: '',
      totalRub: null,
      equipmentRub: 0,
      cutRub: 0,
    });
    const flat = msg.replace(/\u00A0/g, " ");
    expect(flat).toContain('байк');
    expect(flat).toContain('Сумма аренды: <b>0 ₽</b>');
    expect(msg).not.toContain('Экипировка');
  });
});

// ─── 5. Salary leveling: one rate default, no drifted literals ───────────────

describe('iter32: salary leveling', () => {
  it('DEFAULT_HOURLY_RATE matches the DB default (500)', () => {
    expect(DEFAULT_HOURLY_RATE).toBe(500);
    const migration = read('supabase/migrations/20260726000001_deposit_and_shift_tracking.sql');
    expect(migration).toContain('hourly_rate numeric DEFAULT 500');
  });

  it('the 169 literals are gone from the web shift math (drift fix)', () => {
    const shifts = read('app/franchize/[slug]/crew/CrewShiftsClient.tsx');
    const team = read('app/franchize/server-actions/team-earnings.ts');
    expect(shifts).not.toMatch(/\|\|\s*169\)/);
    expect(team).not.toMatch(/\|\|\s*169\)/);
    expect(shifts).toContain('DEFAULT_HOURLY_RATE');
    expect(team).toContain('DEFAULT_HOURLY_RATE');
  });

  it('getMyPayoutHistory exists and is exported from salary-calculations', () => {
    const src = read('app/franchize/server-actions/salary-calculations.ts');
    expect(src).toContain('export async function getMyPayoutHistory');
    // member-scoped: always filters to the cookie-derived actor
    expect(src).toContain('to_user_id", secureUserId');
  });

  it('the drawer sends the required slug to deposit-summary (dead-panel fix)', () => {
    const drawer = read('app/franchize/[slug]/rentals-analytics/components/RentalDetailDrawer.tsx');
    const section = read('app/franchize/[slug]/rentals-analytics/components/DepositSection.tsx');
    expect(drawer).toContain('crewSlug');
    expect(drawer).toContain('qs.set("slug", crewSlug)');
    expect(section).toContain('qs.set("slug", crewSlug)');
    // and the parent passes the real slug at both render sites
    const client = read('app/franchize/[slug]/rentals-analytics/components/AnalyticsClient.tsx');
    expect(client.match(/crewSlug=\{initialSlug\}/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── 7. Linked gear rows are inventory, not revenue (2026-09-13) ─────────────
// /doc's createEquipmentRowsForRental mirrors gear issued WITH a bike rental
// into standalone rentals rows (metadata.primary_rental_id). Their money must
// NOT be counted anywhere — the gear charge already lives in the primary
// rental's total_cost. Measured impact before the fix: +6 500 ₽ phantom
// revenue on the 2026-09-12 vip-bike day page alone.

describe('iter32-fix: linked equipment rows are zero-money inventory mirrors', () => {
  const LINKED = {
    item_type: 'equipment',
    primary_rental_id: 'c96d0f22-0000-0000-0000-000000000000',
    daily_price: 1000,
  };

  it('isLinkedEquipmentRow detects mirrors and ignores everything else', () => {
    expect(isLinkedEquipmentRow(LINKED)).toBe(true);
    // standalone gear (real revenue) is NOT linked
    expect(isLinkedEquipmentRow({ item_type: 'equipment' })).toBe(false);
    // bike rows never link
    expect(isLinkedEquipmentRow({ primary_rental_id: 'abc' })).toBe(false);
    expect(isLinkedEquipmentRow({})).toBe(false);
    expect(isLinkedEquipmentRow(null)).toBe(false);
  });

  it('splitRentalPrice zeroes linked rows (before the equipment_total branch)', () => {
    // even though total_cost still carries the legacy phantom money in the DB
    const split = splitRentalPrice(2000, LINKED);
    expect(split.totalRub).toBe(0);
    expect(split.equipmentPartRub).toBe(0);
    expect(split.bikePartRub).toBe(0);
    expect(split.source).toBe('linked_inventory');
  });

  it('getEquipmentCostPart returns 0 for linked rows regardless of total', () => {
    expect(getEquipmentCostPart(LINKED, 2000)).toBe(0);
    expect(getEquipmentCostPart(LINKED)).toBe(0);
  });

  it('computePartnerSplit: linked row adds nothing to partner or company', () => {
    const ps = computePartnerSplit({ totalCost: 2000, metadata: LINKED, subrenterChatId: '413553377' });
    expect(ps.partnerRub).toBe(0);
    expect(ps.companyRub).toBe(0);
  });

  it('KPI counters exclude linked rows from money/counts but keep their returns', () => {
    const day = '2026-09-12';
    const row = (over: Record<string, unknown>) => ({
      status: 'active',
      total_cost: 0,
      requested_start_date: `${day}T10:00:00+03:00`,
      agreed_start_date: `${day}T10:00:00+03:00`,
      metadata: {},
      ...over,
    });
    const kpis = computeAnalyticsKpis(
      [
        // real bike rental with bundled gear (the ONLY money row)
        row({ total_cost: 12500, metadata: { equipment_price: 2500, bike_price: 10000 } }),
        // two phantom-money gear mirrors of that rental (legacy shape)
        row({ total_cost: 1000, metadata: LINKED }),
        row({ total_cost: 1000, metadata: LINKED }),
        // a returning mirror: still shown in «Возвратов» (gear must come back)
        row({ total_cost: 500, metadata: LINKED, agreed_end_date: `${day}T18:00:00+03:00`, requested_end_date: `${day}T18:00:00+03:00` }),
      ],
      day,
    );
    expect(kpis.totalToday).toBe(1);          // mirrors are not «аренды»
    expect(kpis.revenueToday).toBe(12500);    // no +2000 phantom
    expect(kpis.equipmentPartToday).toBe(2500);
    expect(kpis.returnsDue).toBe(1);          // return tracking preserved
  });
});
