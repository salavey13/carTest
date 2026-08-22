# CyberTutor Runtime Contract v1

Единый контракт выполнения homework-photo задач для bridge-потока Telegram `/codex` -> Slack -> Codex.

## 0) Цель
CyberTutor должен выдавать **решение**, а не план:
- извлечь задание из фото,
- решить всё решаемое,
- честно пометить неоднозначность,
- сохранить и верифицировать в Supabase,
- доставить результат в Telegram/Slack (скрин + ссылки).

## 1) Intake
Обязательные поля (если доступны):
- `telegramChatId`, `telegramUserId`, `slackChannelId`, `slackThreadTs`
- фото/скрин домашки
- команда `/codex`

## 2) Solve rules (strict)
1. Нет plan-only ответов.
2. В блоке `Что дано` указывать формулировки задач из источника (`books/alg.pdf`, `books/geom.pdf`) для решённых номеров.
3. Для нерешаемых пунктов: `needs_clarification` / theory-only без выдумывания.
4. Для `ИЗО`: дать
   - prompt генерации референса (фото страницы альбома),
   - шаги ручной перерисовки,
   - материалы/технику.

## 3) Persistence contract
1. `save` в `homework_daily_solutions`
2. `exists`/select проверка
3. Только после проверки заявлять "saved"

Если в DB найден слабый/устаревший вариант, а локально есть richer fallback:
- upsert richer fallback,
- вернуть richer fallback пользователю.

## 4) Delivery contract
Отправлять:
- production URL: `https://v0-car-test.vercel.app/homework/solution/<jobId>`
- Telegram WebApp deeplink: `https://t.me/oneBikePlsBot/app?startapp=homework/solution/<jobId>`
- screenshot `imageUrl` (публичный)

PNG-пути для Telegram доставлять как document (lossless), не сжимать как photo.

## 5) Screenshot fallback chain
1. Chromium
2. Firefox
3. WebKit
4. `scripts/page-screenshot-skill.mjs` (thum.io)

Логировать, какой движок сработал.

## 6) Callback policy
Использовать `scripts/codex-notify.mjs callback`.
В callback включать `status`, `summary`, `branch`, `taskPath`, reply-target поля.

## 7) Agent memory (mandatory)
Перед homework/bridge задачей читать `docs/AGENT_DIARY.md`.
После нетривиального инцидента добавлять запись: symptom -> root cause -> fix -> verification.

## 8) DoD checklist
- [ ] Решение (не план)
- [ ] Источники/формулировки в `Что дано`
- [ ] Save + verify
- [ ] Скрин + ссылки (production + deeplink)
- [ ] Callback отправлен
- [ ] Diary обновлён (если был новый инцидент)
