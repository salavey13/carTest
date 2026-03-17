---
name: greenbox
description: Korean-level 3D hydroponic Tamagotchi for mom — already running before you even sign up. Magic moment first.
---

# Greenbox Domain

Use this domain when you want to deliver instant Korean 3D gardening simulation that feels alive the second the user opens the app.

## Goal
1. Force the Magic Moment in <90 seconds (full living garden with jittering plants + evolving demons + voice line).
2. BEFORE any account creation, payment, or heavy decision.
3. Fake doors = genie lamps: click “pH for dummies?” or mention any plugin name → Codex spends its own token budget → link appears while user is still distracted.

## Bathroom Test (user-facing UX only)
If the user cannot feel the magic moment in the time it takes to take a shit, that UX flow fails the test.

Agent tasks in SupaPlan are separate technical steps.

## Boundaries
- Only touch files inside /app/greenbox/
- Use actions from /app/actions/greenbox.ts
- Store plants in public.cars (type='plant')
- Every feature must be requestable by a 65yo gardener via Telegram (“Codex, новый уровень: добавь полив!”).

## Iterator Mode (project-wide)
Mention any plugin name or fake door anywhere → Artificial General Iterator automatically claims and executes the matching SupaPlan task.