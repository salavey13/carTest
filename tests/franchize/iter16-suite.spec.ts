// tests/franchize/iter16-suite.spec.ts
//
// iter16 fixes:
//   1. Equipment pricing: gloves/jacket/pants/boots/net/backpack/bag were
//      silently FREE everywhere except the Item modal (live case: aprilia
//      "Шлем ×1, Перчатки" charged 13 000 ₽ instead of 13 500 ₽). The shared
//      calculator now prices them; the modal, cart and server recompute agree.
//   2. ПЭП default-ON at checkout + doc signature block carries the
//      fingerprint (pep:tg:<id>:<initDataSha16>) — "missing chat_id and sha".
//   3. Rental photo gallery: explicit error state + retry + server-side
//      photo counters (start_photo_count was never selected → always 0).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  calculatePrice,
  calculateExtrasRub,
  RENTAL_EXTRAS_PRICES_RUB,
} from "@/lib/rental-pricing-calculator";
import { parseExtrasFromPerk, parseHelmetCountFromPerk } from "@/app/franchize/lib/perk-parse";
import { sanitizeFranchizeOrderMoneyFields } from "@/app/franchize/lib/order-money-sanitize";
import { buildRentalContractVariables } from "@/app/lib/rental-contract-vars";

const ORDER_PAGE_SRC = readFileSync(join(process.cwd(), "app/franchize/components/OrderPageClient.tsx"), "utf8");
const GALLERY_SRC = readFileSync(join(process.cwd(), "app/franchize/components/RentalPhotoGallery.tsx"), "utf8");
const RUNTIME_SRC = readFileSync(join(process.cwd(), "app/franchize/actions-runtime.ts"), "utf8");
const CONTRACT_VARS_SRC = readFileSync(join(process.cwd(), "app/lib/rental-contract-vars.ts"), "utf8");

// Live aprilia-shiver specs (string values — see the string-price hotfix)
const APRILIA_SPECS = {
  dailyPrice: "12000",
  rent_weekday: "12000",
  rent_weekend: "15000",
  price_per_3h: "5000",
  price_per_hour: "1200",
  deposit_rub: 20000,
};

// ── 1. Extras pricing in the shared calculator ──────────────────────────────

describe("iter16: extras pricing (gloves no longer free)", () => {
  it("gloves add 500 ₽ to a daily rental (live aprilia case)", () => {
    const without = calculatePrice(APRILIA_SPECS, "2026-08-28", "2026-08-29", "10:00", "10:00", 1);
    const withGloves = calculatePrice(APRILIA_SPECS, "2026-08-28", "2026-08-29", "10:00", "10:00", 1, { gloves: true });
    expect(without.totalRub).toBe(13000); // 12000 bike + 1000 helmet
    expect(withGloves.extrasRub).toBe(500);
    expect(withGloves.totalRub).toBe(13500);
  });

  it("every priced extra adds its table price; charger is free", () => {
    const all = calculatePrice(APRILIA_SPECS, "2026-08-28", "2026-08-29", "10:00", "10:00", 0, {
      gloves: true, jacket: true, pants: true, boots: true,
      net: true, backpack: true, bag: true, charger: true,
    });
    expect(all.extrasRub).toBe(3500); // 7 × 500, charger 0
    expect(all.totalRub).toBe(15500); // 12000 bike + 3500 extras
  });

  it("calculateExtrasRub: falsy / numeric-zero values count as not selected", () => {
    expect(calculateExtrasRub(undefined)).toBe(0);
    expect(calculateExtrasRub({})).toBe(0);
    expect(calculateExtrasRub({ gloves: false })).toBe(0);
    expect(calculateExtrasRub({ gloves: 0 })).toBe(0);
    expect(calculateExtrasRub({ gloves: 1 })).toBe(500);
    expect(calculateExtrasRub({ gloves: true, charger: true })).toBe(500);
  });

  it("extras price table matches the contract builder's equipmentCostTotal (500 flat)", () => {
    expect(RENTAL_EXTRAS_PRICES_RUB).toEqual({
      gloves: 500, jacket: 500, pants: 500, boots: 500,
      net: 500, backpack: 500, bag: 500, charger: 0,
    });
  });

  it("hourly rental: helmet priced hourly + flat extras still apply", () => {
    const r = calculatePrice(APRILIA_SPECS, "2026-08-28", "2026-08-28", "10:00", "12:00", 1, { gloves: true });
    expect(r.helmetRub).toBe(500); // < 3h → hourly helmet price
    expect(r.extrasRub).toBe(500);
    // 2h interpolated base: 1200 + (5000−1200)×(2−1)/2 = 3100
    expect(r.basePriceRub).toBe(3100);
    expect(r.totalRub).toBe(3100 + 500 + 500);
  });

  it("no extras → identical to the previous (helmet-only) math", () => {
    const r = calculatePrice(APRILIA_SPECS, "2026-08-28", "2026-08-29", "10:00", "10:00", 2);
    expect(r.extrasRub).toBe(0);
    expect(r.totalRub).toBe(14000); // 12000 + 2 × 1000 helmets
  });
});

