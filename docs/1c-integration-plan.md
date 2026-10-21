# План интеграции 1С в cartTest (franchize) — рабочий документ

> Статус: план сохранён, ждём тестовый стенд (см. `1c-demo-setup.md`).
> Когда стенд поднимется — идём по фазам снизу вверх, каждый PR маленький и проверяемый.
> Далее «franchize» = подсистема `app/franchize` в репе `carTest` (отдельной ветки
> `franchize` в репе нет, код живёт в main; есть только ветки `codex/*franchize*`).

## 1. Что уже есть в репе (инвентаризация, ветка main @ f447c3b8)

| Компонент | Путь | Состояние |
|---|---|---|
| 1С-коннектор | `lib/connectors/onec/{client,index,types}.ts` | ✅ готов, контракт-фёрст, zod-валидация |
| Общая обвязка | `lib/connectors/shared/{errors,http}.ts` | ✅ ConnectorError + requestJson (timeout, actor/correlation headers) |
| Юнит-тесты | `tests/lib/connectors-onec.spec.ts` | ✅ mocked fetch, без сети |
| MCP-тулзы | `connectors-mcp/src/{env,tools}.ts` | ✅ `onec_ping`, `onec_upsert_order`, `onec_get_document`; lazy-инициализация по env, не падает без конфига |
| README коннекторов | `lib/connectors/README.md` | ✅ описывает контракт + план переноса в traversa |
| Каталог запчастей сейчас | `docs/crewDocs/surge_parts_csv/Surge_*.csv` (5 файлов) + `scripts/extract-*.mjs` | ⚠️ статика: CSV, извлечённые из Excel. Не Supabase, не 1С |
| ETM-коннектор | `lib/connectors/etm/` | ✅ ещё один кандидат-источник запчастей (public mode работает, partner API ждёт ЭДО-заявку) |
| Crew-секреты | `lib/private-secrets.ts` + `supabase/migrations/20260304_private_scheme.sql` | ⚠️ хранилище есть, но ключи вида `password`/`secret` **запрещены** политикой `FORBIDDEN_CREW_SECRET_KEY_SIGNALS` |
| Crew-модель | `supabase/migrations/20240716000000_crews_and_members.sql` | ✅ базовая таблица crews есть |
| «Поиск в 1С каталоге» | — | ⚠️ коннектор умеет `fetchOdata()`, но **в приложение ещё не подключён**: вызовы `getOnecClientFromEnv` живут только в тестах и MCP. Это и есть работа фаз 2–4 |

Ключевой контракт (заморожен коннектором, менять нельзя — можно только расширять):

- Запись: HTTP-сервис `{ONC_BASE_URL}/hs/megarepo/` → `ping` (GET), `orders` (POST,
  идемпотентно по `externalId`), `documents/{ref}` (GET).
- Чтение: OData `{ONC_BASE_URL}/odata/standard.odata/{Entity}` — `$format=json`,
  `$top/$skip/$filter/$select/$orderby/$expand` (см. `buildOdataUrl`).
- Env: `ONC_BASE_URL` (или `ONEC_BASE_URL`), `ONC_USERNAME`, `ONC_PASSWORD`,
  `ONC_SERVICE_NAME` (default `megarepo`), таймаут 15 с.
- Заголовки сквозной трассировки: `x-megarepo-actor`, `x-megarepo-correlation-id`
  (заполняются из `ConnectorCallContext` — в будущем из crew-сессии).

## 2. Целевая архитектура (франчайз-каталог запчастей)

```
                       ┌─────────────────────────────┐
                       │ Supabase: crew_1c_settings  │
                       │ (base_url, user, pass_enc,  │
                       │  service_name, catalog_     │
                       │  entity, mapping, enabled)  │
                       └──────────────┬──────────────┘
                                      │
 app/franchize (серверные экшены)     ▼
 ┌───────────────────────────────────────────────────────┐
 │ getPartsForCrew(crewId) → PartsProvider chain         │
 │  1. crew.1С включён и жив (ping ok)  → OneCParts      │
 │  2. иначе: Supabase-каталог crew     → SupabaseParts  │
 │  3. иначе: статический CSV-fallback  → CsvParts       │
 │  (каждый шаг: try → лог → фолбэк, без бросания в UI)  │
 └───────────────────────────────────────────────────────┘
```

