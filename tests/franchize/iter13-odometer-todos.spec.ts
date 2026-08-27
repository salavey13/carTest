import { describe, expect, it } from 'vitest';

// ── iter13: odometer visibility + /doc suggestion + rental-scoped todo dedup ──
// We can't import doc-manual.ts / crew-todos.ts directly (server-only transitive
// deps), so — like doc-manual-steps.spec.ts — the decision logic is replicated
// here 1:1. If the source logic changes, these tests must change with it.

// ── A. getLastKnownOdometerForBike — resolution priority chain ──────────────

// Guard mirroring the source: Number(null) === 0 — a JSON null / empty string
// must NOT be accepted as a "0 km" reading.
function asValidKm(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 999999) return null;
  return Math.round(n);
}

function resolveOdometer(
  specs: Record<string, unknown> | null,
  recentRentals: Array<Record<string, any>>,
): number | null {
  // 1. Canonical source: bike specs
  const fromSpecs = asValidKm((specs || {})?.last_known_odometer ?? (specs || {})?.odometer);
  if (fromSpecs != null) return fromSpecs;
  // 2. Fallback: scan the latest rentals (newest first)
  for (const row of recentRentals) {
    const md = row?.metadata || {};
    const candidates = [md.odometer_after, md.pickup_freeze?.odometer_km, md.odometer_before];
    for (const c of candidates) {
      const n = asValidKm(c);
      if (n != null) return n;
    }
  }
  return null;
}

describe('iter13 — /doc odometer suggestion (getLastKnownOdometerForBike)', () => {
  it('prefers specs.last_known_odometer (canonical, maintained at closure)', () => {
    expect(resolveOdometer({ last_known_odometer: 2465, odometer: 999 }, [])).toBe(2465);
  });

  it('falls back to specs.odometer when last_known_odometer is absent', () => {
    expect(resolveOdometer({ odometer: 405 }, [])).toBe(405);
  });

  it('falls back to the newest rental reading when specs have nothing', () => {
    const rentals = [
      { metadata: { pickup_freeze: { odometer_km: 39676 } } }, // newest
      { metadata: { odometer_before: 100 } },                    // older
    ];
    expect(resolveOdometer({}, rentals)).toBe(39676);
  });

  it('prefers odometer_after over freeze/before within the same rental', () => {
    const rentals = [
      { metadata: { odometer_after: 40212, pickup_freeze: { odometer_km: 39676 }, odometer_before: 39676 } },
    ];
    expect(resolveOdometer({}, rentals)).toBe(40212);
  });

  it('rejects garbage spec values (negative / too large / non-numeric) and uses rentals', () => {
    expect(resolveOdometer({ last_known_odometer: -5 }, [{ metadata: { odometer_after: 10 } }])).toBe(10);
    expect(resolveOdometer({ last_known_odometer: 1000000 }, [{ metadata: { odometer_after: 10 } }])).toBe(10);
    expect(resolveOdometer({ last_known_odometer: 'abc' }, [{ metadata: { odometer_after: 10 } }])).toBe(10);
  });

  it('returns null when nothing usable exists (null is NOT a 0 km reading)', () => {
    expect(resolveOdometer(null, [{ metadata: {} }, { metadata: { odometer_after: null } }])).toBeNull();
    expect(resolveOdometer({ last_known_odometer: null, odometer: null }, [])).toBeNull();
    expect(resolveOdometer({ last_known_odometer: '' }, [])).toBeNull();
  });

  it('accepts a genuine zero reading from a numeric value', () => {
    expect(resolveOdometer({ last_known_odometer: 0 }, [])).toBe(0);
  });

  it('suggestion keyboard button carries the raw integer in callback_data', () => {
    const suggestion = 39676;
    const keyboard = [[{ text: `🔢 ${suggestion.toLocaleString('ru-RU')} км (последнее известное)`, callback_data: `odo_use_${suggestion}` }]];
    expect(keyboard[0][0].callback_data).toBe('odo_use_39676');
    // ru-RU thousands separator is a no-break space (U+00A0) — normalize
    // before comparing with a literal string.
    expect(keyboard[0][0].text.replace(/\u00A0/g, ' ')).toContain('39 676');
  });
});

// ── B. odo_use_ callback parsing (handleDocCallback) ─────────────────────────

function parseOdoUseCallback(callbackData: string, state: string): { accept: boolean; value?: number } {
  if (!callbackData.startsWith('odo_use_')) return { accept: false };
  if (state !== 'odometer') return { accept: false }; // stale button guard
  const value = parseInt(callbackData.replace('odo_use_', ''), 10);
  if (!Number.isFinite(value) || value < 0 || value > 999999) return { accept: true, value: NaN };
  return { accept: true, value };
}

