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
  invoiceDeleteContains: vi.fn(),
  /** iter35: result of the checkout idempotency lookup (existing order_id row). */
  idempotencyLookup: vi.fn(),
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

vi.mock('@/lib/private-secrets', () => ({
  getUserSensitiveData: mocks.getUserSensitiveData,
  getUserSensitiveDataOrDefault: mocks.getUserSensitiveData,
  getCrewSensitiveData: mocks.getCrewSensitiveData,
  getCrewSensitiveDataOrDefault: mocks.getCrewSensitiveData,
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
        // iter35: idempotency guard read — .select().eq().order().limit().maybeSingle()
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: mocks.idempotencyLookup,
              }),
            }),
          }),
        }),
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
        delete: () => ({
          eq: () => ({
            eq: () => ({
              contains: mocks.invoiceDeleteContains,
            }),
          }),
        }),
      };
    }

    if (table === 'rentals') {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
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
    mocks.createInvoice.mockResolvedValue({ success: true, data: { status: 'pending' } });
    mocks.invoiceDeleteContains.mockResolvedValue({ error: null });
    mocks.buildDocx.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), renderedMarkdown: 'ok' });
    // iter35: default — no existing checkout row for this order_id.
    mocks.idempotencyLookup.mockResolvedValue({ data: null, error: null });
    vi.stubEnv('ADMIN_CHAT_ID', '417553377');
  });

  it('does not create invoice when DOCX generation fails', async () => {
    mocks.buildDocx.mockRejectedValueOnce(new Error('docx render failed'));

    const result = await createFranchizeOrderCheckout(buildPayload('telegram_xtr', 'order-2'));

    expect(result.success).toBe(false);
    expect(result.error).toContain('Не удалось подготовить документы аренды');
    expect(mocks.createInvoice).not.toHaveBeenCalled();
    expect(mocks.sendTelegramInvoice).not.toHaveBeenCalled();
  });

  it('creates and sends invoice only after DOCX delivery succeeds', async () => {
    const result = await createFranchizeOrderCheckout(buildPayload('telegram_xtr'));

    expect(result.success).toBe(true);
    expect(mocks.createInvoice).toHaveBeenCalledTimes(1);
    expect(mocks.sendTelegramInvoice).toHaveBeenCalledTimes(1);
    expect(mocks.invoiceDeleteContains).not.toHaveBeenCalled();
    expect(mocks.sendTelegramDocument).toHaveBeenCalled();
  });

  it('cleans up the pending invoice when Telegram XTR send fails', async () => {
    mocks.sendTelegramInvoice.mockResolvedValueOnce({ success: false, error: 'telegram send failed' });

    const result = await createFranchizeOrderCheckout(buildPayload('telegram_xtr', 'order-cleanup'));

    expect(result.success).toBe(false);
    expect(result.error).toContain('telegram send failed');
    expect(mocks.createInvoice).toHaveBeenCalledTimes(1);
    expect(mocks.invoiceDeleteContains).toHaveBeenCalledTimes(1);
    expect(mocks.invoiceDeleteContains).toHaveBeenCalledWith('metadata', expect.objectContaining({ rental_id: expect.any(String) }));
  });

  // ── iter35: the 4-rentals double-submit regression ──
  // A renter tapped «Подтвердить заказ» 4× while the availability check was
  // in flight; every tap carried the SAME orderId and each created a rental.
  // The DB-backed idempotency guard must return an idempotent success for
  // any replay whose order_id already has a pending/sent notification row.
  it('suppresses a duplicate checkout when the order_id was already processed', async () => {
    mocks.idempotencyLookup.mockResolvedValueOnce({ data: { id: 'log-1', send_status: 'sent' }, error: null });

    const result = await createFranchizeOrderCheckout(buildPayload('telegram_xtr', 'order-dup'));

    expect(result.success).toBe(true);
    // Nothing may be rebuilt, re-notified or re-invoiced for the replay.
    expect(mocks.buildDocx).not.toHaveBeenCalled();
    expect(mocks.sendTelegramDocument).not.toHaveBeenCalled();
    expect(mocks.createInvoice).not.toHaveBeenCalled();
  });

  it('still allows a retry when the previous checkout failed', async () => {
    mocks.idempotencyLookup.mockResolvedValueOnce({ data: { id: 'log-1', send_status: 'failed' }, error: null });

    const result = await createFranchizeOrderCheckout(buildPayload('card', 'order-retry'));

    // payment=card → no invoice path; success means the flow ran to completion
    // (the 'failed' row did NOT short-circuit the retry — buildDocx is called
    // per bike + verifier attachment, so assert delivery, not exact counts).
    expect(result.success).toBe(true);
    expect(mocks.buildDocx).toHaveBeenCalled();
    expect(mocks.sendTelegramDocument).toHaveBeenCalled();
  });
});
