# Team: vipbot-runtime (Шаг 2-3 PLAN)

## Цель
Перенести рантайм KLOD-BOX (пост-v0.9.5) в `src/` + `workspace/` + lean `bundled-skills/` + `scripts/`, собрать, встроить `contract-agent` в роутинг, адаптировать личность под VIP BIKE.

## Состав
- `bot-integrator` (sonnet) — rsync `src/` дословно, `npm install`, typecheck/build, исключения tsconfig.
- `state-machine` (sonnet) — `workspace/CLAUDE.template.md`: личность VIP + строка роутинга `contract-agent`; обрезка `reference/`/`skills/`.
- `code-reviewer` (sonnet) — ревью: ничего из `src/*` не изменено сверх нужного; нет marketing-плагинов; контекст лёгкий.

## Порядок
bot-integrator (копия+билд) → state-machine (роутинг+личность) → code-reviewer (ревью diff vs upstream).

## Gate
1. `npm install` ок; `npm run typecheck` 0; `npm run build` green (`dist/index.js` есть).
2. `npm run dev` стартует бот (polling) без падений (тест-токен).
3. `workspace/CLAUDE.template.md` содержит строку роутинга на `contract-agent`; `workspace/skills/contract-agent/SKILL.md` на месте (не затёрт rsync'ом).
4. `src/*` идентичен upstream (`diff -r ../../KLOD-BOX/src src` — только ожидаемое).

## Артефакты
- `src/*` (копия), `workspace/{CLAUDE.template.md, reference/, skills/, .claude/settings.template.json}`, `bundled-skills/{docx,officecli,pdf,task-planner,todo}`, `scripts/{bootstrap-vps,seed-mcp-settings,install-default-skills}.sh`.
- Запись в `progress.md`, статус в `README.md`.
