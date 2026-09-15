/**
 * connectors-mcp sidecar tests — pure DI fakes, no network, no compiled dist.
 *
 * The real stdio loop is exercised by connectors-mcp/scripts/smoke.mjs against
 * the built dist (run after `npm --prefix connectors-mcp run build`).
 */

import { describe, expect, it } from "vitest";

import { buildTools, executeTool, type ConnectorClients } from "../connectors-mcp/src/tools";
import { createDispatcher, contextFromParams, PROTOCOL_VERSION } from "../connectors-mcp/src/dispatch";
import { buildClientsFromEnv, buildDefaultTools } from "../connectors-mcp/src/env";
import { ConnectorError } from "../lib/connectors/shared/errors";
import type { ConnectorCallContext } from "../lib/connectors/shared/errors";
import {
  ETM_CARD_TM63_FIXTURE_HTML,
} from "../lib/connectors/etm/fixtures/etm-card-tm63";
import { parseEtmCard } from "../lib/connectors/etm/parser";

const CORR: ConnectorCallContext = {
  actor: { id: "tester", kind: "crew" },
  correlationId: "req:test",
};

function fakeClients(calls: { contexts: ConnectorCallContext[] } = {
  contexts: [],
}): ConnectorClients {
  const record = (context?: ConnectorCallContext) => {
    if (context) calls.contexts.push(context);
  };
  const card = parseEtmCard({
    html: ETM_CARD_TM63_FIXTURE_HTML,
    code: "5517285",
    url: "https://www.etm.ru/cat/nn/5517285",
  });
  return {
    etm: {
      async getCard(code, context) {
        record(context);
        return { ...card, code };
      },
      async search(_query, context) {
        record(context);
        return [{ code: "5517285", title: "ТМ-63 INSTALL", url: undefined }];
      },
      async findByRef(_ref, context) {
        record(context);
        return { code: "5517285", title: "ТМ-63 INSTALL", url: undefined };
      },
    },
    onec: {
      async ping(context) {
        record(context);
        return { ok: true, serviceName: "megarepo", raw: { ok: true } };
      },
      async upsertOrder(_payload, context) {
        record(context);
        return { ref: "ref-1", number: "000-001", alreadyExisted: false };
      },
      async getDocument(ref, context) {
        record(context);
        return { ref, externalId: "req-1" };
      },
    },
  };
}

describe("buildTools + executeTool", () => {
  it("exposes exactly the 6 blueprint tools", () => {
    const tools = buildTools(fakeClients());
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        "etm_find_by_ref",
        "etm_get_card",
        "etm_search",
        "onec_get_document",
        "onec_ping",
        "onec_upsert_order",
      ].sort(),
    );
  });

  it("etm_get_card returns the parsed fixture snapshot and passes context", async () => {
    const calls = { contexts: [] as ConnectorCallContext[] };
    const tools = buildTools(fakeClients(calls));
    const result = await executeTool(tools, "etm_get_card", { code: "5517285" }, CORR);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const snapshot = result.data as { code: string; prices: unknown[] };
      expect(snapshot.code).toBe("5517285");
      expect(snapshot.prices.length).toBeGreaterThan(0);
    }
    expect(calls.contexts[0]?.actor?.id).toBe("tester");
    expect(calls.contexts[0]?.correlationId).toBe("req:test");
  });

  it("etm_find_by_ref validates required mark", async () => {
    const tools = buildTools(fakeClients());
    const result = await executeTool(tools, "etm_find_by_ref", { series: "PX" }, CORR);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const err = result.error as { code: string };
      expect(err.code).toBe("INVALID_ARGS");
    }
  });

  it("onec_upsert_order round-trips an idempotent payload", async () => {
    const tools = buildTools(fakeClients());
    const result = await executeTool(
      tools,
      "onec_upsert_order",
      {
        externalId: "zayavka-42",
        docType: "order",
        counterparty: { name: "ООО Тест", inn: "7701234567" },
        lines: [{ sku: "5517285", quantity: 2, price: 5169.51 }],
      },
      CORR,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({ ref: "ref-1", alreadyExisted: false });
    }
  });

  it("connector errors surface as typed JSON", async () => {
    const failing: ConnectorClients = {
      etm: {
        async getCard() {
          throw new ConnectorError({
            connector: "etm",
            code: "HTTP_ERROR",
            message: "etm unreachable",
            status: 503,
          });
        },
        async search() {
          return [];
        },
        async findByRef() {
          return null;
        },
      },
      onec: fakeClients().onec,
    };
    const tools = buildTools(failing);
    const result = await executeTool(tools, "etm_get_card", { code: "1" }, CORR);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({ code: "HTTP_ERROR", connector: "etm", status: 503 });
    }
  });
});

