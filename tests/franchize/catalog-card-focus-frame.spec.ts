// tests/franchize/catalog-card-focus-frame.spec.ts
//
// BOSS 2026-10-25 (TV photo + «lets again try to fix highlighted state of
// item card in main franchize catalogue»):
//   «note how rerode r1's card is incorrectly highlighted, and lost focus
//    highlighted card to the left (falcon gt) has too narrow "highlight"
//    for card as well on pc/tv»
//
// ROOT CAUSE (verified live): the focus highlight was the 2px box-shadow
// ring from interactionRingStyle() painted on the card's INNER BUTTON.
// The button sits inside the <article> which has `overflow-hidden` + a 1px
// border → on compliant engines (PC Chromium) the ring is clipped away
// ENTIRELY (pixel-sampled the focused Falcon GT: zero accent pixels at the
// edges) while TV WebKit mis-clips the same shadow and LEAKS it as a 1-2px
// sliver along one edge — the «too narrow highlight», plus sliver geometry
// drift reads as the «incorrectly highlighted» card.
//
// THE FIX, pinned here:
//   1) new interactionCardFocusStyle() — 2px outline with a NEGATIVE
//      offset, painted on the <article>: hugs the rounded silhouette from
//      inside, can never be clipped by the card's own overflow;
//   2) the box-shadow ring is BANNED from card buttons (carousel, grid,
//      combo offer) — it remains only for non-clipped consumers (search
//      input / pills);
//   3) all three card shapes take the article-level frame: carousel card,
//      grid card, ComboOfferCard (prop renamed ringStyle → focusStyle).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { interactionCardFocusStyle, interactionRingStyle } from "@/app/franchize/lib/theme";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const CLIENT = "app/franchize/components/CatalogClient.tsx";
const THEME = "app/franchize/lib/theme.ts";

describe("catalog card focus frame · helper contract", () => {
  it("outline-based frame with NEGATIVE offset (clipping-proof, radius-hugging)", () => {
    const fixed = interactionCardFocusStyle({
      isAuto: false,
      mode: "dark",
      palette: { accentMain: "#FFD700" },
    } as never);
    expect(fixed.outline).toMatch(/^2px solid (rgba\(255, 215, 0, 0\.85\)|#FFD700)$/);
    expect(String(fixed.outlineOffset)).toMatch(/^-/);

    const auto = interactionCardFocusStyle({ isAuto: true } as never);
    expect(auto.outline).toContain("2px solid");
    expect(auto.outline).toContain("var(--franchize-accent-main)");
    expect(String(auto.outlineOffset)).toMatch(/^-/);
  });

  it("old box-shadow ring helper is untouched (still used by search/pills)", () => {
    expect(interactionRingStyle({ isAuto: true } as never).boxShadow).toContain("0 0 0 2px");
  });
});

describe("catalog card focus frame · CatalogClient wiring", () => {
  const src = read(CLIENT);

  it("box-shadow ring is BANNED from card buttons (the clipped-sliver bug)", () => {
    expect(src).not.toContain("focusedItemId === item.id ? interactionRingStyle(crew.theme)");
    expect(src).not.toContain("focused ? ringStyle : undefined");
  });

  it("carousel + grid articles merge interactionCardFocusStyle when focused", () => {
    expect((src.match(/\.\.\.\(focusedItemId === item\.id \? interactionCardFocusStyle\(crew\.theme\) : \{\}\),/g) ?? []).length).toBe(2);
  });

  it("ComboOfferCard takes focusStyle and paints it on the article, not the button", () => {
    expect(src).toContain("focusStyle,\n}: {");
    expect(src).toContain("focusStyle: React.CSSProperties;");
    expect(src).not.toContain("ringStyle");
    const comboBlock = src.slice(src.indexOf("function ComboOfferCard"), src.indexOf("function ComboOfferCard") + 4000);
    expect(comboBlock).toContain("...(focused ? focusStyle : {}),");
    // the combo button OPENING tag no longer carries any inline ring style
    const btnStart = comboBlock.indexOf("<button");
    const comboButtonOpen = comboBlock.slice(btnStart, comboBlock.indexOf(">", btnStart));
    expect(comboButtonOpen).not.toContain("style=");
  });

  it("call site passes interactionCardFocusStyle", () => {
    expect(src).toContain("focusStyle={interactionCardFocusStyle(crew.theme)}");
  });

  it("theme.ts documents why the frame must stay on the article", () => {
    expect(read(THEME)).toContain("interactionCardFocusStyle");
    expect(read(THEME)).toContain("overflow-hidden");
  });
});
