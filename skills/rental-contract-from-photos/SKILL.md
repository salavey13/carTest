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

# CHANGES — СТС-as-deposit feature (2026-06-17)

Enhances the rental flow (`make-deal-contract-skill.mjs --dealType rent`)
with the ability to **swap the cash security deposit for the renter's own
vehicle СТС (Свидетельство о регистрации ТС) held in pledge**.

All changes are **opt-in** via `--stsInsteadOfDeposit`. The default
behaviour (cash deposit) is preserved bit-for-bit.

---

## Files changed (5)

| File | Change |
|------|--------|
| `supabase/migrations/20260617000000_rental_sts_pledge.sql` | **NEW.** Adds `sts_*` columns to `private.rental_contract_artifacts` (created by migration `20260612000000_fix_rental_contract_artifacts.sql`) and `private.user_rental_secrets` (created by `20260601000000_user_rental_secrets.sql`). Idempotent (`IF NOT EXISTS`), so safe to apply on any prior version. |
| `scripts/make-deal-contract-skill.mjs` | Extended: new CLI flags `--stsInsteadOfDeposit`, `--stsJson`, `--stsOwnerRelation`, `--stsPledgeReturnDays`. Loads+validates `sts.json`. Adds 13 `sts_*` vars to the rent-flow `vars` object. Surfaces `stsPledgeUsed`, `stsSeries`, `stsNumber`, … in the result JSON. Writes all `sts_*` fields to the metadata table when `--saveMetadata 1`. Also extends `renderTemplateWithVars()` with `{{#if var}}…{{else}}…{{/if}}` support (HTML-comment-stripping + innermost-first + `s` dotAll flag for multiline blocks). |
| `docs/RENTAL_DEAL_TEMPLATE.html` | 8 new `{{#if sts_collateral}}…{{else}}…{{/if}}` blocks wrapping: §3.6, §3.7, §4.3, §4.4, §4.5, App.1 перепробег, App.1 new "Переданные в залог документы" block, App.3 lines 4-5-7 and price-table "Мойка" row. Plus new clause §4.7 (guarantees of lawful СТС ownership). Optional nested `{{#if}}` for `sts_issue_date`, `sts_vehicle_year`, `sts_vehicle_vin`, `sts_owner_registration` — auto-dropped when the corresponding OCR field is empty. |
| `skills/rental-contract-from-photos/SKILL.md` | New top-of-file block listing СТС trigger phrases. New bottom-of-file section "Режим «СТС-вместо-депозита»" with full pipeline: when to apply, trigger phrases, OCR contract, `sts.json` schema, CLI invocation, failure codes, table of contractual differences, DB persistence, СТС return procedure. |

---

## What the operator sees

Default rent flow (cash deposit) — **unchanged**:

```
> создай документ falcon-gt с 27.06.2026 по 29.06.2026
[operator sends passport + license photos]
[script generates DOCX with §4.3 = "Обеспечительный платеж (депозит): 20000 руб., вносится до передачи ТС…"]
```

New СТС-as-deposit flow:

```
> создай документ falcon-gt с 27.06.2026 по 29.06.2026 под СТС
[operator sends passport + license + СТС photos]
[script generates DOCX with §4.3 = "В качестве обеспечительного платежа Арендатор передаёт Арендодателю в залог оригинал Свидетельства о регистрации транспортного средства (СТС) серии 77 № 12345678, выдано 15.05.2023, на транспортное средство марки/модели Toyota Camry 2021 г.в., государственный регистрационный знак А123БВ77, VIN XTA12345678901234. Собственник указанного ТС: Иванов Иван Иванович…"]
```

---

## CLI examples

### Cash deposit (default, unchanged)
```bash
node scripts/make-deal-contract-skill.mjs \
  --dealType rent \
  --phrase "создай документ falcon-gt с 27.06.2026 по 29.06.2026" \
  --passportJson /tmp/passport.json \
  --licenseJson /tmp/license.json \
  --telegramChatId 123456789 \
  --startDate "27.06.2026" \
  --endDate "29.06.2026" \
  --saveMetadata 1
```

### СТС instead of cash deposit (new)
```bash
node scripts/make-deal-contract-skill.mjs \
  --dealType rent \
  --phrase "создай документ falcon-gt с 27.06.2026 по 29.06.2026 под СТС" \
  --passportJson /tmp/passport.json \
  --licenseJson /tmp/license.json \
  --stsInsteadOfDeposit \
  --stsJson /tmp/sts.json \
  --telegramChatId 123456789 \
  --startDate "27.06.2026" \
  --endDate "29.06.2026" \
  --saveMetadata 1
```

### СТС owned by a third party (e.g. renter's wife)
```bash
node scripts/make-deal-contract-skill.mjs \
  --dealType rent \
  --phrase "создай документ falcon-gt с 27.06.2026 по 29.06.2026 под СТС" \
  --passportJson /tmp/passport.json \
  --licenseJson /tmp/license.json \
  --stsInsteadOfDeposit \
  --stsJson /tmp/sts.json \
  --stsOwnerRelation "жена" \
  --telegramChatId 123456789 \
  --startDate "27.06.2026" \
  --endDate "29.06.2026" \
  --saveMetadata 1
```

