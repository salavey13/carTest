import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  maybeSingle: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  schema: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    schema: mocks.schema,
  },
}));

import { getCrewSensitiveData, saveCrewSensitiveData } from '@/lib/private-secrets';

describe('crew private secret storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.schema.mockReturnValue({ from: mocks.from });
    mocks.from.mockReturnValue({ select: mocks.select, upsert: mocks.upsert });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it('stores crew contract defaults and doc templates only through the private schema', async () => {
    await saveCrewSensitiveData(' vip-bike ', {
      contractDefaults: { defaults: { issuerName: 'VIP Bike', bike_value_rub: 700000 } },
      docTemplates: { rentalDealTemplate: 'Договор {{contract_number}}' },
    });

    expect(mocks.schema).toHaveBeenCalledWith('private');
    expect(mocks.from).toHaveBeenCalledWith('crew_secrets');
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      crew_slug: 'vip-bike',
      contract_defaults: JSON.stringify({ defaults: { issuerName: 'VIP Bike', bike_value_rub: 700000 } }),
      doc_templates: JSON.stringify({ rentalDealTemplate: 'Договор {{contract_number}}' }),
      updated_at: expect.any(String),
    }));
  });

  it('rejects credential-looking keys before writing crew secrets', async () => {
    await expect(saveCrewSensitiveData('vip-bike', {
      contractDefaults: { defaults: { issuerName: 'VIP Bike' } },
      docTemplates: { paymentCredentials: { accessToken: 'should-not-live-here' } },
    })).rejects.toThrow(/credential key/);

    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('allows legitimate template/config key names that merely contain words like card or tokens', async () => {
    await saveCrewSensitiveData('vip-bike', {
      docTemplates: {
        cardTemplate: 'Карточка {{bike_make_model}}',
        designTokensText: 'orange/cyberpunk visual hints',
      },
    });

    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      doc_templates: JSON.stringify({
        cardTemplate: 'Карточка {{bike_make_model}}',
        designTokensText: 'orange/cyberpunk visual hints',
      }),
    }));
  });

  it('rejects prototype pollution keys before writing crew secrets', async () => {
    await expect(saveCrewSensitiveData('vip-bike', {
      contractDefaults: JSON.parse('{"defaults":{"issuerName":"VIP Bike"},"__proto__":{"polluted":true}}'),
    })).rejects.toThrow(/reserved JSON key/);

    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('reads only allowed crew secret columns and parses JSON objects defensively', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        contract_defaults: '{"defaults":{"issuerName":"VIP Bike"},"paymentToken":"old-token"}',
        doc_templates: '{"rentalDealTemplate":"OK","__proto__":{"polluted":true},"merchantSecret":"old-secret"}',
      },
      error: null,
    });

    const result = await getCrewSensitiveData('vip-bike');

    expect(mocks.schema).toHaveBeenCalledWith('private');
    expect(mocks.select).toHaveBeenCalledWith('contract_defaults, doc_templates');
    expect(result).toEqual({
      contractDefaults: { defaults: { issuerName: 'VIP Bike' } },
      docTemplates: { rentalDealTemplate: 'OK' },
    });
  });
});
