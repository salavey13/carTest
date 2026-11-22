# hub-port — Python reference layer for the traversa hub

Staged in carTest **next to the TypeScript originals it mirrors**. Nothing in
this folder is imported by the Next.js app; it is a port package. The port
destination is **Jeezzzy/traversa** (FastAPI hub), where it lands as:

| Staged here | Lands in traversa as | Mirrors (carTest source of truth) |
|---|---|---|
| `hub_port/telegram.py` | `src/api/telegram_auth.py` | `lib/telegram-webapp-auth.ts`, `lib/telegram-launch-params.ts` |
| `hub_port/actor.py` | `src/connectors/context.py` | `lib/connectors/shared/errors.ts` (`ConnectorCallContext`), `shared/http.ts` (`contextHeaders`) |
| `hub_port/crew.py` | `src/crew/registry.py` | *(new — the «dirty way»: no TS twin, Supabase stays the registry)* |
| `hub_port/bot_commands.py` | bot handler glue next to `src/agents/runner.py` | *(new — decision logic only; runner itself already exists in traversa)* |
| `tests/` | `tests/…` (pytest) | golden vector from `scripts/tg_golden_vector.mjs` |

## Why staged here

carTest is the lab: the TS originals are prod-proven (Vercel + real Telegram
traffic), the golden vector pins the crypto, and the repo is where the port
checklists live (`lib/connectors/README.md`, megarepo blueprint). Copying a
tested module beats rewriting from a spec.

## What each piece does

**telegram.py** — official Telegram Mini App initData validation:
`secret = HMAC(b"WebAppData", bot_token)` (binary), then
`hash = HMAC(secret, data_check_string)`, data-check = all initData pairs
except `hash`, **sorted by (key, value) after URL-decoding**, `signature`
field stays inside the signed set. Plus: auth_date freshness window
(24h default, 5 min future skew, missing → not fresh), launch-params
extraction (`tgWebAppData` / `tgWebAppStartParam` from query then fragment),
`user` JSON decoding. Zero dependencies.

**actor.py** — the `ConnectorCallContext` twin. Wire format is byte-identical
with the TS connectors:
`x-megarepo-actor: crew:413553377`, `x-megarepo-correlation-id: req:…`.
This is what makes bot-triggered / UI-triggered / agent-triggered external
calls auditable under one correlationId across both runtimes.

**crew.py** — the «dirty way» decided in brainstorm round 2: **Supabase stays
the source of truth** for crews/invites/roles; carTest keeps managing them;
the hub only READS. Three PostgREST queries with the service-role key:
`crew_members` (active, by tg user id) → `crews` → `CrewMembership`.
60s TTL cache + **stale-on-error** (Supabase blip degrades to last known-good
instead of failing auth). Typed errors (`MISSING_CONFIG | HTTP_ERROR |
PARSE_ERROR | TIMEOUT`) matching the TS connector error codes. Role mapping
table `HUB_ROLE_MAP` (owner/admin→admin, manager→manager, member/worker→
engineer, viewer→viewer) — bless once, both sides reference.

**bot_commands.py** — driving the hub's existing OpenCode runner
(`src/agents/runner.py`, allowlisted agents in `agents/opencode.json`,
single-flight lock, budgets, AgentRun audit) from the **existing traversa
Telegram bot** (already configured on the VPS — no BotFather, no new bot):
pure decision logic for `/agent <name> <task>`, `/agents`, `/whoami` —
command parsing, role gating against `AGENT_ROLE_MATRIX`, runner request
shaping (bot-prefixed correlationId), reply formatting with truncation.
Transport-agnostic: the VPS bot handler stays ~30 lines.

## Env the hub needs (VPS)

```
TELEGRAM_BOT_TOKEN=<traversa bot token>      # signs AND validates MiniApp initData
SUPABASE_URL=https://<project>.supabase.co   # dirty-way crew registry (read-only)
SUPABASE_SERVICE_ROLE_KEY=<service-role>     # server-side only, never exposed
```

## Run tests

```
cd hub-port
python3 -m pytest tests/ -q          # stdlib only; pytest is the sole dev dep
```

## Port checklist (into Jeezzzy/traversa)

1. Copy `hub_port/` + `tests/` (no dependency changes — stdlib only).
2. FastAPI dependency sketch:
   `actor = build_actor(request)` → validate MiniApp initData cookie/header
   → `registry.membership_for(tg_user_id)` → `require_role("manager")` guard.
3. Wire `actor_headers(context)` into the Python-side connector calls and the
   MCP shim headers so `connector_calls` auditing stays uniform.
4. Regenerate the golden vector from carTest if the TS validator ever changes;
   TS remains the source of truth.
