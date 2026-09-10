// CRITIC R1 — real-auth audit. Signs valid TG initData (WebAppData HMAC) using
// TELEGRAM_BOT_TOKEN from .env.local; signs as Влад Рябов with EXACT DB row fields
// (username/full_name/avatar/lang) so handleAuthentication hits `changed=false`
// and performs ZERO DB writes. Passes via #tgWebAppData= (app-supported route).
// Usage: node audit3.mjs fleet|story|profile|ix
import { chromium } from 'playwright';
import { createHmac } from 'crypto';
import fs from 'fs';

const OUT = '/home/z/cartest/.critic/out';
fs.mkdirSync(OUT, { recursive: true });

// ── TG initData signer ─────────────────────────────────────────────
function readBotToken() {
  const env = fs.readFileSync('/home/z/cartest/.env.local', 'utf8');
  const m = env.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m);
  return m ? m[1].trim() : null;
}
function signInitData(user, extra = {}) {
  const token = readBotToken();
  if (!token) throw new Error('no bot token');
  const params = new URLSearchParams();
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  params.set('user', JSON.stringify(user));
  const dcs = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(dcs).digest('hex');
  params.set('hash', hash);
  return params.toString();
}
const TG_USER = {
  id: 1569357326,
  first_name: 'Влад',
  last_name: 'Рябов',
  username: 'RyabovVld',
  // photo_url must equal DB avatar_url so the client sees no profile change
  photo_url: 'https://t.me/i/userpic/320/QhgPv9VUGL1yvdKbMM3yDfvgJ7QIsv6J6pPv2IZEfe8.svg',
  language_code: 'ru',
};
function authUrl(path) {
  const initData = signInitData(TG_USER, { query_id: 'AAF critic', signature: 'x' });
  return `http://localhost:3000${path}#tgWebAppData=${encodeURIComponent(initData)}`;
}

// ── harness ────────────────────────────────────────────────────────
const mode = process.argv[2] || 'fleet';
const PATHS = {
  fleet: '/franchize/vip-bike/bikes',
  story: '/franchize/vip-bike/bikes/ducati-panigale-s-electro-green',
  profile: '/franchize/vip-bike/profile',
};
const EXE = '/home/z/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';

function attach(page, bucket) {
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error' || t === 'warning') bucket.console.push({ type: t, text: m.text().slice(0, 600) });
  });
  page.on('pageerror', (e) => bucket.pageerrors.push(String(e).slice(0, 600)));
  page.on('response', (r) => { if (r.status() >= 400) bucket.failed.push({ status: r.status(), url: r.url().slice(0, 250) }); });
  page.on('requestfailed', (r) => bucket.reqfail.push({ url: r.url().slice(0, 250), err: r.failure()?.errorText }));
}

async function shoot(page, vp, name) {
  const text = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(`${OUT}/${vp}-${name}.txt`, text);
  await page.screenshot({ path: `${OUT}/${vp}-${name}.png`, fullPage: true });
  return text;
}

const res = { mode, coldMs: null, warmMs: null, console: [], pageerrors: [], failed: [], reqfail: [], interactions: {} };
const browser = await chromium.launch({ executablePath: EXE });
const vpConf = mode === 'ix' ? { viewport: { width: 1280, height: 800 } } : { viewport: { width: 1280, height: 800 } };

const ctx = await browser.newContext(vpConf);
const page = await ctx.newPage();
attach(page, res);

const url = authUrl(PATHS[mode] || PATHS.fleet);
// auth sanity: load fleet first for ix mode
const base = mode === 'ix' ? authUrl(PATHS.story) : url;

const t0 = Date.now();
await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
res.coldMs = Date.now() - t0;
await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
const t1 = Date.now();
await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
res.warmMs = Date.now() - t1;
await page.waitForTimeout(900);
res.overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const pageName = mode === 'ix' ? 'story' : mode;
await shoot(page, 'desktop', pageName);

if (mode !== 'ix') {
  // mobile pass (fresh context)
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await mctx.newPage();
  const mb = { console: [], pageerrors: [], failed: [], reqfail: [] };
  attach(mp, mb);
  await mp.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await mp.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await mp.waitForTimeout(700);
  mb.overflowBadEls = await mp.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const bad = [];
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > w + 2 && r.width > 10 && bad.length < 14) bad.push({ tag: el.tagName, cls: String(el.className).slice(0, 60), right: Math.round(r.right) });
    });
    return bad;
  });
  await shoot(mp, 'mobile', pageName);
  res.mobile = mb;
  await mctx.close();
}

