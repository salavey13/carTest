---
name: crew-info-text
description: >
  Text-based public crew info for VIP Bike. Shows crew name, description, logo, contacts,
  hq_location, public catalog count, member count. Queries Supabase REST API (curl),
  outputs formatted text.
  Trigger phrases (RU): "информация об экипаже", "контакты экипажа", "где экипаж",
  "адрес экипажа", "описание экипажа", "логотип экипажа", "сайт экипажа",
  "социальные сети экипажа", "vk экипажа", "telegram экипажа".
  Trigger phrases (EN): "crew info", "crew contacts", "crew address", "crew description",
  "crew logo", "crew website", "crew socials", "crew vk", "crew telegram".
---

# Crew Info (text) — VIP Bike

Триггер-фразы (RU): **`информация об экипаже`**, **`контакты экипажа`**, **`где экипаж`**, **`адрес экипажа`**, **`описание экипажа`**, **`логотип экипажа`**, **`сайт экипажа`**, **`социальные сети экипажа`**, **`vk экипажа`**, **`telegram экипажа`**.
Триггер-фразы (EN): `crew info`, `crew contacts`, `crew address`, `crew description`, `crew logo`, `crew website`, `crew socials`, `crew vk`, `crew telegram`.

## Overview

Text-based эквивалент главной страницы `/franchize/vip-bike` и `/franchize/vip-bike/about` / `/franchize/vip-bike/contacts`. Показывает публичную информацию об экипаже `vip-bike`: название, описание, логотип, контакты (телефон, email, telegram, vk), адрес (hq_location), количество ТС в каталоге, количество операторов.

## When to Use

Use this skill when:

- Нужно быстро показать публичные контакты экипажа клиенту в Telegram.
- Нужно проверить, заполнены ли публичные поля (`description`, `logo_url`, `hq_location`, контакты).
- Нужно посчитать "social proof" — сколько ТС в каталоге, сколько операторов.
- Нужно сверить slug экипажа с ID для других skills.

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

### 1. `crew-info` — основная информация об экипаже

```bash
curl -sS "${SUPABASE_URL}/rest/v1/crews?\
select=id,name,slug,description,logo_url,owner_id,hq_location,metadata,created_at,updated_at\
&slug=eq.${CREW_SLUG}" \
  "${HDR_PUBLIC[@]}" | jq '.[0]'
```

**Пример вывода:**

```
=== Экипаж: VIP Bike ===
ID:               2d5fde70-1dd3-4f0d-8d72-66ccf6908746
Slug:             vip-bike
Название:         VIP Bike
Создан:           21.05.2026
Обновлён:         18.07.2026
Owner ID:         356282674 (I_O_S_NN)

— Описание —
Экипаж проката и продажи электробайков в Москве. BMW F800R, Sur-Ron, Segway, Rawrr.
Работаем с 2026 года. Доставка по городу, залог, контракт через Telegram WebApp.

— Локация —
HQ:               Москва, ул. Пресненская Набережная 12
Координаты:       (не указаны)

— Логотип —
URL:              https://.../vip-bike-logo.png

— Метаданные —
is_provider:      true
verified:         true
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike`

---

### 2. `crew-contacts` — контакты экипажа

```bash
curl -sS "${SUPABASE_URL}/rest/v1/crews?\
select=metadata\
&slug=eq.${CREW_SLUG}" \
  "${HDR_PUBLIC[@]}" | jq -r '.[0].metadata.contacts // {}'
```

**Логика:** Контакты хранятся в `crews.metadata.contacts` (jsonb): `{phone, email, telegram, vk, instagram, website, whatsapp}`.

**Пример вывода:**

```
=== Контакты vip-bike ===
Телефон:     +7 (495) 123-45-67
Email:       info@vip-bike.ru
Telegram:    @vip_bike_support
VK:          https://vk.com/vip_bike
Instagram:   https://instagram.com/vip_bike
WhatsApp:    +7 (495) 123-45-67
Сайт:        https://vip-bike.ru

— Основной канал —
Telegram:    @vip_bike_support (быстрее всего)
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/contacts`

---

### 3. `crew-stats` — публичная статистика экипажа

