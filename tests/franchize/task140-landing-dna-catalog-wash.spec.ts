import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * task 140 — batch spec:
 *
 * 1) Catalog card highlighted state (boss: «highlight looks like 30%
 *    narrower then needed», «ON PC LAYOUT ONLY», «not related to
 *    border»): the hover wash used to paint ONLY the info strip
 *    (~28% of card height). Now the accent covers the WHOLE card on
 *    PC (md:) — tinted photo wash + gradient blend into the solid
 *    accent info area, in ALL THREE card shapes.
 *
 * 2) /moto-selection DNA alignment to moto-selection.ru (REA dossier:
 *    orange nav, glass service cards, giant watermark words, brand
 *    tickers ×2 opposite, ghost numerals, squared price CTAs,
 *    white-on-orange, footer #111111 / form band #0f131c, floating
 *    messenger stack) + boss fixes (email Sanderkoff@yandex.ru,
 *    AKADEMIA logo light tinted bg).
 *
 * 3) /sly13 neon palette fix (getCrewPaletteBySlug passed the whole
 *    metadata instead of metadata.franchize → resolver fell back to
 *    the vip-bike gold DEFAULT) + quality raise to the same devices
 *    recolored cyan-on-graphite (ghost words per section, tickers,
 *    glass service cards, sly-lift, focus-visible outline).
 */

const repo = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(repo, p), "utf8");

const catalog = read("app/franchize/components/CatalogClient.tsx");
const moto = read("app/moto-selection/page.tsx");
const motoHistory = read("app/moto-selection/history/page.tsx");
const modal = read("app/moto-selection/FeedbackModal.tsx");
const sly = read("app/sly13/Sly13LandingClient.tsx");
const paletteAction = read("app/franchize/server-actions/palette.ts");

describe("task140 — catalog full-card hover wash (PC only)", () => {
  it("wash component: accent tint + md gate + hover opacity, gradient blend layer", () => {
    expect(catalog).toContain("function CatalogHoverWash()");
    // tint layer: PC only (md:block — touch hover-lock can't strand a tint),
    // invisible at rest, 20% accent on hover
    expect(catalog).toContain(
      'className="pointer-events-none absolute inset-0 hidden bg-[var(--catalog-accent)] opacity-0 transition-opacity duration-300 group-hover:opacity-20 md:block"',
    );
    // blend layer: bottom gradient bridges the photo into the solid-accent info strip
    expect(catalog).toContain(
      'className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-24 bg-gradient-to-t from-[var(--catalog-accent)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-70 md:block"',
    );
  });

  it("wash is used in ALL THREE card shapes: carousel, grid, combo offer", () => {
    const uses = catalog.match(/<CatalogHoverWash \/>/g) ?? [];
    expect(uses.length).toBe(3);
    expect(catalog).toContain("<CatalogHoverWash />");
    // the doc-comment explains the WHY (30%-narrower complaint) for future greps
    expect(catalog).toContain("full-card hover highlight");
    expect(catalog).toContain("30% narrower");
  });

  it("keyboard/TV focus frame (iter2 outline) is untouched — separate mechanism", () => {
    expect(catalog).toContain("interactionCardFocusStyle");
    // wash must not have replaced the outline-based focus contract
    expect(catalog).toContain("focusedItemId === item.id ? interactionCardFocusStyle");
  });
});

