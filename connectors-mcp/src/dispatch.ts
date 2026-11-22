/**
 * Pure MCP message dispatcher — no I/O, fully unit-testable.
 *
 * Implements the small MCP stdio surface the sidecar needs:
 *   initialize · notifications/initialized (silent) · ping · tools/list · tools/call
 *
 * Framing happens in server.ts (newline-delimited JSON-RPC 2.0, per the MCP
 * stdio transport spec).
 */

import type { ConnectorCallContext } from "../../lib/connectors/shared/errors";
import {
  executeTool,
  type ConnectorTool,
  type ToolContext,
} from "./tools";

export const PROTOCOL_VERSION = "2024-11-05";
export const SERVER_INFO = {
  name: "traversa-connectors",
  version: "0.1.0",
};

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export type MessageId = string | number | null;

export interface DispatcherOptions {
  tools: ConnectorTool[];
  /** Correlation id used when the caller does not pass one in _meta/context. */
  systemCorrelationId?: string;
}

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: MessageId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

const ERR_PARSE = -32700;
const ERR_INVALID_REQUEST = -32600;
const ERR_METHOD_NOT_FOUND = -32601;

function ok(id: MessageId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function error(
  id: MessageId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

function parseMessage(raw: string): JsonRpcRequest | null {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as JsonRpcRequest) : null;
  } catch {
    return null;
  }
}

/** Extract a ConnectorCallContext from tools/call params (optional `_context`). */
export function contextFromParams(params: Record<string, unknown> | undefined): ToolContext {
  const raw = params?._context;
  if (!raw || typeof raw !== "object") {
    return { actor: { id: "mcp-client", kind: "system" } };
  }
  const bag = raw as Record<string, unknown>;
  const actorRaw = bag.actor;
  let actor: { id: string; kind: "crew" | "admin" | "system" } = {
    id: "mcp-client",
    kind: "system",
  };
  if (actorRaw && typeof actorRaw === "object") {
    const source = actorRaw as Record<string, unknown>;
    const kind = String(source.kind);
    actor = {
      id: String(source.id ?? "mcp-client"),
      kind: (kind === "crew" || kind === "admin" || kind === "system" ? kind : "system") as
        | "crew"
        | "admin"
        | "system",
    };
  }
  const correlationId =
    typeof bag.correlationId === "string" && bag.correlationId
      ? bag.correlationId
      : undefined;
  const context: ConnectorCallContext = { actor, correlationId };
  return context;
}

export function createDispatcher(options: DispatcherOptions) {
  const { tools } = options;

  return async function handleMessage(raw: string): Promise<JsonRpcResponse | null> {
    const message = parseMessage(raw);
    if (!message) {
      return error(null, ERR_PARSE, "Parse error");
    }
    const { method, params } = message;
    const id: MessageId = message.id ?? null;

    if (method === undefined) {
      return error(id, ERR_INVALID_REQUEST, "Missing method");
    }

    switch (method) {
      case "initialize":
        return ok(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        });

      case "notifications/initialized":
        return null; // notification — never answered

      case "ping":
        return ok(id, {});

      case "tools/list":
        return ok(id, {
          tools: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          })),
        });

      case "tools/call": {
        const name = String(params?.name ?? "");
        const rawArgs = params?.arguments ?? {};
        const context = contextFromParams(params);
        const outcome = await executeTool(tools, name, rawArgs, context);
        if (outcome.ok) {
          return ok(id, {
            content: [{ type: "text", text: JSON.stringify(outcome.data, null, 2) }],
            isError: false,
          });
        }
        return ok(id, {
          content: [
            { type: "text", text: JSON.stringify(outcome.error, null, 2) },
          ],
          isError: true,
        });
      }

      default:
        return error(id, ERR_METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
  };
}
