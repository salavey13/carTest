// CRITIC R1 recheck — 3 pages, console errors + pageerrors + failed requests (>=400)
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
  params.set('query_id', 'AAF criticR1recheck');
  params.set('user', JSON.stringify(user));
  const dcs = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
  return params.toString();
}
const TG_USER = { id: 1569357326, first_name: 'Влад', last_name: 'Рябов', username: 'RyabovVld', photo_url: 'https://t.me/i/userpic/320/QhgPv9VUGL1yvdKbMM3yDfvgJ7QIsv6J6pPv2IZEfe8.svg', language_code: 'ru' };
const authUrl = (p) => `http://localhost:3000${p}#tgWebAppData=${encodeURIComponent(signInitData(TG_USER))}`;

const PAGES = [
  { name: 'fleet', path: '/franchize/vip-bike/bikes', marker: 'Ducati' },
  { name: 'story', path: '/franchize/vip-bike/bikes/ducati-panigale-s-electro-green', marker: 'ОДОМЕТР' },
  { name: 'profile', path: '/franchize/vip-bike/profile', marker: 'Мои байки в парке' },
];

const res = { pages: [], consoleErrors: [], pageerrors: [], failedRequests: [], abortedRequests: [] };
const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') res.consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => res.pageerrors.push(String(e).slice(0, 300)));
page.on('response', (r) => { if (r.status() >= 400) res.failedRequests.push({ url: r.url().slice(0, 200), status: r.status() }); });
page.on('requestfailed', (r) => { const f = r.failure()?.errorText || ''; if (!/ERR_ABORTED/.test(f)) res.abortedRequests.push({ url: r.url().slice(0, 200), err: f }); });

const t0 = Date.now();
for (const p of PAGES) {
  const t = Date.now();
  const entry = { name: p.name, url: p.path };
  try {
    await page.goto(authUrl(p.path), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByText(p.marker, { exact: false }).first().waitFor({ timeout: 25000 }).catch(() => { entry.markerMissed = true; });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    entry.msToMarker = Date.now() - t;
    entry.title = await page.title().catch(() => '');
    entry.hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2).catch(() => null);
  } catch (e) { entry.err = String(e).slice(0, 200); }
  res.pages.push(entry);
  if (Date.now() - t0 > 95000) { res.note = 'budget reached, stopping early'; break; }
}
res.wallMs = Date.now() - t0;
fs.writeFileSync(`${OUT}/recheck-r1.json`, JSON.stringify(res, null, 2));
console.log(JSON.stringify({ consoleErrors: res.consoleErrors.length, pageerrors: res.pageerrors.length, failed: res.failedRequests.length, aborted: res.abortedRequests.length, pages: res.pages, wallMs: res.wallMs }, null, 1));
await browser.close();
