# vip-bike-ops — Self-Enhancement Protocol

> The boss agent can read, modify, and create skills at runtime. This document
> defines the protocol for safe self-enhancement.
>
> **Philosophy**: "Harness your power like Salin Ismail proposes" — the agent
> is not a static tool. It's a learning system that gets better with every
> interaction. Skills are not just consumed — they're grown.

---

## 1. What "self-enhancement" means

The boss agent can:

1. **Read any skill** — at any time, the agent can read any `SKILL.md` in
   `skills/` or `docs/skills/` to learn new capabilities.
2. **Activate factory skills** — move a skill from `factory_skills_available`
   to `active_skills` in the manifest, making it part of the routing table.
3. **Create new skills** — if the operator asks for something no skill covers,
   the agent can create a new `SKILL.md` with the right structure.
4. **Modify existing skills** — fix bugs, add commands, update trigger phrases.
5. **Create new boss commands** — add scheduled scripts to `boss-commands/`.
6. **Track its own KPIs** — every query updates the KPI file, which feeds the
   dashboard.
7. **Suggest improvements** — based on usage patterns, the agent can propose
   new skills or commands to the operator.

---

## 2. The Skill Manifest

**Path:** `skills/vip-bike-ops/skill_manifest.json`

This is the single source of truth for what the boss knows. Updated every
time a skill is activated/deactivated/created.

```json
{
  "version": "1.0.0",
  "updated_at": "2026-07-24T01:00:00Z",
  "active_skills": [...],
  "factory_skills_available": [...],
  "boss_commands": [...],
  "self_enhancement": {
    "enabled": true,
    "can_create_skills": true,
    "can_modify_skills": true,
    "can_activate_factory_skills": true,
    "manifest_path": "skills/vip-bike-ops/skill_manifest.json",
    "skills_dir": "skills/",
    "factory_skills_dir": "docs/skills/"
  }
}
```

### Operations

| Operation | Command | Who can do it |
|---|---|---|
| List skills | `skill-orchestrator.sh --list` | agent + operator |
| Activate factory skill | `skill-orchestrator.sh --activate <name>` | agent (auto) + operator (manual) |
| Deactivate skill | (edit manifest, move back to factory) | agent + operator |
| Create new skill | (write new SKILL.md + add to manifest) | agent (with operator approval) |
| View KPIs | `skill-orchestrator.sh --kpi` | agent + operator |

---

## 3. Self-enhancement workflow

When the agent encounters a request it can't handle:

```
1. DETECT  — agent recognizes the request doesn't match any active skill
2. SEARCH  — agent checks factory_skills_available + docs/skills/ for a match
3. ACTIVATE — if found, agent activates it via skill-orchestrator.sh --activate
4. LEARN   — agent reads the newly-activated SKILL.md
5. EXECUTE — agent uses the skill to answer the operator
6. LOG     — agent logs the query to KPIs (marks it as "self-enhanced")
7. SUGGEST — agent tells the operator: "I activated <skill> to handle this"
```

If no existing skill covers the request:

```
1. DETECT  — agent recognizes no skill covers this
2. PROPOSE — agent tells the operator: "No skill covers this. I can create one. Approve?"
3. CREATE  — on approval, agent writes a new SKILL.md with the right structure
4. ACTIVATE — agent adds the new skill to the manifest
5. EXECUTE — agent uses the new skill to answer
6. LOG     — agent logs the creation to KPIs
```

---

## 4. Agent KPIs

**Path:** `/tmp/boss-agent-kpis.json` (runtime) + `skills/vip-bike-ops/agent_kpis.json` (persistent)

### Tracked metrics

| Metric | Type | Purpose |
|---|---|---|
| `queries_total` | counter | Total requests processed |
| `queries_by_skill` | map<skill, count> | Which skills are most used |
| `queries_by_type` | map<type, count> | list / detail / action / composite |
| `avg_response_ms` | gauge | Average response time |
| `cache_hits` / `cache_misses` | counter | Cache effectiveness |
| `telegram_sends_ok` / `telegram_sends_fail` | counter | Notification reliability |
| `errors` | counter | Total errors encountered |
| `skills_activated` | counter | Self-enhancement events |
| `skills_created` | counter | New skills created by agent |
| `top_skills` | array | Top 5 by usage (computed) |

### KPI update protocol

Every boss command and every skill invocation updates the KPI file:

```bash
# In _lib.sh (future addition):
record_kpi() {
  local skill="$1"
  local type="$2"  # list | detail | action | composite
  local response_ms="$3"

  python3 -c "
import json, time
kpi_file = '$KPI_FILE'
try:
    with open(kpi_file) as f:
        kpis = json.load(f)
except:
    kpis = {'queries_total': 0, 'queries_by_skill': {}, ...}

kpis['queries_total'] += 1
kpis['queries_by_skill']['$skill'] = kpis['queries_by_skill'].get('$skill', 0) + 1
kpis['queries_by_type']['$type'] = kpis['queries_by_type'].get('$type', 0) + 1
# Update rolling average response time
n = kpis['queries_total']
old = kpis['avg_response_ms']
kpis['avg_response_ms'] = (old * (n-1) + $response_ms) / n

with open(kpi_file, 'w') as f:
    json.dump(kpis, f, indent=2)
"
}
```

