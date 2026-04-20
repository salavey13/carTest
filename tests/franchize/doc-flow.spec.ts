import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createInvoice: vi.fn(),
  notifyAdmin: vi.fn(),
  sendTelegramDocument: vi.fn(),
  sendTelegramInvoice: vi.fn(),
  loggerError: vi.fn(),
  buildDocx: vi.fn(),
  getUserSensitiveData: vi.fn(),
  getCrewSensitiveData: vi.fn(),
  from: vi.fn(),
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
  buildFranchizeDocxFromTemplate: mocks.buildDocx,
}));

vi.mock('@/app/lib/private-secrets', () => ({
  getUserSensitiveData: mocks.getUserSensitiveData,
  getCrewSensitiveData: mocks.getCrewSensitiveData,
  saveCrewSensitiveData: vi.fn(),
}));

import { createFranchizeOrderCheckout } from '@/app/franchize/actions';

function buildPayload(payment: 'telegram_xtr' | 'card' = 'telegram_xtr', orderId = 'order-1') {
  return {
    slug: 'vip-bike',
    orderId,
    telegramUserId: '42',
    recipient: 'Ivan Ivanov',
    phone: '+79998887766',
    time: '10:00',
    comment: '',
    payment,
    delivery: 'pickup',
    subtotal: 100000,
    extrasTotal: 0,
    totalAmount: 100000,
    extras: [],
    cartLines: [
      {
        lineId: 'line-1',
        itemId: 'car-1',
        qty: 1,
        pricePerDay: 100000,
        lineTotal: 100000,
        options: {
          package: 'Базовый',
          duration: '1 день',
          perk: 'Стандарт',
          auction: 'Без аукциона',
        },
      },
    ],
  };
}

function buildSupabaseFromMock() {
  return (table: string) => {
    if (table === 'franchize_order_notifications') {
      return {
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: 'log-1' }, error: null }),
          }),
        }),
        update: () => ({
          eq: async () => ({ error: null }),
        }),
      };
    }

    if (table === 'cars') {
      return {
        select: () => ({
          in: async () => ({ data: [{ id: 'car-1', make: 'Yamaha', model: 'Tracer', specs: {} }], error: null }),
        }),
      };
    }

    if (table === 'crews') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    }

    if (table === 'invoices') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table mock request: ${table}`);
  };
}

describe('franchize checkout doc-flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockImplementation(buildSupabaseFromMock());
    mocks.getUserSensitiveData.mockResolvedValue({});
    mocks.getCrewSensitiveData.mockResolvedValue({ contractDefaults: {} });
    mocks.sendTelegramDocument.mockResolvedValue({ success: true });
    mocks.notifyAdmin.mockResolvedValue({ success: true });
    mocks.sendTelegramInvoice.mockResolvedValue({ success: true });
    mocks.createInvoice.mockResolvedValue({ success: true });
    mocks.buildDocx.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), renderedMarkdown: 'ok' });
    vi.stubEnv('ADMIN_CHAT_ID', '417553377');
  });

  it('does not create invoice when DOCX generation fails', async () => {
    mocks.buildDocx.mockRejectedValueOnce(new Error('docx render failed'));

    const result = await createFranchizeOrderCheckout(buildPayload('telegram_xtr', 'order-2'));

    expect(result.success).toBe(false);
    expect(result.error).toContain('docx render failed');
    expect(mocks.createInvoice).not.toHaveBeenCalled();
    expect(mocks.sendTelegramInvoice).not.toHaveBeenCalled();
  });

  it('creates and sends invoice only after DOCX delivery succeeds', async () => {
    const result = await createFranchizeOrderCheckout(buildPayload('telegram_xtr'));

    expect(result.success).toBe(true);
    expect(mocks.createInvoice).toHaveBeenCalledTimes(1);
    expect(mocks.sendTelegramInvoice).toHaveBeenCalledTimes(1);
    expect(mocks.sendTelegramDocument).toHaveBeenCalled();
  });
});
