---
name: boss-mode
description: "BOSS MODE — multi-agent quest orchestration. Decomposes dreams into quest chains, routes to skills, executes in parallel."
---

# BOSS MODE — Multi-Agent Quest Orchestration

**Trigger phrases:** `ты босс`, `boss mode`, `как босс`, `ебаш` (Russian mode)

## Overview

BOSS MODE is a multi-agent orchestration system that:
1. **BOSS role** decomposes dreams into quest chains stored in SupaPlan
2. **AGENT roles** pick up and execute tasks in parallel
3. **Workflow tool** orchestrates multi-agent execution with conflict detection

## Skill Routing

When an operator request matches VIP Bike operations, route to `vip-bike-ops`:

| Operator says... | Route to |
|---|---|
| Any franchize/leads/analytics/rentals/sales/services query | `vip-bike-ops` (primary agent) |
| Document generation (rental/sale/KP/subrent contract) | `commercial-proposal-from-offer` or `rental-contract-from-photos` |
| Code changes / GitHub push / migration | `vip-bike-ops` (has GitHub + Supabase access) |
| Content/marketing tasks | `factory-global-rules` (content factory rules) |

### Quick routing decision tree

```
Is it about VIP Bike operations (leads, rentals, sales, services, crew, catalog)?
├── YES → vip-bike-ops (15 text skills, Supabase, GitHub)
├── NO → Is it about document generation?
│   ├── YES → commercial-proposal-from-offer / rental-contract-from-photos
│   └── NO → Is it about content/marketing?
│       ├── YES → factory-global-rules
│       └── NO → Use general-purpose agent
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BOSS MODE                                  │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   DREAM      │  →   │  SUPAPLAN    │  →   │  WORKFLOW    │  │
│  │  INPUT       │      │   TASKS      │      │ ORCHESTRATION │  │
│  └──────────────┘      └──────────────┘      └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
   Client Request        Task Queue           Parallel Agents
```

## Usage

### Start BOSS Mode (Decomposition)

```bash
node skills/boss-mode/boss.mjs decompose \
  --dream "Build a quest system for managing bot rentals" \
  --player "alex" \
  --questChainId "quest-bot-rentals" \
  --difficulty "epic"
```

### Pick Task (Agent)

```bash
node skills/boss-mode/boss.mjs pick \
  --player "alex" \
  --questChainId "quest-bot-rentals"
```

### Execute Task

```bash
node skills/boss-mode/execute.mjs \
  --taskId "task-001" \
  --player "alex"
```

## VIP Bike Quick Commands

When operating in VIP Bike context, use `vip-bike-ops` as the primary router:

```bash
# Morning standup — 3 skills in parallel
node skills/leads-crm-text/leads-query.mjs list-leads --hot --limit 5
node skills/rental-analytics-text/rental-query.mjs returns-due
curl -s "$URL/rest/v1/crew_todos?select=id,title,due_date&crew_id=eq.$CREW_ID&status=neq.done&due_date=lt.now()" -H "apikey: $KEY"

# Bike availability check
node skills/franchize-catalog-text/catalog-query.mjs check-availability falcon-gt-2025 --date 2026-08-01

# Dismiss a lost lead
node skills/leads-crm-text/leads-query.mjs dismiss-lead +79991234567 --reason unreachable --note "Не берёт трубку"
```

## Related Files

- `skills/vip-bike-ops/SKILL.md` — VIP Bike operations super-skill (15 text skills)
- `skills/boss-mode/boss.mjs` — decomposition script
- `skills/boss-mode/execute.mjs` — execution script
- `docs/skills/fk-pasha-admin.md` — Pasha's admin runbook (complementary)
- `docs/skills/factory-global-rules.md` — content factory rules
