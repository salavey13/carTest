# Интеграция: форма vip-bike.ru → лиды арендной CRM

> **Статус (2026-09-09):** сайт-часть реализована и поставлена в стейджинг
> `/opt/claudeclaw/vip-bike/site-crm-forward/` (модуль `lib/crm-forward.ts`,
> патч роута, тесты зелёные, root-скрипты деплоя с E2E и автооткатом).
> Ждёт деплоя из-под root: `deploy-rental-crm-sync.sh` (приёмник) →
> `deploy-site-forward.sh` (сайт NN) → `deploy-site-forward-ru.sh` (сайт RU,
> квиз). Реализованный вариант отличается от «drop-in» ниже: на сайт НЕ
> ставится прокси-роут, форвард встроен в существующий `/api/lead` как
> best-effort дубль ДО основной доставки, а payload собирается в канонической
> схеме из провалидированного `SafeLead` (camelCase-атрибуция сайта →
> snake_case first_touch/last_touch). Заголовок секрета и env те же:
> `VIP_BIKE_CRM_INGEST_SECRET` (сайт) ↔ `CALLBACK_INGEST_SECRET` (аренда).

## Квиз-подбор: ru.vip-bike.ru/podbor → лид + комментарий (2026-09-09)

Квиз (3 шага: бюджет / опыт / цель → рекомендация модели) живёт ТОЛЬКО в
RU-сборке сайта (`ru.vip-bike.ru/podbor`; в NN-сборке маршрут выключен и
отдаёт 308 → `/catalog`). Форма результата квиза шлёт `/api/lead` с
`source="quiz"` и ответами `quiz={budget, experience, goal}` (сырые коды).

Что сделано:

- **Сайт** (`lib/crm-forward.ts`, стейджинг): регион `nn` форвардится
  целиком, регион `ru` — только завершённые квизы (`source="quiz"` +
  непустой `quiz`). Остальные RU-заявки остаются в федеральном контуре
  (Bitrix24/почта) и в CRM не дублируются.
- **Приёмник** (`app/api/franchize/callback-lead/route.ts` +
  `lib/vip-bike-callback-lead.ts`, этот репо): если в payload есть `quiz`,
  после захвата лида создаётся заметка в `lead_notes` (то, что оператор
  видит в CRM как комментарий лида: флажок «Прочитать заметки» в списке +
  шторка лида). Автор заметки — «подбор с сайта» (не числовой → без очков
  лидерборда, без резолва в users). Коды ответов переводятся в
  человекочитаемый вид: `budget=350-500` → «Бюджет: 350–500 000 ₽»,
  `experience=rode` → «Опыт: есть базовый опыт», `goal=city` →
  «Цель: город и пробки»; незнакомые ключи проходят как есть
  («город: Казань»). Плюс компактная строка «Квиз: …» в ТГ-уведомлении
  владельцу.
- **Идемпотентность**: заметка одна на лид — перед вставкой проверяется
  существование заметки этого автора; повторная доставка в окне дедупа
  (retry) вторую заметку не создаёт. Сбой записи заметки не влияет на
  ответ клиенту и доставку уведомления (best-effort, warn в лог).
- **E2E**: `deploy-site-forward-ru.sh` прогоняет тест-квиз
  (+7 999 000-00-02, «ТЕСТ КВИЗ CRM») насквозь до CRM (ждёт `crm=forwarded`
  в логе кандидата) и только потом меняет контейнер `vip_bike_ru` (3007).

## Где сейчас теряются заявки (исследование 2026-09-08)

- Форма на `https://vip-bike.ru` (React, `.lead-form`, поля `name`,
  `contact` (tel), `nick` (@username), чекбокс согласия) шлёт
  `POST /api/lead` на **самом маркетинговом сайте** (сайт — отдельное
  Next.js-приложение на VPS, `server: nginx/1.24.0 (Ubuntu)`, исходников
  на GitHub нет — правится только на сервере).
- Клиентский обработчик (чанк `/_next/static/chunks/108eef33ar40h.js`)
  ожидает от своего сервера: `400 = validation`, `503 = storage`,
  `502 = delivery`, `200 {ok:true, duplicate?}` — т.е. серверный роут
  валидирует, сохраняет и доставляет заявку в свой контур
  (скорее всего Telegram-алерт менеджеру; подтвердить на VPS — см. ниже).
- **В арендную CRM эти заявки НЕ попадают**: в `franchize_intents` канал
  `web_callback` имеет ровно 2 записи (30.08 и 14.08), обе — с лендинга
  самого арендного приложения `/franchize/vip-bike` (utm/yclid Яндекса).
  Контрольный POST тестовой заявки на `/api/lead` ничего в арендной БД
  не создал.

## Куда ведём заявки

