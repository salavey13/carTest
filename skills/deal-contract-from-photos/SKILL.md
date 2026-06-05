# deal-contract-from-photos (super-skill)

Триггер-фразы:
- **Аренда:** `создай документ`, `сделай договор`, `сделай документ по фото` + rental context
- **Продажа:** `создай договор продажи`, `сделай договор купли-продажи`, `создай документ продажи`, `договор купли-продажи по фото`
- А также `ты босс` + document intent (boss-decomposition + document-autopilot chain)

---

## ⛔ КРИТИЧЕСКИЕ ПРАВИЛА ДЛЯ АГЕНТА (ОБЯЗАТЕЛЬНО К ИСПОЛНЕНИЮ)

### 1. НЕ ВЫДУМЫВАЙ ФЛАГИ CLI-СКРИПТА

Скрипт `scripts/make-deal-contract-skill.mjs` поддерживает **ТОЛЬКО** перечисленные ниже флаги. Любой другой флаг — **придуманный** и приведёт к ошибке или игнорированию.

**Реальные флаги:**
| Флаг | Обязателен | Описание |
|------|-----------|----------|
| `--dealType` | ✅ | `rent` или `sale` |
| `--phrase` | ✅ (или `--bikeId`) | Естественный язык команды (парсится для bikeId и расписания) |
| `--bikeId` | ✅ (или `--phrase`) | ID или поисковый запрос байка |
| `--passportJson` | ✅ | Путь к JSON с данными паспорта |
| `--licenseJson` | ✅ для rent | Путь к JSON с данными ВУ. Для sale — необязателен |
| `--telegramChatId` | ✅ | Chat ID для доставки документа |
| `--startDate` | ✅ для rent | Дата начала аренды (DD.MM.YYYY) |
| `--endDate` | ✅ для rent | Дата окончания аренды (DD.MM.YYYY) |
| `--startTime` | опционально | Время начала (HH:MM, по умолч. 18:00) |
| `--endTime` | опционально | Время окончания (HH:MM, по умолч. 10:00) |
| `--salePrice` | опционально | Цена продажи (если нет в specs байка) |
| `--saveMetadata` | опционально | `1` = сохранить метаданные в Supabase |
| `--metadataTable` | опционально | Имя таблицы (по умолч. rental_contract_artifacts / sale_contract_artifacts) |
| `--dailyPrice` | опционально | Цена аренды за сутки (fallback) |
| `--hourlyPrice` | опционально | Цена аренды за час (fallback) |
| `--deposit` | опционально | Размер депозита (fallback) |
| `--bikeValue` | опционально | Оценочная стоимость байка (fallback) |

**🚫 НЕСУЩЕСТВУЮЩИЕ ФЛАГИ — НЕ ИСПОЛЬЗОВАТЬ:**
- ~~`--skipTelegram`~~ — **НЕ СУЩЕСТВУЕТ**. Скрипт ВСЕГДА отправляет документ в Telegram.
- ~~`--outPath`~~ — **НЕ СУЩЕСТВУЕТ**. Скрипт сам генерирует имя файла и отправляет.
- ~~`--dealDate`~~ — **НЕ СУЩЕСТВУЕТ**. Дата договора = текущая дата (`new Date()`).
- ~~`--local`~~ — **НЕ СУЩЕСТВУЕТ**.

### 2. СКРИПТ АВТОМАТИЧЕСКИ ОТПРАВЛЯЕТ ДОКУМЕНТ В TELEGRAM

Скрипт `make-deal-contract-skill.mjs` **встроенно отправляет** сгенерированный `.docx` в Telegram через Bot API. Агенту **НЕ НУЖНО** и **НЕЛЬЗЯ**:
- Сохранять файл локально и отправлять отдельно
- Добавлять `--skipTelegram` (этого флага нет)
- Изобретать обходной путь для Telegram-доставки

Если Telegram-отправка не удалась, скрипт сам пытается curl-fallback. Если и он не удался — скрипт завершается с кодом 2 и ошибкой `telegram_send_failed`.

### 3. ОБЯЗАТЕЛЬНЫЙ `--telegramChatId`

Если `--telegramChatId` не передан, скрипт использует `ADMIN_CHAT_ID` из env. Агент **ВСЕГДА** должен передать `--telegramChatId` явным образом из контекста задачи (chat_id из bridge-параметров).

### 4. РЕЗУЛЬТАТ СКРИПТА — JSON НА STDOUT

При успехе скрипт выводит JSON на stdout:
```json
{
  "ok": true,
  "dealType": "sale",
  "resolvedBikeId": "falcon-gt",
  "chatId": "123456",
  "messageId": 42,
  "contractKey": "sale-falcon-gt-...",
  "docFileName": "sale-contract-Falcon-GT-06.06.2026.docx"
}
```

