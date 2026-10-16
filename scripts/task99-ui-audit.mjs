// task99 — mobile/desktop UI audit of the salary-transparency surfaces as a
// MOCK USER (djorudjov, 7813830016): forged actor cookie (HMAC with the same
// TELEGRAM_BOT_TOKEN the dev server uses) + NEXT_PUBLIC_USE_MOCK_USER identity.
//
//  profile  → click «Доходы» tab → MyEarningsPanel (shifts TL;DR, rentals
//             TL;DR, team-salaries gate for admin), full-page shots;
//  analytics→ open the CSV table-view modal («Открыть таблицу и экспорт CSV»)
//             → attribution columns presence + inner scroll sanity.
// Flags: page-level horizontal overflow, modal overflow, missing markers.
// Screenshots → /home/z/my-project/task99/.
//
// Run: node --env-file=.env.local scripts/task99-ui-audit.mjs (dev server on :3000)
import { chromium } from "playwright";
import { createHmac } from "crypto";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SLUG = process.env.SLUG || "vip-bike";
const DJ = process.env.MOCK_ACTOR_ID || "7813830016";
const OUT = "/home/z/my-project/task99";
mkdirSync(OUT, { recursive: true });

const secret = process.env.TELEGRAM_BOT_TOKEN || "";
if (!secret) { console.error("TELEGRAM_BOT_TOKEN missing"); process.exit(1); }
const payload = Buffer.from(
  JSON.stringify({ userId: DJ, exp: Math.floor(Date.now() / 1000) + 3600 }),
).toString("base64url");
const sig = createHmac("sha256", secret).update(payload).digest("base64url");

const viewports = [
  { name: "m360", width: 360, height: 780, dsf: 3, mobile: true },
  { name: "m390", width: 390, height: 844, dsf: 3, mobile: true },
  { name: "d1280", width: 1280, height: 900, dsf: 2, mobile: false },
];

const browser = await chromium.launch({ executablePath: "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome" });
const report = [];

