# BOOTSTRAP.md — Global Session Warmup

Scope: whole repository.

Use at the beginning of broad "continue/do next/ебаш" requests.

## 1) Fast orientation

1. Read `AGENTS.md` (root).
2. Check SupaPlan capabilities/tasks:
   - `node scripts/supaplan-skill.mjs inspect-migrations`
   - `node scripts/supaplan-skill.mjs status`
3. Map request to domain (`franchize`, `wb`, `greenbox`, `strikeball`, `homework`, infra).

## 2) Trigger interpretation

- `FRANCHEEZEPLAN` / `franchize` / `vip-bike` / `франшиза` -> route through franchize execution diary + ordered tasks.
- `SupaPlan` / `pick-task` / `continue` / `ебаш` -> claim-first mode unless operator gives precise custom scope.
- Homework photo/screenshot context -> CyberTutor autopilot chain.

## 3) Execution default

- smallest reversible patch first;
- run targeted checks early;
- update docs/tracker/status with concrete evidence;
- commit + PR + callback workflow when applicable.
