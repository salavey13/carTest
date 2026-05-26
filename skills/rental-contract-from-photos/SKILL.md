# rental-contract-from-photos

Команда: `сделай договор <bike_id>`

## Что делает
1. Берет `bike_id` из команды.
2. Достает мотоцикл из Supabase таблицы `cars`.
3. Берет распарсенные данные паспорта/прав из JSON (OCR-результат из фото).
4. Подставляет данные в `docs/RENTAL_DEAL_TEMPLATE_DEMO.md`.
5. Генерирует `.docx` и отправляет в Telegram.

## Запуск
```bash
node scripts/make-rental-contract-skill.mjs \
  --phrase "сделай договор <bike_id>" \
  --passportJson /tmp/passport.json \
  --licenseJson /tmp/license.json \
  --telegramChatId <chat_id>
```

## Формат OCR JSON
`passport.json`:
```json
{ "fullName": "...", "series": "2210", "number": "542668", "phone": "+79..." }
```

`license.json`:
```json
{ "series": "....", "number": "......" }
```
