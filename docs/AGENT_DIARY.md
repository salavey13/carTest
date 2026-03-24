# AGENT_DIARY — compact operational memory

Purpose: keep **high-signal** lessons for fast reuse. Long history moved to archive.

Archive:
- `docs/AGENT_DIARY_ARCHIVE_2026Q1.md`

## Quick memory cards (read first)

### 1) Telegram/Slack bridge safety
- Prefer plain-safe text in callbacks; Markdown can break Telegram parsing.
- If Slack `files.upload` scope is missing, upload image to public storage and post URL.
- For bridge tasks, always include final branch + preview-friendly slug in callback payload.

### 2) Screenshot fallback chain
- Strict order: Chromium -> Firefox -> WebKit -> thum.io (`scripts/page-screenshot-skill.mjs`).
- Browser artifact URIs (`browser:/...`) may be unreadable by local upload scripts; use local `artifacts/...` file path for notify scripts.

### 3) Franchize runtime guardrails
- Default QA slug is `vip-bike` unless operator asks another.
- Keep same-origin navigation SPA-first (`Link`/`router.push`), fix tap layers (z-index/pointer-events), avoid hard reload workaround.
- Persist cart with ordered/checkpoint strategy to survive mobile lag and suspend/resume.

### 4) Homework flow hard requirements
- Solve concretely (no plan-only output), persist to Supabase, then run read-after-write verification.
- Delivery must include screenshot URL + production solution link (and preferably Telegram WebApp deeplink).

## Recent notable deltas

### 2026-03-20
- Diary compressed to compact mode to reduce context bloat and speed up onboarding for new agents.
- Full chronology preserved in `docs/AGENT_DIARY_ARCHIVE_2026Q1.md`.

### 2026-02-27
- Historical franchize/T49 logs were moved out of huge planning file into diary/archive flow for merge safety.

## When to open archive
Open archive only for deep forensics on:
1. Telegram/Slack delivery incidents,
2. screenshot engine crashes,
3. franchize mobile navigation regressions,
4. homework OCR/solve/store incidents.

### 2026-03-24
- Upgraded `/supaplan/franchize` from simple mapping to operator-grade execution board: phased sections, R1-R4 task-type legend, and expanded live task details (`task_id`, `todo_path`, `updated_at`, `pr_url`, `body`).
- Added explicit epic decomposition hints per franchize capability so implementation can spawn child tasks deterministically instead of keeping oversized epics.
- Screenshot captured via fallback skill (`scripts/page-screenshot-skill.mjs`) because browser container tooling was unavailable in this runner.
