Purpose
Create the first fully compliant plugin: Greenbox.

Tasks
- Implement plugin manifest `/app/greenbox/plugin.ts`.
- Provide layouts and pages:
  - `/greenbox`
  - `/greenbox/[slug]`
- Integrate plant simulation stats (health, water).
- Connect UI actions to `garden_actions.ts`.

Extensions
Future fake doors:
- automatic irrigation
- plant disease simulation
- AI yield optimizer

Fake doors

[ ] auto irrigation
[ ] plant disease simulation
[ ] AI gardener assistant

# Tasks

## TASK: extract telegram gateway

Goal:
Move telegram logic from monolithic action/hook/lib file into gateway module.

Steps:
1. Create `/gateway/telegram/telegram.ts`
2. Move Telegram API calls there
3. Expose a simple sendMessage() function

Success criteria:
• telegram messages still work
• greenbox module imports gateway instead of direct API