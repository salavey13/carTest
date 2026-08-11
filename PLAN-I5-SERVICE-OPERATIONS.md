# План волны — I5: Franchize Service Operations (equipment + cash ledger + commissions + salary)

> Дата: 2026-08-12 · Скоуп: `docs/FRANCHIZE_SERVICE_OPERATIONS_PRD.md` v4.1
> Рабочие программы (содержимое задач сюда НЕ дублируется — оно в планах, с тестами):
> - `docs/superpowers/plans/2026-08-12-i5-equipment-rentals.md` (5 задач)
> - `docs/superpowers/plans/2026-08-12-i5-cash-ledger.md` (7 задач)
> - `docs/superpowers/plans/2026-08-12-i5-commissions-salary.md` (6 задач)
>
> Этот план — оркестровка: кто, в каком порядке, где границы.
> Ветка волны: `feat/i5-service-operations` — всё в неё; в `main` только merge после приёмки.

---

## Этап 0 — фиксация (до тимейтов) — ✅ ЗАВЕРШЁН 2026-08-12

1. ✅ Code review leads/rentals — `CODEREVIEW_LEADS_RENTALS.md`
2. ✅ Accessories duplication устранён + todos на rentals-странице — `main @ 5437369e` (crew_todos = single source of truth)
3. ✅ `START-HERE.md` создан
4. ✅ PRD v4.1 прочитан и сверен с продом — поправки свёрнуты в Контракт ниже (PRD Review Notes в конце)
5. ✅ Ветка `feat/i5-service-operations` создана и запушена
6. ⏳ Эталон тестов переподтвердить на ветке перед Этапом 1: `npm test` зелёный. Меньше — стоп, чинить окружение, не код.

---

## Тимейты волны

| Имя | Модель | Что делает | Владеет (один писатель) |
|---|---|---|---|
| `backend-core` | sonnet | equipment-план T1–T2, cash-план T1–T4, salary-план T1–T3 | `supabase/migrations/20260812*`, `app/franchize/server-actions/{equipment-rentals,cash-transactions,commissions,salary-calculations}.ts`, `tests/franchize/{equipment-rentals,cash-transactions,commissions,salary-calculations}.spec.ts`, `tests/sql/i5_*` |
| `backend-integration` | sonnet | equipment-план T4, cash-план T5, salary-план T6 (API часть) | `app/webhook-handlers/commands/doc-manual.ts`, `app/api/franchize/**`, `tests/franchize/i5-api.spec.ts` |
| `frontend` | sonnet | equipment-план T3, cash-план T6, salary-план T4–T5 | `app/franchize/[slug]/{equipment,cash-ledger,admin/commissions,admin/salary}/**`, `app/franchize/[slug]/profile/ProfileClient.tsx`, `tests/franchize/i5-ui.spec.ts` |
| `verifier` | opus | E2E-верификация после каждого этапа | прогон всех фаз |

Базовые роли (`code-reviewer`, `security`, `test-runner`) — субагенты-гейты, не тимейты.

⛔ Тесты каждый пишет **только в своих** файлах-владениях. Файл не в твоей колонке — не трогаешь, шлёшь спеку владельцу.

---

## Контракт между слоями (зафиксирован до старта, выдан всем одним текстом)

1. **Миграции — серия `20260812000001`–`20260812000008`**, строго по порядку: `01 equipment_rentals` → `02 cash_transactions` → `03 commission_rates` → `04 salary_plans` → `05 salary_calculations` → `06 seed_equipment` → `07 cash triggers` → `08 backfill`. (PRD §2.1 предлагал `20260810000003-08` — **ОТКЛОНЕНО**: эти даты предшествуют уже применённым миграциям `20260811*`.)
2. **Каждый триггер `AFTER UPDATE OF status`**: transition guard (`OLD.status != NEW`) **+** `NOT EXISTS` idempotency guard (паттерн I1, `20260811000000_deposit_trigger_double_return_guard.sql`). Повторное закрытие аренды НЕ создаёт дублей.
3. **Комиссия в триггере**: ветвление по `commission_type` — `percentage` → `amount * value`, `fixed_amount` → `value`. (PRD §3.1 игнорировал тип — поправлено.)
4. **`cash_transactions.sale_contract_id`** создаётся в миграции `02` (backfill зависит от колонки); cross-schema FK на `private.sale_contract_artifacts` — **НЕ** делаем (Open Q5).
5. **Backfill продаж**: `JOIN public.crews ON crews.slug = s.crew_slug`. (PRD §5.2 `crew_slug::UUID` — **ОТКЛОНЕНО**, сломается: slug — текст.)
6. **Server actions**: возвращают `{ success: boolean; data?: T; error?: string }`, доступ через `supabaseAdmin`, auth — паттерн `verifyCrewAccess` из `app/franchize/server-actions/leads.ts`.
7. **API**: `app/api/franchize/[slug]/...` — Next.js dynamic segments, НЕ Express-синтаксис (PRD §4 note). Тонкие роуты → вызывают server actions, логика в actions.
8. **Изменение контракта** — только через peer-обмен с записью в отчёты обеих сторон одними словами; не сошлись за два круга — эскалация координатору.

