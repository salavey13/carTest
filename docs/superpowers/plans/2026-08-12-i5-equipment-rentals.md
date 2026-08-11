# I5: Standalone Equipment Rentals — Implementation Plan

> **For agentic workers:** implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Owner: `backend-core` (T1–T2), `frontend` (T3), `backend-integration` (T4), all (T5). Wave contract: `PLAN-I5-SERVICE-OPERATIONS.md` — читать до старта.

**Goal:** Шлемы/куртки/перчатки можно сдавать отдельно от байка — со своей таблицей, ценой, статусом и возвратом. Сейчас экип существует только как «приложение к байку» в `DocFlowContext` и теряется после генерации договора.

**Architecture:** Экип — это строки `cars` с `type='equipment'` (переиспользуем каталог, новых сущностей-предметов не заводим). Аренда экипа — `public.equipment_rentals` с опциональной ссылкой `primary_rental_id` на bike-аренду (NULL = standalone). Деньги по возврату пишет cash-ledger триггер (план `2026-08-12-i5-cash-ledger.md`, T2) — здесь только статусная модель.

**Tech Stack:** Supabase (Postgres, `supabaseAdmin` service_role), Next.js App Router, vitest.

## Global Constraints

- Миграции additive: `IF NOT EXISTS` / `IF EXISTS`, `ON CONFLICT DO NOTHING`. Серия `20260812*` — порядок из волнового контракта п.1.
- RLS: `auth.jwt() ->> 'chat_id'` (TEXT), НЕ `auth.uid()`. Политики — defense-in-depth; доступ в коде через `supabaseAdmin`.
- Server actions возвращают `{ success: boolean; data?: T; error?: string }`.
- Auth в actions — паттерн `verifyCrewAccess` (см. `app/franchize/server-actions/leads.ts`).
- Тесты: `npx vitest run tests/franchize/equipment-rentals.spec.ts`. Моки — `vi.hoisted` + `vi.mock('@/lib/supabase-server')` (стиль `tests/franchize/deposit-entries.spec.ts`).
- Перед коммитом: `npm run typecheck:franchize` и `npm run lint:target` чистые по изменённым файлам.
- Эмодзи в UI-компонентах — только в текстовых строках данных (титлы туду), не в вёрстке-кнопках; иконки — lucide.

---

### Task 1: Таблица `equipment_rentals` + RLS

**Files:**
- Create: `supabase/migrations/20260812000001_create_equipment_rentals.sql`
- Test: `tests/sql/i5_equipment_rentals_regression.sql`

**Interfaces:**
- Produces: таблица `public.equipment_rentals` (контракт PRD §2.2), политики SELECT (crew members) / ALL (crew owner).

- [ ] **Step 1: Написать регрессионный SQL (упадёт — таблицы нет)**

```sql
-- tests/sql/i5_equipment_rentals_regression.sql
-- Прогон в Supabase SQL editor на staging ПОСЛЕ применения миграции.
-- 1) Таблица и колонки
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'equipment_rentals'
  AND column_name IN ('id','crew_id','equipment_id','renter_user_id','primary_rental_id',
                      'start_date','end_date','expected_return_date','daily_price','total_cost',
                      'status','issued_by','received_by','issued_at','returned_at','condition_notes',
                      'created_by','created_at','updated_at');
-- Expected: 19 строк

-- 2) Статусный CHECK отклоняет мусор
INSERT INTO public.equipment_rentals (crew_id, equipment_id, status)
VALUES ((SELECT id FROM crews LIMIT 1), 'equip-helmet-l', 'banana');
-- Expected: ERROR — check constraint violation

-- 3) FK на cars работает
INSERT INTO public.equipment_rentals (crew_id, equipment_id)
VALUES ((SELECT id FROM crews LIMIT 1), 'no-such-item');
-- Expected: ERROR — foreign key violation
```

- [ ] **Step 2: Прогнать на staging — должен упасть**

Run: вставить в Supabase SQL editor → Expected: `ERROR: relation "public.equipment_rentals" does not exist`

- [ ] **Step 3: Написать миграцию**

