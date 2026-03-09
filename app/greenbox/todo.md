## Purpose
Make Greenbox feel like a Korean 3D gardening sim that’s already running the second you open it — magic moment before anything else.

## Current Tasks (G1 priority — magic-moment-first edition)

### TASK: Instant 3D Korean Garden Magic Moment
Goal: User opens app → sees full living garden with jittering plants and evolving demons in <90 seconds.
Steps:
1. On /greenbox/onboarding show fake demo garden immediately (use existing Supabase demo data or seed on-the-fly).
2. Trigger first plant-jitter cycle + demon evolution animation.
3. Play voice line: “ready to garden like a fucking Korean in 3D 24/360?”
Success criteria: User feels “holy shit it’s already happening” before any button.

### TASK: Genie-Lamp Fake Doors (zero-friction info & features)
Goal: Any “for dummies” question or plugin mention instantly creates/updates todo and returns a link in 2 minutes.
Steps:
1. Add fake doors everywhere (e.g. “what the fuck is pH?” button).
2. On click/mention → Codex auto-updates the relevant todo.md (or creates new one).
3. Refresh page → magic link appears.
Examples:
- “want info for dummies what pH level the fuck is?” → creates /app/greenbox/academy/pH-todo.md → link appears.
- Mention “sim-jitter” → auto-finds and updates that todo.
Success criteria: User can grow any limb of the app while taking a shit.

### TASK: Binary Onboarding + Exclusivity Filter
Goal: Bathroom-test friendly flow with Autopilot-style exclusivity.
Steps:
1. After magic moment ask binary: “Will you grow a $100k garden this year? Yes/No” (blocks low-intent but allows override).
2. Show max 4 portfolios (Pelosi-style + Korean-efficiency + Demon-chaos + Mom-mode).
3. Auto-detect Telegram → pre-select voice alerts.
Success criteria: Onboarding completion >70% higher in A/B.

## Fake doors (genie lamps — click or mention to activate)
[ ] pH for dummies? (instant academy link)
[ ] Auto-poliv rule editor
[ ] 3D demon evolution visuals
[ ] Real ESP32 adapter toggle (hardware magic moment)

## Extensions needed from other domains
- core/registry must list "greenbox" with magic-moment flag
- gateway.telegram must support instant voice “ready to garden like a fucking Korean…”
- infrastructure/supabase must expose live jitter data

## Success metric
Time to magic moment < 90 seconds. Once they feel the Korean 3D garden already running, retention and upgrades take care of themselves.