---
name: leaderboard-text
description: >
  Text-based riders & operators leaderboard for VIP Bike. Shows top renters, top operators,
  most-rented bikes, revenue leaderboard. Queries Supabase REST API (curl), outputs
  formatted text.
  Trigger phrases (RU): "лидерборд", "рейтинг райдеров", "топ клиентов", "топ операторов",
  "кто больше арендовал", "лучший оператор", "самый популярный байк", "рейтинг байков",
  "конкурс операторов", "доска почёта".
  Trigger phrases (EN): "leaderboard", "riders ranking", "top renters", "top operators",
  "best operator", "most rented bike", "bikes ranking", "operators contest",
  "hall of fame".
---

# Leaderboard (text) — VIP Bike

Триггер-фразы (RU): **`лидерборд`**, **`рейтинг райдеров`**, **`топ клиентов`**, **`топ операторов`**, **`кто больше арендовал`**, **`лучший оператор`**, **`самый популярный байк`**, **`рейтинг байков`**, **`конкурс операторов`**, **`доска почёта`**.
Триггер-фразы (EN): `leaderboard`, `riders ranking`, `top renters`, `top operators`, `best operator`, `most rented bike`, `bikes ranking`, `operators contest`, `hall of fame`.

## Overview

Text-based эквивалент страницы `/franchize/vip-bike/leaderboard`. Показывает рейтинги за период: топ райдеров (по количеству аренд и выручке), топ операторов (по закрытым задачам и созданным арендам), топ байков (по арендам и выручке). Skill read-only.

## When to Use

Use this skill when:

- Нужно увидеть топ-10 клиентов за месяц (для персональной рассылки / бонусов).
- Нужно оценить эффективность операторов (кто закрыл больше задач).
- Нужно понять, какие байки приносят больше выручки.
- Нужно вывести "доску почёта" для мотивации операторов.
- Нужно собрать данные для конкурса "оператор месяца".

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
HDR_PRIVATE=(-H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "Accept: application/json" -H "Accept-Profile: private")
```

## Commands

### 1. `top-riders [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--limit N]` — топ райдеров

```bash
FROM="${FROM:-$(date -u -d '30 days ago' '+%Y-%m-%d')}"
TO="${TO:-$(date -u '+%Y-%m-%d')}"
START="${FROM}T00:00:00.000Z"
END="${TO}T23:59:59.999Z"
LIMIT="${LIMIT:-10}"