```bash
# 1. Crew basic info
curl -sS "${SUPABASE_URL}/rest/v1/crews?select=id,name,slug,created_at&slug=eq.${CREW_SLUG}" \
  "${HDR_PUBLIC[@]}"

# 2. Total bikes in catalog
curl -sS "${SUPABASE_URL}/rest/v1/cars?\
select=id\
&crew_id=eq.${CREW_ID}&is_test_result=eq.false" \
  "${HDR_PUBLIC[@]}" | jq 'length' \
  -H "Prefer: count=exact"

# 3. Active members count
curl -sS "${SUPABASE_URL}/rest/v1/crew_members?\
select=id\
&crew_id=eq.${CREW_ID}&membership_status=eq.active" \
  "${HDR_PUBLIC[@]}" | jq 'length'

# 4. Total rentals (all-time)
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=rental_id\
&crew_id=eq.${CREW_ID}&status=in.(active,completed)" \
  "${HDR_PUBLIC[@]}" | jq 'length'

# 5. Total reviews count + avg rating
curl -sS "${SUPABASE_URL}/rest/v1/rentals?\
select=metadata\
&crew_id=eq.${CREW_ID}&metadata->>review_rating=not.is.null" \
  "${HDR_PUBLIC[@]}" | jq '{count: length, avg: ([.[].metadata.review_rating | tonumber] | add / length)}'
```

**Пример вывода:**

```
=== Статистика vip-bike (public) ===
Экипаж создан:        21.05.2026 (2 месяца назад)
ТЦ в каталоге:        5 байков
Операторов:           4 (active)
Всего аренд:          87 (active + completed)
Отзывов:              42
Средний рейтинг:      4.4 ★

— Социальное доказательство —
"Более 80 довольных клиентов с мая 2026 года."
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike`

---

### 4. `crew-about` — расширенное описание

```bash
curl -sS "${SUPABASE_URL}/rest/v1/crews?\
select=description,metadata.about,metadata.faq,metadata.team\
&slug=eq.${CREW_SLUG}" \
  "${HDR_PUBLIC[@]}" | jq '.[0]'
```

**Логика:** Расширенное описание хранится в `crews.metadata` (jsonb):
- `about` — длинное описание (markdown).
- `faq` — массив `{question, answer}`.
- `team` — массив `{user_id, role, bio, photo_url}` для команды.

**Пример вывода:**

```
=== О экипаже vip-bike ===

— Описание —
Экипаж проката и продажи электробайков в Москве. BMW F800R, Sur-Ron, Segway, Rawrr.
Работаем с 2026 года. Доставка по городу, залог, контракт через Telegram WebApp.

— О нас (extended) —
Мы молодая команда энтузиастов электротранспорта. Started в 2026 году с одного BMW F800R,
сейчас в парке 5 байков. Цель — сделать электробайки доступными для всех.

— FAQ (4) —
Q: Нужны ли права?
A: Для электробайков до 4 кВт — нет. Для более мощных — категория A или A1.

Q: Какой залог?
A: От 20 000 ₽ до 50 000 ₽ в зависимости от байка. Альтернатива — СТС вашего ТС.

Q: Доставка?
A: Бесплатно по Москве в пределах МКАД. За МКАД — 30 ₽/км.

Q: Скидки?
A: Скидки от 5% при аренде от 3 дней. Подробности — у оператора.

— Команда (4) —
I_O_S_NN (owner)        — Илья, основатель экипажа.
Roman_Vip_Bike_Electro  — Роман, со-основатель, отвечает за продажи.
salavey13 (admin)       — Артур, оператор, ведёт CRM и контракты.
DJORUDJOV (member)      — Джордан, механик, отвечает за ТО.
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/about`

---

### 5. `crew-resolve <slug>` — резолв slug → ID (helper для других skills)

```bash
SLUG="${1:-vip-bike}"
curl -sS "${SUPABASE_URL}/rest/v1/crews?\
select=id,name,slug,owner_id\
&slug=eq.${SLUG}" \
  "${HDR_PUBLIC[@]}"
```

**Пример вывода:**

```
=== Crew resolve: vip-bike ===
ID:           2d5fde70-1dd3-4f0d-8d72-66ccf6908746
Name:         VIP Bike
Slug:         vip-bike
Owner ID:     356282674
```

🌐 Web: `https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike`

---

## Schema Access

### Public schema

- `crews` — `id` (uuid PK), `name`, `description`, `logo_url`, `owner_id`, `created_at`, `updated_at`, `slug`, `hq_location`, `metadata` (jsonb — `contacts` `{phone, email, telegram, vk, instagram, website, whatsapp}`, `about` text, `faq` array, `team` array, `palette` jsonb, `promotions` array, `messageTemplates` array, `is_provider` bool, `verified` bool).
- `cars` — для подсчёта количества ТС в каталоге.
- `crew_members` — для подсчёта активных операторов.
- `rentals` — для подсчёта всего аренд / отзывов.
- `users` — для display owner_id → full_name.

### Private schema

Crew info skill не использует private schema (всё public).

## Web Links

| Command         | Web page                                                                              |
|-----------------|---------------------------------------------------------------------------------------|
| `crew-info`     | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike                 |
| `crew-contacts` | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/contacts        |
| `crew-stats`    | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike                 |
| `crew-about`    | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike/about           |
| `crew-resolve`  | https://v0-car-test-salavey13s-projects.vercel.app/franchize/vip-bike                 |