const overflowScan = () => {
  const doc = document.documentElement;
  const vw = window.innerWidth;
  const overflowX = Math.max(doc.scrollWidth - vw, 0);
  const sources = [];
  if (overflowX > 2) {
    document.querySelectorAll("body *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 2 && r.width > 24) {
        const cls = typeof el.className === "string" ? el.className.slice(0, 50) : el.tagName;
        sources.push(`${el.tagName}.${cls}@${Math.round(r.right)}`);
      }
    });
  }
  return { overflowX, sources: [...new Set(sources)].slice(0, 6) };
};

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dsf,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });
  await context.addCookies([{
    name: "cartest_tg_actor", value: `${payload}.${sig}`,
    domain: "localhost", path: "/", sameSite: "Lax",
  }]);

  // ── PROFILE → «Доходы» tab ──────────────────────────────────────────────
  {
    const page = await context.newPage();
    const jsErrors = [];
    page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 140)));
    try {
      await page.goto(`${BASE}/franchize/${SLUG}/profile`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForFunction(() => !!document.querySelector('[aria-label="Разделы профиля"]'), { timeout: 40000 }).catch(() => {});
      // click the «Доходы» tab
      const clicked = await page.evaluate(() => {
        const rail = document.querySelector('[aria-label="Разделы профиля"]');
        const tabs = rail ? [...rail.querySelectorAll('[role="tab"]')] : [];
        const target = tabs.find((t) => (t.textContent || "").includes("Доходы"));
        if (target) { target.click(); return true; }
        return false;
      });
      await page.waitForTimeout(1000); // tab switch paint
      // panel data (heavy computeCategoryBonuses) can take seconds on cold run
      await page.waitForFunction(
        () => document.body.innerText.includes("Аренды с моими бонусами") || document.body.innerText.includes("Смены"),
        { timeout: 20000 },
      ).catch(() => {});
      await page.waitForTimeout(1500);
      const audit = await page.evaluate(() => {
        const base = { ...(window.__of ?? {}) };
        const vw = window.innerWidth;
        const doc = document.documentElement;
        const overflowX = Math.max(doc.scrollWidth - vw, 0);
        const text = document.body.innerText;
        const panel = [...document.querySelectorAll("*")].find((el) => el.textContent?.includes("Мои доходы") && el.querySelector("button"));
        // panel-level horizontal overflow (the panel's own container)
        const panelRoot = panel?.closest("main")?.querySelector("section");
        const panelOverflow = panelRoot ? Math.max(panelRoot.scrollWidth - panelRoot.clientWidth, 0) : null;
        // tap-target sanity for +n rub chips
        const chips = [...document.querySelectorAll("span,button")].filter((el) => /^\+\d/.test((el.textContent || "").trim().replace(/\s/g, "")));
        const smallTap = chips.filter((el) => el.tagName === "BUTTON" && el.getBoundingClientRect().height < 24 && el.getBoundingClientRect().height > 0).length;
        return {
          ...base,
          clickedNote: null,
          overflowX,
          panelOverflow,
          markers: {
            myEarnings: text.includes("Мои доходы"),
            rentalsTldr: text.includes("Аренды с моими бонусами"),
            salesTldr: text.includes("Продажи с моими бонусами"),
            shiftsBlock: text.includes("Смены"),
            teamSalariesBtn: text.includes("Зарплаты команды"),
            periodPicker: text.includes("Период расчёта"),
            итого: text.includes("Итого"),
          },
          chipsCount: chips.length,
          smallTap,
        };
      });
      await page.screenshot({ path: `${OUT}/profile-${vp.name}.png` });
      await page.screenshot({ path: `${OUT}/profile-${vp.name}-full.png`, fullPage: true });
      report.push({ vp: vp.name, page: "profile", tabClicked: clicked, ...audit, jsErrors: jsErrors.slice(0, 3) });
    } catch (e) {
      report.push({ vp: vp.name, page: "profile", error: String(e).slice(0, 160) });
    }
    await page.close();
  }

  // ── ANALYTICS → CSV table modal ─────────────────────────────────────────
  {
    const page = await context.newPage();
    const jsErrors = [];
    page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 140)));
    try {
      await page.goto(`${BASE}/franchize/${SLUG}/rentals-analytics`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForFunction(() => document.body.innerText.includes("АРЕНД СЕГОДНЯ") || document.body.innerText.includes("Аренда"), { timeout: 40000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const opened = await page.evaluate(() => {
        const btn = document.querySelector('[aria-label="Открыть таблицу и экспорт CSV"]');
        if (btn) { btn.scrollIntoView({ block: "center" }); btn.click(); return true; }
        return false;
      });
      await page.waitForFunction(
        () => (document.querySelector("table")?.rows.length ?? 0) > 3,
        { timeout: 20000 },
      ).catch(() => {});
      await page.waitForTimeout(1000);
      const audit = await page.evaluate(() => {
        const vw = window.innerWidth;
        const doc = document.documentElement;
        const overflowX = Math.max(doc.scrollWidth - vw, 0);
        const text = document.body.innerText;
        // find the modal scroll container (a div with overflow-auto containing «Итого аренды»)
        const tables = [...document.querySelectorAll("table")];
        const big = tables.sort((a, b) => b.rows.length - a.rows.length)[0] ?? null;
        const wrap = big ? big.closest("div") : null;
        const wrapScrollable = wrap ? wrap.scrollWidth > wrap.clientWidth : false;
        const headerText = big ? [...big.rows[0].cells].map((c) => c.textContent?.trim()) : [];
        return {
          overflowX,
          modalOpen: text.includes("Экспорт") || text.includes("Таблица") || !!big,
          tablesCount: tables.length,
          rows: big?.rows.length ?? 0,
          wrapScrollable,
          cols: headerText.length,
          headerCols: headerText.slice(0, 30),
          hasAttribution: headerText.includes("Оператор (ЗП)") && headerText.includes("Атрибуция ЗП"),
          hasEquipmentFlags: headerText.some((c) => (c || "").includes("Экип")),
          hasSplit: headerText.includes("ЗП техника") && headerText.includes("ЗП экип"),
        };
      });
      await page.screenshot({ path: `${OUT}/analytics-${vp.name}.png` });
      // scroll the modal table right to capture attribution columns:
      // walk up from the table to the actual overflow container
      if (audit.wrapScrollable) {
        await page.evaluate(() => {
          const tables = [...document.querySelectorAll("table")];
          const big = tables.sort((a, b) => b.rows.length - a.rows.length)[0];
          let el = big?.parentElement;
          while (el && el !== document.body) {
            const ovx = getComputedStyle(el).overflowX;
            if (el.scrollWidth > el.clientWidth + 2 && (ovx === "auto" || ovx === "scroll")) { el.scrollLeft = el.scrollWidth; break; }
            el = el.parentElement;
          }
        });
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${OUT}/analytics-${vp.name}-right.png` });
      }
      report.push({ vp: vp.name, page: "analytics", modalOpened: opened, ...audit, jsErrors: jsErrors.slice(0, 3) });
    } catch (e) {
      report.push({ vp: vp.name, page: "analytics", error: String(e).slice(0, 160) });
    }
    await page.close();
  }

  await context.close();
}
await browser.close();
console.log(JSON.stringify(report, null, 2));
