# TOOLS.md — Global Operator Harness (Sandbox-wide)

Scope: whole repository (`carTest`).

This file is the shared execution cheat sheet for all domains: franchize, wb, greenbox, strikeball, homework-maker, supaplan, bridge flows.

## Core command spine

- `npm run lint` — static baseline.
- `npm run build` — production compile baseline.
- `npm run qa:map-riders` — map-riders + API smoke.
- `node scripts/supaplan-skill.mjs inspect-migrations` — live capability discovery.
- `node scripts/supaplan-skill.mjs status` — queue snapshot for planning.
- `node scripts/codex-notify.mjs callback-auto ...` — callback/notification helper.

## Domain checkpoints

- **Franchize / vip-bike:** route health, theme consistency, Telegram tap safety.
- **WB / Greenbox / Strikeball:** keep deep links stable, avoid coupling feature flags across domains.
- **Homework-maker:** OCR -> solve -> persist -> read-after-write verify -> callback with links/screenshot.
- **SupaPlan:** claim/execute/update status deterministically.

## Guardrail reminder

If task is visual and operator-facing, attach screenshot evidence (artifact link preferred; do not commit binary screenshots unless explicitly requested).
