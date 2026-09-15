# External-system connectors (ETM + 1С)

Contract-first, portable, zero app-specific imports. Written in carTest first,
to be ported into the traversa runtime **together with the crew-access layer**
(see «Porting with crew access» below).

```
lib/connectors/
  shared/
    errors.ts     — ConnectorError (codes: MISSING_CONFIG | NOT_IMPLEMENTED | HTTP_ERROR | PARSE_ERROR | TIMEOUT) + ConnectorCallContext
    http.ts       — requestJson (injectable fetch, timeout, actor/correlation headers)
  etm/            — ЭТМ (etm.ru) price/stock/catalog + заявка-gated partner API stub
  onec/           — 1С: HTTP-сервисы (write channel) + OData (read/BI channel)
tests/lib/        — connector unit tests (mocked fetch, no network)
```

## ETM — two modes

| Mode | Env | Works today? | What it gives |
|------|-----|--------------|---------------|
| `public` (default) | `ETM_BASE_URL`, optional `ETM_SEARCH_URL_TEMPLATE` | ✅ no login, no заявка | public card per product code: retail + opt price tiers, discount %, cashback, stock (today/later), full specs |
| `api` (заявка-gated) | `ETM_API_TOKEN` (+ `ETM_BASE_URL`) | ⛔ after «Заявка на настройку ЭДО» + методичка | personal price tiers, orders, УПД documents (`EtmApiClient` — shape ready, methods throw `NOT_IMPLEMENTED`) |
| `mock` | `ETM_MODE=mock` | ✅ | in-memory transport for tests/demos |

```ts
import { getEtmClientFromEnv } from "@/lib/connectors/etm";

const etm = getEtmClientFromEnv();
const card = await etm.getCard("5517285");            // ТМ-63: 7 123.82 ₽ / 5 169.51 ₽opt −27%
const hit  = await etm.findByRef({ mark: "ТМ-63", series: "PX" }); // → код товара
```

Known limits of the public mode (verified 2026-09-13 on card 5517285):
prices are *public* tiers — your personal discount tier, real-time multi-warehouse
stock, orders and УПД flow exist only in the partner API (заявка/методичка).
Some cards render client-side and yield empty HTML — treat empty parse as
"retry later / use search" rather than a hard error.

## 1С — two channels

- **HTTP-сервисы** (write, primary): `OnecHttpClient` — basic auth, `{baseUrl}/hs/{service}/…`,
  `ping()`, `upsertOrder(payload)` (idempotent by `externalId`), `getDocument(ref)`.
- **OData** (read/BI only): `client.fetchOdata("Document_…", { top, filter, select })`.
- EnterpriseData / файловый обмен — deliberately out (overkill / fallback).

Env: `ONC_BASE_URL` (or `ONEC_BASE_URL`), `ONC_USERNAME`, `ONC_PASSWORD`,
optional `ONC_SERVICE_NAME` (default `megarepo`).

```ts
import { getOnecClientFromEnv } from "@/lib/connectors/onec";

const onec = getOnecClientFromEnv();
await onec.ping();
const res = await onec.upsertOrder({ externalId: request.id, docType: "order", counterparty: {...}, lines: [...] });
```

1С side TODO (one-time, by the 1С developer): publish the infobase, create
HTTP-сервис `megarepo` with commands `ping`, `orders` (POST), `documents/{ref}`
(GET), and the `externalId` mapping for idempotency.

## Porting with crew access

Both connectors take an optional `ConnectorCallContext { actor, correlationId }`
per call and propagate it as `x-megarepo-actor` / `x-megarepo-correlation-id`
headers. In carTest the future crew/auth middleware fills it; in traversa the
same context is filled from its role system. The connector code does not change
during the port — only the context source does.

Port checklist (per the megarepo blueprint):
1. Copy `lib/connectors/**` + `tests/lib/connectors-*` (no other deps).
2. Provide the context source (crew session → actor) at call sites.
3. Keep `zod` as the only runtime dependency.
