// Task 165 — REAL XTR payments + the full onboarding quest (boss follow-up to
// the task164 BESTSELLER tour, 29.10 evening):
//   • «add real xtr payments (search global components - there is donation
//     related one that can be used as example, also investigate hot-vibes …
//     i already tryed to implement gated by xtr access to items - think how
//     to implement properly and go!)»;
//   • «romani14 … owner of "moto-selection" … congratulatory notification,
//     invite link, onboarding tldr» (DB + bot side, see worklog);
//   • «look at main menu of golden standard vip-bike crew, it's header menu
//     links — i think all of them should be in this onboarding quest —
//     improve notes in quest steps — create screenshots of what to expect in
//     next hop, and upload compressed to storage and wire to quest steps
//     notes/modals»;
//   • «change picture on winter storage franchize page/tab for vip-bike»
//     (DB patch, recorded in the worklog).
//
// The XTR design follows the two in-repo precedents: donation (real
// sendInvoice, currency XTR, money lands in the payer's Telegram) + hotvibes
// ProtoCards (pending invoices row → webhook grants access idempotently on
// successful_payment). Item = the feature ACTIVATION voucher: paid → applied
// to the payer's own crew, or a claimable voucher for crew-less buyers.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  TOUR_FEATURES,
  TOUR_STOPS_TOTAL,
  tourFeatureByKey,
  tourNextFeature,
} from "../../components/roman-gift/tourFeatures";

const read = (p: string) => readFileSync(p, "utf8");
const component = read("components/roman-gift/RomanQuestCake.tsx");
const catalog = read("components/roman-gift/tourFeatures.ts");
const gate = read("app/api/roman-quest/gate/route.ts");
const activations = read("app/api/roman-quest/activations/route.ts");
const purchaseAction = read("app/roman-quest/actions.ts");
const webhookHandler = read("app/webhook-handlers/feature-tour.ts");
const proxy = read("app/webhook-handlers/proxy.ts");
const overview = read("app/gift/roman-quest/page.tsx");

const hostPage = (p: string) => read(`app/franchize/[slug]/${p}/page.tsx`);

// The golden-standard header of vip-bike (crews.metadata.franchize.header.
// menuLinks, prod snapshot 29.10) — boss: «all of them should be in this
// onboarding quest». Route template {slug} → the tour stops it via the
// vip-bike concrete routes; the ⭐ tour-hub link IS the quest itself.
const GOLDEN_STANDARD_HEADER_ROUTES = [
  "/franchize/{slug}", // Каталог → storefront (stop 2)
  "/franchize/{slug}/map-riders", // Карта → map_riders (13)
  "/franchize/{slug}/wheel", // Колесо фортуны → wheel (5)
  "/franchize/{slug}/electro-enduro", // Каталог-electro → electro_enduro (4)
  "/franchize/{slug}/configurator", // Конфигуратор → configurator (3)
  "/franchize/{slug}/about", // О нас → about (16)
  "/franchize/{slug}/contacts", // Контакты → contacts (17)
  "/franchize/{slug}/cart", // Корзина → cart (10)
  "/franchize/{slug}/profile", // Мои аренды → profile (11)
  "/franchize/{slug}/bikes", // Мотопарк → bikes (9)
  "/franchize/{slug}/community", // Сообщество → community (14)
  "/franchize/{slug}/onboarding", // Партнёрам → onboarding (18)
  "/franchize/{slug}/sales", // Продажи → sales (15)
  "/gift/roman-quest", // ⭐ Фичи экипажа — the quest hub itself
];