```sql
-- supabase/migrations/20260812000001_create_equipment_rentals.sql
-- I5: standalone equipment rentals. Контракт PRD v4.1 §2.2 + волновой контракт п.1.
CREATE TABLE IF NOT EXISTS public.equipment_rentals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id         UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  equipment_id    TEXT NOT NULL REFERENCES public.cars(id) ON DELETE RESTRICT,
  renter_user_id  TEXT REFERENCES public.users(user_id) ON DELETE SET NULL,
  primary_rental_id UUID REFERENCES public.rentals(rental_id) ON DELETE SET NULL, -- NULL = standalone

  start_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date        TIMESTAMPTZ,
  expected_return_date TIMESTAMPTZ,

  daily_price     NUMERIC NOT NULL DEFAULT 0,
  total_cost      NUMERIC NOT NULL DEFAULT 0,

  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'returned', 'lost', 'damaged', 'overdue'
  )),

  issued_by       TEXT REFERENCES public.users(user_id) ON DELETE SET NULL,
  received_by     TEXT REFERENCES public.users(user_id) ON DELETE SET NULL,
  issued_at       TIMESTAMPTZ,
  returned_at     TIMESTAMPTZ,
  condition_notes TEXT,

  created_by      TEXT, -- operator chat_id, без FK — паттерн crew_todos
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_rentals_crew ON public.equipment_rentals(crew_id);
CREATE INDEX IF NOT EXISTS idx_equipment_rentals_equipment ON public.equipment_rentals(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_rentals_renter ON public.equipment_rentals(renter_user_id) WHERE renter_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_equipment_rentals_primary ON public.equipment_rentals(primary_rental_id) WHERE primary_rental_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_equipment_rentals_status ON public.equipment_rentals(status) WHERE status = 'active';

ALTER TABLE public.equipment_rentals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Crew members can read equipment rentals" ON public.equipment_rentals;
CREATE POLICY "Crew members can read equipment rentals"
  ON public.equipment_rentals FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crew_members cm
            WHERE cm.crew_id = equipment_rentals.crew_id
              AND cm.user_id = auth.jwt() ->> 'chat_id')
  );

DROP POLICY IF EXISTS "Crew owners can manage equipment rentals" ON public.equipment_rentals;
CREATE POLICY "Crew owners can manage equipment rentals"
  ON public.equipment_rentals FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crews c
            WHERE c.id = equipment_rentals.crew_id
              AND c.owner_id = auth.jwt() ->> 'chat_id')
  );
```

- [ ] **Step 4: Применить на staging, прогнать Step 1 — должен пройти**

Expected: 19 колонок; оба INSERT'а падают с ожидаемыми ошибками (constraint работает).

- [ ] **Step 5: Коммит**

```bash
git add supabase/migrations/20260812000001_create_equipment_rentals.sql tests/sql/i5_equipment_rentals_regression.sql
git commit -m "feat(equipment-rentals): table + RLS"
```

---

### Task 2: Server actions для equipment rentals

**Files:**
- Create: `app/franchize/server-actions/equipment-rentals.ts`
- Test: `tests/franchize/equipment-rentals.spec.ts`

**Interfaces:**
- Consumes: `public.equipment_rentals` (Task 1), `verifyCrewAccess`-паттерн
- Produces:
  - `createEquipmentRental({ slug, actorUserId, equipmentId, renterUserId?, expectedReturnDate?, dailyPrice, primaryRentalId? })` → `{ success, data?: { id }, error? }`; валидирует `cars.type='equipment'`, считает `total_cost = daily_price * days` (days ≥ 1)
  - `returnEquipmentRental({ slug, actorUserId, id, condition: 'returned'|'damaged'|'lost', conditionNotes? })` → ставит status, `returned_at = now()`
  - `listEquipmentRentals({ slug, actorUserId, statusFilter? })` → строки + `equipment_label` из `cars`

- [ ] **Step 1: Написать падающий тест**