Готовый приёмник уже есть: **`POST /api/franchize/vip-bike/callback-lead`**
(арендная репа, `app/api/franchize/callback-lead/route.ts`):
атомарный захват (`capture_vip_bike_callback_intent`), дедуп 2 мин по
телефону, rate-лимиты, Telegram-уведомление владельцу экипажа, лид в
`franchize_intents` (`intent_type=callback_request`,
`contact_channel=web_callback`).

С 2026-09-08 приёмник принимает дополнительные опциональные поля и
поддерживает **trusted-режим** для server-to-server прокси:

| Поле | Назначение |
|---|---|
| `nick` ≤80 | Telegram-ник из формы (`@username`) → metadata + TG |
| `formSource` ≤80 | метка формы (`home-final` и т.п.) → metadata + TG; меняет заголовок уведомления на «Новая заявка с сайта vip-bike.ru» |
| `landingPath` ≤500 | реальная посадочная страница (`/` + query) → `source_route`; только path-подобные строки (без пробелов/контрольных символов) |
| `quiz` ≤10 ключей | ответы квиза-подбора (примитивы) → `metadata.quiz` + человекочитаемая заметка в `lead_notes` (см. секцию квиза выше) |
| заголовок `x-callback-ingest-secret` | при совпадении с env `CALLBACK_INGEST_SECRET`: пропуск локального per-IP лимита (прокси — один IP на всех) + per-request ipHash (не триггерит RPC-квоту 5/10мин на IP; глобальные 30/10мин остаются) + `metadata.ingest="site_proxy"` |

## Drop-in для сайта: `/api/lead` как прокси

Замена (или обёртка) серверного роута `app/api/lead/route.ts` на
маркетинговом сайте. Сохраняем контракт клиента (ok/duplicate/error),
добавляем доставку в CRM:

```ts
// app/api/lead/route.ts (маркетинговый сайт vip-bike.ru)
export const runtime = "nodejs";

const CRM_URL = "https://rental.vip-bike.ru/api/franchize/vip-bike/callback-lead";
const INGEST_SECRET = process.env.VIP_BIKE_CRM_INGEST_SECRET || ""; // общий секрет

function isValidPhone(v: unknown): boolean {
  const digits = String(v || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  const contact = String(body.contact || "").trim();
  const nick = String(body.nick || "").trim().slice(0, 80);
  const source = String(body.source || "").trim().slice(0, 80);
  if (name.length < 2 || !isValidPhone(contact) || body.consent !== true) {
    return Response.json({ ok: false, error: "validation" }, { status: 400 });
  }

  // Реальная страница клиента (прокси не имеет Referer браузера).
  const landingPath =
    typeof body.page === "string" && body.page.startsWith("/")
      ? body.page.slice(0, 500)
      : "/";

  try {
    const res = await fetch(CRM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(INGEST_SECRET ? { "x-callback-ingest-secret": INGEST_SECRET } : {}),
      },
      body: JSON.stringify({
        slug: "vip-bike",
        name,
        phone: contact,
        ...(nick ? { nick } : {}),
        ...(source ? { formSource: source } : {}),
        landingPath,
        consent: true,
      }),
      cache: "no-store",
    });

    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        deduplicated?: boolean;
      };
      return Response.json({ ok: true, duplicate: !!data.deduplicated });
    }
    if (res.status === 400) {
      return Response.json({ ok: false, error: "validation" }, { status: 400 });
    }
    if (res.status === 429) {
      // Квота CRM: клиенту мягкий успех, чтобы не пугать реального покупателя.
      return Response.json({ ok: true, duplicate: true });
    }
    return Response.json({ ok: false, error: "delivery" }, { status: 502 });
  } catch {
    return Response.json({ ok: false, error: "delivery" }, { status: 502 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
```

Переменные окружения:
- на маркетинговом сайте: `VIP_BIKE_CRM_INGEST_SECRET=<секрет>`;
- в арендной CRM (Vercel + VPS): `CALLBACK_INGEST_SECRET=<тот же секрет>`.

Если env не заданы, прокси всё равно работает (просто с per-IP лимитом
4/мин и обычным ipHash) — trusted-режим опционален, но для прода
рекомендуется: один IP сайта делится всеми посетителями.

## Существующий поток сайта НЕ ломается

Если требуется сохранить текущее поведение сайта (алерт менеджеру +
своё хранилище), прокси добавляется В КОНЕЦ существующего обработчика
`/api/lead` после текущей логики — CRM-вызов best-effort, его ошибка не
влияет на ответ клиенту.

## Как подтвердить текущего получателя заявок сайта (на VPS)

```bash
# Исходник сайта обычно в /var/www/<site> или /opt/… — найти роут:
rg -l "api/lead" /var/www /opt --max-depth 4 2>/dev/null
rg -n "sendMessage|smtp|supabase|bitrix" <найденная папка>/app/api/lead/
# и посмотреть, куда уходит доставка (Telegram-алерт менеджеру? почта?)
```
