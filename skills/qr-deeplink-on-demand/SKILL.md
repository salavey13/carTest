---
name: qr-deeplink-on-demand
description: >
  Generate QR codes on demand for Telegram WebApp deep links that are routed
  by hooks/useStartParamRouter.ts. Use this skill whenever the user asks to
  "create a QR for the crew creation link", "make a QR for the rental deep link",
  "сгенерируй QR-код для ссылки startapp", "give me a QR for the buy link",
  or any time a scannable onboarding/contact card is needed for a VibeRider
  franchize flow. The skill supports three output shapes: (a) raw PNG QR code,
  (b) vCard-style contact card PNG with embedded QR + crew branding,
  (c) print-ready PDF business card with QR + branding.
  Triggers: "qr код", "сгенерируй qr", "create qr", "qr code for", "make a qr",
  "контактная карточка с qr", "contact card with qr".
---

# qr-deeplink-on-demand (skill)

Триггер-фразы: **`сгенерируй qr`**, **`qr код для`**, **`create qr`**,
**`make a qr`**, **`контактная карточка с qr`**, **`contact card with qr`**,
а также `ты босс` + qr/contact-card intent.

## Назначение

Генерация QR-кодов для Telegram WebApp deep-links, которые роутятся через
`hooks/useStartParamRouter.ts`. Скрипт берёт один из известных `startapp`
payloads (например `create_crew`, `crew_<slug>_join_crew`,
`franchize/<slug>/profile`, `lead_<userId>`, `rental_<rentalId>`) и
строит полный URL вида:

```
https://t.me/<botUsername>/app?startapp=<encoded-payload>
```

Затем рендерит QR-код в одном из трёх форматов:

1. **raw PNG** — только QR-код, 512×512 px, чёрно-белый (для вставки в
   любой материал, регистрации и т.д.)
2. **vCard PNG** — карточка 1024×576 (16:9) с QR-кодом слева и контактами
   экипажа справа (phone / telegram / address / brand name)
3. **PDF card** — A6 landscape PDF (105×148 mm) с тем же vCard layout,
   готовый к печати на стандартных визитках

Все три формата поддерживают кастомизацию бренда: цвет акцента, шрифт,
логотип (PNG/SVG), который встраивается в центр QR-кода (с безопасной
областью ~22% от размера, согласно spec QR-кодов).

## CLI Usage

```bash
# 1. Простой QR для create_crew deep-link
node skills/qr-deeplink-on-demand/scripts/generate-qr.mjs \
  --type create_crew \
  --bot oneBikePlsBot \
  --format raw_png \
  --out /home/z/my-project/download/qr-create-crew.png

# 2. vCard PNG для join_crew (приглашение в экипаж)
node skills/qr-deeplink-on-demand/scripts/generate-qr.mjs \
  --type join_crew \
  --slug vip-bike \
  --bot oneBikePlsBot \
  --format vcard_png \
  --brandName "VIP BIKE ELECTRO" \
  --phone "+7 9200-789-888" \
  --telegram "@I_O_S_NN" \
  --address "пл. Комсомольская 2, Нижний Новгород" \
  --logoUrl "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/logo-electro-neon.png" \
  --accentColor "#FFD700" \
  --out /home/z/my-project/download/qr-join-vip-bike.png

# 3. PDF business card для crew creation (для печати на визитках)
node skills/qr-deeplink-on-demand/scripts/generate-qr.mjs \
  --type create_crew \
  --bot oneBikePlsBot \
  --format pdf_card \
  --brandName "VibeRider" \
  --tagline "Создай свой экипаж за 30 секунд" \
  --phone "+7 900 000 00 00" \
  --telegram "@oneBikePlsBot" \
  --accentColor "#0891B2" \
  --out /home/z/my-project/download/card-create-crew.pdf

# 4. QR для прямого перехода в профиль экипажа
node skills/qr-deeplink-on-demand/scripts/generate-qr.mjs \
  --type profile \
  --slug vip-bike \
  --bot oneBikePlsBot \
  --format raw_png \
  --out /home/z/my-project/download/qr-vip-bike-profile.png

# 5. QR для конкретного лида (используется boss-командами)
node skills/qr-deeplink-on-demand/scripts/generate-qr.mjs \
  --type lead \
  --leadId 356282674 \
  --bot oneBikePlsBot \
  --format raw_png \
  --out /home/z/my-project/download/qr-lead-356282674.png
```

## Поддерживаемые типы deep-link (--type)

> 📚 **Канонический справочник по всем deep-link'ам:** [`docs/DEEP_LINKS_REFERENCE.md`](../../docs/DEEP_LINKS_REFERENCE.md)
> (формат `https://t.me/oneBikePlsBot/app?startapp=<payload>`, все префиксы `rent_`/`rental_`/`analytics_`/
> `lead_`/`leads_`/`buy_`/`testdrive_`/`crew_`/`cart_`/`mapriders_` + порядок обработки в роутере).
> Перед генерацией QR сверяй payload с этим справочником — таблица ниже может отставать от кода.

| Type | Payload | Target route (useStartParamRouter.ts) |
|------|---------|----------------------------------------|
| `create_crew` | `create_crew` | `/franchize/create#create-crew-form` (inline create form) |
| `join_crew` | `crew_<slug>_join_crew` | `/franchize/<slug>?join_crew=true` (auto-join) |
| `profile` | `franchize/<slug>/profile` | `/franchize/<slug>/profile` (user profile page) |
| `lead` | `lead_<userId>` | `/franchize/<slug>/leads?leadId=<userId>` (lead detail) |
| `rental` | `rental_<rentalId>` | `/franchize/<slug>/rental/<rentalId>` (dedicated closure UI, NOT analytics) |
| `analytics` | `analytics_<tab>_<date>` | `/franchize/<slug>/rentals-analytics?ui=v2&tab=<tab>&date=<date>` |
| `custom` | (значение `--payload`) | Любой кастомный startapp payload |

