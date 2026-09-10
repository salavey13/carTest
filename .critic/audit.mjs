// CRITIC R1 harness — motopark subrenter POV audit. Throwaway, product code untouched.
import { chromium } from 'playwright';
import fs from 'fs';

const OUT = '/home/z/cartest/.critic/out';
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: 'fleet', url: 'http://localhost:3000/franchize/vip-bike/bikes' },
  { name: 'story', url: 'http://localhost:3000/franchize/vip-bike/bikes/ducati-panigale-s-electro-green' },
  { name: 'profile', url: 'http://localhost:3000/franchize/vip-bike/profile' },
];

const results = {};

function collect(page, bucket) {
  page.on('console', (msg) => {
    const t = msg.type();
    if (t === 'error' || t === 'warning') {
      bucket.console.push({ type: t, text: msg.text().slice(0, 600), url: (msg.location()?.url || '').slice(-120) });
    }
  });
  page.on('pageerror', (err) => bucket.pageerrors.push(String(err).slice(0, 600)));
  page.on('response', (res) => {
    if (res.status() >= 400) bucket.failed.push({ status: res.status(), url: res.url().slice(0, 250) });
  });
  page.on('requestfailed', (req) => bucket.reqfail.push({ url: req.url().slice(0, 250), err: req.failure()?.errorText }));
}

const EXE = '/home/z/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: EXE });

for (const vp of ['desktop', 'mobile']) {
  const ctx = await browser.newContext(
    vp === 'desktop'
      ? { viewport: { width: 1280, height: 800 } }
      : { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
  );
  const page = await ctx.newPage();
  results[vp] = {};
  for (const p of PAGES) {
    const bucket = { console: [], pageerrors: [], failed: [], reqfail: [] };
    collect(page, bucket);
    // cold
    const t0 = Date.now();
    await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => bucket.networkidleTimeoutCold = true);
    const coldMs = Date.now() - t0;
    // two reloads (cold+warm reload)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    // warm nav timing
    const t1 = Date.now();
    await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => bucket.networkidleTimeoutWarm = true);
    const warmMs = Date.now() - t1;
    await page.waitForTimeout(700);
    const overflow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      diff: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    const text = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(`${OUT}/${vp}-${p.name}.txt`, text);
    await page.screenshot({ path: `${OUT}/${vp}-${p.name}.png`, fullPage: true });
    results[vp][p.name] = { coldMs, warmMs, overflow, bucket };
    console.log(`[${vp}] ${p.name}: cold=${coldMs}ms warm=${warmMs}ms overflowDiff=${overflow.diff} consoleErr=${bucket.console.filter(c=>c.type==='error').length} pageErr=${bucket.pageerrors.length} failedReq=${bucket.failed.length + bucket.reqfail.length}`);
  }
  await ctx.close();
}