---

## 5. Top useful skills (live ranking)

The agent ranks skills by usage frequency. Skills with 0 usage in 7 days get
flagged as "candidates for deactivation". Skills with high usage get flagged
as "candidates for enhancement" (add more commands, improve docs).

### Current top 5 (based on manifest, will populate with real data)

| Rank | Skill | Status | Notes |
|---|---|---|---|
| 1 | `rental-analytics-text` | Active | Most-used — rentals are the core business |
| 2 | `leads-crm-text` | Active | High traffic — leads funnel is daily ops |
| 3 | `rental-card-text` | Active | Deep-dive on specific rentals |
| 4 | `crew-management-text` | Active | Crew ops + todos |
| 5 | `franchize-catalog-text` | Active | Bike info + pricing |

### Factory skills candidates for activation

| Skill | Why activate | Trigger phrases |
|---|---|---|
| `fk-pasha-admin` | Deployment + repo admin questions | "деплой", "VPS", "git push" |
| `fk-contract` | .docx contract generation | "договор docx", "сгенерировать контракт" |
| `avito-seller` | Avito lead management | "авито", "лид с авито" |

---

## 6. Self-enhancement safety rules

1. **NEVER delete a skill** — only deactivate (move to factory_skills_available).
2. **NEVER modify a skill without operator approval** — propose first, execute on "yes".
3. **NEVER create a skill that bypasses PII masking** — all new skills must follow the anti-hallucination rules.
4. **NEVER create a skill that exposes the Supabase service key** — same rule as all skills.
5. **ALWAYS log self-enhancement events** — `skills_activated` and `skills_created` counters must increment.
6. **ALWAYS test new skills with --dry-run** before activating.
7. **ALWAYS include the web link** in new skill responses.
8. **ALWAYS respond in Russian** unless operator wrote in English.

---

## 7. Future: agent-to-agent collaboration

When multiple boss agents are running (e.g. one per crew), they can share
skills via the manifest:

```
Agent A (vip-bike crew) creates a new skill "vip-bike-pricing-optimizer"
  ↓
Agent A publishes to shared skill registry (Supabase table `agent_skills`)
  ↓
Agent B (sly13 crew) discovers the skill via skill-orchestrator --discover
  ↓
Agent B activates it (after operator approval)
  ↓
Agent B's KPIs now track usage of the borrowed skill
```

This is Phase 3+ — requires a shared skill registry + multi-tenant manifest.

---

## 8. The "Salin Ismail" principle

> "Harness your power" — the agent should be:
>
> 1. **Self-aware** — knows its own KPIs, strengths, weaknesses
> 2. **Self-improving** — activates/creates skills to fill gaps
> 3. **Self-healing** — catches errors, logs them, suggests fixes
> 4. **Self-documenting** — every enhancement is recorded in the manifest
> 5. **Self-moderating** — asks for approval before destructive changes

The boss is not just a router — it's a **living system** that grows with the
operator's needs. Every query makes it smarter. Every activation expands its
surface area. Every KPI data point informs the next improvement.

### The agent's daily self-check

Every morning at 09:00 (before the morning-standup), the boss runs:

```bash
./skill-orchestrator.sh --kpi > /tmp/boss-self-check.log
```

This log answers:
- How many queries did I handle yesterday?
- Which skills were most/least used?
- Did I activate any new skills?
- Did I create any new skills?
- What's my cache hit rate?
- How many Telegram notifications succeeded/failed?
- What should I improve today?

The morning-standup notification includes a "🤖 Agent self-check" section
summarizing these metrics.

---

## 9. Implementation status

| Feature | Status | Path |
|---|---|---|
| Skill manifest | ✅ Done | `skills/vip-bike-ops/skill_manifest.json` |
| skill-orchestrator.sh | ✅ Done | `boss-commands/skill-orchestrator.sh` |
| KPI tracking | 🟡 Partial | `skill-orchestrator.sh --kpi` works; per-query tracking TODO |
| Self-enhancement protocol | ✅ Done | This document |
| Agent KPI dashboard | 🟡 Partial | HTML report exists; live dashboard TODO |
| Agent-to-agent sharing | 🔴 Phase 3+ | Not started |
| Auto-skill-creation | 🟡 Partial | Protocol defined; implementation TODO |

### Next steps

1. **Add `record_kpi()` to `_lib.sh`** — every boss command calls it after execution
2. **Add "🤖 Agent self-check" to morning-standup** — KPI summary in the daily digest
3. **Build live KPI dashboard HTML** — auto-refreshing page at `/docs/agent_kpis.html`
4. **Implement auto-skill-creation** — when agent detects a gap, propose + create on approval
5. **Add skill deactivation** — auto-deactivate skills with 0 usage in 30 days (with operator notice)