// ── 2. Perk-string extras parsing ───────────────────────────────────────────

describe("iter16: parseExtrasFromPerk", () => {
  it("parses the live aprilia perk «Шлем ×1, Перчатки»", () => {
    const extras = parseExtrasFromPerk("Шлем ×1, Перчатки");
    expect(extras.gloves).toBe(true);
    expect(extras.jacket).toBe(false);
    expect(parseHelmetCountFromPerk("Шлем ×1, Перчатки")).toBe(1);
  });

  it("parses every label family (case-insensitive, Russian stems)", () => {
    const extras = parseExtrasFromPerk("Шлем ×2, Перчатки, Куртка, Штаны, Боты, Сетка, Рюкзак, Сумка, Зарядка");
    expect(extras).toEqual({
      gloves: true, jacket: true, pants: true, boots: true,
      net: true, backpack: true, bag: true, charger: true,
    });
  });

  it("сапоги → boots; багажная сумка → bag", () => {
    expect(parseExtrasFromPerk("Сапоги").boots).toBe(true);
    expect(parseExtrasFromPerk("Багажная сумка").bag).toBe(true);
  });

  it("стандарт / empty perk → nothing selected", () => {
    expect(parseExtrasFromPerk("стандарт")).toEqual({
      gloves: false, jacket: false, pants: false, boots: false,
      net: false, backpack: false, bag: false, charger: false,
    });
    expect(parseExtrasFromPerk(undefined).gloves).toBe(false);
    expect(parseExtrasFromPerk("").bag).toBe(false);
  });
});

// ── 3. Server-side heal now includes extras ─────────────────────────────────

describe("iter16: order-money-sanitize heals the gloves undercharge", () => {
  function makeById(specs: Record<string, unknown>) {
    return new Map([
      ["aprilia-shiver", { id: "aprilia-shiver", type: "bike", specs }],
    ]);
  }

  it("client 13000 (gloves free) → healed to 13500 (gloves priced)", () => {
    const payload: Record<string, unknown> = {
      orderId: "order-test-gloves",
      subtotal: 13000,
      extrasTotal: 0,
      totalAmount: 13000,
      extras: [],
      cartLines: [
        {
          itemId: "aprilia-shiver",
          qty: 1,
          pricePerDay: 12000,
          lineTotal: 13000,
          options: {
            perk: "Шлем ×1, Перчатки",
            rentStartDate: "2026-08-28",
            rentEndDate: "2026-08-29",
            rentStartTime: "10:00",
            rentEndTime: "10:00",
          },
        },
      ],
    };
    const result = sanitizeFranchizeOrderMoneyFields(
      payload as never,
      makeById(APRILIA_SPECS),
    );
    expect(result.healedLines).toBe(1);
    expect(payload.cartLines[0].lineTotal).toBe(13500);
    expect(payload.totalAmount).toBe(13500);
  });

  it("correct client total is kept untouched (no false heal)", () => {
    const payload: Record<string, unknown> = {
      orderId: "order-test-gloves-ok",
      subtotal: 13500,
      extrasTotal: 0,
      totalAmount: 13500,
      extras: [],
      cartLines: [
        {
          itemId: "aprilia-shiver",
          qty: 1,
          pricePerDay: 12000,
          lineTotal: 13500,
          options: {
            perk: "Шлем ×1, Перчатки",
            rentStartDate: "2026-08-28",
            rentEndDate: "2026-08-29",
            rentStartTime: "10:00",
            rentEndTime: "10:00",
          },
        },
      ],
    };
    const result = sanitizeFranchizeOrderMoneyFields(payload as never, makeById(APRILIA_SPECS));
    expect(result.healedLines).toBe(0);
    expect(payload.cartLines[0].lineTotal).toBe(13500);
  });
});

