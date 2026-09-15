// End-to-end smoke for the BUILT sidecar: spawns dist/src/server.js, speaks
// newline-delimited JSON-RPC 2.0 over stdio, asserts initialize → tools/list
// → tools/call (etm_get_card in mock mode; onec_ping fails typed MISSING_CONFIG).
//
// Usage:
//   npm --prefix connectors-mcp run build
//   npm --prefix connectors-mcp run smoke
//
// Exit code 0 = sidecar is protocol-correct.

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = join(here, "..", "dist", "connectors-mcp", "src", "server.js");

const child = spawn("node", [serverPath], {
  env: { ...process.env, ETM_MODE: "mock" },
  stdio: ["pipe", "pipe", "pipe"],
});

let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

const pending = new Map();
let buffer = "";
child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    const resolve = pending.get(message.id);
    if (resolve) {
      pending.delete(message.id);
      resolve(message);
    }
  }
});

function request(id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timeout waiting for ${method} (#${id})`));
    }, 10_000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

function assert(condition, label) {
  if (!condition) throw new Error(`SMOKE FAIL: ${label}`);
  console.log(`  ok — ${label}`);
}

try {
  const init = await request(1, "initialize", {});
  assert(init.result?.serverInfo?.name === "traversa-connectors", "initialize → serverInfo");
  assert(
    typeof init.result?.protocolVersion === "string" && init.result.protocolVersion.length > 0,
    "initialize → protocolVersion",
  );

  const list = await request(2, "tools/list");
  const names = list.result?.tools?.map((t) => t.name) ?? [];
  assert(names.length === 6, `tools/list → 6 tools (${names.join(", ")})`);

  const card = await request(3, "tools/call", {
    name: "etm_get_card",
    arguments: { code: "5517285" },
  });
  assert(card.result?.isError === false, "etm_get_card (mock) → isError=false");
  const snapshot = JSON.parse(card.result.content[0].text);
  assert(snapshot.code === "5517285", "etm_get_card → snapshot.code === 5517285");

  const ping = await request(4, "tools/call", { name: "onec_ping", arguments: {} });
  assert(ping.result?.isError === true, "onec_ping (no ONC_*) → isError=true");
  const pingErr = JSON.parse(ping.result.content[0].text);
  assert(pingErr.code === "MISSING_CONFIG", "onec_ping → typed MISSING_CONFIG");

  const corr = await request(5, "tools/call", {
    name: "onec_ping",
    arguments: {},
    _context: { actor: { id: "413553377", kind: "crew" }, correlationId: "smoke:1" },
  });
  assert(corr.result?.isError === true, "_context accepted (actor+correlationId)");

  console.log(`\nSMOKE PASS (stderr: ${stderr.trim().split("\n").length} line(s), ready banner: ${stderr.includes("ready")})`);
  child.kill();
  process.exit(0);
} catch (error) {
  console.error(error.message);
  console.error("server stderr:", stderr);
  child.kill();
  process.exit(1);
}
