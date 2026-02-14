---
name: homework-solution-store-supabase
description: Persist solved homework markdown to Supabase with table bootstrap guard, fast same-day lookup, and optional notify callback.
---

# Homework Solution Store (Supabase)

Use this skill when you want to store solved homework in Markdown and instantly answer repeated same-day requests.

## Goal
1. Ensure `public.homework_daily_solutions` exists (or bootstrap if possible).
2. Save/upsert solved answer payload with markdown text.
3. Check fast existence by `solution_key` (and optional date) before regenerating.
4. Optionally notify bridge callback from this skill run.

## Runtime commands

```bash
node scripts/homework-solution-store-skill.mjs ensure-table
node scripts/homework-solution-store-skill.mjs bootstrap-table --notify 1
node scripts/homework-solution-store-skill.mjs exists --solutionKey <jobId> --date <YYYY-MM-DD> --notify 1
node scripts/homework-solution-store-skill.mjs save --solutionKey <jobId> --date <YYYY-MM-DD> --json <path-to-payload.json> --notify 1
```

## Guardrail
- `bootstrap-table` tries RPC SQL runners (`exec_sql`, `execute_sql`, `run_sql`).
- If RPC bootstrap is unavailable, run migration manually:
  - `supabase/migrations/20260214195500_homework_daily_solutions.sql`

## Payload shape
Expected JSON for `save --json`:

```json
{
  "subject": "algebra",
  "topic": "...",
  "given": "...",
  "steps": ["..."],
  "answer": "...",
  "solutionMarkdown": "## Что дано\n...",
  "rewriteForNotebook": "...",
  "sourceHints": [{"book": "alg.pdf", "page": "107"}],
  "screenshotUrl": "https://..."
}
```

`solutionMarkdown` is persisted to both `solution_markdown` and `full_solution_rich` for backwards compatibility.
