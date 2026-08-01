---
name: pdf-bike-sheet-on-demand
description: >
  Generate a single-bike "buy sheet" PDF on demand for a specific franchize
  bike. Wraps the existing /api/franchize/[slug]/buy/print-pdf endpoint to
  fetch one bike's data (photo, specs, sale price, QR code to buy link) and
  render it as a printable A4 or A5 PDF. Use this skill whenever the user asks
  to "make a PDF for this bike", "сгенерируй PDF для конкретного байка",
  "create a buy sheet for bike X", "print one bike PDF", or any time a
  single-bike marketing PDF is needed (as opposed to the bulk-sale-pdf skill
  which iterates all sale bikes at once).
  Triggers: "pdf для байка", "сгенерируй pdf для конкретного", "single bike pdf",
  "one bike pdf", "print one bike", "buy sheet pdf".
---

# pdf-bike-sheet-on-demand (skill)

Триггер-фразы: **`pdf для байка`**, **`сгенерируй pdf для конкретного`**,
**`single bike pdf`**, **`one bike pdf`**, **`print one bike`**,
**`buy sheet pdf`**, а также `ты босс` + single-bike-pdf intent.

## Назначение

Генерация PDF-карточки для ОДНОГО конкретного байка во франшизе. В отличие
от bulk-sale-pdf, который итерирует все байки со `specs.sale=true` и шлёт
пачку в Telegram, этот skill берёт один `bikeId` и:

1. Вызывает `GET /api/franchize/<slug>/buy/print-pdf` с `returnBytes: true`
2. Получает base64-кодированный PDF байта-в-байт (то же содержимое, что
   у bulk-sale-pdf для этого байка)
3. Сохраняет PDF в `/home/z/my-project/download/`
4. Опционально — отправляет в Telegram через codex-notify (`--telegramChatId`)

## CLI Usage

```bash
# 1. Базовая генерация PDF для одного байка (A4, на диск)
node skills/pdf-bike-sheet-on-demand/scripts/generate-bike-pdf.mjs \
  --slug vip-bike \
  --bikeId falcon-gt \
  --out /home/z/my-project/download/BUY_falcon-gt.pdf

# 2. Генерация в A5 (компактный)
node skills/pdf-bike-sheet-on-demand/scripts/generate-bike-pdf.mjs \
  --slug vip-bike \
  --bikeId falcon-gt \
  --pageSize A5 \
  --out /home/z/my-project/download/BUY_falcon-gt-A5.pdf

# 3. Генерация + отправка в Telegram
node skills/pdf-bike-sheet-on-demand/scripts/generate-bike-pdf.mjs \
  --slug vip-bike \
  --bikeId falcon-gt \
  --telegramChatId 356282674 \
  --out /home/z/my-project/download/BUY_falcon-gt.pdf

# 4. Генерация без сохранения на диск (только отправка в Telegram)
node skills/pdf-bike-sheet-on-demand/scripts/generate-bike-pdf.mjs \
  --slug vip-bike \
  --bikeId falcon-gt \
  --telegramChatId 356282674 \
  --noSave

# 5. Кастомный site URL (если prod недоступен)
node skills/pdf-bike-sheet-on-demand/scripts/generate-bike-pdf.mjs \
  --slug vip-bike \
  --bikeId falcon-gt \
  --siteUrl https://v0-car-test.vercel.app \
  --out /home/z/my-project/download/BUY_falcon-gt.pdf
```

## Required flags

| Flag | Description |
|------|-------------|
| `--slug` | Franchize slug (e.g., `vip-bike`) |
| `--bikeId` | Bike ID within the franchize (e.g., `falcon-gt`) |

## Optional flags

| Flag | Description |
|------|-------------|
| `--out` | Output file path (REQUIRED unless `--noSave` is set) |
| `--pageSize` | `A4` (default) or `A5` |
| `--siteUrl` | Next.js site URL (default: `NEXT_PUBLIC_SITE_URL` env or `http://localhost:3000`) |
| `--telegramChatId` | If set, also sends the PDF to this Telegram chat |
| `--noSave` | Skip writing to disk (use with `--telegramChatId`) |
| `--serviceRoleKey` | Override Supabase service role key (default: from env) |

