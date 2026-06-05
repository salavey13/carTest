# deal-contract-from-photos (super-skill)

Триггер-фразы:
- **Аренда:** `создай документ`, `сделай договор`, `сделай документ по фото` + rental context
- **Продажа:** `создай договор продажи`, `сделай договор купли-продажи`, `создай документ продажи`, `договор купли-продажи по фото`
- А также `ты босс` + document intent (boss-decomposition + document-autopilot chain)

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

## Что делает (end-to-end)

1. Читает сообщение оператора с триггер-фразой и извлекает:
   - тип сделки (rent / sale),
   - запрос на байк (id/название/фрагмент VIN),
   - дату/период аренды (для rent, если указаны).
2. Из приложенных фото извлекает OCR JSON:
   - **rent:** паспорт + водительское удостоверение,
   - **sale:** только паспорт (2 страницы/фото).
3. Вызывает `scripts/make-deal-contract-skill.mjs --dealType <rent|sale>`:
   - ищет байк в `cars` (Supabase) по fuzzy-матчингу;
   - подставляет данные байка + OCR данные в соответствующий шаблон;
   - генерирует `.docx` через HTML→DOCX pipeline (`lib/htmlToDocx.mjs`);
   - отправляет документ в Telegram.
4. Отправляет служебное уведомление через `scripts/codex-notify.mjs`.

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

5) **Генерация DOCX**
- Вход: validated data + resolved bike + dates (rent) / price (sale).
- Выход: готовый `.docx` договор.
- Типовые причины отказа: `missing_rental_dates` (rent), `missing_sale_price` (sale), `template_render_failed`.

6) **Доставка в Telegram**
- Вход: `.docx` + `telegramChatId` + bot token.
- Выход: `message_id` отправленного документа.
- Типовые причины отказа: `telegram_send_failed`.

7) **Callback / metadata verification**
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

## Запуск CLI

### Аренда (rent):
```bash
node scripts/make-deal-contract-skill.mjs \
  --dealType rent \
  --phrase "создай документ falcon-gt с 27.05.2026 по 29.05.2026" \
  --passportJson /tmp/passport.json \
  --licenseJson /tmp/license.json \
  --telegramChatId <chat_id> \
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
  --telegramChatId <chat_id> \
  --saveMetadata 1 \
  --metadataTable sale_contract_artifacts
```

`--saveMetadata 1` включает read-after-write verification.

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

## Правила безопасности/комплаенса
- Поток считается легальным для задач аренды и купли-продажи (см. AGENTS.md), но:
  - не публиковать полный PII в публичных комментариях/PR;
  - в логи/summary выводить только маскированные значения;
  - артефакты хранить только в рамках рабочего потока.
