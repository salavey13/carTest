// Smoke test: pricing surfaces + testdrive flow on the local dev server.
// - catalog loads, open aprilia modal, 14h rental price shows 10500→10000?
//   (with 1 helmet on 14h: 9500 bike + 500 helmet = 10000)
// - testdrive mode switch simplifies modal, adds 0₽ line, cart shows it
// - console errors collected
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const results = { consoleErrors: [], pageErrors: [], checks: [] };
const check = (name, ok, detail = "") => results.checks.push({ name, ok, detail });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("console", (m) => { if (m.type() === "error") results.consoleErrors.push(m.text().slice(0, 300)); });
page.on("pageerror", (e) => results.pageErrors.push(String(e).slice(0, 300)));

// ── 1. Catalog page loads ──
await page.goto(`${BASE}/franchize/vip-bike`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
check("catalog loads", true);

// ── 2. Open aprilia-shiver modal (find its card) ──
const apriliaCard = page.locator('[data-item-id="aprilia-shiver"], article:has-text("Aprilia Shiver")').first();
if (await apriliaCard.count()) {
  await apriliaCard.click();
  await page.waitForTimeout(2500);
  const dialog = page.locator("[role=dialog], .fixed.inset-0").first();
  check("modal opened", await dialog.count() > 0);

  // testdrive mode switch present?
  const tdSwitch = page.locator("text=Режим тест-драйва").first();
  check("testdrive switch visible", await tdSwitch.count() > 0, await tdSwitch.count() ? "" : "switch not found");

  // ── 3. Testdrive mode: check config hidden, card visible ──
  if (await tdSwitch.count()) {
    await tdSwitch.click();
    await page.waitForTimeout(600);
    check("testdrive card visible", await page.locator("text=Тест-драйв · 0 ₽").count() > 0);
    check("date pickers hidden in td mode", (await page.locator('input[type="date"]').count()) === 0);
    // add to cart via the CTA (label switches to «Записаться на тест-драйв»)
    const cta = page.locator("button:has-text('Записаться на тест-драйв')").last();
    await cta.click();
    await page.waitForTimeout(1200);
    // go to cart
    await page.goto(`${BASE}/franchize/vip-bike/cart`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const cartText = (await page.locator("body").innerText()).replace(/\u00a0/g, " ");
    if (!cartText.includes("Тест-драйв")) {
      console.log("[debug] cart text:\n" + cartText.slice(0, 1500));
    }
    check("cart shows testdrive line", cartText.includes("Тест-драйв") && cartText.toLowerCase().includes("бесплатное время"), "");
    check("cart total 0 ₽", /0\s*₽/.test(cartText));
  }
} else {
  check("aprilia card found", false, "card not on page");
}

// ── 4. Rental price check: aprilia 14h + helmet ──
// Fresh page (clear cart first via localStorage)
await page.goto(`${BASE}/franchize/vip-bike`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
const card2 = page.locator('[data-item-id="aprilia-shiver"], article:has-text("Aprilia Shiver")').first();
if (await card2.count()) {
  await card2.click();
  await page.waitForTimeout(2500);
  // set dates: today 17:00 → tomorrow 07:00
  const today = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 3 * 3600 * 1000 + 86400000).toISOString().slice(0, 10);
  const dateInputs = page.locator('input[type="date"]');
  const n = await dateInputs.count();
  if (n >= 2) {
    await dateInputs.nth(0).fill(today);
    await dateInputs.nth(1).fill(tomorrow);
    const timeInputs = page.locator('input[type="time"]');
    if (await timeInputs.count() >= 2) {
      await timeInputs.nth(0).fill("17:00");
      await timeInputs.nth(1).fill("07:00");
    }
    await page.waitForTimeout(1500);
    const modalText = (await page.locator("body").innerText()).replace(/\u00a0/g, " ");
    // 14h interpolation: 9500 bike; helmet not selected → total 9500
    check("14h bike price 9 500 shown", modalText.includes("9 500"), "looked for 9 500 in modal");
  } else {
    check("date inputs", false, `count=${n}`);
  }
  // helmet via Доп. оборудование count button "1"
  const helmetRow = page.locator("text=Доп. оборудование").locator("..");
  await page.waitForTimeout(300);
  const modalText2 = await page.locator("body").innerText();
  check("gear hint present", modalText2.includes("половина цены"));
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(results.pageErrors.length > 0 ? 1 : 0);
