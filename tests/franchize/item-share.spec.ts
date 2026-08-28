// tests/franchize/item-share.spec.ts
//
// Share button in the catalog bike modal (iter16):
//   1. item-share lib: deep-links (rent_ / sale_), flow resolution, share text
//   2. Item modal wiring: button rendered for bikes, hidden for
//      service/equipment items, dual-flow choice row, fallback chain order
//   3. useStartParamRouter: sale_{bikeId} deep-link support (buy_ alias)

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  buildItemDeepLinks,
  buildItemShareText,
  buildTelegramShareHref,
  resolveItemShareFlows,
} from "@/app/franchize/lib/item-share";

const MODAL_SRC = readFileSync(join(process.cwd(), "app/franchize/modals/Item.tsx"), "utf8");
const ROUTER_SRC = readFileSync(join(process.cwd(), "hooks/useStartParamRouter.ts"), "utf8");

// ── 1. Deep-link builders ────────────────────────────────────────────────────

describe("item-share: buildItemDeepLinks", () => {
  it("produces the exact rent_/sale_ startapp formats for the canonical bot", () => {
    const links = buildItemDeepLinks("ducati-1199-panigale-2012", "oneBikePlsBot");
    expect(links.rent).toBe("https://t.me/oneBikePlsBot/app?startapp=rent_ducati-1199-panigale-2012");
    expect(links.sale).toBe("https://t.me/oneBikePlsBot/app?startapp=sale_ducati-1199-panigale-2012");
  });

  it("sanitizes @ and junk from the bot username", () => {
    const links = buildItemDeepLinks("kawasaki-ex650k", "@One.Bike Pls!");
    // non-alphanumeric (except _) stripped → "OneBikePls"
    expect(links.rent).toBe("https://t.me/OneBikePls/app?startapp=rent_kawasaki-ex650k");
  });

  it("falls back to oneBikePlsBot when no bot username is provided", () => {
    const links = buildItemDeepLinks("falcon-gt-2026", "");
    expect(links.sale).toContain("https://t.me/oneBikePlsBot/app?startapp=sale_falcon-gt-2026");
  });

  it("lowercases and trims the bike id", () => {
    const links = buildItemDeepLinks("  Yamaha-R7  ", "oneBikePlsBot");
    expect(links.rent).toBe("https://t.me/oneBikePlsBot/app?startapp=rent_yamaha-r7");
  });
});

// ── 2. Flow resolution ───────────────────────────────────────────────────────

describe("item-share: resolveItemShareFlows", () => {
  it("rent-only bike → ['rent']", () => {
    expect(resolveItemShareFlows({ rentAvailable: true, saleAvailable: false })).toEqual(["rent"]);
  });

  it("sale-only bike → ['sale']", () => {
    expect(resolveItemShareFlows({ rentAvailable: false, saleAvailable: true })).toEqual(["sale"]);
  });

  it("dual bike → ['rent', 'sale'] (choice row in the modal)", () => {
    expect(resolveItemShareFlows({ rentAvailable: true, saleAvailable: true })).toEqual(["rent", "sale"]);
  });

  it("no pricing (service / equipment) → no flows, no share button", () => {
    expect(resolveItemShareFlows({ rentAvailable: false, saleAvailable: false })).toEqual([]);
  });
});

// ── 3. Share text ────────────────────────────────────────────────────────────

describe("item-share: buildItemShareText", () => {
  it("rent flow: title + flow word + rent price label", () => {
    const text = buildItemShareText({
      title: "Ducati 1199 Panigale",
      flow: "rent",
      rentPriceLabel: "12 000 ₽ / день",
    });
    expect(text).toBe("«Ducati 1199 Panigale» — аренда\n12 000 ₽ / день");
  });

  it("sale flow: title + flow word + formatted sale price", () => {
    const text = buildItemShareText({
      title: "Falcon GT",
      flow: "sale",
      salePrice: 390000,
    });
    // ru-RU grouping separator (NBSP in ICU) — compare against the same formatter
    expect(text).toBe(`«Falcon GT» — покупка\n${(390000).toLocaleString("ru-RU")} ₽`);
  });

  it("appends the crew name when provided", () => {
    const text = buildItemShareText({
      title: "Ducati 1199 Panigale",
      flow: "rent",
      crewName: "VIP Bike",
    });
    expect(text).toContain("— аренда в VIP Bike");
  });

  it("omits the price line when unavailable", () => {
    const text = buildItemShareText({ title: "Bike", flow: "sale", salePrice: null });
    expect(text).toBe("«Bike» — покупка");
    expect(text).not.toContain("₽");
  });

  it("ignores non-finite / zero / negative sale prices", () => {
    expect(buildItemShareText({ title: "B", flow: "sale", salePrice: 0 })).not.toContain("₽");
    expect(buildItemShareText({ title: "B", flow: "sale", salePrice: -5 })).not.toContain("₽");
    expect(buildItemShareText({ title: "B", flow: "sale", salePrice: Number.NaN })).not.toContain("₽");
  });
});

