// Task 84 FINAL (2026-10-11) — verify the map-riders basemap after the boss
// verdicts: «i tested and it looks odd, please try to improve or ditch styling
// of the map :)» (→ skins DITCHED: no tile filters, no vignette overlay) and
// «map is still light in dark theme btw, can it be dark?» (→ theme-honest
// basemaps: a dark tile intent must render DARK tiles even with the premium
// LIGHT custom url configured).
//
// Asserts per theme:
//   · .mr-map-skin class stack is GONE (no sepia/vignette can come back)
//   · leaflet tiles load
//   · DARK theme → tiles come from a DARK basemap (cartocdn dark_all or the
//     NEXT_PUBLIC_MAP_TILE_URL_DARK override), light theme → light basemap
//   · sheet card resolves its --mr-card token (portal-safe :root hoist)
//
// Run against a dev server: node scripts/task84-verify-map-skin.mjs
import { chromium } from "playwright";

const URL = process.env.VERIFY_URL || "http://localhost:3000/franchize/vip-bike/map-riders";
const browser = await chromium.launch();
let failures = 0;

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
    const vignette = document.querySelector(".mr-map-skin-vignette");
    const tileImg = document.querySelector(".leaflet-tile-loaded");
    const tileSrc = tileImg instanceof HTMLImageElement ? tileImg.src : "";
    const drawer = document.querySelector("[data-vaul-drawer]");
    const drawerCardVar = drawer ? getComputedStyle(drawer).getPropertyValue("--mr-card").trim() : null;
    const drawerBg = drawer ? getComputedStyle(drawer).backgroundColor : null;
    return {
      // skin must stay removed (regression guard)
      skinRemoved: skin === null,
      vignetteRemoved: vignette === null,
      tilesLoaded: !!tileImg,
      tileHost: tileSrc.replace(/^https?:\/\//, "").split("/").slice(0, 2).join("/"),
      tileIsDarkBasemap: /dark(_all|\b)/.test(tileSrc) || /dark/.test(tileSrc.split("/")[1] || ""),
      tileIsLightBasemap: /light(_all|\b)/.test(tileSrc) || /streets/.test(tileSrc),
      // portal-safe token hoist: the drawer (portaled to body) must see --mr-card
      drawerSeesMrCard: Boolean(drawerCardVar),
      drawerMrCard: drawerCardVar || "(unset)",
      drawerBg,
    };
  });
  const themeIsDark = theme === "dark";
  const tileCheck = themeIsDark ? info.tileIsDarkBasemap : info.tileIsLightBasemap;
  const ok = info.skinRemoved && info.vignetteRemoved && info.tilesLoaded && tileCheck && info.drawerSeesMrCard;
  if (!ok) failures += 1;
  console.log(
    theme.toUpperCase(),
    JSON.stringify({ ...info, tileCheck, drawerSeesMrCard: info.drawerSeesMrCard }, null, 1),
    "jsErrors:", errs.length,
    ok ? "✓" : "✗ FAIL",
  );
  await page.screenshot({ path: `/home/z/my-project/task84-map-${theme}.png` });
  await ctx.close();
}
await browser.close();
if (failures > 0) {
  console.error(`task84 verify: ${failures} theme(s) FAILED`);
  process.exit(1);
}
console.log("task84 verify: all themes ✓");
