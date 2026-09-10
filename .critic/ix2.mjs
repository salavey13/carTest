// CRITIC R1 — round 2: month-switch parity, lightbox arrows, card navs, perf probe
import { chromium } from 'playwright';
import { createHmac } from 'crypto';
import fs from 'fs';

const OUT = '/home/z/cartest/.critic/out';
const EXE = '/home/z/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';

function readBotToken() { const e = fs.readFileSync('/home/z/cartest/.env.local', 'utf8'); const m = e.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m); return m[1].trim(); }
function signInitData(user) {
  const token = readBotToken();
  const params = new URLSearchParams();
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  params.set('query_id', 'AAF critic2');
  params.set('user', JSON.stringify(user));
  const dcs = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
  return params.toString();
}
const TG_USER = { id: 1569357326, first_name: 'Влад', last_name: 'Рябов', username: 'RyabovVld', photo_url: 'https://t.me/i/userpic/320/QhgPv9VUGL1yvdKbMM3yDfvgJ7QIsv6J6pPv2IZEfe8.svg', language_code: 'ru' };
const authUrl = (p) => `http://localhost:3000${p}#tgWebAppData=${encodeURIComponent(signInitData(TG_USER))}`;

const ix = { storyMonths: [], lightbox: {}, navs: {}, perf: {}, consoleErrors: [], pageerrors: [] };
const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') ix.consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => ix.pageerrors.push(String(e).slice(0, 300)));

// ---- PERF probe: story ----
let t0 = Date.now();
await page.goto(authUrl('/franchize/vip-bike/bikes/ducati-panigale-s-electro-green'), { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.getByText('ОДОМЕТР', { exact: false }).first().waitFor({ timeout: 30000 }).catch(() => {});
ix.perf.storyToKpiMs = Date.now() - t0;
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
ix.perf.storyToIdleMs = Date.now() - t0;

// ---- month selector walk ----
const label = () => page.locator('p.truncate.text-sm.font-semibold').first();
try {
  ix.storyMonths.push({ state: 'initial', label: await label().innerText(), kpi: (await page.evaluate(() => document.body.innerText)).match(/[\d\s\u00a0]+₽[\s\S]{0,40}/g)?.slice(0, 6) });
  for (let i = 0; i < 3; i++) {
    const prev = page.getByLabel('Предыдущий месяц');
    if (!(await prev.count())) break;
    if (await prev.isDisabled().catch(() => true)) break;
    await prev.click({ timeout: 3000 });
    await page.waitForTimeout(900);
    const txt = await page.evaluate(() => document.body.innerText);
    ix.storyMonths.push({ state: `prev${i + 1}`, label: await label().innerText(), money: txt.match(/[\d\s\u00a0]+₽/g)?.slice(0, 8), empty: /событий не было/.test(txt) });
  }
  await page.screenshot({ path: `${OUT}/ix2-month-sept.png`, fullPage: true });
  for (let i = 0; i < 3; i++) {
    const next = page.getByLabel('Следующий месяц или вся история');
    if (!(await next.count()) || (await next.isDisabled().catch(() => true))) break;
    await next.click({ timeout: 3000 });
    await page.waitForTimeout(700);
    ix.storyMonths.push({ state: `next${i + 1}`, label: await label().innerText() });
  }
  await page.screenshot({ path: `${OUT}/ix2-month-final.png`, fullPage: true });
} catch (e) { ix.monthWalkErr = String(e).slice(0, 300); }

// ---- lightbox arrows ----
try {
  const photo = page.getByLabel(/Фото после возврата/).first();
  await photo.click({ timeout: 5000 });
  await page.waitForTimeout(700);
  const counter = await page.evaluate(() => document.body.innerText.match(/Фото[\s\S]{0,80}/g)?.slice(0, 3));
  ix.lightbox.afterOpen = counter;
  await page.screenshot({ path: `${OUT}/ix2-lightbox-open.png`, fullPage: false });
  const nxt = page.getByLabel('Следующее фото');
  if (await nxt.count()) {
    await nxt.click({ timeout: 3000 }); await page.waitForTimeout(500);
    await nxt.click({ timeout: 3000 }); await page.waitForTimeout(500);
    ix.lightbox.afterTwoNext = await page.evaluate(() => document.body.innerText.match(/Фото[\s\S]{0,80}/g)?.slice(0, 3));
    await page.screenshot({ path: `${OUT}/ix2-lightbox-next2.png`, fullPage: false });
  }
  const prv = page.getByLabel('Предыдущее фото');
  if (await prv.count()) { await prv.click({ timeout: 3000 }); await page.waitForTimeout(400); ix.lightbox.afterPrev = true; }
  const imgs = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] img, .fixed img')].map(i => i.currentSrc || i.src).slice(0, 3));
  ix.lightbox.imgs = imgs;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const overlayGone = await page.evaluate(() => ![...document.querySelectorAll('body *')].some(el => { const s = getComputedStyle(el); return s.position === 'fixed' && parseInt(s.zIndex) >= 40 && el.offsetWidth > 200 && el.querySelector('img'); }));
  ix.lightbox.escCloses = overlayGone;
} catch (e) { ix.lightbox.err = String(e).slice(0, 300); }

// ---- fleet card nav ----
try {
  await page.goto(authUrl('/franchize/vip-bike/bikes'), { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(500);
  const link = page.locator('a[href*="ducati-panigale-s-electro-green"]').first();
  await link.click({ timeout: 5000 });
  await page.waitForURL('**/bikes/ducati-panigale-s-electro-green**', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  ix.navs.fleetCard = page.url().split('#')[0].split('?')[0];
} catch (e) { ix.navs.fleetCard = 'ERR ' + String(e).slice(0, 150); }

// ---- profile card nav + profile month walk (parity!) ----
try {
  t0 = Date.now();
  await page.goto(authUrl('/franchize/vip-bike/profile'), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByText('Мои байки в парке').first().waitFor({ timeout: 30000 });
  ix.perf.profileToPanelMs = Date.now() - t0;
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  ix.perf.profileToIdleMs = Date.now() - t0;
  await page.waitForTimeout(600);
  // month walk in profile panel
  const panelText = async () => {
    const t = await page.evaluate(() => document.body.innerText);
    const i = t.indexOf('Заработок за месяц');
    return t.slice(i, i + 420);
  };
  ix.profilePanel = { initial: await panelText() };
  const prevM = page.locator('button', { hasText: '‹' }).first();
  if (await prevM.count()) {
    await prevM.click({ timeout: 4000 });
    await page.waitForTimeout(900);
    ix.profilePanel.august = await panelText();
    await page.screenshot({ path: `${OUT}/ix2-profile-august.png`, fullPage: true });
    // back to september
    const nextM = page.locator('button', { hasText: '›' }).first();
    await nextM.click({ timeout: 4000 });
    await page.waitForTimeout(700);
    ix.profilePanel.backToSept = await panelText();
  }
  const card = page.locator('a[href*="ducati-panigale-s-electro-green"]').first();
  await card.click({ timeout: 5000 });
  await page.waitForURL('**/bikes/ducati-panigale-s-electro-green**', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  ix.navs.profileCard = page.url().split('#')[0].split('?')[0];
} catch (e) { ix.profileErr = String(e).slice(0, 300); }

fs.writeFileSync(`${OUT}/ix2-results.json`, JSON.stringify(ix, null, 2));
console.log('perf:', JSON.stringify(ix.perf), 'navs:', JSON.stringify(ix.navs), 'cErr:', ix.consoleErrors.length, 'pErr:', ix.pageerrors.length);
await browser.close();
