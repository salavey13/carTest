import { beforeEach, describe, expect, it, vi } from 'vitest';

const createInvoiceMock = vi.fn();
const notifyAdminMock = vi.fn();
const sendTelegramDocumentMock = vi.fn();
const sendTelegramInvoiceMock = vi.fn();
const loggerErrorMock = vi.fn();
const buildDocxMock = vi.fn();
const getUserSensitiveDataMock = vi.fn();
const getCrewSensitiveDataMock = vi.fn();

const fromMock = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createInvoice: createInvoiceMock,
  supabaseAdmin: {
    from: fromMock,
  },
}));

vi.mock('@/app/actions', () => ({
  notifyAdmin: notifyAdminMock,
  sendTelegramDocument: sendTelegramDocumentMock,
  sendTelegramInvoice: sendTelegramInvoiceMock,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: loggerErrorMock,
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/app/franchize/lib/docx-capability', () => ({
  buildFranchizeDocxFromTemplate: buildDocxMock,
}));

vi.mock('@/app/lib/private-secrets', () => ({
  getUserSensitiveData: getUserSensitiveDataMock,
  getCrewSensitiveData: getCrewSensitiveDataMock,
  saveCrewSensitiveData: vi.fn(),
}));

import { createFranchizeOrderCheckout } from '@/app/franchize/actions';

function buildPayload(payment: 'telegram_xtr' | 'card' = 'telegram_xtr') {
  return {
    slug: 'vip-bike',
    orderId: 'order-1',
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
    fromMock.mockImplementation(buildSupabaseFromMock());
    getUserSensitiveDataMock.mockResolvedValue({});
    getCrewSensitiveDataMock.mockResolvedValue({ contractDefaults: {} });
    sendTelegramDocumentMock.mockResolvedValue({ success: true });
    notifyAdminMock.mockResolvedValue({ success: true });
    sendTelegramInvoiceMock.mockResolvedValue({ success: true });
    createInvoiceMock.mockResolvedValue({ success: true });
    buildDocxMock.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), renderedMarkdown: 'ok' });
    vi.stubEnv('ADMIN_CHAT_ID', '417553377');
  });

  it('does not create invoice when DOCX generation fails', async () => {
    buildDocxMock.mockRejectedValueOnce(new Error('docx render failed'));

    const result = await createFranchizeOrderCheckout(buildPayload('telegram_xtr'));

    expect(result.success).toBe(false);
    expect(result.error).toContain('docx render failed');
    expect(createInvoiceMock).not.toHaveBeenCalled();
    expect(sendTelegramInvoiceMock).not.toHaveBeenCalled();
  });

  it('creates and sends invoice only after DOCX delivery succeeds', async () => {
    const result = await createFranchizeOrderCheckout(buildPayload('telegram_xtr'));

    expect(result.success).toBe(true);
    expect(createInvoiceMock).toHaveBeenCalledTimes(1);
    expect(sendTelegramInvoiceMock).toHaveBeenCalledTimes(1);
    expect(sendTelegramDocumentMock).toHaveBeenCalled();
  });
});
