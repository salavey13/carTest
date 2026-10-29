// tests/franchize/task138-landings-tv-storage-sly13.spec.ts
//
// BOSS 2026-10-25 batch:
//   1) «/moto-selection and /sly13 hero sections suffer from same issue
//      /vipbikerental had - accented title text appear as colored square in
//      browser ON TV (transparent text or something is not supported)»
//   2) «ditch "stats of vip-bike" from sly13 ... generalize "the message"»
//   3) moto-selection: winter storage in rail/tab + picture on the storage
//      tab + working storage form (in-season defaults!)
//   4) «sly13 has logo picture - align visually with other partners on
//      /moto-selection» + «proper links to moto-selection crew winter storage
//      from landing ... maybe even using deep links via startappparamrouter -
//      make sure crew extraction from startapp parameter works properly»
//   5) «for moto-selection hero - swap bg picture with something interesting»
//
// The spec PINS source + pure logic (same recipe as task133/134 specs): the
// TV cure is a CSS contract (@supports gate), the deep links are pure
// startapp grammar — both unit-testable without a browser.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { computeStaticFastTarget } from "@/hooks/use-start-param-target";
import { resolveStorageConfig } from "@/app/franchize/lib/storage-config";
import { storageSeasonDefaults } from "@/app/franchize/lib/storage";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const GLOBALS = "app/globals.css";
const SLY = "app/salavey13/Sly13LandingClient.tsx";
const MS = "app/moto-selection/page.tsx";
const WALL = "app/franchize/[slug]/storage/StorageWallClient.tsx";

describe("task138 · TV-safe accent gradient (boss: colored squares on TV)", () => {
  it("globals.css ships the generic .landing-accent-clip with @supports gate", () => {
    const css = read(GLOBALS);
    expect(css).toContain(".landing-accent-clip");
    // solid color FIRST (the TV path), gradient upgrade only inside @supports
    const solidIdx = css.indexOf(".landing-accent-clip {\n  color: var(--accent-clip-from, currentColor);");
    const supportsIdx = css.indexOf("@supports ((-webkit-background-clip: text) or (background-clip: text))", solidIdx);
    expect(solidIdx).toBeGreaterThan(-1);
    expect(supportsIdx).toBeGreaterThan(solidIdx);
    // the gated block flips to the clip pair
    const gated = css.slice(supportsIdx, supportsIdx + 500);
    expect(gated).toContain("background-clip: text");
    expect(gated).toContain("-webkit-text-fill-color: transparent");
  });

  it("both landings use the class and carry NO raw bg-clip-text anymore", () => {
    for (const file of [SLY, MS]) {
      const src = read(file);
      expect(src).toContain("landing-accent-clip");
      expect(src).not.toContain("bg-clip-text");
      expect(src).not.toContain("text-transparent");
    }
  });
});

describe("task138 · sly13 messaging overhaul (no private vip-bike numbers)", () => {
  const sly = read(SLY);
  const slyPage = read("app/salavey13/page.tsx");

  it("vip-bike season numbers are GONE from the landing", () => {
    for (const banned of ["308", "2,0 млн", "16,5 млн", "13,0 млн", "+188", "154", "«sus»", "31 дкп", "109 аренд"]) {
      expect(sly).not.toContain(banned);
    }
    expect(slyPage).not.toContain("308");
    expect(slyPage).not.toContain("сезон-2026");
  });

  it("the message is generalized to the platform promo (каталог → CRM)", () => {
    expect(sly).toContain("проката и сервисов"); // generalized display line
    expect(sly).toContain("Залил каталог"); // PDF idea
    expect(sly).toContain("Шесть контуров"); // 6 contours bento
    expect(sly).toContain("Каждый рубль виден"); // double-entry money section
    expect(sly).toContain("Не бот для CRM"); // AI worker headline
    expect(sly).toContain("VERTICALS"); // multi-rental verticals
    expect(sly).toContain("21:00"); // evening bot digests (public product fact)
  });

  it("sections are re-numbered and nav retitled", () => {
    expect(sly).toContain("01 · что такое платформа");
    expect(sly).toContain("02 · деньги");
    expect(sly).toContain("03 · сценарии");
    expect(sly).toContain("04 · ai-воркер");
    expect(sly).toContain("05 · услуги");
    expect(sly).toContain("06 · партнёры");
    expect(sly).toContain('"#platform"');
    expect(sly).toContain('"#money"');
    expect(sly).toContain('"#ai"');
    expect(sly).not.toContain('"#proof"');
    expect(sly).not.toContain('"#audit"');
  });
});

