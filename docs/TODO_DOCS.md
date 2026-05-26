# Rental Deal Template — BOSS план внедрения

## Контекст
Источник: `docs/TODO_DOCS.md` + `BOSS_QUEST.HTML`.
Цель: закрыть все пункты из TODO по договору аренды в скоупе **franchize rent** и добавить рабочий поток для суперскила **«сделай документ по фото»**.

---

## BOSS QUEST decomposition (как делать «по-боссовски»)

### Door R1 — Contract variables + data contract (блокер)
**Выход:** пайплайн умеет стабильно подставлять новые поля в шаблон договора.

1. Обновить тип payload в `app/franchize/[slug]/.../actions-runtime.ts` (или соседний типовой модуль):
   - добавить `renterBirthDate`, `renterPhone`, `renterEmail` (nullable/optional по факту источника).
2. В `buildFranchizeOrderDocAndNotify()` расширить `variables`:
   - `renter_birth_date`
   - `renter_phone`
   - `renter_email`
3. Источники данных и приоритет:
   - `payload` (если пришло явно),
   - `userSensitive` из `getUserSensitiveDataOrDefault`,
   - fallback: пустая строка для email и controlled-error для обязательных полей.
4. Нормализация:
   - birth date -> `DD.MM.YYYY`,
   - phone -> `+7XXXXXXXXXX`.
5. Валидация:
   - если нет birthDate/phone — не генерировать битый договор, а вернуть понятную ошибку для оператора.

### Door R2 — Template rendering strategy (MD + HTML dual mode)
**Выход:** можно генерить docx из MD (текущий путь) и иметь фичефлаг на HTML.

1. Оставить `docs/RENTAL_DEAL_TEMPLATE.md` как стабильный fallback.
2. Добавить переключатель рендера:
   - `RENTAL_DOC_TEMPLATE_MODE=md|html` (по умолчанию `md`).
3. Подготовить `RENTAL_DEAL_TEMPLATE.html` как primary-candidate:
   - одинаковые `{{variable}}` плейсхолдеры,
   - сохранение структуры приложений №1..№4.
4. В генераторе сделать адаптер:
   - md-path: текущий pipeline,
   - html-path: отдельный конвертер (если ещё не готов — graceful fallback на md с предупреждением в лог).

### Door R3 — Legal completeness smoke
**Выход:** юридические блоки из TODO контролируются чек-листом до отправки.

1. Добавить статический чек-лист секций в codebase (например `legalChecklist.ts`) c пунктами §3.3, §4.3..§12.1 + приложения.
2. Перед отправкой документа выполнить lightweight-проверку, что шаблон содержит ключевые маркеры.
3. При отсутствии критичного блока — ошибка `template_integrity_failed` с диагностикой (какой пункт отсутствует).

### Door R4 — Super-skill «сделай документ по фото»
**Выход:** триггер «сделай документ / создай документ» запускает end-to-end сбор договора из фото.

1. В `AGENTS.md` закрепить общий триггерный протокол для фраз:
   - `создай документ`, `сделай договор`, `сделай документ по фото`, `ты босс` (в boss-mode).
2. Поток навыка:
   - OCR паспорт + ВУ,
   - извлечение renter полей (ФИО, ДР, телефон при наличии, e-mail при наличии),
   - резолв байка из Supabase `cars`,
   - генерация DOCX из rental template,
   - доставка в Telegram,
   - callback/notification через `scripts/codex-notify.mjs`.
3. Контракт ошибок:
   - не выдумывать значения,
   - при отсутствии критичных полей запрашивать уточнение.
4. Read-after-write verification:
   - если документ/метаданные сохраняются, подтверждать фактическим read-check перед статусом `completed`.

### Door R5 — Bridge callback consistency
**Выход:** любой bridge-triggered документный сценарий заканчивается корректным callback.

1. В callback всегда передавать:
   - `status`, `summary`, `branch`, `taskPath`, `prUrl` (если есть),
   - reply targets: `telegramChatId`, `slackChannelId`, `slackThreadTs` (если есть).
2. Превью-ссылка строится из реального branch (`/` -> `-`).
3. Если callback не отправлен автоматически — вернуть fallback curl-блок и причину.

---

## Параллелизация (из BOSS_QUEST)

- **Блокер:** R1.
- После R1 параллелятся:
  - R2 (шаблонный движок),
  - R3 (чек-лист юридики),
  - R5 (bridge callback унификация).
- **Финальный интеграционный шаг:** R4 (super-skill), потому что он зависит от готовых данных, шаблона и callback-контракта.

---

## Acceptance Criteria (Definition of Done)

1. Новые переменные (`renter_birth_date`, `renter_phone`, `renter_email`) реально подставляются в итоговый договор.
2. При отсутствии обязательных полей оператор получает контролируемую ошибку, а не битый документ.
3. Юридические секции из TODO проходят integrity-check.
4. Триггер «сделай документ по фото» отрабатывает end-to-end по AGENTS-протоколу.
5. Bridge callback уходит автоматически (или есть корректный fallback cURL).
6. Ветка/PR содержит короткий summary по каждому Door (R1..R5).
