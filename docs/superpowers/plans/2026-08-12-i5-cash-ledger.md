# I5: Unified Cash Ledger — Implementation Plan

> **For agentic workers:** implement task-by-task. Owner: `backend-core` (T1–T4), `backend-integration` (T5), `frontend` (T6), all (T7). Wave contract: `PLAN-I5-SERVICE-OPERATIONS.md` — читать до старта. Зависимости: `commission_rates` (salary-план T1, миграция 03) нужна триггерам T2 — порядок миграций фиксирован контрактом п.1.

**Goal:** Единая касса экипажа: доходы (аренды, продажи, сервис, экип), расходы (комиссии, зарплаты, возвраты залогов, прочее) — одной таблицей `cash_transactions` + дневной отчёт. Сейчас деньги размазаны по `rentals.total_cost`, `sale_contract_artifacts.sale_price`, `deposit_log`, `crew_member_shifts.salary_amount`.

**Architecture:** Одна таблица-ledger с nullable FK на источники (rental / sale / equipment_rental / salary_calc). Триггеры пишут доход автоматически при переходах статусов — **идемпотентно** (transition guard + NOT EXISTS, паттерн I1). `deposit_log` не трогаем (backward compat), `deposit_entries` живёт своей жизнью. `sale_contract_id` — колонка без cross-schema FK (контракт п.4).

**Tech Stack:** Supabase (Postgres, `supabaseAdmin`), Next.js API routes, vitest.

## Global Constraints

- Триггеры: `OLD.status IS DISTINCT FROM NEW.status`-переход + `NOT EXISTS` на `(source_id, transaction_type)`. Re-completion = 0 новых строк.
- Комиссия: ветвление `commission_type` — `percentage` → `amount * value / 100` ⚠️ PRD хранит 0.10 как долю; **решение волны: хранить проценты как число 10 = 10%**, делить на 100 в триггере. `fixed_amount` → `value` напрямую. (Единообразие с UI «10%».)
- Backfill: те же `NOT EXISTS`-guards, что в триггерах — backfill можно гонять повторно.
- Server actions → `{ success, data?, error? }`; API routes тонкие → вызывают actions.
- Мок-провайдеры отказывают, а не притворяются успехом (sfera rule): ручной ввод транзакции без `amount > 0` → 400.
- Тесты SQL — `tests/sql/i5_cash_ledger_regression.sql`; TS — `tests/franchize/cash-transactions.spec.ts`, API — `tests/franchize/i5-api.spec.ts`.

---

### Task 1: Таблица `cash_transactions` + view `daily_cash_flow`

**Files:**
- Create: `supabase/migrations/20260812000002_create_cash_transactions.sql`
- Test: `tests/sql/i5_cash_ledger_regression.sql`

**Interfaces:**
- Produces: `public.cash_transactions` (вкл. `sale_contract_id UUID` БЕЗ FK), view `public.daily_cash_flow`, RLS (members read / owner write).

- [ ] **Step 1: Регрессионный SQL (упадёт — таблицы нет)**

```sql
-- tests/sql/i5_cash_ledger_regression.sql
-- 1) Колонки (включая sale_contract_id — контракт п.4)
SELECT count(*) FROM information_schema.columns
WHERE table_schema='public' AND table_name='cash_transactions'
  AND column_name IN ('id','crew_id','rental_id','sale_contract_id','equipment_rental_id',
    'salary_calc_id','transaction_type','amount','flow_direction','payment_method',
    'from_user_id','to_user_id','category','description','transaction_date','created_by','created_at');
-- Expected: 1 (count = 17)

-- 2) CHECK на тип и направление
INSERT INTO public.cash_transactions (crew_id, transaction_type, amount, flow_direction)
VALUES ((SELECT id FROM crews LIMIT 1), 'income_magic', 100, 'in');
-- Expected: ERROR — check violation

-- 3) View агрегирует
SELECT * FROM public.daily_cash_flow LIMIT 1;
-- Expected: выполняется (0+ строк — ок)
```

- [ ] **Step 2: Прогнать на staging → FAIL** (`relation "public.cash_transactions" does not exist`)

- [ ] **Step 3: Миграция** — DDL по PRD §2.3 с двумя правками: `sale_contract_id UUID` добавлен сразу (без FK); все `CREATE INDEX` с `IF NOT EXISTS`, политики с `DROP POLICY IF EXISTS` перед `CREATE POLICY`. View `daily_cash_flow` — `CREATE OR REPLACE` (PRD §2.3, без изменений).

- [ ] **Step 4: Применить, прогнать Step 1 → PASS**

- [ ] **Step 5: Коммит**