describe('iter13 — odo_use_ callback handler', () => {
  it('accepts a valid value in odometer state', () => {
    expect(parseOdoUseCallback('odo_use_39676', 'odometer')).toEqual({ accept: true, value: 39676 });
  });

  it('rejects stale buttons from other steps', () => {
    expect(parseOdoUseCallback('odo_use_39676', 'payment_cash').accept).toBe(false);
    expect(parseOdoUseCallback('odo_use_39676', 'confirm').accept).toBe(false);
  });

  it('flags out-of-range and garbage values as invalid', () => {
    expect(parseOdoUseCallback('odo_use_-5', 'odometer')).toEqual({ accept: true, value: NaN });
    expect(parseOdoUseCallback('odo_use_1000000', 'odometer')).toEqual({ accept: true, value: NaN });
    expect(parseOdoUseCallback('odo_use_abc', 'odometer')).toEqual({ accept: true, value: NaN });
  });

  it('ignores unrelated callbacks', () => {
    expect(parseOdoUseCallback('eq_done', 'odometer').accept).toBe(false);
    expect(parseOdoUseCallback('restart', 'odometer').accept).toBe(false);
  });
});

// ── C. createLeadFollowupTodos — rental-scoped dedup (root-cause fix) ────────

interface ExistingTodo { title: string; rental_id: string | null; }

function dedupFilter(
  todos: Array<{ title: string }>,
  existingTodos: ExistingTodo[],
  effectiveRentalId: string | null,
): Array<{ title: string }> {
  // Mirrors the fixed query: when rentalId is present the existing-todos set
  // is scoped to that rental; otherwise the legacy lead-scoped set is used.
  const scoped = effectiveRentalId
    ? existingTodos.filter((t) => t.rental_id === effectiveRentalId)
    : existingTodos;
  const existingTitles = new Set(scoped.map((t) => t.title));
  return todos.filter((t) => !existingTitles.has(t.title));
}

describe('iter13 — createLeadFollowupTodos rental-scoped dedup', () => {
  const newRentalTodos = [
    { title: '🔧 Проверить ТС при возврате: BMW F800R (27.08.2026 18:30)' },
    { title: '🔑 Принять ключи от BMW F800R' },
    { title: '📄 Проверить документы при возврате BMW F800R' },
    { title: '🔍 Осмотр на повреждения: BMW F800R' },
    { title: '📸 Сфотографировать байк при возврате: BMW F800R' },
    { title: '📊 Зафиксировать одометр при возврате: BMW F800R (при выдаче: 39 676 км)' },
    { title: '🪖 Принять 1 шлем(а/ов)' },
    { title: '🧤 Принять 1 перчатки' },
  ];

  it('stale pending todos from ANOTHER rental do not swallow the new checklist (live bug 31229193)', () => {
    const staleOldRental: ExistingTodo[] = [
      { title: '🔑 Принять ключи от BMW F800R', rental_id: 'c14e9f79-old' },
      { title: '📄 Проверить документы при возврате BMW F800R', rental_id: 'c14e9f79-old' },
      { title: '🔍 Осмотр на повреждения: BMW F800R', rental_id: 'c14e9f79-old' },
      { title: '📸 Сфотографировать байк при возврате: BMW F800R', rental_id: 'c14e9f79-old' },
      { title: '🪖 Принять 1 шлем(а/ов)', rental_id: 'd6187779-old' },
      { title: '🧤 Принять 1 перчатки', rental_id: 'd6187779-old' },
    ];
    const kept = dedupFilter(newRentalTodos, staleOldRental, '31229193-new');
    // THE BUG: legacy lead-scoped dedup kept only the dated title (1 of 8).
    // The rental-scoped fix keeps everything.
    expect(kept).toHaveLength(8);
  });

  it('retry idempotency preserved: same rental + same titles are skipped', () => {
    const same = newRentalTodos.map((t) => ({ ...t, rental_id: '31229193-new' })) as ExistingTodo[];
    expect(dedupFilter(newRentalTodos, same, '31229193-new')).toHaveLength(0);
  });

  it('no rentalId → legacy lead-scoped dedup behavior unchanged', () => {
    const existing: ExistingTodo[] = [{ title: '🔑 Принять ключи от BMW F800R', rental_id: null }];
    const kept = dedupFilter(newRentalTodos, existing, null);
    expect(kept).toHaveLength(newRentalTodos.length - 1);
    expect(kept.map((t) => t.title)).not.toContain('🔑 Принять ключи от BMW F800R');
  });
});

