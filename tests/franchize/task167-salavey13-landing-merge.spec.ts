// tests/franchize/task167-salavey13-landing-merge.spec.ts
//
// BOSS 2026-10-30: «when we created /sly13 landing we accidently created
// /public/salavey13.html:) please look at it, fix links inside a bit: for
// example vip-bike.ru/franchize/sly13, but actually on vip-bike.ru vps our
// rental repo is deployed to subdomain like this: rental.vip-bike.ru/franchize/
// sly13 — try to merge interesting stuff to real actual landing: /salavey13
// (note that feedback cta form is already wired up on main landing, so keep
// it, just merge good info if needed) … doublecheck that info is valid and
// real and not too much, wall of text look bad — more pictures the better;)»
//
// Решение (spec pins source + pure logic, рецепт task133/138):
//   1. Канонический маршрут витрины — /salavey13 (ник владельца); старый
//      /sly13 редиректится (next.config) и остаётся в startsWith-матчах
//      ClientLayout для переживания свежих клиентских навигаций.
//   2. Из статичного HTML слито: секция «07 · автор» (разработчик + боевой
//      экипаж с реальным фото), полоса «как проходит работа» (4 шага),
//      контакты в футере (email, бот, площадка). Форма заявки НЕ перенесена —
//      на витрине уже есть FeedbackModal → callback-lead (boss: «keep it»).
//   3. Приватные цифры сезона из статичного HTML НЕ слиты (boss 2026-10-25,
//      пин task138 продолжается здесь).
//   4. Ссылки на витрины экипажей внутри React-лендинга — ОТНОСИТЕЛЬНЫЕ
//      (тот же origin, что rental.vip-bike.ru в проде; абсолютные
//      vip-bike.ru/franchize/* из статичного HTML в порт не тащим).
//   5. /public/salavey13.html удалён после слияния.

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const SLY = "app/salavey13/Sly13LandingClient.tsx";
const SLY_PAGE = "app/salavey13/page.tsx";
const LAYOUT = "components/layout/ClientLayout.tsx";
const NEXT_CONFIG = "next.config.mjs";

describe("task167 · canonical route /salavey13 (boss: «real actual landing: /salavey13»)", () => {
  it("the landing lives at app/salavey13 and the old route dir is GONE", () => {
    expect(existsSync(join(ROOT, SLY))).toBe(true);
    expect(existsSync(join(ROOT, SLY_PAGE))).toBe(true);
    expect(existsSync(join(ROOT, "app/sly13"))).toBe(false);
  });

  it("next.config redirects /sly13 → /salavey13 (old links keep working)", () => {
    const cfg = read(NEXT_CONFIG);
    const idx = cfg.indexOf("source: '/sly13'");
    expect(idx).toBeGreaterThan(-1);
    const block = cfg.slice(idx, idx + 160);
    expect(block).toContain("destination: '/salavey13'");
  });

  it("ClientLayout theme matches BOTH /salavey13 and stale /sly13 navigations", () => {
    const layout = read(LAYOUT);
    expect(layout).toContain('if (pathname.startsWith("/salavey13") || pathname.startsWith("/sly13"))');
    // the theme entry carries both paths for the generic matcher
    expect(layout).toContain('paths: ["/salavey13", "/sly13"]');
  });

  it("the accidental static HTML is deleted after the merge", () => {
    expect(existsSync(join(ROOT, "public/salavey13.html"))).toBe(false);
  });

  it("feedback modal stays wired (boss: «feedback cta form is already wired … keep it») — attribution now /salavey13", () => {
    const sly = read(SLY);
    expect(sly).toContain("landingPath=\"/salavey13\"");
    expect(sly).toContain("formSource=\"sly13-feedback-modal\"");
    // the static clipboard-to-telegram form was NOT ported
    expect(sly).not.toContain("navigator.clipboard.writeText");
    expect(sly).not.toContain("data-form");
  });
});

