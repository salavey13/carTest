---
name: reviews-text
description: >
  Text-based reviews dashboard for VIP Bike. Lists rental reviews, ratings, comments.
  Queries Supabase REST API (curl), outputs formatted text.
  Trigger phrases (RU): "отзывы", "отзывы аренд", "рейтинги аренд", "отзыв по аренде",
  "оценки клиентов", "последние отзывы", "отзывы за неделю", "плохие отзывы",
  "хорошие отзывы", "оставить отзыв".
  Trigger phrases (EN): "reviews", "rental reviews", "ratings", "review detail",
  "customer ratings", "latest reviews", "weekly reviews", "bad reviews",
  "good reviews", "leave review".
---

# Reviews (text) — VIP Bike

Триггер-фразы (RU): **`отзывы`**, **`отзывы аренд`**, **`рейтинги аренд`**, **`отзыв по аренде`**, **`оценки клиентов`**, **`последние отзывы`**, **`отзывы за неделю`**, **`плохие отзывы`**, **`хорошие отзывы`**, **`оставить отзыв`**.
Триггер-фразы (EN): `reviews`, `rental reviews`, `ratings`, `review detail`, `customer ratings`, `latest reviews`, `weekly reviews`, `bad reviews`, `good reviews`, `leave review`.

## Overview

Text-based эквивалент страницы `/franchize/vip-bike/review/[rentalId]`. Показывает отзывы по арендам экипажа `vip-bike`: рейтинг (1–5 звёзд), комментарий, автор, дата. Поддерживает фильтр по рейтингу (низкие/высокие) и периоду. Skill read-only.

## When to Use

Use this skill when:

- Нужно увидеть последние отзывы о работе экипажа.
- Нужно отфильтровать плохие отзывы (1–2 звезды) для follow-up.
- Нужно проверить, оставил ли клиент отзыв на конкретную аренду.
- Нужно посчитать средний рейтинг экипажа за период.

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

### 1. `list-reviews [--rating 1-5] [--limit N]` — список отзывов

```bash
# Последние 20 отзывов по экипажу
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,user_id,vehicle_id,status,created_at,metadata,\
vehicle:cars!rentals_vehicle_id_fkey(id,make,model,crew_id),\
renter:users!rentals_user_id_fkey(user_id,full_name,username)\
&vehicle.crew_id=eq.${CREW_ID}\
&metadata->>review_rating=not.is.null\
&order=created_at.desc&limit=20" \
  "${HDR_PUBLIC[@]}"

# Только плохие отзывы (rating 1-2)
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,user_id,vehicle_id,created_at,metadata,\
vehicle:cars!rentals_vehicle_id_fkey(id,make,model,crew_id),\
renter:users!rentals_user_id_fkey(user_id,full_name,username)\
&vehicle.crew_id=eq.${CREW_ID}\
&metadata->>review_rating=in.(\"1\",\"2\")\
&order=created_at.desc" \
  "${HDR_PUBLIC[@]}"
```

**Логика:** Отзывы хранятся в `rentals.metadata` (jsonb) с ключами `review_rating` (1–5), `review_comment` (text), `review_at` (ISO date). Query через PostgREST jsonb arrow operator `metadata->>review_rating`.

**Пример вывода:**

```
=== Отзывы vip-bike (20 последних) ===

Рейтинг  Байк                    Рентер              Дата        Комментарий
★★★★★   BMW F800R               Иванов Иван         20.07 14:32 Отличный байк, рекомендую!
★★★★☆   Sur-Ron Light Bee X     Петров Пётр         19.07 11:05 Хорошо, но зарядка медленная.
★★☆☆☆   Segway Dirt eBike X160  Сидоров Сидор       18.07 09:18 Байк сломался через час.
★☆☆☆☆   Rawrr Mantis S          (no name)           17.07 16:40 Ужасный сервис, не вернули залог.

— Сводка —
Всего отзывов:     20
Средний рейтинг:   3.4 ★
5★: 8 | 4★: 5 | 3★: 3 | 2★: 2 | 1★: 2
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/review`

---

### 2. `review-detail <rentalId>` — отзыв на конкретную аренду

```bash
RENTAL_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,user_id,vehicle_id,status,created_at,metadata,\
vehicle:cars!rentals_vehicle_id_fkey(id,make,model,crew_id),\
renter:users!rentals_user_id_fkey(user_id,full_name,username)\
&rental_id=eq.${RENTAL_ID}" \
  "${HDR_PUBLIC[@]}" | jq '.[0] | {rental_id, status, created_at, review: .metadata.review_rating, comment: .metadata.review_comment, review_at: .metadata.review_at, renter: .renter, vehicle: .vehicle}'
```

