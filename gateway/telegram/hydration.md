# Gateway Telegram Hydration

## Rate limits
- Telegram `sendMessage` может отвечать `429 Too Many Requests` c `parameters.retry_after`.
- В `gateway/telegram/sendMessage.ts` добавлен retry с учетом `retry_after` и backoff для 5xx/429.

## Retry strategy
- Базовый retry: до 2 повторов (`maxRetries`, можно переопределить в опциях).
- Для `429` используется серверная подсказка `retry_after`.
- Для 5xx используется короткий линейный backoff.

## Allowed templates
- Оповещения шлюза должны оставаться инфраструктурными и короткими:
  - `plant_dry`: `🌵 Растение ... просит полив.`
  - сервисные ошибки webhook: только операторские/технические сообщения.
- Бизнес-логика и контент-флоу (маркетинг, продажи, каталоги) должны жить в core/app слоях, не в gateway.

## Webhook boundary
- `app/api/telegramWebhook/route.ts` теперь тонкий роутер, только делегирует в `gateway/telegram/webhook-handler.ts`.
- Толстая логика парсинга/ветвления сообщений находится в gateway-слое.
