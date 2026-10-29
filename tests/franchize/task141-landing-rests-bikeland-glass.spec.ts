/**
 * task141 — landing batch: full-screen rest picture sections (/sly13),
 * bikeland transparent-SVG partner card + service-glass hover unblur
 * (/moto-selection), history ghost word (B-P3.5).
 *
 * Ground truth / boss asks (2026-10-27):
 * - «/sly13 landing looks like a wall of text — we need full screen rest
 *   picture sections» → two 100svh picture breaks between the text acts.
 * - «change first partner picture with one from /vipbikerental (bikeland —
 *   i added transparent background there)» → the root vip-bike landing's
 *   bikeland SVG (transparent) replaces the 900×900 filled JPG.
 * - «on ground truth moto-selection.ru picture was unblurred upon hover»
 *   → .ms-glass drops blur(5px)→blur(0) under the cursor (PC only).
 * - B-P3.5 of landing-ux-improvement-prompt.md → history hero ghost word.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const moto = readFileSync(resolve(ROOT, "app/moto-selection/page.tsx"), "utf8");
const history = readFileSync(resolve(ROOT, "app/moto-selection/history/page.tsx"), "utf8");
const sly = readFileSync(resolve(ROOT, "app/salavey13/Sly13LandingClient.tsx"), "utf8");

describe("task141 — /moto-selection bikeland partner card (RE-BASELINED task145 logo-grid)", () => {
  // task145 (parallel commit): partner cards moved into the shared
  // components/landing/PartnerLogoGrid — the page now passes logoSrc +
  // backing instead of rendering the card inline. Assertions follow.
  it("uses the transparent SVG logo shared with the root vip-bike landing", () => {
    // same asset the root landing (app/page.tsx partners) hotlinks
    expect(moto).toContain('BIKELAND_LOGO_SVG = "https://bikeland.ru/local/templates/2019/svg/logo.svg"');
    // the filled 900×900 JPG is gone from the page (and from the IMG map)
    expect(moto).not.toContain("partnerBikeland");
    expect(moto).not.toContain("a85d6fbe3e31832458bb");
    // the logo goes into the shared grid as logoSrc (grid renders plain <img>)
    expect(moto).toContain("logoSrc: BIKELAND_LOGO_SVG");
  });

  it("card wears the light tint like АКАДЕМИЯ — the logo is orange+BLACK on transparent", () => {
    // black logo text would vanish on bg-black; #f2efea = the academy recipe,
    // now expressed as the grid tile's `backing` + lightBacking flag
    const grid = moto.slice(moto.indexOf("<PartnerLogoGrid"), moto.indexOf("</PartnerLogoGrid") > 0 ? moto.indexOf("</PartnerLogoGrid") : moto.length);
    expect(grid).toContain('backing: "#f2efea"');
    expect(grid).toContain("lightBacking: true");
  });

  it("grid renders plain <img> logos (SVG passes the optimizer untouched)", () => {
    const gridComp = readFileSync(resolve(ROOT, "components/landing/PartnerLogoGrid.tsx"), "utf8");
    expect(gridComp).toContain("<img");
    expect(gridComp).not.toContain("next/image");
  });
});

describe("task141 — service glass hover unblur (RE-BASELINED task144 ground truth)", () => {
  // task144 probed moto-selection.ru with playwright: hover does NOT go
  // blur(5)→blur(0) with the tint kept — the WHOLE glass (tint + blur)
  // fades to opacity 0. The old assertions (transition on backdrop-filter,
  // blur(0px) hover, tint stays) described the pre-probe guess and failed
  // since the task144 recipe change; re-baselined 2026-10-27 (task145).
  it(".ms-glass class carries the original recipe (black 60% + blur 5px)", () => {
    expect(moto).toContain(".ms-glass {");
    expect(moto).toContain("background: rgba(0,0,0,0.6);");
    expect(moto).toContain("-webkit-backdrop-filter: blur(5px);");
    expect(moto).toContain("backdrop-filter: blur(5px);");
    // the unblur animates as a whole-glass opacity fade (ground truth)
    expect(moto).toMatch(/transition: opacity [\d.]+s ease;/);
  });

  it("hover DISSOLVES the glass entirely — PC-only gate (touch uses data-active)", () => {
    expect(moto).toContain("@media (hover: hover) and (pointer: fine) {");
    const hoverBlock = moto.match(/@media \(hover: hover\) and \(pointer: fine\) \{[\s\S]*?\n        \}/)?.[0] ?? "";
    expect(hoverBlock).toContain(".group:hover .ms-glass { opacity: 0; }");
    // task144 probe: tint AND blur both go — no partial unblur
    expect(hoverBlock).not.toContain("backdrop-filter: blur(0px)");
  });

  it("cards reference the class; touch/focus reveal wired via data-active", () => {
    // the grid markup lives in the client component since task144
    const grid = readFileSync(resolve(ROOT, "app/moto-selection/ServicesGrid.tsx"), "utf8");
    expect(grid).toContain('<div className="ms-glass absolute inset-0" aria-hidden />');
    expect(moto).toContain('.ms-card[data-active="true"] .ms-glass');
    expect(moto).toContain('.ms-card:focus-visible .ms-glass');
    expect(moto).not.toContain('backdropFilter: "blur(5px)"');
    expect(moto).not.toContain('WebkitBackdropFilter: "blur(5px)"');
  });
});

describe("task141 — /sly13 full-screen rest picture sections", () => {
  it("two 100svh breaks with true full-bleed width", () => {
    const sections = sly.match(/mx-\[calc\(50%-50vw\)\] flex h-\[100svh\] min-h-\[560px\] items-end overflow-hidden/g) ?? [];
    expect(sections.length).toBe(2);
    // no ids: rests are not nav targets (no scroll-mt needed)
    expect(sly).not.toContain('id="rest');
  });

  it("rest images come from the same electro-neon studio series as acts 02/04", () => {
    expect(sly).toContain("restGold: `${SB}/ducati-panigale-s-electro-gold/image_1.jpg`");
    expect(sly).toContain("restAero: `${SB}/ducati-panigale-s-electro-black-aero/image_1.jpg`");
    // the picture IS the content here — near-full opacity, unlike the 45% acts
    expect((sly.match(/imageClassName="opacity-90"/g) ?? []).length).toBe(2);
    // ParallaxBg default stays muted for the text acts
    expect(sly).toContain('imageClassName = "opacity-45"');
  });

  it("each rest carries its own parallax target + short mono caption, zero cards", () => {
    expect(sly).toContain("const restGoldRef = useRef<HTMLElement>(null);");
    expect(sly).toContain("const restAeroRef = useRef<HTMLElement>(null);");
    expect((sly.match(/targetRef=\{restGoldRef\}/g) ?? []).length).toBe(1);
    expect((sly.match(/targetRef=\{restAeroRef\}/g) ?? []).length).toBe(1);
    expect((sly.match(/sly13 · передышка/g) ?? []).length).toBe(2);
    expect(sly).toContain("Прокат как");
    expect(sly).toContain("не спит");
    // rest = no SpotlightCard / no bento inside the breaks
    for (const rest of [sly.slice(sly.indexOf("ПЕРЕДЫШКА · ЗОЛОТО"), sly.indexOf("02 · ДЕНЬГИ")), sly.slice(sly.indexOf("ПЕРЕДЫШКА · CYAN"), sly.indexOf("04 · AI-ВОРКЕР"))]) {
      expect(rest).not.toContain("SpotlightCard");
      expect(rest).not.toContain("<Image");
    }
  });

  it("full-bleed overflow guard: clip on the root, sticky nav intact", () => {
    // clip (not hidden!) — overflow-x: clip does NOT create a scroll container,
    // so the sticky header keeps sticking to the viewport
    expect(sly).toContain('"sly-root min-h-screen overflow-x-clip"');
    expect(sly).not.toContain("sly-root min-h-screen overflow-x-hidden");
  });
});

describe("task141 — history page ghost word (B-P3.5)", () => {
  it("blurred «история» ghost above the hero scrims, under the content", () => {
    expect(history).toMatch(/blur-\[2px\][^>]*>\s*история/s);
    expect(history).toContain("text-[16vw] font-black uppercase leading-none tracking-tight text-white/[0.05] blur-[2px]");
    // ghost paints after the absolute photo container (DOM order wins at equal
    // stacking) and before the z-10 content wrapper
    const ghostIdx = history.indexOf("whitespace-nowrap text-[16vw]");
    const photoIdx = history.indexOf('className="absolute inset-0" aria-hidden');
    const contentIdx = history.indexOf('relative z-10 mx-auto w-full max-w-7xl px-4 pb-14 pt-24');
    expect(photoIdx).toBeGreaterThan(-1);
    expect(ghostIdx).toBeGreaterThan(photoIdx);
    expect(contentIdx).toBeGreaterThan(ghostIdx);
  });
});