describe("task165 · the onboarding quest covers the ENTIRE golden-standard header", () => {
  it("19 stops — every vip-bike header menu link has a tour stop (the ⭐ hub is the quest)", () => {
    const stopHrefs = new Set(TOUR_FEATURES.map((f) => f.href));
    const missing: string[] = [];
    for (const link of GOLDEN_STANDARD_HEADER_ROUTES) {
      if (link === "/gift/roman-quest") continue; // the hub itself
      const concrete = link.replace("{slug}", "vip-bike");
      if (!stopHrefs.has(concrete)) missing.push(concrete);
    }
    expect(missing).toEqual([]);
    expect(TOUR_STOPS_TOTAL).toBe(19);
  });

  it("the 9 NEW stops exist with product copy and real prices", () => {
    for (const key of ["electro_enduro", "wheel", "bikes", "cart", "profile", "sales", "about", "contacts", "onboarding"]) {
      const f = tourFeatureByKey(key);
      expect(f, key).toBeTruthy();
      expect(f!.pitch.length).toBeGreaterThan(20);
      expect(f!.gives.length).toBeGreaterThan(10);
      expect(f!.priceStars).toBeGreaterThan(0);
    }
  });

  it("every stop carries a compressed screenshot from the tourpix bucket", () => {
    for (const f of TOUR_FEATURES) {
      expect(f.preview, f.key).toMatch(/^https:\/\/inmctohsodgdohamhzag\.supabase\.co\/storage\/v1\/object\/public\/tourpix\/task165\/[a-z_]+\.webp$/);
    }
    // compressed, not the raw 1MB captures: catalog file itself is small webp paths only
    expect(catalog).toContain("tourpix/task165");
    expect(catalog).not.toContain(".png");
  });

  it("the NEXT hop's screenshot is wired into the stop modal (boss: what to expect in next hop)", () => {
    expect(component).toContain("tourNextFeature");
    expect(component).toContain("nextFeature?.preview");
    expect(component).toContain('alt={`Следующая остановка: ${nextFeature.title}`}');
    expect(component).toContain("Дальше: {nextFeature.icon} {nextFeature.title}");
    // the last stop (19) has no next — the helper returns undefined safely
    expect(tourNextFeature(TOUR_STOPS_TOTAL)).toBeUndefined();
    expect(tourNextFeature(1)?.key).toBe("storefront");
  });
});

describe("task165 · real XTR purchase action (app/roman-quest/actions.ts)", () => {
  it("session-gated by the TG actor cookie; anonymous PCs can't buy", () => {
    expect(purchaseAction).toContain("verifyTelegramActorCookieValue");
    expect(purchaseAction).toContain('error: "unauthorized"');
  });

  it("validates the catalog key and refuses free features", () => {
    expect(purchaseAction).toContain("TOUR_FEATURE_KEYS.has(featureKey)");
    expect(purchaseAction).toContain('error: "free-feature"');
  });

  it("idempotent by receipt: an active purchase short-circuits with already-owned", () => {
    expect(purchaseAction).toContain("feature_tour_purchases");
    expect(purchaseAction).toContain('error: "already-owned"');
    expect(purchaseAction).toContain("Эта фича уже оплачена");
  });

  it("owners are steered to their FREE checkbox — no pointless charge", () => {
    expect(purchaseAction).toContain("включается бесплатно — галочкой владельца");
  });

  it("creates a PENDING feature_tour invoice first (webhook reads its metadata), then sends the REAL XTR invoice", () => {
    expect(purchaseAction).toContain('type: "feature_tour"');
    expect(purchaseAction).toContain("status: \"pending\"");
    expect(purchaseAction).toContain("currency: \"XTR\"");
    expect(purchaseAction).toContain("sendTelegramInvoice(userId, title, description, payload, feature.priceStars, 0, undefined)");
    // payload family is namespaced and id-stamped
    expect(purchaseAction).toContain("`featuretour_${featureKey}_${userId}_${Date.now()}`");
    // Telegram XTR title limit is 32 chars
    expect(purchaseAction).toContain(".slice(0, 32)");
  });

  it("amounts stay inside the Telegram XTR window (1..10000, enforced by sendTelegramInvoice)", () => {
    for (const f of TOUR_FEATURES) {
      expect(f.priceStars).toBeGreaterThanOrEqual(0);
      expect(f.priceStars).toBeLessThanOrEqual(10000);
    }
  });
});

describe("task165 · webhook grant (app/webhook-handlers/feature-tour.ts)", () => {
  it("registered in the payment proxy", () => {
    expect(proxy).toContain('import { featureTourHandler } from "./feature-tour"');
    expect(proxy).toContain("featureTourHandler,");
  });

  it("canHandle by type AND payload family; unknown feature keys escalate to admin, never silently pass", () => {
    expect(webhookHandler).toContain('invoice.type === "feature_tour"');
    expect(webhookHandler).toContain('payload.startsWith("featuretour_")');
    expect(webhookHandler).toContain("TOUR_FEATURE_KEYS.has(featureKey)");
    expect(webhookHandler).toContain("неизвестную фичу");
  });

  it("the grant: receipt in users.metadata (hotvibes-style) + paid activation on the payer's OWN crew", () => {
    expect(webhookHandler).toContain("feature_tour_purchases");
    expect(webhookHandler).toContain('.eq("owner_id", userId)');
    expect(webhookHandler).toContain("feature_tour: flags");
    // metadata MERGE — never a blind overwrite (cyberFitness etc. must survive)
    expect(webhookHandler).toContain("{ ...userMeta, feature_tour_purchases: purchases }");
    expect(webhookHandler).toContain("{ ...crewMeta, feature_tour: flags }");
  });

  it("payment-time owner resolution + honest failure paths (no paid-then-lost money)", () => {
    expect(webhookHandler).toContain("may have created/joined since");
    expect(webhookHandler).toContain("активация для экипажа");
    expect(webhookHandler).toContain('.neq("status", "paid")');
  });

  it("voucher copy for crew-less buyers is explicit about what the stars bought", () => {
    expect(webhookHandler).toContain("закреплена за тобой");
  });
});

