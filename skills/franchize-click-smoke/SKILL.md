# Franchize click smoke skill

Use this skill for Telegram/mobile tap reliability checks on `/franchize/[slug]` routes.

## Goal
Quickly validate that critical tappable controls actually navigate or mutate state:
- header menu links,
- profile dropdown links,
- back-to-catalog links,
- modal `Добавить` cart path,
- floating cart link.

## Minimal flow
1. Open `/franchize/vip-bike` in mobile viewport.
2. Tap `Open menu` -> `Контакты` -> verify route changes.
3. Return to catalog and open an item modal.
4. Tap `Добавить` in modal and open floating cart.
5. Verify cart page is not empty and back link returns to catalog.
6. Save screenshot artifact for evidence.

## Fallback notes
- If Chromium crashes in container runtime, retry Firefox/WebKit.
- Prefer deterministic link selectors scoped to menu container to avoid strict-mode collisions.
- Keep one ready script per run in task notes for repeatability.
