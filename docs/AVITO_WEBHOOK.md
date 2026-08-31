# Avito Webhook → Leads

Интеграция сообщений Авито в CRM-лиды VIP BIKE. Каждое входящее сообщение в
чат Авито по нашим объявлениям попадает на страницу лидов
(`/franchize/vip-bike/leads`) как **холодный лид** — человек, который ещё не
был в шоуруме.

## Как работает

```
Покупатель пишет в чат Авито
        │
        ▼
Avito Messenger v3 webhook (POST)
        │
        ▼
/api/webhooks/avito  (rental repo, Next.js API route)
  ├─ первое сообщение чата → INSERT franchize_intents
  │    intent_type=callback_request, stage=lead_captured,
  │    contact_channel=avito, metadata: чат/объявление/текст
  │    + Telegram-уведомление владельцу экипажа (best-effort)
  ├─ повторные сообщения покупателя → UPDATE metadata + last_seen_at
  ├─ наши ответы (author_id ≠ buyer_id) → только last_seen_at
  └─ ответ 200 OK всегда (Avito ретраит не-200)
```

Лид дедуплицируется по `metadata->>avitoChatId`; повторы событий Авито
отсекаются по `metadata->>lastEventId`.

На странице лидов: сегмент **«Заявки»**, колонка **«Новые»**, бейдж
«Заявка» (source `callback_request`), канал `avito` виден в карточке лида.

## Эндпоинт

- `GET/POST /api/webhooks/avito`
- Секрет (рекомендуется): env `AVITO_WEBHOOK_SECRET`. Передаётся в URL как
  `?secret=...` или в заголовке `x-avito-secret`. Если env не задан — запросы
  принимаются с warning в логе (позволяет запуститься до Provision секретов).
- Avito при регистрации проверяет URL: POST `{}` должен вернуть `200 OK`
  за ≤2 сек. Роут всегда отдаёт 200.

Развёрнуто на обоих таргетах:
- Vercel: `https://v0-car-test.vercel.app/api/webhooks/avito`
- VPS: `https://rental.vip-bike.ru/api/webhooks/avito`

Подписка в Авито — одна на аккаунт: URL регистрируется последний раз
вызвавшим `register`. Если URL недоступен больше месяца, Авито удаляет
подписку — перерегистрировать.

## Регистрация вебхука

Нужны ключи `client_credentials` со скоупом `messenger:read`
(https://developers.avito.ru — приложение аккаунта VIP BIKE):

```bash
export AVITO_CLIENT_ID=...
export AVITO_CLIENT_SECRET=...

node scripts/avito-webhook-setup.mjs register \
  "https://rental.vip-bike.ru/api/webhooks/avito?secret=<AVITO_WEBHOOK_SECRET>"
```

Отписка: `node scripts/avito-webhook-setup.mjs unsubscribe`.

## Env-переменные

| Переменная | Где | Зачем |
|---|---|---|
| `AVITO_WEBHOOK_SECRET` | Vercel + VPS `.env.local` | проверка входящих вызовов (опционально, но включить) |
| `AVITO_CLIENT_ID` / `AVITO_CLIENT_SECRET` | локально, только для скрипта | регистрация подписки |
| `TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_SITE_URL` | уже настроены | уведомление о новом лиде (через `/api/forward-telegram`, т.к. на VPS Telegram заблокирован) |

## Формат payload (v3)

```json
{
  "id": "event-uuid", "version": "3.0.0", "timestamp": 1627458622,
  "payload": {
    "type": "message",
    "value": {
      "chat_id": "…", "chat_created": "ISO", "chat_type": "u2i",
      "author_id": 123, "buyer_id": 456, "created": "ISO",
      "type": "text", "text": "Здравствуйте, актуально?",
      "item_id": 123, "item_title": "Электромотоцикл …", "item_price": 120000,
      "item_public_user_id": 789, "published_at": "ISO"
    }
  }
}
```

Парсер защитный: отсутствующие поля не ломают обработку. Имя покупателя
вебхук не передаёт — лид создаётся с псевдонимом «Покупатель Avito #id»
(имя можно дополнить позже через Messenger API `GET chats/{chat_id}`).

## Smoke-тест после деплоя

```bash
# health
curl -s https://rental.vip-bike.ru/api/webhooks/avito
# → {"ok":true}

# фейковое сообщение (не создаёт лид от покупателя без buyer_id — создаст:
# buyer_id задан, author_id совпадает → тестовый лид; удалить на странице лидов)
curl -s -X POST https://rental.vip-bike.ru/api/webhooks/avito \
  -H 'Content-Type: application/json' -d '{
    "id":"smoke-1","version":"3.0.0","timestamp":1,
    "payload":{"type":"message","value":{"chat_id":"smoke-chat","buyer_id":1,
    "author_id":1,"type":"text","text":"smoke test","item_title":"Test"}}}'
# → {"ok":true}, лид появился в «Новых»
```