**Пример вывода:**

```
=== Отзыв на аренду a1b2c3d4-... ===
Rental ID:     a1b2c3d4-e5f6-7890-abcd-ef1234567890
Байк:          BMW F800R (bmw-f800r-001)
Рентер:        Иванов Иван (@ivan_ivanov)
Статус аренды: completed
Создана:       21.07 14:32 (UTC)

— Отзыв —
Рейтинг:       ★★★★★ (5/5)
Комментарий:   Отличный байк, рекомендую!
Оставлен:      27.07 18:00 (UTC)
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/review/a1b2c3d4-e5f6-7890-abcd-ef1234567890`

---

### 3. `reviews-summary [--from YYYY-MM-DD] [--to YYYY-MM-DD]` — сводка за период

```bash
FROM="${FROM:-$(date -u -d '7 days ago' '+%Y-%m-%d')}"
TO="${TO:-$(date -u '+%Y-%m-%d')}"
START="${FROM}T00:00:00.000Z"
END="${TO}T23:59:59.999Z"

curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,created_at,metadata\
&crew_id=eq.${CREW_ID}\
&created_at=gte.${START}&created_at=lte.${END}\
&metadata->>review_rating=not.is.null\
&order=created_at.desc" \
  "${HDR_PUBLIC[@]}" | jq '{
    total: length,
    avg_rating: ([.[].metadata.review_rating | tonumber] | add / length),
    five: [.[] | select(.metadata.review_rating == "5")] | length,
    four: [.[] | select(.metadata.review_rating == "4")] | length,
    three: [.[] | select(.metadata.review_rating == "3")] | length,
    two: [.[] | select(.metadata.review_rating == "2")] | length,
    one: [.[] | select(.metadata.review_rating == "1")] | length
  }'
```

**Пример вывода:**

```
=== Сводка отзывов vip-bike за 2026-07-14 — 2026-07-21 ===
Всего отзывов:     12
Средний рейтинг:   4.2 ★

Распределение:
  ★★★★★  7
  ★★★★☆  3
  ★★★☆☆  1
  ★★☆☆☆  1
  ★☆☆☆☆  0

Динамика (vs предыдущая неделя): +0.3 ★
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/review`

---

### 4. `bad-reviews` — плохие отзывы (1–2 звезды)

```bash
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id,user_id,vehicle_id,created_at,metadata,\
vehicle:cars!rentals_vehicle_id_fkey(id,make,model,crew_id),\
renter:users!rentals_user_id_fkey(user_id,full_name,username)\
&vehicle.crew_id=eq.${CREW_ID}\
&metadata->>review_rating=in.(\"1\",\"2\")\
&order=created_at.desc" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Плохие отзывы vip-bike (2) ===

Рейтинг  Байк                    Рентер              Дата        Комментарий
★★☆☆☆   Segway Dirt eBike X160  Сидоров Сидор       18.07 09:18 Байк сломался через час.
★☆☆☆☆   Rawrr Mantis S          (no name)           17.07 16:40 Ужасный сервис, не вернули залог.

Рекомендация: связаться с обоими клиентами для follow-up.
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/review`

---

## Schema Access

### Public schema

- `rentals` — `rental_id` (uuid PK), `user_id`, `vehicle_id`, `status`, `created_at`, `metadata` (jsonb — `review_rating` "1"–"5", `review_comment` text, `review_at` ISO date), `crew_id`.
- `cars` — `id`, `make`, `model`, `crew_id` (для display).
- `users` — `user_id`, `username`, `full_name` (для display).

### Private schema

Reviews skill не использует private schema.

## Web Links

| Command           | Web page                                                                                              |
|-------------------|-------------------------------------------------------------------------------------------------------|
| `list-reviews`    | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/review                          |
| `review-detail`   | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/review/<rentalId>               |
| `reviews-summary` | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/review                          |
| `bad-reviews`     | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/review                          |

## Anti-hallucination: флаги, которых НЕ существует

- ~~`--json`~~ — не существует. Только текст.
- ~~`--crew <slug>`~~ — не существует. Crew захардкожен как `vip-bike`.
- ~~`--add-review <rentalId>`~~ — не существует. Skill read-only. Отзыв оставляется через UI клиентом после завершения аренды.
- ~~`--respond <rentalId> --text <comment>`~~ — не существует. Operator response не реализован в production.
- ~~`--outFile <path>`~~ — не существует. Используйте `> file.txt`.
- ~~`--format csv|md`~~ — не существует.
- ~~`--rating gt.3`~~ — не существует как named flag. Используйте PostgREST filter в URL: `&metadata->>review_rating=not.in.("1","2")`.
- ~~`--withPhotos`~~ — не существует. Отзывы не содержат фото.
- ~~`--includePii`~~ — не существует. ФИО маскируется в публичных чатах.
- ~~`--sort byRating`~~ — не существует. Сортировка по `created_at.desc` (умолчание). Для сортировки по рейтингу используйте `jq 'sort_by(.metadata.review_rating | tonumber) | reverse'`.

