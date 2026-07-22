---
name: crew-management-text
description: >
  Text-based crew management for VIP Bike. Lists members, roles, live status, todos,
  permissions. Queries Supabase REST API (curl), outputs formatted text.
  Trigger phrases (RU): "экипаж", "участники экипажа", "роли экипажа", "кто в экипаже",
  "админы экипажа", "владелец экипажа", "статус оператора", "кто онлайн", "задачи оператора",
  "добавить в экипаж", "изменить роль".
  Trigger phrases (EN): "crew members", "crew list", "crew roles", "crew admins",
  "crew owner", "operator status", "who is online", "operator todos", "add to crew",
  "change role".
---

# Crew Management (text) — VIP Bike

Триггер-фразы (RU): **`экипаж`**, **`участники экипажа`**, **`роли экипажа`**, **`кто в экипаже`**, **`админы экипажа`**, **`владелец экипажа`**, **`статус оператора`**, **`кто онлайн`**, **`задачи оператора`**, **`добавить в экипаж`**, **`изменить роль`**.
Триггер-фразы (EN): `crew members`, `crew list`, `crew roles`, `crew admins`, `crew owner`, `operator status`, `who is online`, `operator todos`, `add to crew`, `change role`.

## Overview

Text-based эквивалент страницы `/franchize/vip-bike/crew` и `/franchize/vip-bike/crew/members`. Показывает состав экипажа `vip-bike`: роли, статусы, live-статус (online/offline), геолокацию (если есть), задачи операторов. Поддерживает смену роли оператора (PATCH).

## When to Use

Use this skill when:

- Нужно увидеть список операторов экипажа `vip-bike` без открытия браузера.
- Нужно проверить, кто сейчас онлайн (`live_status='online'`).
- Нужно вывести задачи конкретного оператора (assigned/pending/overdue).
- Нужно поменять роль оператора (`member` → `admin` и т.д.).
- Нужно оценить покрытие ролей (есть ли активный owner / co_owner / admin / mechanic).

## Supabase Access

```bash
SUPABASE_URL="https://inmctohsodgdohamhzag.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="$(grep SUPABASE_SERVICE_ROLE_KEY /home/z/my-project/upload/secrets.txt | cut -d= -f2-)"
CREW_SLUG="vip-bike"
CREW_ID="2d5fde70-1dd3-4f0d-8d72-66ccf6908746"

OP_OWNER=356282674        # I_O_S_NN
OP_CO_OWNER=244736261     # Roman_Vip_Bike_Electro
OP_ADMIN=413553377        # salavey13
OP_MEMBER=7813830016      # DJORUDJOV

HDR_PUBLIC=(-H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "Accept: application/json")
```

## Commands

### 1. `list-members` — список участников экипажа

```bash
curl -sS "${SUPABASE_URL}/rest/v1/crew_members?\
select=id,crew_id,user_id,role,joined_at,membership_status,last_location,live_status,\
user:users!inner(user_id,full_name,username,avatar_url,metadata,language_code)\
&crew_id=eq.${CREW_ID}\
&order=role.asc,joined_at.asc" \
  "${HDR_PUBLIC[@]}"
```

**Логика:** Query `crew_members` where `crew_id = ${CREW_ID}`. JOIN с `users` через `user_id`. Сортировка по `role` (owner → co_owner → admin → mechanic → member), затем по `joined_at`.

**Пример вывода:**

```
=== Экипаж vip-bike (4 участника) ===

Имя                       Роль      Статус      Live       Joined
I_O_S_NN                  owner     active      offline    21.05.2026
Roman_Vip_Bike_Electro    co_owner  active      online     22.05.2026
salavey13                 admin     active      offline    25.05.2026
DJORUDJOV                 member    active      offline    30.06.2026

— Покрытие ролей —
owner:     ✓ (1)
co_owner:  ✓ (1)
admin:     ✓ (1)
mechanic:  ✗ (нет)
member:    ✓ (1)
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/crew/members`

---

### 2. `member-detail <userId>` — карточка оператора

