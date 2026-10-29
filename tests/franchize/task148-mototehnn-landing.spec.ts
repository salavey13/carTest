// Task 148 — codereview fix (table) + МОТОТЕХ НН landing.
//
// Boss 2026-10-27: «codereview the table and create mototeh landing with
// quality bar on par with other landings (/vipbikerental, /moto-selection,
// /sly13, /leorus, /georg-electro)».
//
// Layers pinned here:
//   • /mototehnn landing — RSC in the georg-electro DNA: crew palette from
//     DB with a hard fallback (sly13 resilience), own nav+footer, ken-burns
//     hero, ticker, ms-glass services (GlassServiceCard), RestBreak,
//     GhostWordmark, сквозной PartnerLogoGrid.
//   • Lead form — the SHARED FeedbackModal POSTing to the existing
//     /api/franchize/callback-lead со slug «nn-mototeh-nn» (crew exists in
//     DB: 9d274a68-…, motoSpot kind "shop"). Zero new server code.
//   • Content honesty — everything on the landing was dug from
//     mototehnn.ru (diler BENDA, 100+ техники, 10 000+ запчастей, эвакуация
//     30–60 мин, Артельная 15б, +7 (831) 242-90-00, часы, соцсети) — no
//     invented facts.
//   • Interlink all-to-all — mototehnn tile appears in ALL partner grids
//     (root /, /vipbikerental, /moto-selection, /sly13, /leorus,
//     /georg-electro) and the mototehnn landing links back to all five;
//     sly13's pipeline list points nn-mototeh-nn at /mototehnn now.
//   • Chrome suppression — ClientLayout THEME_CONFIG.mototehnn.
//   • Assets — 7 compressed landing photos + the processed partner logo on
//     disk (mozjpeg ≤ ~150 KB each, the task-135 compression discipline).
//   • Table codereview fix — already pinned in task146 spec (v3-safe
//     scrollbar thumb); this file pins the landing half.

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const src = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

const landing = src("app/mototehnn/page.tsx");
const clientLayout = src("components/layout/ClientLayout.tsx");

