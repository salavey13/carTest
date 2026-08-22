---
name: crew-customization-text
description: >
  Customize a franchise crew's public config and contract defaults via a Node
  script built on the shared franchize config contract. Read fields, set fields,
  update private contract defaults, validate, and check readiness.
  Trigger phrases (RU): "настрой экипаж", "измени конфиг экипажа", "поменяй цвет бренда",
  "поменяй телефон в конфиге", "измени контакты", "смени адрес выдачи", "обнови реквизиты",
  "кастомизируй мой сайт", "настрой мой франчайз", "show my crew config".
  Trigger phrases (EN): "customize crew", "edit crew config", "set crew field",
  "change brand color", "update contacts", "update contract defaults", "crew readiness".
---

# Crew Customization (text) — franchise config via shared contract

Триггер-фразы (RU): **`настрой экипаж`**, **`измени конфиг экипажа`**, **`поменяй цвет бренда`**, **`поменяй телефон в конфиге`**, **`измени контакты`**, **`смени адрес выдачи`**, **`обнови реквизиты`**, **`кастомизируй мой сайт`**, **`настрой мой франчайз`**.
Триггер-фразы (EN): `customize crew`, `edit crew config`, `set crew field`, `change brand color`, `update contacts`, `update contract defaults`, `crew readiness`.

## Overview

Позволяет оператору/владельцу экипажа читать и менять конфигурацию своего франчайз-сайта и приватные дефолты договора **прямо из бота/CLI**, без редактора в браузере. Скрипт `scripts/crew-customization-skill.mjs` использует **единый контракт** `app/franchize/lib/franchize-config-contract.ts` — тот же, что используют server actions и редактор `/franchize/create`. Это гарантирует, что значения, сохранённые из бота, валидны и читаемы интерфейсом.

- Публичные настройки живут в `crews.metadata.franchize`.
- Приватные дефолты договора живут в `private.crew_secrets.contract_defaults` (ИНН, реквизиты, ставки, адрес возврата и т.п.).
- Скрипт работает через service-role Supabase client, поэтому **всегда выполняй проверку прав**: кто просит изменить конфиг — должен быть owner/co_owner/admin экипажа (`resolveFranchizeEditorAccess` / `crew_members.membership_status='active'`).

## Supabase Access

```bash
SUPABASE_URL="https://inmctohsodgdohamhzag.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="$(grep SUPABASE_SERVICE_ROLE_KEY /home/z/my-project/upload/secrets.txt | cut -d= -f2-)"
```