---

## Этапы

- **Этап 1 (параллельно):** `backend-core` — equipment T1–T2 (миграция 01 + actions) и cash T1 (миграция 02); `frontend` — equipment T3 по контракту п.6 (моки ответов).
- **Этап 2 (параллельно):** `backend-core` — salary T1 (миграции 03–05), equipment T1-сид (миграция 06), cash T2–T3 (триггеры 07, backfill 08); `backend-integration` — equipment T4 (doc-manual: строки `equipment_rentals` при аренде с экипом); `frontend` — cash T6 (ledger UI по мокам).
- **Этап 3 (интеграция):** `backend-core` — cash T4 (actions) + salary T2–T3; `backend-integration` — cash T5 (API) + salary T6 (API); `frontend` — salary T4–T5 (commission config + salary/payout UI + profile «Моя работа»). Общий прогон: `npm test` + `npm run typecheck:franchize` + `npm run lint:target`.
- **Этап 4 (гейт → production):** `verifier` E2E (equipment: rent → return → cash entry; commission: config → sale → commission row; salary: payout → correct calculation) · `code-reviewer` PASS по диффу ветки · `security` по новым endpoints (только crew owner пишет? service_role не утекает?) · миграции на staging в порядке 01→08 · выкатка + смоук на проде.

---

## Definition of Done волны

- [ ] Все 18 задач трёх планов закрыты по своим шагам (каждая — тест написан → упал → прошёл → коммит)
- [ ] Миграции применены по порядку 01→08 (`supabase migration list` без « pending» середины)
- [ ] `npm test` зелёный (все существующие + новые из планов), `npm run test:e2e` зелёный
- [ ] `verifier` (свежий субагент, не автор) выдал PASS с дословным хвостом vitest в отчёте
- [ ] Прод-смоук: equipment rental → return → `cash_transactions` запись видна в ledger UI
- [ ] Прод-смоук: commission config → sale → комиссия посчитана по настроенному типу
- [ ] Прод-смоук: salary payout → расчёт совпадает с ручной сверкой (shifts + commissions)
- [ ] Re-completion регрессия: аренда completed → active → completed = ровно 1 `income_rental` (I1-паттерн)
- [ ] `START-HERE.md`, `docs/META_PRD_ITERATIVE_IMPLEMENTATION_PLAN.md`, PRD v4.1 → v4.2 (shipped-sync) обновлены
- [ ] Ветка смержена в `main` и запушена

---

## Открытые вопросы (не блокируют старт)

1. **Equipment seed** — сверх 4 позиций PRD §2.7: расширяется одной строкой INSERT, не блокирует.
2. **Default commission rates** — дефолт 10% rentals (PRD Q1); остальные типы заводятся через config UI.
3. **Base monthly salary** поверх shift income? (PRD Q2) — схема `salary_plans.base_rate` уже готова к обоим ответам.
4. **Equipment deposit** — отдельный залог за экип? (PRD Q4) — пока нет, депозит остаётся на bike-аренде.
5. **Cross-schema FK** `sale_contract_id` → `private.sale_contract_artifacts(id)` (PRD Q5) — колонка без FK.

---

## Effort

**High** на всю волну: финансовые данные, идемпотентность, RLS. Субагентам effort не наследуется — глубина задаётся моделью (всем sonnet, `architect`/`critic` при спорах).

---

## PRD Review Notes (2026-08-12, codebase-verified)

Поправки 🔴 №1–4 уже свёрнуты в Контракт (п.1, 2, 3, 5 соответственно).

**🟡 Stale в PRD v4.1 (не читать как работу):**
- §0 warning про deposit double-return — устарел: guard в `20260811000000` (NOT EXISTS на `(rental_id, destination, amount)` + одноразовый dedup).
- §6.7 «proposed `rental_photos`» — уже shipped: `20260811000001` + три hotfix-миграции.

**🟢 Verified correct в PRD:**
- `rentals.created_by_operator_chat_id` существует (`20260720120100`)
- `crew_member_shifts.member_id` — TEXT → `users(user_id)` — SQL §6.2.2 «My Work» работает
- `sale_contract_artifacts` имеет `crew_slug`, `sale_price`, `total_sum`, `resolved_bike_id`, `created_by_operator_chat_id` — backfill жизнеспособен (с фиксом контракта п.5)
- RLS `auth.jwt() ->> 'chat_id'` соответствует проду (service_role обходит; политики = defense-in-depth)

---

## Commit pattern (стандарт волны)

```
feat(equipment-rentals): table + RLS
feat(equipment-rentals): server actions
feat(equipment): catalog + rental UI
feat(cash-transactions): table + daily_cash_flow view
feat(cash-transactions): auto-transaction triggers (idempotent)
feat(cash-transactions): backfill rentals + sales
feat(cash-ledger): server actions + API
feat(commissions): table + seed + config actions
feat(salary): plans + calculations + payout
integration: doc-manual equipment_rentals rows
feat(profile): My Earnings + My Work sections
test: E2E I5 flows
```
