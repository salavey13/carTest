---
name: crew-management-text
description: >
  Text-based crew management for VIP Bike. View members, roles, stats, todos, shifts.
  Trigger phrases: "экипаж", "участники экипажа", "команда", "роли участников",
  "статистика команды", "задачи команды", "смены", "crew members", "crew stats",
  "crew todos", "team management", "shift schedule"
---

# Crew Management (text) — VIP Bike

Text-based эквивалент страниц `/franchize/vip-bike/crew`,
`/franchize/vip-bike/crew/members` и `/franchize/vip-bike/crew/shifts`. Читает
те же таблицы Supabase (`crews`, `crew_members`, `users`, `crew_todos`,
`crew_member_shifts`, `rentals`), что и React UI, и выводит форматированную
текстовую таблицу вместо HTML — готово для чтения в CLI/Telegram.

Same pattern as `leads-crm-text`: CLI skill, companion Node-ESM script
(`crew-query.mjs`, zero deps, pure `fetch`) для read-команд (1–6), curl-рецепты
для write-команд (7–8).

## When to Use

Use this skill when:

- Нужно быстро увидеть состав экипажа без открытия браузера / Telegram WebApp.
- Нужно показать карточку конкретного участника (профиль + задачи + аренды).
- Нужно вывести агрегированную статистику по экипажу (роли, задачи, completion rate).
- Нужно отфильтровать задачи команды по исполнителю / статусу / просрочке.
- Нужно посмотреть статистику задач по исполнителям (кто перегружен, кто не имеет задач).
- Нужно повысить/понизить участника в роли (`update-member-role`).
- Нужно посмотреть смены за конкретную дату (`crew-shifts`).

## Prerequisites

### Supabase credentials

Read from `/home/z/my-project/upload/secrets.txt`:

```bash
SUPABASE_URL="https://inmctohsodgdohamhzag.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' /home/z/my-project/upload/secrets.txt | cut -d= -f2-)"
```

### Crew context (hardcoded defaults)

| Field        | Value                                  |
|--------------|----------------------------------------|
| `crew_slug`  | `vip-bike`                             |
| `crew_id`    | `2d5fde70-1dd3-4f0d-8d72-66ccf6908746` |
| `owner_id`   | `356282674` (I_O_S_NN)                 |

Override via `CREW_SLUG` / `CREW_ID` env vars only if a different crew is needed
(the script reads them at startup).

### Common curl invocation

Every curl query uses the same headers + base URL:

```bash
curl -sS "https://inmctohsodgdohamhzag.supabase.co/rest/v1/<table>?<query>" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Accept: application/json"
```

Service-role key bypasses RLS and gives read/write access to all `public`
schema tables touched by this skill.

### Allowed crew-member roles

The `crew_members_role_check` DB constraint (verified in production schema
dump `/home/z/my-project/upload/supabase.txt`) allows exactly:

```
owner | co_owner | admin | mechanic | member
```

Any other value is rejected with Postgres code `23514` (check_violation).

---

## CLI Usage

Все read-команды (1–6) выполняются из директории skill:

```bash
cd /home/z/my-project/download/skills/crew-management-text

# Базовый запуск (читает SUPABASE_SERVICE_ROLE_KEY из /home/z/my-project/upload/secrets.txt)
node crew-query.mjs crew-info

# С явным указанием файла секретов
node crew-query.mjs --secrets /path/to/secrets.txt crew-info

# Через env-переменные
SUPABASE_URL=https://inmctohsodgdohamhzag.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
node crew-query.mjs crew-info
```

Write-команды (7–8) — curl-рецепты (см. соответствующие разделы ниже).

---

## Commands

### 1. `crew-info` — карточка экипажа

Text-версия главной `/crew` страницы: имя, slug, владелец, описание, контакты
из `metadata.contacts`, количество участников.

```bash
node crew-query.mjs crew-info
```

**Logic:**

1. `GET /rest/v1/crews?slug=eq.vip-bike&select=...&limit=1`
2. `GET /rest/v1/crew_members?crew_id=eq.<id>&select=user_id,role,membership_status`
   → count total / active.
3. `GET /rest/v1/users?user_id=eq.<owner_id>&select=user_id,username,full_name`
   → resolve owner display name.
4. Extract contacts from `crew.metadata.contacts`:
   `primary_phone`, `working_hours`, `manager_sales`, `manager_support`.

**Output:**

```
=== Экипаж VIP_BIKE ===
Slug:             vip-bike
ID:               2d5fde70-1dd3-4f0d-8d72-66ccf6908746
Владелец:         Илья I.O.S.
Создан:           07.08.2025
Обновлён:         17.07.2026
Локация (HQ):     56.2963, 43.9462
Описание:
  Вип Байк — сервис проката мототехники разных классов: от эндуро и нейкедов до спортбайков и power-cruiser.
Участники:        6 активных из 6 всего
Контакты:
  Телефон:         +7 9200-789-888
  Часы работы:     10:00 - 22:00 (ежедневно)
  Менеджер продаж: @I_O_S_NN
  Поддержка:       @I_O_S_NN

🌐 Web: https://vip-bike.ru/franchize/vip-bike/crew
```

