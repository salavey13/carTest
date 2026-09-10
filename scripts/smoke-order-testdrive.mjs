// Order-page testdrive UI check: blocker copy, docs rule, submit gating.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const results = { consoleErrors: [], pageErrors: [], checks: [] };
const check = (name, ok, detail = "") => results.checks.push({ name, ok, detail });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
// The temp-cart server sync would overwrite the freshly seeded local cart
// with the (empty) server copy — block it so localStorage stays authoritative.
await page.route("**/api/franchize/temp-cart*", (route) => route.fulfill({ status: 204, body: "" }));
page.on("console", (m) => { if (m.type() === "error") results.consoleErrors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => results.pageErrors.push(String(e).slice(0, 200)));

const orderId = `order-testdrive-ui-${Date.now()}`;
// Seed a testdrive cart line via localStorage ON the order page itself, then
// reload so hydration picks it up (setting on a loaded catalog page races —
// the mounted app overwrites the key with its in-memory state).
await page.goto(`${BASE}/franchize/vip-bike/order/${orderId}`, { waitUntil: "domcontentloaded" });
await page.evaluate((oid) => {
  try { localStorage.clear(); } catch {}
  const cartKey = "franchize-cart:vip-bike";
  const line = {
    itemId: "aprilia-shiver",
    qty: 1,
    options: { package: "Базовый", duration: "10 минут", perk: "стандарт", auction: "Без аукциона", action: "testdrive" },
  };
  localStorage.setItem(cartKey, JSON.stringify({ updatedAt: Date.now(), cart: { [`${oid}-l1`]: line } }));
}, orderId);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);

const body = (await page.locator("body").innerText()).replace(/\u00a0/g, " ");
console.log("[debug] keys:", await page.evaluate(() => Object.keys(localStorage)));
console.log("[debug] page head:\n" + body.slice(400, 2600));
check("order page shows testdrive docs section", body.includes("Данные для тест-драйва"), "");
check("copy says passport OR license", body.includes("паспорт") && body.includes("или"), "");
check("no dates blocker for testdrive", !body.includes("Выберите период тест-драйва"), "");

const submitBtn = page.locator("button:has-text('Подтвердить заказ')").last();
const disabledBefore = await submitBtn.isDisabled().catch(() => null);
check("submit disabled without docs", disabledBefore === true, String(disabledBefore));

// Fill contact fields first, then ONLY passport → enabled
const nameInput = page.locator('input[placeholder="Имя и фамилия"]');
const phoneInput = page.locator('input[placeholder="Телефон"]');
if (await nameInput.count()) {
  await nameInput.fill("Тест Тестов");
  await phoneInput.fill("+79001234567");
}
const inputs = page.locator('input[placeholder*="Серия паспорта"]');
if (await inputs.count()) {
  await inputs.fill("4509");
  await page.locator('input[placeholder*="Номер паспорта"]').fill("123456");
  await page.waitForTimeout(600);
  const disabledAfter = await submitBtn.isDisabled().catch(() => null);
  check("submit enabled with passport only", disabledAfter === false, String(disabledAfter));
} else {
  check("passport inputs found", false, "no input[placeholder*='Серия паспорта']");
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(results.pageErrors.length > 0 ? 1 : 0);
