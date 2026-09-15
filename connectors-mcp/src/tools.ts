/**
 * MCP tool definitions wrapping carTest's lib/connectors (ETM + 1С).
 *
 * Six tools — the exact set from the megarepo blueprint §02:
 *   etm_get_card · etm_search · etm_find_by_ref · onec_ping · onec_upsert_order · onec_get_document
 *
 * Design:
 * - `buildTools({ etm, onec })` takes clients via DI → unit tests pass mocks,
 *   `buildDefaultTools(env)` wires the env factories (`getEtmClientFromEnv`,
 *   `getOnecClientFromEnv`) so ETM_MODE=public|mock|api and ONC_* work as
 *   documented in lib/connectors/README.md.
 * - JSON Schemas are hand-written (MCP needs raw JSON Schema); zod re-validates
 *   every input at call time, so the schema is documentation, zod is the law.
 * - Every call receives a ConnectorCallContext (actor + correlationId) so the
 *   x-megarepo-actor / x-megarepo-correlation-id headers stay uniform with the
 *   hub and carTest.
 */

import { z } from "zod";
import type { ConnectorCallContext } from "../../lib/connectors/shared/errors";
import { isConnectorError } from "../../lib/connectors/shared/errors";
import type { EtmClient } from "../../lib/connectors/etm/client";
import type { OnecHttpClient } from "../../lib/connectors/onec/client";

export type ToolContext = ConnectorCallContext;

export interface ConnectorTool {
  readonly name: string;
  readonly description: string;
  /** JSON Schema for MCP tools/list (hand-written mirror of the zod schema). */
  readonly inputSchema: Record<string, unknown>;
  /** zod validation — the real gate, schema above is documentation. */
  parse(args: unknown): { ok: true; data: unknown } | { ok: false; error: string };
  handler(args: unknown, context: ToolContext): Promise<unknown>;
}

/* ── zod input schemas ─────────────────────────────────────────────────── */

const etmGetCardInput = z.object({
  code: z.string().min(1).describe("ETM product code, e.g. 5517285 (ТМ-63)"),
});

const etmSearchInput = z.object({
  query: z.string().min(1).describe("Free-form search query (марка, серия, артикул…)"),
});

const etmFindByRefInput = z.object({
  mark: z.string().min(1).describe("Марка, e.g. ТМ-63"),
  series: z.string().optional().describe("Серия, e.g. PX"),
  article: z.string().optional().describe("Артикул — sharpens the hit selection"),
  query: z.string().optional().describe("Override the composed mark+series+article query"),
});

const onecPingInput = z.object({});

