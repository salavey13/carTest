---
name: deposit-tracker
description: >
  Учёт залогов по арендам VIP BIKE для оператора в чате: собран/вернут, нал/перевод/звёзды,
  автопоиск непreturned залогов на завершённых арендах, суммарная задолженность перед клиентами.
  Триггеры: депозит, залог, возврат депозита, залоги сегодня, залоги не возвращены,
  непreturned залоги, кто должен получить залог, собери залог, отметь возврат залога,
  сколько залогов зависло, отчет по залогам, deposit tracker.
---

# deposit-tracker (бот VIP BIKE, операторский навык)

Триггер-фразы: **депозит**, **залог**, **возврат депозита**, **залоги сегодня**, **залоги не возвращены**, **кто должен получить залог**, **собери залог**, **отметь возврат залога**, **сколько залогов зависло**, **отчёт по залогам**.

Результат — текстом в чат оператору. Никаких веб-страниц, никаких внешних мессенджеров — всё внутри этого бота.

## Supabase Access

Переменные приходят из `.env` сервиса (`EnvironmentFile=/opt/claudeclaw/vip-bike/.env`):

```bash
# Фолбэк для ручного запуска (debug как юзер claudeclaw):
[ -z "$SUPABASE_SERVICE_ROLE_KEY" ] && { set -a; . /opt/claudeclaw/vip-bike/.env; set +a; }

SUPABASE_URL="${SUPABASE_URL:?no SUPABASE_URL in env}"
KEY="$SUPABASE_SERVICE_ROLE_KEY"
CREW_ID="${CREW_ID:-2d5fde70-1dd3-4f0d-8d72-66ccf6908746}"
CREW_SLUG="${CREW_SLUG:-vip-bike}"
OPERATOR_ID="${ALLOWED_CHAT_ID:?no ALLOWED_CHAT_ID}"   # телеграм-id оператора, что запускает команду
URL="$SUPABASE_URL"
```

Service-role ключ даёт обход RLS. **Никогда** не логировать в stdout/stderr, не передавать как URL-параметр, не коммитить.

## Что трекает

Каждая аренда подразумевает возвратный залог. До этого навыка залоги не трекались вообще: непонятно, собран ли, сколько, нал или перевод, возвращён ли.

В таблице `rentals` для этого есть 7 колонок:
- `deposit_amount` — сумма (₽)
- `deposit_method` — `'cash'` | `'bank_transfer'` | `'telegram_stars'` | `'none'`
- `deposit_collected_at` — когда собрали
- `deposit_collected_by` — кто собрал (telegram chat_id оператора)
- `deposit_returned` — boolean, возвращён ли
- `deposit_returned_at` — когда вернули
- `deposit_returned_by` — кто вернул

Плюс таблица `deposit_log` для аудита (обязательна при изменениях).

## Команды

### 1. `deposits-status [--date YYYY-MM-DD]`
Все залоги по арендам за дату (по умолчанию сегодня MSK): собранные, возвращённые, незакрытые.

```bash
TODAY="${1:-$(TZ=Europe/Moscow date +%Y-%m-%d)}"
curl -s "$URL/rest/v1/rentals?select=rental_id,vehicle_id,user_id,status,deposit_amount,deposit_method,deposit_collected_at,deposit_returned,deposit_returned_at,total_cost&crew_id=eq.$CREW_ID&or=(and(created_at.gte.${TODAY}T00:00:00Z,created_at.lte.${TODAY}T23:59:59Z),and(agreed_start_date.lte.${TODAY}T23:59:59Z,agreed_end_date.gte.${TODAY}T00:00:00Z))&order=created_at.desc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Вывод по каждой аренде:
- 🏍 Байк · арендатор · статус
- 💰 Залог: 20 000 ₽ · 💵 нал · ✅ возвращён (14:30)
- Или: 💰 Залог: 20 000 ₽ · 🏦 перевод · ⚠️ НЕ возвращён

### 2. `deposits-outstanding`
Все аренды, где залог собран, но НЕ возвращён (деньги должны клиенты получить обратно).

```bash
curl -s "$URL/rest/v1/rentals?select=rental_id,vehicle_id,user_id,status,deposit_amount,deposit_method,deposit_collected_at,agreed_end_date&crew_id=eq.$CREW_ID&deposit_collected_at=not.is.null&deposit_returned=eq.false&order=agreed_end_date.asc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Вывод: суммарная задолженность экипажа перед клиентами + список клиентов, кому должны.