В Windows-окружении переменные берутся из `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

## Commands

Все команды запускаются как: `node scripts/crew-customization-skill.mjs <command> [flags]`.
Вывод — JSON на stdout. Человеческие логи — на stderr.

### 1. `list-crews` — список экипажей

```bash
node scripts/crew-customization-skill.mjs list-crews
```

Возвращает: `slug`, `name`, `enabled`, `brandName`, `hasConfig`.

### 2. `get-config --slug <slug>` — полный resolved-конфиг

```bash
node scripts/crew-customization-skill.mjs get-config --slug vip-bike
node scripts/crew-customization-skill.mjs get-config --slug vip-bike --includeSecrets
```

По умолчанию `contractDefaultsJson` / `docTemplatesJson` **редактируются** (маска). Флаг `--includeSecrets` показывает их полностью.

### 3. `show-field --slug <slug> --field <dotpath>` — одно поле

```bash
node scripts/crew-customization-skill.mjs show-field --slug vip-bike --field input.phone
node scripts/crew-customization-skill.mjs show-field --slug vip-bike --field input.accentMain
node scripts/crew-customization-skill.mjs show-field --slug vip-bike --field metadata.branding.name
node scripts/crew-customization-skill.mjs show-field --slug vip-bike --field contractDefaults.issuerName
```

### 4. `set-field --slug <slug> --field <dotpath> --value <raw>` — изменить поле

```bash
node scripts/crew-customization-skill.mjs set-field --slug vip-bike --field input.phone --value "+7 900 123-45-67"
node scripts/crew-customization-skill.mjs set-field --slug vip-bike --field input.brandName --value "VIP BIKE ELECTRO"
node scripts/crew-customization-skill.mjs set-field --slug vip-bike --field input.accentMain --value "#FFD700"
node scripts/crew-customization-skill.mjs set-field --slug vip-bike --field metadata.footer.address --value "пл. Комсомольская 2"
node scripts/crew-customization-skill.mjs set-field --slug vip-bike --field contractDefaults.issuerName --value "ИП Воробьев Роман Валерьевич"
node scripts/crew-customization-skill.mjs set-field --slug vip-bike --field contractDefaults.late_return_penalty_rub --value 5000
```

**Всегда сначала делай `--dryRun`** (печатает before/after без записи):

```bash
node scripts/crew-customization-skill.mjs set-field --slug vip-bike --field input.phone --value "+7 900 123-45-67" --dryRun
```

Значение приводится к типу текущего поля (строка / число / boolean / массив). Если итоговый конфиг не проходит `franchizeConfigSchema`, запись отклоняется с перечнем ошибок.

### 5. `set-contract-default --slug <slug> --field <key> --value <raw>` — приватный дефолт договора

```bash
node scripts/crew-customization-skill.mjs set-contract-default --slug vip-bike --field includedMileage --value 250
node scripts/crew-customization-skill.mjs set-contract-default --slug vip-bike --field issuerRepresentative --value "Сидоров Илья Олегович"
```

### 6. `validate-config --slug <slug>` — проверка

```bash
node scripts/crew-customization-skill.mjs validate-config --slug vip-bike
```

Возвращает `configValid`, `issues[]`, `missingRequired[]` (brandName/phone/email/address/telegram), `hasContractDefaults`.

### 7. `get-readiness --slug <slug>` — чек-лист готовности

```bash
node scripts/crew-customization-skill.mjs get-readiness --slug vip-bike
```

Проверяет: наличие metadata.franchize, валидность схемы, brand, контакты, telegram, menu links, приватные contract_defaults. Флаг `ready: true/false`.

## Namespaces полей (dotpath)

| Prefix | Что это | Примеры |
|---|---|---|
| `input.` (по умолчанию) | Плоский вид редактора (FranchizeConfigInput) | `brandName`, `tagline`, `phone`, `email`, `address`, `telegram`, `themeMode`, `bgBase`, `accentMain`, `textPrimary`, `mapGps`, `socialLinksText`, `menuLinksText`, `categoryOrderText`, `deliveryModesText`, `paymentOptionsText`, `defaultMode`, `issuerName`, `issuerRepresentative`, `includedMileage`, `overageRateRub`, `bikeValueRub`, `bikeValueWords`, `lateReturnPenaltyRub`, `returnAddress`, `allowPromo`, `logoUrl` |
| `metadata.` | Сырой `crews.metadata.franchize` | `metadata.branding.name`, `metadata.contacts.phone`, `metadata.footer.address`, `metadata.theme.mode`, `metadata.catalog.groupOrder` |
| `contractDefaults.` | Приватные `crew_secrets.contract_defaults` | `contractDefaults.issuerName`, `contractDefaults.inn`, `contractDefaults.ogrnip`, `contractDefaults.bankAccount`, `contractDefaults.lateReturnPenaltyRub` |
| `docTemplates.` | Приватные `crew_secrets.doc_templates` | `docTemplates.main` |

## Правила безопасности

1. **Проверяй права перед записью** — только owner/co_owner/admin экипажа может менять конфиг (проверка `crew_members` + `owner_id`).
2. **Секреты не публикуй**: `contractDefaults.` / `docTemplates.` / `contractDefaultsJson` / `docTemplatesJson` в ответе пользователю всегда маскируй, показывай только запрошенные поля (или полный вывод с явного согласия владельца).
3. **Сначала `--dryRun`** на любую запись; применяй без `--dryRun` только после подтверждения оператором.
4. Меняй только те поля, которые оператор явно попросил. Не «оптимизируй» соседние значения.
5. `set-field` проходит валидацию `franchizeConfigSchema` — не пытайся записать невалидное значение.

## Error table

| Ситуация | Поведение | Действие агента |
|---|---|---|
| `crew_not_found` | exit 2 | Уточнить slug через `list-crews` |
| `validation_failed` | exit 2 + список issues | Показать issues оператору, предложить корректное значение |
| `missing_value` | exit 2 | Запросить `--value` у оператора |
| Нет env | `missing_supabase_env`, exit 2 | Загрузить переменные из окружения / secrets |
| `db_error` | exit 2 + message | Сообщить об ошибке БД оператору |

## Files

- `scripts/crew-customization-skill.mjs` — сам скрипт (CLI).
- `app/franchize/lib/franchize-config-contract.ts` — общий контракт (schema + helpers).
- `app/franchize/actions-runtime.ts` — server actions, использующие тот же контракт.
- `lib/franchize-config.ts` — дефолтные константы.
