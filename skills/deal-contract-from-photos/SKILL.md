---
name: deal-contract-from-photos
description: >
  Definitive edition: единый скилл договоров VIP Bike из фото документов.
  Три типа сделок: rent (прокат), sale (купля-продажа), subrent (субаренда/сотрудничество).
  Всё динамическое из Supabase: байки из public.cars, реквизиты организации из
  private.crew_secrets по crew. Если байка нет в каталоге - добавление на месте
  (catalog-adder-text) или лид. Trigger phrases (RU): "создай документ",
  "сделай договор", "сделай документ по фото", "создай договор продажи",
  "сделай договор купли-продажи", "договор аренды по фото", "субаренда",
  "договор сотрудничества". Trigger phrases (EN): "make contract", "deal contract",
  "sale contract", "rent contract from photos".
---

# deal-contract-from-photos (definitive edition)

Единый скилл договоров: слил в себя `rental-contract-from-photos` (аренда) и старую
версию себя. Один скрипт, три типа сделки, ноль хардкода реквизитов.

Скрипт: `scripts/make-deal-contract-skill.mjs` (запуск из корня репо `carTest`).

## dealType: rent / sale / subrent

| Аспект | rent | sale | subrent |
|---|---|---|---|
| Документ | Договор проката (аренды) | Договор купли-продажи | Договор субаренды/сотрудничества |
| Фото документов | паспорт + ВУ | паспорт (2 стр.) | паспорт владельца (вместо его ВУ) |
| Даты | обязательны (`--startDate/--endDate`) | не нужны | `--contractStartDate`, время 10:00 |
| Цена | `--hourlyPrice`/`--dailyPrice` от оператора | `--salePrice` (всегда явно) | тиры: `--minDailyPrice`, `--hourly3hPrice` и др. |
| Владелец ТС | - | - | `--ownerName --ownerPhone --ownerBirthDate --ownerAddress` |
| Шаблон | `docs/RENTAL_DEAL_TEMPLATE.html` | `docs/SALE_DEAL_TEMPLATE.html` | `docs/SUBRENTAL_DEAL_TEMPLATE.html` |
| metadata table | `rental_contract_artifacts` | `sale_contract_artifacts` | - |

Автоопределение типа по фразе: `продаж|купли-продажи|sale` -> sale; `субаренд|сотрудничеств|subrent` -> subrent; период/`аренд|rent` -> rent; дефолт rent.

## Динамические данные из Supabase (ничего не хардкодить)

Зеркало веб-приложения: `app/webhook-handlers/commands/doc-manual.ts` (`/doc`) +
`app/lib/rental-contract-vars.ts` (`buildRentalContractVariables`). Меняешь логику
переменных тут - проверь, что не разошлось с веб-версией.

| Что | Откуда | Как резолвится |
|---|---|---|
| Байк | `public.cars` (`id, make, model, specs, type, crew_id`) | `--bikeId` или fuzzy-парсинг `--phrase` (название, id, фрагмент VIN); только `type in (bike, ebike)` |
| Реквизиты организации | `private.crew_secrets` по `crew_slug` | цепочка ниже |
| Fallback-реквизиты | константы vip-bike в скрипте | только если в crew_secrets поля пустые |

Цепочка определения crew (как в doc-manual.ts):
1. `--crewSlug` явный override
2. `--userId` (chat_id оператора) -> `crew_members` -> `crews.slug`
3. у найденного байка есть `crew_id` -> `crews.slug`
4. fallback: `vip-bike`

В `crew_secrets` лежат: `organizationName`, `organizationShort`, `organizationRepresentative`,
`issuerName`, `issuerRepresentative`, `signatoryRole`, `ogrnip`, `inn`, `bankAccount`,
`bankName`, `bankCorrAccount`, `legalAddress`, `returnAddress`, `email`. Агент НИКОГДА
не подставляет реквизиты сам - они едут из скрипта по crew. Если у франчайзи пусто в
crew_secrets - скрипт молча возьмёт vip-bike реквизиты: предупреди владельца, это баг данных.

## Байка нет в каталоге -> два пути

**Путь A: добавить байк на месте** (например оператор продаёт новый экземпляр, или байк
с сайта `vip-bike.ru`):
1. Скилл `catalog-adder-text`: `find-reference <марка>` - взять структуру specs у похожего
2. Спеки взять с сайта производителя или vip-bike.ru через WebFetch (НЕ выдумывать)
3. `catalog-add.sh add-bike` -> строка в `public.cars` с правильными crew_id/owner_id/type
4. Повторить resolve байка в договоре - теперь найдётся

