# AGENT_DIARY — CyberTutor runtime memory

Purpose: keep compact, reusable operational memory for bridge/homework tasks so agent behavior improves across runs.

## 2026-02-15 — Telegram Markdown parse failures in callback/ack
- **Symptom:** Telegram send errors: `Bad Request: can't parse entities`.
- **Root cause:** Markdown formatting in dynamic text/captions (unescaped symbols from user/task content).
- **Fix/workaround:** prefer plain-safe text for callback/ack messages and photo captions; avoid forced Markdown parse mode unless strictly needed.
- **Verification:** `node scripts/codex-notify.mjs callback ...` and inspect successful Telegram delivery in response JSON.

## 2026-02-15 — Slack `files.upload` missing_scope for forwarded TG photos
- **Symptom:** `/codex` photo forwarding logs show `Failed to upload Telegram photo to Slack ... missing_scope`.
- **Root cause:** Slack app lacks file scopes while message posting is allowed.
- **Fix/workaround:** upload photo bytes to Supabase public storage and post URL fallback into Slack thread.
- **Verification:** trigger `/codex` photo path; ensure thread contains `📎 TG photo ...` link and forwarding status >0.

## 2026-02-15 — Playwright Chromium crash in browser container
- **Symptom:** `TargetClosedError` with Chromium SIGSEGV.
- **Root cause:** runner/browser-container instability for chromium headless shell.
- **Fix/workaround:** retry screenshot with fallback order: Chromium -> Firefox -> WebKit -> thum.io (`scripts/page-screenshot-skill.mjs`).
- **Verification:** successful image artifact path or successful thum.io output file.

## 2026-02-15 — Homework completion should include deep links
- **Symptom:** screenshot/text delivered but operator still lacks one-click app-open link.
- **Root cause:** callback text had preview/prod URLs only.
- **Fix/workaround:** include Telegram WebApp deep link `https://t.me/oneBikePlsBot/app?startapp=homework/solution/<jobId>` plus production web URL.
- **Verification:** callback response includes `homeworkDeepLink` and outgoing message contains `Open in bot app:` line.

## 2026-02-15 — Stale Supabase row vs rich UI fallback mismatch
- **Symptom:** Screenshot shows detailed solution, but `homework_daily_solutions` contains shorter stale markdown.
- **Root cause:** UI rendered from richer local fallback while DB row had older payload from earlier save script.
- **Fix/workaround:** add weak-row detection and auto upsert of local fallback into Supabase on hydration for known fallback job IDs.
- **Verification:** open `/homework/solution/16-02-schedule`, then check row `solution_markdown/full_solution_rich` length and `updated_at` changed.

## 2026-02-15 — Response verbosity policy for bridge callbacks
- **Symptom:** Final responses kept repeating full callback curl block even when callback was already sent automatically.
- **Root cause:** legacy habit from earlier fragile callback stage.
- **Fix/workaround:** default to concise final response without curl block; provide curl fallback only on explicit user request or callback failure.
- **Verification:** check final response template against AGENTS 9.4.9 policy.