describe("task148 · /mototehnn landing — architecture DNA", () => {
  it("RSC page with crew palette from DB + hard fallback (sly13 resilience)", () => {
    expect(landing).toContain('getCrewPaletteBySlug("nn-mototeh-nn")');
    expect(landing).toContain("} catch {");
    expect(landing).toContain("p = P;");
  });

  it("shared FeedbackModal → existing callback-lead endpoint, crew slug nn-mototeh-nn", () => {
    expect(landing).toContain('import FeedbackModal from "../moto-selection/FeedbackModal"');
    expect(landing).toContain('slug="nn-mototeh-nn"');
    expect(landing).toContain('formSource="mototehnn-landing"');
    expect(landing).toContain('landingPath="/mototehnn"');
    // open triggers ride the shared [data-lead-modal-open] delegation
    expect(landing.match(/data-lead-modal-open/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("shared landing DNA: glass services, RestBreak, GhostWordmark, PartnerLogoGrid", () => {
    expect(landing).toContain("GlassServiceCard");
    expect(landing).toContain("GlassServiceCardStyle");
    expect(landing).toContain("<RestBreak");
    expect(landing).toContain("<GhostWordmark");
    expect(landing).toContain("<PartnerLogoGrid");
  });

  it("ken-burns hero + ticker + reduced-motion off-switch", () => {
    expect(landing).toContain("mt-kenburns");
    expect(landing).toContain("mt-ticker-track");
    expect(landing).toContain("prefers-reduced-motion: reduce");
  });

  it("SEO metadata mentions the real positioning (дилер BENDA, НН)", () => {
    expect(landing).toContain("МОТОТЕХ НН — мотосалон, мотозапчасти и мотосервис · Нижний Новгород");
    expect(landing).toContain("Официальный дилер BENDA");
  });
});

describe("task148 · content honesty (dug from mototehnn.ru)", () => {
  it("real contacts: Артельная 15б, +7 (831) 242-90-00, часы, соцсети", () => {
    expect(landing).toContain('const PHONE_HREF = "tel:+78312429000"');
    expect(landing).toContain('"+7 (831) 242-90-00"');
    expect(landing).toContain("https://t.me/mototehnn");
    expect(landing).toContain("https://vk.com/mototehnn");
    expect(landing).toContain("https://mototehnn.ru");
    expect(landing).toContain("Артельная");
    expect(landing).toContain("Пн–Сб: 10:00–19:00 · Вс: 10:00–16:00");
  });

  it("real numbers: 100+ техники, 10 000+ запчастей, эвакуация 30–60 минут", () => {
    expect(landing).toContain("100+");
    expect(landing).toContain("10 000+");
    expect(landing).toContain("30–60");
  });

  it("13 vehicle types + parts categories + brands — catalog truth, not fiction", () => {
    expect(landing).toContain('"Квадроциклы с ПТС/ПСМ"');
    expect(landing).toContain('"Мотобуксировщики"');
    expect(landing).toContain('"Двигатели и комплектующие"');
    expect(landing).toContain('"BENDA"');
    expect(landing).toContain('"Vento (VMC)"');
  });
});

describe("task148 · interlink all-to-all (5/5 витрин ссылаются друг на друга)", () => {
  const surfaces: [string, string][] = [
    ["root landing", "app/page.tsx"],
    ["vipbikerental", "app/vipbikerental/features/PartnersCrewsSection.tsx"],
    ["moto-selection", "app/moto-selection/page.tsx"],
    ["sly13", "app/salavey13/Sly13LandingClient.tsx"],
    ["leorus", "app/leorus/LeorusLandingClient.tsx"],
    ["georg-electro", "app/georg-electro/page.tsx"],
  ];

  it.each(surfaces)("%s links to /mototehnn with the processed logo on a light backing", (_name, file) => {
    const s = src(file);
    expect(s).toContain('href: "/mototehnn"');
    expect(s).toContain('logoSrc: "/logos/mototehnn-logo.png"');
    expect(s).toContain('lightBacking: true'); // black silhouette logo needs a light tile
  });

  it("the landing links back to all five sibling vitrines", () => {
    const grid = landing.slice(landing.indexOf("<PartnerLogoGrid"));
    // task167 re-baseline: the SLY13 vitrine moved to its canonical /salavey13
    for (const href of ["/vipbikerental", "/moto-selection", "/salavey13", "/leorus", "/georg-electro"]) {
      expect(grid).toContain(`href: "${href}"`);
    }
  });

  it("sly13 pipeline: nn-mototeh-nn now points at /mototehnn (no dead null href)", () => {
    const sly = src("app/salavey13/Sly13LandingClient.tsx");
    expect(sly).toContain('{ slug: "nn-mototeh-nn", href: "/mototehnn"');
    expect(sly).not.toContain('{ slug: "nn-mototeh-nn", href: null');
  });
});

describe("task148 · platform chrome suppressed + assets on disk", () => {
  it("ClientLayout THEME_CONFIG.mototehnn: no header/footer/bottomnav/chat", () => {
    expect(clientLayout).toContain("mototehnn: {");
    expect(clientLayout).toContain('paths: ["/mototehnn"]');
    const theme = clientLayout.slice(
      clientLayout.indexOf("mototehnn: {"),
      clientLayout.indexOf("franchize: {"),
    );
    expect(theme).toContain("Header: null");
    expect(theme).toContain("Footer: null");
    expect(theme).toContain("hideStickyChat: true");
    expect(clientLayout).toContain('return THEME_CONFIG.mototehnn;');
  });

  it("7 compressed landing photos exist (≤ ~150 KB each, mozjpeg discipline)", () => {
    const dir = resolve(ROOT, "public/images/mototehnn");
    const files = readdirSync(dir).filter((f) => f.endsWith(".jpg"));
    expect(files.length).toBe(7);
    for (const f of files) {
      const kb = statSync(resolve(dir, f)).size / 1024;
      expect(kb).toBeLessThan(150);
      expect(kb).toBeGreaterThan(50); // not a degraded stub
    }
    for (const name of ["hero", "salon", "parts", "service-to", "service-storage", "service-evac", "dealer"]) {
      expect(files).toContain(`${name}.jpg`);
    }
  });

  it("partner logo processed (trimmed silhouette PNG exists)", () => {
    expect(existsSync(resolve(ROOT, "public/logos/mototehnn-logo.png"))).toBe(true);
  });
});
