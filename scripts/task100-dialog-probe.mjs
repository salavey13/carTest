// one-off: dump team modal dialog className + computed width at 360px
import { chromium } from "playwright";
import { createHmac } from "crypto";

const BASE = "http://localhost:3000";
const secret = process.env.TELEGRAM_BOT_TOKEN || "";
const payload = Buffer.from(JSON.stringify({ userId: "413553377", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
const sig = createHmac("sha256", secret).update(payload).digest("base64url");

const browser = await chromium.launch({ executablePath: "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome" });
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await ctx.addCookies([{ name: "cartest_tg_actor", value: `${payload}.${sig}`, domain: "localhost", path: "/", sameSite: "Lax" }]);
const page = await ctx.newPage();
await page.goto(`${BASE}/franchize/vip-bike/profile`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => !!document.querySelector('[aria-label="Разделы профиля"]'), { timeout: 40000 }).catch(() => {});
await page.evaluate(() => {
  const rail = document.querySelector('[aria-label="Разделы профиля"]');
  const target = [...rail.querySelectorAll('[role="tab"]')].find((t) => (t.textContent || "").includes("Доходы"));
  target?.click();
});
await page.waitForFunction(() => document.body.innerText.includes("Аренды с моими бонусами"), { timeout: 30000 }).catch(() => {});
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes("Зарплаты команды"));
  btn?.click();
});
await page.waitForFunction(() => document.body.innerText.includes("Сотрудник"), { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return { dialog: null };
  const cs = getComputedStyle(dlg);
  const table = [...dlg.querySelectorAll("table")][0];
  const wrap = table?.parentElement;
  return {
    dialog: {
      className: dlg.className,
      width: cs.width, maxWidth: cs.maxWidth, overflowX: cs.overflowX, overflowY: cs.overflowY,
      rectW: Math.round(dlg.getBoundingClientRect().width),
      scrollW: dlg.scrollWidth, clientW: dlg.clientWidth,
    },
    wrap: wrap ? { cls: wrap.className.slice(0, 60), clientW: wrap.clientWidth, scrollW: wrap.scrollWidth, ovx: getComputedStyle(wrap).overflowX } : null,
    tableW: table?.scrollWidth,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
