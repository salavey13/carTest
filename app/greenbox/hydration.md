## Context for agents + Iterator
This is the main Greenbox domain — a gamified AI Tamagotchi for hobby gardeners (dedicated to mom, 65yo).  
Everything here must feel like a Korean 3D gardening sim that’s already running when you open the app.

Core magic moment (first principles from Autopilot + Karpathy autoresearch):
- User sees a full living garden (plants jittering, demons evolving, stats changing, voice alert “ready to garden like a fucking Korean in 3D 24/360?”) in <90 seconds.
- BEFORE any account creation, payment, or heavy decision.
- Fake doors = genie lamps: click “pH for dummies?” or mention any plugin name → Codex spends its own token budget → todo.md updates → link appears while you’re still taking a shit.

Bathroom test rule (for user-facing UX only):
If the user cannot feel the magic moment / complete the UX flow in the time it takes to take a shit, that UX task fails the test.

Agent tasks in SupaPlan are separate — they are the technical steps that make the UX magic happen.

Boundaries:
- Only touch files inside /app/greenbox/
- Use actions from /app/actions/greenbox.ts
- Store plants in public.cars (type='plant')
- Magic rule: Every feature must be requestable by a 65yo gardener via Telegram (“Codex, новый уровень: добавь полив!”).

Iterator mode (now active for whole project):
Mention any plugin name or fake door anywhere → Artificial General Iterator runs automatically.