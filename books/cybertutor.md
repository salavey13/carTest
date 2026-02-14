# CyberTutor — operator spec (7 класс, RU-first)

## 1) Product goal

CyberTutor — Telegram-first помощник для 7 класса:
ученик присылает `/codex` + фото домашки, а Codex-агент сам проходит весь цикл: OCR, поиск в PDF-контексте, решение и отправка результата обратно в операторский канал.

Ключевая цель:
- минимальный ручной orchestration;
- ноль офлайн batch/index jobs;
- вся логика «на лету» в Codex runtime (task-by-task);
- понятный короткий ответ для ученика + артефакт-скрин результата достойного качества.

Базовый учебный контекст (подхватывается в prompt/context рантайма):
- `/books/alg.pdf` — Алгебра, 7 класс (Макарычев Ю.Н., Миндюк Н.Г. и др., 2024);
- `/books/geom.pdf` — Геометрия, 7–9 класс (Атанасян Л.С. и др., 2024).

---

## 2) Intake contract (Telegram + `/codex` + photo)

### 2.1 Entry flow (strict)

1. Ученик/оператор отправляет в Telegram: `/codex ...` + фото домашки.
2. Telegram webhook принимает update и передаёт команду в bridge.
3. Команда форвардится в Slack (с `@codex`) вместе с контекстом и медиа.
4. Codex bot в Slack подхватывает задачу, создаёт task и запускает решение.

### 2.2 Intake payload (минимум)

```json
{
  "source": "telegram",
  "telegramChatId": "<string>",
  "telegramUserId": "<string>",
  "messageId": "<string|number>",
  "command": "/codex <task>",
  "text": "<optional>",
  "photo": {
    "fileId": "<telegram_file_id>",
    "mimeType": "image/jpeg"
  },
  "locale": "ru-RU",
  "grade": 7
}
```

Routing notes:
- `/codex` обязателен для bridge-сценария;
- фото домашки считается главным входом;
- если текст и фото конфликтуют, приоритет у видимого условия на фото + явная пометка uncertainty.

---

## 3) On-the-fly parse + PDF ragging (no offline jobs)

Важно: **не использовать офлайн индексаторы, ночные precompute и отдельные parser jobs**.

Вместо этого Codex делает всё внутри текущего task:
1. OCR фото задания прямо в задаче;
2. выделяет номер/тему/ключевые слова;
3. поднимает `alg.pdf` и `geom.pdf` в VM-контексте;
4. делает on-the-fly ragging/поиск по PDF (по номеру задания + ключевым фразам);
5. читает релевантные фрагменты и решает задачу;
6. оформляет ответ в формате для ученика (коротко, RU-first).

Рекомендуемый tool pattern:
- «skill, аналогичный picture-taking», но для PDF ragging на лету;
- без сохранения долговременных эмбеддингов;
- без зависимости от внешнего offline retrieval pipeline.

---

## 4) Solve flow on Codex side

1. `/codex` задача появляется в Slack-треде.
2. Codex бот получает фото и текстовый prompt.
3. Делает OCR и нормализацию условия.
4. Спинит VM runtime с доступом к PDF.
5. Находит задачу в учебнике (по номеру/формулировке).
6. Строит решение шагами (уровень 7 класса).
7. Генерирует итоговый ответ + краткую проверку.
8. Использует screenshot skill и отправляет скрин страницы результата обратно (decent quality).

Качество screenshot:
- читаемый шрифт, без сильной компрессии;
- видны «Что дано / Решение / Ответ»;
- без обрезания ключевых строк.

---

## 5) Solution output contract and callback payload examples

### 5.1 Student-facing output contract

```json
{
  "status": "completed|needs_clarification|failed",
  "problemRestatement": "<коротко и точно>",
  "steps": ["Шаг 1 ...", "Шаг 2 ...", "Шаг 3 ..."],
  "finalAnswer": "<итог>",
  "check": "<короткая проверка>",
  "uncertaintyNote": "<если фото/условие нечитабельно>",
  "screenshotAttached": true
}
```

### 5.2 Callback example (completed)

```bash
curl -X POST "https://v0-car-test.vercel.app/api/codex-bridge/callback" \
  -H "Content-Type: application/json" \
  -H "x-codex-bridge-secret: $CODEX_BRIDGE_CALLBACK_SECRET" \
  -d '{
    "status": "completed",
    "summary": "OCR + on-the-fly PDF ragging выполнены, задача решена, скрин результата приложен.",
    "branch": "work",
    "taskPath": "/",
    "prUrl": "https://github.com/<owner>/carTest/pull/<id>",
    "telegramChatId": "12345678",
    "telegramUserId": "12345678",
    "slackChannelId": "C12345678",
    "slackThreadTs": "1730000000.000100"
  }'
```

Preview example for current domain:
`https://v0-car-test-git-work-salavey13s-projects.vercel.app/`

### 5.3 Callback example (needs clarification)

```bash
curl -X POST "https://v0-car-test.vercel.app/api/codex-bridge/callback" \
  -H "Content-Type: application/json" \
  -H "x-codex-bridge-secret: $CODEX_BRIDGE_CALLBACK_SECRET" \
  -d '{
    "status": "in_progress",
    "summary": "Нужен более чёткий снимок: OCR нечитабелен в строке с условием.",
    "branch": "work",
    "taskPath": "/",
    "telegramChatId": "12345678",
    "telegramUserId": "12345678",
    "slackThreadTs": "1730000000.000100"
  }'
```

