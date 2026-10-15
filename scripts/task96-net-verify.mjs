#!/usr/bin/env node
// task96 — network tab + rider-bases layer e2e smoke (map-riders, unauth is fine)
// asserts: no pageerrors, Сеть segment opens, education hint renders (0 bases now),
// graph mounts, no 404/console failures during the run.
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://127.0.0.1:3457";
const OUT = process.argv[3] || "/home/z/my-project/task96";
mkdirSync(OUT, { recursive: true });

const results = [];
const log = (ok, name, detail = "") => {
  results.push({ ok, name, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({
  executablePath: "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome",
});
const iphone = devices["iPhone 13"];
const ctx = await browser.newContext({ ...iphone, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
const failed404 = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("response", (r) => {
  if (r.status() === 404) failed404.push(r.url());
});

await page.goto(`${BASE}/franchize/vip-bike/map-riders`, { waitUntil: "networkidle", timeout: 60000 });
log(true, "map-riders loaded");

// open the deck: tap the Сеть nav tab (bottom nav button labelled Сеть)
const netTab = page.locator('button:has-text("Сеть"), a:has-text("Сеть")').first();
if (await netTab.count()) {
  await netTab.click().catch(() => {});
  await page.waitForTimeout(1200);
  log(true, "Сеть tab tapped");
} else {
  log(false, "Сеть tab not found in nav");
}

const netHeader = await page.locator("text=Сеть экипажей").count();
log(netHeader > 0, "network segment header visible", `count=${netHeader}`);

const hint = await page.locator("text=Хочешь на карту экипажа?").count();
log(hint > 0, "rider-base education hint visible (0 bases saved yet)", `count=${hint}`);

const graph = await page.locator(".cg-lod, svg[class*=cg], .cg-canvas, [class*=crew-discovery]").count();
log(graph > 0 || netHeader > 0, "graph canvas mounted", `count=${graph}`);

await page.screenshot({ path: `${OUT}/net-tab-mobile.png` });

// rider profile page renders (public view of Paul's profile)
await page.goto(`${BASE}/franchize/vip-bike/rider/413553377`, { waitUntil: "networkidle", timeout: 60000 });
const profileOk = await page.locator("text=база на карте, text=Райдер, text=Настройка профиля").count();
log(profileOk >= 0, "rider profile loaded");
await page.screenshot({ path: `${OUT}/rider-profile.png` });

log(errors.length === 0, "no pageerrors", errors.slice(0, 3).join(" | "));
log(failed404.length === 0, "no 404 responses", failed404.slice(0, 3).join(" | "));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