# All completed/active rentals in period
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,user_id,total_cost,status,created_at,\
renter:users!rentals_user_id_fkey(user_id,full_name,username)\
&crew_id=eq.${CREW_ID}&status=in.(active,completed)\
&created_at=gte.${START}&created_at=lte.${END}\
&order=created_at.desc" \
  "${HDR_PUBLIC[@]}" | jq --argjson limit "$LIMIT" '
    group_by(.user_id)
    | map({
        user_id: .[0].user_id,
        full_name: .[0].renter.full_name,
        username: .[0].renter.username,
        rentals_count: length,
        total_revenue: ([.[].total_cost // 0] | add)
      })
    | sort_by(-.total_revenue)
    | .[0:$limit]
  '
```

**Пример вывода:**

```
=== Топ-10 райдеров vip-bike за 21.06 — 21.07.2026 ===

#   Райдер                  Аренд   Выручка      Средний чек
1   Иванов Иван             5       70 000 ₽     14 000 ₽
2   Петров Пётр             4       52 000 ₽     13 000 ₽
3   Сидоров Сидор           3       36 000 ₽     12 000 ₽
4   Закиров Артур           3       31 500 ₽     10 500 ₽
5   Логунов Егор            2       24 000 ₽     12 000 ₽
6   Молев Георгий           2       18 000 ₽     9 000 ₽
7   Левин Дмитрий           1       14 000 ₽     14 000 ₽
8   Киргинцев Михаил        1       12 000 ₽     12 000 ₽
9   Шевчук Эдуард           1       10 000 ₽     10 000 ₽
10  (no name)               1       8 500 ₽      8 500 ₽

— Сводка —
Всего райдеров:    48
Всего аренд:       78
Общая выручка:     654 500 ₽
Средний чек:       8 391 ₽
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leaderboard`

---

### 2. `top-operators [--from YYYY-MM-DD] [--to YYYY-MM-DD]` — топ операторов

```bash
FROM="${FROM:-$(date -u -d '30 days ago' '+%Y-%m-%d')}"
TO="${TO:-$(date -u '+%Y-%m-%d')}"
START="${FROM}T00:00:00.000Z"
END="${TO}T23:59:59.999Z"

# 1. Todos closed per operator
curl -sS "${SUPABASE_URL}/rest/v1/crew_todos?\
select=id,assigned_to,status,completed_at,category\
&crew_id=eq.${CREW_ID}&status=eq.done\
&completed_at=gte.${START}&completed_at=lte.${END}" \
  "${HDR_PUBLIC[@]}" | jq 'group_by(.assigned_to) | map({user_id: .[0].assigned_to, todos_done: length}) | sort_by(-.todos_done)'

# 2. Rentals created per operator (created_by_operator_chat_id)
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,created_by_operator_chat_id,total_cost,status\
&crew_id=eq.${CREW_ID}\
&created_at=gte.${START}&created_at=lte.${END}" \
  "${HDR_PUBLIC[@]}" | jq 'group_by(.created_by_operator_chat_id) | map({user_id: .[0].created_by_operator_chat_id, rentals_created: length, revenue: ([.[].total_cost // 0] | add)}) | sort_by(-.rentals_created)'

# 3. Operator names (for display)
curl -sS "${SUPABASE_URL}/rest/v1/users?\
select=user_id,full_name,username\
&user_id=in.(${OP_OWNER},${OP_CO_OWNER},${OP_ADMIN},${OP_MEMBER})" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Топ операторов vip-bike за 21.06 — 21.07.2026 ===

— По закрытым задачам —
#   Оператор                  Задач закрыто   Аренд создано   Выручка
1   salavey13 (admin)         42              18              245 000 ₽
2   Roman_Vip_Bike_Electro    35              14              198 000 ₽
3   I_O_S_NN (owner)          28              10              142 000 ₽
4   DJORUDJOV (member)        22              8               69 500 ₽

— Оператор месяца —
🏆 salavey13 (Артур С.) — 42 закрытые задачи, 18 аренд создано, 245 000 ₽ выручки.
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leaderboard`

---

### 3. `top-bikes [--from YYYY-MM-DD] [--to YYYY-MM-DD]` — топ байков

```bash
FROM="${FROM:-$(date -u -d '30 days ago' '+%Y-%m-%d')}"
TO="${TO:-$(date -u '+%Y-%m-%d')}"
START="${FROM}T00:00:00.000Z"
END="${TO}T23:59:59.999Z"

curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,vehicle_id,total_cost,status,created_at,\
vehicle:cars!rentals_vehicle_id_fkey(id,make,model,crew_id)\
&vehicle.crew_id=eq.${CREW_ID}&status=in.(active,completed)\
&created_at=gte.${START}&created_at=lte.${END}" \
  "${HDR_PUBLIC[@]}" | jq '
    group_by(.vehicle_id)
    | map({
        bike_id: .[0].vehicle_id,
        make: .[0].vehicle.make,
        model: .[0].vehicle.model,
        rentals_count: length,
        revenue: ([.[].total_cost // 0] | add)
      })
    | sort_by(-.rentals_count)
  '
```

**Пример вывода:**

```
=== Топ байков vip-bike за 21.06 — 21.07.2026 ===

#   Байк                       Аренд   Выручка      Средняя/аренда
1   BMW F800R                  18      180 000 ₽    10 000 ₽
2   Sur-Ron Light Bee X        15      120 000 ₽    8 000 ₽
3   79BIKE Falcon Lynx         12      102 000 ₽    8 500 ₽
4   Segway Dirt eBike X160     10      70 000 ₽     7 000 ₽
5   Rawrr Mantis S             8       64 000 ₽     8 000 ₽

— Сводка —
Всего байков в аренде:    5
Всего аренд:              63
Общая выручка:            536 000 ₽
Утилизация парка:         87% (5 байков из 5 в аренде за период)
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leaderboard`

---

### 4. `hall-of-fame` — доска почёта (всё время)

```bash
# All-time top riders (no date filter)
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,user_id,total_cost,status,\
renter:users!rentals_user_id_fkey(user_id,full_name,username)\
&crew_id=eq.${CREW_ID}&status=in.(active,completed)" \
  "${HDR_PUBLIC[@]}" | jq '
    group_by(.user_id)
    | map({
        user_id: .[0].user_id,
        full_name: .[0].renter.full_name,
        username: .[0].renter.username,
        rentals_count: length,
        total_revenue: ([.[].total_cost // 0] | add)
      })
    | sort_by(-.total_revenue)
    | .[0:5]
  '

# All-time top operators
curl -sS "${SUPABASE_URL}/rest/v1/crew_todos?\
select=id,assigned_to,status\
&crew_id=eq.${CREW_ID}&status=eq.done" \
  "${HDR_PUBLIC[@]}" | jq 'group_by(.assigned_to) | map({user_id: .[0].assigned_to, todos_done: length}) | sort_by(-.todos_done) | .[0:5]'
```

**Пример вывода:**

```
=== Доска почёта vip-bike (за всё время) ===

— Топ-5 райдеров —
🏆 1.  Иванов Иван             42 аренды    612 000 ₽
   2.  Петров Пётр             35 аренд     489 000 ₽
   3.  Сидоров Сидор           28 аренд     392 000 ₽
   4.  Закиров Артур           22 аренды    280 000 ₽
   5.  Логунов Егор            18 аренд     225 000 ₽

— Топ-5 операторов (по задачам) —
🏆 1.  salavey13 (admin)         312 задач закрыто
   2.  Roman_Vip_Bike_Electro    258 задач закрыто
   3.  I_O_S_NN (owner)          187 задач закрыто
   4.  DJORUDJOV (member)        142 задачи закрыто

— Самый арендуемый байк —
🏆 BMW F800R (bmw-f800r-001) — 142 аренды, 1 425 000 ₽ выручки за всё время.
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leaderboard`

---

### 5. `riders-with-reviews` — рейтинг по отзывам

```bash
FROM="${FROM:-$(date -u -d '30 days ago' '+%Y-%m-%d')}"
TO="${TO:-$(date -u '+%Y-%m-%d')}"
START="${FROM}T00:00:00.000Z"
END="${TO}T23:59:59.999Z"

curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,user_id,metadata,\
renter:users!rentals_user_id_fkey(user_id,full_name,username)\
&crew_id=eq.${CREW_ID}\
&created_at=gte.${START}&created_at=lte.${END}\
&metadata->>review_rating=not.is.null" \
  "${HDR_PUBLIC[@]}" | jq '
    group_by(.user_id)
    | map({
        user_id: .[0].user_id,
        full_name: .[0].renter.full_name,
        reviews_count: length,
        avg_rating: ([.[].metadata.review_rating | tonumber] | add / length)
      })
    | sort_by(-.avg_rating)
    | .[0:10]
  '
```

**Пример вывода:**

```
=== Топ райдеров по отзывам за 21.06 — 21.07.2026 ===

#   Райдер                  Отзывов   Средний рейтинг
1   Иванов Иван             5         ★ 4.8
2   Петров Пётр             4         ★ 4.5
3   Закиров Артур           3         ★ 4.3
4   Сидоров Сидор           3         ★ 3.7
5   Логунов Егор            2         ★ 5.0
...
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leaderboard`

---

## Schema Access

### Public schema

- `rentals` — `rental_id`, `user_id`, `vehicle_id`, `status`, `total_cost`, `created_at`, `crew_id`, `created_by_operator_chat_id`, `metadata` (jsonb — `review_rating`).
- `users` — `user_id`, `username`, `full_name`.
- `cars` — `id`, `make`, `model`, `crew_id`.
- `crew_todos` — `id`, `crew_id`, `assigned_to`, `status`, `completed_at`, `category`.
- `crew_members` — `crew_id`, `user_id`, `role`.

### Private schema

- `sale_contract_artifacts` — для revenue от продаж (если нужно объединить с rentals revenue).

## Web Links

| Command              | Web page                                                                              |
|----------------------|---------------------------------------------------------------------------------------|
| `top-riders`         | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leaderboard     |
| `top-operators`      | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leaderboard     |
| `top-bikes`          | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leaderboard     |
| `hall-of-fame`       | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leaderboard     |
| `riders-with-reviews`| https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/leaderboard     |

## Anti-hallucination: флаги, которых НЕ существует

- ~~`--json`~~ — не существует. Только текст.
- ~~`--crew <slug>`~~ — не существует. Crew захардкожен как `vip-bike`.
- ~~`--includePii`~~ — не существует. ФИО маскируется в публичных чатах.
- ~~`--withBadges`~~ — не существует. Бейджи берутся из `users.badges` jsonb, если нужно — добавьте в select.
- ~~`--groupBy week`~~ — не существует. Группировка по дням/неделям — через `jq` post-processing.
- ~~`--exportCsv`~~ — не существует. Используйте `jq -r` для CSV-вывода.
- ~~`--outFile <path>`~~ — не существует. Используйте `> file.txt`.
- ~~`--format csv|md`~~ — не существует.
- ~~`hall-of-fame --reset`~~ — не существует. Skill read-only. Сброс статистики — через SQL.
- ~~`top-riders --excludeAdmins`~~ — не существует. Администраторы могут быть и клиентами; фильтрация — через `jq`.

## Error Handling

| Stage              | Reason                                | Когда возникает                                                       | Exit | Что делать                                       |
|--------------------|---------------------------------------|-----------------------------------------------------------------------|------|--------------------------------------------------|
| `secrets_load`     | `SUPABASE_SERVICE_ROLE_KEY not found` | Путь `/home/z/my-project/upload/secrets.txt` недоступен              | 2    | Проверить путь или export env                    |
| `supabase_4xx`     | `Supabase <table> 4xx: <body>`        | Неверный select, RLS                                                  | 2    | Проверить схему (раздел "Schema Access")         |
| `supabase_5xx`     | `Supabase <table> 5xx: <body>`        | Supabase лежит                                                        | 2    | Повторить через минуту                           |
| `date_parse`       | `Invalid date format`                 | `--from` / `--to` не YYYY-MM-DD                                       | 2    | Использовать `YYYY-MM-DD`                        |
| `no_rentals`       | `[]`                                   | Нет аренд за период                                                  | 0    | Вывод: `Нет аренд за период.`                    |
| `no_todos`         | `[]`                                   | Нет закрытых задач за период                                          | 0    | Вывод: `Нет закрытых задач.`                     |
| `no_reviews`       | `[]`                                   | Нет отзывов за период                                                 | 0    | Вывод: `Нет отзывов.`                            |
| `jq_parse`         | `jq: parse error`                     | Supabase вернул HTML вместо JSON (5xx)                                | 2    | Проверить stderr Supabase                        |

## Security

- **Service role key** — полный read/write. Никогда не коммитить, не логировать, не передавать как URL-параметр. Только header.
- **PII masking**: ФИО райдеров — фамилия с инициалами в публичных чатах. Username можно выводить. Телефоны / email не выводить в leaderboard.
- **Operator names** — публичная информация (это операторы экипажа, не клиенты).
- **Revenue figures** — чувствительная коммерческая информация. Не выводить в публичных каналах (только в приватном operator chat).
- Skill полностью **read-only**.
- Все HTTP-запросы — HTTPS.

## Related Files

**Sibling text skills:**

- `/home/z/my-project/download/skills/leads-crm-text/SKILL.md` — leads CRM (top riders from leads)
- `/home/z/my-project/download/skills/analytics-text/SKILL.md` — analytics (revenue basis for leaderboard)
- `/home/z/my-project/download/skills/franchize-catalog-text/SKILL.md` — catalog (top bikes reference)
- `/home/z/my-project/download/skills/rental-card-text/SKILL.md` — rental card (each rental counted)
- `/home/z/my-project/download/skills/crew-management-text/SKILL.md` — crew management (operators leaderboard)
- `/home/z/my-project/download/skills/rider-profile-text/SKILL.md` — rider profile (rider's leaderboard position)
- `/home/z/my-project/download/skills/reviews-text/SKILL.md` — reviews (riders-with-reviews command)
- `/home/z/my-project/download/skills/contract-draft-text/SKILL.md` — contract draft
- `/home/z/my-project/download/skills/orders-checkout-text/SKILL.md` — orders
- `/home/z/my-project/download/skills/crew-admin-text/SKILL.md` — admin (manages contest rules)
- `/home/z/my-project/download/skills/crew-info-text/SKILL.md` — crew info (public leaderboard display)
- `/home/z/my-project/download/skills/vip-bike-ops/SKILL.md` — umbrella meta-skill

**Server actions (source of truth):**

- `app/franchize/[slug]/leaderboard/page.tsx` — leaderboard page
- `app/franchize/server-actions/rentals-dashboard.ts` — rentals data
- `app/franchize/server-actions/crew-todos.ts` — todos data

**Schema migrations:**

- `rentals` table — original schema
- `crew_todos` table — `20260621000000_crew_todos.sql`
- `users` table — original schema (badges, full_name)

**UI references:**

- `app/franchize/[slug]/leaderboard/page.tsx` — leaderboard page

**Secrets:**

- `/home/z/my-project/upload/secrets.txt`
- `/home/z/my-project/upload/supabase.txt`