При ошибке — JSON на stderr с кодом выхода 2:
```json
{ "ok": false, "stage": "telegram_delivery", "reason": "telegram_send_failed", "details": {...} }
```

Агент должен **прочитать stdout** для получения `messageId` и других данных для callback.

### 5. НЕ КОММИТИТЬ DOCX С ПЕРСОНАЛЬНЫМИ ДАННЫМИ

Сгенерированный `.docx` содержит ПДн (ФИО, паспорт). **Никогда не коммитьте** эти файлы в git. Скрипт не сохраняет файл на диск — он отправляет его напрямую через Telegram API из памяти.

---

## Назначение

Сквозной skill для bridge-задач: OCR/извлечение данных из фото документов, поиск мотоцикла в Supabase, генерация DOCX из шаблона (аренда или купля-продажа), отправка документа и уведомления в Telegram/bridge callback.

Поддерживает **два типа сделок**:
- **rent** — Договор проката (аренды) мотоцикла. Требует паспорт + водительское удостоверение.
- **sale** — Договор купли-продажи электротранспортного средства. Требует только паспорт (2 страницы/фото).

## Определение типа сделки (dealType)

Автоопределение по контексту:
1. Если в сообщении есть слова `продаж`, `купли-продажи`, `купить`, `покупк`, `sale` → `dealType=sale`
2. Если bike найден в Supabase и `specs.sale=true/1` (и нет явного rental-контекста) → `dealType=sale`
3. Если в сообщении указан период аренды (`с ... по ...`, `на сутки`, `аренд`, `rent`) → `dealType=rent`
4. По умолчанию: `dealType=rent`

## End-to-end пайплайн (обязательная последовательность)

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. PARSE: определить dealType + bikeQuery + даты (rent)        │
│ 2. OCR: фото → passport.json [+ license.json для rent]         │
│ 3. VALIDATE: проверить полноту OCR-полей                       │
│ 4. RUN SCRIPT: make-deal-contract-skill.mjs (генерация+отправка)│
│ 5. PARSE STDOUT: получить messageId, contractKey               │
│ 6. CALLBACK: codex-notify.mjs с результатом                    │
└──────────────────────────────────────────────────────────────────┘
```

**Пошагово для агента:**

1. **Определить тип сделки** из текста сообщения оператора.
2. **Извлечь OCR** из фото:
   - rent: паспорт + ВУ → записать JSON-файлы во `/tmp/`
   - sale: только паспорт → записать JSON-файл во `/tmp/`
3. **Валидировать JSON** — проверить наличие обязательных полей (см. OCR JSON формат ниже).
4. **Запустить скрипт** с полным набором флагов (см. примеры ниже).
5. **Прочитать stdout** — извлечь `messageId`, `contractKey`, `docFileName`.
6. **Отправить callback** через `scripts/codex-notify.mjs` с результатом.

## Шаблоны документов

| dealType | Шаблон | Описание |
|----------|--------|----------|
| `rent` | `docs/RENTAL_DEAL_TEMPLATE.html` | Договор проката (аренды) — 13 разделов + 4 приложения |
| `sale` | `docs/SALE_DEAL_TEMPLATE.html` | Договор купли-продажи — 11 разделов + 2 приложения |

## Этапы пайплайна: вход/выход/причины отказа

1) **Определение типа сделки**
- Вход: текст сообщения оператора.
- Выход: `dealType` = `rent` | `sale`.
- Логика: ключевые слова + проверка `specs.sale` в найденном байке.

2) **OCR документов**
- Вход: читаемые фото.
  - rent: паспорт + ВУ (минимум по одному фото каждого)
  - sale: паспорт (2 страницы/фото, водительское удостоверение НЕ требуется)
- Выход: `passport.json`, `license.json` (rent only).
- Типовые причины отказа: `ocr_unreadable`, `missing_passport_photo`, `missing_license_photo` (rent only).

3) **Парсинг полей контрагента**
- Вход: `passport.json`, `license.json` (rent only).
- Выход: `fullName`, `birthDate`, `passport(series,number)`, `license(series,number)` (rent only).
- Типовые причины отказа: `missing_full_name`, `missing_birth_date`, `missing_passport_data`, `missing_driver_license_data` (rent only).

4) **Резолв байка (`cars`)**
- Вход: bike query из фразы (`id`/название/VIN-фрагмент).
- Выход: конкретный `cars.id` + данные байка.
- Типовые причины отказа: `missing_bike_query`, `bike_catalog_empty`, `bike_not_found`.

5) **Генерация DOCX + отправка в Telegram**
- Вход: validated data + resolved bike + dates (rent) / price (sale) + `telegramChatId`.
- Выход: `message_id` отправленного документа в Telegram + JSON на stdout.
- Типовые причины отказа: `missing_rental_dates` (rent), `missing_sale_price` (sale), `template_render_failed`, `telegram_send_failed`.
- ⚠️ **Скрипт отправляет документ автоматически. Агенту не нужно отправлять файл отдельно.**

6) **Callback / metadata verification**
- Вход: delivery result + bridge context.
- Выход: callback status + (опционально) подтверждённая запись метаданных.
- Типовые причины отказа: `metadata_write_failed`, `read_after_write_verification_failed`.

## Правило «не выдумывать значения»
- Критичные поля (`birthDate`, паспортные данные, права, даты аренды, цена продажи, bike query) **нельзя** подставлять дефолтами.
- Если критичных данных не хватает — этап завершается статусом clarification-needed и запросом уточнений.

## Обязательный входной контракт

### Для аренды (rent):
- Фото паспорта и водительского удостоверения (минимум по одному читаемому фото).
- Текст команды с триггером `создай документ` и указанием байка.
- Дата аренды в сообщении (если не указана — запросить уточнение).

### Для продажи (sale):
- Фото паспорта (2 страницы — разворот с фото + страница с пропиской).
- Текст команды с триггером `договор продажи` / `купли-продажи` и указанием байка.
- Цена продажи берётся из `specs.sale_price` / `specs.price_rub` байка. Если не найдена — запросить `--salePrice`.

## Запуск CLI (примеры с полным набором флагов)

### Аренда (rent):
```bash
node scripts/make-deal-contract-skill.mjs \
  --dealType rent \
  --phrase "создай документ falcon-gt с 27.05.2026 по 29.05.2026" \
  --passportJson /tmp/passport.json \
  --licenseJson /tmp/license.json \
  --telegramChatId 123456789 \
  --startDate "27.05.2026" \
  --endDate "29.05.2026" \
  --saveMetadata 1 \
  --metadataTable rental_contract_artifacts