const onecUpsertOrderInput = z.object({
  externalId: z.string().min(1).describe("Our internal id — 1С stores it for idempotency"),
  docType: z.enum(["order", "rental", "invoice", "custom"]),
  date: z.string().datetime().optional().describe("ISO 8601 document date"),
  counterparty: z.object({
    name: z.string().min(1),
    inn: z.string().min(1).optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
  }),
  lines: z
    .array(
      z.object({
        sku: z.string().min(1).describe("Our SKU; 1С maps it to its own nomenclature"),
        name: z.string().optional(),
        quantity: z.number().positive(),
        price: z.number().nonnegative(),
        discountPercent: z.number().min(0).max(100).optional(),
      }),
    )
    .min(1),
  total: z.number().nonnegative().optional(),
  comment: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const onecGetDocumentInput = z.object({
  ref: z.string().min(1).describe("1С document ref (GUID) or code"),
});

/* ── JSON Schema mirrors (documentation for tools/list) ────────────────── */

const str = (description: string) => ({ type: "string", description });
const optStr = (description: string) => ({ type: "string", description });

const counterpartyJsonSchema = {
  type: "object",
  properties: {
    name: str("Counterparty name"),
    inn: optStr("INN (optional)"),
    phone: optStr("Phone (optional)"),
    email: optStr("Email (optional)"),
  },
  required: ["name"],
  additionalProperties: false,
};

const lineJsonSchema = {
  type: "object",
  properties: {
    sku: str("Our SKU"),
    name: optStr("Display name (optional)"),
    quantity: { type: "number", exclusiveMinimum: 0, description: "Quantity" },
    price: { type: "number", minimum: 0, description: "Unit price" },
    discountPercent: { type: "number", minimum: 0, maximum: 100, description: "Discount %" },
  },
  required: ["sku", "quantity", "price"],
  additionalProperties: false,
};

/* ── toolset assembly ──────────────────────────────────────────────────── */

export interface ConnectorClients {
  etm: Pick<EtmClient, "getCard" | "search" | "findByRef">;
  onec: Pick<OnecHttpClient, "ping" | "upsertOrder" | "getDocument">;
}

type ToolSpec = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  parse: (args: unknown) => { ok: true; data: unknown } | { ok: false; error: string };
  handler: (args: unknown, context: ToolContext) => Promise<unknown>;
};

function zodParse(schema: z.ZodTypeAny) {
  return (args: unknown) => {
    const result = schema.safeParse(args);
    return result.success
      ? ({ ok: true, data: result.data } as const)
      : ({
          ok: false,
          error: result.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        } as const);
  };
}

export function buildTools(clients: ConnectorClients): ConnectorTool[] {
  const specs: ToolSpec[] = [
    {
      name: "etm_get_card",
      description:
        "Fetch one ETM public product card by numeric code: retail/opt price tiers, discount %, cashback, stock (today/later), specs. Works without ETM credentials.",
      inputSchema: {
        type: "object",
        properties: { code: str("ETM product code, e.g. 5517285") },
        required: ["code"],
        additionalProperties: false,
      },
      parse: zodParse(etmGetCardInput),
      handler: (args, context) => {
        const { code } = args as z.infer<typeof etmGetCardInput>;
        return clients.etm.getCard(code, context);
      },
    },
    {
      name: "etm_search",
      description: "Search the public ETM site; returns product codes found in result links.",
      inputSchema: {
        type: "object",
        properties: { query: str("Free-form search query") },
        required: ["query"],
        additionalProperties: false,
      },
      parse: zodParse(etmSearchInput),
      handler: (args, context) => {
        const { query } = args as z.infer<typeof etmSearchInput>;
        return clients.etm.search(query, context);
      },
    },
    {
      name: "etm_find_by_ref",
      description:
        "«марка + серия + артикул → код товара ЭТМ». Composes the query from the parts, picks the hit whose title matches the article best.",
      inputSchema: {
        type: "object",
        properties: {
          mark: str("Марка, e.g. ТМ-63"),
          series: optStr("Серия (optional)"),
          article: optStr("Артикул (optional, sharpens hit selection)"),
          query: optStr("Override the composed query"),
        },
        required: ["mark"],
        additionalProperties: false,
      },
      parse: zodParse(etmFindByRefInput),
      handler: (args, context) => {
        const { mark, series, article, query } = args as z.infer<typeof etmFindByRefInput>;
        return clients.etm.findByRef(
          { mark, series, article, query },
          context,
        );
      },
    },
    {
      name: "onec_ping",
      description:
        "Health-check the 1С HTTP-сервис «megarepo» (or configured name). Requires ONC_* env on the sidecar host.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      parse: zodParse(onecPingInput),
      handler: (_args, context) => clients.onec.ping(context),
    },
    {
      name: "onec_upsert_order",
      description:
        "Push an order/document into 1С (system-of-record upsert). Idempotent by externalId — replaying the same externalId updates, not duplicates.",
      inputSchema: {
        type: "object",
        properties: {
          externalId: str("Our internal id (idempotency key)"),
          docType: { type: "string", enum: ["order", "rental", "invoice", "custom"] },
          date: optStr("ISO 8601 document date"),
          counterparty: counterpartyJsonSchema,
          lines: { type: "array", items: lineJsonSchema, minItems: 1 },
          total: { type: "number", minimum: 0 },
          comment: optStr("Comment"),
          metadata: { type: "object", additionalProperties: true },
        },
        required: ["externalId", "docType", "counterparty", "lines"],
        additionalProperties: false,
      },
      parse: zodParse(onecUpsertOrderInput),
      handler: (args, context) => {
        const payload = args as z.infer<typeof onecUpsertOrderInput>;
        return clients.onec.upsertOrder(payload, context);
      },
    },
    {
      name: "onec_get_document",
      description: "Read one document back from 1С by ref (GUID or code).",
      inputSchema: {
        type: "object",
        properties: { ref: str("1С document ref (GUID) or code") },
        required: ["ref"],
        additionalProperties: false,
      },
      parse: zodParse(onecGetDocumentInput),
      handler: (args, context) => {
        const { ref } = args as z.infer<typeof onecGetDocumentInput>;
        return clients.onec.getDocument(ref, context);
      },
    },
  ];

  return specs.map((spec) => {
    const parse = spec.parse;
    return {
      name: spec.name,
      description: spec.description,
      inputSchema: spec.inputSchema,
      parse,
      handler: spec.handler,
    };
  });
}

/** Tool call execution shared by the stdio server and tests. */
export async function executeTool(
  tools: ConnectorTool[],
  name: string,
  rawArgs: unknown,
  context: ToolContext,
): Promise<{ ok: true; data: unknown } | { ok: false; error: unknown }> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return { ok: false, error: { code: "UNKNOWN_TOOL", message: `Unknown tool: ${name}` } };
  }
  const parsed = tool.parse(rawArgs);
  if (!parsed.ok) {
    return {
      ok: false,
      error: { code: "INVALID_ARGS", message: parsed.error },
    };
  }
  try {
    const data = await tool.handler(parsed.data, context);
    return { ok: true, data };
  } catch (error) {
    if (isConnectorError(error)) {
      return { ok: false, error: error.toJSON() };
    }
    return {
      ok: false,
      error: {
        code: "INTERNAL",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
