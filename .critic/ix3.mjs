// CRITIC R1 — round 3: profile month-switch hang check, story month money, lightbox arrows
import { chromium } from 'playwright';
import { createHmac } from 'crypto';
import fs from 'fs';

const OUT = '/home/z/cartest/.critic/out';
const EXE = '/home/z/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
function readBotToken() { const e = fs.readFileSync('/home/z/cartest/.env.local', 'utf8'); return e.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m)[1].trim(); }
function signInitData(user) {
  const params = new URLSearchParams();
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  params.set('query_id', 'AAF critic3');
  params.set('user', JSON.stringify(user));
  const dcs = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(readBotToken()).digest();
  params.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
  return params.toString();
}
const TG_USER = { id: 1569357326, first_name: 'Влад', last_name: 'Рябов', username: 'RyabovVld', photo_url: 'https://t.me/i/userpic/320/QhgPv9VUGL1yvdKbMM3yDfvgJ7QIsv6J6pPv2IZEfe8.svg', language_code: 'ru' };
const authUrl = (p) => `http://localhost:3000${p}#tgWebAppData=${encodeURIComponent(signInitData(TG_USER))}`;

const out = { profileMonth: [], storyMonth: [], lightbox: {}, consoleErrors: [], pageerrors: [] };
const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') out.consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => out.pageerrors.push(String(e).slice(0, 300)));

// ---- A) STORY: month money states ----
await page.goto(authUrl('/franchize/vip-bike/bikes/ducati-panigale-s-electro-green'), { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.getByText('ОДОМЕТР').first().waitFor({ timeout: 30000 });
const grab = async () => {
  const t = await page.evaluate(() => document.body.innerText);
  const i = t.indexOf('Вся история');
  return t.slice(Math.max(0, i - 60), i + 500).replace(/\n+/g, ' | ');
};
out.storyMonth.push({ label: 'Вся история (default)', text: await grab() });
await page.getByLabel('Предыдущий месяц').click();
await page.waitForTimeout(1200);
out.storyMonth.push({ label: await page.locator('p.truncate.text-sm.font-semibold').first().innerText(), text: await grab() });
await page.screenshot({ path: `${OUT}/ix3-story-sept.png`, fullPage: true });
await page.getByLabel('Предыдущий месяц').click();
await page.waitForTimeout(1200);
out.storyMonth.push({ label: await page.locator('p.truncate.text-sm.font-semibold').first().innerText(), text: await grab() });
await page.screenshot({ path: `${OUT}/ix3-story-aug.png`, fullPage: true });

// ---- B) LIGHTBOX arrows on fresh story ----
await page.goto(authUrl('/franchize/vip-bike/bikes/ducati-panigale-s-electro-green'), { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.getByText('ОДОМЕТР').first().waitFor({ timeout: 30000 });
await page.waitForTimeout(800);
try {
  const photo = page.locator('img[alt="Фото после возврата"]').first();
  await photo.scrollIntoViewIfNeeded();
  await photo.click({ timeout: 6000 });
  await page.waitForTimeout(800);
  out.lightbox.opened = true;
  out.lightbox.srcs = [];
  const capSrc = async () => page.evaluate(() => {
    const el = [...document.querySelectorAll('img')].find(i => { const r = i.getBoundingClientRect(); return r.width > 300 && r.height > 300 && (getComputedStyle(i.closest('[class*="fixed"]') || i).position === 'fixed' || i.closest('[class*="fixed"]')); });
    return el ? (el.currentSrc || el.src).split('/').pop().slice(0, 60) : null;
  });
  out.lightbox.s1 = await capSrc();
  await page.screenshot({ path: `${OUT}/ix3-lb-1.png` });
  await page.getByLabel('Следующее фото').click({ timeout: 4000 });
  await page.waitForTimeout(500);
  out.lightbox.s2 = await capSrc();
  await page.getByLabel('Следующее фото').click({ timeout: 4000 });
  await page.waitForTimeout(500);
  out.lightbox.s3 = await capSrc();
  await page.screenshot({ path: `${OUT}/ix3-lb-3.png` });
  await page.getByLabel('Предыдущее фото').click({ timeout: 4000 });
  await page.waitForTimeout(500);
  out.lightbox.s4 = await capSrc();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  out.lightbox.escClosed = !(await page.getByLabel('Следующее фото').count());
} catch (e) { out.lightbox.err = String(e).slice(0, 400); }

// ---- C) PROFILE: month switch hang check (generous waits) ----
await page.goto(authUrl('/franchize/vip-bike/profile'), { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.getByText('Мои байки в парке').first().waitFor({ timeout: 30000 });
await page.waitForTimeout(1000);
const panel = async () => {
  const t = await page.evaluate(() => document.body.innerText);
  const i = t.indexOf('Заработок за месяц');
  return t.slice(i, i + 330).replace(/\n+/g, ' | ');
};
out.profileMonth.push({ label: 'initial', text: await panel() });
await page.locator('button', { hasText: '‹' }).first().click();
// poll up to 10s for «Считаем…» to clear
const t0 = Date.now();
let cleared = false;
while (Date.now() - t0 < 10000) {
  await page.waitForTimeout(500);
  const t = await panel();
  if (!t.includes('Считаем')) { cleared = true; out.profileMonth.push({ label: 'august (after ' + Math.round((Date.now() - t0) / 1000) + 's)', text: t }); break; }
}
if (!cleared) out.profileMonth.push({ label: 'august STUCK >10s', text: await panel() });
await page.screenshot({ path: `${OUT}/ix3-profile-aug.png`, fullPage: false });
// back to september
const t1 = Date.now();
await page.locator('button', { hasText: '›' }).first().click();
let cleared2 = false;
while (Date.now() - t1 < 10000) {
  await page.waitForTimeout(500);
  const t = await panel();
  if (!t.includes('Считаем')) { cleared2 = true; out.profileMonth.push({ label: 'back-to-sept (after ' + Math.round((Date.now() - t1) / 1000) + 's)', text: t }); break; }
}
if (!cleared2) out.profileMonth.push({ label: 'back-to-sept STUCK >10s', text: await panel() });

fs.writeFileSync(`${OUT}/ix3-results.json`, JSON.stringify(out, null, 2));
console.log('story states:', out.storyMonth.length, '| lightbox:', JSON.stringify(out.lightbox).slice(0, 400), '| profileStates:', out.profileMonth.map(p => p.label).join(', '), '| cErr:', out.consoleErrors.length, 'pErr:', out.pageerrors.length);
await browser.close();