**Путь B: это запрос клиента, не наш актив** -> создать лид в таблицу `leads`
(формат как в скилле `leads-crm-text`), чтобы заявку увидела воронка. Например клиент
спрашивает байк, которого нет во флоте.

## Полный реальный список флагов скрипта

Несуществующие флаги (`--skipTelegram`, `--outPath`, `--local`) - НЕ существуют. Сомневаешься
- читай исходник `scripts/make-deal-contract-skill.mjs`, функция `arg()`.

**Общие:** `--dealType` (rent|sale|subrent, обязателен), `--phrase`, `--bikeId`,
`--passportJson` (обязателен), `--licenseJson` (обязателен для rent), `--telegramChatId`
(всегда явно из контекста чата), `--userId` (chat_id оператора: резолвит его crew),
`--crewSlug` (override crew), `--saveMetadata 1`, `--metadataTable`, `--dealDate`.

**rent:** `--startDate`, `--endDate` (DD.MM.YYYY, обязательны), `--startTime` (дефолт 18:00),
`--endTime` (дефолт 10:00), `--dailyPrice`, `--hourlyPrice`, `--deposit`, `--bikeValue`,
`--bikeValueWords`, `--subtotal`, `--latePenalty`, `--latePenaltyMaxDays`, `--lessorAddress`.
Экипировка: `--helmets N`, `--gloves N`, `--charger 1`, `--net 1`, `--backpack 1`, `--bag 1`.
Приёмка: `--odometerBefore N`. Оплата частями: `--cashAmount`, `--bankAmount`.
СТС вместо депозита: `--stsInsteadOfDeposit` + `--stsJson` (series, number, ownerFullName,
vehiclePlate обязательны; опционально issueDate, vehicleVin, vehicleModel, vehicleYear,
ownerRegistration) + `--stsOwnerRelation`, `--stsPledgeReturnDays` (дефолт 3).

**sale:** `--salePrice` (HIGHEST priority, всегда из сообщения оператора), `--productColor`
(конкретный цвет единицы, не каталог), `--productVin` (если в specs пусто - фото рамы через VLM),
`--buyerAddress` (полный адрес текстом, обходит рукописную прописку), `--warrantyMonths`
(дефолт 12), `--sellerAddress`.

**subrent:** `--ownerName`, `--ownerPhone`, `--ownerBirthDate`, `--ownerAddress`,
`--ownerEmail`, `--bikeMake`, `--bikeModel`, `--bikeVin`, `--bikePlate`, `--bikeYear`,
`--bikeValue`, `--ownerPercentage` (дефолт 50), `--minDailyPrice` (9000), `--hourly3hPrice`
(6000), `--hourly6hPrice` (7000), `--hourly12hPrice` (8000), `--weekdayPrice` (14000),
`--weekendPrice` (16000), `--contractStartDate`, `--contractStartTime`.

## Поведение скрипта

- Сам отправляет `.docx` в Telegram. Не сохраняет файл на диск, не отправляй повторно.
- Успех: JSON на stdout (`ok, dealType, resolvedBikeId, chatId, messageId, contractKey, docFileName`).
- Ошибка: JSON на stderr, exit code 2, поле `stage` + `reason`.
- Fallback доставки: `node scripts/codex-notify.mjs telegram-doc --chatId <id> --document <путь>`
  или API `https://v0-car-test.vercel.app/api/forward-telegram`.
- `--saveMetadata 1`: запись метаданных + read-after-write проверка по `contract_key`.
- Для rent дополнительно создаёт строку в `rentals` (crew owner как placeholder user_id).

## Критические нюансы (юридика)

1. **Цена - всегда из сообщения оператора**, не из Supabase: скидки случаются. «аренда за
   9000» на 3 часа -> `--hourlyPrice 3000`; на сутки -> `--dailyPrice 9000`. «продаю за 420» -> `--salePrice 420000`.
2. **Дата договора аренды = дата начала аренды** (`--dealDate` только если подписывают заранее). Сегодняшняя дата при будущей аренде - юр. ошибка.
3. **sale: цвет конкретной единицы**, не каталожный («Белый / Серый» в specs - спроси, какой именно экземпляр).
4. **sale: VIN никогда не «уточняется»**. Пусто в specs -> фото наклейки рамы -> VLM -> `--productVin`. Клиент отказал -> отказ от генерации.
5. **Подписи сторон таблицей** (Арендодатель | Арендатор рядом), чтобы не съезжали на новую страницу.
6. **Склонение организации** скрипт берёт из crew_secrets: `organizationRepresentative` -
   именительный (подписи), `organizationShort` - родительный (внутри предложений). Не путать.
