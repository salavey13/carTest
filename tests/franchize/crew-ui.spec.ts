// tests/franchize/crew-ui.spec.ts
// Task 34: per-crew rail config from metadata.franchize.ui (crew specs jsonb).
// The lib must never throw on hostile SQL-authored payloads and must keep
// crews WITHOUT overrides pixel-identical to the classic rail.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildFranchizeCrewUi,
  DEFAULT_TAB_LABELS,
  FRANCHIZE_TAB_KEYS,
  resolveCrewTabLabels,
  type FranchizeTabKey,
} from '@/app/franchize/lib/crew-ui';

describe('buildFranchizeCrewUi — sanitization', () => {
  it('returns undefined for absent/hostile payloads', () => {
    expect(buildFranchizeCrewUi(null)).toBeUndefined();
    expect(buildFranchizeCrewUi(undefined)).toBeUndefined();
    expect(buildFranchizeCrewUi('ui')).toBeUndefined();
    expect(buildFranchizeCrewUi(42)).toBeUndefined();
    expect(buildFranchizeCrewUi([])).toBeUndefined();
    expect(buildFranchizeCrewUi({})).toBeUndefined(); // nothing usable inside
  });

  it('passes through boolean showCreateButton only', () => {
    expect(buildFranchizeCrewUi({ showCreateButton: false })).toEqual({ showCreateButton: false });
    expect(buildFranchizeCrewUi({ showCreateButton: true })).toEqual({ showCreateButton: true });
    // "false" as a string is a typo in SQL — must NOT enable the flag semantics
    expect(buildFranchizeCrewUi({ showCreateButton: 'false' })).toBeUndefined();
    expect(buildFranchizeCrewUi({ showCreateButton: 0 })).toBeUndefined();
  });

  it('keeps only known tab keys, trims, caps length at 24', () => {
    const ui = buildFranchizeCrewUi({
      tabLabels: {
        rent: '  Заявки  ',
        sale: 'Котировки',
        unknownKey: 'hack',
        service: 123,
        equipment: 'x'.repeat(100),
      },
    });
    expect(ui?.tabLabels).toEqual({
      rent: 'Заявки',
      sale: 'Котировки',
      equipment: 'x'.repeat(24),
    });
  });

  it('drops whitespace-only labels and empty label maps', () => {
    expect(buildFranchizeCrewUi({ tabLabels: { rent: '   ' } })).toBeUndefined();
    expect(buildFranchizeCrewUi({ tabLabels: 'Заявки' })).toBeUndefined(); // not an object
  });

  it('sanitizes hiddenTabs: known keys only, deduped, ordered, never ALL', () => {
    const ui = buildFranchizeCrewUi({ hiddenTabs: ['parts', 'equipment', 'parts', 'nonsense', 42] });
    expect(ui?.hiddenTabs).toEqual(['equipment', 'parts']);

    // hiding every pill would render an empty rail — refuse
    expect(
      buildFranchizeCrewUi({ hiddenTabs: [...FRANCHIZE_TAB_KEYS] }),
    ).toBeUndefined();

    expect(buildFranchizeCrewUi({ hiddenTabs: 'parts' })).toBeUndefined(); // not an array
  });

  it('combines all fields and stays undefined when nothing survived', () => {
    const ui = buildFranchizeCrewUi({
      showCreateButton: false,
      tabLabels: { rent: 'Заявки' },
      hiddenTabs: ['equipment'],
    });
    expect(ui).toEqual({
      showCreateButton: false,
      tabLabels: { rent: 'Заявки' },
      hiddenTabs: ['equipment'],
    });
  });
});

describe('resolveCrewTabLabels', () => {
  it('returns the classic rail labels for crews without overrides', () => {
    expect(resolveCrewTabLabels(null)).toEqual(DEFAULT_TAB_LABELS);
    expect(resolveCrewTabLabels(undefined)).toEqual(DEFAULT_TAB_LABELS);
    expect(resolveCrewTabLabels({})).toEqual(DEFAULT_TAB_LABELS);
    expect(DEFAULT_TAB_LABELS.rent).toBe('Аренда');
  });

  it('partial override wins only for the provided keys', () => {
    const labels = resolveCrewTabLabels({ tabLabels: { rent: 'Заявки' } });
    expect(labels.rent).toBe('Заявки');
    expect(labels.sale).toBe(DEFAULT_TAB_LABELS.sale);
    expect(labels.parts).toBe(DEFAULT_TAB_LABELS.parts);
  });
});

// ── Wiring (source assertions, iter-style): the SQL → VM → UI chain must stay
// connected, otherwise the traversa hydration SQL silently stops working.
const crewHeaderSrc = readFileSync('app/franchize/components/CrewHeader.tsx', 'utf8');
const actionsRuntimeSrc = readFileSync('app/franchize/actions-runtime.ts', 'utf8');
const actionsSrc = readFileSync('app/franchize/actions.ts', 'utf8');
const profileButtonSrc = readFileSync('app/franchize/components/FranchizeProfileButton.tsx', 'utf8');

describe('crew-ui wiring', () => {
  it('VM declares ui?: FranchizeCrewUiVM and hydrates it in getFranchizeBySlug', () => {
    expect(actionsRuntimeSrc).toContain('ui?: FranchizeCrewUiVM;');
    expect(actionsRuntimeSrc).toContain('ui: buildFranchizeCrewUi(readPath<unknown>(franchize, ["ui"], null))');
  });

  it('actions.ts re-exports FranchizeCrewUiVM', () => {
    expect(actionsSrc).toContain('FranchizeCrewUiVM,');
  });

  it('CrewHeader resolves labels from crew.ui and applies hiddenTabs', () => {
    expect(crewHeaderSrc).toContain('resolveCrewTabLabels(crew.ui)');
    expect(crewHeaderSrc).toContain('label: tabLabels.rent');
    expect(crewHeaderSrc).toContain('.filter((pill) => !hiddenTabs.has(pill.key))');
    // no hardcoded rail labels left in the component
    expect(crewHeaderSrc).not.toContain('label: "Аренда"');
  });

  it('CrewHeader still feeds crew.ui into FranchizeProfileButton (showCreateButton lives again)', () => {
    expect(crewHeaderSrc).toContain('crewUi={crew.ui ?? null}');
    expect(profileButtonSrc).toContain('crewUi?.showCreateButton !== false');
  });

  it('label cap matches the documented 24-char pill budget', () => {
    const lib = readFileSync('app/franchize/lib/crew-ui.ts', 'utf8');
    expect(lib).toContain('MAX_LABEL_LENGTH = 24');
  });

  it('rail keys and lib keys stay in sync', () => {
    const keys: FranchizeTabKey[] = ['rent', 'sale', 'service', 'equipment', 'parts'];
    expect(FRANCHIZE_TAB_KEYS).toEqual(keys);
  });
});
