#!/usr/bin/env node
// scripts/task93-pop-pin-probe.mjs
//
// Task 93 visual probe: render the wall-post POP pin markup (exactly what
// buildPoiMarkerIcon emits for { color:"#facc15", faName:"FaCameraRetro",
// markerSize:"xl", pop:true } and the photo-avatar variant) on a real Leaflet
// map over a DARK basemap + a LIGHT basemap, screenshot both, and assert the
// geometry: pulses exist, are siblings of the disc, centered, and animating
// (computed transform changes between two frames). Exit 1 on any failure.
//
// The markup below mirrors lib/map-poi-marker.ts output — if the builder and
// this probe drift, the map-poi-markers.spec guards catch the builder side.

import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const CSS = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

// Two mid-animation frames for the same ring — computed transform must differ.
const PAGE = (theme) => `<!doctype html>
<html><head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>${CSS}</style>
<style>
  body{margin:0}
  #map{width:480px;height:480px}
  .mr-poi-div-icon{background:transparent;border:0}
</style>
</head><body class="${theme}">
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const map = L.map('map', { zoomControl:false, attributionControl:false }).setView([55.75, 37.62], 13);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/${theme === "dark" ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png').addTo(map);

  // EXACT builder output: pop pin, camera-glyph fallback variant (amber)
  const glyphSvg = '<svg viewBox="0 0 640 640" fill="currentColor" style="width:20px;height:20px"><path d="M180.8-8c11.2-19.2 31.7-32 54.4-32h169.6c22.7 0 43.2 12.8 54.4 32L475.2 32H544c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H96c-35.3 0-64-28.7-64-64V96c0-35.3 28.7-64 64-64h68.8L180.8-8z"/></svg>';
  const popPin = (color, inner) =>
    '<span class="mr-poi__pulse" aria-hidden="true" style="border-color:' + color + '"></span>' +
    '<span class="mr-poi__pulse mr-poi__pulse--late" aria-hidden="true" style="border-color:' + color + '"></span>' +
    '<div class="mr-poi mr-poi--pop mr-poi--xl" style="background-color:' + color + ';--mr-poi-glow:color-mix(in srgb, ' + color + ' 60%, transparent)">' + inner + '</div>';

  L.marker([55.752, 37.615], {
    icon: L.divIcon({ html: popPin('#facc15', '<span class="mr-poi__glyph" aria-hidden="true">' + glyphSvg + '</span>'),
      className: 'mr-poi-div-icon', iconSize: [46,46], iconAnchor: [23,23] }),
    zIndexOffset: 540,
  }).addTo(map).bindPopup('Поп-пин: камера (без фото)');

  // photo avatar variant (sky accent, fixed hue on both themes for contrast)
  L.marker([55.745, 37.635], {
    icon: L.divIcon({ html: popPin('#38bdf8',
        '<span class="mr-poi__glyph" aria-hidden="true">' + glyphSvg + '</span>' +
        '<span class="mr-poi__img" aria-hidden="true" style="background-image:url(https://picsum.photos/seed/ride93/92/92)"></span>'),
      className: 'mr-poi-div-icon', iconSize: [46,46], iconAnchor: [23,23] }),
    zIndexOffset: 540,
  }).addTo(map);

  // HQ lg halo pin for size comparison (must stay pixel-identical to before)
  L.marker([55.758, 37.64], {
    icon: L.divIcon({ html: '<div class="mr-poi mr-poi--halo mr-poi--lg" style="background-color:#f97316"><span class="mr-poi__glyph" aria-hidden="true">' + glyphSvg + '</span></div>',
      className: 'mr-poi-div-icon', iconSize: [40,40], iconAnchor: [20,20] }),
  }).addTo(map);
  window.__mapReady = true;
</script>
</body></html>`;

const results = [];
const fail = (msg) => { results.push("FAIL " + msg); };

// CI/container chrome override (local default = playwright-managed browser)
const chromePath = process.env.CHROME_PATH;
if (chromePath && !existsSync(chromePath)) {
  console.error(`CHROME_PATH=${chromePath} does not exist`);
  process.exit(1);
}

for (const theme of ["dark", "light"]) {
  const html = PAGE(theme);
  const browser = await chromium.launch(chromePath ? { executablePath: chromePath } : {});
  const page = await browser.newPage({ viewport: { width: 500, height: 500 } });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForFunction("window.__mapReady === true");
  await page.waitForTimeout(600);

  const probe = await page.evaluate(() => {
    const pins = document.querySelectorAll(".mr-poi--pop");
    const pulses = document.querySelectorAll(".mr-poi__pulse");
    const disc = document.querySelector(".mr-poi--pop");
    return new Promise((resolve) => {
      const t1 = pulses.length ? getComputedStyle(pulses[0]).transform : "none";
      setTimeout(() => {
        const t2 = pulses.length ? getComputedStyle(pulses[0]).transform : "none";
        const dr = disc.getBoundingClientRect();
        const pr = pulses[0].getBoundingClientRect();
        // centers should coincide (ring centered under disc)
        const dcx = dr.x + dr.width / 2, dcy = dr.y + dr.height / 2;
        const pcx = pr.x + pr.width / 2, pcy = pr.y + pr.height / 2;
        resolve({
          popPins: pins.length,
          pulses: pulses.length,
          animating: t1 !== t2,
          transformSample: t2,
          centerDelta: Math.hypot(dcx - pcx, dcy - pcy),
          discSize: dr.width,
          glow: getComputedStyle(disc).boxShadow,
        });
      }, 350);
    });
  });

  mkdirSync("docs/probes", { recursive: true });
  await page.screenshot({ path: `docs/probes/task93-pop-pin-${theme}.png` });
  await browser.close();

  if (probe.popPins !== 2) fail(`${theme}: expected 2 pop pins, got ${probe.popPins}`);
  if (probe.pulses !== 4) fail(`${theme}: expected 4 pulse rings (2 per pin), got ${probe.pulses}`);
  if (!probe.animating) fail(`${theme}: sonar ring is NOT animating (transform static)`);
  if (probe.centerDelta > 3) fail(`${theme}: ring not centered under disc (delta ${probe.centerDelta.toFixed(1)}px)`);
  if (probe.discSize < 45 || probe.discSize > 50)
    fail(`${theme}: pop disc is ${probe.discSize}px, expected 46 ± heartbeat scale (≤ 49.7)`);
  // Chrome resolves the color-mix glow to color(srgb … / 0.6); match the
  // glow geometry (18px blur + 3px spread) rather than a color spelling.
  if (!probe.glow.includes("18px 3px")) fail(`${theme}: accent glow missing from pop disc shadow`);
  results.push(`${theme}: pins=${probe.popPins} rings=${probe.pulses} animating=${probe.animating} disc=${probe.discSize}px centerΔ=${probe.centerDelta.toFixed(2)}px`);
}

console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) {
  console.error("POP probe FAILED");
  process.exit(1);
}
console.log("POP probe OK");
writeFileSync(new URL("../docs/probes/task93-pop-pin-result.txt", import.meta.url), results.join("\n") + "\n");