7. **Рукописная прописка**: VLM часто теряет улицу/дом. Адрес только до города -> спроси оператора,
   передай через `--buyerAddress`. На странице прописки брать ПОСЛЕДНИЙ штамп (нижний), зачёркнутые игнорировать.
8. **OCR адресов**: районы искажаются («Шахунский» -> «Махунский»). Подозрительный адрес - переспросить.
9. **ПДн**: фото только в рабочей папке, docx с ПДн никогда не коммитить, в логи - маскированные значения.

## OCR JSON форматы

`passport.json` (главный разворот):
```json
{ "fullName": "Иванов Иван Иванович", "birthDate": "15.03.1990", "series": "2210",
  "number": "542668", "issueDate": "28.06.2010", "issuedBy": "Отделом УФМС России по ...",
  "birthPlace": "г. Ижевск", "registration": "г. Нижний Новгород, ул. ..., д. ..., кв. ...",
  "phone": "+79...", "email": "..." }
```

`license.json` (rent): `{ "series": "....", "number": "......" }`

`sts.json` (rent, при `--stsInsteadOfDeposit`):
```json
{ "series": "77", "number": "12345678", "ownerFullName": "...", "vehiclePlate": "А123БВ777",
  "issueDate": "...", "vehicleVin": "...", "vehicleModel": "...", "vehicleYear": "...",
  "ownerRegistration": "..." }
```

Вторая страница паспорта (sale) - отдельное фото, из неё берём `registration`.

## Пайплайн

```
1. PARSE    : dealType + bikeQuery + даты/цены из сообщения оператора
2. OCR      : фото -> passport.json [+ license.json] [+ sts.json]
3. VALIDATE : полнота полей; адрес до города -> запросить полный
4. RESOLVE  : байк в public.cars; не найден -> путь A (catalog-adder) или B (лид)
5. RUN      : make-deal-contract-skill.mjs (генерация + отправка в Telegram)
6. STDOUT   : messageId, contractKey -> в чат оператору краткое подтверждение
```

## Примеры

**rent (почасовая, Suzuki):**
```bash
node scripts/make-deal-contract-skill.mjs \
  --dealType rent \
  --phrase "сделай документ suzuki-gsx-s1000f с 20.08.2026 в 10:00 до 20.08.2026 в 13:00" \
  --bikeId suzuki-gsx-s1000f \
  --passportJson /tmp/passport.json --licenseJson /tmp/license.json \
  --telegramChatId 413553377 --userId 413553377 \
  --startDate "20.08.2026" --endDate "20.08.2026" --startTime "10:00" --endTime "13:00" \
  --hourlyPrice 3000 --deposit 10000 \
  --saveMetadata 1 --metadataTable rental_contract_artifacts
```

**sale (электробайк, цвет + VIN + адрес текстом):**
```bash
node scripts/make-deal-contract-skill.mjs \
  --dealType sale \
  --phrase "создай договор продажи y-volt" --bikeId y-volt \
  --passportJson /tmp/passport.json \
  --telegramChatId 413553377 --userId 413553377 \
  --buyerAddress "г. Краснодар, б-р Клары Лучко, д. 16, кв. 285" \
  --salePrice 420000 --productColor "БЕЛЫЙ" --productVin "HJDLEZZN0T3A000119" \
  --warrantyMonths 6 \
  --saveMetadata 1 --metadataTable sale_contract_artifacts
```

**subrent (байк владельца в работу, 50/50):**
```bash
node scripts/make-deal-contract-skill.mjs \
  --dealType subrent \
  --phrase "договор сотрудничества yamaha-r7" \
  --passportJson /tmp/owner-passport.json \
  --telegramChatId 413553377 \
  --ownerName "Иванов Иван Иванович" --ownerPhone "+79991234567" \
  --ownerBirthDate "01.01.1990" --ownerAddress "г. Н. Новгород, ул. Ленина, 1" \
  --bikeMake Yamaha --bikeModel "R7" --bikeYear 2023 --bikeVin "JYA...." \
  --bikeValue "1200000" --ownerPercentage 50
```
