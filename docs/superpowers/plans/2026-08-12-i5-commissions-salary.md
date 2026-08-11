# I5: Commission Rates + Salary Plans & Payouts — Implementation Plan

> **For agentic workers:** implement task-by-task. Owner: `backend-core` (T1–T3), `frontend` (T4–T5), `backend-integration` (T6). Wave contract: `PLAN-I5-SERVICE-OPERATIONS.md` — читать до старта. Зависимости: `cash_transactions` (cash-план T1) нужна salary-расчётам T3 (комиссии из ledger).

**Goal:** Настраиваемые комиссии за операции (аренда/продажа/сервис/экип) + зарплатные планы с циклом выплат 10/25: расчёт периода = смены (`crew_member_shifts.salary_amount`) + комиссии (`cash_transactions`) + бонусы, с `balance_due` и фиксацией выплат.

**Architecture:** `commission_rates` — per-crew per-operation с `priority` (выше = главнее) и `is_active`. Триггеры cash-ledger читают их (cash-план T2). `salary_plans` — период + generated totals; `salary_calculations` — строка на выплату (payout_date = 10 или 25). Выплата = `expense_salary` в `cash_transactions` → ledger всегда сходится.

**Tech Stack:** Supabase, Next.js, vitest.

## Global Constraints

- Проценты хранятся как число (`10` = 10%), триггер делит на 100 (контракт cash-плана).
- `commission_value ≤ 100` для `percentage` — CHECK в БД + валидация в UI.
- Расчёт зарплаты НЕ мутирует `crew_member_shifts` — только читает.
- Payout — идемпотентен: повторный вызов на тот же `salary_calc_id` не создаёт вторую `expense_salary` (NOT EXISTS по `(salary_calc_id, transaction_type)`).
- Server actions → `{ success, data?, error? }`; тесты — `tests/franchize/commissions.spec.ts`, `tests/franchize/salary-calculations.spec.ts`.

---

### Task 1: Миграции `commission_rates`, `salary_plans`, `salary_calculations` + сид ставок

**Files:**
- Create: `supabase/migrations/20260812000003_create_commission_rates.sql`
- Create: `supabase/migrations/20260812000004_create_salary_plans.sql`
- Create: `supabase/migrations/20260812000005_create_salary_calculations.sql`
- Test: `tests/sql/i5_salary_commissions_regression.sql`

**Interfaces:**
- Produces: три таблицы по PRD §2.4–2.6 + сид: каждому существующему экипажу `(rental_hourly, percentage, 10, priority 0)` — `ON CONFLICT DO NOTHING`.

- [ ] **Step 1: Регрессионный SQL (упадёт — таблиц нет)**

```sql
-- tests/sql/i5_salary_commissions_regression.sql
-- 1) Таблицы существуют
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('commission_rates','salary_plans','salary_calculations');
-- Expected: 3 строки

-- 2) percentage > 100 отклоняется
INSERT INTO public.commission_rates (crew_id, operation_type, commission_type, commission_value)
VALUES ((SELECT id FROM crews LIMIT 1), 'rental_hourly', 'percentage', 150);
-- Expected: ERROR — check violation

-- 3) Сид: у каждого экипажа есть дефолтная ставка
SELECT c.id FROM public.crews c
WHERE NOT EXISTS (SELECT 1 FROM public.commission_rates r
                  WHERE r.crew_id = c.id AND r.operation_type='rental_hourly');
-- Expected: 0 строк

-- 4) Generated columns считаются
-- INSERT salary_plans с total_shift_income=1000, total_commissions=500 → total_accrued=1500
```

- [ ] **Step 2: Прогнать → FAIL** (`relation … does not exist`)

- [ ] **Step 3: Миграции** — DDL по PRD §2.4–2.6 с правками: `IF NOT EXISTS`/`DROP POLICY IF EXISTS`; в `commission_rates` добавить `CHECK (commission_type != 'percentage' OR commission_value <= 100)`; сид:

```sql
INSERT INTO public.commission_rates (crew_id, operation_type, commission_type, commission_value, priority)
SELECT id, 'rental_hourly', 'percentage', 10, 0 FROM public.crews
ON CONFLICT (crew_id, operation_type, priority) DO NOTHING;
```