describe("task140 — /moto-selection DNA alignment", () => {
  it("orange brand nav bar (rec499418588 DNA) with white-on-orange chrome", () => {
    expect(moto).toContain('sticky top-0 z-50 bg-[var(--ms-accent)]');
    expect(moto).toContain('text-white/90 transition hover:text-black');
    // lead button inverted on the orange bar (white pill)
    expect(moto).toContain('rounded-full bg-white px-4 text-xs font-black uppercase tracking-[0.1em] text-black');
  });

  it("service cards = original glass anatomy: full-bleed photo + black 60% + blur(5px) + edge numeral + 200px pill", () => {
    // 2026-10-27 (task141): glass moved from inline style to the .ms-glass CSS
    // class — the hover-unblur transition (ground-truth behavior) needs real
    // CSS; inline styles can't express :hover. Recipe itself unchanged.
    expect(moto).toContain("background: rgba(0,0,0,0.6);");
    expect(moto).toContain("backdrop-filter: blur(5px);");
    expect(moto).toContain("rounded-[20px]");
    // numeral emerges from under the card's top edge (original: top = card − 53px)
    expect(moto).toContain("-mt-12 select-none text-[88px] font-bold leading-none text-white/85");
    // original pill: 200×48, radius 30, white 14px/600 text
    expect(moto).toContain("h-12 w-[200px] items-center justify-center self-center rounded-[30px] bg-[var(--ms-accent)]");
  });

  it("giant watermark word behind the services grid + reworded kicker (no duplication)", () => {
    expect(moto).toContain("наши услуги");
    expect(moto).toContain("text-white/[0.06] sm:text-[10vw]");
    expect(moto).toContain("7 направлений — от обучения до эвакуации");
  });

  it("blurred ghost words on the dark editorial sections (about/reviews DNA)", () => {
    const ghosts = moto.match(/filter: "blur\(2px\)"/g) ?? [];
    expect(ghosts.length).toBeGreaterThanOrEqual(3); // о нас + отзывы + академия
    expect(moto).toContain("о нас");
    expect(moto).toContain("отзывы");
  });

  it("two brand tickers with opposite directions (t1003 DNA)", () => {
    expect(moto.match(/<MsBrandTicker \/>/g)?.length).toBe(1);
    expect(moto.match(/<MsBrandTicker reverse \/>/g)?.length).toBe(1);
    expect(moto).toContain('ms-marquee 22s linear infinite${reverse ? " reverse" : ""}');
  });

  it("anchors clear the sticky header: every nav-target section has scroll-mt-20", () => {
    for (const id of ["services", "academy", "prices", "evac", "storage", "detailing", "about", "reviews", "partners", "contact"]) {
      const re = new RegExp(`id="${id}"[^>]*scroll-mt-20`);
      expect(re.test(moto), `section #${id} must carry scroll-mt-20`).toBe(true);
    }
  });

  it("squared orange CTAs on price sections (mixed button language of the original)", () => {
    expect((moto.match(/rounded-none bg-\[var\(--ms-accent\)\]/g) ?? []).length).toBe(3);
  });

  it("white-on-orange everywhere — old black-on-orange CTA recipe is banned", () => {
    expect(moto).not.toContain("bg-[var(--ms-accent)] px-7 text-sm font-bold uppercase tracking-[0.08em] text-black");
    expect(modal).not.toContain("tracking-[0.1em] text-black transition");
    expect(modal).toContain('<Check className="h-8 w-8 text-white" aria-hidden />');
  });

  it("footer #111111 + small print #707070; lead band #0f131c (rec499421521 / rec499515450)", () => {
    expect(moto).toContain('footer className="border-t border-white/10 bg-[#111111]"');
    expect(moto).toContain('id="contact" className="scroll-mt-20 border-t border-white/10 bg-[#0f131c]"');
    expect(moto).toContain("text-[#707070]");
  });

  it("floating messenger stack: TG / WhatsApp / Phone round accent buttons", () => {
    expect(moto).toContain('fixed bottom-4 right-4 z-40 flex flex-col gap-2');
    expect(moto).toContain('aria-label="Написать в Telegram"');
    expect(moto).toContain('aria-label="Написать в WhatsApp"');
    expect(moto).toContain('aria-label="Позвонить"');
  });

  it("boss fixes: correct email + AKADEMIA logo on light tinted bg", () => {
    const email = "Sanderkoff@yandex.ru";
    expect(moto).toContain(`const EMAIL = "${email}"`);
    expect(motoHistory).toContain(`const EMAIL = "${email}"`);
    expect(moto).not.toContain("moto-selection@yandex.ru");
    // light tinted bg behind transparent logos with dark text — usages:
    // АКАДЕМИЯ big image + АКАДЕМИЯ partner card + (2026-10-27, task141)
    // Байкленд partner card (black-orange SVG logo, same recipe)
    expect((moto.match(/bg-\[#f2efea\]/g) ?? []).length).toBe(3);
  });
});

describe("task140 — /sly13 neon palette + quality raise", () => {
  it("palette resolver reads metadata.franchize (root metadata.theme does not exist on any crew)", () => {
    expect(paletteAction).toContain(".franchize ?? metadata");
    expect(paletteAction).toContain("resolveFranchizeTheme(franchize)");
    // doc comment names the bug for future greps
    expect(paletteAction).toContain("vip-bike palette instead of neon");
  });

  it("ghost watermark per section — cyan 6% + blur(2px), TV-safe layering", () => {
    expect((sly.match(/<SlyGhostWord word="/g) ?? []).length).toBe(6);
    for (const w of ["платформа", "02", "сценарии", "04", "услуги", "партнёры"]) {
      expect(sly).toContain(`<SlyGhostWord word="${w}"`);
    }
    expect(sly).toContain("color-mix(in srgb, var(--sly-accent) 6%, transparent)");
    // parallax acts take the z-[1] variant (above scrim, below content)
    expect((sly.match(/<SlyGhostWord word="(02|04)" above \/>/g) ?? []).length).toBe(2);
  });

  it("all six nav-target sections are isolate+overflow-hidden with scroll-mt-20", () => {
    for (const id of ["platform", "money", "any", "ai", "services", "partners"]) {
      const re = new RegExp(`id="${id}"[\\s\\S]{0,220}?scroll-mt-20`);
      expect(re.test(sly), `section #${id} must carry scroll-mt-20`).toBe(true);
      const reIso = new RegExp(`id="${id}"[\\s\\S]{0,220}?isolate`);
      expect(reIso.test(sly), `section #${id} must isolate its -z ghost`).toBe(true);
    }
  });

  it("two cyan brand tickers, second one reversed (opposite-direction DNA)", () => {
    expect(sly.match(/<SlyBrandTicker p=\{p\} \/>/g)?.length).toBe(1);
    expect(sly.match(/<SlyBrandTicker p=\{p\} reverse \/>/g)?.length).toBe(1);
    expect(sly).toContain("залил каталог — получил CRM");
  });

  it("service cards = graphite glass anatomy with cyan numerals + 200px pill", () => {
    expect(sly).toContain('background: "rgba(15,20,25,0.72)"');
    expect(sly).toContain('backdropFilter: "blur(5px)"');
    expect(sly).toContain("min-h-[340px]");
    expect(sly).toContain("w-[200px] items-center justify-center self-center rounded-full");
    expect(sly).toContain("Оформить в каталоге");
    expect(sly).toContain("text-[72px] font-extrabold leading-none");
  });

  it("contour + AI cards lift on hover; keyboard focus outline rule present", () => {
    expect((sly.match(/className="sly-lift /g) ?? []).length).toBe(3);
    expect(sly).toContain(".sly-lift:hover");
    expect(sly).toContain(".sly-root a:focus-visible, .sly-root button:focus-visible");
    // task139-iter2 lesson: outline with offset, never box-shadow rings
    expect(sly).toContain("outline-offset: 2px;");
  });

  it("hero micro-pass: outline layer keeps fill mass for TV; lead paragraph balanced", () => {
    expect(sly).toContain('color: "color-mix(in srgb, var(--sly-text) 12%, transparent)"');
    expect(sly).toContain("text-balance");
  });

  it("TV-safe accent contract from task138 stays intact (no inline bg-clip residue)", () => {
    expect(sly).not.toMatch(/bg-clip-text|WebkitTextFillColor/);
    expect(moto).not.toMatch(/bg-clip-text|WebkitTextFillColor/);
    expect(sly).toContain("landing-accent-clip");
  });
});
