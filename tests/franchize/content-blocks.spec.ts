// Behavioral contract for readFranchizeContentBlocks (2026-10-18 review).
// The vip-bike gating of the DEFAULT_* blocks (boss task: «add guard around
// this hardcode to be shown only for vip-bike, or ditch ungeneral text»)
// previously had NO tests — a regression would silently re-leak «Выберите
// байк»-style copy onto other crews. Covered here:
//   • vip-bike falls back to the legacy DEFAULT_* blocks;
//   • any other crew without hydrated copy gets EMPTY arrays (pages hide
//     the sections instead);
//   • hydrated metadata always wins over the fallback;
//   • slug defaults to the SAFE side (no defaults) when a call site forgets it;
//   • aboutHeroTitle precedence: about.heroTitle > about.tagline >
//     contentBlocks.aboutHeroTitle.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_FRANCHIZE_CONTENT_BLOCKS,
  isLegacyDefaultsCrew,
  readFranchizeContentBlocks,
} from "@/app/franchize/lib/content-blocks";

describe("readFranchizeContentBlocks — legacy defaults gating", () => {
  it("vip-bike falls back to the DEFAULT_* blocks", () => {
    const blocks = readFranchizeContentBlocks(null, "vip-bike");
    expect(blocks.aboutCapabilities).toEqual(DEFAULT_FRANCHIZE_CONTENT_BLOCKS.aboutCapabilities);
    expect(blocks.aboutWorkSteps).toEqual(DEFAULT_FRANCHIZE_CONTENT_BLOCKS.aboutWorkSteps);
    expect(blocks.salesVerticals).toEqual(DEFAULT_FRANCHIZE_CONTENT_BLOCKS.salesVerticals);
    expect(blocks.onboardingChecklist).toEqual(DEFAULT_FRANCHIZE_CONTENT_BLOCKS.onboardingChecklist);
    expect(blocks.onboardingReadinessRows).toEqual(DEFAULT_FRANCHIZE_CONTENT_BLOCKS.onboardingReadinessRows);
  });

  it("another crew without hydrated copy gets EMPTY arrays (safe default)", () => {
    const blocks = readFranchizeContentBlocks(null, "moto-selection");
    expect(blocks.aboutCapabilities).toEqual([]);
    expect(blocks.aboutWorkSteps).toEqual([]);
    expect(blocks.salesVerticals).toEqual([]);
    expect(blocks.onboardingChecklist).toEqual([]);
    expect(blocks.onboardingReadinessRows).toEqual([]);
    expect(blocks.communityEvents).toEqual([]);
    expect(blocks.partnerCards).toEqual([]);
    expect(blocks.cityRiderTips).toEqual([]);
  });

  it("omitted slug is SAFE (empty arrays), never vip-bike defaults", () => {
    // 2026-10-18 review: the default used to BE vip-bike — a call site that
    // forgets to thread the crew slug silently re-leaked the legacy copy.
    const blocks = readFranchizeContentBlocks(null);
    expect(blocks.aboutCapabilities).toEqual([]);
    expect(blocks.salesVerticals).toEqual([]);
  });

  it("hydrated metadata wins over the fallback for the legacy crew too", () => {
    const metadata = {
      franchize: {
        contentBlocks: {
          aboutCapabilities: [{ title: "Свояcapability", text: "копия экипажа" }],
        },
      },
    };
    const blocks = readFranchizeContentBlocks(metadata, "vip-bike");
    // the reader normalizes every capability to {title, text, icon}
    expect(blocks.aboutCapabilities).toEqual([{ title: "Свояcapability", text: "копия экипажа", icon: "" }]);
    // untouched sections still fall back for vip-bike
    expect(blocks.salesVerticals).toEqual(DEFAULT_FRANCHIZE_CONTENT_BLOCKS.salesVerticals);
  });

  it("hydrated metadata renders for a non-legacy crew (no defaults mixed in)", () => {
    const metadata = {
      franchize: {
        contentBlocks: {
          aboutWorkSteps: [
            { title: "Выберите услугу", text: "каталог услуг" },
            { title: "Подтвердите детали", text: "оператор свяжется" },
          ],
        },
      },
    };
    const blocks = readFranchizeContentBlocks(metadata, "moto-selection");
    expect(blocks.aboutWorkSteps).toHaveLength(2);
    expect(blocks.aboutCapabilities).toEqual([]); // not hydrated → hidden
    expect(blocks.salesVerticals).toEqual([]);
  });
});

describe("readFranchizeContentBlocks — aboutHeroTitle precedence", () => {
  it("about.heroTitle wins", () => {
    const blocks = readFranchizeContentBlocks(
      { franchize: { about: { heroTitle: "h1", tagline: "tg" }, contentBlocks: { aboutHeroTitle: "cb" } } },
      "moto-selection",
    );
    expect(blocks.aboutHeroTitle).toBe("h1");
  });

  it("about.tagline is the alias used by the hydration SQLs", () => {
    const blocks = readFranchizeContentBlocks(
      { franchize: { about: { tagline: "tg" }, contentBlocks: { aboutHeroTitle: "cb" } } },
      "moto-selection",
    );
    expect(blocks.aboutHeroTitle).toBe("tg");
  });

  it("contentBlocks.aboutHeroTitle is the last read", () => {
    const blocks = readFranchizeContentBlocks(
      { franchize: { contentBlocks: { aboutHeroTitle: "cb" } } },
      "moto-selection",
    );
    expect(blocks.aboutHeroTitle).toBe("cb");
  });

  it("no copy anywhere → empty hero override (page keeps its own line)", () => {
    expect(readFranchizeContentBlocks(null, "moto-selection").aboutHeroTitle).toBe("");
  });
});

describe("isLegacyDefaultsCrew", () => {
  it("true only for vip-bike (trimmed)", () => {
    expect(isLegacyDefaultsCrew("vip-bike")).toBe(true);
    expect(isLegacyDefaultsCrew(" vip-bike ")).toBe(true);
    expect(isLegacyDefaultsCrew("moto-selection")).toBe(false);
    expect(isLegacyDefaultsCrew("")).toBe(false);
  });
});
