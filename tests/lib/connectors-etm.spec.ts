/**
 * ETM connector unit tests — parser, client, search-hit extraction, env
 * factories and the заявка-gated API stub. No network: MockEtmTransport and
 * fake fetch only.
 */

import { describe, expect, it } from "vitest";
import {
  ConnectorError,
  ETM_CARD_TM63_FIXTURE_HTML,
  ETM_SEARCH_TM63_FIXTURE_HTML,
  EtmApiClient,
  EtmClient,
  MockEtmTransport,
  extractSearchHits,
  getEtmApiClientFromEnv,
  getEtmClientFromEnv,
  parseAmount,
  parseEtmCard,
} from "@/lib/connectors/etm";

describe("parseAmount", () => {
  it("normalizes spaces, nbsp and comma decimals", () => {
    expect(parseAmount("7 123.82")).toBe(7123.82);
    expect(parseAmount("5\u00a0169,51")).toBe(5169.51);
    expect(parseAmount("794")).toBe(794);
  });

  it("returns null on garbage", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("шт")).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });
});

describe("parseEtmCard (real ТМ-63 fixture)", () => {
  const card = parseEtmCard({ html: ETM_CARD_TM63_FIXTURE_HTML, code: "5517285" });

  it("extracts identity fields", () => {
    expect(card.code).toBe("5517285");
    expect(card.article).toBe("11220");
    expect(card.brand).toBe("INSTALL");
    expect(card.mark).toBe("ТМ-63");
    expect(card.series).toBe("PX");
    expect(card.unit).toBe("шт");
  });

  it("extracts retail + opt price tiers, discount and cashback", () => {
    const retail = card.prices.find((p) => p.kind === "retail");
    const opt = card.prices.find((p) => p.kind === "opt");
    expect(retail?.amount).toBe(7123.82);
    expect(retail?.cashbackPoints).toBeCloseTo(601.42, 2);
    expect(opt?.amount).toBe(5169.51);
    expect(opt?.discountPercent).toBe(27);
  });

  it("extracts stock today/later", () => {
    expect(card.stock?.availableToday).toBe(7);
    expect(card.stock?.availableLater).toBe(794);
  });

  it("extracts colon-separated specs", () => {
    expect(card.specs["Масса, кг"]).toBe("18.4");
    expect(card.specs["Напряжение, В"]).toBe("6000");
    expect(card.specs["Код ОКПД 2"]).toBe("27.33.13.130");
  });

  it("throws PARSE_ERROR only on empty input", () => {
    expect(() => parseEtmCard({ html: "  " })).toThrowError(ConnectorError);
  });
});

describe("EtmClient over MockEtmTransport", () => {
  const transport = new MockEtmTransport({
    cards: { "5517285": ETM_CARD_TM63_FIXTURE_HTML },
    searches: { "ТМ-63 PX 11220": ETM_SEARCH_TM63_FIXTURE_HTML },
  });
  const client = new EtmClient({ transport, baseUrl: "https://www.etm.ru" });

  it("getCard returns a validated snapshot", async () => {
    const card = await client.getCard("5517285");
    expect(card.mark).toBe("ТМ-63");
    expect(card.url).toBe("https://www.etm.ru/cat/nn/5517285");
  });

  it("getCard on unknown code still returns a partial snapshot (no hard failure)", async () => {
    const card = await client.getCard("0000001");
    expect(card.code).toBe("0000001");
    expect(card.prices).toHaveLength(0);
  });

  it("extractSearchHits pulls /cat/nn/{code} links", async () => {
    const hits = await client.search("ТМ-63 PX 11220");
    expect(hits.map((h) => h.code)).toEqual(["5517285", "1032896", "999111"]);
    expect(hits[2].url).toBe("https://www.etm.ru/cat/nn/999111");
  });

  it("findByRef prefers the hit whose title contains the article", async () => {
    const hit = await client.findByRef({ mark: "ТМ-63", series: "PX", article: "11220" });
    expect(hit?.code).toBe("5517285");
  });

  it("findByRef with empty ref throws MISSING_CONFIG", async () => {
    await expect(client.findByRef({})).rejects.toMatchObject({ code: "MISSING_CONFIG" });
  });
});

describe("env factories and the заявка-gated API stub", () => {
  it("default mode is public", () => {
    const client = getEtmClientFromEnv({});
    expect(client.baseUrl).toBe("https://www.etm.ru");
  });

  it("unknown ETM_MODE is rejected", () => {
    expect(() => getEtmClientFromEnv({ ETM_MODE: "banana" })).toThrowError(ConnectorError);
  });

  it("api client requires a token", () => {
    expect(() => getEtmApiClientFromEnv({})).toThrowError(ConnectorError);
  });

  it("api client methods throw NOT_IMPLEMENTED until the методичка arrives", async () => {
    const api = new EtmApiClient({ token: "test-token" });
    await expect(api.createOrder({ externalId: "r-1", lines: [{ code: "5517285", quantity: 2 }] })).rejects.toMatchObject({
      code: "NOT_IMPLEMENTED",
    });
  });
});