```bash
USER_ID="413553377"

# 1. Crew member + user
curl -sS "${SUPABASE_URL}/rest/v1/crew_members?\
select=id,crew_id,user_id,role,joined_at,membership_status,last_location,live_status,\
user:users!inner(user_id,full_name,username,avatar_url,website,metadata,language_code,created_at)\
&crew_id=eq.${CREW_ID}&user_id=eq.${USER_ID}" \
  "${HDR_PUBLIC[@]}" | jq '.[0]'

# 2. Tasks assigned to operator
curl -sS "${SUPABASE_URL}/rest/v1/crew_todos?\
select=id,title,description,status,priority,due_date,category,rental_id,lead_id,completed_at\
&crew_id=eq.${CREW_ID}&assigned_to=eq.${USER_ID}\
&order=due_date.asc" \
  "${HDR_PUBLIC[@]}"

# 3. Rentals created by this operator (created_by_operator_chat_id)
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,vehicle_id,status,total_cost,created_at\
&crew_id=eq.${CREW_ID}&created_by_operator_chat_id=eq.${USER_ID}\
&order=created_at.desc&limit=20" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Оператор: salavey13 (413553377) ===
User ID:          413553377
Username:         @salavey13
Full name:        Артур С.
Роль:             admin
Статус:           active
Live:             offline
Joined:           25.05.2026
Язык:             ru

— Задачи (15) —
  active: 7 | done: 7 | overdue: 1
  #1  ⚠️ overdue   Проверить паспорт Закиров Артур   due: 21.07
  #2              Отправить КП для ООО Вектор         due: 25.07
  ...

— Аренды (создано оператором: 8) —
  rental_id:   4a3b2c1d-...   статус: completed   сумма: 14 000 ₽   создан: 20.07
  rental_id:   b2c3d4e5-...   статус: active      сумма: 8 500 ₽    создан: 19.07
  ...
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/crew/members`

---

### 3. `online-members` — кто сейчас онлайн

```bash
curl -sS "${SUPABASE_URL}/rest/v1/crew_members?\
select=user_id,role,live_status,last_location,joined_at,\
user:users!inner(user_id,full_name,username)\
&crew_id=eq.${CREW_ID}&live_status=eq.online\
&order=role.asc" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Онлайн операторы vip-bike (1) ===
Имя                       Роль      Last location
Roman_Vip_Bike_Electro    co_owner  (55.75, 37.61)  Moscow
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/crew`

---

### 4. `member-todos <userId>` — задачи оператора

```bash
USER_ID="413553377"
NOW_ISO="$(date -u '+%Y-%m-%dT%H:%M:%S.000Z')"

# Все задачи
curl -sS "${SUPABASE_URL}/rest/v1/crew_todos?\
select=id,title,description,status,priority,due_date,category,rental_id,lead_id,completed_at\
&crew_id=eq.${CREW_ID}&assigned_to=eq.${USER_ID}\
&order=due_date.asc" \
  "${HDR_PUBLIC[@]}"

# Только просроченные
curl -sS "${SUPABASE_URL}/rest/v1/crew_todos?\
select=id,title,due_date,status\
&crew_id=eq.${CREW_ID}&assigned_to=eq.${USER_ID}\
&status=neq.done&due_date=not.is.null&due_date=lt.${NOW_ISO}\
&order=due_date.asc" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Задачи salavey13 (15: 7 pending, 1 in_progress, 7 done, 1 overdue) ===

— Просроченные —
  #1  ⚠️ overdue   Проверить паспорт Закиров Артур   due: 21.07

— Pending —
  #2   Отправить КП для ООО Вектор     due: 25.07
  #3   Позвонить по QR-claim            due: 22.07
  ...

— Done (7) —
  ...
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/crew`

---

### 5. `change-role <userId> --role <role>` — сменить роль оператора

```bash
USER_ID="7813830016"
NEW_ROLE="admin"   # owner | co_owner | admin | mechanic | member
ACTOR="${OP_OWNER}"  # кто меняет (только owner может менять роли)

# Validate role
case "$NEW_ROLE" in
  owner|co_owner|admin|mechanic|member) ;;
  *) echo "ERROR: invalid role '$NEW_ROLE'"; exit 2 ;;
esac

# PATCH crew_members
MEMBER_ID=$(curl -sS "${SUPABASE_URL}/rest/v1/crew_members?\
select=id&crew_id=eq.${CREW_ID}&user_id=eq.${USER_ID}&limit=1" \
  "${HDR_PUBLIC[@]}" | jq -r '.[0].id')

curl -sS -X PATCH "${SUPABASE_URL}/rest/v1/crew_members?id=eq.${MEMBER_ID}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "$(jq -n --arg role "$NEW_ROLE" '{role: $role}')"
```

