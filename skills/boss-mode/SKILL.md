# BOSS MODE — Multi-Agent Quest Orchestration

**Trigger phrases:** `ты босс`, `boss mode`, `как босс`, `ебаш` (Russian mode)

## Overview

BOSS MODE is a multi-agent orchestration system that:
1. **BOSS role** decomposes dreams into quest chains stored in SupaPlan
2. **AGENT roles** pick up and execute tasks in parallel
3. **Workflow tool** orchestrates multi-agent execution with conflict detection

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

### 1. Start BOSS Mode (Decomposition)

```bash
# Trigger BOSS mode to decompose a dream
node skills/boss-mode/boss.mjs decompose \
  --dream "Build a quest system for managing bot rentals" \
  --player "alex" \
  --questChainId "quest-bot-rentals" \
  --difficulty "epic"
```

### 2. Pick Task (Agent)

```bash
# Pick a task from SupaPlan
node scripts/supaplan-skill.mjs pick-task \
  --capability <name> \
  --agentId <id> \
  --mode boss
```

### 3. Execute with Multi-Agent Orchestration

```bash
# Execute task using Workflow for multi-agent coordination
node skills/boss-mode/execute.mjs \
  --taskId <uuid> \
  --agentId <id> \
  --workflow "multi-agent"
```

## Role Separation

### BOSS Role — Strategic Architect

- Receives dream trailer + bio dump from client
- Validates dream (is it achievable?)
- Decomposes into 5-8 quest doors
- Creates SupaPlan tasks with rich metadata
- Writes `polish_instructions` for each door
- Sets up dependency graph (requires/unlocks)
- Sends first INVITE notification

**BOSS writes:**
- `quest_chain_id`
- `dream_name`
- `polish_instructions` (creative direction per door)
- `tags` (for dynamic branching)
- `spoil_preview` (curiosity hooks)
- `requires` / `unlocks` (dependency DAG)
- `difficulty` (easy | medium | epic)

**BOSS does NOT write:**
- Achievement names (agent imagines these)
- Notification Part 2 content
- Commit structure
- Micro-branching decisions

### AGENT Role — Creative Executor

- Picks up SupaPlan task via cheatcode
- Reads `polish_instructions` from task metadata
- Executes the polish/implementation
- Imagines achievement name + description on-the-fly
- Checks SupaPlan for related tasks → picks TOP 3 for branching
- Can SUGGEST a 4th door (agent-suggested task)
- Creates structured commit body with achievement data
- Sends notification Part 2 with achievement + branching choices

**AGENT writes:**
- `achievement_name`, `achievement_description`
- Commit body with achievement metadata
- Notification Part 2
- Optional 4th door (new SupaPlan task)

**AGENT does NOT write:**
- Quest chain decomposition
- `polish_instructions` (boss owns this)
- Strategic vision

## SupaPlan Task Schema

```javascript
{
  id: "uuid",
  title: "Quest door name",
  capability: "category",
  status: "open|claimed|running|ready_for_pr|done",
  body: "Task description",
  metadata: {
    quest_chain_id: "chain-id",
    chain_position: 1,
    polish_instructions: "Creative direction...",
    player: "player-name",
    dream_name: "Dream name",
    difficulty: "easy|medium|epic",
    tags: ["auth", "api"],
    suggested_by: "boss|agent",
    requires: ["task-uuid-1"],
    unlocks: ["task-uuid-2", "task-uuid-3"],
    spoil_preview: "The first command whispers back..."
  }
}
```

## Workflow Orchestration

The `Workflow` tool enables true multi-agent orchestration:

### Pipeline Pattern (Default)

```javascript
// Each item processed independently through all stages
pipeline(items, stage1, stage2, stage3)
```

### Parallel Pattern (Barrier)

```javascript
// Run tasks concurrently, wait for ALL results
parallel([task1, task2, task3])
```

### Loop-Until-Dry Pattern

```javascript
// Keep spawning finders until K consecutive rounds return nothing
while (dry < 2) {
  const found = await parallel(FINDERS.map(f => () => agent(f)));
  const fresh = found.filter(f => !seen.has(key(f)));
  if (fresh.length === 0) { dry++; continue; }
  dry = 0;
  fresh.forEach(f => seen.add(key(f)));
}
```

## Notification Templates

### INVITE (Door Opens) — Sent by BOSS

```
🎬 ДВЕРЬ [N]: «[QUEST NAME]» ОТКРЫТА
🔓 [CHEATCODE]
🎯 [DIRECT LINK]
⭐ Task: 9/10 | You: 0/10
💊 Синяя: Create PR → 9/10 навсегда → дверь закрывается
💊 Красная: cheatcode → 10/10 → следующая дверь
```

### RED PILL (Complete) — Sent by AGENT

```
🔥 «[QUEST NAME]» — 10/10!
🏆 [ACHIEVEMENT_NAME]
⭐ Score: 10/10
🎖 Medal of Courage x2
━━━━━━━━━━━━━━━━━━━━
👀 CHOOSE YOUR NEXT DOOR:
🔴 Door [N+1]a: «[name]» — [desc]
   💬 [spoiler]
🔵 Door [N+1]b: «[name]» — [desc]
   💬 [spoiler]
🟢 Door [N+1]c: «[name]» — [desc]
   💬 [spoiler]
✨ Door [N+1]d: «[name]» — [desc] (AGENT SUGGESTED)
   💬 [spoiler]
```

## Key Rules

1. **Every door is a genuine choice** — not a trick, not a trap
2. **Tasks are 9/10** when notification arrives — "there is no spoon"
3. **Agents imagine achievements dynamically** — boss doesn't predefine
4. **Branching**: TOP 3 from boss-created tasks + optional ✨ 1 agent suggestion
5. **4th option**: Type A (polish current) OR Type B (new SupaPlan task)
6. **BLUE PILL** = 9/10 forever, good enough, no guilt
7. **RED PILL** = 10/10, meaningful, next door opens
8. **SUPERBOSS** = 13/10, polishing the polish, XTR donation → admin review

## Integration with Existing Systems

- **SupaPlan**: Task storage and lifecycle management
- **Workflow**: Multi-agent orchestration via the Workflow tool
- **Telegram**: Notifications via bot/WebApp
- **GitHub**: PR workflow with achievement commits
- **Supabase pg_cron**: Scheduled task triggers

## Files

- `skills/boss-mode/SKILL.md` — This file
- `skills/boss-mode/boss.mjs` — BOSS role implementation
- `skills/boss-mode/execute.mjs` — AGENT execution with Workflow
- `scripts/supaplan-skill.mjs` — Existing SupaPlan CLI (enhanced for BOSS mode)
- `supabase/migrations/supaplan/bossmode_support.sql` — DB schema for BOSS mode
