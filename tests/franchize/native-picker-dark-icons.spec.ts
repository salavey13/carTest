// tests/franchize/native-picker-dark-icons.spec.ts
//
// BOSS 2026-10-25 (iter2, same day as the robust-pickers round):
//   «tested date picker in franchize catalog item modal - works fine, but
//    icons inside date/time selectors are black not only in light theme,
//    but in dark as well - please fix icon color in darkmode to white ...
//    maybe even make it accent colored (from crew dark palette)?»
//
// ROOT CAUSE (why the first round painted BLACK in dark): Item.tsx sets
// inline `colorScheme: "dark"` on the pickers → compliant engines (desktop
// Chrome, Android WebView, Telegram Desktop) already paint the native
// 📅/🕒 glyph WHITE — and the first-round rule `filter: invert(1)
// brightness(1.4)` inverted that white glyph back to black. Only
// colorScheme-blind WebKit builds (TVs) kept the intended white.
//
// THE FIX, pinned here:
//   1) dark fallback = `brightness(0) invert(1)` — collapses ANY source
//      color to black then flips to pure white → deterministic white on
//      every engine, colorScheme honored or not;
//   2) progressive accent — engines with mask support swap the UA glyph
//      for a calendar/clock silhouette painted with the crew accent token
//      `--item-accent` (fallback #ffffff outside the modal);
//   3) cascade order — the @supports accent block must come AFTER the
//      fallback dark rule (it neutralizes filter with `filter: none`);
//   4) light theme untouched (boss-verified black-on-light);
//   5) all 7 Item.tsx pickers (rental ×4, service date, testdrive ×2)
//      carry the theme-conditional classes, and the two testdrive inputs
//      now also set inline colorScheme like the other five.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const GLOBALS = "app/globals.css";
const ITEM = "app/franchize/modals/Item.tsx";

describe("native picker dark icons · deterministic white fallback", () => {
  const css = read(GLOBALS);

  it("dark rule = brightness(0) invert(1) (white from ANY source color)", () => {
    expect(css).toContain(
      ".fr-native-picker.fr-picker-dark::-webkit-calendar-picker-indicator {\n  filter: brightness(0) invert(1);\n}",
    );
    // The old double-invert must be gone — it flipped compliant engines'
    // already-white glyphs back to black (the exact bug the boss reported).
    expect(css).not.toContain("invert(1) brightness(1.4)");
  });

  it("light rule untouched (boss-verified black-on-light)", () => {
    expect(css).toContain(
      ".fr-native-picker.fr-picker-light::-webkit-calendar-picker-indicator {\n  filter: brightness(0) opacity(0.75);\n}",
    );
  });

  it("@supports accent block comes AFTER the fallback rule (cascade: filter:none wins)", () => {
    const fallbackIdx = css.indexOf(
      ".fr-native-picker.fr-picker-dark::-webkit-calendar-picker-indicator {\n  filter: brightness(0) invert(1);\n}",
    );
    const supportsIdx = css.indexOf("@supports ((mask: none) or (-webkit-mask: none))");
    expect(fallbackIdx).toBeGreaterThan(-1);
    expect(supportsIdx).toBeGreaterThan(fallbackIdx);
  });

  it("accent block neutralizes the filter and fills with the crew accent token", () => {
    const supportsBlock = css.slice(css.indexOf("@supports ((mask: none) or (-webkit-mask: none))"));
    expect(supportsBlock).toContain("filter: none;");
    expect(supportsBlock).toContain("background-image: none;");
    expect(supportsBlock).toContain("background-color: var(--item-accent, #ffffff);");
    // both prefixed and unprefixed mask (Safari < 15.4 needs -webkit-)
    expect(supportsBlock).toContain("-webkit-mask: url(\"data:image/svg+xml");
    expect(supportsBlock).toContain("mask: url(\"data:image/svg+xml");
    // calendar silhouette for dates, clock silhouette for time inputs —
    // ×2 each since iter3 (boss: accent in LIGHT theme too): dark + light
    expect(supportsBlock).toContain(".fr-native-picker.fr-picker-dark[type=\"time\"]::-webkit-calendar-picker-indicator");
    expect(supportsBlock).toContain(".fr-native-picker.fr-picker-light[type=\"time\"]::-webkit-calendar-picker-indicator");
    expect((supportsBlock.match(/%3Ccircle cx='12' cy='12' r='10'/g) ?? []).length).toBe(4);
    expect((supportsBlock.match(/%3Crect x='3' y='4' width='18' height='18' rx='2'/g) ?? []).length).toBe(4);
  });

  it("accent mask scales with contain/center/no-repeat (no clipped or oversized glyph)", () => {
    const supportsBlock = css.slice(css.indexOf("@supports ((mask: none) or (-webkit-mask: none))"));
    expect((supportsBlock.match(/center \/ contain no-repeat/g) ?? []).length).toBe(4);
  });

  it("iter3: light theme gets the accent mask too, with dark-slate var fallback", () => {
    const supportsBlock = css.slice(css.indexOf("@supports ((mask: none) or (-webkit-mask: none))"));
    // anchor INSIDE the @supports block (the mask-less fallback rule above
    // shares the same selector, so a plain selector indexOf would grab it)
    const lightBlock = supportsBlock.slice(supportsBlock.indexOf(".fr-native-picker.fr-picker-light::-webkit-calendar-picker-indicator {\n    filter: none;"));
    expect(lightBlock).toContain("background-color: var(--item-accent, #111827);");
    expect(lightBlock).toContain("background-image: none;");
    expect((lightBlock.match(/center \/ contain no-repeat/g) ?? []).length).toBe(2); // prefixed + unprefixed shorthand
    // light mask-less fallback (black glyph) stays for old TV WebKit
    expect(css).toContain(
      ".fr-native-picker.fr-picker-light::-webkit-calendar-picker-indicator {\n  filter: brightness(0) opacity(0.75);\n}",
    );
  });
});

describe("native picker dark icons · Item.tsx wiring", () => {
  const src = read(ITEM);

  it("every fr-native-picker input pairs with the theme-conditional picker class", () => {
    const occurrences = (src.match(/fr-native-picker \$\{T\.isLight/g) ?? []).length;
    // 4 rental date/time + 1 service date + 2 testdrive date/time
    expect(occurrences).toBe(7);
  });

  it("all five previously-wired pickers still set inline colorScheme", () => {
    expect((src.match(/colorScheme: T\.isLight \? "light" : "dark"/g) ?? []).length).toBe(7);
  });

  it("openNativePicker click-to-open helper is still wired", () => {
    expect(src).toContain("function openNativePicker");
    expect(src).toContain("el.showPicker?.()");
    expect((src.match(/onClick=\{openNativePicker\}/g) ?? []).length).toBe(7);
  });
});