## Required Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=https://your-site.com  # For API calls (default: localhost:3000)
FORWARD_TELEGRAM_API=https://v0-car-test.vercel.app/api/forward-telegram  # For Telegram delivery
```

## Зависимости

Скрипт использует только встроенные модули Node.js — никаких внешних npm-пакетов.
PDF генерируется серверной стороной (через существующий API endpoint
`/api/franchize/[slug]/buy/print-pdf`), скрипт просто скачивает base64 и
декодирует в файл.

## Output

JSON в stdout:

```json
{
  "ok": true,
  "slug": "vip-bike",
  "bikeId": "falcon-gt",
  "pageSize": "A4",
  "file": "/home/z/my-project/download/BUY_falcon-gt.pdf",
  "sizeBytes": 145823,
  "telegramSent": false,
  "telegramMessageId": null
}
```

## Что внутри PDF

PDF содержит (для одного байка):
- **Шапка**: брендинг экипажа + accent-линия
- **Заголовок**: Название байка (на всю ширину)
- **Цена**: Sale price из specs
- **Описание**: Bike description
- **Таблица спецификаций**: ключевые характеристики (мощность, крутящий момент, запас хода, вес и т.д.)
- **Изображение**: Cover-fit фото байка (9:16 ratio)
- **QR-коды**: Ссылка на покупку + ссылка на VK-группу
- **Блок аренды**: Часовые/дневные ставки аренды (если доступны)

## Сравнение с bulk-sale-pdf

| Аспект | bulk-sale-pdf | pdf-bike-sheet-on-demand (этот skill) |
|--------|---------------|----------------------------------------|
| Что генерирует | Все байки со `specs.sale=true` | Один конкретный байк |
| Endpoint | `/api/franchize/<slug>/buy/print-pdf-bulk` | `/api/franchize/<slug>/buy/print-pdf` |
| Trigger | "bulk PDF", "прайс-лист PDF" | "PDF для конкретного байка" |
| Когда использовать | Маркетинговая стопка на все байки | Точечная генерация под один лид/заказ |

## Примеры интеграции

### 1. Boss-command: генерация PDF после нового лида на покупку
```bash
# В lead-development-watchdog.sh когда лид готов к покупке (intent=prebuy):
node skills/pdf-bike-sheet-on-demand/scripts/generate-bike-pdf.mjs \
  --slug "$LEAD_SLUG" \
  --bikeId "$LEAD_BIKE_ID" \
  --telegramChatId "$OPERATOR_CHAT_ID" \
  --noSave
```

### 2. Ручная генерация для конкретного клиента
```bash
# По запросу оператора "сделай PDF на falcon-gt для клиента":
node skills/pdf-bike-sheet-on-demand/scripts/generate-bike-pdf.mjs \
  --slug vip-bike \
  --bikeId falcon-gt \
  --pageSize A4 \
  --out /home/z/my-project/download/BUY_falcon-gt-$(date +%Y%m%d).pdf

# Затем отправить через codex-notify:
node scripts/codex-notify.mjs telegram-doc \
  --chatId "$CLIENT_CHAT_ID" \
  --document /home/z/my-project/download/BUY_falcon-gt-20260730.pdf
```

### 3. Combo с qr-deeplink-on-demand
```bash
# Сгенерировать PDF + QR-карточку для того же байка:
BIKE_ID=falcon-gt
SLUG=vip-bike

node skills/pdf-bike-sheet-on-demand/scripts/generate-bike-pdf.mjs \
  --slug $SLUG --bikeId $BIKE_ID \
  --out /home/z/my-project/download/BUY_$BIKE_ID.pdf

node skills/qr-deeplink-on-demand/scripts/generate-qr.mjs \
  --type profile --slug $SLUG --bot oneBikePlsBot \
  --format pdf_card \
  --brandName "VIP BIKE ELECTRO" \
  --out /home/z/my-project/download/CARD_$SLUG.pdf
```

## Error Handling

Все ошибки возвращают JSON с `ok: false` и понятным сообщением. PDF сохраняется даже при ошибке отправки в Telegram.

- Bike not found → exit 4 + JSON `{"ok": false, "error": "Bike not found: <bikeId>"}`
- API endpoint 401 → exit 5 + JSON `{"ok": false, "error": "Unauthorized — check SUPABASE_SERVICE_ROLE_KEY"}`
- Network timeout (15s) → exit 6 + JSON `{"ok": false, "error": "API timeout"}`
- Telegram delivery pending → exit 7 + JSON `{"ok": true, "telegramSent": false, "telegramError": "..."}` (PDF still saved)

## Связанные файлы в репозитории

- `app/api/franchize/[slug]/buy/print-pdf/route.ts` — API endpoint (используется)
- `app/api/franchize/[slug]/buy/print-pdf-bulk/route.ts` — bulk endpoint (для сравнения)
- `app/franchize/server-actions/buy-print.ts` — server action `generateBuyPdf()`
- `scripts/bulk-sale-pdf-skill.mjs` — sibling skill (генерация для всех байков)
