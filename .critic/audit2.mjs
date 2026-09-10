// CRITIC R1 — chunked single-page audit: `node audit2.mjs <fleet|story|profile>` 
import { chromium } from 'playwright';
import fs from 'fs';

const OUT = '/home/z/cartest/.critic/out';
fs.mkdirSync(OUT, { recursive: true });
const name = process.argv[2] || 'fleet';
const URLS = {
  fleet: 'http://localhost:3000/franchize/vip-bike/bikes',
  story: 'http://localhost:3000/franchize/vip-bike/bikes/ducati-panigale-s-electro-green',
  profile: 'http://localhost:3000/franchize/vip-bike/profile',
};
const url = URLS[name];
const EXE = '/home/z/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';

const res = { name, url, coldMs: null, warmMs: null, overflow: null, console: [], pageerrors: [], failed: [], reqfail: [] };
const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

page.on('console', (m) => {
  const t = m.type();
  if (t === 'error' || t === 'warning') res.console.push({ type: t, text: m.text().slice(0, 600) });
});
page.on('pageerror', (e) => res.pageerrors.push(String(e).slice(0, 600)));
page.on('response', (r) => { if (r.status() >= 400) res.failed.push({ status: r.status(), url: r.url().slice(0, 250) }); });
page.on('requestfailed', (r) => res.reqfail.push({ url: r.url().slice(0, 250), err: r.failure()?.errorText }));

// cold (fresh server: includes on-demand compile)
const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => (res.networkidleColdTimeout = true));
res.coldMs = Date.now() - t0;

// reload x2
await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

// warm re-nav
const t1 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => (res.networkidleWarmTimeout = true));
res.warmMs = Date.now() - t1;
await page.waitForTimeout(800);

res.overflow = await page.evaluate(() => ({ diff: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
const text = await page.evaluate(() => document.body.innerText);
fs.writeFileSync(`${OUT}/desktop-${name}.txt`, text);
await page.screenshot({ path: `${OUT}/desktop-${name}.png`, fullPage: true });

// mobile shot (fresh context, same run — light)
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const mpage = await mctx.newPage();
const merrs = { console: [], pageerrors: [], failed: [] };
mpage.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning') merrs.console.push({ type: t, text: m.text().slice(0, 400) }); });
mpage.on('pageerror', (e) => merrs.pageerrors.push(String(e).slice(0, 400)));
mpage.on('response', (r) => { if (r.status() >= 400) merrs.failed.push({ status: r.status(), url: r.url().slice(0, 200) }); });
await mpage.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await mpage.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await mpage.waitForTimeout(700);
merrs.overflowBadEls = await mpage.evaluate(() => {
  const w = document.documentElement.clientWidth;
  const bad = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.right > w + 2 && r.width > 10 && bad.length < 14) bad.push({ tag: el.tagName, cls: String(el.className).slice(0, 70), right: Math.round(r.right) });
  });
  return bad;
});
const mtext = await mpage.evaluate(() => document.body.innerText);
fs.writeFileSync(`${OUT}/mobile-${name}.txt`, mtext);
await mpage.screenshot({ path: `${OUT}/mobile-${name}.png`, fullPage: true });
res.mobile = merrs;
await mctx.close();

fs.writeFileSync(`${OUT}/result-${name}.json`, JSON.stringify(res, null, 2));
console.log(`[${name}] cold=${res.coldMs}ms warm=${res.warmMs}ms overflowDiff=${res.overflow.diff} cErr=${res.console.filter(c => c.type === 'error').length} pErr=${res.pageerrors.length} fail4xx=${res.failed.length + res.reqfail.length} mobileOverflowEls=${merrs.overflowBadEls.length}`);
await browser.close();