## Anti-hallucination: флаги, которых НЕ существует

- ~~`--json`~~ — не существует. Только текст.
- ~~`--crew <slug>`~~ — не существует. Crew захардкожен как `vip-bike`. Используйте `crew-resolve <slug>` для другого экипажа.
- ~~`--includePrivate`~~ — не существует. Private поля (palette, messageTemplates) не выводятся.
- ~~`--editContact <field> <value>`~~ — не существует. Skill read-only. Изменение контактов — через `crew-admin-text`.
- ~~`--outFile <path>`~~ — не существует. Используйте `> file.txt`.
- ~~`--format csv|md`~~ — не существует.
- ~~`--withReviews`~~ — не существует. Используйте `reviews-text` skill для отзывов.
- ~~`--withBikes`~~ — не существует. Используйте `franchize-catalog-text` skill для каталога.
- ~~`--withMembers`~~ — не существует. Используйте `crew-management-text` skill для участников.
- ~~`crew-stats --allCrews`~~ — не существует. Skill захардкожен под `vip-bike`.

## Error Handling

| Stage             | Reason                                | Когда возникает                                                       | Exit | Что делать                                       |
|-------------------|---------------------------------------|-----------------------------------------------------------------------|------|--------------------------------------------------|
| `secrets_load`    | `SUPABASE_SERVICE_ROLE_KEY not found` | Путь `/home/z/my-project/upload/secrets.txt` недоступен              | 2    | Проверить путь или export env                    |
| `crew_not_found`  | `Crew not found: <slug>`              | `crew-resolve` — нет экипажа с таким `slug`                           | 2    | Проверить slug                                   |
| `no_contacts`     | `No contacts in metadata`             | `crew-contacts` — `metadata.contacts` пусто или null                  | 0    | Вывод: `Контакты: — (не заполнены).`             |
| `no_about`        | `No about section`                    | `crew-about` — `metadata.about` пусто                                 | 0    | Вывод: `Расширенное описание: — (не заполнено).` |
| `supabase_4xx`    | `Supabase <table> 4xx: <body>`        | Неверный select, RLS                                                  | 2    | Проверить схему (раздел "Schema Access")         |
| `supabase_5xx`    | `Supabase <table> 5xx: <body>`        | Supabase лежит                                                        | 2    | Повторить через минуту                           |

## Security

- **Service role key** — полный read/write. Никогда не коммитить, не логировать, не передавать как URL-параметр. Только header.
- **PII handling**: crew info skill выводит только публичные контакты экипажа. Операторские телефоны в `users.metadata.phone` НЕ выводятся. Если в `metadata.contacts.phone` указан личный телефон оператора — он маскируется в публичных чатах.
- **Owner ID** — публичная информация (можно вывести).
- Skill полностью **read-only**.
- Все HTTP-запросы — HTTPS.

## Related Files

**Sibling text skills:**

- `/home/z/my-project/download/skills/leads-crm-text/SKILL.md` — leads CRM
- `/home/z/my-project/download/skills/analytics-text/SKILL.md` — analytics
- `/home/z/my-project/download/skills/franchize-catalog-text/SKILL.md` — catalog (bikes count)
- `/home/z/my-project/download/skills/rental-card-text/SKILL.md` — rental card
- `/home/z/my-project/download/skills/crew-management-text/SKILL.md` — crew management (members count)
- `/home/z/my-project/download/skills/rider-profile-text/SKILL.md` — rider profile
- `/home/z/my-project/download/skills/reviews-text/SKILL.md` — reviews (avg rating display)
- `/home/z/my-project/download/skills/contract-draft-text/SKILL.md` — contract draft
- `/home/z/my-project/download/skills/orders-checkout-text/SKILL.md` — orders
- `/home/z/my-project/download/skills/crew-admin-text/SKILL.md` — admin (edits crew info)
- `/home/z/my-project/download/skills/leaderboard-text/SKILL.md` — leaderboard
- `/home/z/my-project/download/skills/vip-bike-ops/SKILL.md` — umbrella meta-skill

**Server actions (source of truth):**

- `app/franchize/[slug]/page.tsx` — main crew page
- `app/franchize/[slug]/about/page.tsx` — about page
- `app/franchize/[slug]/contacts/page.tsx` — contacts page
- `app/franchize/server-actions/config.ts` — crew config CRUD

**Schema migrations:**

- `crews` table — original schema
- `crew_members` table — original schema

**UI references:**

- `app/franchize/[slug]/page.tsx` — main landing
- `app/franchize/[slug]/about/page.tsx` — about page
- `app/franchize/[slug]/contacts/page.tsx` — contacts page

**Secrets:**

- `/home/z/my-project/upload/secrets.txt`
- `/home/z/my-project/upload/supabase.txt`
