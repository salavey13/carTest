# SupaPlan

SupaPlan — оркестрационный слой для координации агентских задач в репозитории.

## Что входит в расширение
- `page.tsx`, `StatusClient.tsx` — операторская витрина `/supaplan`.
- `actions.ts` — серверные действия для отправки уведомлений.
- `skill.ts`, `SKILL.md` — runtime-контракт для внешних агентов.
- `scripts/supaplan-skill.mjs` — локальный CLI для claim/update/status/log.

## Навигация по документации
1. `EXTENSION_SPEC.md` — формализация расширения и UX-правила.
2. `MOBILE_UX_GUIDE.md` — мобильные паттерны и ограничения.
3. `ARCHITECTURE.md` — архитектурные слои.
4. `STATE.md` — аудит текущего состояния lifecycle.
5. `CODEX_USAGE.md` — практический цикл для Codex.

## Операторские активы
- Runtime API contract: `app/supaplan/SKILL.md`
- State audit + fake doors: `app/supaplan/STATE.md`
- Codex local skill runbook: `skills/supaplan-supabase-operator/SKILL.md`
- CLI helper: `scripts/supaplan-skill.mjs`