describe("MCP dispatcher", () => {
  const dispatcher = createDispatcher({ tools: buildTools(fakeClients()) });

  it("initialize returns protocol version + capabilities", async () => {
    const res = await dispatcher(
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    );
    expect(res?.result).toMatchObject({
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
    });
    expect(res?.id).toBe(1);
  });

  it("notifications/initialized is silent", async () => {
    const res = await dispatcher(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    );
    expect(res).toBeNull();
  });

  it("tools/list carries hand-written JSON schemas", async () => {
    const res = await dispatcher(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
    const tools = (res?.result as { tools: Array<{ name: string; inputSchema: object }> }).tools;
    expect(tools).toHaveLength(6);
    for (const tool of tools) {
      expect(tool.inputSchema).toHaveProperty("type", "object");
    }
  });

  it("tools/call ok path wraps data as content text", async () => {
    const res = await dispatcher(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "onec_ping", arguments: {} },
      }),
    );
    const result = res?.result as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content[0].text)).toMatchObject({ ok: true, serviceName: "megarepo" });
  });

  it("tools/call invalid args → isError with INVALID_ARGS", async () => {
    const res = await dispatcher(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "etm_get_card", arguments: {} },
      }),
    );
    const result = res?.result as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toMatchObject({ code: "INVALID_ARGS" });
  });

  it("unknown tool → typed UNKNOWN_TOOL", async () => {
    const res = await dispatcher(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "rm_rf", arguments: {} },
      }),
    );
    const result = res?.result as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toMatchObject({ code: "UNKNOWN_TOOL" });
  });

  it("unknown method → -32601", async () => {
    const res = await dispatcher(JSON.stringify({ jsonrpc: "2.0", id: 6, method: "resources/list" }));
    expect(res?.error).toMatchObject({ code: -32601 });
  });

  it("garbage frame → -32700", async () => {
    const res = await dispatcher("this is not json");
    expect(res?.error).toMatchObject({ code: -32700 });
  });

  it("actor/correlation ride through tools/call params._context", async () => {
    const calls = { contexts: [] as ConnectorCallContext[] };
    const d = createDispatcher({ tools: buildTools(fakeClients(calls)) });
    await d(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: {
          name: "onec_ping",
          arguments: {},
          _context: { actor: { id: "413553377", kind: "crew" }, correlationId: "bot:abc" },
        },
      }),
    );
    expect(calls.contexts[0]).toMatchObject({
      actor: { id: "413553377", kind: "crew" },
      correlationId: "bot:abc",
    });
  });
});

describe("contextFromParams", () => {
  it("defaults to a system actor", () => {
    expect(contextFromParams(undefined)).toMatchObject({
      actor: { id: "mcp-client", kind: "system" },
    });
  });

  it("sanitizes unknown actor kinds", () => {
    const context = contextFromParams({ _context: { actor: { id: "x", kind: "root" } } });
    expect(context.actor?.kind).toBe("system");
  });
});

describe("env wiring", () => {
  it("boots with zero env: etm public client ready, onec fails at call time", async () => {
    const clients = buildClientsFromEnv({});
    expect(clients.etm).toBeDefined();
    const tools = buildTools(clients);
    const result = await executeTool(tools, "onec_ping", {}, CORR);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({ code: "MISSING_CONFIG", connector: "onec" });
    }
  });

  it("default toolset builds 6 tools against process.env", () => {
    expect(buildDefaultTools()).toHaveLength(6);
  });

  it("etm mock mode serves the empty-snapshot contract", async () => {
    const clients = buildClientsFromEnv({ ETM_MODE: "mock" });
    const tools = buildTools(clients);
    const result = await executeTool(tools, "etm_get_card", { code: "999" }, CORR);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // empty card → minimal snapshot (bulk jobs decide retry policy per card)
      expect(result.data).toMatchObject({ code: "999", prices: [] });
    }
  });
});