```typescript
// tests/franchize/equipment-rentals.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const chain = () => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(() => ({ data: null, error: null })),
    single: vi.fn(() => ({ data: null, error: null })),
  });
  return { from: vi.fn(() => chain()), chains: [] as any[] };
});

vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: mocks.from } }));

import {
  createEquipmentRental,
  returnEquipmentRental,
  listEquipmentRentals,
} from '@/app/franchize/server-actions/equipment-rentals';

describe('equipment-rentals actions', () => {
  it('отклоняет предмет, который не equipment', async () => {
    const res = await createEquipmentRental({
      slug: 'vip-bike', actorUserId: 'op1', equipmentId: 'some-bike', dailyPrice: 500,
    });
    expect(res.success).toBe(false);
  });

  it('создаёт standalone аренду с total_cost = price * days', async () => {
    // TODO: замокать cars.type='equipment', days=3 → total 1500
  });

  it('возврат ставит status + returned_at', async () => {
    // TODO: verify update chain called with status='returned'
  });

  it('list возвращает equipment_label из cars', async () => {
    // TODO
  });
});
```

- [ ] **Step 2: Прогнать — должен упасть**

Run: `npx vitest run tests/franchize/equipment-rentals.spec.ts`
Expected: FAIL — `Cannot find module '@/app/franchize/server-actions/equipment-rentals'`

- [ ] **Step 3: Реализовать actions**

Скелет (полный файл пишет исполнитель; обязательные точки):

```typescript
// app/franchize/server-actions/equipment-rentals.ts
"use server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function createEquipmentRental(params: {
  slug: string; actorUserId: string; equipmentId: string;
  renterUserId?: string; expectedReturnDate?: string;
  dailyPrice: number; primaryRentalId?: string;
}): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  // 1. resolve crew by slug (verifyCrewAccess-паттерн: owner/admin/member)
  // 2. cars row: .eq("id", equipmentId).eq("type", "equipment").maybeSingle()
  //    — нет → { success: false, error: "Предмет не найден среди экипировки" }
  // 3. days = max(1, ceil((expectedReturnDate - now) / 86400000)) или 1 без даты
  // 4. insert { crew_id, equipment_id, renter_user_id, primary_rental_id,
  //    daily_price, total_cost: dailyPrice * days, expected_return_date,
  //    status: 'active', created_by: actorUserId }
}

export async function returnEquipmentRental(params: {
  slug: string; actorUserId: string; id: string;
  condition: "returned" | "damaged" | "lost"; conditionNotes?: string;
}): Promise<{ success: boolean; error?: string }> {
  // update … .eq("id", id).eq("crew_id", crew.id).eq("status", "active")
  // set { status: condition, returned_at: new Date().toISOString(),
  //       received_by: actorUserId, condition_notes }
  // 0 строк обновлено → { success: false, error: "Аренда не найдена или уже закрыта" }
}

export async function listEquipmentRentals(params: {
  slug: string; actorUserId: string; statusFilter?: string;
}): Promise<{ success: boolean; data?: Array<{
  id: string; equipmentId: string; equipmentLabel: string;
  status: string; dailyPrice: number; totalCost: number;
  startDate: string; expectedReturnDate: string | null;
}>; error?: string }> {
  // select("*, equipment:cars(make, model)") … map equipmentLabel = `${make} ${model}`
}
```

- [ ] **Step 4: Прогнать — должен пройти**

Run: `npx vitest run tests/franchize/equipment-rentals.spec.ts` → Expected: PASS (4 passed). Затем `npm run typecheck:franchize`.

- [ ] **Step 5: Коммит**

```bash
git add app/franchize/server-actions/equipment-rentals.ts tests/franchize/equipment-rentals.spec.ts
git commit -m "feat(equipment-rentals): server actions"
```

---

### Task 3: UI каталога и аренды экипа

**Files:**
- Create: `app/franchize/[slug]/equipment/page.tsx`, `app/franchize/[slug]/equipment/EquipmentClient.tsx`
- Test: `tests/franchize/i5-ui.spec.ts` (секция equipment — файл владения `frontend`)

**Interfaces:**
- Consumes: `listEquipmentRentals`, `createEquipmentRental`, `returnEquipmentRental` (Task 2); каталог — `cars WHERE type='equipment' AND crew_id`
- Контракт п.6: фронт верстаёт по этим сигнатурам, не дожидаясь бэка (моки).

- [ ] **Step 1: Падающий тест** — рендер списка: активная аренда показывает label + totalCost; кнопка «Вернуть» вызывает `returnEquipmentRental` с `condition='returned'`; пустой каталог → empty state «Нет экипировки».

- [ ] **Step 2: Прогнать — должен упасть**

Run: `npx vitest run tests/franchize/i5-ui.spec.ts` → FAIL — модуль не найден

