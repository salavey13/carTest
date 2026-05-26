# rental-contract-from-photos

Команда: `сделай договор <bike_id_или_неточный_текст>`

## Что делает
1. Берет запрос на байк из команды (можно неточный id/название).
2. Достает список мотоциклов из Supabase таблицы `cars`.
3. Резолвит самый похожий байк (по `id`, `make`, `model`, VIN/раме) и использует **точные** данные найденной записи.
4. Берет распарсенные данные паспорта/прав из JSON (OCR-результат из фото).
5. Подставляет данные в `docs/RENTAL_DEAL_TEMPLATE_DEMO.md`.
6. Генерирует `.docx` и отправляет в Telegram.

## Запуск
```bash
node scripts/make-rental-contract-skill.mjs \
  --phrase "сделай договор <bike_id_или_название>" \
  --passportJson /tmp/passport.json \
  --licenseJson /tmp/license.json \
  --telegramChatId <chat_id>
```

## Формат OCR JSON
`passport.json`:
```json
{ "fullName": "...", "series": "2210", "number": "542668", "phone": "+79...", "issueDate": "28.06.2010", "registration": "..." }
```

`license.json`:
```json
{ "series": "....", "number": "......" }
```
