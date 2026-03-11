# /app/greenbox — new extension (Greenbox core)

Purpose
Create Greenbox as extension from day one — simulation + minimal UI.

Phase 1 tasks
- [ ] /app/greenbox/plugin.ts (manifest with capabilities: simulation.plants, ui.greenbox)
- [ ] /app/greenbox/hydration.md (what it is, how to extend safely)
- [ ] /app/greenbox/CONTRACT.md (stable API: createGarden(), seedGarden(), getPlants())
- [ ] /app/greenbox/page.tsx and /app/greenbox/layout.tsx (onboarding + root)
- [ ] Implement server actions: createGardenAction, seedGardenAction in /app/core/garden_actions.ts and UI hooks to call them
- [ ] Add TODO fake doors: auto irrigation, plant disease sim, AI gardener assistant (each as TASK entries)

Phase 2 (sim)
- [ ] Create sim plugin: /app/greenbox/sim-jitter/todo.md — edge function plant-jitter, events -> core/events
- [ ] Add UI controls for simulator (one big ON/OFF switch called "Chaos Mode")

Notes
- Make all UI texts RU-first and big-font for grandma usability.