import { describe, it, expect, vi } from 'vitest';
import { ensureFranchizeOrderDocDelivery } from '@/app/webhook-handlers/franchize-order-doc';

function buildSupabaseMock(sendStatus: string | null, error: { message: string } | null = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: sendStatus ? { send_status: sendStatus } : null, error }),
              }),
            }),
          }),
        }),
      }),
    }),
  };
}

describe('ensureFranchizeOrderDocDelivery', () => {
  it('returns missing when orderId is absent', async () => {
    const retry = vi.fn();
    const status = await ensureFranchizeOrderDocDelivery({
      supabase: buildSupabaseMock(null),
      slug: 'vip-bike',
      retry,
    });

    expect(status).toBe('missing');
    expect(retry).not.toHaveBeenCalled();
  });

  it('does not retry when doc is already sent', async () => {
    const retry = vi.fn();
    const status = await ensureFranchizeOrderDocDelivery({
      supabase: buildSupabaseMock('sent'),
      slug: 'vip-bike',
      orderId: 'order-1',
      retry,
    });

    expect(status).toBe('sent');
    expect(retry).not.toHaveBeenCalled();
  });

  it('retries doc generation when latest status is failed', async () => {
    const retry = vi.fn(async () => ({ success: true }));
    const status = await ensureFranchizeOrderDocDelivery({
      supabase: buildSupabaseMock('failed'),
      slug: 'vip-bike',
      orderId: 'order-2',
      retry,
    });

    expect(status).toBe('pending');
    expect(retry).toHaveBeenCalledWith({ slug: 'vip-bike', orderId: 'order-2' });
  });

  it('throws when retry fails after payment', async () => {
    const retry = vi.fn(async () => ({ success: false, error: 'doc pipeline offline' }));

    await expect(
      ensureFranchizeOrderDocDelivery({
        supabase: buildSupabaseMock('failed'),
        slug: 'vip-bike',
        orderId: 'order-3',
        retry,
      }),
    ).rejects.toThrow('doc pipeline offline');
  });
});
