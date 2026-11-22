---
name: rental-contract-from-photos
description: >
  DEPRECATED: merged into deal-contract-from-photos (definitive edition) 2026-08-24.
  Rental contracts from photos are now handled by the unified deal-contract skill.
  Trigger phrases (RU): "создай документ", "сделай договор", "сделай документ по фото".
  Trigger phrases (EN): "make contract", "rent contract from photos".
---

# rental-contract-from-photos (deprecated)

Скилл слит в **`deal-contract-from-photos`** (definitive edition, 2026-08-24).

Арендный договор теперь делается так:

```bash
node scripts/make-deal-contract-skill.mjs \
  --dealType rent \
  --phrase "сделай документ <bike> с DD.MM.YYYY по DD.MM.YYYY" \
  --bikeId <bike_id> \
  --passportJson /tmp/passport.json --licenseJson /tmp/license.json \
  --telegramChatId <chat_id> --userId <chat_id> \
  --startDate "DD.MM.YYYY" --endDate "DD.MM.YYYY" \
  --hourlyPrice <руб> | --dailyPrice <руб> --deposit <руб> \
  --saveMetadata 1 --metadataTable rental_contract_artifacts
```

Старый `scripts/make-rental-contract-skill.mjs` (rent-only, без subrent/sale/STS/экипировки)
больше не основной путь. Все нюансы аренды (дата договора = дата начала, подписи таблицей,
цена от оператора, склонение организации из crew_secrets) перенесены в
`skills/deal-contract-from-photos/SKILL.md`.
