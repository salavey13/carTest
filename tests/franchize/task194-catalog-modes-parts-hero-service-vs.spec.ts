// tests/franchize/task194-catalog-modes-parts-hero-service-vs.spec.ts
//
// task194 (boss, 2026-11-20 — четыре правки одним заходом):
//   1. /motoselection: hero дублирует ссылку на каталог экипажа (из нижней
//      витрины «Каталог и заказ услуг онлайн») полноценным CTA.
//   2. /motoselection: починен контур «искусство» в герое — центрированный
//      2px штрих рисовал ОБЕ кромки стойки (каркас) → тёмная пластина +
//      paint-order: stroke = одна чистая кромка снаружи.
//   3. Franchize-каталог: дефолтный режим = первый НЕПУСТОЙ в порядке рельсы
//      (rent→sale→service→equipment) — services-only экипажи больше не
//      открываются на пустой «Аренде» после crew_<slug> deep link.
//   4. «Запчасти»: рельса прячет пилюлю, если экипаж не vip-bike и не имеет
//      своих parts в Supabase; /parts для не-vip-bike рендерит СВОИ
//      Supabase-parts, а не хардкод Surge CSV.
//   5. Сравнение в карточке товара: для услуг — цена/условия вместо
//      байковых мощность/запас хода/вес; кандидаты только того же вида.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { firstNonEmptyCatalogMode } from "@/app/franchize/lib/catalog-utils";

const src = (p: string) => readFileSync(p, "utf8");

const makeItem = (over: Record<string, unknown> = {}) =>
  ({
    id: "x",
    pricePerDay: 0,
    saleAvailable: false,
    salePrice: null,
    rawSpecs: {},
    availabilityStatus: "available",
    ...over,
  }) as any;

describe("task194 · ③ default display mode = first non-empty", () => {
  it("services-only crew (moto-selection) opens on «Сервис», not «Аренда»", () => {
    const items = [makeItem({ rawSpecs: { service: true } })];
    expect(firstNonEmptyCatalogMode(items)).toBe("service");
  });

  it("rent-first crew keeps the classic default", () => {
    const items = [
      makeItem({ rawSpecs: { service: true } }),
      makeItem({ pricePerDay: 1500 }),
    ];
    expect(firstNonEmptyCatalogMode(items)).toBe("rent");
  });

  it("falls through rent→sale→service→equipment in rail order", () => {
    expect(firstNonEmptyCatalogMode([makeItem({ saleAvailable: true, salePrice: 1000, rawSpecs: { sale: true } })])).toBe("sale");
    expect(firstNonEmptyCatalogMode([makeItem({ rawSpecs: { equipment: true } })])).toBe("equipment");
  });

  it("empty catalog keeps «rent» (classic fallback)", () => {
    expect(firstNonEmptyCatalogMode([])).toBe("rent");
  });

  it("the main franchize page passes the computed mode into DisplayModeProvider", () => {
    const page = src("app/franchize/[slug]/page.tsx");
    expect(page).toContain("initialMode={firstNonEmptyCatalogMode(items)}");
  });
});

describe("task194 · «Запчасти» rail gate + own Supabase parts", () => {
  it("CrewHeader computes availability: vip-bike OR partsCount > 0", () => {
    const header = src("app/franchize/components/CrewHeader.tsx");
    expect(header).toContain('crew.slug === "vip-bike" || (crew.partsCount ?? 0) > 0');
    expect(header).toContain("partsAvailable");
  });

  it("crew-rail hides parts unless partsAvailable (covered behaviorally in crew-rail.spec.ts)", () => {
    const rail = src("app/franchize/lib/crew-rail.ts");
    expect(rail).toContain('pill.key === "parts" && options.partsAvailable !== true');
  });

  it("the hydration VM counts crew-owned parts rows (cars.type=parts)", () => {
    const runtime = src("app/franchize/actions-runtime.ts");
    expect(runtime).toContain("partsCount: number;");
    expect(runtime).toContain('.eq("type", "parts")');
    expect(runtime).toContain("partsCount: crewPartsCount ?? 0");
  });

  it("/parts: vip-bike keeps the hardcoded CSV, others load their OWN Supabase parts", () => {
    const page = src("app/franchize/[slug]/parts/page.tsx");
    expect(page).toContain('usesDefaultHardcodedList = (crew.slug || slug) === "vip-bike"');
    expect(page).toContain("loadCrewPartsData(crew.id)");
    expect(page).toContain("loadPartsData()");
  });

  it("crew-parts loader maps cars rows into the CSV loader's category shape", () => {
    const lib = src("app/franchize/lib/crew-parts.ts");
    expect(lib).toContain("@/lib/supabaseAdmin");
    expect(lib).toContain("sanitizePublicRawSpecs");
    expect(lib).not.toContain('.order("created_at"'); // cars has no such column
  });
});

describe("task194 · service comparator in the item modal", () => {
  const item = src("app/franchize/modals/Item.tsx");

  it("services compare by price + conditions, not bike specs", () => {
    expect(item).toContain("const vsSpecs = isServiceItem ? CATALOG_SERVICE_VS_SPECS : CATALOG_VS_SPECS;");
  });

  it("candidates are same-kind only: a service never pairs with a bike", () => {
    expect(item).toContain("hasServicePrice(candidate) === itemIsService");
  });

  it("the summary header says «услугой» for services and drops the propulsion label", () => {
    expect(item).toContain('isServiceItem ? "Сравнить с другой услугой" : "Сравнить с другой моделью"');
    expect(item).toContain("!isServiceItem &&");
  });

  it("the service spec set carries price + price-label keys", () => {
    // VsSpecRow.tsx is a component module vitest cannot inline-transform here —
    // pin the spec set as source (the crew-rail contract style).
    const vs = src("components/franchize/VsSpecRow.tsx");
    expect(vs).toContain("export const CATALOG_SERVICE_VS_SPECS: CatalogVsSpec[]");
    expect(vs).toContain('"dailyPrice"');
    expect(vs).toContain('"rent_price_label"');
  });
});

describe("task194 · /motoselection hero", () => {
  const landing = src("app/moto-selection/page.tsx");

  it("hero duplicates the bottom catalog link as a CTA", () => {
    // WEB_CATALOG_HREF now referenced from BOTH the hero CTA and the bottom card.
    expect(landing.match(/href=\{WEB_CATALOG_HREF\}/g)?.length).toBe(2);
    expect(landing).toContain("Каталог услуг");
  });

  it("the outline word uses the dark-plate + paint-order fix (no bare wireframe)", () => {
    expect(landing).toContain('paintOrder: "stroke"');
    expect(landing).toContain('WebkitTextStroke: `2px ${BRAND}`');
    expect(landing).toContain('color: "rgba(10,12,16,0.72)"');
    // The old near-transparent fill that produced the doubled-contour look is gone.
    expect(landing).not.toContain("rgba(255,255,255,0.07)");
  });
});