describe("task167 · merged «07 · автор» section (bio from the static HTML)", () => {
  const sly = read(SLY);

  it("section exists with nav anchor and ghost wordmark", () => {
    expect(sly).toContain('id="author"');
    expect(sly).toContain("07 · автор");
    expect(sly).toContain('href: "#author"'); // NAV_LINKS entry
    expect(sly).toContain('SlyGhostWord word="автор"');
  });

  it("developer card: real, verified contacts (t.me + email from PRIVACY_POLICY.md)", () => {
    expect(sly).toContain("https://t.me/SALAVEY13");
    expect(sly).toContain("mailto:salavey13@gmail.com");
    expect(sly).toContain("salavey13@gmail.com");
    // the honest one-developer story
    expect(sly).toContain("Один за экраном");
    expect(sly).toContain("Dev · Founder");
  });

  it("tech stack chips survived the merge", () => {
    for (const chip of ["Next.js", "Supabase", "Telegram Mini App", "OCR документов", "Боты заказов"]) {
      expect(sly).toContain(chip);
    }
  });

  it("crew card: real photo from carpix (http 200) + «more pictures» over wall of text", () => {
    expect(sly).toContain("sequence-zero/image_1.jpg");
    expect(sly).toContain('alt="Электробайк боевого экипажа VIP BIKE"');
  });

  it("crew card links the RELATIVE franchize catalog (same origin = rental subdomain in prod)", () => {
    // the /franchize/vip-bike Link exists; no absolute vip-bike.ru/franchize links were ported
    expect(sly).toContain('href="/franchize/vip-bike"');
    expect(sly).not.toContain("https://vip-bike.ru/franchize/");
    expect(sly).not.toContain("vip-bike.ru/franchize/sly13");
  });

  it("NO private vip-bike season numbers leaked from the static HTML (task138 ban continues)", () => {
    for (const banned of ["308", "2,0 млн", "16,5 млн", "13,0 млн", "+188", "154", "«sus»", "31 дкп", "109 аренд"]) {
      expect(sly).not.toContain(banned);
    }
  });
});

describe("task167 · «как проходит работа» strip (process, compact — not a wall)", () => {
  const sly = read(SLY);

  it("four steps live inside #services as a compact grid", () => {
    expect(sly).toContain("const PROCESS = [");
    for (const step of ["Заявка", "Бриф", "Запуск", "Рост"]) {
      expect(sly).toContain(`title: "${step}"`);
    }
    // rendered via map into the services section
    expect(sly).toContain("{PROCESS.map((s) => (");
    expect(sly).toContain("полоса «как проходит работа»");
  });

  it("honest timeline claim survives (от двух дней — same as services copy)", () => {
    expect(sly).toContain("от двух дней");
  });
});

describe("task167 · footer contacts enrichment (from the static HTML)", () => {
  const sly = read(SLY);

  it("real HQ address of the vip-bike base, linking the MAIN site (not rental subdomain)", () => {
    expect(sly).toContain("пл. Комсомольская, 2 · Нижний Новгород");
    // main site link is absolute vip-bike.ru (different repo on the VPS)
    expect(sly).toContain('href="https://vip-bike.ru"');
  });

  it("bot and email join the footer contacts", () => {
    expect(sly).toContain("https://t.me/oneBikePlsBot");
    expect(sly).toContain("Бот заказов · oneBikePlsBot");
  });
});

describe("task167 · partner interlinks point at the canonical /salavey13", () => {
  const surfaces = [
    "app/page.tsx",
    "app/vipbikerental/features/PartnersCrewsSection.tsx",
    "app/moto-selection/page.tsx",
    "app/mototehnn/page.tsx",
    "app/leorus/LeorusLandingClient.tsx",
    "app/georg-electro/page.tsx",
  ];

  it.each(surfaces)("%s links the SLY13 vitrine at /salavey13", (file) => {
    const src = read(file);
    expect(src).toContain('href: "/salavey13"');
    expect(src).not.toContain('href: "/sly13"');
    expect(src).not.toContain('href="/sly13"');
  });

  it("the moved page still resolves the sly13 CREW palette (crew slug is untouched)", () => {
    const page = read(SLY_PAGE);
    expect(page).toContain('getCrewPaletteBySlug("sly13")');
  });
});
