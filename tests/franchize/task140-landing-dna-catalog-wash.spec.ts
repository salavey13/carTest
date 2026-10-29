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
  it("wash component: accent tint + SYNCED melt gradient (iter6)", () => {
    expect(catalog).toContain("function CatalogHoverWash()");
    // tint layer: PC only (md:block — touch hover-lock can't strand a tint),
    // invisible at rest; task141 iter4: 30% on hover (20% was invisible on
    // the dark studio photos — boss kept reading the highlight as partial)
    expect(catalog).toContain(
      'className="pointer-events-none absolute inset-0 hidden bg-[var(--catalog-accent,#d99a00)] opacity-0 transition-opacity duration-300 group-hover:opacity-30 md:block"',
    );
    // iter6: ONE melt element whose COLOR transitions (no cross-fade — the
    // iter5 two-gradient cross-fade let the photo bleed through mid-transition
    // and lagged behind the strip: boss «the card part kinda lags a
    // millisecond revealing seam»). The interpolation contract lives in
    // globals.css (@property --catalog-melt-color).
    expect(catalog).toContain('className="catalog-melt pointer-events-none absolute inset-x-0 bottom-0 h-32"');
    const css = read("app/globals.css");
    // task166: every var() carries a concrete dark-brand fallback — engines
    // without CSS custom property support (lite/proxy browsers, ancient
    // WebViews) render the accent instead of dropping the declaration.
    expect(css).toContain("@property --catalog-melt-color");
    expect(css).toContain("--catalog-melt-color: var(--catalog-card-bg,#111217)");
    expect(css).toContain("transition: --catalog-melt-color 300ms cubic-bezier(0.4, 0, 0.2, 1)");
    expect(css).toContain("[data-catalog-item]:hover .catalog-melt");
    expect(css).toContain("--catalog-melt-color: var(--catalog-accent,#d99a00)");
  });

  it("task141 iter4: the BASE highlight layer is the ARTICLE background (var flip)", () => {
    // card bg is emitted through CSS vars with the variant as fallback…
    // task 149: variants are FLAT now (gradient/box-shadow depth read as
    // TV glitches — see catalogCardVariantStyles), so only --card-base-bg
    // remains; the hover flip still owns the whole border-box.
    const theme = read("app/franchize/lib/theme.ts");
    expect(theme).toContain("var(--card-base-bg, ");
    // task 149/147: variant depth is GONE (gradient + soft shadows read as
    // TV glitches) — every variant resolves to an opaque bg-card face
    expect(theme).not.toContain("linear-gradient(to bottom, ${withAlpha(palette.bgCard");
    expect(theme).not.toContain("0 12px 20px");
    // …and ONE globals.css rule flips that var on PC hover — coverage of
    // the whole border-box is structural, no inner element can leave a gap
    const css = read("app/globals.css");
    expect(css).toContain("[data-catalog-item]:hover");
    expect(css).toContain("--card-base-bg: var(--catalog-accent,#d99a00)");
    expect(css).toContain("--card-base-img: none");
    // info strips transition bg-card → accent DIRECTLY on hover (iter6:
    // same 300ms curve as the melt gradient — the fade-to-transparent
    // recipe blended on an accent² curve and lagged behind the picture)
    expect(catalog).toContain("md:group-hover:bg-[var(--catalog-accent,#d99a00)]");
    expect(catalog).not.toContain("md:group-hover:bg-transparent");
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
    // 2026-10-27 (task144): the grid is a client component (MsServicesGrid) —
    // touch needed the reveal tap-gate; the card anatomy moved with it.
    const grid = read("app/moto-selection/ServicesGrid.tsx");
    expect(grid).toContain("rounded-[20px]");
    // numeral emerges from under the card's top edge (original: top = card − 53px)
    expect(grid).toContain("-mt-12 select-none text-[88px] font-bold leading-none text-white/85");
    // original pill: 200×48, radius 30, white 14px/600 text
    expect(grid).toContain("h-12 w-[200px] items-center justify-center self-center rounded-[30px] bg-[var(--ms-accent)]");
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
    expect(moto).toContain('bg-[#0f131c]"');
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
    // light tinted bg behind transparent logos with dark text. task145
    // re-baseline: partner tiles moved into PartnerLogoGrid — the tint
    // travels as `backing: "#f2efea"` props (Академия + Байкленд), the big
    // АКАДЕМИЯ image keeps the bg-[#f2efea] class.
    expect((moto.match(/bg-\[#f2efea\]/g) ?? []).length).toBe(1);
    expect((moto.match(/backing: "#f2efea"/g) ?? []).length).toBe(2);
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
    // task 145-б: стекло переехало из inline-стилей в CSS-класс .sly-glass
    // и РАСТВОРЯЕТСЯ на ховере/первом тапе (ДНК /moto-selection, ground
    // truth оригинала: тинт И blur уходят вместе, opacity 1→0).
    expect(sly).toContain("rgba(15, 20, 25, 0.72)");
    expect(sly).toContain("backdrop-filter: blur(5px)");
    expect(sly).toContain(".sly-svc:hover .sly-glass { opacity: 0; }");
    expect(sly).toContain('.sly-svc[data-reveal-active="true"] .sly-glass');
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

describe("task145 — rest acts, full-width wordmarks, glass pollination", () => {
  const georg = read("app/georg-electro/page.tsx");
  const leorus = read("app/leorus/LeorusLandingClient.tsx");
  const leorusCss = read("app/leorus/leorus.css");
  const root = read("app/page.tsx");
  const restBreak = read("components/landings/RestBreak.tsx");
  const wordmark = read("components/landings/GhostWordmark.tsx");
  const glass = read("components/landings/GlassServiceCard.tsx");

  it("shared RestBreak exists (sly13 pollination) and 4 more landings breathe", () => {
    expect(restBreak).toContain("useScroll");
    expect(restBreak).toContain("h-[100svh]");
    // moto-selection: академия-дым кадр между детейлингом и «о нас»
    expect(moto).toContain("<RestBreak");
    expect(moto).toContain("Мотоцикл любит");
    // georg: мастерская между «как работаем» и партнёрами
    expect(georg).toContain("Пока ты катаешь —");
    // leorus: ANANDA перед формой
    expect(leorus).toContain("Тишина перед");
    // root: золотая Panigale перед партнёрами
    expect(root).toContain("садись — едь");
  });

  it("GhostWordmark spans the FULL width by construction (SVG textLength) — no more MOTO.SELECTI clipping", () => {
    expect(wordmark).toContain('textLength="1000"');
    expect(wordmark).toContain('lengthAdjust="spacingAndGlyphs"');
    // the broken 13vw CSS version is gone from /moto-selection
    expect(moto).not.toContain("whitespace-nowrap text-center text-[13vw]");
    expect(moto).toContain("<GhostWordmark");
    // pollinated: SLY13 / GEORG.ELECTRO / LEO.RUS / VIP.BIKE
    expect(sly).toContain('text: "SLY"');
    expect(georg).toContain('text: "GEORG"');
    expect(leorus).toContain('text: "LEO"');
    expect(root).toContain('text: "VIP"');
  });

  it("ms-glass design pollinated: georg services use GlassServiceCard with tap-gate", () => {
    expect(glass).toContain("data-lead-modal-open");
    expect(glass).toContain('gs-card[data-active="true"] .gs-glass');
    expect(georg).toContain("<GlassServiceCard");
    expect(georg).toContain("<GlassServiceCardStyle />");
    // old static card layout is gone
    expect(georg).not.toContain('className="group flex flex-col overflow-hidden rounded-3xl border transition-transform hover:-translate-y-1"');
  });

  it("leorus dir-cards: photos added + veil unblurs on hover/tap", () => {
    for (const img of ["case-ananda.jpg", "case-clubs.jpg", "case-orudjovnews.jpg", "case-corporates.jpg"]) {
      expect(leorus).toContain(`dir-card__bg" src="/leorus/${img}`);
    }
    expect(leorusCss).toContain(".dir-card__veil");
    expect(leorusCss).toContain('blur(0) brightness(0.7)');
    expect(leorusCss).toContain('[data-reveal-active="true"] .dir-card__veil');
    // touch gate wired in the client
    expect(leorus).toContain("dirGate(");
  });
});

/**
 * task 149 — TV (720p) catalog card glitch batch (boss photo report):
 * 1/ «strange glow behind some item cards» + 2/ «glow overlaps partially
 * card on the left, lower z than the image, reveals the seam» — variant
 * depth (article gradient + soft box-shadows) is GONE (flat bordered face).
 * 3/ «second card has partial bg color cover, dark part on the right side»
 * — same article gradient exposed at composited-layer edges — gone with it.
 * 4/ «забронировать button not centered, jumps with title lines» — CTA is
 * pinned to the strip floor (mt-auto) + title reserves a 2-line box.
 * 5/ «quick specs balloons contrast vs accent gradient in hover/selected
 * state — turn specs to primary (black) in highlighted state» — the
 * balloon classes never compiled in TW3 (opacity modifier on var color is
 * dropped → transparent); now .catalog-spec-chip = real balloon at rest,
 * solid primary black on hover AND :focus-within (TV D-pads), same 300ms
 * curve as the melt. Availability pill got the same balloon fix.
 */
describe("task149 — TV/720p catalog card glitch batch", () => {
  const repo = resolve(__dirname, "../..");
  const read = (p: string) => readFileSync(resolve(repo, p), "utf8");
  const catalog = read("app/franchize/components/CatalogClient.tsx");
  const css = read("app/globals.css");
  const theme = read("app/franchize/lib/theme.ts");

  it("glow: variants are flat — no article gradient, no decorative box-shadows", () => {
    expect(theme).not.toContain("linear-gradient(to bottom, ${withAlpha(palette.bgCard");
    expect(theme).not.toContain("0 12px 20px");
    expect(theme).not.toContain("0 8px 24px");
    // variant faces are equal now: one bordered, bg-card face; hover flip untouched
    expect((theme.match(/catalogCardVariantStyles/g) || []).length).toBeGreaterThanOrEqual(1);
  });

  it("spec chips: real balloon class on BOTH card shapes, broken /65 class gone", () => {
    expect((catalog.match(/className="catalog-spec-chip/g) || []).length).toBe(2);
    expect(catalog).not.toContain("bg-[var(--catalog-bg)]/65");
    expect(css).toContain(".catalog-spec-chip {");
    expect(css).toContain("rgba(10, 10, 10, 0.6)");
  });

  it("highlighted state drills INTO the chips: primary balloon on hover AND focus-within (TV)", () => {
    expect(css).toContain("[data-catalog-item]:hover .catalog-spec-chip");
    expect(css).toContain("[data-catalog-item]:focus-within .catalog-spec-chip");
    expect(css).toContain("background-color: var(--catalog-accent-contrast, #0a0a0a)");
  });

  it("availability pill: same balloon fix (broken /60 and /70 classes gone)", () => {
    expect((catalog.match(/catalog-avail-pill/g) || []).length).toBe(3);
    expect(catalog).not.toContain("bg-[var(--catalog-bg)]/60");
    expect(catalog).not.toContain("bg-[var(--catalog-bg)]/70");
    expect(css).toContain(".catalog-avail-pill");
  });

  it("CTA is pinned to the strip floor in BOTH card shapes (no more jumping)", () => {
    expect((catalog.match(/className="mt-auto pt-3"/g) || []).length).toBe(2);
    expect(catalog).not.toContain('className="mt-3"');
  });

  it("title reserves a 2-line box — price row stops shifting between titles", () => {
    expect((catalog.match(/min-h-\[2\.5rem\]/g) || []).length).toBe(2);
  });
});
