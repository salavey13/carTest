/**
 * connectors-mcp stdio server entry point.
 *
 * Transport: newline-delimited JSON-RPC 2.0 over stdin/stdout (MCP stdio).
 * Every outbound message is a single line (JSON has no embedded newlines
 * after stringify), which is exactly what the MCP stdio spec requires.
 *
 * Run from repo root (after `bun run connectors-mcp` build or
 * `npm --prefix connectors-mcp run build`):
 *
 *   node connectors-mcp/dist/src/server.js
 *
 * Client config (OpenCode `opencode.json`, Claude Code, etc.):
 *
 *   "mcp": { "connectors": { "type": "local",
 *             "command": ["node", "/srv/traversa/connectors-mcp/dist/src/server.js"] } }
 */

import { createInterface } from "readline";
import { buildDefaultTools } from "./env";
import { createDispatcher } from "./dispatch";
import type { JsonRpcResponse } from "./dispatch";

const dispatcher = createDispatcher({ tools: buildDefaultTools() });

function write(response: JsonRpcResponse): void {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

const readline = createInterface({ input: process.stdin, terminal: false });

readline.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  void dispatcher(trimmed)
    .then((response) => {
      if (response) write(response);
    })
    .catch((err) => {
      write({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: "Internal error",
          data: err instanceof Error ? err.message : String(err),
        },
      });
    });
});

readline.on("close", () => {
  process.exit(0);
});

// Log to stderr ONLY — stdout is the protocol channel.
process.stderr.write(
  `[connectors-mcp] ready: ${buildDefaultTools().length} tools (etm_get_card, etm_search, etm_find_by_ref, onec_ping, onec_upsert_order, onec_get_document)\n`,
);
