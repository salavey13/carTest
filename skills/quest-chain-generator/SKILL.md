---
name: quest-chain-generator
slug: quest-chain
version: 5.0.0
homepage: https://github.com/SALAVEY13/franchize
description: Generate gamified quest chain CSVs for SupaPlan tasks. Boss uses this to transform a flat task list with URLs into a cinematic, linked quest chain with achievements, skins, spoilers, straight links, and Hollywood notifications.
changelog: v5 — Node.js native, SupaPlan operator protocol alignment, straight links everywhere, callback-auto, agent-safe statuses only
metadata: {"clawdbot":{"emoji":"⚔️","requires":{"bins":["node"]},"os":["linux","darwin"]}}
---

## When to Use

Boss (Codex in plan mode) uses this skill when:
- Creating a new quest chain from a list of SupaPlan tasks
- Overhauling existing quest chain entries with richer content
- Generating CSV for bulk import into Supabase `supaplan_tasks` table

## Architecture

```
skills/quest-chain-generator/
  SKILL.md            # This file — skill definition and protocol
  generator.mjs       # Node.js quest chain generator (PRIMARY)
  generator.py        # Python generator (LEGACY, kept for reference)
  quest-templates.md  # Templates for achievements, skins, spoilers
```

## Quick Reference

| What | Command |
|------|---------|
| Generate CSV | `node skills/quest-chain-generator/generator.mjs` |
| Validate only | `node skills/quest-chain-generator/generator.mjs --validate-only` |
| Custom output | `node skills/quest-chain-generator/generator.mjs --output /path/to/file.csv` |
| Templates | `quest-templates.md` |

## Pipeline: BOSS_QUEST.HTML → Task List → CSV → Quest Chain

```
BOSS_QUEST.HTML (gamification rules + canon)
  ↓
Task List (with URLs + pre-generated SupaUUIDs)  ← Boss provides this
  ↓
CSV Skill (flat SupaPlan rows)
  ↓
Quest Chain Skill (enriches CSV with lore, notifications, achievements, straight links)
  ↓
Final CSV → Supabase bulk import
```

Future Boss instances will have access to all these files. For pilot (current 8 tasks), URLs and final polish done manually.

## STRAIGHT LINKS PHILOSOPHY

**The #1 UX rule**: Every notification that mentions a task MUST include a direct clickable URL to that task.

This eliminates "find I don't know what" friction:
- ❌ "вставь код в задачу Codex «franchize-header-reflow»" — User has to FIND the task
- ✅ "🎯 Прямая ссылка: https://chatgpt.com/codex/cloud" — One click, straight to business

**Where straight links appear:**
1. `notification_part1` — after cheatcode line
2. `notification_part2` — after next cheatcode line
3. `body` field — `codex_task_url` metadata line
4. `metadata` JSON — `codex_task_url` field

**Default URL**: `https://chatgpt.com/codex/cloud` — lands user on task list. Their task will be first after "plan boss task" (no code change). Replace with actual task URLs when available.

## Core Protocol

### 1. INPUT: Task List
Boss provides a list of tasks, each with:
- `task_name` (branch/slug, e.g., `franchize-header-reflow`)
- `task_url` (direct Codex link, or null for default)
- `task_description` (what was built, 1-2 sentences)
- `task_focus` (what needs polishing, bullet points)
- `task_edge_cases` (edge cases to check)
- `task_done_when` (completion criteria)

### 2. GENERATE: Quest Chain
For each task, the generator creates a SupaPlan task with:

**Three content blocks per quest:**
1. **notification_part1** — Hook sent by Boss when quest is activated. Contains: cinematic intro, what was built, achievement, cheatcode, STRAIGHT LINK.
2. **polish_instructions** — Agent's job description. Contains: focus areas, edge cases, done-when criteria, PR rules, notification skill call, SupaPlan status updates.
3. **notification_part2** — Victory message sent by executive agent after PR. Contains: completion text, achievement, skin, spoiler, next cheatcode, STRAIGHT LINK. **NEVER contains PR instructions.**

### 3. OUTPUT: CSV
Standard SupaPlan CSV with columns:
`id, title, body, todo_path, plugin, capability, status, created_by, created_at, updated_at, metadata, pr_url`

## SupaPlan Operator Protocol (Aligned with skill.ts)

The agent protocol embedded in each task follows the **strict status flow** from `app/supaplan/skill.ts`:

```
open → claimed → running → ready_for_pr → done
                                    ↑          ↑
                              agent sets   merge workflow sets
                             (ONLY these)  (automatic via PR)
```

**Agents must NEVER set status to "done".** Only `claimed`, `running`, `ready_for_pr` are agent-safe.

### 10-Step Agent Executive Protocol