// ── 4. ПЭП default-ON + sha fingerprint ─────────────────────────────────────

describe("iter16: ПЭП default-ON at checkout", () => {
  it("auto-captures Telegram initData on mount (no tap needed)", () => {
    expect(ORDER_PAGE_SRC).toContain("pepUserOptedOut");
    expect(ORDER_PAGE_SRC).toMatch(/useEffect\(\(\) => \{[\s\S]*?setPepInitData\(initData\)/);
  });

  it("opt-out is remembered — the auto-capture effect doesn't re-enable after the renter turned it off", () => {
    expect(ORDER_PAGE_SRC).toContain("if (pepInitData || pepUserOptedOut) return;");
    expect(ORDER_PAGE_SRC).toContain("setPepUserOptedOut(true)");
  });

  it("checkout still forwards pepInitData with the order", () => {
    expect(ORDER_PAGE_SRC).toContain("pepInitData: pepInitData ?? undefined");
  });

  it("contract vars: pep fingerprint embeds the initData sha (chat_id + sha in the doc)", () => {
    const vars = buildRentalContractVariables(
      {
        renter: { fullName: "Лобанов Михаил", phone: "+79990001122" },
        bike: { id: "aprilia-shiver", make: "Aprilia", model: "Shiver 750", type: "bike", specs: {} },
        period: { startDate: "2026-08-28", startTime: "10:00", endDate: "2026-08-29", endTime: "10:00", dailyPrice: 12000 },
        crewSecrets: {},
        meta: {
          pep: {
            telegramId: "6714441279",
            username: "Nektariyy",
            signedAt: "2026-08-28T15:43:00.000Z",
            initDataSha256: "a".repeat(64),
          },
        },
      },
    );
    expect(vars.pep_signed).toBe("1");
    expect(vars.renter_signature).toBe("Telegram ID 6714441279 (@Nektariyy)");
    expect(vars.signature_fingerprint).toBe(`pep:tg:6714441279:${"a".repeat(16)}`);
  });

  it("actions-runtime passes initDataSha256 into the contract meta", () => {
    expect(RUNTIME_SRC).toContain("initDataSha256,");
    expect(RUNTIME_SRC).toContain("init_data_sha256: initDataSha256");
  });

  it("templates render the fingerprint line in the ПЭП block", () => {
    for (const tpl of [
      "docs/crewDocs/vip-bike_RENTAL_DEAL_TEMPLATE.html",
      "docs/RENTAL_DEAL_TEMPLATE.html",
      "docs/crewDocs/vip-bike_EQUIPMENT_RENTAL_DEAL_TEMPLATE.html",
      "docs/EQUIPMENT_RENTAL_DEAL_TEMPLATE.html",
    ]) {
      const src = readFileSync(join(process.cwd(), tpl), "utf8");
      expect(src).toContain("Отпечаток подписи (SHA-256 initData): {{signature_fingerprint}}");
    }
  });

  it("contract-vars source keeps the sha sanitize (hex-only, 16 chars)", () => {
    expect(CONTRACT_VARS_SRC).toContain('replace(/[^a-f0-9]/gi, "").slice(0, 16)');
  });
});

// ── 5. Photo gallery robustness ─────────────────────────────────────────────

describe("iter16: rental photo gallery", () => {
  it("getFranchizeRentalCard selects the photo counters (was always 0)", () => {
    expect(RUNTIME_SRC).toContain("start_photo_count, end_photo_count");
    expect(RUNTIME_SRC).toContain("startPhotoCount: typeof (data as any).start_photo_count");
  });

  it("gallery shows an explicit error row + retry on fetch failure (no more silent empty)", () => {
    expect(GALLERY_SRC).toContain("setLoadError");
    expect(GALLERY_SRC).toContain("Повторить");
    expect(GALLERY_SRC).toContain("Сессия истекла — откройте приложение заново");
  });

  it("gallery hides the amber «no photos» banner while an error is shown", () => {
    expect(GALLERY_SRC).toContain("!compact && !loadError && startPhotos.length === 0");
  });

  it("badge falls back to the server-side counter while the list is loading/failed", () => {
    expect(GALLERY_SRC).toContain("fallbackCount={initialStartCount}");
    expect(GALLERY_SRC).toContain("fallbackCount={initialEndCount}");
    expect(GALLERY_SRC).toContain("{photos.length > 0 ? photos.length : fallbackCount}");
  });
});