```bash
git add supabase/migrations/20260812000002_create_cash_transactions.sql tests/sql/i5_cash_ledger_regression.sql
git commit -m "feat(cash-transactions): table + daily_cash_flow view"
```

---

### Task 2: Триггеры автозаписи (rental / sale / equipment)

**Files:**
- Create: `supabase/migrations/20260812000007_cash_transaction_triggers.sql`
- Test: `tests/sql/i5_cash_ledger_regression.sql` (дописать секцию триггеров)

**Interfaces:**
- Consumes: `cash_transactions` (T1), `commission_rates` (миграция 03 — применена раньше по контракту), `equipment_rentals` (миграция 01)
- Produces: `auto_create_rental_transaction()`, `auto_create_sale_transaction()`, `auto_create_equipment_transaction()` + 3 триггера

- [ ] **Step 1: Регрессионный SQL — идемпотентность (упадёт: функций нет)**

```sql
-- Секция триггеров в tests/sql/i5_cash_ledger_regression.sql
-- a) Взять тестовую аренду с total_cost > 0, crew_id NOT NULL:
--    UPDATE rentals SET status='completed' WHERE rental_id='<test>'; → 1 строка income_rental
--    UPDATE rentals SET status='active'    WHERE rental_id='<test>';
--    UPDATE rentals SET status='completed' WHERE rental_id='<test>'; → ВСЁ ЕЩЁ 1 строка
SELECT count(*) FROM public.cash_transactions
WHERE rental_id='<test>' AND transaction_type='income_rental';
-- Expected: 1 (не 2!)

-- b) Комиссия percentage: crew с rate (rental_hourly, percentage, 10)
--    → на completed аренде 10000₽ есть expense_commission = 1000
-- c) Комиссия fixed_amount: rate (rental_hourly, fixed_amount, 500) → expense_commission = 500
-- d) Sale: INSERT в private.sale_contract_artifacts → income_sale с crew_id через JOIN crews ON slug
```

- [ ] **Step 2: Прогнать → FAIL** (`function auto_create_rental_transaction() does not exist`)

- [ ] **Step 3: Миграция триггеров** (ключевые отличия от PRD §3.1 — guards + ветвление типа комиссии):

```sql
CREATE OR REPLACE FUNCTION public.auto_create_rental_transaction()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE
  v_crew_id UUID; v_manager_id TEXT;
  v_comm_type TEXT; v_comm_value NUMERIC; v_commission NUMERIC;
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'completed') THEN
    v_crew_id := NEW.crew_id;
    IF v_crew_id IS NULL THEN RETURN NEW; END IF;

    -- Idempotency (I1 pattern): повторное закрытие не плодит строки
    IF NOT EXISTS (SELECT 1 FROM public.cash_transactions
                   WHERE rental_id = NEW.rental_id AND transaction_type = 'income_rental') THEN
      INSERT INTO public.cash_transactions (
        crew_id, rental_id, transaction_type, amount, flow_direction,
        payment_method, category, description, transaction_date, created_by
      ) VALUES (
        v_crew_id, NEW.rental_id, 'income_rental', COALESCE(NEW.total_cost, 0), 'in',
        COALESCE(NEW.metadata->>'payment_method', 'cash'), 'Аренда',
        'Аренда ' || COALESCE((SELECT model FROM public.cars WHERE id = NEW.vehicle_id), ''),
        now(), COALESCE(NEW.created_by_operator_chat_id, NEW.owner_id, 'system'));
    END IF;

    -- Комиссия: ветвление по типу (контракт п.3)
    SELECT commission_type, commission_value INTO v_comm_type, v_comm_value
    FROM public.commission_rates
    WHERE crew_id = v_crew_id AND operation_type = 'rental_hourly' AND is_active = true
    ORDER BY priority DESC LIMIT 1;

    IF v_comm_type IS NOT NULL AND NEW.total_cost > 0 THEN
      v_commission := CASE v_comm_type
        WHEN 'percentage'   THEN NEW.total_cost * v_comm_value / 100
        WHEN 'fixed_amount' THEN v_comm_value
      END;
      SELECT owner_id INTO v_manager_id FROM public.crews WHERE id = v_crew_id;
      IF v_manager_id IS NOT NULL AND v_commission > 0
         AND NOT EXISTS (SELECT 1 FROM public.cash_transactions
                         WHERE rental_id = NEW.rental_id AND transaction_type = 'expense_commission') THEN
        INSERT INTO public.cash_transactions (
          crew_id, rental_id, transaction_type, amount, flow_direction,
          payment_method, category, description, transaction_date,
          from_user_id, to_user_id, created_by
        ) VALUES (
          v_crew_id, NEW.rental_id, 'expense_commission', v_commission, 'out',
          'cash', 'Комиссия',
          'Комиссия за аренду ' || SUBSTRING(NEW.rental_id::TEXT FROM 1 FOR 8),
          now(), NEW.user_id, v_manager_id,
          COALESCE(NEW.created_by_operator_chat_id, 'system'));
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_auto_rental_transaction ON public.rentals;
CREATE TRIGGER trg_auto_rental_transaction
  AFTER UPDATE OF status ON public.rentals
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_rental_transaction();
```