Принципы:

1. **Коннектор не трогаем.** Вся новая логика — в слое провайдеров над ним
   (`lib/parts/**`). Коннектор остаётся переносимым (порт в traversa = копипаст папки).
2. **Фолбэк всегда.** Падение 1С не ломает витрину: интерфейс показывает источник
   («1С» / «Локальный каталог») — crew не должен замечать аварию.
3. **Каждый crew — свой 1С-контур.** Настройки подключения per-crew, не глобальные env.
   Глобальные `ONC_*` остаются дефолтом для dev-стенда (наш локальный IIS).
4. **Пароли — не в crew-secrets JSON.** Политика `private-secrets` банит ключи
   `password/secret/token` намеренно. Для 1С делаем отдельную таблицу с серверным
   доступом (service_role) и шифрованием на уровне СУБД/приложения.

## 3. Фазы

### Фаза 0 — стенд (ручная, сегодня)
Поднять демо-1С по `1c-demo-setup.md`: комьюнити-лицензия → ИБ `demo1c` → справочник
«Запчасти» + документ «ЗаказКлиента» → HTTP-сервис `megarepo` → IIS-публикация →
smoke-тесты зелёные. Гейт: все 5 curl-команд из инструкции отвечают ожидаемо.

### Фаза 1 — нормализация данных (маленький PR, ~1 файл + тесты)
- `lib/parts/onec-normalize.ts`: маппинг строки OData → внутренняя модель `PartVM`
  (какую использует franchize-витрина; сверить тип из `app/franchize/actions`).

  | 1С OData поле | Внутреннее поле | Правило |
  |---|---|---|
  | `Ref_Key` | `id` | as-is (GUID) |
  | `Description` | `name` | trim |
  | `Article` | `sku` | as-is |
  | `Price` | `price` | число, ₽ |
  | `Stock` | `qty` | число |
  | `Unit` | `unit` | as-is |
  | `Category` | `category` | as-is |

- Vitest: 3–4 кейса (пустая строка, NaN-цена, длинное наименование, кириллический фильтр).
- Гейт: `npm test` зелёный, код не импортирует ничего из `app/`.

### Фаза 2 — провайдер 1С + поиск (PR поверх фазы 1)
- `lib/parts/onec-provider.ts`:
  - поиск: `fetchOdata(catalogEntity, { top, filter })`, фильтр
    `contains(Description,'<подстрока>')` + опционально `or contains(Article,'…')`;
  - пагинация `$top/$skip` (первые запросы — top 50, по скроллу дальше);
  - in-memory кэш: ключ `crewId+query`, TTL 3–5 мин (IIS не под нагрузкой);
  - ошибки коннектора (`ConnectorError`: `HTTP_ERROR/TIMEOUT/PARSE_ERROR/MISSING_CONFIG`)
    → typed result `{ ok: false, code }` — наружу не бросаем.
- Серверный экшен в `app/franchize/.../actions`: `searchOneCParts(crewId, query)`.
- Гейт: поиск «Тормоз» на демо-стенде возвращает записи из 1С через dev-сервер.

### Фаза 3 — crew-настройки 1С в Supabase (PR: миграция + админка)
- Миграция: таблица `crew_1c_settings`:
  - `crew_id uuid pk → crews(id)`;
  - `base_url text not null`, `username text not null`,
    `password_encrypted text not null` (pgcrypto / app-level, server-only путь);
  - `service_name text not null default 'megarepo'`;
  - `catalog_entity text not null default 'Catalog_Запчасти'`;
  - `field_mapping jsonb default '{}'` (переопределение маппинга фазы 1 — у crew
    конфа может отличаться: УТ/БП/кастом);
  - `enabled bool default false`, `updated_at`, `updated_by`.