### 3. `deposit-collect <rentalId> --amount <rub> --method <cash|bank_transfer|telegram_stars>`
**Мутирует состояние.** Записывает, что залог по аренде собран.

```bash
RENTAL_ID="<rentalId>"
AMOUNT="<rub>"
METHOD="cash"   # cash | bank_transfer | telegram_stars

curl -s -X PATCH "$URL/rest/v1/rentals?rental_id=eq.${RENTAL_ID}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"deposit_amount\":${AMOUNT},\"deposit_method\":\"${METHOD}\",\"deposit_collected_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"deposit_collected_by\":\"${OPERATOR_ID}\"}"

# Audit-запись в deposit_log (private schema)
curl -s -X POST "$URL/rest/v1/deposit_log" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: private" -H "Content-Profile: private" \
  -d "{\"rental_id\":\"${RENTAL_ID}\",\"action\":\"collected\",\"amount\":${AMOUNT},\"method\":\"${METHOD}\",\"operator_chat_id\":\"${OPERATOR_ID}\"}"
```

### 4. `deposit-return <rentalId>`
**Мутирует состояние.** Отмечает залог как возвращённый.

```bash
RENTAL_ID="<rentalId>"

curl -s -X PATCH "$URL/rest/v1/rentals?rental_id=eq.${RENTAL_ID}" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"deposit_returned\":true,\"deposit_returned_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"deposit_returned_by\":\"${OPERATOR_ID}\"}"

# Audit-запись
curl -s -X POST "$URL/rest/v1/deposit_log" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: private" -H "Content-Profile: private" \
  -d "{\"rental_id\":\"${RENTAL_ID}\",\"action\":\"returned\",\"operator_chat_id\":\"${OPERATOR_ID}\"}"
```

### 5. `deposits-summary [--from YYYY-MM-DD] [--to YYYY-MM-DD]`
Сводка за период: всего собрано, всего возвращено, всего незакрыто, разбивка по способам.

## Авто-фичи (БД-триггеры, не от навыка)

- **Авто-возврат при завершении аренды**: когда `rentals.status` → `completed`, триггер БД сам ставит `deposit_returned=true` и пишет в лог. Забытых залогов не остаётся.
- **Boss-алерт**: если завершённая аренда висит с `deposit_returned=false` > 24ч — алерт в чат оператору.

## Безопасность

- **PII**: телефон/ФИО арендатора маскировать (`+7…XX-12`, фамилия с инициалами).
- Service-role ключ — только header, никогда в URL. Никогда в логи, never в git.
- RLS на боте не отключается, но service-role его обходит по design.
- Команды `deposit-collect` и `deposit-return` мутируют состояние. Перед выполнением для дорогих/спорных сумм — подтверждать в чате у оператора, кто именно инициировал действие (`$OPERATOR_ID` автоматически из `ALLOWED_CHAT_ID`).
- Private schema (`deposit_log`) — обязательны заголовки `Accept-Profile: private` и `Content-Profile: private`.

## Anti-hallucination

- ~~`--json`~~ — текстовый вывод только.
- ~~`--outFile <path>`~~ — вывод только в stdout (дальше бот сам решает, как отдать в чат).
- ~~`--crew <slug>`~~ — crew захардкожен (`CREW_ID` из `.env` = vip-bike).
- Никогда не выдумывать суммы залогов — только из БД.
- `deposit-collect`/`deposit-return` требуют `rentalId` и (для collect) `--amount`+`--method`. Без них → короткий вопрос оператору.

## Связанные навыки бота

- `rental-stats` — общая статистика по арендам, куда входят и залоговые поля.
- `rider-profile` — карточка клиента (увидит его залоговую историю).
- `contract-agent` — оформление аренды (там же фиксируется deposit_rub как ориентир из каталога).
