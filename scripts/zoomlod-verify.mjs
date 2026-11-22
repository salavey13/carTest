#!/usr/bin/env node
// ZOOM-LOD round verification (task: network tab overhaul, 2026-10-11).
// Screenshots the discovery graph + map-riders sheet network tab at every
// LOD band, drives the real camera paths (zoom buttons, ctrl+wheel, CDP
// two-finger pinch, double-tap) and asserts data-lod flips on the fly.
//
// Usage: node scripts/zoomlod-verify.mjs <baseURL> <outDir>

import { chromium, devices } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:3111";
const OUT = process.argv[3] || "/home/z/my-project/zoomlod";
mkdirSync(OUT, { recursive: true });

const results = [];
const log = (ok, name, detail = "") => {
  results.push({ ok, name, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const lodOf = (page) =>
  page.evaluate(() => document.querySelector(".cg-lod")?.getAttribute("data-lod") ?? null);

/** camera scale k straight from the world transform (source of truth) */
const camK = (page) =>
  page.evaluate(() => {
    const t = document.querySelector(".cg-lod")?.getAttribute("transform") ?? "";
    const m = /scale\(([\d.]+)\)/.exec(t);
    return m ? Number(m[1]) : null;
  });

/** close a crew focus if the tap landed on a circle, and home the camera */

async function settle(page, ms = 900) {
  await page.waitForTimeout(ms);
}

// ── discovery page: mobile-first (touch), then desktop ─────────────────────
const iphone = devices["iPhone 13"];
// the repo's playwright pins a headless-shell revision that is not in the
// sandbox cache — reuse the installed chromium-1248 binary explicitly
const browser = await chromium.launch({
  executablePath: "/home/z/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
});

// MOBILE
{
  const ctx = await browser.newContext({ ...iphone, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/franchize/discovery`, { waitUntil: "networkidle", timeout: 60000 });
  await settle(page, 1600);

  await page.screenshot({ path: join(OUT, "m1-discovery-default.png") });
  log(await lodOf(page) === "mid", "mobile default band = mid", `lod=${await lodOf(page)}`);

  // zoom buttons → near → macro (1.35³ ≈ 2.46 crosses the k≥2 macro line)
  const zoomIn = page.getByRole("button", { name: "Приблизить" });
  await zoomIn.click();
  await settle(page, 1200);
  await page.screenshot({ path: join(OUT, "m2-discovery-near.png") });
  log(await lodOf(page) === "near", "zoom-in band = near", `lod=${await lodOf(page)}`);

  await zoomIn.click();
  await settle(page, 1000);
  await zoomIn.click();
  await settle(page, 1200);
  await page.screenshot({ path: join(OUT, "m3-discovery-macro.png") });
  const lodMacro = await lodOf(page);
  log(lodMacro === "macro", "zoom-in band = macro", `lod=${lodMacro}`);

  // CDP two-finger pinch OUT (fingers spread → zoom in; here pinch closed → out)
  const svgBox = await page.locator("svg[aria-label^='Социальный граф']").boundingBox();
  if (svgBox) {
    const cdp = await ctx.newCDPSession(page);
    const cx = svgBox.x + svgBox.width / 2;
    const cy = svgBox.y + svgBox.height / 2;
    const touchPoints = (d) => [
      { x: cx - d, y: cy - 40, id: 1 },
      { x: cx + d, y: cy + 40, id: 2 },
    ];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touchPoints(90) });
    for (const d of [70, 50, 34, 24]) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: touchPoints(d) });
      await page.waitForTimeout(60);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await settle(page, 900);
    const lodAfterPinch = await lodOf(page);
    await page.screenshot({ path: join(OUT, "m4-discovery-pinch-out.png") });
    log(lodAfterPinch !== "macro", "CDP pinch closes the zoom (band moved)", `lod=${lodAfterPinch}`);
  } else {
    log(false, "svg bbox found for pinch");
  }

  // double-tap on the floor → zoom at finger. The tap may land on a circle
  // (focus opens instead — correct app behavior); in that case Esc out and
  // retry from a corner until the CAMERA scale actually moves.
  {
    const svgLoc = page.locator("svg[aria-label^='Социальный граф']");
    const floor = await svgLoc.boundingBox();
    const corners = [
      [0.5, 0.94],
      [0.12, 0.12],
      [0.88, 0.12],
    ];
    let dtK = null;
    if (floor) {
      for (const [fx, fy] of corners) {
        await page.keyboard.press("Escape").catch(() => {});
        await settle(page, 500);
        const k0 = await camK(page);
        const tx = floor.x + floor.width * fx;
        const ty = floor.y + floor.height * fy;
        await page.touchscreen.tap(tx, ty);
        await page.waitForTimeout(140);
        await page.touchscreen.tap(tx, ty);
        await settle(page, 1100);
        const k1 = await camK(page);
        if (k1 != null && k0 != null && Math.abs(k1 - k0) > 0.2) {
          dtK = k1;
          break;
        }
      }
    }
    await page.screenshot({ path: join(OUT, "m5-discovery-doubletap.png") });
    log(dtK != null, "double-tap zoom engaged", `k=${dtK}`);
    // home the camera before the far-band run
    await page.keyboard.press("Escape").catch(() => {});
    await page.getByRole("button", { name: "Вернуть камеру к графу" }).click();
    await settle(page, 1000);
  }

  // far band — zoom out thrice from home (1/1.35³ ≈ 0.41 → clamp 0.42)
  const zoomOut = page.getByRole("button", { name: "Отдалить" });
  await zoomOut.click();
  await settle(page, 900);
  await zoomOut.click();
  await settle(page, 900);
  await zoomOut.click();
  await settle(page, 1000);
  await page.screenshot({ path: join(OUT, "m6-discovery-far.png") });
  log(await lodOf(page) === "far", "zoom-out band = far", `lod=${await lodOf(page)}`);

  // focus a crew: tap a circle → satellites + rings (mid look restored on focus)
  await page.getByRole("button", { name: "Вернуть камеру к графу" }).click();
  await settle(page, 900);
  const circle = page.locator("svg g[role='button'][aria-label^='Экипаж']").first();
  if (await circle.count()) {
    await circle.click();
    await settle(page, 1400);
    await page.screenshot({ path: join(OUT, "m7-discovery-focus.png") });
    const sats = await page.locator(".cg-lod g[role='link']").count();
    log(true, "focus mode screenshot", `satellites=${sats}`);
  }

  await ctx.close();
}

// DESKTOP — ctrl+wheel zoom + sheet variant
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/franchize/discovery`, { waitUntil: "networkidle", timeout: 60000 });
  await settle(page, 1500);
  await page.screenshot({ path: join(OUT, "d1-discovery-default.png") });

  // ctrl+wheel zoom at pointer → macro
  const svg = page.locator("svg[aria-label^='Социальный граф']");
  const box = await svg.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 6; i++) {
      await page.keyboard.down("Control");
      await page.mouse.wheel(0, -240);
      await page.keyboard.up("Control");
      await page.waitForTimeout(120);
    }
    await settle(page, 1000);
    await page.screenshot({ path: join(OUT, "d2-discovery-macro.png") });
    log(await lodOf(page) === "macro", "desktop ctrl+wheel band = macro", `lod=${await lodOf(page)}`);
  } else {
    log(false, "desktop svg bbox");
  }
  await ctx.close();
}

// MAP-RIDERS SHEET — network tab inside the sliding deck
{
  const ctx = await browser.newContext({ ...iphone, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/franchize/vip-bike/map-riders`, { waitUntil: "networkidle", timeout: 60000 });
  await settle(page, 2000);
  // open the «Сеть» segment of the deck (same event the bottom nav dispatches)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("mapriders-open-riders-drawer", { detail: { tab: "network" } }));
  });
  await settle(page, 2200);
  await page.screenshot({ path: join(OUT, "s1-sheet-network.png") });
  const sheetLod = await lodOf(page);
  log(sheetLod === "mid", "sheet network tab renders graph (band mid)", `lod=${sheetLod}`);

  // pinch INSIDE the sheet canvas — the sheet must not scroll, the camera zooms
  const svg = page.locator("svg[aria-label^='Социальный граф']");
  const box = await svg.boundingBox().catch(() => null);
  if (box) {
    const cdp = await ctx.newCDPSession(page);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height * 0.4;
    const touchPoints = (d) => [
      { x: cx - d, y: cy, id: 1 },
      { x: cx + d, y: cy, id: 2 },
    ];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touchPoints(30) });
    for (const d of [50, 80, 110, 140]) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: touchPoints(d) });
      await page.waitForTimeout(60);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await settle(page, 900);
    const lodPinch = await lodOf(page);
    await page.screenshot({ path: join(OUT, "s2-sheet-pinch-zoomin.png") });
    log(lodPinch === "near" || lodPinch === "macro", "sheet pinch zooms the graph", `lod=${lodPinch}`);
  } else {
    log(false, "sheet svg bbox — graph may not be mounted");
  }
  log(errors.length === 0, "no page errors on map-riders", errors.slice(0, 2).join(" | "));
  await ctx.close();
}

await browser.close();
writeFileSync(join(OUT, "verify-results.json"), JSON.stringify(results, null, 2));
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
process.exit(fails.length ? 1 : 0);