## Required flags

| Flag | Description |
|------|-------------|
| `--type` | Один из поддерживаемых типов (см. таблицу выше) или `custom` |
| `--bot` | Username бота без `@` (например `oneBikePlsBot`) |
| `--format` | `raw_png` \| `vcard_png` \| `pdf_card` |
| `--out` | Абсолютный путь выходного файла |

## Optional flags

| Flag | Description |
|------|-------------|
| `--slug` | Slug экипажа (для типов `join_crew`, `profile`) |
| `--leadId` | ID лида (для типа `lead`) |
| `--rentalId` | ID аренды (для типа `rental`) |
| `--payload` | Кастомный startapp payload (для типа `custom`) |
| `--brandName` | Название бренда для vCard/PDF (по умолчанию: "Экипаж") |
| `--tagline` | Слоган под брендом (только для PDF card) |
| `--phone` | Контактный телефон для vCard/PDF |
| `--telegram` | Telegram-контакт для vCard/PDF |
| `--address` | Адрес для vCard/PDF |
| `--logoUrl` | URL логотипа (PNG/SVG) — встраивается в центр QR + в шапку vCard |
| `--accentColor` | HEX-цвет акцента (по умолчанию: `#FFD700`) |
| `--bgColor` | HEX-цвет фона карточки (по умолчанию: `#0A0A0A`) |
| `--textColor` | HEX-цвет текста (по умолчанию: `#FFFAF0`) |
| `--qrSize` | Размер QR-кода в px (по умолчанию: 512 для raw_png, 360 для vcard_png, 280 для pdf_card) |
| `--errorCorrection` | Уровень коррекции ошибок: `L` \| `M` \| `Q` \| `H` (по умолчанию: `H` для поддержки логотипа в центре) |

## Required Environment Variables

```bash
# Не требуются — все параметры передаются через CLI flags.
# Логотип скачивается по URL через node-fetch (если указан --logoUrl).
```

## Зависимости

Скрипт использует только встроенные модули Node.js + два npm-пакета:
- `qrcode` — генерация QR-кода в PNG (canvas-based, без external API)
- `pdfkit` — генерация PDF (для `--format pdf_card`)

Установка (один раз): `npm install qrcode pdfkit`

## Примеры интеграции

### 1. Boss-command: ежедневная генерация QR для нового экипажа
```bash
# В morning-standup.sh после создания нового экипажа:
node skills/qr-deeplink-on-demand/scripts/generate-qr.mjs \
  --type create_crew \
  --bot oneBikePlsBot \
  --format pdf_card \
  --brandName "$CREW_NAME" \
  --phone "$CREW_PHONE" \
  --telegram "$CREW_TELEGRAM" \
  --out "/tmp/qr-card-$CREW_SLUG.pdf"

# Отправка через codex-notify:
node scripts/codex-notify.mjs telegram-doc \
  --chatId "$ADMIN_CHAT_ID" \
  --document "/tmp/qr-card-$CREW_SLUG.pdf"
```

### 2. Печать визиток для оффлайн-маркетинга
```bash
# Генерация стопки PDF-визиток для команды:
for slug in vip-bike svarprofi electro-enduro; do
  node skills/qr-deeplink-on-demand/scripts/generate-qr.mjs \
    --type profile \
    --slug "$slug" \
    --bot oneBikePlsBot \
    --format pdf_card \
    --out "/home/z/my-project/download/card-$slug.pdf"
done
```

### 3. QR-код для рекламного баннера (только QR, без карточки)
```bash
node skills/qr-deeplink-on-demand/scripts/generate-qr.mjs \
  --type create_crew \
  --bot oneBikePlsBot \
  --format raw_png \
  --qrSize 1024 \
  --out /home/z/my-project/download/qr-create-crew-large.png
```

## Output

Скрипт пишет файл по пути `--out` и логирует в stderr:

```
[qr-deeplink] type=create_crew bot=oneBikePlsBot format=pdf_card
[qr-deeplink] Generated URL: https://t.me/oneBikePlsBot/app?startapp=create_crew
[qr-deeplink] Rendering QR (280×280, errorCorrection=H)...
[qr-deeplink] Downloading logo from https://...
[qr-deeplink] Composing PDF card (A6 landscape, 105×148 mm)...
[qr-deeplink] ✓ Saved: /home/z/my-project/download/card-create-crew.pdf (45.2 KB)
```

## Error Handling

- Если `--logoUrl` не доступен (timeout / 404) → QR генерируется без логотипа
- Если `--type` неизвестен → exit code 2 + сообщение об ошибке
- Если `--out` путь не существует → создаётся автоматически (включая поддиректории)
- Если `qrcode` или `pdfkit` не установлены → exit code 3 + подсказка `npm install qrcode pdfkit`

## Связанные файлы в репозитории

- `hooks/useStartParamRouter.ts` — роутер, который обрабатывает `startapp` payload
- `app/wblanding/components/CrewCreationForm.tsx` — форма создания экипажа (`create_crew`)
- `app/franchize/components/FranchizeProfileButton.tsx` — профиль-дропдаун с "Создать франшизу"
- `docs/crewDocs/vip-bike-franchize-hydration.sql` — SQL-сид для vip-bike экипажа
