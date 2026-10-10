// tests/franchize/wheel-promo.spec.ts
//
// Колесо фортуны (boss 2026-10-11): сегменты колеса ссылаются на хардкодные
// промокоды WHEEL1000/2000/5000/15. Эта спека проверяет ОБЕ стороны контракта:
//  1) серверная валидация (validateFranchizePromoCode → BUILT_IN_PROMO_CODES)
//     выдаёт правильные fixed/percent скидки и honour allowPromo;
//  2) чистая логика колеса (lib/wheel-of-fortune) — взвешенный выбор,
//     точная остановка анимации на выбранном сегменте, кулдаун круток.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}));

vi.mock("@/app/actions", () => ({
  notifyAdmin: vi.fn(),
  sendTelegramDocument: vi.fn(),
  sendTelegramInvoice: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { validateFranchizePromoCode } from "@/app/franchize/server-actions/promotions";
import {
  WHEEL_SEGMENTS,
  WHEEL_SEGMENT_ANGLE,
  WHEEL_PROMO_CODES,
  computeTargetRotation,
  pickWeightedSegmentIndex,
  wheelPromoCodes,
  formatCooldown,
  readLastSpinAt,
  spinCooldownRemainingMs,
  wheelSpinStorageKey,
  writeLastSpinAt,
  WHEEL_SPIN_COOLDOWN_MS,
} from "@/app/franchize/lib/wheel-of-fortune";

function mockCrewMetadata(metadata: unknown) {
  mocks.from.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: { metadata }, error: null }),
      }),
    }),
  });
}

describe("wheel built-in promo codes (server validation)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCrewMetadata({ franchize: { catalog: { promoBanners: [] } } });
  });

  it("every promo code referenced by a wheel segment validates successfully", async () => {
    const codes = wheelPromoCodes();
    expect(codes.length).toBeGreaterThan(0);

    for (const code of codes) {
      const result = await validateFranchizePromoCode({ slug: "vip-bike", code, baseAmount: 12000 });
      expect(result.success, `wheel code ${code} must validate`).toBe(true);
    }
  });

  it("WHEEL1000 discounts a fixed 1 000 ₽", async () => {
    const result = await validateFranchizePromoCode({ slug: "vip-bike", code: "WHEEL1000", baseAmount: 12000 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.code).toBe("WHEEL1000");
      expect(result.discountAmount).toBe(1000);
    }
  });

  it("WHEEL1000 caps at the base amount (small order pays 0)", async () => {
    const result = await validateFranchizePromoCode({ slug: "vip-bike", code: "WHEEL1000", baseAmount: 800 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.discountAmount).toBe(800);
    }
  });

  it("WHEEL2000 and WHEEL5000 discount their fixed amounts", async () => {
    const two = await validateFranchizePromoCode({ slug: "vip-bike", code: "WHEEL2000", baseAmount: 12000 });
    const five = await validateFranchizePromoCode({ slug: "vip-bike", code: "WHEEL5000", baseAmount: 12000 });
    expect(two.success && two.discountAmount).toBe(2000);
    expect(five.success && five.discountAmount).toBe(5000);
  });

  it("WHEEL15 discounts 15% of the base amount", async () => {
    const result = await validateFranchizePromoCode({ slug: "vip-bike", code: "WHEEL15", baseAmount: 12000 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.discountAmount).toBe(1800);
    }
  });

  it("codes are case-insensitive like the manual cart input", async () => {
    const result = await validateFranchizePromoCode({ slug: "vip-bike", code: "  wheel5000 ", baseAmount: 12000 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.code).toBe("WHEEL5000");
      expect(result.discountAmount).toBe(5000);
    }
  });

  it("wheel codes stay disabled when the vitrine turns promos off", async () => {
    mockCrewMetadata({ franchize: { order: { allowPromo: false } } });
    const result = await validateFranchizePromoCode({ slug: "vip-bike", code: "WHEEL1000", baseAmount: 12000 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Промокоды отключены для этой витрины.");
    }
  });

  it("WHEEL_PROMO_CODES covers exactly the codes referenced by segments", () => {
    const segmentCodes = wheelPromoCodes().sort();
    const configCodes = WHEEL_PROMO_CODES.map((promo) => promo.code).sort();
    expect(segmentCodes).toEqual(configCodes);
  });
});

describe("wheel-of-fortune lib (pure logic)", () => {
  it("pickWeightedSegmentIndex always returns a valid segment index", () => {
    for (let i = 0; i < 200; i += 1) {
      const index = pickWeightedSegmentIndex();
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(WHEEL_SEGMENTS.length);
    }
  });

  it("pickWeightedSegmentIndex never picks a zero-weight segment", () => {
    const segments = [
      { id: "a", label: "A", color: "#000", textColor: "#fff", kind: "miss" as const, weight: 0 },
      { id: "b", label: "B", color: "#111", textColor: "#fff", kind: "miss" as const, weight: 10 },
    ];
    for (let i = 0; i < 50; i += 1) {
      expect(pickWeightedSegmentIndex(Math.random, segments)).toBe(1);
    }
  });

  it("computeTargetRotation lands the CHOSEN segment under the top pointer", () => {
    const ANGLE = WHEEL_SEGMENT_ANGLE;
    const SEGMENT_HALF = ANGLE / 2;
    for (let segmentIndex = 0; segmentIndex < WHEEL_SEGMENTS.length; segmentIndex += 1) {
      const rotation = computeTargetRotation(segmentIndex, 0, () => 0.5);
      // После поворота центр сегмента (index*ANGLE) должен оказаться на
      // вершине (mod 360) с допуском ±A/2 — граница соседнего сектора.
      const centerAfterSpin = (segmentIndex * ANGLE + rotation) % 360;
      const normalized = centerAfterSpin > 180 ? centerAfterSpin - 360 : centerAfterSpin;
      expect(Math.abs(normalized)).toBeLessThanOrEqual(SEGMENT_HALF);
    }
  });

  it("computeTargetRotation always spins forward at least fullSpins turns", () => {
    const rotation = computeTargetRotation(3, 720, () => 0.1, 6);
    expect(rotation).toBeGreaterThanOrEqual(720 + 6 * 360 - 360);
  });

  it("spin cooldown round-trips through storage and expires after 24h", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    } as Storage;

    const slug = "vip-bike";
    expect(readLastSpinAt(storage, slug)).toBeNull();

    const now = Date.now();
    writeLastSpinAt(storage, slug, now);
    expect(store.get(wheelSpinStorageKey(slug))).toBe(String(now));
    expect(readLastSpinAt(storage, slug)).toBe(now);
    expect(spinCooldownRemainingMs(now, now)).toBe(WHEEL_SPIN_COOLDOWN_MS);
    expect(spinCooldownRemainingMs(now, now + WHEEL_SPIN_COOLDOWN_MS + 1)).toBe(0);
  });

  it("formatCooldown renders human-readable ru strings", () => {
    expect(formatCooldown(5 * 60 * 60 * 1000 + 12 * 60 * 1000)).toBe("через 5 ч 12 мин");
    expect(formatCooldown(2 * 60 * 60 * 1000)).toBe("через 2 ч");
    expect(formatCooldown(30 * 1000)).toBe("через 1 мин");
  });
});
