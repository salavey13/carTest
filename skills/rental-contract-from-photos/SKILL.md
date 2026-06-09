# rental-contract-from-photos (super-skill)

Триггер-фразы: **`создай документ`**, **`сделай договор`**, **`сделай документ по фото`**,
а также `ты босс` + document intent (boss-decomposition + document-autopilot chain).

## ⚠️ AGENT TELEGRAM RESTRICTIONS (CRITICAL)

**Agents MUST NOT send Telegram notifications directly.** Use ONLY the provided APIs:

**Endpoint:** `https://v0-car-test.vercel.app/api/forward-telegram`

**Supported modes in `scripts/codex-notify.mjs`:**

| Mode | Use Case | Example |
|------|----------|---------|
| `telegram-api` | Send text message | `node scripts/codex-notify.mjs telegram-api --chatId 123 --text "Hello"` |
| `telegram-photo-api` | Send photo (base64 or URL) | `node scripts/codex-notify.mjs telegram-photo-api --chatId 123 --photo ./preview.png` |
| `telegram-doc` | Send document (DOCX, PDF) | `node scripts/codex-notify.mjs telegram-doc --chatId 123 --document ./contract.docx` |
| `telegram-media-group` | Send multiple files | `node scripts/codex-notify.mjs telegram-media-group --chatId 123 --document ./doc.docx --qr ./qr.png` |

**When to use fallback:**
- ✅ `TELEGRAM_BOT_TOKEN` is missing/empty
- ✅ Direct Telegram API calls fail (network blocking, rate limits)
- ✅ Agent environment cannot reach Telegram API

**When to use direct API:**
- ✅ You have `TELEGRAM_BOT_TOKEN` AND direct access works

**Contract generation delivery:**
- `scripts/make-rental-contract-skill.mjs` sends to Telegram directly
- If that fails, agent can retry using `telegram-doc` mode with the generated file path

**⛔ PROHIBITED:**
- ❌ Do NOT call `https://api.telegram.org/bot<TOKEN>/...` directly
- ❌ Do NOT attempt to use `TELEGRAM_BOT_TOKEN` (it won't exist in your environment)
- ❌ Do NOT write custom Telegram API integration code

---

## Назначение
Сквозной skill для bridge-задач аренды: OCR/извлечение данных из фото паспорта+прав, поиск мотоцикла в Supabase, генерация DOCX из шаблона, отправка документа и уведомления в Telegram/bridge callback.

## Что делает (end-to-end)
1. Читает сообщение оператора с фразой `создай документ ...` и извлекает:
   - запрос на байк (id/название/фрагмент VIN),
   - дату/период аренды (если указаны в сообщении).
2. Из приложенных фото (паспорт + права) извлекает OCR JSON:
   - паспорт: `fullName`, `series`, `number`, `issueDate`, `registration`, `phone?`;
   - права: `series`, `number`.
3. Вызывает `scripts/make-rental-contract-skill.mjs`:
   - ищет байк в `cars` (Supabase) по fuzzy-матчингу;
   - подставляет точные поля байка + OCR данные в `docs/RENTAL_DEAL_TEMPLATE_DEMO.md`;
   - генерирует `.docx`;
   - отправляет документ в Telegram.
4. Отправляет служебное уведомление через `scripts/codex-notify.mjs` (callback/callback-auto), если есть bridge-контекст.

## Этапы пайплайна: вход/выход/причины отказа

1) **OCR документов**
- Вход: читаемые фото паспорта + ВУ.
- Выход: `passport.json`, `license.json`.
- Типовые причины отказа: `ocr_unreadable`, `missing_passport_photo`, `missing_license_photo`.

2) **Парсинг renter-полей**
- Вход: `passport.json`, `license.json`.
- Выход: `fullName`, `birthDate`, `passport(series,number)`, `license(series,number)`.
- Типовые причины отказа: `missing_full_name`, `missing_birth_date`, `missing_passport_data`, `missing_driver_license_data`.

3) **Резолв байка (`cars`)**
- Вход: bike query из фразы (`id`/название/VIN-фрагмент).
- Выход: конкретный `cars.id` + данные байка.
- Типовые причины отказа: `missing_bike_query`, `bike_catalog_empty`, `bike_not_found`.

4) **Генерация DOCX**
- Вход: validated renter data + resolved bike + даты аренды.
- Выход: готовый `.docx` договор.
- Типовые причины отказа: `missing_rental_dates`, `template_render_failed`.

5) **Доставка в Telegram**
- Вход: `.docx` + `telegramChatId` + bot token.
- Выход: `message_id` отправленного документа.
- Типовые причины отказа: `telegram_send_failed`.

6) **Callback / metadata verification**
- Вход: delivery result + bridge context.
- Выход: callback status + (опционально) подтверждённая запись метаданных.
- Типовые причины отказа: `metadata_write_failed`, `read_after_write_verification_failed`, `callback_send_failed`.

## Правило «не выдумывать значения»
- Критичные поля (`birthDate`, паспортные данные, права, даты аренды, bike query) **нельзя** подставлять дефолтами.
- Если критичных данных не хватает — этап завершается статусом clarification-needed (или fail-кодом из списка выше) и запросом уточнений.

## Обязательный входной контракт
- Фото паспорта и водительского удостоверения (минимум по одному читаемому фото).
- Текст команды с триггером `создай документ` и указанием байка.
- Дата аренды в сообщении (если не указана — запросить уточнение, не фантазировать даты).

## Запуск CLI
```bash
node scripts/make-rental-contract-skill.mjs \
  --phrase "создай документ <bike_id_или_название> с 27.05.2026 по 29.05.2026" \
  --passportJson /tmp/passport.json \
  --licenseJson /tmp/license.json \
  --telegramChatId <chat_id> \
  --startDate "27.05.2026" \
  --endDate "29.05.2026" \
  --saveMetadata 1 \
  --metadataTable rental_contract_artifacts
```

`--saveMetadata 1` включает read-after-write verification: после insert в `--metadataTable` скрипт выполняет read-check по `contract_key` и только затем считает процесс завершённым.

## OCR JSON формат
`passport.json`
```json
{ "fullName": "...", "series": "2210", "number": "542668", "phone": "+79...", "issueDate": "28.06.2010", "registration": "..." }
```

`license.json`
```json
{ "series": "....", "number": "......" }
```

## Правила безопасности/комплаенса
- Поток считается легальным для задач аренды (см. AGENTS.md), но:
  - не публиковать полный PII в публичных комментариях/PR;
  - в логи/summary выводить только маскированные значения;
  - артефакты хранить только в рамках рабочего потока.
