/**
 * iter25 — money split: moto vs gear cost separately, partner bikes separated
 * by cost, company vs partner profit visible.
 * =============================================================================
 *
 * Client wish (VIP Bike owner):
 *   «Единственное что пару моментов ещё добавить чтоб в отчёте тоже стояла
 *    стоимость мота и экипа отдельно. И чтоб партнёрские моты сразу разделялись
 *    по стоимости. И была видна прибыль компании и партнёра. Это пригодится
 *    для лк владельцев и для общего верного отчёта.»
 *
 * Architecture under test:
 *   1. rental-price-split.ts — ONE pure lib: unit price table, stored-vs-
 *      estimated split, partner/company split, subrenter snapshot resolution.
 *   2. Writers persist the split at creation: /doc (doc-manual.ts) and web
 *      checkout (franchize-order.ts) → metadata.equipment_price / bike_price /
 *      subrenter_chat_id.
 *   3. Readers consume stored-first: subrenter-economics (delegates), analytics
 *      KPIs (+ new «Компании» card), CSV finance sheet («Партнеру» column),
 *      weekly partner report (moto/gear columns + bike-part-only payout).
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  EQUIPMENT_UNIT_PRICES_RUB,
  DEFAULT_OWNER_PCT,
  getStoredEquipmentPrice,
  estimateEquipmentPrice,
  getRentalEquipmentPart,
  splitRentalPrice,
  resolveOwnerPct,
  resolveRentalSubrenterChatId,
  computePartnerSplit,
} from '@/app/franchize/lib/rental-price-split';
import {
  getEquipmentCostPart,
  getBikeRevenuePart,
  getSubrenterCut,
  getCrewPart,
  summarizeSubrenterMonth,
  SUBRENTER_EQUIPMENT_UNIT_PRICES,
} from '@/app/franchize/lib/subrenter-economics';
import {
  computeAnalyticsKpis,
  getEquipmentSummary,
} from '@/app/franchize/[slug]/rentals-analytics/components/lib/analytics-utils';

const CREW = 'vip-bike';
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

// ─── 1. Pure lib: stored vs estimated split ──────────────────────────────────

describe('iter25: rental-price-split lib', () => {
  it('unit price table is the single source (helmet 1000, soft gear 500, charger free)', () => {
    expect(EQUIPMENT_UNIT_PRICES_RUB.helmets).toBe(1000);
    expect(EQUIPMENT_UNIT_PRICES_RUB.gloves).toBe(500);
    expect(EQUIPMENT_UNIT_PRICES_RUB.charger).toBe(0);
    // subrenter-economics re-exports the SAME table (no drift possible)
    expect(SUBRENTER_EQUIPMENT_UNIT_PRICES).toBe(EQUIPMENT_UNIT_PRICES_RUB);
  });

  it('estimate is gift-aware and quantity-aware', () => {
    expect(estimateEquipmentPrice({ equipment: { helmets: 2, gloves: 1 } })).toBe(2500);
    expect(estimateEquipmentPrice({ equipment: { jacket: true } })).toBe(500);
    expect(estimateEquipmentPrice({ equipment: { charger: true } })).toBe(0);
    // «перчатки в подарок» — not charged, not counted
    expect(estimateEquipmentPrice({ equipment: { gloves: 2, gloves_gift: true, helmets: 1 } })).toBe(1000);
    expect(estimateEquipmentPrice(null)).toBe(0);
  });

  it('stored equipment_price wins over the estimate', () => {
    const md = { equipment_price: 700, equipment: { helmets: 2 } }; // estimate would be 2000
    expect(getStoredEquipmentPrice(md)).toBe(700);
    expect(getRentalEquipmentPart(md)).toBe(700);
    expect(getEquipmentCostPart(md)).toBe(700); // delegation through subrenter-economics
    // legacy row — no stored value → estimate
    expect(getStoredEquipmentPrice({ equipment: { helmets: 2 } })).toBeNull();
    expect(getRentalEquipmentPart({ equipment: { helmets: 2 } })).toBe(2000);
    // garbage stored values are ignored (negative / non-numeric)
    expect(getStoredEquipmentPrice({ equipment_price: -5 })).toBeNull();
    expect(getStoredEquipmentPrice({ equipment_price: 'abc' })).toBeNull();
  });

  it('splitRentalPrice: stored → exact source; legacy → estimated; gear clamped to total', () => {
    expect(splitRentalPrice(10000, { equipment_price: 1500, bike_price: 8500 })).toEqual({
      totalRub: 10000, bikePartRub: 8500, equipmentPartRub: 1500, source: 'stored',
    });
    expect(splitRentalPrice(10000, { equipment: { helmets: 2 } }).source).toBe('estimated');
    expect(splitRentalPrice(10000, { equipment: { helmets: 2 } }).equipmentPartRub).toBe(2000);
    // gear part can never exceed the total (clamped, bike part floors at 0)
    expect(splitRentalPrice(1000, { equipment_price: 5000 })).toEqual({
      totalRub: 1000, bikePartRub: 0, equipmentPartRub: 1000, source: 'stored',
    });
    expect(splitRentalPrice('12 000', { equipment_price: 2000 }).totalRub).toBe(12000);
    expect(splitRentalPrice(null, null).totalRub).toBe(0);
  });

  it('computePartnerSplit: partner gets pct of the BIKE part only; company keeps the rest', () => {
    // Partner bike, 6000 total, 1000 gear: bike part 5000 → 50% = 2500 partner
    const s = computePartnerSplit({
      totalCost: 6000,
      metadata: { equipment_price: 1000 },
      subrenterChatId: '413553377',
    });
    expect(s.isPartnerBike).toBe(true);
    expect(s.partnerRub).toBe(2500);
    expect(s.companyRub).toBe(3500); // 1000 gear + 2500 company share of bike
    expect(s.source).toBe('stored');

    // Own bike: everything is company money
    const own = computePartnerSplit({ totalCost: 6000, metadata: {}, subrenterChatId: null });
    expect(own.isPartnerBike).toBe(false);
    expect(own.partnerRub).toBe(0);
    expect(own.companyRub).toBe(6000);

    // Non-default pct + clamping
    expect(computePartnerSplit({ totalCost: 5000, subrenterChatId: '1', ownerPct: 70 }).partnerRub).toBe(3500);
    expect(computePartnerSplit({ totalCost: 5000, subrenterChatId: '1', ownerPct: 900 }).ownerPct).toBe(99);
    expect(computePartnerSplit({ totalCost: 5000, subrenterChatId: '1', ownerPct: 0 }).ownerPct).toBe(1);
  });

  it('resolveOwnerPct defaults to 50', () => {
    expect(DEFAULT_OWNER_PCT).toBe(50);
    expect(resolveOwnerPct(null)).toBe(50);
    expect(resolveOwnerPct(undefined)).toBe(50);
    expect(resolveOwnerPct(60)).toBe(60);
  });

  it('resolveRentalSubrenterChatId: metadata snapshot wins over current specs', () => {
    expect(resolveRentalSubrenterChatId({ subrenter_chat_id: '111' }, '222')).toBe('111');
    expect(resolveRentalSubrenterChatId({}, '222')).toBe('222');
    expect(resolveRentalSubrenterChatId({ subrenter_chat_id: 111 }, '222')).toBe('111');
    expect(resolveRentalSubrenterChatId({}, null)).toBeNull();
    // a re-assigned bike (specs now 222) keeps paying the deal-time partner 111
    expect(resolveRentalSubrenterChatId({ subrenter_chat_id: '111' }, '222')).toBe('111');
  });
});

// ─── 2. subrenter-economics delegation stays behaviour-compatible ────────────

describe('iter25: subrenter-economics delegation', () => {
  it('legacy formulas still work with estimated rows (no stored split)', () => {
    const md = { equipment: { helmets: 1, gloves: 1 } }; // 1500
    expect(getEquipmentCostPart(md)).toBe(1500);
    expect(getBikeRevenuePart(6000, 1500)).toBe(4500);
    expect(getSubrenterCut(6000, 1500)).toBe(2250);
    expect(getCrewPart(6000, 1500)).toBe(3750);
  });

  it('summarizeSubrenterMonth uses the stored split when present', () => {
    const summary = summarizeSubrenterMonth('2026-08', [
      {
        rentalId: 'r1', bikeId: 'b1', bikeLabel: 'Yamaha R7', status: 'completed',
        totalCost: 8000, agreedStartDate: '2026-08-02T10:00:00+03:00',
        agreedEndDate: '2026-08-03T10:00:00+03:00',
        metadata: { equipment_price: 2000, bike_price: 6000 }, // exact: 6000 bike
      },
    ]);
    expect(summary.rentals[0].equipmentRub).toBe(2000);
    expect(summary.rentals[0].bikePartRub).toBe(6000);
    expect(summary.rentals[0].cutRub).toBe(3000);
    expect(summary.cutRub).toBe(3000);
  });
});

// ─── 3. Analytics: company KPI + stored-first equipment ──────────────────────

describe('iter25: analytics KPIs', () => {
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

  it('companyPartToday = revenue − partner cuts; partner rows use stored split', () => {
    const rows = [
      // own bike, no gear → 6000 all company
      row({ total_cost: 6000 }),
      // partner bike 8000 with 1500 stored gear → bike 6500 → partner 3250, company 4750
      row({ total_cost: 8000, subrenterChatId: '413553377', metadata: { equipment_price: 1500 } }),
      // partner bike legacy row 5000 estimated gear 1000 → bike 4000 → partner 2000, company 3000
      row({ total_cost: 5000, subrenterChatId: '111', metadata: { equipment: { helmets: 1 } } }),
    ];
    const kpis = computeAnalyticsKpis(rows, day);
    expect(kpis.revenueToday).toBe(19000);
    expect(kpis.equipmentPartToday).toBe(2500); // 1500 stored + 1000 estimated
    expect(kpis.owedToSubrentersToday).toBe(5250); // 3250 + 2000
    expect(kpis.companyPartToday).toBe(19000 - 5250);
  });

  it('getEquipmentSummary marks stored cost as exact and estimated with ~', () => {
    const stored = getEquipmentSummary({
      metadata: { equipment_price: 700, equipment: { helmets: 2 } },
    } as never);
    expect(stored.cost).toBe(700);
    expect(stored.exact).toBe(true);

    const legacy = getEquipmentSummary({
      metadata: { equipment: { helmets: 2 } },
    } as never);
    expect(legacy.cost).toBe(2000);
    expect(legacy.exact).toBe(false);
  });

  it('KPI card row renders the company card (7 cards incl. Компании/Партнёрам)', () => {
    const src = read('app/franchize/[slug]/rentals-analytics/components/AnalyticsKPICards.tsx');
    expect(src).toContain('Компании');
    expect(src).toContain('Партнёрам');
    expect(src).toContain('companyPartToday');
    expect(src).toContain('lg:grid-cols-7');
  });

  it('v2 client prefers the metadata subrenter snapshot', () => {
    const src = read('app/franchize/[slug]/rentals-analytics/AnalyticsClientV2.tsx');
    expect(src).toMatch(/subrenterChatIdFromSpecs\(\s*\(item\.vehicle\?\.specs \?\? null\)[^)]+,\s*md,/);
  });

  it('drawer shows Мот/Экип split and Нам/Партнёру for partner bikes', () => {
    const src = read('app/franchize/[slug]/rentals-analytics/components/RentalDetailDrawer.tsx');
    expect(src).toContain('Мот / Экип');
    expect(src).toContain('Нам / Партнёру');
    expect(src).toContain('computePartnerSplit');
  });
});

// ─── 4. Writers persist the split ────────────────────────────────────────────

describe('iter25: writers persist moto/gear split + subrenter snapshot', () => {
  it('/doc stores bike_price + equipment_price + subrenter snapshot', () => {
    const src = read('app/webhook-handlers/commands/doc-manual.ts');
    expect(src).toContain('bike_price: Math.round(');
    expect(src).toContain('equipment_price: Math.round(equipmentCostTotal)');
    expect(src).toMatch(/subrenter_chat_id:\s*bike\.specs\??\.?subrenter_chat_id\.trim\(\)/);
  });

  it('web checkout derives the split from cartLines priceBreakdown', () => {
    const src = read('app/webhook-handlers/franchize-order.ts');
    expect(src).toContain('splitFromCart');
    expect(src).toMatch(/pb\.helmetRub/);
    expect(src).toMatch(/pb\.extrasRub/);
    expect(src).toContain('...splitFromCart,');
    expect(src).toContain('...subrenterSnapshot,');
    // vehicle select now includes specs (for the snapshot)
    expect(src).toMatch(/select\("id, owner_id, make, model, image_url, specs"\)/);
  });
});

// ─── 5. CSV finance sheet: «Партнеру» filled + stored equipment ──────────────

describe('iter25: CSV finance sheet', () => {
  const src = () => read('lib/csv-builders/rentals-csv.ts');

  it('«Партнеру» column is populated with the partner cut (was always empty)', () => {
    const s = src();
    expect(s).toContain('getSubrenterCut(price, equipmentPartRub)');
    expect(s).toMatch(/partnerPayout > 0 \? String\(partnerPayout\) : ""/);
    // per-row totals + totals row both carry partner payouts
    expect(s).toMatch(/totalPartnerPayouts > 0 \? totalPartnerPayouts : ""/);
    expect(s).toContain('totalPartnerPayouts,');
  });

  it('equipment column uses the stored-first split and marks estimates with ~', () => {
    const s = src();
    expect(s).toContain('getEquipmentCostPart(meta)');
    expect(s).toMatch(/equipExact \? "" : "~"/);
    // partner resolution prefers the metadata snapshot
    expect(s).toContain('subrenterIdSnapshot ?? subrenterChatIdFromSpecs');
  });
});

// ─── 6. Weekly partner report: bike-part-only payout + moto/gear columns ────

describe('iter25: weekly partner report', () => {
  it('payout base is the BIKE part (pct × total incl. gear is the old bug)', () => {
    const s = read('app/franchize/server-actions/subrenter-monitoring.ts');
    expect(s).toContain('const payout = Math.round((totalBikePart * pct) / 100);');
    expect(s).not.toContain('const payout = Math.round((totalPayments * pct) / 100);');
    // per-row split + new template vars + summary fields
    expect(s).toContain('getEquipmentCostPart(r.metadata)');
    expect(s).toContain('bike_part_rub');
    expect(s).toContain('equipment_part_rub');
    expect(s).toContain('bikePartRub: totalBikePart');
    expect(s).toContain('equipmentPartRub: totalEquipment');
  });

  it('both report templates show separate Мот/Экип columns and split totals', () => {
    for (const tpl of [
      'docs/SUBRENT_WEEKLY_REPORT_TEMPLATE.html',
      `docs/crewDocs/${CREW}_SUBRENT_WEEKLY_REPORT_TEMPLATE.html`,
    ]) {
      const s = read(tpl);
      expect(s).toContain('Мот, руб.');
      expect(s).toContain('Экип, руб.');
      expect(s).toContain('{{bike_part_rub}}');
      expect(s).toContain('{{equipment_part_rub}}');
      expect(s).toContain('% от аренды мотоцикла(ов)');
      // no orphaned single «Сумма» column header
      expect(s).not.toContain('Сумма, руб.');
    }
  });

  it('admin panel summary shows the moto+equip split of the payout base', () => {
    const s = read('app/franchize/components/SubrenterManagerPanel.tsx');
    expect(s).toContain('мот ${s.bikePartRub.toLocaleString');
    expect(s).toContain('% от аренды мотоциклов');
  });

  it('owner payout sheet shows the company part per partner', () => {
    // iter31: the payout sheet lives in the SubrentersOverviewPanel component.
    const s = read('app/franchize/[slug]/profile/components/SubrentersOverviewPanel.tsx');
    expect(s).toContain('нам ${formatCurrency(Math.max(0, row.totalRub - row.payoutRub))}');
  });
});