// ---- Interactions (desktop) ----
const inter = {};
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const bucket = { console: [], pageerrors: [], failed: [], reqfail: [] };
  collect(page, bucket);
  await page.goto(PAGES[1].url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(800);

  // story initial text
  const storyText = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(`${OUT}/ix-story-initial.txt`, storyText);

  // month switcher: find ‹ › buttons and Вся история
  const btns = await page.locator('button').allInnerTexts();
  fs.writeFileSync(`${OUT}/ix-story-buttons.json`, JSON.stringify(btns, null, 2));
  const hasPrev = btns.some((b) => b.includes('‹'));
  const hasNext = btns.some((b) => b.includes('›'));
  let monthClick = { hasPrev, hasNext, states: [] };
  try {
    const prev = page.locator('button', { hasText: '‹' }).first();
    await prev.click({ timeout: 4000 });
    await page.waitForTimeout(900);
    monthClick.states.push({ state: 'prev', text: (await page.evaluate(() => document.body.innerText)).slice(0, 2500) });
    await page.screenshot({ path: `${OUT}/ix-story-month-prev.png`, fullPage: true });
    const next = page.locator('button', { hasText: '›' }).first();
    await next.click({ timeout: 4000 });
    await page.waitForTimeout(900);
    const vsya = page.locator('button', { hasText: 'Вся история' }).first();
    if (await vsya.count()) {
      await vsya.click({ timeout: 4000 });
      await page.waitForTimeout(900);
      monthClick.states.push({ state: 'vsya', text: (await page.evaluate(() => document.body.innerText)).slice(0, 3500) });
      await page.screenshot({ path: `${OUT}/ix-story-vsya.png`, fullPage: true });
    }
    // back to current month
    const prev2 = page.locator('button', { hasText: '‹' }).first();
    if (await prev2.count()) { await prev2.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(600); }
  } catch (e) {
    monthClick.error = String(e).slice(0, 300);
  }
  inter.storyMonth = monthClick;

  // lightbox: click first photo-ish element in rentals feed
  inter.lightbox = { tried: [] };
  const imgSel = 'img';
  const imgs = await page.locator(imgSel).all();
  let clicked = false;
  for (let i = 0; i < imgs.length && i < 25; i++) {
    const im = imgs[i];
    const box = await im.boundingBox().catch(() => null);
    if (!box || box.width < 60 || box.height < 60) continue;
    const alt = (await im.getAttribute('alt').catch(() => '')) || '';
    const cls = (await im.getAttribute('class').catch(() => '')) || '';
    inter.lightbox.tried.push({ i, alt: alt.slice(0, 60), cls: cls.slice(0, 80), w: Math.round(box.width), h: Math.round(box.height) });
    try {
      await im.click({ timeout: 3000 });
      await page.waitForTimeout(700);
      const txt = await page.evaluate(() => document.body.innerText);
      const dlgCount = await page.locator('[role="dialog"], .fixed.inset-0, [class*="lightbox" i]').count();
      if (dlgCount > 0 || /закрыть|esc|стрелк/i.test(txt.slice(-1500))) {
        inter.lightbox.opened = true; inter.lightbox.openedBy = { i, alt: alt.slice(0, 60) };
        inter.lightbox.dlgCount = dlgCount;
        await page.screenshot({ path: `${OUT}/ix-story-lightbox.png`, fullPage: false });
        // arrows
        const arrows = page.locator('button', { hasText: /→|←|❯|❮|›|‹/ });
        const aCount = await arrows.count();
        inter.lightbox.arrowButtons = aCount;
        if (aCount) {
          await arrows.first().click({ timeout: 2500 }).catch((e) => inter.lightbox.arrowErr = String(e).slice(0, 150));
          await page.waitForTimeout(500);
          await page.screenshot({ path: `${OUT}/ix-story-lightbox-arrow.png`, fullPage: false });
        }
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(500);
        const dlgAfter = await page.locator('[role="dialog"], .fixed.inset-0').count();
        inter.lightbox.closedOnEsc = dlgAfter === 0;
        clicked = true;
        break;
      }
    } catch (e) {
      inter.lightbox.tried.push({ i, err: String(e).slice(0, 120) });
    }
  }
  if (!clicked) inter.lightbox.opened = false;
  await page.screenshot({ path: `${OUT}/ix-story-after-lightbox.png`, fullPage: true });

  // fleet: click bike card -> should navigate to story
  await page.goto(PAGES[0].url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(600);
  try {
    await page.locator('a[href*="ducati-panigale-s-electro-green"]').first().click({ timeout: 5000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    inter.fleetCardNav = { url: page.url() };
    await page.screenshot({ path: `${OUT}/ix-fleet-card-nav.png`, fullPage: false });
  } catch (e) { inter.fleetCardNav = { error: String(e).slice(0, 200) }; }

  // profile: find bike card link in profile panel
  await page.goto(PAGES[2].url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(600);
  const profLinks = await page.locator('a[href*="ducati-panigale-s-electro-green"]').count();
  inter.profileBikeLinks = profLinks;
  if (profLinks) {
    try {
      await page.locator('a[href*="ducati-panigale-s-electro-green"]').first().click({ timeout: 5000 });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      inter.profileCardNav = { url: page.url() };
      await page.screenshot({ path: `${OUT}/ix-profile-card-nav.png`, fullPage: false });
    } catch (e) { inter.profileCardNav = { error: String(e).slice(0, 200) }; }
  }

  // mobile story: scroll + horizontal overflow detail
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  // EXE reused
  const mpage = await mctx.newPage();
  const mbucket = { console: [], pageerrors: [], failed: [], reqfail: [] };
  collect(mpage, mbucket);
  await mpage.goto(PAGES[1].url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await mpage.waitForTimeout(700);
  inter.mobileOverflowEls = await mpage.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const bad = [];
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > w + 2 && r.width > 10 && bad.length < 12) {
        bad.push({ tag: el.tagName, cls: String(el.className).slice(0, 70), right: Math.round(r.right), w: Math.round(r.width) });
      }
    });
    return bad;
  });
  await mpage.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await mpage.waitForTimeout(400);
  await mpage.screenshot({ path: `${OUT}/ix-mobile-story-mid.png`, fullPage: false });
  await mctx.close();

  inter.storyBucket = bucket;
  fs.writeFileSync(`${OUT}/ix-results.json`, JSON.stringify(inter, null, 2));
  await ctx.close();
}

fs.writeFileSync(`${OUT}/audit-results.json`, JSON.stringify(results, null, 2));
console.log('DONE');
await browser.close();