- [ ] **Step 3: Собрать страницу** — два блока: «Каталог экипа» (карточки из cars, кнопка «Сдать» → форма: дата возврата, цена/день → `createEquipmentRental`) и «Активные аренды» (строки из `listEquipmentRentals`, кнопки «Вернуть» / «Повреждён» / «Утерян»). Тема — `useCrewTokens` как в `RentalsListClient.tsx`.

- [ ] **Step 4: Прогнать — должен пройти** + `npm run lint:target`

- [ ] **Step 5: Коммит**

```bash
git add "app/franchize/[slug]/equipment" tests/franchize/i5-ui.spec.ts
git commit -m "feat(equipment): catalog + rental UI"
```

---

### Task 4: Интеграция в doc-manual (экип с байком → строки equipment_rentals)

**Files:**
- Modify: `app/webhook-handlers/commands/doc-manual.ts` (после создания rental, рядом с `createLeadFollowupTodos`, ~line 2280)
- Test: `tests/franchize/doc-manual-steps.spec.ts` (расширить — файл владения `backend-integration`… ⛔ этот spec уже существует и НЕ в колонке integration — перенести новые кейсы в `tests/franchize/i5-api.spec.ts`)

**Interfaces:**
- Consumes: `DocFlowContext` equipment (helmets, gloves, jacket, boots, net, backpack, bag, charger), `rental_id` созданной аренды
- Produces: для каждого выбранного экипа — строка `equipment_rentals` с `primary_rental_id = rental_id`, `status='active'`, `issued_by = operator chat_id`

- [ ] **Step 1: Падающий тест** (`tests/franchize/i5-api.spec.ts`, секция doc-manual)

```typescript
it('аренда с 2 шлемами создаёт 2 equipment_rentals с primary_rental_id', async () => {
  // mock context: helmets=2, gloves=0, jacket=false…
  // await createEquipmentRowsForRental({ rentalId, context, operatorChatId, crewId })
  // expect insert вызван с массивом длиной 2, каждый primary_rental_id = rentalId
});

it('аренда без экипа не создаёт строк', async () => { /* insert не вызван */ });
```

- [ ] **Step 2: Прогнать — должен упасть** (функции `createEquipmentRowsForRental` не существует)

- [ ] **Step 3: Реализовать** — экспортировать чистую функцию из `equipment-rentals.ts` (backend-core даёт спеку: `createEquipmentRowsForRental({ rentalId, context, operatorChatId, crewId })` → маппинг equipment-флагов на `cars.id` через `specs`-таблицу соответствия `EQUIPMENT_FLAG_TO_CAR_ID`; вызов из doc-manual после успешного insert rental). ⚠️ Маппинг флаг→car_id — единственное место истины; если предмет не найден в каталоге экипажа — пропуск + `logger.warn`, НЕ падать (договор важнее).

- [ ] **Step 4: Прогнать — должен пройти**

- [ ] **Step 5: Коммит**

```bash
git add app/webhook-handlers/commands/doc-manual.ts app/franchize/server-actions/equipment-rentals.ts tests/franchize/i5-api.spec.ts
git commit -m "integration: doc-manual equipment_rentals rows"
```

---

### Task 5: Документация и гейт этапа

**Files:**
- Modify: `START-HERE.md` (строка статуса), `docs/META_PRD_ITERATIVE_IMPLEMENTATION_PLAN.md` (I5 чекбоксы equipment)

- [ ] **Step 1: Полный прогон**

```bash
npm test
npm run typecheck:franchize
npm run lint:target
```
Expected: всё зелёное (существующие тесты + новые)

- [ ] **Step 2: Обновить документы и закоммитить**

```bash
git add START-HERE.md docs/META_PRD_ITERATIVE_IMPLEMENTATION_PLAN.md
git commit -m "docs(i5): equipment rentals — статус"
```

---

## Проверка плана

**Покрытие PRD:** §1.1 п.1 standalone equipment rental — Tasks 1–3 · §6.4 «equipment rows linked to primary_rental_id» — Task 4 · миграция 01 волнового контракта — Task 1.

**Не входит в этот план:** денежная сторона (cash_transactions по возврату) — план `2026-08-12-i5-cash-ledger.md`; залог за экип — Open Q4 волнового плана.