---

## 6) Prompting rules (concise, age-appropriate, 7th grade RU-first)

1. Всегда начинай по-русски.
2. Объяснение короткое: 3–6 шагов.
3. Один шаг = одна мысль.
4. Термины объясняй простыми словами.
5. Не перегружай теорией, только нужное для решения.
6. Обязательно блок «Ответ: ...».
7. Если не хватает данных — сначала уточнение.
8. Тон дружелюбный и уважительный, без сюсюканья.

Шаблон:
- «Что дано»
- «Решение по шагам»
- «Ответ»
- «Проверка (коротко)»

---

## 7) Safety boundaries

1. Не выдумывать ссылки на учебник/параграф, если их не видно в реально найденном PDF-фрагменте.
2. Не придумывать числа/факты, которых нет в фото или условии.
3. Если OCR сомнительный — явно написать, что нужна более чёткая фотография.
4. Не выдавать уверенный «точный» ответ при низкой уверенности.
5. При неоднозначности указывать варианты и просить уточнение.

---

## 8) Core file cross-links

Текущие связанные файлы в репозитории:
- Telegram webhook route: `app/api/telegramWebhook/route.ts`
- `/codex` command handler: `app/webhook-handlers/commands/codex.ts`
- Codex callback route: `app/api/codex-bridge/callback/route.ts`
- notify script: `scripts/codex-notify.mjs`

Homework API routes (целевая зона):
- `app/api/homework/intake/route.ts`
- `app/api/homework/parse/route.ts`
- `app/api/homework/solve/route.ts`

---

## 9) Execution Changelog

| Date       | Branch | Implemented capability | Known gaps |
|------------|--------|------------------------|------------|
| 2026-02-14 | `work` | Flow скорректирован под `/codex + photo`: Slack-triggered Codex, OCR + on-the-fly PDF ragging в runtime, решение и screenshot skill возврат. | Нужна фактическая реализация `app/api/homework/*`; нужен production-ready screenshot delivery contract в bridge. |

---

## 10) New local skills for execution (created)

Чтобы пункты **OCR intake** и **PDF parsing/ragging** реально повторялись во время задач, добавлены локальные skill-инструкции:

- `skills/homework-ocr-intake/SKILL.md`
  - нормализует вход `/codex + photo`;
  - фиксирует JSON-контракт для OCR-результата;
  - задаёт строгий режим `needsClarification`, если фото сомнительное.

- `skills/homework-pdf-rag-runtime/SKILL.md`
  - задаёт on-the-fly поиск по `books/alg.pdf` и `books/geom.pdf` без offline индексов;
  - фиксирует source-aware output контракт (`sourceHints`);
  - добавляет guardrails против «уверенной галлюцинации».

Обе skill-инструкции заточены под execution в Codex runtime, чтобы задачи решались одинаково предсказуемо.

---

## 11) Broader-picture task map (next implementation wave)

Ниже не «узкие тикеты», а задачи с продуктовым смыслом — зачем они важны для Homework Maker как системы.

### Task A — Intake reliability layer

**Что делаем:**
- добавляем `app/api/homework/intake/route.ts`;
- связываем вход Telegram-фото с метаданными origin (`telegramChatId`, `telegramUserId`, messageId);
- сохраняем link/id входного фото для повторного прогона.

**Broader picture:**
- это фундамент доверия: если intake теряет контекст, downstream-решение становится случайным;
- надёжный intake = меньше ручной поддержки оператором.

### Task B — Parse reliability + ambiguity protocol

**Что делаем:**
- добавляем `app/api/homework/parse/route.ts`;
- парсим OCR в структурные assignment items;
- вводим явный `needs_clarification` ответ для нечитаемых строк.

**Broader picture:**
- снижает риск ложных «уверенных» решений;
- формирует человеческий UX: бот честно просит уточнение, а не фантазирует.

### Task C — Runtime textbook grounding

**Что делаем:**
- добавляем `app/api/homework/solve/route.ts`;
- используем on-the-fly PDF ragging по `alg.pdf`/`geom.pdf`;
- возвращаем `sourceHints` в результат.

**Broader picture:**
- превращает бота из «просто LLM» в проверяемого ассистента с привязкой к учебнику;
- важный шаг к качеству «домашка как сервис», где ответ можно объяснить и защитить.

### Task D — Screenshot-ready student output

**Что делаем:**
- используем `app/homework/solution/[jobId]/page.tsx` как каноничный render-слой;
- гарантируем блоки «Что дано / Решение / Ответ / Короткая проверка»;
- поддерживаем аккуратный screenshot output для Telegram callback.

**Broader picture:**
- визуальный артефакт = мгновенная полезность для ученика (можно переписать в тетрадь);
- уменьшает фрикцию и повышает retention сценария `/codex`.

### Task E — Delivery trust loop

**Что делаем:**
- расширяем callback payload в bridge для image/screenshot статуса;
- логируем статус доставки в changelog/job history.

**Broader picture:**
- закрывает цикл «получили задачу -> решили -> действительно доставили ответ»;
- даёт оператору наблюдаемость и дебаг без ручного копания.

| Date       | Branch | Implemented capability | Known gaps |
|------------|--------|------------------------|------------|
| 2026-02-14 | `work` | Созданы execution skills: `homework-ocr-intake` и `homework-pdf-rag-runtime`; добавлена broader-picture roadmap по задачам A–E. | Ещё не реализованы production route handlers `app/api/homework/*` и расширение callback для image payload. |