describe("task138 · moto-selection landing", () => {
  const ms = read(MS);

  it("hero bg swapped to the crew's own catalog cover (owner request)", () => {
    expect(ms).toContain("moto-selection-svc-01/image_1.jpg");
    expect(ms).not.toContain("harley-davidson-ride.jpg"); // old hero gone
  });

  it("SLY13 partner card is a LOGO card now (visually aligned with Байкленд/Академия)", () => {
    // task145 re-baseline: the card is a PartnerLogoGrid tile (logoSrc + logoAlt)
    expect(ms).toContain("carpix/sly13_logo.jpg");
    expect(ms).toContain('logoAlt: "SLY13 — платформа франшиз проката"');
  });

  it("winter storage section carries platform CTAs: mini-app deep link + web fallback", () => {
    expect(ms).toContain("storage_moto-selection");
    // the URL is composed from TG_BOT — pin both parts
    expect(ms).toContain('"oneBikePlsBot"');
    expect(ms).toContain("/app?startapp=");
    expect(ms).toContain("/franchize/moto-selection/storage");
  });

  it("services platform card carries the crew_ deep link", () => {
    expect(ms).toContain("crew_moto-selection");
  });
});

describe("task138 · startapp param routing (boss: crew extraction must work)", () => {
  it("storage_<slug> resolves to the crew storage wall", () => {
    expect(computeStaticFastTarget("storage_moto-selection")).toBe("/franchize/moto-selection/storage");
    expect(computeStaticFastTarget("storage_vip-bike")).toBe("/franchize/vip-bike/storage");
  });

  it("crew_<slug> resolves to the crew catalog", () => {
    expect(computeStaticFastTarget("crew_moto-selection")).toBe("/franchize/moto-selection");
  });

  it("sly13 deep-link constants round-trip through the router grammar", () => {
    const sly = read(SLY);
    expect(sly).toContain("https://t.me/oneBikePlsBot/app?startapp=");
    expect(sly).toContain("storage_moto-selection");
    expect(sly).toContain("crew_moto-selection");
    // every constant the landing ships must route
    expect(computeStaticFastTarget("storage_moto-selection")).toBe("/franchize/moto-selection/storage");
    expect(computeStaticFastTarget("crew_moto-selection")).toBe("/franchize/moto-selection");
  });
});

describe("task138 · winter storage form works for moto-selection", () => {
  it("resolveStorageConfig passes the offer cover URL through (sanitized)", () => {
    const cfg = resolveStorageConfig(
      {
        storage: {
          enabled: true,
          imageUrl: "https://static.tildacdn.com/tild3231-6330-4761-a364-613338663132/8920463051_d0244dce5.jpg",
        },
      },
      "moto-selection",
    );
    expect(cfg.enabled).toBe(true);
    expect(cfg.imageUrl).toBe("https://static.tildacdn.com/tild3231-6330-4761-a364-613338663132/8920463051_d0244dce5.jpg");
  });

  it("hostile/relative imageUrl is dropped — offer degrades to text-only", () => {
    const cfg = resolveStorageConfig({ storage: { enabled: true, imageUrl: "javascript:alert(1)" } }, "x-crew");
    expect(cfg.imageUrl).toBeUndefined();
    const cfg2 = resolveStorageConfig({ storage: { enabled: true, imageUrl: "/etc/passwd" } }, "x-crew");
    expect(cfg2.imageUrl).toBeUndefined();
  });

  it("GuestOffer renders the cover only when configured (vip-bike stays text-only)", () => {
    const wall = read(WALL);
    expect(wall).toContain("config?.imageUrl");
    expect(wall).toContain("Зимнее хранение мототехники"); // cover alt
  });

  it("season defaults: in-season NOW → the ongoing season, not next year", () => {
    // The boss bug: on Oct 25 2026 the form pre-filled 2027-10-15 → 2028-06-01
    expect(storageSeasonDefaults(new Date("2026-10-25T12:00:00Z"))).toEqual({
      start: "2026-10-15",
      end: "2027-06-01",
    });
    // summer gap still offers the upcoming season
    expect(storageSeasonDefaults(new Date("2026-07-01T12:00:00Z"))).toEqual({
      start: "2026-10-15",
      end: "2027-06-01",
    });
  });
});
