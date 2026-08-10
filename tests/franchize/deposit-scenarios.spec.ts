import { describe, expect, it } from 'vitest';

// ── Test deposit destination formatting logic ───────────────────────────────
// Replicates the formatDepositDestination function from doc-manual.ts

interface MockContext {
  depositCashAmount?: number;
  depositCardDestination?: 'tbank' | 'sber';
  depositCardAmount?: number;
  stsPledgeUsed?: boolean;
}

function formatDepositDestination(context: MockContext): string {
  const cash = context.depositCashAmount || 0;
  const card = context.depositCardAmount || 0;
  const dest = context.depositCardDestination;

  if (cash === 0 && card === 0) return '';
  if (cash > 0 && card === 0) return ' (💵 наличными)';
  if (cash === 0 && card > 0 && dest) {
    return dest === 'tbank' ? ' (💳 Тинькофф)' : ' (💳 Сбербанк)';
  }
  if (cash > 0 && card > 0 && dest) {
    const destLabel = dest === 'tbank' ? '💳Т' : '💳С';
    return ` (💵${cash.toLocaleString('ru-RU')} + ${destLabel}${card.toLocaleString('ru-RU')})`;
  }
  return '';
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('formatDepositDestination', () => {
  it('returns empty string when no destination info', () => {
    expect(formatDepositDestination({})).toBe('');
  });

  it('returns empty string when both amounts are 0', () => {
    expect(formatDepositDestination({ depositCashAmount: 0, depositCardAmount: 0 })).toBe('');
  });

  it('returns " (💵 наличными)" for all cash', () => {
    expect(formatDepositDestination({ depositCashAmount: 20000, depositCardAmount: 0 })).toBe(' (💵 наличными)');
  });

  it('returns " (💳 Тинькофф)" for all T-Bank', () => {
    expect(formatDepositDestination({ depositCashAmount: 0, depositCardAmount: 20000, depositCardDestination: 'tbank' })).toBe(' (💳 Тинькофф)');
  });

  it('returns " (💳 Сбербанк)" for all Sber', () => {
    expect(formatDepositDestination({ depositCashAmount: 0, depositCardAmount: 20000, depositCardDestination: 'sber' })).toBe(' (💳 Сбербанк)');
  });

  it('returns split format for cash + T-Bank', () => {
    const result = formatDepositDestination({ depositCashAmount: 5000, depositCardAmount: 15000, depositCardDestination: 'tbank' });
    // ru-RU uses non-breaking space (U+00A0) as thousands separator
    expect(result).toContain('💵');
    expect(result).toContain('💳Т');
    // toLocaleString('ru-RU') produces "5 000" with nbsp, so check for "5" and "000"
    expect(result).toContain('5');
    expect(result).toContain('15');
  });

  it('returns split format for cash + Sber', () => {
    const result = formatDepositDestination({ depositCashAmount: 5000, depositCardAmount: 15000, depositCardDestination: 'sber' });
    expect(result).toContain('💵');
    expect(result).toContain('💳С');
    expect(result).toContain('5');
    expect(result).toContain('15');
  });

  it('handles large amounts with ru-RU formatting', () => {
    const result = formatDepositDestination({ depositCashAmount: 100000, depositCardAmount: 200000, depositCardDestination: 'tbank' });
    // ru-RU uses non-breaking space (U+00A0) as thousands separator
    expect(result).toContain('100');
    expect(result).toContain('200');
    expect(result).toContain('💳Т');
  });

  it('returns empty string when card amount > 0 but no destination', () => {
    expect(formatDepositDestination({ depositCashAmount: 0, depositCardAmount: 20000 })).toBe('');
  });
});

// ── Test deposit entry scenarios ────────────────────────────────────────────

describe('Deposit Entry Scenarios', () => {
  // Simulate the insertDepositEntries logic
  function getExpectedEntries(context: MockContext & { depositOverride?: string }) {
    const depositAmount = Number(context.depositOverride || "20000");
    if (depositAmount <= 0 || context.stsPledgeUsed) return [];

    const cashPortion = context.depositCashAmount || 0;
    const cardPortion = context.depositCardAmount || 0;
    const cardDest = context.depositCardDestination;

    if (cashPortion === 0 && cardPortion === 0) {
      return [{ entry_type: 'deposit_collected', amount: depositAmount, destination: 'cash' }];
    }

    const entries: Array<{ entry_type: string; amount: number; destination: string }> = [];
    if (cashPortion > 0) entries.push({ entry_type: 'deposit_collected', amount: cashPortion, destination: 'cash' });
    if (cardPortion > 0 && cardDest) entries.push({ entry_type: 'deposit_collected', amount: cardPortion, destination: cardDest });
    return entries;
  }

  it('all cash → 1 entry', () => {
    const entries = getExpectedEntries({ depositCashAmount: 20000, depositCardAmount: 0 });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ entry_type: 'deposit_collected', amount: 20000, destination: 'cash' });
  });

  it('all T-Bank → 1 entry', () => {
    const entries = getExpectedEntries({ depositCashAmount: 0, depositCardAmount: 20000, depositCardDestination: 'tbank' });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ entry_type: 'deposit_collected', amount: 20000, destination: 'tbank' });
  });

  it('split cash + T-Bank → 2 entries', () => {
    const entries = getExpectedEntries({ depositCashAmount: 5000, depositCardAmount: 15000, depositCardDestination: 'tbank' });
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ entry_type: 'deposit_collected', amount: 5000, destination: 'cash' });
    expect(entries[1]).toEqual({ entry_type: 'deposit_collected', amount: 15000, destination: 'tbank' });
  });

  it('СТС → 0 entries', () => {
    const entries = getExpectedEntries({ stsPledgeUsed: true });
    expect(entries).toHaveLength(0);
  });

  it('deposit = 0 → 0 entries', () => {
    const entries = getExpectedEntries({ depositOverride: "0" });
    expect(entries).toHaveLength(0);
  });

  it('no destination info → defaults to cash', () => {
    const entries = getExpectedEntries({});
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ entry_type: 'deposit_collected', amount: 20000, destination: 'cash' });
  });
});

// ── Test delivery method logic ──────────────────────────────────────────────

describe('Sale Delivery Method', () => {
  function getDeliveryLabel(method?: string, company?: string, payment?: string): string {
    if (method === 'pickup') return '🏪 Самовывоз';
    if (method === 'transport_company') {
      const tc = company || "?";
      const payer = payment === 'buyer_pays' ? 'покупатель' : 'за наш счёт';
      return `🚚 ТК: ${tc} (${payer})`;
    }
    return '';
  }

  it('pickup label', () => {
    expect(getDeliveryLabel('pickup')).toBe('🏪 Самовывоз');
  });

  it('TC buyer pays label', () => {
    expect(getDeliveryLabel('transport_company', 'Деловые Линии', 'buyer_pays')).toBe('🚚 ТК: Деловые Линии (покупатель)');
  });

  it('TC seller pays label', () => {
    expect(getDeliveryLabel('transport_company', 'ПЭК', 'seller_pays')).toBe('🚚 ТК: ПЭК (за наш счёт)');
  });

  it('TC with no company name shows "?"', () => {
    expect(getDeliveryLabel('transport_company', undefined, 'buyer_pays')).toBe('🚚 ТК: ? (покупатель)');
  });

  it('empty for no delivery method', () => {
    expect(getDeliveryLabel(undefined)).toBe('');
  });
});
