# connectors-mcp — MCP stdio sidecar over lib/connectors

Exposes carTest's portable connectors (ETM + 1С) as **6 MCP tools** so agent
runtimes (OpenCode on the hub VPS, Claude Code, any MCP client) and the hub's
deterministic path share ONE connector implementation.

```
etm_get_card        { code }                         → card snapshot (prices/stock/specs)
etm_search          { query }                        → [{ code, title, url }]
etm_find_by_ref     { mark, series?, article? }      → hit | null   («марка+серия+артикул → код»)
onec_ping           {}                               → { ok, serviceName }
onec_upsert_order   { externalId, docType, counterparty, lines } → { ref, number?, alreadyExisted? }  (idempotent by externalId)
onec_get_document   { ref }                          → document JSON
```

Wire compatibility: every call carries `ConnectorCallContext`
(`actor {id, kind}` + `correlationId`) → outbound headers
`x-megarepo-actor` / `x-megarepo-correlation-id`, identical to the hub and
carTest. Callers pass it per call via `params._context`; default is a
`system` actor.

## Layout & build (zero new runtime deps)

The sidecar COMPILES the repo's `lib/connectors` into its own `dist/` — a
dress rehearsal for the hub port, where the same folder is a plain copy:

```
connectors-mcp/
  src/{server,dispatch,tools,env}.ts   — sidecar (new code)
  tsconfig.json                        — rootDir ".." ⇒ compiles ../lib/connectors too
  dist/connectors-mcp/src/server.js    — entry after build
  dist/lib/connectors/**               — the connectors, compiled
  scripts/smoke.mjs                    — protocol smoke against the built binary
```

Sole runtime dependency: `zod` (shared with the root repo). Startup rule:
**the sidecar boots with zero env** — ETM public mode needs nothing; 1С tools
fail at call time with typed `MISSING_CONFIG` instead of crashing.

```
npm --prefix connectors-mcp run build     # tsc -p tsconfig.json
npm --prefix connectors-mcp run smoke     # spawn + initialize + tools/list + tools/call
node connectors-mcp/dist/connectors-mcp/src/server.js   # run
```

Tests: `npx vitest run tests/connectors-mcp.spec.ts` (19 specs — DI fakes,
no network; smoke.mjs covers the real stdio loop).

## Env (same contract as lib/connectors/README.md)

| Var | Meaning |
|---|---|
| `ETM_MODE` | `public` (default, works today) / `mock` / `api` |
| `ETM_API_TOKEN` | api mode — after the ЭДО заявка + методичка |
| `ETM_BASE_URL`, `ETM_SEARCH_URL_TEMPLATE`, `ETM_TIMEOUT_MS` | public-mode tuning |
| `ONC_BASE_URL` (or `ONEC_BASE_URL`), `ONC_USERNAME`, `ONC_PASSWORD` | 1С HTTP-сервис basic auth |
| `ONC_SERVICE_NAME` | default `megarepo` |

## Client config (hub VPS, OpenCode `opencode.json`)

```json
{
  "mcp": {
    "connectors": {
      "type": "local",
      "command": ["node", "/srv/traversa/connectors-mcp/dist/connectors-mcp/src/server.js"]
    }
  }
}
```

## Porting to the hub (per megarepo blueprint §02)

1. Copy `connectors-mcp/` + `lib/connectors/**` (the checklist in
   `lib/connectors/README.md` applies — the tsconfig already shows how the
   two trees nest).
2. `npm ci && npm run build` on the VPS (Node ≥ 18; confirm with Victor).
3. Point the OpenCode MCP config at the dist entry; set `ONC_*` when the 1С
   side publishes «megarepo»; set `ETM_API_TOKEN` when the методичка lands.
4. The `skills` layer references these tools by name — names are frozen.
