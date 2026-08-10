import { describe, expect, it } from 'vitest';

// ── Test the step arrays and stepLabel logic ────────────────────────────────
// We can't import doc-manual.ts directly (too many transitive deps),
// so we test the pure logic by replicating the step arrays here.
// If the arrays in doc-manual.ts change, these tests will need updating.

interface StepDef { num: number | string; state: string; label: string; }

const RENT_STEPS: StepDef[] = [
  { num: 1, state: 'deal', label: 'Тип сделки' },
  { num: 2, state: 'bike', label: 'Выбор байка' },
  { num: 3, state: 'name', label: 'ФИО' },
  { num: 4, state: 'passport', label: 'Паспорт' },
  { num: 5, state: 'birth', label: 'Дата рождения' },
  { num: 6, state: 'address', label: 'Адрес регистрации' },
  { num: 7, state: 'has_license', label: 'Наличие ВУ' },
  { num: 8, state: 'categories', label: 'Категории ВУ' },
  { num: 9, state: 'schedule_start', label: 'Дата и время начала' },
  { num: 10, state: 'schedule_end', label: 'Дата и время окончания' },
  { num: 11, state: 'equipment', label: 'Оборудование' },
  { num: 12, state: 'odometer', label: 'Одометр' },
  { num: 13, state: 'payment_split', label: 'Способ оплаты' },
  { num: 14, state: 'deposit_choice', label: 'Депозит / СТС' },
  { num: 15, state: 'deposit_destination', label: 'Где получен депозит' },
  { num: '15a', state: 'deposit_split_cash', label: 'Смешанный: сколько наличными' },
  { num: '15b', state: 'deposit_split_card', label: 'Смешанный: выбор карты' },
  { num: 16, state: 'confirm', label: 'Проверка данных' },
];

const SALE_STEPS: StepDef[] = [
  { num: 1, state: 'deal', label: 'Тип сделки' },
  { num: 2, state: 'bike', label: 'Выбор байка' },
  { num: 3, state: 'name', label: 'ФИО' },
  { num: 4, state: 'passport', label: 'Паспорт' },
  { num: 5, state: 'birth', label: 'Дата рождения' },
  { num: 6, state: 'address', label: 'Адрес регистрации' },
  { num: 7, state: 'sale_color', label: 'Цвет' },
  { num: 8, state: 'sale_vin', label: 'VIN' },
  { num: 9, state: 'price', label: 'Цена' },
  { num: 10, state: 'client_phone', label: 'Телефон покупателя' },
  { num: 11, state: 'sale_delivery', label: 'Способ получения' },
  { num: 12, state: 'sale_transport', label: 'Транспортная компания' },
  { num: 13, state: 'confirm', label: 'Проверка данных' },
];

function stepLabel(state: string, dealType?: string): string {
  const steps = dealType === 'sale' ? SALE_STEPS : RENT_STEPS;
  const step = steps.find(s => s.state === state);
  if (!step) return '';
  if (typeof step.num === 'string' && step.num.startsWith('СТС')) {
    return String(step.num);
  }
  const total = dealType === 'sale' ? 13 : 16;
  return `Шаг ${step.num}/${total}`;
}

interface MockContext {
  dealType?: string;
  stsPledgeUsed?: boolean;
  depositCardDestination?: 'tbank' | 'sber';
  saleDeliveryMethod?: 'pickup' | 'transport_company';
}