**Логика:** PATCH `crew_members.role`. Допустимые роли (CHECK constraint `crew_members_role_check`): `owner`, `co_owner`, `admin`, `mechanic`, `member`. Аудит-лог ведётся через server-action `update-crew-member-role.ts`.

**Пример вывода:**

```
✓ Роль обновлена
  User:        7813830016 (DJORUDJOV)
  Crew:        vip-bike
  Old role:    member
  New role:    admin
  Changed by:  356282674 (I_O_S_NN, owner)
  At:          2026-07-21T23:50:00.000Z
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/crew/members`

---

## Schema Access

### Public schema

- `crews` — `id` (uuid PK), `name`, `description`, `logo_url`, `owner_id`, `created_at`, `updated_at`, `slug`, `hq_location`, `metadata` (jsonb — `is_provider` и т.д.).
- `crew_members` — `id` (uuid PK), `crew_id`, `user_id`, `role` (`owner` / `co_owner` / `admin` / `mechanic` / `member`), `joined_at`, `membership_status` (`pending` / `active` / `inactive`), `last_location` (geography), `live_status` (`online` / `offline`).
- `users` — `user_id` (text PK), `username`, `full_name`, `avatar_url`, `website`, `status`, `role`, `metadata`, `language_code`, `created_at`.
- `crew_todos` — `id`, `crew_id`, `assigned_to`, `title`, `description`, `status`, `priority`, `due_date`, `category`, `rental_id`, `lead_id`, `completed_at`, `created_by`.
- `rentals` — `rental_id`, `user_id`, `vehicle_id`, `status`, `total_cost`, `created_at`, `crew_id`, `created_by_operator_chat_id`.

### Private schema

Crew management skill не использует private schema.

## Web Links

| Command         | Web page                                                                                       |
|-----------------|------------------------------------------------------------------------------------------------|
| `list-members`  | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/crew/members             |
| `member-detail` | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/crew/members             |
| `online-members`| https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/crew                     |
| `member-todos`  | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/crew                     |
| `change-role`   | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/crew/members             |

## Anti-hallucination: флаги, которых НЕ существует

- ~~`--json`~~ — не существует. Только текст.
- ~~`--crew <slug>`~~ — не существует. Crew захардкожен как `vip-bike`.
- ~~`--includeLocation`~~ — не существует. Геолокация показывается, если есть (`last_location`).
- ~~`change-role --force`~~ — не существует. Все изменения через PATCH с CHECK constraint.
- ~~`member-detail --withReviews`~~ — не существует. Используйте `reviews-text` skill.
- ~~`--outFile <path>`~~ — не существует. Используйте `> file.txt`.
- ~~`--format csv|md`~~ — не существует.
- ~~`--add-member <userId>`~~ — не существует. Добавление через Telegram bot onboarding flow.
- ~~`--remove-member <userId>`~~ — не существует. Удаление — через UI (cascade delete).
- ~~`--set-live-status <online|offline>`~~ — не существует. Live-status обновляется Telegram WebApp polling.

## Error Handling