describe("task165 · activations API — vouchers + purchases", () => {
  it("GET returns purchases for the session user (guest receipts AND owner vouchers)", () => {
    expect(activations).toContain("feature_tour_purchases");
    expect(activations).toContain("purchasesOf");
  });

  it("toggling ON a paid feature REDEEMS the voucher (applied + crew_slug, no second charge)", () => {
    expect(activations).toContain("receipt.applied !== true");
    expect(activations).toContain("[featureKey]: { ...receipt, applied: true, crew_slug: crew.slug }");
  });
});

describe("task165 · CTA surfaces — real stars button for TG sessions, demo for anonymous", () => {
  it("the gate now carries `authenticated` end-to-end", () => {
    expect(gate).toContain("authenticated: boolean");
    expect(component).toContain("authenticated: data?.authenticated === true");
    expect(component).toContain("canPayStars = !isBirthday && !isOwner && gate.authenticated");
  });

  it("⭐ button calls the server action; states: pending → sent / owned / error", () => {
    expect(component).toContain("purchaseTourFeatureAction(feature.key)");
    expect(component).toContain('buyState === "sent"');
    expect(component).toContain("Счёт на ⭐");
    expect(component).toContain('buyState === "pending"');
  });

  it("paid states render honestly (applied → включено; voucher → закреплена за вами)", () => {
    expect(component).toContain("paidApplied");
    expect(component).toContain("paidVoucher");
    expect(component).toContain("закреплена за вами");
  });

  it("anonymous PC guests keep the demo dialog (invoice needs a chat)", () => {
    expect(component).toContain("Оплата звёздами доступна внутри Telegram");
    expect(component).toContain("https://t.me/I_O_S_NN");
  });

  it("the overview cards show previews + paid badges for every authenticated session", () => {
    expect(overview).toContain("s.preview");
    expect(overview).toContain("purchases[s.key]?.status === \"active\"");
    expect(overview).toContain("gate.authenticated");
  });
});

describe("task165 · the 9 new host stops are wired (chain and gating)", () => {
  const NEW_STOPS: Array<[string, string, string]> = [
    // page, featureKey, nextHref
    ["electro-enduro", "electro_enduro", "/franchize/vip-bike/wheel"],
    ["wheel", "wheel", "/franchize/discovery"],
    ["bikes", "bikes", "/franchize/vip-bike/cart"],
    ["cart", "cart", "/franchize/vip-bike/profile"],
    ["profile", "profile", "/franchize/vip-bike/calc-explainer"],
    ["sales", "sales", "/franchize/vip-bike/about"],
    ["about", "about", "/franchize/vip-bike/contacts"],
    ["contacts", "contacts", "/franchize/vip-bike/onboarding"],
    ["onboarding", "onboarding", "/franchize/vip-bike/season-stats"],
  ];

  it.each(NEW_STOPS)("%s → next %s", (page, key, nextHref) => {
    const src = hostPage(page);
    expect(src).toContain('import { RomanQuestCake } from "@/components/roman-gift/RomanQuestCake"');
    expect(src).toContain(`featureKey="${key}"`);
    expect(src).toContain(`nextHref="${nextHref}"`);
    // the golden-standard gating: the tour rides the vip-bike crew's pages only
    expect(src).toContain('slug === "vip-bike"');
    // riddles describe the next hop (boss rule since the audio task)
    expect(src).toMatch(/riddle="[^"]{60,}"/);
  });

  it("host pages no longer hardcode stop numbers — the catalog is the single source", () => {
    for (const [page] of NEW_STOPS) {
      expect(hostPage(page)).not.toMatch(/stop=\{\d+\}/);
    }
    // the component falls back through the deprecated prop safely
    expect(component).toContain("const stop = feature?.stop ?? stopProp ?? 1;");
  });
});