Sale-триггер — `AFTER INSERT ON private.sale_contract_artifacts`: `crew_id` через `SELECT id INTO v_crew_id FROM public.crews WHERE slug = NEW.crew_slug` (контракт п.5), `transaction_type='income_sale'`, `sale_contract_id = NEW.id`, NOT EXISTS на `(sale_contract_id, 'income_sale')`. Equipment-триггер — `AFTER UPDATE OF status ON public.equipment_rentals` при переходе в `'returned'`: `income_equipment` с `equipment_rental_id`, NOT EXISTS аналогично.

`GRANT EXECUTE … TO service_role` на все три функции.

- [ ] **Step 4: Применить, прогнать Step 1 → PASS** (все 4 кейса: a–d)

- [ ] **Step 5: Коммит**

```bash
git add supabase/migrations/20260812000007_cash_transaction_triggers.sql tests/sql/i5_cash_ledger_regression.sql
git commit -m "feat(cash-transactions): auto-transaction triggers (idempotent)"
```

---

### Task 3: Backfill существующих аренд и продаж

**Files:**
- Create: `supabase/migrations/20260812000008_backfill_cash_transactions.sql`
- Test: `tests/sql/i5_cash_ledger_regression.sql` (секция backfill)

**Interfaces:**
- Consumes: `rentals` (status completed/active), `private.sale_contract_artifacts`
- Produces: строки `income_rental` / `income_sale` для истории; повторный запуск = 0 новых строк

- [ ] **Step 1: Регрессионный SQL**

```sql
-- Секция backfill
-- 1) Полнота: каждая completed/active аренда с crew_id имеет income_rental
SELECT count(*) FROM public.rentals r
WHERE r.status IN ('completed','active') AND r.crew_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.cash_transactions ct
                  WHERE ct.rental_id = r.rental_id AND ct.transaction_type='income_rental');
-- Expected: 0

-- 2) Продажи покрыты (crew_slug → crews JOIN)
SELECT count(*) FROM private.sale_contract_artifacts s
JOIN public.crews c ON c.slug = s.crew_slug
WHERE NOT EXISTS (SELECT 1 FROM public.cash_transactions ct
                  WHERE ct.sale_contract_id = s.id AND ct.transaction_type='income_sale');
-- Expected: 0

-- 3) Идемпотентность: повторный прогон миграции не меняет count(*)
SELECT count(*) FROM public.cash_transactions; -- записать, прогнать миграцию ещё раз, сравнить
```

- [ ] **Step 2: Прогнать → FAIL** (строки > 0 в запросах 1–2)

- [ ] **Step 3: Миграция** — PRD §5.1 как есть (guard уже есть); §5.2 **с фиксом контракта п.5**:

```sql
INSERT INTO public.cash_transactions (
  crew_id, sale_contract_id, transaction_type, amount, flow_direction,
  payment_method, category, description, transaction_date, created_by
)
SELECT
  c.id, s.id, 'income_sale',
  COALESCE(s.total_sum, NULLIF(REPLACE(s.sale_price, ' ', ''), '')::NUMERIC, 0), 'in',
  'cash', 'Продажа',
  'Продажа ' || COALESCE((SELECT model FROM public.cars WHERE id = s.resolved_bike_id), ''),
  s.created_at, COALESCE(s.created_by_operator_chat_id, 'system')
FROM private.sale_contract_artifacts s
JOIN public.crews c ON c.slug = s.crew_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.cash_transactions ct
  WHERE ct.sale_contract_id = s.id AND ct.transaction_type = 'income_sale'
);
```

- [ ] **Step 4: Применить, прогнать Step 1 → PASS**

- [ ] **Step 5: Коммит**

```bash
git add supabase/migrations/20260812000008_backfill_cash_transactions.sql tests/sql/i5_cash_ledger_regression.sql
git commit -m "feat(cash-transactions): backfill rentals + sales"
```

---

### Task 4: Server actions кассы

**Files:**
- Create: `app/franchize/server-actions/cash-transactions.ts`
- Test: `tests/franchize/cash-transactions.spec.ts`