---

## Live Supabase verification (2026-06-17)

Tested against `https://inmctohsodgdohamhzag.supabase.co` (project v0-car-test) using the provided service-role key. Confirmed:

1. **`cars` table is queryable** — bike-by-id lookup returns proper `specs` JSON. 10 bikes in the catalog, including `falcon-gt-2025`, `falcon-pro-2025`, `ducati-panigale-s-electro`, `kawasaki-ex650k`, `vipbike-dmg`, etc. The bike-resolution logic in `make-deal-contract-skill.mjs` will work end-to-end.
2. **`private.rental_contract_artifacts` exists and is queryable** via PostgREST with `Accept-Profile: private` header (table already created by migration `20260612000000_fix_rental_contract_artifacts.sql`).
3. **`private.user_rental_secrets` exists and is queryable** (table already created by migration `20260601000000_user_rental_secrets.sql`).
4. **The new `sts_*` columns are NOT yet applied** — Supabase's service-role key cannot run DDL over HTTP by design (`/pg/query` and `/pg/meta/query` return 404; `exec_sql` RPC doesn't exist by default). You need to apply the migration manually via the dashboard SQL editor:

   ```
   https://supabase.com/dashboard/project/inmctohsodgdohamhzag/sql/new
   ```

   Paste the contents of `supabase/migrations/20260617000000_rental_sts_pledge.sql` and click RUN. The migration is idempotent (`IF NOT EXISTS` on every column) so it's safe to re-run.

   After applying, you can verify with this check from the dashboard:

   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_schema = 'private' AND table_name = 'rental_contract_artifacts'
     AND column_name LIKE 'sts_%' OR column_name = 'deposit_amount_skipped'
   ORDER BY column_name;
   -- Expected: 13 rows
   ```

---

## Result JSON

When `--stsInsteadOfDeposit` is set, the script's stdout JSON gains these fields:

```json
{
  "ok": true,
  "dealType": "rent",
  "resolvedBikeId": "falcon-gt",
  "stsPledgeUsed": true,
  "stsSeries": "77",
  "stsNumber": "12345678",
  "stsVehiclePlate": "А123БВ77",
  "stsOwnerFullName": "Иванов Иван Иванович",
  "stsOwnerRelation": "сам арендатор",
  "stsPledgeReturnDays": "3",
  "depositAmountSkipped": "20000",
  "metadataVerified": true,
  "metadataTable": "rental_contract_artifacts"
}
```

When `--stsInsteadOfDeposit` is NOT set, the result gains a single field `"stsPledgeUsed": false` and no other СТС fields — backward compatible.

---

## Failure codes added

| Stage | Reason | When |
|-------|--------|------|
| `sts_parse` | `missing_stsJson` | `--stsInsteadOfDeposit` set but `--stsJson <path>` not passed |
| `sts_parse` | `sts_json_invalid` | `--stsJson` is not valid JSON |
| `sts_parse` | `missing_sts_series_number` | OCR JSON missing `series` or `number` |
| `sts_parse` | `missing_sts_owner` | OCR JSON missing `ownerFullName` |
| `sts_parse` | `missing_sts_vehicle_plate` | OCR JSON missing `vehiclePlate` |
| `sts_parse` | `sts_owner_mismatch` | `ownerFullName` ≠ `renter_full_name` AND `--stsOwnerRelation` left at default |

All exit code 2, JSON payload on stderr (matches the existing `failStage()` convention).

---

## Backward compatibility

- **No flag changes**: every existing flag works exactly as before.
- **No template breakage**: when `sts_collateral` is empty (the default), every `{{#if sts_collateral}}…{{else}}…{{/if}}` block renders the `else` branch, which is byte-identical to the original text.
- **No DB breakage**: every new column is nullable or has a default, so existing rows in `private.rental_contract_artifacts` and `private.user_rental_secrets` remain valid without backfill.
- **Engine extension is additive**: `renderTemplateWithVars()` still does `{{var}}` interpolation exactly as before; the new `{{#if}}` handling is layered on top and only activates when `{{#if` appears in the template.

---

## Verified

- `node --check scripts/make-deal-contract-skill.mjs` → SYNTAX OK
- Smoke test `scripts/test_template_engine.mjs` → **14/14 assertions pass** for both branches (cash deposit + СТС pledge) and for the optional-fields-empty edge case.
- Template `{{#if}}` / `{{else}}` / `{{/if}}` count balanced (15 opens / 15 closes, 8 with else, 7 without).

## Правила безопасности/комплаенса
- Поток считается легальным для задач аренды (см. AGENTS.md), но:
  - не публиковать полный PII в публичных комментариях/PR;
  - в логи/summary выводить только маскированные значения;
  - артефакты хранить только в рамках рабочего потока.