---

### 2. `crew-members` — список участников

Text-версия страницы `/crew/members`. Сортировка: владелец → совладелец →
администратор → механик → участник, далее по `joined_at` ASC.

```bash
node crew-query.mjs crew-members
```

**Query** (PostgREST resource embedding для JOIN'а с `users`):

```bash
curl -sS "https://inmctohsodgdohamhzag.supabase.co/rest/v1/crew_members?\
select=user_id,role,membership_status,joined_at,live_status,\
user:users!crew_members_user_id_fkey(user_id,username,full_name)\
&crew_id=eq.2d5fde70-1dd3-4f0d-8d72-66ccf6908746\
&order=joined_at.asc" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

**Output:**

```
=== Участники экипажа vip-bike (6) ===

User ID       Username                  Имя                     Роль        Статус      С нами с
────────────────────────────────────────────────────────────────────────────────────────────────────
356282674     @I_O_S_NN                 Илья I.O.S.             Владелец    Активен     07.08.2025
244736261     @Roman_Vip_Bike_Electro   Роман Воробьёв          Участник    Активен     10.06.2026
7813830016    @DJORUDJOV                ORUDJOV                 Участник    Активен     10.06.2026
7839962291    @Николай                  Николай Vipbike         Участник    Активен     10.06.2026
413553377     @salavey13                Paul                    Участник    Активен     10.06.2026
6266482385    @Oleg_FiL_Ai              Oleg FiL AI             Участник    Активен     10.06.2026

Всего: 6
🌐 Web: https://vip-bike.ru/franchize/vip-bike/crew/members
```

---

### 3. `crew-member-detail <userId>` — карточка участника

Профиль участника + его задачи + его аренды. `<userId>` — Telegram user_id
(например `413553377` для salavey13).

```bash
node crew-query.mjs crew-member-detail 413553377
```

**Logic** (3 параллельных запроса + 1 rentals-запрос):

1. `GET /crew_members?crew_id=eq.<id>&user_id=eq.<userId>&limit=1` —
   membership: role, membership_status, joined_at, live_status, last_location.
2. `GET /users?user_id=eq.<userId>&limit=1` — username, full_name, metadata.
3. `GET /crew_todos?crew_id=eq.<id>&assigned_to=eq.<userId>&order=created_at.desc`
   — все задачи этого участника (с overdue-флагом `⚠` и done-флагом `✓`).
4. `GET /rentals?user_id=eq.<userId>&vehicle:cars!rentals_vehicle_id_fkey.crew_id=eq.<id>`
   — аренды, привязанные к ТС этого экипажа (с bike title, периодом, суммой).

**Output (фрагмент):**

```
=== Карточка участника Paul ===

User ID:          413553377
Username:         @salavey13
Полное имя:       Paul
Роль:             Участник
Статус:           Активен
Live-статус:      offline
В экипаже с:      10.06.2026

— Задачи (46: pending 34, in_progress 0, done 12, overdue 18) —
  ✓ [low] 🧥 Принять куртку                                             due 21.07.2026
  ⚠ [high] 🔑 Принять ключи от Yamaha R7                                due 16.07.2026
  … и ещё 26 задач (используйте crew-todos --assignee 413553377)

— Аренды (12) —
  Rental ID   Байк                    Статус      Период                      Сумма
  034bb19b-cd Regulmoto Nibbler 300 4V completed   21.06.2026 - 21.06.2026   8 000 ₽
  …

🌐 Web: https://vip-bike.ru/franchize/vip-bike/crew/members
```

---

### 4. `crew-stats` — агрегированная статистика

Сводка: участники по ролям + сводка по задачам (total / pending / in_progress /
done / overdue / completion rate).

```bash
node crew-query.mjs crew-stats
```

**Logic:**

1. `GET /crew_members?crew_id=eq.<id>&select=user_id,role,membership_status`
2. `GET /crew_todos?crew_id=eq.<id>&select=id,assigned_to,status,due_date,category`
3. Aggregate in JS:
   - `byRole[role]` — count per role (`owner` / `co_owner` / `admin` / `mechanic` / `member`).
   - `pending` / `in_progress` / `done` — count by `status`.
   - `overdue` — `todos.filter(due_date != null && due_date < now() && status != 'done')`.
   - `completionRate` — `done / total * 100` (rounded).

**Output:**

```
=== Статистика экипажа vip-bike ===

— Участники по ролям —
  Владелец         1
  Совладелец       0
  Администратор    0
  Механик          0
  Участник         5
  Всего участников 6

— Задачи —
  Всего:           224
  Pending:         190
  In progress:     0
  Done:            34
  Просрочено:      117
  Completion rate: 15% (34/224)

🌐 Web: https://vip-bike.ru/franchize/vip-bike/crew
```

---

### 5. `crew-todos [--assignee <userId>] [--status pending|done|in_progress|all] [--overdue]` — список задач с фильтрами

Text-версия задач экипажа. Все фильтры комбинируются (AND).

```bash
# Все задачи
node crew-query.mjs crew-todos

# Задачи конкретного участника
node crew-query.mjs crew-todos --assignee 413553377

# По статусу (pending / done / in_progress / all)
node crew-query.mjs crew-todos --status done
node crew-query.mjs crew-todos --status pending

# Только просроченные (due_date < now() AND status != 'done')
node crew-query.mjs crew-todos --overdue

# Комбинация: просроченные задачи DJORUDJOV в статусе pending
node crew-query.mjs crew-todos --assignee 7813830016 --status pending --overdue
```

**Query** (filters applied server-side, `--overdue` applied client-side):

```bash
curl -sS "https://inmctohsodgdohamhzag.supabase.co/rest/v1/crew_todos?\
select=id,assigned_to,title,category,status,priority,due_date,created_at,completed_at,\
assignee:users!crew_todos_assigned_to_fkey(user_id,username,full_name)\
&crew_id=eq.2d5fde70-1dd3-4f0d-8d72-66ccf6908746\
&assigned_to=eq.413553377\
&status=eq.pending\
&order=created_at.desc&limit=500" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

PostgREST не умеет выражать `due_date < now()` как параметр, поэтому
`--overdue` фильтруется в JS: `todo.due_date != null && todo.due_date < new Date().toISOString() && todo.status !== 'done'`.

**Output (фрагмент):**

```
=== Задачи экипажа vip-bike (55, Фильтр: assignee=7813830016, status=pending, overdue=1) ===

#   Статус      Приор.  Исполнитель           Due         Категория           Заголовок
────────────────────────────────────────────────────────────────────────────────────────────────────────────
1   ⚠ overdue   high    @DJORUDJOV            21.07.2026  lead_followup       🔍 Осмотр на повреждения: BMW F800R
2   ⚠ overdue   medium  @DJORUDJOV            21.07.2026  lead_followup       📊 Сравить одометр: было 38159 км
3   ⚠ overdue   high    @DJORUDJOV            21.07.2026  lead_followup       🔧 Проверить ТС при возврате: BMW F800R
…

🌐 Web: https://vip-bike.ru/franchize/vip-bike/crew
```

Indicators: `✓ done` (status='done'), `→ in_prog` (status='in_progress'),
`⚠ overdue` (pending + past due_date), `  pending` (default).

---

### 6. `crew-todo-stats` — статистика задач по исполнителям

Сводка: для каждого участника экипажа — сколько у него всего задач,
pending, done, overdue. Плюс строка `(unassigned)` для задач без
`assigned_to` и строка `ИТОГО`.

```bash
node crew-query.mjs crew-todo-stats
```

**Logic:**

1. `GET /crew_members?crew_id=eq.<id>&select=user_id,role` — список всех
   участников (даже с нулём задач).
2. `GET /crew_todos?crew_id=eq.<id>&select=id,assigned_to,status,due_date` —
   все задачи.
3. `GET /users?user_id=in.(<all_member_ids + all_assignee_ids>)` — bulk-resolve
   display names.
4. Aggregate per `assigned_to` (null bucket = `(unassigned)`).
5. Sort by role hierarchy: owner → co_owner → admin → mechanic → member →
   unknown → unassigned.

**Output:**

```
=== Задачи экипажа vip-bike по исполнителям ===

Исполнитель                 Роль         Всего  Pending    Done  Overdue
────────────────────────────────────────────────────────────────────────
Илья I.O.S.                 Владелец         5        5       0        5
Роман Воробьёв              Участник         0        0       0        0
ORUDJOV                     Участник       101      101       0       55
Николай Vipbike             Участник         0        0       0        0
Paul                        Участник        46       34      12       18
Oleg FiL AI                 Участник         0        0       0        0
Алексей Новиков             —                5        5       0        0
(unassigned)                —               67       45      22       39
────────────────────────────────────────────────────────────────────────
ИТОГО                                      224      190      34      117

🌐 Web: https://vip-bike.ru/franchize/vip-bike/crew
```

> Note: участники с нулём задач всё равно выводятся (как в UI). Строки с
> `role='—'` — это `assigned_to` из `crew_todos`, у которых нет записи в
> `crew_members` (например, покинувшие экипаж операторы).

---

### 7. `update-member-role <userId> --role <owner|co_owner|admin|mechanic|member>` — обновить роль (curl recipe)

Write-команда. Меняет `crew_members.role` для заданного участника.

**⚠️ Permission matrix** (портировано из server-action
`app/franchize/server-actions/update-crew-member-role.ts`):

| Actor role   | Can set target to     | Notes                                    |
|--------------|-----------------------|------------------------------------------|
| `owner`      | `co_owner`, `admin`   | Only crew owner (`crew_members.user_id === crews.owner_id`) can promote to `co_owner` |
| `co_owner`   | `admin`               | Owner OR co_owner can promote to `admin` |
| `admin`      | —                     | Cannot promote                           |
| `mechanic`   | —                     | Cannot promote                           |
| `member`     | —                     | Cannot promote                           |

Эти проверки делает server-action на Next.js-стороне. CLI/curl-вызов с
service-role key **обходит RLS и эти проверки** — используйте только если
вы действительно оператор `vip-bike` и понимаете последствия. Для аудита
передавайте `CREW_CLI_ACTOR=<your_telegram_id>` env (если скрипт/функция
его читает).

#### Step 1 — Verify target exists (recommended)

PATCH через PostgREST возвращает `[]` если ни одна строка не совпала с
WHERE — без ошибки. Чтобы отличить «нет такого участника» от «роль
не изменилась», сначала SELECT:

```bash
SUPABASE_URL="https://inmctohsodgdohamhzag.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' /home/z/my-project/upload/secrets.txt | cut -d= -f2-)"
CREW_ID="2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
TARGET_USER_ID="413553377"   # salavey13
NEW_ROLE="admin"

# 1. Check current role + membership
curl -sS "$SUPABASE_URL/rest/v1/crew_members?\
select=user_id,role,membership_status\
&crew_id=eq.$CREW_ID&user_id=eq.$TARGET_USER_ID" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
# Expected: [{"user_id":"413553377","role":"member","membership_status":"active"}]
# If [] → target not in crew, abort.
```

#### Step 2 — PATCH the role

```bash
curl -sS -X PATCH "$SUPABASE_URL/rest/v1/crew_members?\
crew_id=eq.$CREW_ID&user_id=eq.$TARGET_USER_ID" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  --data "{\"role\":\"$NEW_ROLE\"}"
# Expected: [{"id":"...","crew_id":"...","user_id":"413553377","role":"admin",...}]
# If [] → no row matched (target not in crew OR you used the wrong crew_id).
# If 23514 → invalid role value (use: owner|co_owner|admin|mechanic|member).
```

#### Validation

- `--role` value must be one of: `owner`, `co_owner`, `admin`, `mechanic`,
  `member` (DB constraint `crew_members_role_check`).
- Other values → HTTP 400 with `{"code":"23514","message":"new row for
  relation \"crew_members\" violates check constraint
  \"crew_members_role_check\""}`.
- Demoting yourself (e.g. owner → member) is allowed at the DB level but
  **not** through the server-action — use SQL Editor if you really need it.
- `owner` role is special: it should match `crews.owner_id`. Don't promote
  a second member to `owner` — instead transfer ownership via SQL update
  on `crews.owner_id`.

#### Output (after PATCH)

After running the PATCH, re-run `crew-members` to verify:

```bash
node crew-query.mjs crew-members
```

Expected row now shows the new role:

```
413553377     @salavey13                Paul                    Администратор Активен     10.06.2026
```

And no `🌐 Web:` line is printed by `crew-members` here — the web link is
appended to stdout of the script after the table:

```
🌐 Web: https://vip-bike.ru/franchize/vip-bike/crew/members
```

---

### 8. `crew-shifts [--date YYYY-MM-DD]` — смены за дату (curl recipe)

Text-версия страницы `/crew/shifts`. Фильтр по дате применяется к
`clock_in_time` (начало смены). По умолчанию — сегодня (UTC).

> **Why curl-only:** The shifts page in the web UI uses an Edge Function
> (`crew-shifts`) for clock-in/out actions and a custom RPC for daily
> rollups. The read-only "list shifts for a date" query is a plain
> PostgREST `GET` — that's what we replicate here. The script's `--help`
> mentions this command but does **not** implement it; use the curl recipe.

#### Defaults

- `--date` = today (UTC), format `YYYY-MM-DD`.
- Date filter: `clock_in_time` within `[YYYY-MM-DDT00:00:00.000Z, YYYY-MM-DDT23:59:59.999Z]`.

#### Query

```bash
SUPABASE_URL="https://inmctohsodgdohamhzag.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' /home/z/my-project/upload/secrets.txt | cut -d= -f2-)"
CREW_ID="2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
DATE="${1:-$(date -u '+%Y-%m-%d')}"   # e.g. 2026-07-12
START="${DATE}T00:00:00.000Z"
END="${DATE}T23:59:59.999Z"

curl -sS "$SUPABASE_URL/rest/v1/crew_member_shifts?\
select=id,member_id,clock_in_time,clock_out_time,duration_minutes,shift_type,checkpoint,actions\
&crew_id=eq.$CREW_ID\
&clock_in_time=gte.$START&clock_in_time=lte.$END\
&order=clock_in_time.asc" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Accept: application/json"
```

#### Optional: enrich with member display names

`crew_member_shifts.member_id` is a `user_id` (text). Resolve to username /
full_name via a second `users` query:

```bash
# Collect unique member_ids from the shifts response into MEMBER_IDS_JSON:
#   ["413553377","687580818",...]
# Then:
curl -sS "$SUPABASE_URL/rest/v1/users?\
select=user_id,username,full_name\
&user_id=in.(${MEMBER_IDS_JSON})" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

#### Output (manual formatting guide)

The curl returns raw JSON. To produce text output matching the script style:

```
=== Смены экипажа vip-bike за 2026-07-12 (1) ===

Member ID    Исполнитель          Начало              Конец               Длит.   Тип
─────────────────────────────────────────────────────────────────────────────────────
687580818    ID:687580818         12.07.2026 19:31    —                  —       warehouse

🌐 Web: https://vip-bike.ru/franchize/vip-bike/crew/shifts
```

Field semantics:

| Field              | Format                   | Notes                                          |
|--------------------|--------------------------|------------------------------------------------|
| `clock_in_time`    | ISO 8601 timestamptz     | Always non-null (defaults to `now()` on insert)|
| `clock_out_time`   | ISO 8601 timestamptz     | `null` if shift still active (open shift)      |
| `duration_minutes` | integer                  | `null` if shift still active                   |
| `shift_type`       | text                     | Known values: `online`, `warehouse`, `field`   |
| `checkpoint`       | jsonb                    | Optional location checkpoint `{lat,lng,ts}`    |
| `actions`          | jsonb array              | Optional log of actions during the shift       |

---

## Schema reference

Quick lookup for the tables this skill touches.

### `public.crews`

| Column        | Type        | Notes                                          |
|---------------|-------------|------------------------------------------------|
| `id`          | uuid (PK)   |                                                |
| `name`        | text        | Unique                                         |
| `slug`        | text        | Unique (e.g. `vip-bike`)                       |
| `description` | text?       | Free-form                                       |
| `logo_url`    | text?       | Storage URL                                     |
| `owner_id`    | text        | FK → `users.user_id`                            |
| `hq_location` | text?       | `"lat, lng"` string                             |
| `metadata`    | jsonb       | `{contacts:{primary_phone, working_hours, manager_sales, manager_support}, franchize:{...}}` |
| `created_at`  | timestamptz | Defaults `now()`                                |
| `updated_at`  | timestamptz | Defaults `now()`                                |

### `public.crew_members`

| Column              | Type        | Notes                                              |
|---------------------|-------------|----------------------------------------------------|
| `id`                | uuid (PK)   | Defaults `gen_random_uuid()`                       |
| `crew_id`           | uuid        | FK → `crews.id` ON DELETE CASCADE                  |
| `user_id`           | text        | FK → `users.user_id` ON DELETE CASCADE             |
| `role`              | text        | `owner` / `co_owner` / `admin` / `mechanic` / `member` (CHECK constraint `crew_members_role_check`) |
| `joined_at`         | timestamptz | Defaults `now()`                                   |
| `membership_status` | text        | `active` / `inactive` / `invited` / `pending`      |
| `last_location`     | geography?  | PostGIS Point(4326) — nullable                     |
| `live_status`       | text        | `online` / `offline` (defaults `offline`)          |

Unique constraint: `(crew_id, user_id)` — one membership per user per crew.

### `public.users`

| Column      | Type   | Notes                                    |
|-------------|--------|------------------------------------------|
| `user_id`   | text   | PK (Telegram user ID)                    |
| `full_name` | text?  | Display name                             |
| `username`  | text?  | Telegram @username                       |
| `metadata`  | jsonb? | Loose schema (phone, settings, etc.)     |

### `public.crew_todos`

| Column         | Type        | Notes                                              |
|----------------|-------------|----------------------------------------------------|
| `id`           | text (PK)   | e.g. `todo-71d27d79-3491-440f-bc3d-f31e9b647731`   |
| `crew_id`      | text        | UUID stored as text — filter by crew_id             |
| `assigned_to`  | text?       | FK → `users.user_id` (nullable = unassigned)       |
| `title`        | text        | Task title (may contain emoji prefix)              |
| `description`  | text?       | Free-form (often JSON-encoded metadata)            |
| `category`     | text        | `lead_followup` / `rental_verification` / `general` / `maintenance` / `documents` |
| `status`       | text        | `pending` / `in_progress` / `done`                 |
| `priority`     | text        | `low` / `medium` / `high`                          |
| `due_date`     | timestamptz?| Optional due date                                  |
| `created_at`   | timestamptz | Defaults `now()`                                   |
| `created_by`   | text?       | FK → `users.user_id`                               |
| `updated_at`   | timestamptz | Defaults `now()`                                   |
| `completed_at` | timestamptz?| Set when `status` transitions to `done`            |
| `lead_id`      | text?       | Optional FK to lead (for `lead_followup` category) |
| `user_id`      | text?       | Optional — lead's user_id (denormalised)           |
| `phone`        | text?       | Optional — lead's phone (denormalised)             |
| `rental_id`    | uuid?       | Optional FK → `rentals.rental_id`                  |

### `public.crew_member_shifts`

| Column             | Type        | Notes                                          |
|--------------------|-------------|------------------------------------------------|
| `id`               | uuid (PK)   |                                                |
| `member_id`        | text        | `user_id` of the crew member (NOT a FK in DB, but logically points to `users.user_id`) |
| `crew_id`          | uuid        | FK → `crews.id`                                |
| `clock_in_time`    | timestamptz | Shift start                                    |
| `clock_out_time`   | timestamptz?| Shift end (`null` = still on shift)            |
| `duration_minutes` | integer?    | Computed on clock-out                          |
| `shift_type`       | text        | `online` / `warehouse` / `field`               |
| `checkpoint`       | jsonb       | `{lat,lng,ts,...}` (nullable, defaults `{}`)   |
| `actions`          | jsonb       | Array of shift actions (nullable, defaults `[]`)|

> **Note on `member_id`:** Unlike `crew_members.user_id`, the `member_id`
> column in `crew_member_shifts` is **not** a real FK in production schema.
> Some shift records have `member_id` values that don't appear in
> `crew_members` (e.g. `687580818` for vip-bike). Handle gracefully — show
> `ID:<member_id>` when no `users` row matches.

### `public.rentals` (used by `crew-member-detail`)

| Column                  | Type        | Notes                                    |
|-------------------------|-------------|------------------------------------------|
| `rental_id`             | uuid (PK)   |                                          |
| `user_id`               | text        | FK → `users.user_id`                     |
| `vehicle_id`            | text        | FK → `cars.id`                           |
| `status`                | text        | `active` / `completed` / `cancelled` / `pending` |
| `payment_status`        | text?       | `paid` / `partial` / `unpaid` / null     |
| `total_cost`            | numeric?    | Rubles                                   |
| `requested_start_date`  | timestamptz?| Original request start                   |
| `requested_end_date`    | timestamptz?| Original request end                     |
| `agreed_start_date`     | timestamptz?| Negotiated start                         |
| `agreed_end_date`       | timestamptz?| Negotiated end                           |
| `created_at`            | timestamptz | Defaults `now()`                         |

Crew filter on rentals is via the join `rentals.vehicle_id → cars.id → cars.crew_id`. PostgREST resource embedding:
`?select=...,vehicle:cars!rentals_vehicle_id_fkey(id,make,model,crew_id)&vehicle.crew_id=eq.<CREW_ID>`.

---

## Input/Output Contracts

### Required Inputs

- Supabase service role key — read from (in priority order):
  1. `--secrets <path>` CLI flag
  2. `SUPABASE_SERVICE_ROLE_KEY` env var
  3. `/home/z/my-project/upload/secrets.txt` (looks for `SUPABASE_SERVICE_ROLE_KEY=...`)

### Optional Inputs

- `--secrets <path>` — path to secrets file (default: `/home/z/my-project/upload/secrets.txt`)
- `SUPABASE_URL` env — project URL (default: `https://inmctohsodgdohamhzag.supabase.co`)
- `CREW_SLUG` env — crew slug (default: `vip-bike`)
- `CREW_ID` env — crew UUID (default: `2d5fde70-1dd3-4f0d-8d72-66ccf6908746`)
- `CREW_CLI_ACTOR` env — Telegram user_id of operator running write commands (for audit)
- `DEBUG` env — print stack trace on errors

### Anti-hallucination: flags that do NOT exist

- ~~`--json`~~ — does not exist. The script always prints a text table.
- ~~`--outFile <path>`~~ — does not exist. Output goes to stdout; redirect with `>` if you need a file.
- ~~`--crew <slug>`~~ — does not exist. Crew is set via `CREW_SLUG` / `CREW_ID` env vars (or hardcoded defaults).
- ~~`--format csv|md|html`~~ — does not exist. Only text table.
- ~~`crew-todos --createdAfter <date>`~~ — does not exist. Filter externally with `grep`/`awk`.
- ~~`crew-shifts` as a script subcommand~~ — does not exist. Use the curl recipe (command 8 above).
- ~~`update-member-role` as a script subcommand~~ — does not exist. Use the curl recipe (command 7 above).

### Output

- **stdout** — formatted text table / detail card / stats summary, ending with
  `🌐 Web: <url>` for the corresponding UI page.
- **stderr** — errors in format `ERROR: <message>`.
- **exit code**:
  - `0` — success.
  - `2` — error (invalid args, member not found, Supabase 4xx/5xx, constraint violation).

---

## Error Handling

| Stage                       | Reason                                          | When arises                                                                | Exit | What to do                                          |
|-----------------------------|-------------------------------------------------|----------------------------------------------------------------------------|------|-----------------------------------------------------|
| `secrets_load`              | `SUPABASE_SERVICE_ROLE_KEY not found`           | No env var, `--secrets` path unreadable, default path missing              | 2    | Pass `--secrets <path>` or export env var           |
| `crew_lookup`               | `Экипаж не найден: slug=...`                    | `CREW_SLUG` does not exist in `crews` table                                | 2    | Verify `CREW_SLUG` (default `vip-bike`)             |
| `member_not_found`          | `Участник не найден: user_id=... (crew=...)`    | `crew-member-detail` — no `crew_members` row for this user_id+crew_id      | 2    | Run `crew-members` to list valid user_ids           |
| `supabase_query_4xx`        | `Supabase <schema>.<table> 4xx: <body>`         | Wrong select list, RLS blocked, no such table/column                       | 2    | Check schema (see "Schema reference")               |
| `supabase_query_5xx`        | `Supabase <schema>.<table> 5xx: <body>`         | Supabase down, rate-limit, timeout                                         | 2    | Retry in a minute                                   |
| `todo_status_invalid`       | `invalid --status "..."`                        | `crew-todos --status bogus`                                                | 2    | Use: `pending` / `done` / `in_progress` / `all`     |
| `role_invalid` (curl)       | HTTP 400 `23514`                                | `update-member-role --role bogus`                                          | —    | Use: `owner` / `co_owner` / `admin` / `mechanic` / `member` |
| `patch_no_rows` (curl)      | PATCH returns `[]`                              | `update-member-role` — `user_id` not in crew (or wrong `crew_id`)          | —    | Run `crew-members` first to verify the user_id      |
| `unknown_command`           | `unknown command "..."`                         | Typo in subcommand                                                         | 2    | Run `--help` for the list of commands               |
| `unknown_flag`              | `unknown flag: --...`                           | Typo in flag for `crew-todos`                                              | 2    | See `crew-todos --help` (or `--help` on the script) |

---

## Security / Compliance Rules

- **Service role key** (`SUPABASE_SERVICE_ROLE_KEY`) gives full read/write access
  to all tables, including PII in `private` schema. Never:
  - commit the key to git
  - log the key to stdout/stderr (the script never prints it)
  - pass the key as a URL parameter (only `apikey` / `Authorization: Bearer` headers)
  - embed the key in client-side code (React/Next.js client bundle)
- **`users.metadata`** contains phone numbers, settings, and personal preferences.
  The script only reads `metadata.phone` for the `crew-member-detail` display —
  no other PII is surfaced. When forwarding output to public Telegram chats,
  mask the phone (e.g. `+7XXXXXXXX42`).
- The script makes **no writes**. The only write commands are curl recipes
  (`update-member-role`, and `crew-shifts` clock-in/out is out of scope) —
  those use the service-role key directly and bypass the Next.js server-action
  permission matrix. Only run them as the actual crew operator.
- For `update-member-role`, set `CREW_CLI_ACTOR=<your_telegram_id>` (or
  embed it in the PATCH body's `metadata` if you extend the recipe) so
  future audit logs can attribute the change.
- All HTTP requests go over HTTPS. Do not proxy through plain HTTP.
- The script does not persist query results to disk. stdout belongs to the
  caller (shell, CI runner, Telegram bot).

---

## Integration with boss-mode / Telegram bot

The script can be called from a Telegram bot (boss-mode) for operator queries:

```
Пользователь: "участники экипажа"
Бот: exec `node crew-query.mjs crew-members`
     → таблица участников в Telegram-чат

Пользователь: "сколько задач у salavey13"
Бот: exec `node crew-query.mjs crew-todos --assignee 413553377 --overdue --status pending`
     → список просроченных задач

Пользователь: "статистика по команде"
Бот: exec `node crew-query.mjs crew-stats`
     → сводка по ролям и задачам

Пользователь: "повысь 413553377 до admin"
Бот: exec curl PATCH recipe from command 7
     → подтверждение изменения роли
```

Telegram integration notes:
- Long tables (>4096 chars) — split into multiple messages or send as file.
- Mask phones in public chats.
- For `update-member-role`, always set `CREW_CLI_ACTOR` for audit.

---

## Examples

### Утренний standup: статистика + просроченные задачи

```bash
cd /home/z/my-project/download/skills/crew-management-text

echo "📊 Статистика экипажа:"
node crew-query.mjs crew-stats

echo ""
echo "⚠️ Просроченные задачи (топ-20):"
node crew-query.mjs crew-todos --overdue | head -25
```

### Карточка оператора перед 1-на-1 встречей

```bash
# salavey13 (id=413553377) — профиль + задачи + аренды
node crew-query.mjs crew-member-detail 413553377
```

### Перераспределение нагрузки

```bash
# Кто перегружен задачами
node crew-query.mjs crew-todo-stats

# Какие задачи у самого загруженного участника (DJORUDJOV — 101 задача)
node crew-query.mjs crew-todos --assignee 7813830016 --overdue --status pending
```

### Повысить salavey13 до admin (curl recipe)

```bash
SUPABASE_URL="https://inmctohsodgdohamhzag.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' /home/z/my-project/upload/secrets.txt | cut -d= -f2-)"
CREW_ID="2d5fde70-1dd3-4f0d-8d72-66ccf6908746"

# Verify current role
curl -sS "$SUPABASE_URL/rest/v1/crew_members?select=user_id,role&crew_id=eq.$CREW_ID&user_id=eq.413553377" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
# → [{"user_id":"413553377","role":"member"}]

# Promote
curl -sS -X PATCH "$SUPABASE_URL/rest/v1/crew_members?crew_id=eq.$CREW_ID&user_id=eq.413553377" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  --data '{"role":"admin"}'
# → [{"user_id":"413553377","role":"admin",...}]

# Verify
node crew-query.mjs crew-members
```

### Смены за конкретную дату (curl recipe)

```bash
SUPABASE_URL="https://inmctohsodgdohamhzag.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' /home/z/my-project/upload/secrets.txt | cut -d= -f2-)"
CREW_ID="2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
DATE="2026-07-12"
START="${DATE}T00:00:00.000Z"
END="${DATE}T23:59:59.999Z"

curl -sS "$SUPABASE_URL/rest/v1/crew_member_shifts?\
select=member_id,clock_in_time,clock_out_time,duration_minutes,shift_type\
&crew_id=eq.$CREW_ID&clock_in_time=gte.$START&clock_in_time=lte.$END\
&order=clock_in_time.asc" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
# → [{"member_id":"687580818","clock_in_time":"2026-07-12T19:31:55.92+00:00","clock_out_time":null,"duration_minutes":null,"shift_type":"warehouse"}]
```

---

## Known limitations

1. **Crew is hardcoded**: `CREW_SLUG`, `CREW_ID` are hardcoded defaults in
   `crew-query.mjs` (overridable via env vars). For a different crew, set
   `CREW_SLUG` + `CREW_ID` env vars before running.

2. **Resource embedding for users**: `crew-members` uses PostgREST's
   `?select=...,user:users!crew_members_user_id_fkey(...)` JOIN. If the FK
   relationship name changes in a future migration, the query will 400 —
   update the `select` string in `cmdCrewMembers`.

3. **`crew_member_shifts.member_id` is not a FK**: Some shift records
   reference `member_id` values that don't appear in `crew_members` or
   `users` (e.g. `687580818` for vip-bike). The script/curl recipe handles
   this by falling back to `ID:<member_id>` when no `users` row matches.

4. **No pagination**: `crew-todos` caps at 500 rows (configurable in source).
   For larger lists, narrow with `--assignee` / `--status` / `--overdue`.

5. **No timezone conversion**: All dates print in UTC (`DD.MM.YYYY HH:MM`).
   MSK (UTC+3) conversion is the caller's responsibility.

6. **`update-member-role` bypasses permission matrix**: The curl recipe uses
   service-role key, which bypasses RLS and the `updateCrewMemberRole`
   server-action's actor/target role checks. Only run as the actual crew
   operator. For audited promotions through the UI permission matrix, use
   the Next.js server-action (`/app/franchize/server-actions/update-crew-member-role.ts`)
   instead.

7. **`crew-shifts` is curl-only**: The script's `--help` mentions it for
   discoverability, but the actual implementation is the curl recipe in
   command 8 above. The shifts page in the UI uses an Edge Function for
   clock-in/out, which is out of scope for this read-only text skill.

8. **Operator names not hardcoded**: Unlike `leads-crm-text`, this script
   resolves display names dynamically from the `users` table — no
   `OPERATOR_NAMES` map to maintain.

---

## Related Files

- **Script**: `crew-query.mjs` (this skill)
- **Sibling skills** (same pattern):
  - `download/skills/leads-crm-text/SKILL.md` — leads CRM (reference pattern)
  - `download/skills/analytics-text/SKILL.md` — rentals/sales/todos analytics
- **Source of truth (server actions / UI)**:
  - `app/franchize/server-actions/update-crew-member-role.ts` — permission
    matrix + role update logic (curl recipe replicates the DB write but NOT
    the permission checks)
  - `app/franchize/[slug]/crew/page.tsx` — overview page (mirrors `crew-info` + `crew-stats`)
  - `app/franchize/[slug]/crew/CrewOverviewClient.tsx` — overview client
  - `app/franchize/[slug]/crew/members/page.tsx` — members list page
  - `app/franchize/[slug]/crew/CrewMembersClient.tsx` — members client (mirrors `crew-members`)
  - `app/franchize/[slug]/crew/shifts/page.tsx` — shifts page
  - `app/franchize/[slug]/crew/CrewShiftsClient.tsx` — shifts client (mirrors `crew-shifts`)
  - `app/franchize/server-actions/crew-todos.ts` — todos server actions
- **Schema** (verified against `/home/z/my-project/upload/supabase.txt`):
  - `public.crews` — `crew_members_pkey`, `crews_slug_key`, `crews_owner_id_fkey`
  - `public.crew_members` — `crew_members_role_check` (allows `owner|co_owner|admin|mechanic|member`), `unique_user_per_crew`
  - `public.crew_todos` — `crew_todos_assigned_to_fkey`, `crew_todos_created_by_fkey`, `crew_todos_rental_id_fkey`
  - `public.crew_member_shifts` — `member_id` is plain text (NOT a FK)
- **Crew constants**:
  - Crew slug: `vip-bike`
  - Crew ID: `2d5fde70-1dd3-4f0d-8d72-66ccf6908746`
  - Owner: `356282674` (I_O_S_NN)
  - Secrets: `/home/z/my-project/upload/secrets.txt`
- **Web links** (appended to every command's output):
  - `https://vip-bike.ru/franchize/vip-bike/crew` — overview
  - `https://vip-bike.ru/franchize/vip-bike/crew/members` — members list
  - `https://vip-bike.ru/franchize/vip-bike/crew/shifts` — shifts