// ── interactions ──
if (mode === 'ix') {
  const ix = res.interactions;

  // 1) month switcher
  try {
    const prev = page.locator('button', { hasText: '‹' }).first();
    const hasNext = await page.locator('button', { hasText: '›' }).count();
    ix.month = { prevCount: await prev.count(), nextCount: hasNext };
    await prev.click({ timeout: 4000 });
    await page.waitForTimeout(1000);
    ix.month.prevText = (await page.evaluate(() => document.body.innerText)).slice(0, 2200);
    await page.screenshot({ path: `${OUT}/ix-month-prev.png`, fullPage: true });
    const vsya = page.locator('button', { hasText: 'Вся история' }).first();
    if (await vsya.count()) {
      await vsya.click({ timeout: 4000 });
      await page.waitForTimeout(1100);
      ix.month.vsyaText = (await page.evaluate(() => document.body.innerText)).slice(0, 3200);
      await page.screenshot({ path: `${OUT}/ix-vsya.png`, fullPage: true });
    }
    const prevBack = page.locator('button', { hasText: '‹' }).first();
    if (await prevBack.count()) { await prevBack.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(700); }
  } catch (e) { ix.monthError = String(e).slice(0, 250); }

  // 2) lightbox on rental photo
  ix.lightbox = { tried: [] };
  try {
    const imgs = await page.locator('img').all();
    for (let i = 0; i < imgs.length && i < 30; i++) {
      const im = imgs[i];
      const box = await im.boundingBox().catch(() => null);
      if (!box || box.width < 70 || box.height < 70) continue;
      const alt = (await im.getAttribute('alt').catch(() => '')) || '';
      ix.lightbox.tried.push({ i, alt: alt.slice(0, 50), w: Math.round(box.width), h: Math.round(box.height) });
      await im.click({ timeout: 3000 });
      await page.waitForTimeout(800);
      const fixedOverlays = await page.evaluate(() => {
        const els = [...document.querySelectorAll('body *')];
        return els.filter((el) => {
          const s = getComputedStyle(el);
          return (s.position === 'fixed' || s.position === 'absolute') && s.zIndex !== 'auto' && parseInt(s.zIndex) >= 40 && el.offsetWidth > 200;
        }).length;
      });
      if (fixedOverlays > 0) {
        ix.lightbox.opened = true; ix.lightbox.overlays = fixedOverlays; ix.lightbox.byAlt = alt.slice(0, 50);
        await page.screenshot({ path: `${OUT}/ix-lightbox.png`, fullPage: false });
        // arrows: click right arrow if present
        const arrows = await page.locator('button:visible').allInnerTexts();
        ix.lightbox.visibleButtons = arrows.slice(0, 20);
        const right = page.locator('button', { hasText: /›|❯|→/ }).last();
        if (await right.count()) {
          await right.click({ timeout: 2500 }).catch((e) => { ix.lightbox.arrowClickErr = String(e).slice(0, 120); });
          await page.waitForTimeout(600);
          await page.screenshot({ path: `${OUT}/ix-lightbox-next.png`, fullPage: false });
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);
        const after = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => {
          const s = getComputedStyle(el);
          return (s.position === 'fixed' || s.position === 'absolute') && s.zIndex !== 'auto' && parseInt(s.zIndex) >= 40 && el.offsetWidth > 200;
        }).length);
        ix.lightbox.closedOnEsc = after === 0;
        break;
      }
    }
  } catch (e) { ix.lightbox.err = String(e).slice(0, 250); }
  await page.screenshot({ path: `${OUT}/ix-story-after.png`, fullPage: true });

  // 3) fleet card → story
  try {
    await page.goto(authUrl(PATHS.fleet), { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(600);
    const card = page.locator('a[href*="ducati-panigale-s-electro-green"]').first();
    ix.fleetCardLinks = await page.locator('a[href*="ducati-panigale-s-electro-green"]').count();
    await card.click({ timeout: 5000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    ix.fleetCardNav = page.url().split('#')[0];
  } catch (e) { ix.fleetCardNav = 'ERR ' + String(e).slice(0, 200); }

  // 4) profile bike card → story + money extraction
  try {
    await page.goto(authUrl(PATHS.profile), { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(700);
    ix.profileBikeLinks = await page.locator('a[href*="ducati-panigale-s-electro-green"]').count();
    const profText = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(`${OUT}/ix-profile-text.txt`, profText);
    const card = page.locator('a[href*="ducati-panigale-s-electro-green"]').first();
    if (await card.count()) {
      await card.click({ timeout: 5000 });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      ix.profileCardNav = page.url().split('#')[0];
    }
  } catch (e) { ix.profileCardNav = 'ERR ' + String(e).slice(0, 200); }
}

fs.writeFileSync(`${OUT}/result-${mode}-auth.json`, JSON.stringify(res, null, 2));
console.log(`[${mode}] cold=${res.coldMs} warm=${res.warmMs} overflow=${res.overflow} cErr=${res.console.filter(c => c.type === 'error').length} pErr=${res.pageerrors.length} fail=${res.failed.length + res.reqfail.length}`);
await browser.close();