// ── 4. Telegram share href ───────────────────────────────────────────────────

describe("item-share: buildTelegramShareHref", () => {
  it("encodes url and text for the t.me share page", () => {
    const href = buildTelegramShareHref(
      "https://t.me/oneBikePlsBot/app?startapp=rent_ducati-1199-panigale-2012",
      "«Ducati 1199 Panigale» — аренда",
    );
    expect(href.startsWith("https://t.me/share/url?url=")).toBe(true);
    expect(href).toContain(encodeURIComponent("https://t.me/oneBikePlsBot/app?startapp=rent_ducati-1199-panigale-2012"));
    expect(href).toContain(encodeURIComponent("«Ducati 1199 Panigale» — аренда"));
  });
});

// ── 5. Item modal wiring (source guards) ─────────────────────────────────────

describe("item-share: Item modal wiring", () => {
  it("imports the share lib and renders a «Поделиться» button", () => {
    expect(MODAL_SRC).toContain('from "../lib/item-share"');
    expect(MODAL_SRC).toContain("Поделиться");
    expect(MODAL_SRC).toContain("<Share2");
  });

  it("hides the share button for service and equipment items", () => {
    expect(MODAL_SRC).toContain("shareFlows.length > 0 && !isServiceItem && !isEquipment");
  });

  it("single flow shares immediately; dual reveals the choice row (source guard)", () => {
    expect(MODAL_SRC).toContain("if (shareFlows.length === 1) {");
    expect(MODAL_SRC).toContain("shareChoiceOpen && shareFlows.length > 1");
    expect(MODAL_SRC).toContain("Ссылка на аренду");
    expect(MODAL_SRC).toContain("Ссылка на покупку");
  });

  it("share flow preference is availability-based (hasRentPrice / hasSalePrice)", () => {
    expect(MODAL_SRC).toContain("rentAvailable: hasRentPrice(item)");
    expect(MODAL_SRC).toContain("saleAvailable: hasSalePrice(item)");
  });

  it("fallback chain prefers openTelegramLink → openLink → window.open (source guard)", () => {
    expect(MODAL_SRC.indexOf("tg.openTelegramLink(shareHref)")).toBeGreaterThan(-1);
    expect(MODAL_SRC.indexOf("tg.openLink(shareHref)")).toBeGreaterThan(
      MODAL_SRC.indexOf("tg.openTelegramLink(shareHref)"),
    );
    expect(MODAL_SRC.indexOf('window.open(shareHref, "_blank"')).toBeGreaterThan(
      MODAL_SRC.indexOf("tg.openLink(shareHref)"),
    );
  });

  it("resets share state when the modal item changes (source guard)", () => {
    expect(MODAL_SRC).toContain("setShareChoiceOpen(false)");
  });
});

// ── 6. Router: sale_ deep-link support ───────────────────────────────────────

describe("item-share: useStartParamRouter sale_ deep-link", () => {
  it("routes sale_ through the buy flow (buy_ kept as legacy alias)", () => {
    expect(ROUTER_SRC).toContain('paramToProcess.startsWith("buy_") || paramToProcess.startsWith("sale_")');
    // Both prefixes route with flow "buy" → sale landing page
    expect(ROUTER_SRC).toContain('resolveFranchizeVehicleLink(paramToProcess, "buy")');
  });

  it("resolveFranchizeVehicleLink strips rent_ / buy_ / sale_ prefixes", () => {
    expect(ROUTER_SRC).toContain("/^(?:rent|buy|sale)_/i");
  });

  it("analytics_sale_ links are unaffected (parsed before the bare sale_ branch)", () => {
    // parseAnalyticsDeepLink handles analytics_sale_{saleId} — the bare
    // startsWith("sale_") check can never match "analytics_sale_..." because
    // that string starts with "analytics_".
    expect(ROUTER_SRC).toContain('rest.startsWith("sale_")');
  });
});