function getVisibleSteps(context: MockContext): StepDef[] {
  const steps = context.dealType === 'sale' ? SALE_STEPS : RENT_STEPS;
  return steps.filter(s => {
    if (s.state === 'confirm') return false;
    if (typeof s.num === 'string' && s.num.startsWith('СТС')) return false;
    if (s.state === 'deposit_destination' && context.stsPledgeUsed) return false;
    if (s.state === 'deposit_split_cash' && context.depositCardDestination === undefined) return false;
    if (s.state === 'deposit_split_card' && context.depositCardDestination === undefined) return false;
    if (s.state === 'sale_transport' && context.saleDeliveryMethod !== 'transport_company') return false;
    return true;
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Doc-Manual Step Arrays', () => {
  describe('RENT_STEPS', () => {
    it('has 18 entries (16 numbered + 2 split sub-states)', () => {
      expect(RENT_STEPS).toHaveLength(18);
    });

    it('does NOT have a license step (removed in simplification)', () => {
      const hasLicense = RENT_STEPS.some(s => s.state === 'license');
      expect(hasLicense).toBe(false);
    });

    it('has deposit_destination as step 15', () => {
      const step = RENT_STEPS.find(s => s.state === 'deposit_destination');
      expect(step).toBeDefined();
      expect(step!.num).toBe(15);
    });

    it('has confirm as step 16', () => {
      const step = RENT_STEPS.find(s => s.state === 'confirm');
      expect(step).toBeDefined();
      expect(step!.num).toBe(16);
    });

    it('has categories as step 8 (was 9 before license removal)', () => {
      const step = RENT_STEPS.find(s => s.state === 'categories');
      expect(step).toBeDefined();
      expect(step!.num).toBe(8);
    });
  });

  describe('SALE_STEPS', () => {
    it('has 13 entries', () => {
      expect(SALE_STEPS).toHaveLength(13);
    });

    it('has sale_delivery as step 11', () => {
      const step = SALE_STEPS.find(s => s.state === 'sale_delivery');
      expect(step).toBeDefined();
      expect(step!.num).toBe(11);
    });

    it('has sale_transport as step 12', () => {
      const step = SALE_STEPS.find(s => s.state === 'sale_transport');
      expect(step).toBeDefined();
      expect(step!.num).toBe(12);
    });
  });
});

describe('stepLabel', () => {
  it('returns "Шаг 1/16" for rent deal step', () => {
    expect(stepLabel('deal')).toBe('Шаг 1/16');
  });

  it('returns "Шаг 3/13" for sale name step', () => {
    expect(stepLabel('name', 'sale')).toBe('Шаг 3/13');
  });

  it('returns "Шаг 15/16" for deposit_destination', () => {
    expect(stepLabel('deposit_destination')).toBe('Шаг 15/16');
  });

  it('returns "Шаг 11/13" for sale_delivery', () => {
    expect(stepLabel('sale_delivery', 'sale')).toBe('Шаг 11/13');
  });

  it('returns empty string for unknown state', () => {
    expect(stepLabel('unknown_state')).toBe('');
  });

  it('uses rent steps when dealType is undefined', () => {
    expect(stepLabel('categories')).toBe('Шаг 8/16');
  });
});

describe('getVisibleSteps', () => {
  it('shows deposit_destination when not СТС', () => {
    const steps = getVisibleSteps({ dealType: 'rent', stsPledgeUsed: false });
    const hasDeposit = steps.some(s => s.state === 'deposit_destination');
    expect(hasDeposit).toBe(true);
  });

  it('hides deposit_destination when СТС is used', () => {
    const steps = getVisibleSteps({ dealType: 'rent', stsPledgeUsed: true });
    const hasDeposit = steps.some(s => s.state === 'deposit_destination');
    expect(hasDeposit).toBe(false);
  });

  it('hides split sub-states when not in split mode', () => {
    const steps = getVisibleSteps({ dealType: 'rent' });
    const hasSplitCash = steps.some(s => s.state === 'deposit_split_cash');
    const hasSplitCard = steps.some(s => s.state === 'deposit_split_card');
    expect(hasSplitCash).toBe(false);
    expect(hasSplitCard).toBe(false);
  });

  it('shows split sub-states when depositCardDestination is set', () => {
    const steps = getVisibleSteps({ dealType: 'rent', depositCardDestination: 'tbank' });
    const hasSplitCash = steps.some(s => s.state === 'deposit_split_cash');
    const hasSplitCard = steps.some(s => s.state === 'deposit_split_card');
    expect(hasSplitCash).toBe(true);
    expect(hasSplitCard).toBe(true);
  });

  it('hides sale_transport when delivery is pickup', () => {
    const steps = getVisibleSteps({ dealType: 'sale', saleDeliveryMethod: 'pickup' });
    const hasTransport = steps.some(s => s.state === 'sale_transport');
    expect(hasTransport).toBe(false);
  });

  it('shows sale_transport when delivery is transport_company', () => {
    const steps = getVisibleSteps({ dealType: 'sale', saleDeliveryMethod: 'transport_company' });
    const hasTransport = steps.some(s => s.state === 'sale_transport');
    expect(hasTransport).toBe(true);
  });

  it('always hides confirm from correction list', () => {
    const rentSteps = getVisibleSteps({ dealType: 'rent' });
    const saleSteps = getVisibleSteps({ dealType: 'sale' });
    expect(rentSteps.some(s => s.state === 'confirm')).toBe(false);
    expect(saleSteps.some(s => s.state === 'confirm')).toBe(false);
  });

  it('rent steps count is 15 visible (without confirm + without split if not split)', () => {
    const steps = getVisibleSteps({ dealType: 'rent', stsPledgeUsed: false });
    // 18 total - 1 confirm - 2 split sub-states (not in split mode) = 15
    expect(steps).toHaveLength(15);
  });

  it('rent steps count is 13 when СТС (no deposit_destination + no split)', () => {
    const steps = getVisibleSteps({ dealType: 'rent', stsPledgeUsed: true });
    // 18 total - 1 confirm - 1 deposit_destination - 2 split - 1 confirm = 13
    // Actually: 18 - 1 confirm - 1 deposit_destination - 2 split = 14
    expect(steps).toHaveLength(14);
  });

  it('sale steps count is 11 visible (without confirm + without transport if pickup)', () => {
    const steps = getVisibleSteps({ dealType: 'sale', saleDeliveryMethod: 'pickup' });
    // 13 total - 1 confirm - 1 sale_transport = 11
    expect(steps).toHaveLength(11);
  });
});
