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
}));

vi.mock('@/app/lib/private-secrets', () => ({
  getUserSensitiveData: vi.fn(),
  getCrewSensitiveData: vi.fn(),
  saveCrewSensitiveData: vi.fn(),
}));

import { markCrewBikesAvailable } from '@/app/franchize/server-actions/catalog';
import { createFranchizeOrderInvoice } from '@/app/franchize/server-actions/orders';
import { validateFranchizePromoCode } from '@/app/franchize/server-actions/promotions';
import { checkFranchizeCarsAvailability } from '@/app/franchize/server-actions/rentals';
import { createFranchizeOrderInvoice as createFranchizeOrderInvoiceCompat } from '@/app/franchize/actions';

describe('franchize server action input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects empty crew availability slug before querying Supabase', async () => {
    const result = await markCrewBikesAvailable('   ');

    expect(result).toEqual({ success: false, error: 'slug is required' });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('rejects malformed XTR invoice payload before invoice or Supabase writes', async () => {
    const result = await createFranchizeOrderInvoice({ slug: 'vip-bike', orderId: '' });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(mocks.createInvoice).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('keeps the compatibility facade wired to focused validation behavior', async () => {
    const result = await createFranchizeOrderInvoiceCompat({ slug: 'vip-bike', orderId: '' });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(mocks.createInvoice).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('rejects malformed promo payload before querying Supabase', async () => {
    const result = await validateFranchizePromoCode({ slug: 'vip-bike', code: '', baseAmount: 1000 });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected promo validation to fail');
    expect(result.error).toBeTruthy();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('rejects invalid availability date ranges before querying Supabase', async () => {
    const result = await checkFranchizeCarsAvailability({
      carIds: ['bike-1'],
      rentalStartDate: '2026-05-08',
      rentalEndDate: '2026-05-07',
    });

    expect(result).toEqual({ success: false, error: 'Проверьте диапазон дат аренды.' });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
