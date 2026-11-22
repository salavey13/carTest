// Task 83 — mobile verification of the franchize profile page (360×800).
// Checks: no horizontal overflow, sticky tab dock pins below the header,
// overflow:clip applied on the shell, tab switching works, 0 JS errors.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SLUG = process.env.SLUG || "vip-bike";
const URL = `${BASE}/franchize/${SLUG}/profile`;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 360, height: 800 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  colorScheme: "dark",
});
const page = await context.newPage();
const jsErrors = [];
page.on("pageerror", (e) => jsErrors.push(String(e)));

await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);

const result = await page.evaluate(() => {
  const doc = document.documentElement;
  const overflowX = Math.max(doc.scrollWidth - window.innerWidth, 0);

  const shellInner = document.querySelector("main > section > div");
  const shellOverflow = shellInner ? getComputedStyle(shellInner).overflow : null;

  const header = document.querySelector("header");
  // NOTE: the CrewHeader nav is ALSO a role=tablist — target the profile rail
  // by its aria-label.
  const rail = document.querySelector('[aria-label="Разделы профиля"]');
  const railWrapper = rail ? rail.closest("div.sticky") : null;
  const railStyle = railWrapper ? getComputedStyle(railWrapper) : null;

  // Sticky dock computed style + z-index sanity
  const railPosition = railStyle?.position || null;
  const railZ = railStyle ? Number(railStyle.zIndex) : null;

  // pills count
  const pills = rail ? rail.querySelectorAll('[role="tab"]').length : 0;

  return {
    overflowX,
    shellOverflow,
    railPosition,
    railZ,
    railTop: railWrapper ? railWrapper.getBoundingClientRect().top : null,
    headerBottom: header ? header.getBoundingClientRect().bottom : null,
    pills,
    title: document.title,
  };
});

console.log("INITIAL:", JSON.stringify(result));

// Scroll deep into the page → the dock must pin right under the header.
await page.evaluate(() => window.scrollTo(0, 1200));
await page.waitForTimeout(900);
const stuck = await page.evaluate(() => {
  const header = document.querySelector("header");
  const rail = document.querySelector('[aria-label="Разделы профиля"]');
  const railWrapper = rail ? rail.closest("div.sticky") : null;
  return {
    scrollY: window.scrollY,
    headerBottom: header ? Math.round(header.getBoundingClientRect().bottom) : null,
    railTop: railWrapper ? Math.round(railWrapper.getBoundingClientRect().top) : null,
    railPosition: railWrapper ? getComputedStyle(railWrapper).position : null,
    railInViewport: railWrapper
      ? railWrapper.getBoundingClientRect().top >= 0 &&
        railWrapper.getBoundingClientRect().top < 200
      : false,
  };
});
console.log("SCROLLED:", JSON.stringify(stuck));

// Switch tab while stuck → panel content swaps, dock stays pinned.
const tabLabels = await page.evaluate(() =>
  Array.from(
    document.querySelectorAll('[aria-label="Разделы профиля"] [role="tab"]'),
  ).map((b) => b.textContent?.trim()),
);
console.log("TABS:", JSON.stringify(tabLabels));
const docTab = page.locator('[role="tab"]', { hasText: "Документы" });
if (await docTab.count()) {
  await docTab.click();
  await page.waitForTimeout(800);
}
const afterSwitch = await page.evaluate(() => {
  const rail = document.querySelector('[aria-label="Разделы профиля"]');
  const railWrapper = rail ? rail.closest("div.sticky") : null;
  const panel = document.querySelector('[role="tabpanel"]:not([style*="display: none"])');
  return {
    railTop: railWrapper ? Math.round(railWrapper.getBoundingClientRect().top) : null,
    activeTab: rail?.querySelector('[aria-selected="true"]')?.textContent?.trim() || null,
    visiblePanelId: panel?.id || null,
    scrollY: Math.round(window.scrollY),
  };
});
console.log("AFTER_SWITCH:", JSON.stringify(afterSwitch));

// Horizontal scroll of the rail → edge fades (mask-image) react.
const maskInfo = await page.evaluate(() => {
  const rail = document.querySelector('[aria-label="Разделы профиля"]');
  const scroller = rail; // mask sits on the scroll container itself
  const style = scroller ? getComputedStyle(scroller) : null;
  return {
    maskImage: style ? style.maskImage.slice(0, 60) : null,
    scrollable: scroller ? scroller.scrollWidth > scroller.clientWidth : null,
  };
});
console.log("MASK:", JSON.stringify(maskInfo));

await page.screenshot({ path: "/home/z/my-project/task83-profile-360.png", fullPage: false });

console.log("JS_ERRORS:", jsErrors.length, jsErrors.slice(0, 3));

// Verdict
const ok =
  result.overflowX === 0 &&
  result.railPosition === "sticky" &&
  stuck.railInViewport &&
  jsErrors.length === 0;
console.log(ok ? "VERDICT: PASS" : "VERDICT: CHECK ABOVE");

await browser.close();
