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

## 2026-02-15 — Browser tool artifact path not readable by local callback uploader
- **Symptom:** `node scripts/codex-notify.mjs callback --imagePath <browser-artifact>` fails with `ENOENT`.
- **Root cause:** `mcp__browser_tools__run_playwright_script` returns `browser:/...` artifact reference that is not mounted as a regular file path for local Node scripts.
- **Fix/workaround:** for callback image delivery, generate a local screenshot file (`artifacts/...`) via `scripts/page-screenshot-skill.mjs` (thum.io fallback) and pass that path to `--imagePath`.
- **Verification:** callback response JSON shows `imageDelivery.telegram[].ok=true` and `imageDelivery.slack.ok=true`.

## 2026-02-18 — Operator preference: progress screenshots in bridge updates
- **Symptom:** operator asked for more visual/"cyberpunk" progress feel in Telegram updates.
- **Root cause:** callback-auto often sends text-only updates unless `imageUrl` is attached.
- **Fix/workaround:** when feasible, include screenshot URL in callback payload (public URL or service-accessible image URL) and favor periodic visual updates for visible UI tasks.
- **Verification:** `node scripts/codex-notify.mjs callback-auto --summary "..." --imageUrl <public-image-url>` returns `imageDelivery` with sent image count > 0.

## 2026-02-19 — Franchize visual QA screenshot fallback still needed
- **Symptom:** Chromium in browser container crashed with SIGSEGV during `/franchize/vip-bike` screenshot capture.
- **Root cause:** intermittent Chromium headless instability in current runner session.
- **Fix/workaround:** immediately retried with Playwright Firefox and captured artifact successfully.
- **Verification:** `mcp__browser_tools__run_playwright_script` using Firefox saved `artifacts/franchize-vip-bike-shell-v2.png`.

## 2026-02-21 — Franchize QA slug test matrix for polish tasks
- **Symptom:** regressions slipped when validating only one slug/fallback dataset.
- **Root cause:** visual/typing groups differ per crew slug; `wbitem` and `gear` distributions were not stress-tested.
- **Fix/workaround:** run smoke checks and visual passes on `vip-bike` (baseline), `sly13` (wbitem ordering), and `antanta52.ru` (gear-heavy mix) for each catalog/header refactor.
- **Verification:** `FRANCHIZE_QA_SLUG=vip-bike npm run qa:franchize && FRANCHIZE_QA_SLUG=sly13 npm run qa:franchize && FRANCHIZE_QA_SLUG=antanta52.ru npm run qa:franchize`.

## 2026-02-21 — `codex-notify telegram` default text trap (`--message` vs `--text`)
- **Symptom:** heartbeat command looked successful but operator received generic "Codex task update" instead of custom progress text.
- **Root cause:** script accepted only `--text`; teammate/agent command used `--message`, so fallback default text was sent.
- **Fix/workaround:** add `--message` alias support in `scripts/codex-notify.mjs` (`getArgAlias`) and keep backward compatibility with `--text`.
- **Verification:** `node scripts/codex-notify.mjs telegram --message "T14 done" --chat-id "$ADMIN_CHAT_ID" --mirror-chat-id 417553377`.

## 2026-02-21 — TG rental photo flow can fail when `awaiting_rental_photo` state expires
- **Symptom:** user sends rental photo in Telegram and gets stuck/no-progress (`no active rental` context in adjacent action flow).
- **Root cause:** photo webhook required `user_states.awaiting_rental_photo`; when state expired/lost, photo was ignored and no completed photo event was recorded.
- **Fix/workaround:** add webhook fallback that auto-resolves likely renter rental + expected photo type from `rentals` + `events`; persist photo events with `status=completed` in both webhook and `addRentalPhoto` action.
- **Verification:** `npx eslint app/api/telegramWebhook/route.ts app/rentals/actions.ts --max-warnings=0` and manual Telegram photo upload after clearing `user_states` still routes to inferred rental step.
