---
name: codex-bridge-operator
description: Use for Telegram `/codex` bridge tasks to preserve PR title intent, auto-send callback notifications, and avoid manual curl blocks in operator replies.
---

# Codex Bridge Operator Skill

Use this skill when working on PR automation/callback flows in `carTest`.

## Non-negotiables
- Keep original PR title; never auto-rewrite title semantics.
- Prefer `node scripts/codex-notify.mjs callback-auto ...` for delivery updates.
- In normal operator replies, do **not** output copy-paste curl callback blocks unless explicitly requested.

## Fast workflow
1. Resolve final branch from PR metadata (`head.ref`) or local git branch.
2. Apply code/workflow changes.
3. Commit and create PR.
4. Trigger callback notification via script:
   - `callback-auto` when secret may be absent (skip gracefully)
   - `callback` when secret is guaranteed (fail loudly)

## Commands
```bash
# Safe for mixed environments (skips if secret missing)
node scripts/codex-notify.mjs callback-auto \
  --status completed \
  --summary "✅ Task done" \
  --prUrl "https://github.com/<owner>/carTest/pull/<id>" \
  --taskPath "/"

# Strict mode for CI/ops (fails if secret missing)
node scripts/codex-notify.mjs callback \
  --status completed \
  --summary "✅ Task done" \
  --prUrl "https://github.com/<owner>/carTest/pull/<id>" \
  --taskPath "/"
```

## Troubleshooting
- No callback delivery: validate `CODEX_BRIDGE_CALLBACK_SECRET` and callback endpoint.
- No Slack update: set `SLACK_CODEX_CHANNEL_ID` or `SLACK_INCOMING_WEBHOOK_URL`.
- No preview URL in callback: set `VERCEL_PROJECT_NAME` and `VERCEL_PREVIEW_DOMAIN_SUFFIX`.