## Error Handling

| Stage              | Reason                                | Когда возникает                                                       | Exit | Что делать                                       |
|--------------------|---------------------------------------|-----------------------------------------------------------------------|------|--------------------------------------------------|
| `secrets_load`     | `SUPABASE_SERVICE_ROLE_KEY not found` | Путь `/home/z/my-project/upload/secrets.txt` недоступен              | 2    | Проверить путь или export env                    |
| `rental_not_found` | `Rental not found: <rentalId>`        | `review-detail` — нет аренды с таким `rental_id`                      | 2    | Проверить ID через `analytics-text rentals-dashboard` |
| `no_review`        | `No review on rental`                 | Аренда есть, но `metadata.review_rating` = null                       | 0    | Вывод: `Отзыв: — (клиент не оставил отзыв).`     |
| `supabase_4xx`     | `Supabase <table> 4xx: <body>`        | Неверный select, RLS                                                  | 2    | Проверить схему (раздел "Schema Access")         |
| `supabase_5xx`     | `Supabase <table> 5xx: <body>`        | Supabase лежит                                                        | 2    | Повторить через минуту                           |
| `date_parse`       | `Invalid date format`                 | `--from` / `--to` не парсится как YYYY-MM-DD                          | 2    | Использовать `YYYY-MM-DD`                        |
| `no_reviews`       | `[]`                                   | Нет отзывов за период / вообще                                        | 0    | Вывод: `Нет отзывов.`                            |

## Security

- **Service role key** — полный read/write. Никогда не коммитить, не логировать, не передавать как URL-параметр. Только header.
- **PII masking**: ФИО рентера — фамилия с инициалами в публичных чатах. Username можно выводить (публичная информация).
- **Private schema headers**: reviews skill использует только public schema.
- Skill полностью **read-only**.
- Все HTTP-запросы — HTTPS.
- **Review text** — это публичный контент от клиента. Не содержит PII сам по себе, но в тексте отзыва клиент мог указать телефон / адрес — не выводить такие отзывы в публичных каналах без редактуры.

## Related Files

**Sibling text skills:**

- `/home/z/my-project/download/skills/leads-crm-text/SKILL.md` — leads CRM (bad reviews → follow-up todos)
- `/home/z/my-project/download/skills/analytics-text/SKILL.md` — analytics (reviews summary in dashboard)
- `/home/z/my-project/download/skills/franchize-catalog-text/SKILL.md` — bike catalog (bike rating aggregate)
- `/home/z/my-project/download/skills/rental-card-text/SKILL.md` — rental card (review on this rental)
- `/home/z/my-project/download/skills/crew-management-text/SKILL.md` — crew management (operator performance from reviews)
- `/home/z/my-project/download/skills/rider-profile-text/SKILL.md` — rider profile (rider's reviews history)
- `/home/z/my-project/download/skills/contract-draft-text/SKILL.md` — contract draft
- `/home/z/my-project/download/skills/orders-checkout-text/SKILL.md` — orders/checkout
- `/home/z/my-project/download/skills/crew-admin-text/SKILL.md` — admin (manage bad reviews follow-up)
- `/home/z/my-project/download/skills/leaderboard-text/SKILL.md` — leaderboard (review-based ranking)
- `/home/z/my-project/download/skills/crew-info-text/SKILL.md` — crew info (public rating display)
- `/home/z/my-project/download/skills/vip-bike-ops/SKILL.md` — umbrella meta-skill

**Server actions (source of truth):**

- `app/franchize/server-actions/reviews.ts` — `submitReview()`, `getReviews()`
- `app/franchize/[slug]/review/[rentalId]/page.tsx`

**Schema migrations:**

- `rentals` table — original schema (review fields in `metadata` jsonb)
- No dedicated review table — reviews embedded in `rentals.metadata`

**UI references:**

- `app/franchize/[slug]/review/[rentalId]/page.tsx` — review form page
- `app/franchize/[slug]/community/page.tsx` — public reviews feed

**Secrets:**

- `/home/z/my-project/upload/secrets.txt`
- `/home/z/my-project/upload/supabase.txt`
