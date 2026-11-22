// tests/franchize/order-draft.spec.ts
// iter36: order-page draft persistence (crash/reload-safe form).
// The lib is the safety net for the "page crashed, passport data gone" flow —
// every failure mode must degrade to null/void, never throw.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildOrderDraft,
  clearOrderDraft,
  isOrderDraftMeaningful,
  loadOrderDraft,
  ORDER_DRAFT_TTL_MS,
  ORDER_DRAFT_VERSION,
  orderDraftStorageKey,
  sanitizeOrderDraft,
  saveOrderDraft,
  type OrderDraftForm,
} from '@/app/franchize/lib/order-draft';

const SLUG = 'vip-bike';

const meaningfulForm: OrderDraftForm = {
  recipient: 'Иван Наумов',
  phone: '+7 903 123-45-67',
  comment: 'позвонить заранее',
  birthDate: '01.02.1990',
  passportSeries: '4509',
  passportNumber: '123456',
  passportIssueDate: '10.03.2015',
  passportIssuedBy: 'ОМВД по г. Н.Новгороду',
  registrationAddress: 'г. Н.Новгород, ул. Ленина, 1',
  hasLicense: true,
  licenseSeries: '99',
  licenseNumber: '76123456',
  licenseCategories: 'A, B',
  licenseExpiryDate: '01.01.2030',
  payment: 'card',
  deliveryMode: 'pickup',
  selectedExtras: ['priority-prep'],
  promo: 'VIP2026',
};

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, v); },
  };
}

