/**
 * iter52 — block-structured rentals CSV export: АРЕНДЫ / ЭКИП / СЕРВИС /
 * ПРОДАЖИ / СВОДКА as separate blocks with separate totals.
 * =============================================================================
 *
 * Client wish (VIP Bike owner, 2026-10-07):
 *   «В аналитике аренд у нас есть возможность скачать в виде таблички по датам.
 *    Улучши эту табличку — надо отдельно сделать блоки про аренды, про экип и
 *    про сервис. Сейчас типа все в 1 и поэтому итого оно включает сервис, нам
 *    надо отдельно про аренды и про сервис отдельно. И ещё строчки с экипом
 *    они тоже не нулевой стоимости зарплатной колонки, а на самом деле там уже
 *    все посчитано в самих арендах про экип, не надо считать повторно.»
 *
 * What changed:
 *   1. lib/csv-builders/rentals-csv.ts — buildRentalsCsv emits 5 named blocks:
 *      АРЕНДЫ (bike rentals only) / ЭКИП (standalone gear docs, NO ЗП column —
 *      the per-unit bonus is already paid inside the paired bike rental's
 *      «ЗП Аренда») / СЕРВИС (service works, NO ЗП column — the official
 *      scheme has no service coefficient) / ПРОДАЖИ / СВОДКА (per-block
 *      totals + ВСЕГО). Previously everything was one flat grid whose «Итого»
 *      mixed service + gear into the rentals totals.
 *   2. lib/csv-builders/rentals-csv-sections.ts — pure section model shared
 *      by the builder and the table-view modal.
 *   3. ExportCsvModal.tsx — renders each block as a titled table + per-block
 *      totals tiles (Σ Аренды / Σ Экип / Σ Сервис / Σ Продажи / Σ ЗП).
 *   4. analytics-csv-send.ts — per-block Telegram caption + XLSX banner/
 *      totals styling.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  CSV_SECTION_TITLES,
  parseCsvSections,
  pluralBlocksRu,
  sectionKeyFromTitle,
} from '../../lib/csv-builders/rentals-csv-sections';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8');

// ─── 1. Pure section model ───────────────────────────────────────────────────

describe('iter52: parseCsvSections (pure)', () => {
  const sheet = [
    ['АРЕНДЫ'],
    ['Дата', 'ЗП Аренда', 'Цена', 'ID'],
    ['07.10', '950', '5000', 'uuid-1'],
    ['08.10', '750', '3000', 'uuid-2'],
    ['Итого аренды', '1700', '8000', ''],
    [],
    ['ЭКИП'],
    ['Дата', 'Наименование', 'Цена', 'ID'],
    ['08.10', 'Шлем (XS)', '1000', 'uuid-3'],
    ['Итого экип', '', '1000', ''],
    [],
    ['СВОДКА'],
    ['Блок', 'Записей', 'Выручка', 'ЗП'],
    ['Аренды', '2', '8000', '1700'],
    ['ВСЕГО', '3', '9000', '1700'],
  ];

  it('splits the sheet into titled blocks with own header/data/totals', () => {
    const { sections, legacy } = parseCsvSections(sheet);
    expect(legacy).toBe(false);
    expect(sections.map((s) => s.key)).toEqual(['rentals', 'equipment', 'summary']);
    expect(sections[0].header).toEqual(['Дата', 'ЗП Аренда', 'Цена', 'ID']);
    expect(sections[0].data).toHaveLength(2);
    expect(sections[0].totals?.[0]).toBe('Итого аренды');
    // blank separator rows are dropped, not counted as data
    expect(sections[1].data).toHaveLength(1);
    // «ВСЕГО» stays a data row of СВОДКА (bolded client-side)
    expect(sections[2].data.at(-1)?.[0]).toBe('ВСЕГО');
  });

  it('falls back to legacy flat-sheet mode when no banner row exists', () => {
    const legacyRows = [
      ['Дата', 'ЗП Аренда', 'Цена'],
      ['07.10', '950', '5000'],
      ['Итого', '950', '5000'],
    ];
    const { sections, legacy } = parseCsvSections(legacyRows);
    expect(legacy).toBe(true);
    expect(sections).toHaveLength(0);
  });

  it('banner detection requires the ONLY non-empty cell to match a known title', () => {
    expect(sectionKeyFromTitle('АРЕНДЫ')).toBe('rentals');
    expect(sectionKeyFromTitle('ЭКИП')).toBe('equipment');
    expect(sectionKeyFromTitle('СЕРВИС')).toBe('service');
    expect(sectionKeyFromTitle('ПРОДАЖИ')).toBe('sales');
    expect(sectionKeyFromTitle('СВОДКА')).toBe('summary');
    // prefix-tolerant + case-insensitive
    expect(sectionKeyFromTitle('аренды (байки)')).toBe('rentals');
    // a data row that merely contains text is NOT a banner
    expect(parseCsvSections([['Дата', 'Комментарий'], ['07.10', 'АРЕНДЫ не выдаются']]).legacy).toBe(true);
    // unknown single-cell row before any banner → legacy
    expect(parseCsvSections([['Случайная строка']]).legacy).toBe(true);
  });

  it('pluralBlocksRu — 1 блок / 2-4 блока / 5+ блоков', () => {
    expect(pluralBlocksRu(1)).toBe('1 блок');
    expect(pluralBlocksRu(2)).toBe('2 блока');
    expect(pluralBlocksRu(4)).toBe('4 блока');
    expect(pluralBlocksRu(5)).toBe('5 блоков');
    expect(pluralBlocksRu(11)).toBe('11 блоков');
  });

  it('titles used by builder, XLSX styler and modal are the same constants', () => {
    const builderSrc = read('lib/csv-builders/rentals-csv.ts');
    expect(builderSrc).toContain('CSV_SECTION_TITLES.rentals');
    expect(builderSrc).toContain('CSV_SECTION_TITLES.equipment');
    expect(builderSrc).toContain('CSV_SECTION_TITLES.service');
    expect(builderSrc).toContain('CSV_SECTION_TITLES.sales');
    expect(builderSrc).toContain('CSV_SECTION_TITLES.summary');
    expect(Object.keys(CSV_SECTION_TITLES)).toEqual(
      expect.arrayContaining(['rentals', 'equipment', 'service', 'sales', 'summary']),
    );
  });
});

// ─── 2. Builder: block split + salary semantics ──────────────────────────────

describe('iter52: buildRentalsCsv block structure (source guards)', () => {
  const src = () => read('lib/csv-builders/rentals-csv.ts');

  it('routes rows by item_type / vehicle.type into the three rental blocks', () => {
    const s = src();
    expect(s).toContain('meta?.item_type === "equipment" || vehicleType === "equipment"');
    expect(s).toContain('if (vehicleType === "service") return "service";');
    expect(s).toContain('vehicle:cars!inner(id, make, model, crew_id, specs, daily_price, type)');
  });

  it('ЭКИП block has NO salary column — gear bonus already paid in ЗП аренд', () => {
    const s = src();
    // header of the ЭКИП block: no «ЗП» column
    expect(s).toContain('"Дата", "Наименование", "Цена", "Выдал", "Принял", "Комментарий", "ID"');
    // СВОДКА explicitly zeroes the gear salary and explains why
    expect(s).toContain('"Экип", blockEquipment.count, blockEquipment.revenue, 0,');
    expect(s).toContain('бонус за экип уже учтён в ЗП аренд');
    // per-unit bonus stays inside the bike rental row (official scheme)
    expect(s).toContain('countEquipmentUnits(eq)');
    expect(s).toContain('equipmentUnits,');
  });

  it('СЕРВИС block has NO salary column and is excluded from ЗП total', () => {
    const s = src();
    expect(s).toContain('"Дата", "Услуга", "Байк", "Цена", "ID"');
    expect(s).toContain('"Сервис", blockService.count, blockService.revenue, 0,');
    // operator salary = аренды + продажи only
    expect(s).toContain('const totalSalary = blockRentals.salary + blockSales.salary;');
    expect(s).toContain('по официальной схеме ЗП за сервис не начисляется');
  });

  it('per-block «Итого» rows + СВОДКА with ВСЕГО', () => {
    const s = src();
    expect(s).toContain('"Итого аренды"');
    // iter53: the ЭКИП итого is explicitly REFERENCE (справочно) — its rows
    // carry computed prices for 0-cost docs while real accounting (СВОДКА /
    // ВСЕГО / summary) stays on stored revenue.
    expect(s).toContain('"Итого экип (справочно)"');
    expect(s).toContain('"Итого сервис"');
    expect(s).toContain('"Итого продажи"');
    expect(s).toContain('"ВСЕГО", totalCount, totalRevenue, totalSalary');
  });

  it('iter53: ЭКИП rows show reference prices for 0-cost docs, stored wins, СВОДКА keeps stored Σ', () => {
    const s = src();
    // the pure duration-aware helper is imported (one canon with the split math)
    expect(s).toContain('estimateEquipmentDocPrice');
    expect(s).toContain('from "@/lib/csv-builders/equipment-doc-price"');
    // stored cost wins; estimate only for 0-cost rows
    expect(s).toContain('const price = storedCost > 0');
    // real accounting Σ (СВОДКА / ВСЕГО / summary) accumulates STORED only —
    // reference prices never flow into the money totals (no double accounting)
    expect(s).toContain('blockEquipment.revenue += storedCost;');
    // and the display Σ is a separate accumulator feeding «Итого экип (справочно)»
    expect(s).toContain('blockEquipmentDisplayRevenue += price;');
    // СВОДКА note explains the справочные prices
    expect(s).toContain('цены строк блока — справочные');
  });

  it('summary stays back-compatible + exposes per-block totals', () => {
    const s = src();
    expect(s).toContain('totalPartnerPayouts,');
    expect(s).toContain('blocks: {');
    expect(s).toMatch(/rentals: blockRentals,\s*\n\s*equipment: blockEquipment,\s*\n\s*service: blockService,\s*\n\s*sales: blockSales,/);
  });

  it('«Выдал»/«Принял» resolve via ONE batched users query', () => {
    const s = src();
    expect(s).toContain('for (const key of ["issued_by", "received_by"] as const)');
    expect(s).toMatch(/from\("users"\)\s*\n\s*\.select\("user_id, full_name, username"\)\s*\n\s*\.in\("user_id", Array\.from\(userIds\)\)/);
  });

  it('cancelled rentals are still excluded at the query level (iter27 guard)', () => {
    expect(src()).toContain('.neq("status", "cancelled")');
  });
});

// ─── 3. Table view modal: block rendering + per-block tiles ──────────────────

describe('iter52: ExportCsvModal block rendering', () => {
  const src = () =>
    read('app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx');

  it('parses sections and renders one titled table per block', () => {
    const s = src();
    expect(s).toContain('parseCsvSections(rows)');
    expect(s).toContain('<SectionTable');
    expect(s).toContain('SECTION_COLS[section.key]');
  });

  it('totals card shows per-block revenue tiles + combined operator ЗП', () => {
    const s = src();
    expect(s).toContain('label="Σ Аренды"');
    expect(s).toContain('label="Σ Экип"');
    expect(s).toContain('label="Σ Сервис"');
    expect(s).toContain('label="Σ Продажи"');
    expect(s).toContain('label="Σ ЗП (аренда + продажа)"');
    // ЗП tile sums rentals + sales salary columns only
    expect(s).toContain('sumCell(rentSec, 1)');
    expect(s).toContain('sumCell(salesSec, 1)');
  });

  it('iter53: Σ Экип tile reads the real accounting Σ from СВОДКА (row-sum fallback)', () => {
    const s = src();
    // ЭКИП rows carry справочные prices now — the tile must NOT sum them
    expect(s).toContain('summaryRowValue("Экип", 2) ?? sumCell(equipSec, 2)');
    expect(s).toContain('const summaryRowValue');
  });

  it('search hides block totals (sums would mismatch) and empty blocks', () => {
    const s = src();
    expect(s).toContain('totals: null');
    expect(s).toMatch(/\.filter\(\(s\) => s\.data\.length > 0\)/);
  });

  it('tap-through survives: АРЕНДЫ rows open the rental page via hidden ID col', () => {
    const s = src();
    expect(s).toContain('onOpenRental(rowRentalId)');
    expect(s).toContain('router.push(`/franchize/${slug}/rental/${rentalId}`)');
    // legacy fallback keeps the flat-grid path for sales variant / old files
    expect(s).toContain('const RENTALS_HIDE_COLS = new Set([7, 20])');
  });
});

// ─── 4. Telegram send: per-block caption + XLSX styling ──────────────────────

describe('iter52: analytics-csv-send block caption', () => {
  const src = () => read('app/franchize/server-actions/analytics-csv-send.ts');

  it('caption reports аренды / экип / сервис / продажи separately', () => {
    const s = src();
    expect(s).toContain('🛵 Аренды: ${b.rentals.count}');
    expect(s).toContain('🧤 Экип: ${b.equipment.count}');
    expect(s).toContain('🛠 Сервис: ${b.service.count}');
    expect(s).toContain('🏷 Продажи: ${b.sales.count}');
    expect(s).toContain('Σ Выручка: ${rub(s.totalRevenue)}');
  });

  it('XLSX conversion styles block banners + Итого/ВСЕГО rows', () => {
    const s = src();
    expect(s).toContain('/^(АРЕНДЫ|ЭКИП|СЕРВИС|ПРОДАЖИ|СВОДКА)/');
    expect(s).toContain('/^(Итого|ВСЕГО)/');
    expect(s).toContain('styled(rowIndex, "banner")');
    expect(s).toContain('styled(rowIndex, "totals")');
  });
});

// ─── 5. iter52b: 403 fix — export routes resolve crew id before auth ────────

describe('iter52b: CSV export routes pass crew id to verifyCrewAccess', () => {
  const rentalsRoute = () => read('app/api/franchize/rentals-csv-export/route.ts');
  const salesRoute = () => read('app/api/franchize/sales-csv-export/route.ts');

  it('rentals-csv-export resolves slug → crew.id and passes it to auth', () => {
    const s = rentalsRoute();
    // crew id resolved from the slug BEFORE the auth call…
    expect(s).toContain('.from("crews")');
    expect(s).toContain('.eq("slug", slug)');
    // …and handed to verifyCrewAccess (member/owner paths need it)
    expect(s).toContain('verifyCrewAccess(request, crew.id)');
    // missing crew → explicit 404, not a silent 500
    expect(s).toContain('"Crew not found"');
    // supabaseAdmin imported for the lookup
    expect(s).toContain('import { supabaseAdmin } from "@/lib/supabase-server"');
  });

  it('sales-csv-export has the same fix (sibling route, same failure mode)', () => {
    const s = salesRoute();
    expect(s).toContain('.eq("slug", slug)');
    expect(s).toContain('verifyCrewAccess(request, crew.id)');
  });

  it('auth helper only denies with 403 AFTER the crew-scoped checks ran', () => {
    // Guard the root contract: verifyUserIdAccess must reach the crew_members
    // check when crewId is provided — the routes above rely on it.
    const s = read('app/api/franchize/_auth.ts');
    expect(s).toContain("from(\"crew_members\")");
    expect(s).toContain('.eq("membership_status", "active")');
    expect(s).toContain("crew?.owner_id === userId");
  });
});
