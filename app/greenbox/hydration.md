## Context for agents
This is the main Greenbox domain — a gamified AI Tamagotchi for hobby gardeners (dedicated to mom, 65yo).  
Everything here must feel like a Korean 3D gardening sim that’s already running when you open the app.

Core magic moment (first principles from Autopilot transcript):
- User sees a full living garden (plants jittering, demons evolving, stats changing, voice alert “ready to garden like a fucking Korean in 3D 24/360?”) in <90 seconds.
- BEFORE any account creation, payment, or heavy decision.
- Fake doors = genie lamps: click “pH for dummies?” or say the plugin name → Codex spends its own token budget → todo.md updates → link appears while you’re still taking a shit.

Bathroom test rule: If you can’t grow a new limb of the app in the time it takes to take a shit, it’s too slow.

Boundaries:
- Only touch files inside /app/greenbox/
- Use actions from /app/actions/greenbox.ts
- Store plants in public.cars (type='plant')
- Magic rule: Every feature must be requestable by a 65yo gardener via Telegram (“Codex, новый уровень: добавь полив!”).