- [ ] **Step 4: Применить, прогнать Step 1 → PASS**

- [ ] **Step 5: Коммит**

```bash
git add supabase/migrations/20260812000003_create_commission_rates.sql supabase/migrations/20260812000004_create_salary_plans.sql supabase/migrations/20260812000005_create_salary_calculations.sql tests/sql/i5_salary_commissions_regression.sql
git commit -m "feat(commissions): table + seed data" -m "feat(salary): plans + calculations tables"
```

---

### Task 2: Server actions комиссий

**Files:**
- Create: `app/franchize/server-actions/commissions.ts`
- Test: `tests/franchize/commissions.spec.ts`

**Interfaces:**
- Produces:
  - `getCommissionRates({ slug, actorUserId })` → все ставки экипажа
  - `upsertCommissionRate({ slug, actorUserId, operationType, commissionType, commissionValue, priority? })` — только owner; `percentage > 100` → отказ; upsert по `(crew_id, operation_type, priority)`
  - `deactivateCommissionRate({ slug, actorUserId, id })` → `is_active=false` (не удаляем — история триггеров ссылается по смыслу)

- [ ] **Step 1: Падающий тест** — 4 кейса: owner может upsert; не-owner → отказ; `percentage=150` → `success:false`; upsert с тем же `(operation_type, priority)` обновляет, а не дублирует.

- [ ] **Step 2: Прогнать → FAIL** (модуль не найден)

- [ ] **Step 3: Реализовать**

- [ ] **Step 4: Прогнать → PASS** + `npm run typecheck:franchize`

- [ ] **Step 5: Коммит** — `git commit -m "feat(commissions): config server actions"`

---

### Task 3: Server actions зарплаты (расчёт периода + payout)

**Files:**
- Create: `app/franchize/server-actions/salary-calculations.ts`
- Test: `tests/franchize/salary-calculations.spec.ts`

**Interfaces:**
- Consumes: `crew_member_shifts.salary_amount`, `cash_transactions` (комиссии `to_user_id`), `salary_plans`, `salary_calculations`
- Produces:
  - `getOrCreateSalaryPlan({ slug, actorUserId, memberId, periodStart, periodEnd })` → план (создаёт с `payout_schedule=['10','25']`, если нет)
  - `calculateSalaryForPeriod({ slug, actorUserId, memberId, periodStart, periodEnd })` → `{ shiftIncome, commissionIncome, bonusIncome, totalIncome, breakdown[] }`; комиссии = `cash_transactions WHERE to_user_id = member.user_id AND transaction_type='expense_commission' AND transaction_date в периоде`
  - `recordPayout({ slug, actorUserId, salaryCalcId })` — только owner; создаёт `expense_salary` в `cash_transactions` (с `salary_calc_id`), ставит `payout_status='paid'`, `paid_at`; **идемпотентно** (Global Constraint)
  - `getMyEarnings({ slug, actorUserId })` → для profile: текущий план (accrued/balance), ближайшая дата выплаты (10/25), последние комиссии

- [ ] **Step 1: Падающий тест** — 5 кейсов: расчёт суммирует shifts + commissions; двойной `recordPayout` → одна `expense_salary`; payout от не-owner → отказ; `getMyEarnings` считает next payout date (сегодня 12.08 → 25.08; сегодня 25.08 → 10.09); план создаётся один раз (unique per member+period).

- [ ] **Step 2: Прогнать → FAIL**

- [ ] **Step 3: Реализовать**

- [ ] **Step 4: Прогнать → PASS** + `npm run typecheck:franchize`

- [ ] **Step 5: Коммит** — `git commit -m "feat(salary): calculation + payout server actions"`

---

### Task 4: UI настройки комиссий (owner admin)

**Files:**
- Create: `app/franchize/[slug]/admin/commissions/page.tsx`, `CommissionsClient.tsx`
- Test: `tests/franchize/i5-ui.spec.ts` (секция commissions)

**Interfaces:**
- Consumes: `getCommissionRates`, `upsertCommissionRate`, `deactivateCommissionRate` (T2)

