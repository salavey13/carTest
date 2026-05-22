---
name: supaplan-csv
slug: supaplan-csv
version: 1.0.0
homepage: https://github.com/SALAVEY13/franchize
description: Generate and manage SupaPlan task CSVs for bulk import into Supabase. Takes a task list with URLs and pre-generated UUIDs, outputs SupaPlan-compatible CSV rows.
changelog: v1 — Initial release aligned with SupaPlan operator protocol
metadata: {"clawdbot":{"emoji":"📋","requires":{"bins":["node"]},"os":["linux","darwin"]}}
---

## When to Use

Boss uses this skill when:
- Creating a flat task list CSV from a set of task definitions
- Preparing CSV for bulk import into Supabase `supaplan_tasks` table
- Adding URLs and pre-generated UUIDs to task entries
- Managing the pre-quest-chain step of the pipeline

## Pipeline Position

```
BOSS_QUEST.HTML (gamification rules)
  ↓
Task List (with URLs + UUIDs) ← THIS SKILL produces this
  ↓
Quest Chain Skill (enriches with lore, notifications, achievements)
  ↓
Final CSV → Supabase bulk import
```

## CSV Schema

The output CSV matches the `supaplan_tasks` Supabase table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Pre-generated task UUID (primary key) |
| `title` | string | Task title, e.g. `[QUEST][LERA] Quest Name` |
| `body` | text | Full task body with embedded protocol |
| `todo_path` | string | Reference doc path, e.g. `/BOSS_QUEST.HTML` |
| `plugin` | string | Plugin identifier (usually empty) |
| `capability` | string | SupaPlan capability, e.g. `franchize.gamification` |
| `status` | enum | One of: `open`, `claimed`, `running`, `ready_for_pr`, `done` |
| `created_by` | string | Creator identifier, e.g. `boss-agent` |
| `created_at` | timestamp | ISO 8601 creation timestamp |
| `updated_at` | timestamp | ISO 8601 update timestamp |
| `metadata` | JSONB | All quest data (notifications, instructions, lore, links) |
| `pr_url` | string | PR URL (empty until PR created) |

## Status Flow (from skill.ts)

```
open → claimed → running → ready_for_pr → done
                                    ↑          ↑
                              agent sets   merge workflow
                             (safe only)  (automatic)
```

**Agents must NEVER set `done` directly.** Only `claimed`, `running`, `ready_for_pr` are agent-safe statuses. The `done` status is set automatically by the merge workflow when it detects `supaplan_task: <uuid>` in a merged PR.

## Input Format

Task list JSON for this skill:

```json
{
  "capability": "franchize.gamification",
  "created_by": "boss-agent",
  "tasks": [
    {
      "id": "f3c5306d-2d8f-4cc4-bb77-26f20f7f9b11",
      "title": "[QUEST][LERA] Матрица Шапки",
      "task_name": "franchize-header-reflow",
      "task_url": "https://chatgpt.com/codex/cloud",
      "description": "Header redesign with rail navigation",
      "focus": ["Logo placement", "Tab alignment", "Cart badge", "Safe-area"],
      "edge_cases": ["iPhone SE 375px", "Telegram safe-area", "Hover states"],
      "done_when": "No overlapping controls, cart badge visible on all breakpoints"
    }
  ]
}
```

## Output

Standard SupaPlan CSV file saved to `/home/z/my-project/download/`.

## Straight Links

Every task entry MUST include `task_url` — a direct clickable URL to the Codex task.
- If specific URL is known, use it
- Default: `https://chatgpt.com/codex/cloud` (lands on task list, user's task is first after "plan boss task")
- The URL flows into: metadata.codex_task_url, body, notification_part1, notification_part2

## SupaPlan Operator Commands Reference

```bash
# Claim next task for capability
node scripts/supaplan-skill.mjs pick-task --capability franchize.gamification --agentId codex-01

# Move task through states
node scripts/supaplan-skill.mjs update-status --taskId <uuid> --status running
node scripts/supaplan-skill.mjs update-status --taskId <uuid> --status ready_for_pr

# Log execution event
node scripts/supaplan-skill.mjs log-event --type task_progress --payload '{"taskId":"<uuid>","step":"polished"}'

# Full smoke test
node scripts/supaplan-skill.mjs smoke-flow --capability franchize.gamification --agentId codex-smoke-01

# Verify merge workflow
node scripts/supaplan-skill.mjs review-merge-workflow
```

## Required Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Import into Supabase

After generating the CSV, import into Supabase:

1. **Via Supabase Dashboard**: Table Editor → Import CSV
2. **Via SQL**: `COPY supaplan_tasks FROM '/path/to/csv' WITH (FORMAT csv, HEADER true);`
3. **Via supabase-skill**: Future — `node scripts/supaplan-skill.mjs import-csv --file /path/to/csv`

## Security

- CSV contains task UUIDs and notification content — treat as internal data
- Never commit CSV with real Telegram chat IDs to public repos
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed
