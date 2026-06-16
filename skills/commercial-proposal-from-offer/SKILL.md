---
name: commercial-proposal-from-offer
description: Commercial proposal generation for rental/sale/test-drive/corporate offers
---

# Commercial Proposal Generator

Триггер-фразы: **`создай коммерческое предложение`**, **`сделай кп`**, **`сделай коммерческое`**, **`коммерческое предложение для`**, **`кп для`**, а также `ты босс` + коммерческое-предложение intent (boss-decomposition + document-autopilot chain).

## Overview

Generates formal commercial proposals (Коммерческое предложение / КП) for VIP Bike services including rental packages, motorcycle sales, test-drives, and corporate partnerships. The proposal is delivered as a formatted DOCX document via Telegram. When `--saveMetadata 1` is set, the artifact is persisted to `private.commercial_proposal_artifacts` (created by migration `20260617000001_create_commercial_proposal_artifacts.sql`).

## When to Use

Use this skill when:
- Client requests a formal commercial proposal for motorcycle rental services
- Corporate client needs pricing for long-term partnership or fleet rental
- Sales lead requests detailed offer for motorcycle purchase
- Test-drive proposal is needed for B2B clients

## End-to-end pipeline

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1. PARSE:   определить offerType + clientName + totalPrice            │
│ 2. CREW:    загрузить contract_defaults из private.crew_secrets       │
│ 3. CATALOG: если offerType=rent|sale — загрузить байки из cars        │
│ 4. RENDER:  подставить vars в COMMERCIAL_PROPOSAL_TEMPLATE.html       │
│             (с поддержкой {{#if var}}…{{else}}…{{/if}}                │
│             и {{{var}}} для сырого HTML)                              │
│ 5. DOCX:    HTML → DOCX через htmlToDocxElements (cheerio-based)      │
│ 6. QR:      сгенерировать QR-код для "1-click accept"                 │
│ 7. DELIVER: отправить DOCX + QR в Telegram (media group)              │
│ 8. PERSIST: при --saveMetadata 1 — insert в commercial_proposal_artifacts │
└──────────────────────────────────────────────────────────────────────┘
```

## CLI Usage

```bash
# Basic usage
node scripts/make-commercial-proposal-skill.mjs --offerType rent --clientName "ООО Вектор" --telegramChatId 123456

# With custom pricing
node scripts/make-commercial-proposal-skill.mjs --offerType corporate --clientName "Иванов И.И." --totalPrice 500000 --telegramChatId 123456

# With custom validity period
node scripts/make-commercial-proposal-skill.mjs --offerType sale --clientName "Компания Рога и Копыта" --validityDays 14 --telegramChatId 123456

# With crew-specific details (loads organization info from crew_secrets)
node scripts/make-commercial-proposal-skill.mjs --offerType rent --clientName "Петров П.П." --userId 123456 --telegramChatId 789
```

## Input/Output Contracts

### Required Inputs

- `--offerType`: Offer type - "rent", "sale", "test-drive", "corporate", or "custom"
- `--clientName`: Client organization or individual name
- `--telegramChatId`: Telegram chat ID for document delivery (fallback: `ADMIN_CHAT_ID` env)

### Optional Inputs

- `--userId`: User ID to determine crew membership (for loading crew-specific organization details)
- `--crewSlug`: Direct crew slug override (skips crew lookup; default `vip-bike`)
- `--validityDays`: Proposal validity period in days (default: 30)
- `--warrantyMonths`: Warranty period in months (default: 12)
- `--totalPrice`: Total offer price in rubles (required for auto-generated pricing table)
- `--offerSummary`: Brief description of the offer (default: by offerType)
- `--pricingTable`: Custom pricing table HTML (alternative to totalPrice)
- `--offerDescription`: Detailed offer description
- `--specialConditions`: Special conditions text
- `--paymentTerms`: Payment terms (default: "100% предоплата")
- `--deliveryTerms`: Delivery terms (default: "в течение 5 рабочих дней")
- `--clientAddress`: Client address (optional, shown in signature block)
- `--clientInn`: Client INN (optional, shown in signature block)
- `--clientDetails`: Additional client details (optional)
- `--clientPhone`: Client phone (optional)
- `--clientEmail`: Client email (optional)
- `--includeBikeCatalog`: Set to "1" (default for rent/sale) or "0" to control bike catalog rendering
- `--bikeFilter`: Filter bike catalog (e.g. `electric` for e-bikes only, `gas` for ICE, or any substring)
- `--saveMetadata`: Set to "1" to save metadata to Supabase
- `--metadataTable`: Override metadata table name (default: `commercial_proposal_artifacts`)

### Anti-hallucination: flags that DO NOT exist

- ~~`--skipTelegram`~~ — does not exist. Telegram delivery is always built-in.
- ~~`--outPath`~~ — does not exist. Script generates filename and sends it.
- ~~`--dealDate`~~ — does not exist. Date КП = `new Date()`.

### Output

- Generated DOCX document delivered via Telegram (as part of a media group with the QR PNG, when QR generation succeeds)
- JSON result on stdout with:
  - `proposalKey`: Unique proposal identifier
  - `docFileName`: Generated document filename
  - `originalSha256`: Document hash for verification and QR deep-link
  - `totalPrice`: Price information (if provided) — `{ digits, words }`
  - `validityDays`: Validity period
  - `crewSlug`: Crew used for organization details
  - `bikeCatalogIncluded`: `true` if bike catalog was rendered
  - `bikeCatalogCount`: Number of bikes in the catalog
  - `bikeFilter`: Applied filter (or `null`)
  - `qrDeepLink`: Telegram WebApp deep-link encoded in the QR
  - `qrIncluded`: `true` if QR was successfully attached
  - `metadataVerified`: `true` if `--saveMetadata 1` write succeeded read-after-write check

## What changes in the template by offerType

Шаблон `docs/COMMERCIAL_PROPOSAL_TEMPLATE.html` использует `{{#if var}}…{{else}}…{{/if}}` для условного рендеринга секций в зависимости от offerType. HTML-фрагменты (прайс-лист, каталог байков, особые условия) подставляются через тройные фигурные скобки `{{{var}}}` (без экранирования).

| Секция | rent | sale | test-drive | corporate | custom |
|--------|------|------|------------|-----------|--------|
| §1 Предмет | + | + | + | + | + |
| §1.3 Долгосрочное сотрудничество | — | — | — | ✅ | — |
| §2 Условия оказания услуг | + | + | + | + | + |
| **§2.1 Каталог байков** (таблица из Supabase) | ✅ | ✅ | — | — | — |
| **§2.2 Тарифы аренды + СТС-вместо-депозита** | ✅ | — | — | — | — |
| **§2.2 Гарантия при продаже** | — | ✅ | — | — | — |
| **§2.2 Тест-драйв: расписание, требования, маршрут** | — | — | ✅ | — | — |
| **§2.2 Корпоративные тарифы (Tier 1/2/3)** | — | — | — | ✅ | — |
| §3 Стоимость услуг | + | + | + | + | + |
| §4 Условия оплаты | + | + | + | + | + |
| §5 Сроки | + | + | + | + | + |
| §6 Гарантия | + | + | + | + | + |
| §7 Особые условия | + | + | + | + | + |
| §8 Реквизиты сторон | + | + | + | + | + |
| **QR «1-click accept»** (caption media) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Условные блоки реквизитов клиента (ИНН/телефон/email/адрес) | ✅ | ✅ | ✅ | ✅ | ✅ |

## QR-code "1-click accept"

После генерации КП скрипт создаёт QR-код, содержащий Telegram WebApp deep-link:
```
https://t.me/<botUsername>/app?startapp=proposal_<proposalKey>_<sha256>
```
QR отправляется в Telegram-чате как второе media в `sendMediaGroup` (вместе с DOCX). При сканировании клиент открывает WebApp с предзаполненными данными КП и может подтвердить акцепт одним нажатием. Имя бота берётся из `TELEGRAM_BOT_USERNAME` env (fallback: `oneBikePlsBot`). Если генерация QR не удалась (например, `api.qrserver.com` недоступен), скрипт отправляет только DOCX с deep-link в caption.

## Integration Patterns

### Crew Secrets Loading

The script automatically loads organization details from `private.crew_secrets`:

1. Determines crew membership via `crew_members` table using `--userId`
2. Loads `contract_defaults` from `crew_secrets`
3. Uses organization name, bank details, contact info for proposal

Fallback to "vip-bike" crew if no membership found.

### Template System

Uses HTML template at `docs/COMMERCIAL_PROPOSAL_TEMPLATE.html` with two kinds of placeholders:

- `{{variable}}` — simple string interpolation (used for org details, client info, dates, terms)
- `{{{variable}}}` — raw HTML interpolation, no escaping (used for `pricing_table`, `bike_catalog_table`, `offer_description`, `special_conditions`)
- `{{#if variable}}…{{else}}…{{/if}}` — conditional block, renders the if-branch when the var is truthy (non-empty string / non-zero number / `true`), else the else-branch (else-branch is optional)

Per-offerType flags (`offer_type_is_rent`, `offer_type_is_sale`, `offer_type_is_test_drive`, `offer_type_is_corporate`, `offer_type_is_custom`) drive conditional rendering of section §2.2.

### Document Generation Pipeline

1. Load HTML template
2. Strip HTML comments (so `{{...}}` syntax inside comments is not processed)
3. Process `{{#if}}`/`{{else}}`/`{{/if}}` blocks innermost-first (max 100 nesting levels)
4. Replace `{{{var}}}` raw HTML fragments
5. Replace `{{var}}` simple interpolations
6. Convert HTML to DOCX via `htmlToDocxElements` (cheerio-based, preserves formatting)
7. Generate QR PNG via `api.qrserver.com` (8s timeout, optional)
8. Deliver via Telegram Bot API — `sendMediaGroup` (DOCX + QR) with fallback to `sendDocument` (DOCX only)
9. Optional: Save metadata to `private.commercial_proposal_artifacts` with read-after-write verification

## DB persistence

При `--saveMetadata 1` скрипт пишет строку в `private.commercial_proposal_artifacts` (см. миграцию `20260617000001_create_commercial_proposal_artifacts.sql`):

| Колонка | Тип | Описание |
|---------|-----|----------|
| `proposal_key` | TEXT UNIQUE | Уникальный ключ (`proposal-<crew>-<timestamp>`) |
| `crew_slug` | TEXT NOT NULL | Crew, к которому относится КП (default `vip-bike`) |
| `client_name` | TEXT NOT NULL | Наименование клиента |
| `client_inn` | TEXT | ИНН клиента (если передан) |
| `client_phone` | TEXT | Телефон клиента |
| `client_email` | TEXT | E-mail клиента |
| `client_address` | TEXT | Адрес клиента |
| `client_details` | TEXT | Доп. реквизиты (КПП, ОГРН, р/с) |
| `offer_type` | TEXT NOT NULL | Тип КП (`rent`/`sale`/`test-drive`/`corporate`/`custom`) |
| `offer_summary` | TEXT | Краткое описание предложения |
| `total_price` | NUMERIC | Сумма КП в рублях |
| `total_price_words` | TEXT | Сумма прописью |
| `pricing_table_html` | TEXT | Снапшот HTML прайс-листа (для аудита) |
| `validity_days` | INTEGER | Срок действия КП (default 30) |
| `warranty_months` | TEXT | Гарантия в месяцах (default `12`) |
| `payment_terms` | TEXT | Условия оплаты |
| `delivery_terms` | TEXT | Сроки оказания |
| `special_conditions` | TEXT | Особые условия |
| `bike_filter` | TEXT | Применённый фильтр каталога (если был) |
| `bike_catalog_count` | INTEGER | Кол-во байков в каталоге |
| `bike_catalog_html` | TEXT | Снапшот HTML каталога байков (для аудита) |
| `telegram_chat_id` | TEXT | ID чата доставки |
| `telegram_message_id` | BIGINT | ID отправленного сообщения |
| `qr_deep_link` | TEXT | Telegram WebApp deep-link, закодированный в QR |
| `qr_included` | BOOLEAN | Был ли QR приложен (default FALSE) |
| `original_sha256` | TEXT | SHA-256 хэш DOCX (для верификации и QR-ссылки) |
| `template_version` | INTEGER | Версия шаблона (default 1) |
| `created_at` | TIMESTAMPTZ | Дата создания (default `now()`) |

После insert выполняется read-after-write verification по `proposal_key` — только после успешной проверки скрипт считает операцию завершённой и добавляет в результат `metadataVerified: true`.

## Examples

### Rental Proposal for Corporate Client (B2B)

```bash
node scripts/make-commercial-proposal-skill.mjs \
  --offerType corporate \
  --clientName "ООО ТехноПром" \
  --totalPrice 250000 \
  --validityDays 45 \
  --paymentTerms "50% предоплата, 50% после оказания услуг" \
  --specialConditions "Предусмотрена гибкая система скидок для постоянных клиентов. Возможна отсрочка платежа до 14 дней." \
  --clientInn 5258000000 \
  --clientAddress "г. Нижний Новгород, ул. Рождественская, д. 1" \
  --clientEmail "info@technoprom.ru" \
  --clientPhone "+7 831 200-00-00" \
  --saveMetadata 1 \
  --telegramChatId 123456789
```

### Sales Proposal with Electric-Only Catalog

```bash
node scripts/make-commercial-proposal-skill.mjs \
  --offerType sale \
  --clientName "Петров П.П." \
  --bikeFilter electric \
  --warrantyMonths 24 \
  --saveMetadata 1 \
  --telegramChatId 123456789
```

### Sales Proposal (individual)

```bash
node scripts/make-commercial-proposal-skill.mjs \
  --offerType sale \
  --clientName "Иванов Иван Иванович" \
  --totalPrice 310000 \
  --warrantyMonths 24 \
  --telegramChatId 123456789
```

### КП с кастомным прайс-листом (custom)

```bash
node scripts/make-commercial-proposal-skill.mjs \
  --offerType custom \
  --clientName "Сидоров С.С." \
  --pricingTable '<table>...</table>' \
  --totalPrice 150000 \
  --telegramChatId 123456789
```

## Russian Language Triggers

- "создай коммерческое предложение для <клиент>"
- "сделай кп по аренде"
- "коммерческое предложение на продажу"
- "сформируй коммерческое предложение"
- "кп для <клиент>"
- "сделай коммерческое"

## Error Handling

| Stage | Reason | Когда |
|-------|--------|-------|
| `offer_type` | `missing_or_invalid_offerType` | Неверный или отсутствующий `--offerType` |
| `client_parse` | `missing_client_name` | Не передан `--clientName` |
| `telegram_parse` | `missing_telegramChatId` | Не передан `--telegramChatId` и нет `ADMIN_CHAT_ID` env |
| `template_read` | `proposal_html_template_missing` | Не найден файл шаблона |
| `doc_generation` | `proposal_doc_generation_failed` | cheerio → DOCX упал (см. лог) |
| `telegram_delivery` | `telegram_send_failed` | Telegram API отклонил отправку |
| `metadata_write` | `metadata_write_failed` | Supabase insert упал |
| `metadata_verify` | `read_after_write_verification_failed` | Read-after-write не нашёл запись |

Все ошибки выводятся JSON-пайлоадом на stderr с `process.exit(2)`.

## Security / Compliance Rules

- ПДн клиента (ФИО, ИНН, телефон, e-mail, адрес) хранятся только в `private.commercial_proposal_artifacts` (RLS: service_role only — `anon`/`authenticated` отозваны).
- Не публиковать полный PII в публичных комментариях/PR.
- В логи/summary выводить только маскированные значения.
- Артефакты (`.docx`, `qr.png`) хранить только в рамках рабочего потока.
- **Никогда не коммитить** сгенерированные `.docx` с ПДн в git.

## Related Files

- Template: `docs/COMMERCIAL_PROPOSAL_TEMPLATE.html`
- Script: `scripts/make-commercial-proposal-skill.mjs`
- Crew secrets: `private.crew_secrets` (Supabase table, accessed via `supabaseAdmin`)
- HTML conversion: `lib/htmlToDocx.mjs`
- DB migration: `supabase/migrations/20260617000001_create_commercial_proposal_artifacts.sql`

## Integration with /doc manual flow

При желании можно вызывать скрипт из `app/webhook-handlers/commands/doc-manual.ts` (как альтернативный flow для КП):
```ts
// В docCommand() добавить новый dealType "proposal"
// и route на exec(make-commercial-proposal-skill.mjs ...)
```
Но для текущей версии рекомендуется держать КП как отдельный skill (т.к. форма ввода значительно отличается: нет паспорта / прав / дат аренды, зато есть ИНН, реквизиты, тип предложения).
