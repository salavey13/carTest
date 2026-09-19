// tests/franchize/community-wall-text.spec.ts
//
// Iteration 2 — rich wall text tokens (@mentions, #hashtags, URLs) and the
// reply-flattening contract, unit-tested pure.

import { describe, expect, it } from "vitest";
import {
  extractHashtags,
  hashtagKey,
  parseWallText,
  WALL_TAGS_MAX,
} from "@/app/franchize/lib/community-wall";

const types = (text: string) => parseWallText(text).map((t) => t.type);
const values = (text: string) => parseWallText(text).map((t) => t.value);

describe("parseWallText", () => {
  it("plain text stays one token", () => {
    expect(parseWallText("Обычный пост без наворотов")).toEqual([
      { type: "text", value: "Обычный пост без наворотов" },
    ]);
  });

  it("empty / undefined-safe", () => {
    expect(parseWallText("")).toEqual([]);
  });

  it("detects @mentions (telegram-style)", () => {
    expect(values("привет @sly13 и @Vip_Bike_Crew!")).toEqual([
      "привет ",
      "@sly13",
      " и ",
      "@Vip_Bike_Crew",
      "!",
    ]);
  });

  it("detects latin AND cyrillic hashtags", () => {
    expect(values("заезд #вечернийзаезд done #RideOn")).toContain("#вечернийзаезд");
    expect(values("заезд #вечернийзаезд done #RideOn")).toContain("#RideOn");
  });

  it("a URL swallows the hashtag inside it (longest match wins)", () => {
    const toks = parseWallText("отчёт https://example.com/#top Ready");
    expect(types("отчёт https://example.com/#top Ready")).toEqual([
      "text",
      "url",
      "text",
    ]);
    expect(toks[1]).toEqual({ type: "url", value: "https://example.com/#top" });
  });

  it("never splits inside a url for mentions either", () => {
    expect(types("see https://t.me/@evil_payload")).toEqual(["text", "url"]);
    expect(parseWallText("https://t.me/@evil_payload")[0]).toEqual({ type: "url", value: "https://t.me/@evil_payload" });
  });

  it("emails are NOT mentions (left-boundary check)", () => {
    expect(types("пиши на mail@test.com сегодня")).toEqual(["text"]);
    expect(values("пиши на mail@test.com сегодня")[0]).toBe("пиши на mail@test.com сегодня");
  });

  it("URL trailing sentence punctuation stays outside the token", () => {
    const toks = parseWallText("отчёт https://example.com/route. Готово");
    expect(toks[1]).toEqual({ type: "url", value: "https://example.com/route" });
    expect(toks[2]).toEqual({ type: "text", value: "." });
  });

  it("keeps mixed RU/EN + digits in hashtags", () => {
    expect(values("#заезд2025 x")).toEqual(["#заезд2025", " x"]);
  });

  it("lone # or @ stays text", () => {
    expect(types("символ # и @ в тексте")).toEqual(["text"]);
  });
});

describe("hashtagKey", () => {
  it("lowercases and strips the hash", () => {
    expect(hashtagKey("#ВечернийЗаезд")).toBe("вечернийзаезд");
  });
});

describe("extractHashtags (crew_post_tags contract)", () => {
  it("normalizes + dedupes case-insensitively", () => {
    expect(extractHashtags("заезд #ВечернийЗаезд и #вечернийзаезд!")).toEqual(["вечернийзаезд"]);
  });

  it("caps at WALL_TAGS_MAX", () => {
    const body = Array.from({ length: 15 }, (_, i) => `#tag${i} `).join("");
    expect(extractHashtags(body)).toHaveLength(WALL_TAGS_MAX);
  });

  it("ignores hashtags inside URLs and emails", () => {
    expect(extractHashtags("link https://x.com/#anchor mail@yandex.ru")).toEqual([]);
  });
});
