// task100 — UI audit of the salary-polish pass as MOCK USERS (forged actor
// cookie, same HMAC scheme as lib/telegram-actor-cookie.ts):
//   • salavey13 (413553377, owner) — the reporter: must NOW see the rentals
//     TL;DR section even with 0 attributed October rentals (empty state),
//     the «Зарплаты команды» modal, a horizontally scrollable team table,
//     and @djorudjov (not «Dmitry User») in the leaderboard.
//   • djorudjov (7813830016, admin) — regression: rentals rows still render,
//     team modal opens for admin too.
// Viewports 360/390/1280; page-level overflowX must stay 0.
// Screenshots → /home/z/my-project/task100/.
//
// Run (dev server on :3000): node --env-file=.env.local scripts/task100-ui-audit.mjs
import { chromium } from "playwright";
import { createHmac } from "crypto";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SLUG = process.env.SLUG || "vip-bike";
const OUT = "/home/z/my-project/task100";
mkdirSync(OUT, { recursive: true });

const secret = process.env.TELEGRAM_BOT_TOKEN || "";
if (!secret) { console.error("TELEGRAM_BOT_TOKEN missing"); process.exit(1); }

const forgeCookie = (userId) => {
  const payload = Buffer.from(
    JSON.stringify({ userId, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
};

const ACTORS = [
  { name: "salavey13", id: "413553377" },
  { name: "djorudjov", id: "7813830016" },
];

const viewports = [
  { name: "m360", width: 360, height: 780, dsf: 3, mobile: true },
  { name: "m390", width: 390, height: 844, dsf: 3, mobile: true },
  { name: "d1280", width: 1280, height: 900, dsf: 2, mobile: false },
];

const browser = await chromium.launch({ executablePath: "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome" });
const report = [];

for (const actor of ACTORS) {
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dsf,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
    });
    await context.addCookies([{
      name: "cartest_tg_actor", value: forgeCookie(actor.id),
      domain: "localhost", path: "/", sameSite: "Lax",
    }]);

    const page = await context.newPage();
    const jsErrors = [];
    page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 140)));
    try {
      await page.goto(`${BASE}/franchize/${SLUG}/profile`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForFunction(() => !!document.querySelector('[aria-label="Разделы профиля"]'), { timeout: 40000 }).catch(() => {});
      const clicked = await page.evaluate(() => {
        const rail = document.querySelector('[aria-label="Разделы профиля"]');
        const tabs = rail ? [...rail.querySelectorAll('[role="tab"]')] : [];
        const target = tabs.find((t) => (t.textContent || "").includes("Доходы"));
        if (target) { target.click(); return true; }
        return false;
      });
      // cold computeCategoryBonuses can take seconds — wait for the section
      // marker itself (грабля from task99: waitForFunction, not sleep)
      await page.waitForFunction(
        () => document.body.innerText.includes("Аренды с моими бонусами"),
        { timeout: 30000 },
      ).catch(() => {});
      await page.waitForTimeout(1200);

      const profileAudit = await page.evaluate(() => {
        const vw = window.innerWidth;
        const overflowX = Math.max(document.documentElement.scrollWidth - vw, 0);
        const text = document.body.innerText;
        return {
          overflowX,
          markers: {
            myEarnings: text.includes("Мои доходы"),
            rentalsTldr: text.includes("Аренды с моими бонусами"),
            rentalsEmptyState: text.includes("В выбранном периоде аренд с моими бонусами нет"),
            salesTldr: text.includes("Продажи с моими бонусами"),
            salesEmptyState: text.includes("В выбранном периоде продаж с моими бонусами нет"),
            zaSmenyLabel: text.includes("За смены"),
            teamSalariesBtn: text.includes("Зарплаты команды"),
          },
        };
      });
      await page.screenshot({ path: `${OUT}/profile-${actor.name}-${vp.name}.png`, fullPage: true });

      // ── team modal: open, scroll check, naming check ──────────────────────
      let teamModal = null;
      const opened = await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").includes("Зарплаты команды"));
        if (btn) { btn.scrollIntoView({ block: "center" }); btn.click(); return true; }
        return false;
      });
      if (opened) {
        await page.waitForFunction(
          () => document.body.innerText.includes("Сотрудник") || document.body.innerText.includes("Нет данных о зарплатах"),
          { timeout: 30000 },
        ).catch(() => {});
        await page.waitForTimeout(1500);
        teamModal = await page.evaluate(() => {
          const text = document.body.innerText;
          const table = [...document.querySelectorAll("table")].find((t) => (t.textContent || "").includes("Сотрудник"));
          if (!table) return { tableFound: false, emptyState: text.includes("Нет данных о зарплатах") };
          let el = table.parentElement;
          while (el && el !== document.body) {
            const ovx = getComputedStyle(el).overflowX;
            if (ovx === "auto" || ovx === "scroll") break;
            el = el.parentElement;
          }
          const scrollWrap = el && el !== document.body ? el : null;
          const scrollable = scrollWrap ? scrollWrap.scrollWidth > scrollWrap.clientWidth + 2 : false;
          let scrolled = 0;
          if (scrollWrap && scrollable) { scrollWrap.scrollLeft = scrollWrap.scrollWidth; scrolled = scrollWrap.scrollLeft; }
          return {
            tableFound: true,
            scrollable,
            scrolled,
            wrapWidth: scrollWrap?.clientWidth ?? null,
            tableWidth: table.scrollWidth,
            headers: [...table.rows[0].cells].map((c) => c.textContent?.trim()),
            hasHoursHeader: (table.rows[0].textContent || "").includes("Часы"),
            namedDjOrMock: text.includes("@djorudjov") || text.includes("@mockuser"), // row may still be clobbered until Paul runs the repair SQL — mechanism is what we verify
            namedSal: text.includes("@salavey13"),
            fullNameSecondary: text.includes("Dmitry User") || text.includes("Mock User"), // by design: muted second line
          };
        });
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/team-modal-${actor.name}-${vp.name}.png` });
        // close the modal before the next viewport (fresh state)
        await page.evaluate(() => {
          const close = document.querySelector('[data-state="open"] button.lucide-x, [role="dialog"] button.absolute');
          if (close) close.click();
        });
        await page.waitForTimeout(400);
      }

      report.push({ actor: actor.name, vp: vp.name, page: "profile", tabClicked: clicked, ...profileAudit, teamModal, jsErrors: jsErrors.slice(0, 3) });
    } catch (e) {
      report.push({ actor: actor.name, vp: vp.name, page: "profile", error: String(e).slice(0, 160) });
    }
    await page.close();
    await context.close();
  }
}
await browser.close();
console.log(JSON.stringify(report, null, 2));
