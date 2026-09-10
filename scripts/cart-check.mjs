import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.route("**/api/franchize/temp-cart*", (route) => route.fulfill({ status: 204, body: "" }));
await page.goto("http://localhost:3000/franchize/vip-bike/cart", { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("franchize-cart-vip-bike", JSON.stringify({ updatedAt: Date.now(), cart: { "aprilia-shiver::базовый|10-минут|стандарт|без-аукциона|base|0||||": { itemId: "aprilia-shiver", qty: 1, options: { package: "Базовый", duration: "10 минут", perk: "стандарт", auction: "Без аукциона", action: "testdrive" } } } }));
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(4500);
const t = (await page.locator("body").innerText()).replace(/\u00a0/g, " ");
console.log("CART HAS LINE:", t.includes("Aprilia"), "| TESTDRIVE:", t.includes("Тест-драйв"));
console.log("keys:", await page.evaluate(() => Object.keys(localStorage)));
console.log("val:", (await page.evaluate(() => localStorage.getItem("franchize-cart-vip-bike"))).slice(0, 300));
await browser.close();