| Stage                | Reason                                | Когда возникает                                                       | Exit | Что делать                                       |
|----------------------|---------------------------------------|-----------------------------------------------------------------------|------|--------------------------------------------------|
| `secrets_load`       | `SUPABASE_SERVICE_ROLE_KEY not found` | Путь `/home/z/my-project/upload/secrets.txt` недоступен              | 2    | Проверить путь или export env                    |
| `crew_not_found`     | `Crew not found: vip-bike`            | `CREW_SLUG` не существует в `crews`                                   | 2    | Проверить `CREW_SLUG`                            |
| `member_not_found`   | `Member not found: <userId>`          | `member-detail`/`member-todos` — нет участника с таким `user_id`     | 2    | Проверить `list-members` для валидных IDs        |
| `role_invalid`       | `invalid role "<value>"`              | `change-role --role bogus`                                            | 2    | Использовать `owner` / `co_owner` / `admin` / `mechanic` / `member` |
| `role_constraint`    | `CHECK constraint 'crew_members_role_check' rejected` | DB constraint не включает роль                          | 2    | Использовать одну из разрешённых ролей           |
| `member_wrong_crew`  | `Member belongs to another crew`      | `user_id` существует, но в другом `crew_id`                           | 2    | Проверить `crew_id` в URL                        |
| `supabase_4xx`       | `Supabase <table> 4xx: <body>`        | Неверный select, RLS                                                  | 2    | Проверить схему (раздел "Schema Access")         |
| `supabase_5xx`       | `Supabase <table> 5xx: <body>`        | Supabase лежит                                                        | 2    | Повторить через минуту                           |
| `permission_denied`  | `Only owner can change roles`         | `change-role` вызван не owner'ом                                      | 2    | Использовать `ACTOR=${OP_OWNER}`                 |

## Security

- **Service role key** — полный read/write. Никогда не коммитить, не логировать, не передавать как URL-параметр. Только header.
- **PII masking**: операторские телефоны (в `users.metadata.phone`) — маскировать в stdout (`+7XXXXXXXX42`). Username и ФИО можно выводить (это публичная информация в Telegram).
- **Role change audit**: `change-role` должен записывать actor (кто меняет) в лог. Production: server-action `update-crew-member-role.ts` пишет в `crew_members.metadata.lastRoleChange = {at, by, from, to}`.
- **Permission check**: только `owner` может менять роли (production-RLS). В CLI-skills этот чек делается через `ACTOR=${OP_OWNER}` env.
- **Live-status**: `last_location` — это геолокация оператора в реальном времени. Не выводить в публичных каналах (только в приватном operator chat).
- Skill делает PATCH только в `change-role`. Остальные команды — read-only.
- Все HTTP-запросы — HTTPS.

## Related Files

**Sibling text skills:**

- `/home/z/my-project/download/skills/leads-crm-text/SKILL.md` — leads CRM (uses operator IDs as assignees)
- `/home/z/my-project/download/skills/analytics-text/SKILL.md` — analytics (crew-stats command)
- `/home/z/my-project/download/skills/franchize-catalog-text/SKILL.md` — bike catalog
- `/home/z/my-project/download/skills/rental-card-text/SKILL.md` — rental card (owner_id resolution)
- `/home/z/my-project/download/skills/rider-profile-text/SKILL.md` — rider profile (rider vs operator distinction)
- `/home/z/my-project/download/skills/reviews-text/SKILL.md` — reviews
- `/home/z/my-project/download/skills/contract-draft-text/SKILL.md` — contract draft
- `/home/z/my-project/download/skills/orders-checkout-text/SKILL.md` — orders/checkout
- `/home/z/my-project/download/skills/crew-admin-text/SKILL.md` — admin panel (manages crew)
- `/home/z/my-project/download/skills/leaderboard-text/SKILL.md` — leaderboard (operators compete)
- `/home/z/my-project/download/skills/crew-info-text/SKILL.md` — crew info (public crew info)
- `/home/z/my-project/download/skills/vip-bike-ops/SKILL.md` — umbrella meta-skill

**Server actions (source of truth):**

- `app/franchize/server-actions/update-crew-member-role.ts`
- `app/franchize/server-actions/crew-todos.ts`
- `app/franchize/server-actions/crew-todos-constants.ts`
- `app/franchize/[slug]/crew/page.tsx`
- `app/franchize/[slug]/crew/members/page.tsx`
- `app/franchize/[slug]/crew/shifts/page.tsx`

**Schema migrations:**

- `crews` table — original schema
- `crew_members` table — original schema
- `20260621000000_crew_todos.sql` — `crew_todos` table

**UI references:**

- `app/franchize/[slug]/crew/page.tsx` — main crew page
- `app/franchize/[slug]/crew/members/page.tsx` — members list
- `app/franchize/[slug]/crew/shifts/page.tsx` — shifts

**Secrets:**

- `/home/z/my-project/upload/secrets.txt`
- `/home/z/my-project/upload/supabase.txt`