```

### Продажа (sale):
```bash
node scripts/make-deal-contract-skill.mjs \
  --dealType sale \
  --phrase "создай договор продажи falcon-gt" \
  --passportJson /tmp/passport.json \
  --telegramChatId 123456789 \
  --saveMetadata 1 \
  --metadataTable sale_contract_artifacts
```

**Проверка exit-кода:**
- `0` = успех, JSON результат на stdout
- `2` = ошибка, JSON с деталями на stderr

```bash
# Пример правильного запуска с проверкой
node scripts/make-deal-contract-skill.mjs --dealType sale \
  --phrase "создай договор продажи falcon pro" \
  --passportJson /tmp/passport.json \
  --telegramChatId 123456789 && echo "SUCCESS" || echo "FAILED"
```

## OCR JSON формат

`passport.json`
```json
{
  "fullName": "Иванов Иван Иванович",
  "birthDate": "15.03.1990",
  "series": "2210",
  "number": "542668",
  "issueDate": "28.06.2010",
  "issuer": "Отделом УФМС России по ...",
  "registration": "г. Нижний Новгород, ул. ...",
  "phone": "+79...",
  "email": "..."
}
```

`license.json` (rent only)
```json
{
  "series": "....",
  "number": "......"
}
```

## Различия между rent и sale

| Аспект | rent | sale |
|--------|------|------|
| Документ | Договор проката (аренды) | Договор купли-продажи |
| Фото документов | паспорт + ВУ | только паспорт (2 стр.) |
| Даты | обязательны (с...по...) | не нужны |
| Цена | арендная плата (по суткам/часам) | цена продажи (из specs) |
| Депозит | обязателен | нет |
| Гарантия | нет | 6 мес (рама, мотор, АКБ) |
| Приложения | 4 (Акт, Инструкция, Прайс, Согласие) | 2 (Спецификация, Согласие) |
| Шаблон | RENTAL_DEAL_TEMPLATE.html | SALE_DEAL_TEMPLATE.html |
| Контрагент | Арендатор | Покупатель |
| Скрипт | make-deal-contract-skill.mjs --dealType rent | make-deal-contract-skill.mjs --dealType sale |
| metadata table | rental_contract_artifacts | sale_contract_artifacts |
| licenseJson | обязателен | НЕ нужен |

## Правила безопасности/комплаенса
- Поток считается легальным для задач аренды и купли-продажи (см. AGENTS.md), но:
  - не публиковать полный PII в публичных комментариях/PR;
  - в логи/summary выводить только маскированные значения;
  - артефакты хранить только в рамках рабочего потока;
  - **никогда не коммитить** сгенерированные `.docx` с ПДн в git.
