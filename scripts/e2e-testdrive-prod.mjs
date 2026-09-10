// PRODUCTION E2E: testdrive web flow, end-to-end through checkout.
// Signs valid Telegram WebApp initData with the bot token, injects it via
// addInitScript, then walks: catalog → modal → testdrive mode → cart →
// order → submit. Verifies the success UI; DB/doc checks run afterwards.
import { chromium } from "playwright";
import { createHash, createHmac } from "crypto";

const BASE = "https://v0-car-test.vercel.app";
const BOT_TOKEN = "8037950842:AAHfsLxQULmAM2zHJ_HD0RvO0OUYZ12fa-M";
const USER = { id: 413553377, first_name: "E2E", last_name: "Testdrive", username: "salavey13", language_code: "ru" };

// ── sign initData (official Telegram WebApp algorithm) ──
function signInitData(user) {
  const authDate = Math.floor(Date.now() / 1000);
  const userJson = JSON.stringify(user);
  const params = new URLSearchParams({ auth_date: String(authDate), user: userJson });
  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  params.set("hash", hash);
  return params.toString();
}

const initData = signInitData(USER);
const results = { consoleErrors: [], pageErrors: [], checks: [], orderId: `order-tde2e-${Date.now()}` };
const check = (name, ok, detail = "") => results.checks.push({ name, ok, detail });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") results.consoleErrors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => results.pageErrors.push(String(e).slice(0, 200)));

// Inject Telegram WebApp mock with REAL signed initData
await page.addInitScript((data) => {
  const w = window;
  w.Telegram = w.Telegram || {};
  w.Telegram.WebApp = {
    initData: data,
    initDataUnsafe: { user: JSON.parse(new URLSearchParams(data).get("user")) },
    version: "7.10",
    platform: "web",
    colorScheme: "dark",
    ready: () => {},
    expand: () => {},
    HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
    MainButton: { hide: () => {}, show: () => {} },
    BackButton: { hide: () => {}, show: () => {} },
    openLink: () => {},
    openTelegramLink: () => {},
    showAlert: () => {},
    showConfirm: () => {},
    disableVerticalSwipes: () => {},
    setHeaderColor: () => {},
    setBackgroundColor: () => {},
  };
}, initData);

// ── 1. catalog: open aprilia modal ──
await page.goto(`${BASE}/franchize/vip-bike`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(6000);
const apriliaCard = page.locator('[data-item-id="aprilia-shiver"], article:has-text("Aprilia Shiver")').first();
check("aprilia card", await apriliaCard.count() > 0);
await apriliaCard.click();
await page.waitForTimeout(3500);

// ── 2. testdrive mode ON ──
const tdSwitch = page.locator("text=Режим тест-драйва").first();
check("mode switch", await tdSwitch.count() > 0);
await tdSwitch.click();
await page.waitForTimeout(500);
check("td card", await page.locator("text=Тест-драйв · 0 ₽").count() > 0);

// ── 3. add via footer CTA ──
const cta = page.locator("button:has-text('Записаться на тест-драйв')").last();
await cta.click();
await page.waitForTimeout(2000);

// ── 4. cart shows the marked line ──
await page.goto(`${BASE}/franchize/vip-bike/cart`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(5000);
const cartText = (await page.locator("body").innerText()).replace(/\u00a0/g, " ");
check("cart testdrive badge", cartText.includes("Тест-драйв"), "");
check("cart free label", cartText.toLowerCase().includes("бесплатное время"), "");

// continue to order page
const toOrder = page.locator("a:has-text('Оформить'), button:has-text('Оформить')").first();
if (await toOrder.count()) {
  await toOrder.click();
  await page.waitForTimeout(6000);
} else {
  await page.goto(`${BASE}/franchize/vip-bike/order/${results.orderId}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(5000);
}
const orderText = (await page.locator("body").innerText()).replace(/\u00a0/g, " ");
check("order testdrive section", orderText.includes("Данные для тест-драйва"), orderText.slice(0, 200));

// ── 5. fill contacts + passport only ──
await page.locator('input[placeholder="Имя и фамилия"]').first().fill("Е2Е Тестдрайв");
await page.locator('input[placeholder="Телефон"]').first().fill("+79001234567");
const passportSeries = page.locator('input[placeholder*="Серия паспорта"]').first();
await passportSeries.fill("4509");
await page.locator('input[placeholder*="Номер паспорта"]').first().fill("098765");
await page.waitForTimeout(800);
const submitBtn = page.locator("button:has-text('Подтвердить заказ')").last();
check("submit enabled with passport only", !(await submitBtn.isDisabled().catch(() => true)));

// ── 6. submit for real ──
await submitBtn.click();
try {
  await page.waitForTimeout(20000);
  const doneText = (await page.locator("body").innerText()).replace(/\u00a0/g, " ");
  check("checkout succeeded", /заказ (оформлен|принят)|RENTAL CREATED|договор (готов|отправлен)|успешно/i.test(doneText), doneText.slice(0, 400).replace(/\n+/g, " | "));
} catch (e) {
  check("checkout completed", false, String(e).slice(0, 200));
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(results.pageErrors.length > 0 ? 1 : 0);
