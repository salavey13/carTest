import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createInvoice: vi.fn(),
  from: vi.fn(),
  notifyAdmin: vi.fn(),
  sendTelegramDocument: vi.fn(),
  sendTelegramInvoice: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/lib/supabase-server', () => ({
  createInvoice: mocks.createInvoice,
  supabaseAdmin: {
    from: mocks.from,
  },
}));

vi.mock('@/app/actions', () => ({
  notifyAdmin: mocks.notifyAdmin,
  sendTelegramDocument: mocks.sendTelegramDocument,
  sendTelegramInvoice: mocks.sendTelegramInvoice,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: mocks.loggerError,
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/app/franchize/lib/docx-capability', () => ({
  buildFranchizeDocxFromTemplate: vi.fn(),
  uploadDocxToStorage: vi.fn(),
}));

vi.mock('@/lib/private-secrets', () => ({
  getCrewSensitiveDataOrDefault: vi.fn(),
  getUserSensitiveDataOrDefault: vi.fn(),
  getUserSensitiveData: vi.fn(),
  getCrewSensitiveData: vi.fn(),
  saveCrewSensitiveData: vi.fn(),
}));

import { validateFranchizePromoCode } from '@/app/franchize/server-actions/promotions';
import {
  CART_APPLIED_PROMO_KEY,
  clearCartAppliedPromo,
  computeCartPromoDiscount,
  loadCartAppliedPromo,
  saveCartAppliedPromo,
  type CartAppliedPromo,
  type CartPromoStorage,
} from '@/app/franchize/lib/cart-promo';

function memoryStorage(): CartPromoStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

function mockCrewMetadata(metadata: unknown) {
  // Supabase .maybeSingle() returns the whole ROW — the validator reads
  // crew.metadata, so the metadata object must be wrapped.
  mocks.from.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: { metadata }, error: null }),
      }),
    }),
  });
}

describe('cart-applied promo storage (lib/cart-promo)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('round-trips the applied promo for the same slug', () => {
    const storage = memoryStorage();
    const promo: CartAppliedPromo = {
      slug: 'vip-bike',
      code: 'PROMORIDE',
      title: 'PROMORIDE',
      description: '100% скидка — заказ 0 ₽',
      discountAmount: 12000,
      baseAmountAtApply: 12000,
    };

    saveCartAppliedPromo(storage, promo);

    expect(loadCartAppliedPromo(storage, 'vip-bike')).toEqual(promo);
  });

  it('ignores a promo stored for another crew slug', () => {
    const storage = memoryStorage();
    saveCartAppliedPromo(storage, {
      slug: 'other-crew',
      code: 'PROMORIDE',
      title: 'PROMORIDE',
      description: '',
      discountAmount: 5000,
      baseAmountAtApply: 5000,
    });

    expect(loadCartAppliedPromo(storage, 'vip-bike')).toBeNull();
  });

  it('drops corrupted payloads and zero discounts', () => {
    const storage = memoryStorage();
    storage.setItem(CART_APPLIED_PROMO_KEY, '{not-json');

    expect(loadCartAppliedPromo(storage, 'vip-bike')).toBeNull();

    storage.setItem(
      CART_APPLIED_PROMO_KEY,
      JSON.stringify({ slug: 'vip-bike', code: 'PROMORIDE', discountAmount: 0, baseAmountAtApply: 1000 }),
    );
    expect(loadCartAppliedPromo(storage, 'vip-bike')).toBeNull();
  });

  it('clear removes the stored promo', () => {
    const storage = memoryStorage();
    saveCartAppliedPromo(storage, {
      slug: 'vip-bike',
      code: 'PROMORIDE',
      title: 'PROMORIDE',
      description: '',
      discountAmount: 1000,
      baseAmountAtApply: 1000,
    });
    clearCartAppliedPromo(storage);

    expect(loadCartAppliedPromo(storage, 'vip-bike')).toBeNull();
  });
});

describe('computeCartPromoDiscount (live re-cap of the stored promo)', () => {
  const fullCover: CartAppliedPromo = {
    slug: 'vip-bike',
    code: 'PROMORIDE',
    title: 'PROMORIDE',
    description: '',
    discountAmount: 12000,
    baseAmountAtApply: 12000,
  };

  it('a 100% code keeps covering the whole order after it grows', () => {
    expect(computeCartPromoDiscount(fullCover, 24000)).toBe(24000);
    expect(computeCartPromoDiscount(fullCover, 3000)).toBe(3000);
  });

  it('a fixed-amount code stays capped by its validated amount', () => {
    const fixed: CartAppliedPromo = { ...fullCover, code: 'FIX500', discountAmount: 500, baseAmountAtApply: 12000 };
    expect(computeCartPromoDiscount(fixed, 12000)).toBe(500);
    expect(computeCartPromoDiscount(fixed, 300)).toBe(300);
  });

  it('returns 0 for an empty cart', () => {
    expect(computeCartPromoDiscount(fullCover, 0)).toBe(0);
  });
});

describe('built-in promo code PROMORIDE (100% — order costs 0 ₽)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('discounts the full base amount with an empty banner list', async () => {
    mockCrewMetadata({ franchize: { catalog: { promoBanners: [] } } });

    const result = await validateFranchizePromoCode({ slug: 'vip-bike', code: 'promoride', baseAmount: 12000 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.code).toBe('PROMORIDE');
      expect(result.discountAmount).toBe(12000);
      expect(result.title).toBe('PROMORIDE');
    }
  });

  it('is case- and whitespace-insensitive', async () => {
    mockCrewMetadata({ franchize: { catalog: { promoBanners: [] } } });

    const result = await validateFranchizePromoCode({ slug: 'vip-bike', code: '  Promo Ride ', baseAmount: 3000 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.code).toBe('PROMORIDE');
      expect(result.discountAmount).toBe(3000);
    }
  });

  it('beats the 90% percent cap — total becomes exactly 0', async () => {
    mockCrewMetadata({
      franchize: {
        catalog: {
          promoBanners: [
            { code: 'old10', title: 'Старая акция', discountPercent: 10 },
          ],
        },
      },
    });

    const result = await validateFranchizePromoCode({ slug: 'vip-bike', code: 'PROMORIDE', baseAmount: 999 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.discountAmount).toBe(999);
      expect(999 - result.discountAmount).toBe(0);
    }
  });

  it('stays disabled when the vitrine turns promos off', async () => {
    mockCrewMetadata({ franchize: { order: { allowPromo: false } } });

    const result = await validateFranchizePromoCode({ slug: 'vip-bike', code: 'promoride', baseAmount: 12000 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Промокоды отключены для этой витрины.');
    }
  });

  it('rejects a zero base amount before querying Supabase', async () => {
    const result = await validateFranchizePromoCode({ slug: 'vip-bike', code: 'promoride', baseAmount: 0 });

    expect(result.success).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