describe('order draft persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('key is namespaced per crew slug', () => {
    expect(orderDraftStorageKey(SLUG)).toBe('franchize-order-draft:vip-bike');
  });

  it('meaningful check: empty form is not worth saving, any personal field is', () => {
    const empty = { ...meaningfulForm, recipient: '', phone: '', comment: '', birthDate: '', passportSeries: '', passportNumber: '', passportIssueDate: '', passportIssuedBy: '', registrationAddress: '', licenseSeries: '', licenseNumber: '', licenseCategories: '', licenseExpiryDate: '', promo: '', selectedExtras: [] };
    expect(isOrderDraftMeaningful(empty)).toBe(false);
    expect(isOrderDraftMeaningful({ ...empty, passportSeries: '4509' })).toBe(true);
    expect(isOrderDraftMeaningful({ ...empty, phone: '+7903' })).toBe(true);
    expect(isOrderDraftMeaningful({ ...empty, promo: 'X' })).toBe(true);
    expect(isOrderDraftMeaningful({ ...empty, selectedExtras: ['full-insurance'] })).toBe(true);
  });

  it('save + load round-trips every field', () => {
    const storage = memoryStorage();
    const draft = buildOrderDraft(meaningfulForm, { slug: SLUG, orderId: 'order-abc', tgUserId: '413553377', now: 1_000 });
    saveOrderDraft(storage, draft);

    const loaded = loadOrderDraft(storage, SLUG, 2_000);
    expect(loaded).not.toBeNull();
    expect(loaded?.recipient).toBe('Иван Наумов');
    expect(loaded?.passportSeries).toBe('4509');
    expect(loaded?.licenseNumber).toBe('76123456');
    expect(loaded?.payment).toBe('card');
    expect(loaded?.selectedExtras).toEqual(['priority-prep']);
    expect(loaded?.orderId).toBe('order-abc');
    expect(loaded?.version).toBe(ORDER_DRAFT_VERSION);
  });

  it('restores into the REAL browser localStorage (jsdom)', () => {
    saveOrderDraft(window.localStorage, buildOrderDraft(meaningfulForm, { slug: SLUG, orderId: 'order-xyz' }));
    const loaded = loadOrderDraft(window.localStorage, SLUG);
    expect(loaded?.phone).toBe('+7 903 123-45-67');
    clearOrderDraft(window.localStorage, SLUG);
    expect(loadOrderDraft(window.localStorage, SLUG)).toBeNull();
  });

  it('expired draft (TTL 14 days) is ignored AND removed', () => {
    const storage = memoryStorage();
    saveOrderDraft(storage, buildOrderDraft(meaningfulForm, { slug: SLUG, orderId: 'o1', now: 0 }));
    const tooLate = ORDER_DRAFT_TTL_MS + 1;
    expect(loadOrderDraft(storage, SLUG, tooLate)).toBeNull();
    expect(storage.getItem(orderDraftStorageKey(SLUG))).toBeNull();
  });

  it('corrupted JSON degrades to null and clears the payload instead of throwing', () => {
    const storage = memoryStorage();
    storage.setItem(orderDraftStorageKey(SLUG), '{not json at all');
    expect(loadOrderDraft(storage, SLUG)).toBeNull();
    expect(storage.getItem(orderDraftStorageKey(SLUG))).toBeNull();
  });

  it('foreign slug / wrong version / non-object payloads are rejected', () => {
    const draft = buildOrderDraft(meaningfulForm, { slug: SLUG, orderId: 'o' });
    expect(sanitizeOrderDraft(draft, 'other-crew')).toBeNull();
    expect(sanitizeOrderDraft({ ...draft, version: 999 }, SLUG)).toBeNull();
    expect(sanitizeOrderDraft('garbage', SLUG)).toBeNull();
    expect(sanitizeOrderDraft(null, SLUG)).toBeNull();
    expect(sanitizeOrderDraft(undefined, SLUG)).toBeNull();
    expect(sanitizeOrderDraft({ version: 1, slug: SLUG }, SLUG)).toBeNull(); // no savedAt
  });

  it('schema drift never throws: hostile field types are coerced or dropped', () => {
    const storage = memoryStorage();
    storage.setItem(orderDraftStorageKey(SLUG), JSON.stringify({
      version: ORDER_DRAFT_VERSION,
      slug: SLUG,
      savedAt: Date.now(),
      recipient: { evil: 'object' },
      phone: 12345,
      passportSeries: ['4509'],
      selectedExtras: 'not-an-array',
      payment: 'crypto-ultra',
      deliveryMode: 'drone',
      hasLicense: 'yes',
      promo: 42,
    }));
    const loaded = loadOrderDraft(storage, SLUG);
    // nothing usable survived → no restore, no crash
    expect(loaded).toBeNull();
  });

  it('payment/deliveryMode fall back to safe enums, extras list is filtered', () => {
    const raw = {
      version: ORDER_DRAFT_VERSION,
      slug: SLUG,
      savedAt: Date.now(),
      phone: '+79031234567',
      payment: 'sbp',
      deliveryMode: 'delivery',
      selectedExtras: ['ok-extra', '   ', 123, null],
    };
    const draft = sanitizeOrderDraft(raw, SLUG);
    expect(draft?.payment).toBe('sbp');
    expect(draft?.deliveryMode).toBe('delivery');
    expect(draft?.selectedExtras).toEqual(['ok-extra']);
    expect(draft?.hasLicense).toBe(true); // default when absent

    const draft2 = sanitizeOrderDraft({ ...raw, payment: 'x', deliveryMode: 'y' }, SLUG);
    expect(draft2?.payment).toBe('card');
    expect(draft2?.deliveryMode).toBe('pickup');
  });

  it('a storage that throws (private mode / quota) never breaks the caller', () => {
    const throwing = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => { throw new Error('SecurityError'); },
    } as unknown as Storage;
    expect(() => saveOrderDraft(throwing, buildOrderDraft(meaningfulForm, { slug: SLUG, orderId: 'o' }))).not.toThrow();
    expect(loadOrderDraft(throwing, SLUG)).toBeNull();
    expect(() => clearOrderDraft(throwing, SLUG)).not.toThrow();
    expect(loadOrderDraft(null, SLUG)).toBeNull();
  });

  it('fields are trimmed and length-capped on sanitize', () => {
    const raw = {
      version: ORDER_DRAFT_VERSION,
      slug: SLUG,
      savedAt: Date.now(),
      recipient: '  Иванов Иван  ',
      comment: 'x'.repeat(5000),
    };
    const draft = sanitizeOrderDraft(raw, SLUG);
    expect(draft?.recipient).toBe('Иванов Иван');
    expect((draft?.comment ?? '').length).toBeLessThanOrEqual(2000);
  });
});