1. **RECOGNIZE THE CHEATCODE** — Client pastes UUID
2. **CLAIM THE TASK** — `supaplan-skill.mjs pick-task --capability franchize.gamification`
3. **SET STATUS TO RUNNING** — `supaplan-skill.mjs update-status --taskId <uuid> --status running`
4. **EXECUTE POLISH** — Follow polish_instructions
5. **LOG PROGRESS** — `supaplan-skill.mjs log-event --type task_progress`
6. **CREATE PR WITH ⚡: PREFIX** — Auto-merge triggered, no manual merge needed
7. **INCLUDE supaplan_task IN PR BODY** — Required for merge workflow to promote to "done"
8. **SET STATUS TO ready_for_pr** — `supaplan-skill.mjs update-status --taskId <uuid> --status ready_for_pr`
9. **SEND HOLLYWOOD NOTIFICATION** — `codex-notify.mjs telegram --chatId <id> --text "<notification_part2>"`
10. **SEND BRIDGE CALLBACK** — `codex-notify.mjs callback-auto --status completed --summary "Task ready_for_pr" --taskPath /supaplan`

## UNIQUENESS MANDATE

Every quest MUST have:
- A **unique achievement** name and description
- A **unique skin** name and description
- A **unique spoiler** hinting at the next quest

No duplicates across the chain. The generator validates this.

## Notification Protocol

### Flow
```
Boss creates quest chain
  → Boss sends notification_part1 for Quest 1 (via codex-notify.mjs telegram)
  → Lera clicks STRAIGHT LINK → pastes cheatcode into Codex
  → Executive agent: claim → running → polish → log → PR(⚡:) → ready_for_pr
  → Executive agent sends notification_part2 (via codex-notify.mjs telegram)
  → Executive agent sends callback-auto (via codex-notify.mjs callback-auto)
  → notification_part2 contains next cheatcode + STRAIGHT LINK
  → Lera clicks next STRAIGHT LINK... (repeat ×8)
  → Quest 8 finale: chain complete celebration
```

### Hollywood Notification: Is a Special Skill Needed?

**No.** `codex-notify.mjs` is sufficient as-is. Here's why:

1. The Hollywood magic is in the **CONTENT** (notification_part1/part2 text), not the delivery mechanism
2. `codex-notify.mjs telegram` mode already supports: Markdown parse_mode, chatId targeting, multi-line text
3. `codex-notify.mjs callback-auto` mode handles the SupaPlan bridge callback
4. A separate "Hollywood notification skill" would just be a wrapper that reads metadata and calls the same script

**What we could add later** (convenience, not necessity):
- A helper that reads `notification_part2` from the current task's Supabase metadata and formats the CLI call
- Markdown escaping validation before sending
- But these are nice-to-haves, not blockers

### Rules
- **notification_part1**: Sent by BOSS. Hook + cheatcode + STRAIGHT LINK.
- **notification_part2**: Sent by EXECUTIVE AGENT after PR. Victory + next cheatcode + STRAIGHT LINK.
- **PR title instructions**: ONLY in `polish_instructions`, NEVER in notifications.
- **Telegram Markdown**: `parse_mode: Markdown`. Escape `_`, `*`, `[`, backticks in names.
- **Line breaks**: Use REAL line breaks. NEVER use literal `\n` characters.

## Grand Finale

The last quest in the chain (chain_finale: true):
- notification_part2 has no "Next cheatcode" line
- Includes chain completion summary (8/8, all achievements collected)
- Skin is legendary tier ("Golden Chain Complete")
- Ends with: "Цепь замкнута. Империя построена. Lera was here."

## Validation Checklist

Before outputting CSV, the generator validates:
- [ ] All UUIDs are unique
- [ ] Chain ordering is sequential (1, 2, 3...)
- [ ] next_quest_uuid links form a valid chain
- [ ] Last quest has next_quest_uuid = "NONE"
- [ ] All achievements are unique
- [ ] All skins are unique
- [ ] All spoilers are unique
- [ ] No PR instructions in notification_part2
- [ ] Straight links present in both notification_part1 AND notification_part2
- [ ] No literal `\n` characters (only real newlines)

## Customization for Boss

Future versions should accept a JSON task list as input:
```json
{
  "client_chat_id": "417553377",
  "commit_signature": "lera was here",
  "codex_task_url_base": "https://chatgpt.com/codex/cloud",
  "tasks": [
    {
      "task_name": "franchize-header-reflow",
      "task_url": "https://chatgpt.com/codex/tasks/abc123",
      "description": "Header redesign with rail navigation",
      "focus": ["Logo placement", "Tab alignment", "Cart badge"],
      "edge_cases": ["iPhone SE 375px", "Telegram safe-area"],
      "done_when": "No overlapping controls, cart badge visible"
    }
  ]
}
```

## Security & Privacy

**Data that stays local:**
- Quest content, UUIDs, task URLs — all in generated CSV

**Data that leaves your machine:**
- None by the generator itself
- `codex-notify.mjs` sends notification text to Telegram Bot API
- `supaplan-skill.mjs` reads/writes Supabase

**This skill does NOT:**
- Execute code automatically
- Send notifications on its own
- Access Supabase directly
