# vip-bike.ru форма заявок → rental CRM (franchize_intents)

**Дата:** 2026-09-09 · **Статус:** приёмник готов и задеплоен, осталась встроить форвард на стороне сайта.

## Куда сейчас шлёт форма сайта

Форма `lead-form` на vip-bike.ru (data-ym-form-source, например `home-final`)
делает `fetch POST /api/lead` **внутри самого сайта vip-bike.ru** (Next.js,
свой роут — отдельный деплой, НЕ rental CRM). Payload формы (обратная
разработка чанка `0p02d2fpu3t22.js` от 2026-09-09):

```json
{
  "name": "…", "contact": "+7…", "nick": "@…",
  "source": "home-final", "model": "Y-VOLT Surge V",
  "quiz": {"права": "есть"},
  "requestId": "<uuid>",
  "attribution": { "utm_source": "…", "utm_medium": "…", "utm_campaign": "…",
                   "utm_content": "…", "utm_term": "…", "yclid": "…",
                   "pageUrl": "https://vip-bike.ru/?…", "landingUrl": "…",
                   "capturedAt": "2026-09-09T10:00:00.000Z" },
  "consent": true, "_website": "…"
}
```

`/api/lead` защищён origin-проверкой (`Origin: https://vip-bike.ru`), отвечает
`{ok, duplicate}` / ошибками 400/429/502/503 (`validation`, `rate_limit`,
`delivery`, `storage_failed`).

## Куда надо доставить

**Приёмник (уже в проде rental CRM):**

```
POST https://rental.vip-bike.ru/api/franchize/vip-bike/callback-lead
Headers:
  Content-Type: application/json
  x-callback-ingest-secret: <CALLBACK_INGEST_SECRET>   # env в Vercel
```

Приёмник принимает **нативный payload формы как есть** — `normalizeSiteLeadPayload`
на нашей стороне сам смапит `contact→phone`, `source→formSource`, `model→bikeTitle`,
квиз → `metadata.quiz`, плоскую utm-attribution → `first_touch/last_touch`,
`pageUrl` → `source_route`, и молча выкинет `requestId`/`_website`.
Ответ: `{success:true, requestId, intentId, notificationSent, deduplicated}`
(лид падает в `franchize_intents` + Telegram-уведомление экипажу, дедуп по
телефону в 2-минутном окне).

Секрет `CALLBACK_INGEST_SECRET` задаётся в Vercel env rental-проекта; пока он
не выставлен, trusted-режим выключен и прокси ограничен общим per-IP лимитом.

## Код форварда для сайта (в их `/api/lead`, после их собственной записи)

```ts
// Не блокируем ответ пользователю, если CRM недоступна.
void fetch("https://rental.vip-bike.ru/api/franchize/vip-bike/callback-lead", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-callback-ingest-secret": process.env.VIPBIKE_CRM_INGEST_SECRET!,
  },
  body: JSON.stringify(leadPayload), // тот же объект, что пришёл из формы
}).catch(() => {});
```

Форвард — server-to-server (секрет не светится в браузере). Если ответ CRM
важен для ретраев, можно `await` и при `!res.ok` логировать, но пользователю
всё равно отвечать ок.

## Что уже сделано на стороне rental CRM (эта репа)

- `lib/vip-bike-callback-lead.ts` — схема расширена опциональными
  `bikeTitle`/`quiz` (в TG-уведомлении «Байк» и в metadata лида).
- `app/api/franchize/callback-lead/route.ts` — `normalizeSiteLeadPayload()`
  перед валидацией; канонические payload-ы проходят насквозь без изменений.
- Спеки: `tests/api/callback-lead-site-integration.spec.ts` (9 кейсов,
  включая site-native payload и passthrough).

## Второй аккаунт Авито (заметка на будущее)

Когда добавится второй аккаунт Авито: webhook этого аккаунта регистрируется
с `?acc=<key>` в URL → лиды получают `metadata.avitoAccount=<key>` → ответы
в его чаты идут с `AVITO_ACCOUNT_<KEY>_CLIENT_ID/_CLIENT_SECRET/_USER_ID`
(см. `app/franchize/lib/avito-messenger.ts`). Дефолт (пусто/`rental`) —
текущие `AVITO_*` env.