- RLS: чтение/запись — только service_role (админские экшены); crew-лидеру — только
  чтение собственного `enabled`/`base_url` без пароля.
- Админ-UI в franchize-настройках crew: форма + кнопка «Проверить связь» (вызывает
  `ping()` коннектора и показывает результат честно).
- Гейт: настройки сохраняются, ping из админки зелёный против локального стенда.

### Фаза 4 — роутинг источников + фолбэк (PR)
- `lib/parts/index.ts`: `getPartsForCrew(crewId)` по цепочке из схемы выше;
  переключение источника логируется (`lib/logger`), метрика успеха 1С-провайдера.
- Дефолт до фазы 3: если `crew_1c_settings` нет — работает как сейчас (CSV/Supabase),
  поведение интерфейса не меняется вообще.
- Гейт: при выключенной 1С ничего не ломается; при включённой — данные из 1С.

### Фаза 5 — канал записи: заказы в 1С (после стабильного чтения)
- Там, где в franchize оформляется запрос/аренда запчастей, вызвать
  `upsertOrder({ externalId: <request/rental id>, docType: 'order', ... })`.
- `externalId` уже даёт идемпотентность — повторные отправки безопасны.
- Логгировать `ref` (GUID в 1С) обратно в нашу запись (поле `onec_ref`) — для сверки.

### Фаза 6 — traversa (когда протестируем)
По чеклисту из `lib/connectors/README.md`:
1. скопировать `lib/connectors/**` + тесты (без других зависимостей, runtime-dep только zod);
2. подменить источник `ConnectorCallContext` (crew-сессия → actor);
3. crew-настройки 1С поехать вместе с `crew_1c_settings` (или через общий API cartTest
   на первое время). Коннектор при переносе не меняется — это осознанный контракт.

## 4. Риски и открытые вопросы

| Риск | Что делаем |
|---|---|
| Разные конфигурации 1С у crew (УТ/БП/самописная) — имена сущностей и реквизитов различаются | `field_mapping` + `catalog_entity` в настройках crew; нормализатор с жёстким контрактом на выходе |
| Пароли 1С в Supabase | Отдельная таблица + шифрование + service-only доступ; в `private-secrets` JSON не складываем (политика банит такие ключи) |
| localhost-стенд недоступен с Vercel-прода | Этап теста — локальный dev (как согласовано). Для «как в бою» — Windows VPS + HTTPS или cloudflared/ngrok туннель (отдельный шаг, не блокер) |
| Комьюнити-лицензия живёт 7 дней / только для разработки | Для демо ок; перед боем у crew — их собственные лицензии и их серверы |
| Латентность OData (1С не самый быстрый REST) | Кэш TTL 3–5 мин, `$top`, `timeoutMs=15000` уже в коннекторе |
| OData v3-нюансы (1С не полностью OData v4) | Используем только `$filter contains`, `$top/$skip`, `$orderby` — всё поддержано платформой с 8.3.5 |
| «Поиск» UX | Пока серверный поиск по подстроке; full-text/морфологию откладываем до запроса продукта |

## 5. Чеклист приёмки (финальный)

- [ ] Стенд: 5 smoke-команд из инструкции зелёные.
- [ ] `.env.local` с `ONC_*`, `onec.ping()` из Node-скрипта возвращает `{"ok":true}`.
- [ ] Нормализатор покрыт юнит-тестами; `npm test` зелёный.
- [ ] Поиск запчастей из dev-сервера franchize возвращает данные 1С.
- [ ] Выключение `enabled` у crew-настроек мгновенно возвращает прежний источник.
- [ ] Остановка 1С (Ctrl+C / iisreset / стоп IIS) не валит витрину — фолбэк сработал.
- [ ] `onec_upsert_order` создаёт заказ в 1С, повторная отправка — `alreadyExisted: true`.
- [ ] В worklog репы добавлена запись о фазах 0–2.