// ── D. /doc rent todo list — completeness (keys/docs/damage/photo/odometer/eq) ─

describe('iter13 — /doc rent todo list completeness', () => {
  function buildRentTodos(bike: { make: string; model: string }, context: Record<string, any>) {
    const todos: Array<{ title: string; priority: 'low' | 'medium' | 'high' }> = [
      { title: `🔧 Проверить ТС при возврате: ${bike.make} ${bike.model} (${context.rentEndDate} ${context.rentEndTime})`, priority: 'high' },
      { title: `🔑 Принять ключи от ${bike.make} ${bike.model}`, priority: 'high' },
      { title: `📄 Проверить документы при возврате ${bike.make} ${bike.model}`, priority: 'medium' },
      { title: `🔍 Осмотр на повреждения: ${bike.make} ${bike.model}`, priority: 'high' },
      { title: `📸 Сфотографировать байк при возврате: ${bike.make} ${bike.model}`, priority: 'high' },
      {
        title: `📊 Зафиксировать одометр при возврате: ${bike.make} ${bike.model}${context.odometerBefore ? ` (при выдаче: ${context.odometerBefore.toLocaleString('ru-RU')} км)` : ''}`,
        priority: 'high',
      },
    ];
    if ((context.helmets || 0) > 0) todos.push({ title: `🪖 Принять ${context.helmets} шлем(а/ов)`, priority: 'medium' });
    if ((context.gloves || 0) > 0) todos.push({ title: `🧤 Принять ${context.gloves} перчатки`, priority: 'low' });
    return todos;
  }

  it('helmet + gloves rental produces equipment todos AND odometer AND photo todos', () => {
    const todos = buildRentTodos(
      { make: 'BMW', model: 'F800R' },
      { rentEndDate: '27.08.2026', rentEndTime: '18:30', helmets: 1, gloves: 1, odometerBefore: 39676 },
    );
    // ru-RU NBSP thousands separator → normalize
    const titlesNorm = todos.map((t) => t.title).join('\n').replace(/\u00A0/g, ' ');
    expect(titlesNorm).toContain('🔑 Принять ключи');           // getting back keys
    expect(titlesNorm).toContain('📄 Проверить документы');      // getting back docs
    expect(titlesNorm).toContain('🔍 Осмотр на повреждения');    // damage inspection
    expect(titlesNorm).toContain('📸 Сфотографировать байк');    // photos after
    expect(titlesNorm).toContain('📊 Зафиксировать одометр');    // odometer checking
    expect(titlesNorm).toContain('39 676 км');                   // handover value embedded
    expect(titlesNorm).toContain('🪖 Принять 1 шлем(а/ов)');     // helmet
    expect(titlesNorm).toContain('🧤 Принять 1 перчатки');       // gloves
    expect(todos).toHaveLength(8);
  });

  it('no equipment → base 6 todos, odometer title without handover hint', () => {
    const todos = buildRentTodos(
      { make: 'Ducati', model: 'Panigale' },
      { rentEndDate: '24.08.2026', rentEndTime: '20:00', helmets: 0, gloves: 0, odometerBefore: 0 },
    );
    expect(todos).toHaveLength(6);
    expect(todos.map((t) => t.title).join('\n')).not.toContain('шлем');
  });
});

// ── E. RentalOdometerDelta — visibility rules ────────────────────────────────

function odometerCardVisibility(before: number | null, after: number | null): 'none' | 'before-only' | 'delta' | 'rollback' {
  const b = typeof before === 'number' ? before : null;
  const a = typeof after === 'number' ? after : null;
  if (b == null) return 'none';
  if (a == null) return 'before-only'; // NEW iter13: active rentals show the handover value
  if (a < b) return 'rollback';
  return 'delta';
}

describe('iter13 — RentalOdometerDelta visibility', () => {
  it('active rental (before only) renders the handover card instead of nothing', () => {
    expect(odometerCardVisibility(39676, null)).toBe('before-only');
  });

  it('unknown start reading renders nothing', () => {
    expect(odometerCardVisibility(null, null)).toBe('none');
    expect(odometerCardVisibility(null, 40100)).toBe('none');
  });

  it('both readings produce the delta card; rollback produces the warning', () => {
    expect(odometerCardVisibility(39676, 40212)).toBe('delta');
    expect(odometerCardVisibility(39676, 39000)).toBe('rollback');
  });
});