**Interfaces:**
- Produces:
  - `getCashTransactions({ slug, actorUserId, from?, to?, transactionType? })` → строки + итоги `{ totalIn, totalOut, net }`
  - `createManualCashTransaction({ slug, actorUserId, transactionType, amount, paymentMethod?, category?, description? })` — только owner/admin; `amount > 0` обязателен, иначе отказ (sfera rule)
  - `getDailyCashReport({ slug, actorUserId, date })` → view `daily_cash_flow` + детальные строки дня

- [ ] **Step 1: Падающий тест** — 4 кейса: фильтр по датам проброшен в query; manual с `amount=0` → `success:false`; manual от не-owner → отказ; daily report группирует in/out/net.

- [ ] **Step 2: Прогнать → FAIL** (модуль не найден)

- [ ] **Step 3: Реализовать** (verifyCrewAccess-паттерн; `flow_direction` выводится из префикса `transaction_type`: `income_*` → `in`, `expense_*` → `out`)

- [ ] **Step 4: Прогнать → PASS** + `npm run typecheck:franchize`

- [ ] **Step 5: Коммит**

```bash
git add app/franchize/server-actions/cash-transactions.ts tests/franchize/cash-transactions.spec.ts
git commit -m "feat(cash-ledger): server actions"
```

---

### Task 5: API endpoints

**Files:**
- Create: `app/api/franchize/[slug]/cash-transactions/route.ts` (GET список / POST manual)
- Create: `app/api/franchize/[slug]/dashboard/daily-report/route.ts` (GET `?date=YYYY-MM-DD`)
- Test: `tests/franchize/i5-api.spec.ts` (секция cash API)

**Interfaces:**
- Consumes: actions из T4
- Produces: `GET …/cash-transactions?from&to&type` → `{ success, data }`; `POST` тело `{ transactionType, amount, … }` → 400 на `amount<=0`; daily-report → `{ date, totalIn, totalOut, net, transactions[] }`

- [ ] **Step 1: Падающий тест** — POST без amount → 400; GET без auth → ошибка доступа; daily-report возвращает net = in − out.

- [ ] **Step 2: Прогнать → FAIL** (404)

- [ ] **Step 3: Реализовать** — тонкие роуты: parse params → call action → `NextResponse.json`. Auth — через `actorUserId` в query/body (как существующие franchize routes; verify внутри action).

- [ ] **Step 4: Прогнать → PASS** + `npm run lint:target`

- [ ] **Step 5: Коммит**

```bash
git add "app/api/franchize/[slug]/cash-transactions" "app/api/franchize/[slug]/dashboard" tests/franchize/i5-api.spec.ts
git commit -m "feat(cash-ledger): API endpoints"
```

---

### Task 6: Cash ledger UI

**Files:**
- Create: `app/franchize/[slug]/cash-ledger/page.tsx`, `CashLedgerClient.tsx`
- Test: `tests/franchize/i5-ui.spec.ts` (секция cash-ledger)

**Interfaces:**
- Consumes: `getCashTransactions`, `getDailyCashReport`, `createManualCashTransaction` (T4)

- [ ] **Step 1: Падающий тест** — сводка показывает in/out/net; фильтр по типу перезапрашивает; форма ручной записи с amount=0 → кнопка disabled / ошибка; не-owner не видит форму.

- [ ] **Step 2: Прогнать → FAIL**

- [ ] **Step 3: Собрать страницу** — сводка дня (in/out/net карточки), таблица транзакций (дата, категория, описание, сумма со знаком, метод), фильтры (период, тип), форма «+ Запись» (только owner/admin). Тема — `useCrewTokens`.

- [ ] **Step 4: Прогнать → PASS** + `npm run lint:target`

- [ ] **Step 5: Коммит**

```bash
git add "app/franchize/[slug]/cash-ledger" tests/franchize/i5-ui.spec.ts
git commit -m "feat(cash-ledger): ledger UI + daily report"
```

---

### Task 7: Документация и гейт

- [ ] **Step 1: Полный прогон** — `npm test`, `npm run typecheck:franchize`, `npm run lint:target` → зелёные
- [ ] **Step 2: `verifier` E2E** — completed rental → income_rental; re-completion → всё ещё 1 строка; sale → income_sale; equipment return → income_equipment
- [ ] **Step 3: Обновить `START-HERE.md` + META_PRD чекбоксы, коммит `docs(i5): cash ledger — статус`**

---

## Проверка плана

**Покрытие PRD:** §2.3 таблица — T1 · §3.1–3.3 триггеры — T2 (с поправками контракта п.2–3) · §5 backfill — T3 (с фиксом п.5) · §4.2/4.3 API — T5 · Success metrics «100% completions auto-create» — гейт T7 Step 2.

**Не входит:** комиссии как настройка (UI) — salary-план T4; зарплатные `expense_salary` строки — salary-план T3/T6; `deposit_entries` ↔ ledger кросс-референс — post-I5.
