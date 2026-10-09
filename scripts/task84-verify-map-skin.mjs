// Task 84 (+ vice-tint follow-up, boss 2026-10-09) — verify map-riders game
// skins in dark & light themes: skin class, tile filter, vignette, and the
// Vice neon glow layer (dark ONLY — must be absent on the light skin).
import { chromium } from "playwright";

const URL = "http://localhost:3000/franchize/vip-bike/map-riders";
const browser = await chromium.launch();

for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 780 },
    isMobile: true,
    hasTouch: true,
    colorScheme: theme,
  });
  await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(6000); // leaflet tiles
  const info = await page.evaluate(() => {
    const skin = document.querySelector(".mr-map-skin");
    const tiles = document.querySelector(".mr-map-skin .leaflet-tile-pane");
    const vignette = document.querySelector(".mr-map-skin-vignette");
    const neon = document.querySelector(".mr-map-skin-neon");
    const tileImg = document.querySelector(".leaflet-tile-loaded");
    return {
      skinClass: skin ? skin.className.slice(0, 80) : null,
      tileFilter: tiles ? getComputedStyle(tiles).filter.slice(0, 130) : null,
      vignette: !!vignette,
      neon: neon
        ? {
            blend: getComputedStyle(neon).mixBlendMode,
            bg: getComputedStyle(neon).backgroundImage.slice(0, 160),
          }
        : null,
      tilesLoaded: !!tileImg,
      containerBg: (() => {
        const c = document.querySelector(".mr-map-skin .leaflet-container");
        return c ? getComputedStyle(c).backgroundColor : null;
      })(),
    };
  });
  console.log(theme.toUpperCase(), JSON.stringify(info, null, 1), "jsErrors:", errs.length);
  await page.screenshot({ path: `/home/z/my-project/task84-map-${theme}.png` });
  await ctx.close();
}
await browser.close();
