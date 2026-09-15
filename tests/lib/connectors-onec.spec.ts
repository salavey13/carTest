/**
 * 1С connector unit tests — URL building, basic auth, upsert contract,
 * error normalization, OData read helper and the env factory. No network.
 */

import { describe, expect, it } from "vitest";
import {
  ConnectorError,
  OnecHttpClient,
  buildOdataUrl,
  getOnecClientFromEnv,
} from "@/lib/connectors/onec";
import type { FetchLike } from "@/lib/connectors/shared/http";

const CONFIG = {
  baseUrl: "https://1c.example.com/baseru",
  username: "megarepo-svc",
  password: "s3cret",
  serviceName: "megarepo",
} as const;

function makeFetch(respond: (url: string, init?: Record<string, unknown>) => unknown) {
  const calls: Array<{ url: string; init: Record<string, unknown> }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init: (init ?? {}) as Record<string, unknown> });
    const payload = respond(url, init);
    return {
      ok: true,
      status: 200,
      text: async () =>
        typeof payload === "string" ? payload : JSON.stringify(payload ?? null),
    } as unknown as Response;
  };
  return { calls, fetchImpl };
}

const ORDER_PAYLOAD = {
  externalId: "req-42",
  docType: "order" as const,
  counterparty: { name: "ООО Ромашка", inn: "7701234567" },
  lines: [{ sku: "TM-63", name: "Траверса ТМ-63", quantity: 2, price: 5169.51 }],
};

describe("OnecHttpClient", () => {
  it("builds {baseUrl}/hs/{service}/{command} URLs", () => {
    const client = new OnecHttpClient(CONFIG);
    expect(client.commandUrl("ping")).toBe("https://1c.example.com/baseru/hs/megarepo/ping");
    expect(client.commandUrl("/orders")).toBe("https://1c.example.com/baseru/hs/megarepo/orders");
  });

  it("rejects an invalid config with MISSING_CONFIG", () => {
    expect(() => new OnecHttpClient({ ...CONFIG, baseUrl: "not-a-url" })).toThrowError(ConnectorError);
  });

  it("ping sends basic auth and reports ok", async () => {
    const { calls, fetchImpl } = makeFetch(() => ({ ok: true, service: "megarepo" }));
    const client = new OnecHttpClient(CONFIG, { fetchImpl });
    const result = await client.ping({ actor: { id: "crew-7", kind: "crew" }, correlationId: "trace-1" });

    expect(result.ok).toBe(true);
    expect(calls[0].url).toContain("/hs/megarepo/ping");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Basic ${Buffer.from("megarepo-svc:s3cret").toString("base64")}`);
    expect(headers["x-megarepo-actor"]).toBe("crew:crew-7");
    expect(headers["x-megarepo-correlation-id"]).toBe("trace-1");
  });

  it("upsertOrder posts the payload and validates the response", async () => {
    const { calls, fetchImpl } = makeFetch(() => ({ ref: "a1b2c3", number: "Заказ 0042" }));
    const client = new OnecHttpClient(CONFIG, { fetchImpl });
    const result = await client.upsertOrder(ORDER_PAYLOAD);

    expect(result.ref).toBe("a1b2c3");
    expect(result.number).toBe("Заказ 0042");
    expect(calls[0].init.method).toBe("POST");
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.externalId).toBe("req-42");
    expect(body.lines[0].sku).toBe("TM-63");
  });

  it("normalizes HTTP errors into ConnectorError(HTTP_ERROR)", async () => {
    const fetchImpl: FetchLike = async () =>
      ({
        ok: false,
        status: 500,
        text: async () => "internal 1С explosion",
      }) as unknown as Response;
    const client = new OnecHttpClient(CONFIG, { fetchImpl });
    await expect(client.ping()).rejects.toMatchObject({ code: "HTTP_ERROR", status: 500 });
  });

  it("flags status-only ping bodies as not ok", async () => {
    const { fetchImpl } = makeFetch(() => null);
    const client = new OnecHttpClient(CONFIG, { fetchImpl });
    const result = await client.ping();
    expect(result.ok).toBe(false);
  });

  it("fetchOdata returns the collection; OData URL encodes filters", async () => {
    const { fetchImpl } = makeFetch(() => ({ value: [{ Ref_Key: "guid-1" }] }));
    const client = new OnecHttpClient(CONFIG, { fetchImpl });
    const rows = await client.fetchOdata<{ Ref_Key: string }>("Document_ЗаказКлиента", {
      top: 10,
      filter: "Posted eq true",
    });
    expect(rows.value[0].Ref_Key).toBe("guid-1");

    const url = buildOdataUrl("https://1c.example.com/baseru/", "Catalog_Номенклатура", {
      top: 5,
      select: ["Ref_Key", "Description"],
    });
    expect(url.startsWith("https://1c.example.com/baseru/odata/standard.odata/Catalog_Номенклатура?")).toBe(true);
    expect(url).toContain("%24top=5");
    expect(url).toContain("%24select=Ref_Key%2CDescription");
  });
});

describe("getOnecClientFromEnv", () => {
  it("lists every missing env var in the error", () => {
    try {
      getOnecClientFromEnv({});
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConnectorError);
      expect((error as ConnectorError).code).toBe("MISSING_CONFIG");
      expect((error as ConnectorError).message).toContain("ONC_BASE_URL");
      expect((error as ConnectorError).message).toContain("ONC_USERNAME");
      expect((error as ConnectorError).message).toContain("ONC_PASSWORD");
    }
  });

  it("builds a client from env (supports ONEC_ alias)", () => {
    const client = getOnecClientFromEnv({
      ONEC_BASE_URL: "https://1c.example.com/baseru",
      ONC_USERNAME: "u",
      ONC_PASSWORD: "p",
    });
    expect(client.serviceName).toBe("megarepo");
  });

  it("honours ONC_SERVICE_NAME", () => {
    const client = getOnecClientFromEnv({
      ONC_BASE_URL: "https://1c.example.com/baseru",
      ONC_USERNAME: "u",
      ONC_PASSWORD: "p",
      ONC_SERVICE_NAME: "traversa",
    });
    expect(client.commandUrl("ping")).toBe("https://1c.example.com/baseru/hs/traversa/ping");
  });
});