- [ ] **Step 1: Падающий тест** — таблица ставок рендерится; форма: тип операции (select), тип (%/фикс), значение; `percentage=150` → inline-ошибка, запрос НЕ отправлен; deactivate → confirm.

- [ ] **Step 2: Прогнать → FAIL**

- [ ] **Step 3: Собрать страницу** — таблица активных ставок + форма добавления/правки + деактивация. Только для owner (скрыть форму иначе — и API тоже закрыт, T2).

- [ ] **Step 4: Прогнать → PASS** + `npm run lint:target`

- [ ] **Step 5: Коммит** — `git commit -m "feat(commissions): config UI"`

---

### Task 5: Salary UI + profile «Мои начисления» / «Моя работа»

**Files:**
- Create: `app/franchize/[slug]/admin/salary/page.tsx`, `SalaryClient.tsx` (owner: планы, расчёты, кнопка «Выплатить»)
- Modify: `app/franchize/[slug]/profile/ProfileClient.tsx` (два новых блока)
- Create: `app/franchize/server-actions/my-work.ts` — `getMyWorkTodayAction({ userId, slug })` ⚠️ файл в колонке backend-core — frontend шлёт спеку, backend-core создаёт (peer-контракт п.8)
- Test: `tests/franchize/i5-ui.spec.ts` (секция salary+profile), `tests/franchize/salary-calculations.spec.ts` (my-work кейсы)

**Interfaces:**
- Consumes: T3 actions; `getMyWorkTodayAction` по типу `MyWorkToday` из PRD §6.2.2
- Produces: owner видит планы/выплаты; member видит свои начисления и работу за день

- [ ] **Step 1: Падающий тест** — profile рендерит accrued/balance/next payout; «Моя работа» группирует rentals/sales/service за сегодня (Europe/Moscow); owner-кнопка «Выплатить» вызывает `recordPayout` и блокируется после успеха.

- [ ] **Step 2: Прогнать → FAIL**

- [ ] **Step 3: Реализовать** — SQL-паттерны PRD §6.2.2 (member_id — TEXT, verified). Даты считать в таймзоне `Europe/Moscow` (как в существующих dashboard-запросах).

- [ ] **Step 4: Прогнать → PASS** + `npm run lint:target` + `npm run typecheck:franchize`

- [ ] **Step 5: Коммит** — `git commit -m "feat(profile): My Earnings + My Work sections"` (+ `feat(salary): payout UI`)

---

### Task 6: Salary API + документация и гейт

**Files:**
- Create: `app/api/franchize/[slug]/salary/[memberId]/route.ts` (GET `?from&to` → расчёт периода, PRD §4.4)
- Modify: `START-HERE.md`, `docs/META_PRD_ITERATIVE_IMPLEMENTATION_PLAN.md`
- Test: `tests/franchize/i5-api.spec.ts` (секция salary API)

- [ ] **Step 1: Падающий тест** — GET без from/to → текущий период; чужой member без прав owner → отказ; ответ содержит breakdown.

- [ ] **Step 2: Прогнать → FAIL** (404)

- [ ] **Step 3: Реализовать тонкий роут** → `calculateSalaryForPeriod`

- [ ] **Step 4: Прогнать → PASS**

- [ ] **Step 5: Гейт** — `verifier`: настроить ставку 10% → продажа/аренда → комиссия в ledger; расчёт периода сходится с ручной сверкой; payout → `expense_salary` + balance_due=0; повторный payout → отказ/no-op

- [ ] **Step 6: Коммит** — `git commit -m "feat(salary): payout API" -m "docs(i5): commissions + salary — статус"`

---

## Проверка плана

**Покрытие PRD:** §2.4–2.6 таблицы — T1 · комиссия в триггерах — cash-план T2 (ставки отсюда, T1) · §4.4 salary API — T6 · §6.2 profile «My Earnings»/«My Work» — T5 · §6.3 crew members salary summary — T5 (admin/salary страница) · payout 10/25 — T1 (default schedule) + T3 (next-date логика).

**Не входит:** автоматический запуск расчёта по расписанию (cron на 10/25) — post-I5, сейчас расчёт по кнопке/API; base monthly salary — Open Q3 волнового плана.
