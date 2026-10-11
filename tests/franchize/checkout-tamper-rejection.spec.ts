// tests/franchize/checkout-tamper-rejection.spec.ts
//
// Boss codereview round 1 (2026-10-11): «doublecheck that price is calculated
// correctly for promo codes» — сервер ОБЯЗАН отвергать подделанную скидку.
// Клиент шлёт subtotal/extrasTotal/promoDiscount в payload; сервер
// resolveFranchizeCheckoutTotal пересчитывает ожидаемую скидку через
// validateFranchizePromoCode и сравнивает — расхождение → отказ чекаута.
// Пиним обе стороны: корректная сумма проходит, подделка — нет.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: { from: mocks.from },
}));

vi.mock("@/app/actions", () => ({
  notifyAdmin: vi.fn(),
  sendTelegramDocument: vi.fn(),
  sendTelegramInvoice: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { submitFranchizeOrderNotification } from "@/app/franchize/actions-runtime";

const CREW_METADATA = {
  franchize: {
    order: { allowPromo: true },
    catalog: { promoBanners: [] },
  },
};

function mockCrewMetadata(metadata: unknown) {
  // Универсальная цепочка: промо-гейт читает crews, а после него
  // recordFranchizeOrderIntent (upsertFranchizeIntent) пишет intents —
  // все таблицы отвечают «успешно, пусто» на любой цепочке вызовов.
  const chain = () => {
    const c: Record<string, unknown> = {
      select: () => c,
      eq: () => c,
      insert: () => c,
      update: () => c,
      upsert: () => c,
      maybeSingle: async () => ({ data: { metadata }, error: null }),
      single: async () => ({ data: null, error: null }),
    };
    return c;
  };
  mocks.from.mockImplementation(() => chain());
}

const BASE_PAYLOAD = {
  slug: "vip-bike",
  orderId: "order-test-1",
  telegramUserId: "413553377",
  recipient: "Тест Тестов",
  phone: "+79001234567",
  time: "2026-10-12 10:00",
  comment: "",
  rentalStartDate: "2026-10-12",
  rentalEndDate: "2026-10-13",
  payment: "card" as const,
  delivery: "pickup" as const,
  flowType: "rental" as const,
  subtotal: 12000,
  extrasTotal: 0,
  extras: [],
  cartLines: [
    {
      itemId: "bike-1",
      qty: 1,
      pricePerDay: 12000,
      lineTotal: 12000,
      options: {
        package: "Базовый",
        duration: "1 день",
        perk: "Стандарт",
        auction: "Без аукциона",
      },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCrewMetadata(CREW_METADATA);
});

describe("checkout promo tamper rejection (server source of truth)", () => {
  it("accepts an HONEST payload and reaches the post-promo pipeline", async () => {
    const result = await submitFranchizeOrderNotification({
      ...BASE_PAYLOAD,
      promoCode: "WHEEL2000",
      promoTitle: "WHEEL2000",
      promoDiscount: 2000,
      totalAmount: 10000,
    });
    // Гейт промо пройден: промо-ошибки быть НЕ может. Дальнейший пайплайн
    // (doc/notify) в этой спеке не замокан — падение допустимо ТОЛЬКО по
    // инфраструктурным причинам, но НЕ по сумме промокода.
    expect(result.success === true || !result.error!.includes("Сумма промокода изменилась")).toBe(true);
    // Поведенческий пин: валидная скидка дошла до intent-логирования
    // (recordFranchizeOrderIntent → upsertFranchizeIntent, таблица
    // franchize_intents, вызывается ПОСЛЕ промо-гейта).
    expect(mocks.from).toHaveBeenCalledWith("franchize_intents");
  });

  it("REJECTS a tampered payload: inflated promoDiscount", async () => {
    const result = await submitFranchizeOrderNotification({
      ...BASE_PAYLOAD,
      promoCode: "WHEEL1000",
      promoTitle: "WHEEL1000",
      promoDiscount: 5000, // серверная скидка всего 1 000 ₽
      totalAmount: 7000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Сумма промокода изменилась");
    }
  });

  it("REJECTS a tampered payload: deflated promoDiscount", async () => {
    const result = await submitFranchizeOrderNotification({
      ...BASE_PAYLOAD,
      promoCode: "WHEEL5000",
      promoTitle: "WHEEL5000",
      promoDiscount: 100, // серверная скидка 5 000 ₽ — юзер «переплатил бы»
      totalAmount: 11900,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Сумма промокода изменилась");
    }
  });

  it("REJECTS a forged percent discount on WHEEL15", async () => {
    const result = await submitFranchizeOrderNotification({
      ...BASE_PAYLOAD,
      promoCode: "WHEEL15",
      promoTitle: "WHEEL15",
      promoDiscount: 5000, // сервер скажет round(12000*0.15)=1800
      totalAmount: 7000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Сумма промокода изменилась");
    }
  });

  it("REJECTS a capped-fixed trick: WHEEL5000 claims full coverage of 12000", async () => {
    const result = await submitFranchizeOrderNotification({
      ...BASE_PAYLOAD,
      promoCode: "WHEEL5000",
      promoTitle: "WHEEL5000",
      promoDiscount: 12000, // «скидка = вся корзина» (B1-атака с клиента)
      totalAmount: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Сумма промокода изменилась");
    }
  });
});
