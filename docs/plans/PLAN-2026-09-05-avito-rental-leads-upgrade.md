# PLAN — Avito leads → rental CRM: скорость, надёжность, sales-методология
> Дата: 2026-09-05 · Источник: аудит `avito_monitor.py` + webhook-контракта `rental.vip-bike.ru` + транскрипт «Ultimate Sales Blueprint» (Hormozi)
> Статус: утверждён владельцем к системной проработке. Порядок: P0 → P1 → P2.

## Прогресс (обновлено 2026-09-05, 18:05 МСК)
- ✅ **A1** — готово и верифицировано на бою. Диагноз: 1 мёртвый адресат (`chat not found`, нужен `/start`) × 158 вечных ретраев + 1 флапающий транспорт + мёртвый IPv6. `target_health`-карантин (фатал → сразу, транспорт → 8 подряд, самовосстановление по getChat-пробе), IPv4-force, backlog-алерт (1/час, только здоровым), гашение протухших >24ч. Backlog 158→0, алерт 5/5.
- ✅ **A2** — `webhook_outbox` в мониторе (идемпотентность по source_key, backoff 15мин×n, потолок 6ч, dead после 36). Приёмник carTest: ветка `leads-p0-hardening` → **merge в main `32a6fbe`, запушено**; monitor-события получают 503 при сбое записи (официальный Avito — всегда 200). Деплой main → rental.vip-bike.ru — гейт.
- ✅ **A3** — 402-деградация: лид не теряется, работает по последнему сообщению, GLM с `history_complete=false`, плашка «история недоступна», CRM-форвард. Анти-бёрст: кап 10 уведомлений/профиль/прогон. Живой кейс придёт с новым клиентом аренды. Гейт подписки Avito остаётся открытым.
- ✅ **A4** — секреты из `config.json` → `secrets.env` (маппинг профилей сверен: `AVITO_CLIENT_ID`=rental, `AVITO_SALE_*`=sale, `TELEGRAM_BOT_TOKEN` добавлен), config 640 без секретов.
- ✅ **C6/F (частично)** — на живых данных найдены потерянные чаты по собственным моделям: Y-VOLT Surge V, FSMOTO Sequence Zero добавлены в `RELEVANT_KEYWORDS`; 5 реальных лидов аренды возвращены в БД (leads 204→209).
- ✅ **B1** — детекция ≤2 мин в рабочие часы (10:00–20:00 МСК), ≤5 мин ночью. Cron `*/2` + внутренний gate скана; очереди (Telegram-outbox, webhook-outbox, напоминания) обрабатываются на каждом тике. Экономия токенов: кэш Avito-токена 23ч (2 запроса/день вместо ~1440), GLM — ровно 1 вызов на новое входящее сообщение + `analyzed_message_at`-гард (0 повторных анализов; тики без скана = 0 GLM-вызовов). ⚠ Мониторить рост cron.log при частоте */2 — ротацию отдать cd-tech.
- ⏳Дальше: B2 (speed-to-lead метрики), B3 (BANT-скоринг + эскалация), B4 (протокол «двух слотов»), C-блок (nurture, show-up), деплой carTest.

## Контекст (что есть сейчас)

**Пайплайн** `/opt/vip-bike-avito/scripts/avito_monitor.py` (cron 10 мин, flock):
токен client_credentials → chats v2 (все limit 100 + unread-срез, `chat_types=u2i`) → фильтр по title (regex) → фильтр paywall/system-заглушек → SQLite upsert (`leads/messages/reminders/deliveries/delivery_outbox`) → уведомление только `direction=in` + новее нотифицированного + (unread|changed) → история messages v3 limit 10 (**402 → чат пропущен целиком, до fallback/анализа/webhook**) → GLM-5.2 `{category, reply, reason}` (fail-closed «ручной ответ») → `forward_lead_to_webhook()` → `https://rental.vip-bike.ru/...` (`franchize_intents`, id `monitor:{profile}:{chat_id}:{ts}`, дедуп CRM по chat_id) → Telegram outbox (retry 15 мин). Напоминания: response +15 мин / follow-up +24 ч / stale +72 ч; вне 10:00–20:00 → перенос на 10:00.

**Контракт CRM корректен** (v3.0.0, дедуп по реальному chat_id готов к будущему официальному вебхуку Avito). Пробелы — в покрытии и надёжности, не в схеме.

## Диагностированные разрывы

| # | Проблема | Серьёзность |
|---|---|---|
| A | **Аренда не попадает в CRM.** Профиль «Аренда/Прокат»: messages API = HTTP 402 → `continue` до fallback/анализа/webhook. Реальные сообщения клиентов аренды теряются молча. 60/100 чатов — paywall-заглушки. Все 8 пересылок в CRM за историю — профиль «Продажа» | 🔴 |
| B | **Webhook fire-and-forget.** Нет очереди повторов: недоступность rental.vip-bike.ru в момент лида = потерянный навсегда (только warning в лог) | 🔴 |
| C | **Живой инцидент 05.09.2026:** Telegram `ReadTimeout/ConnectionError`, `успешно=0, ошибок=63–84` за прогон, `pending_outbox=158` растёт. Нет backoff/лимита и нет алерта о backlog | 🔴 |
| D | **Задержка обнаружения до 10+ мин** (polling); напоминания вне 10:00–20:00 спят до утра | 🟠 |
| E | В CRM уходит только последнее входящее; история диалога, исходящие менеджера, стадия follow-up в CRM не синхронизируются | 🟠 |
| F | `RELEVANT_KEYWORDS` без «квадроцикл/трицикл/гидроцикл…» — чаты по ним отбрасываются до БД | 🟡 |
| G | `config.json` (0644) содержит bot token и client secrets (остальное в `secrets.env` 0600) | 🟡 |

## A. P0 — остановить потери (инфраструктура)

### A1. Outbox backoff + dead-man-алерт (закрывает C)
- `lead_store.py`: в `pending_outbox()` — экспоненциальный backoff по `attempts` (15 мин → 1 ч → 6 ч), потолок попыток 12 → `status='dead'`, `last_error` сохраняется.
- `avito_monitor.py`: после `process_outbox` — если `pending_outbox > 50` или `sent=0 and failed>20`, отдельный alert в Telegram (без цикла: флаг в state, не чаще 1 раза/час).
- Verify: `--self-test` PASS; симуляция ошибки → backoff растёт, alert 1 раз; после восстановления — рассасывание backlog.
- **Отдельно диагностировать сеть хост → api.telegram.org** (инцидент 05.09: curl/tcping с хоста, IPv6/DNS/MTU).

### A2. Webhook-outbox для CRM (закрывает B)
- Новая таблица `webhook_outbox(id, lead_id, payload_json, attempts, status, last_error, created_at, updated_at)` — зеркало Telegram-паттерна.
- `forward_lead_to_webhook()` → только enqueue; отдельный `process_webhook_outbox()`: retry 15 мин, потолок 24, успех = HTTP 200.
- Метрика доставки в `stats()`. Verify: остановить endpoint → лид в очереди; поднять → доставлен, дубликата в CRM нет (дедуп по chat_id).

### A3. Деградация 402-пути для аренды (закрывает A, минимум)
- В `process_profile`: при `history_status == 402` не `continue`, а диалог из `fallback_messages(chat)` (последнее сообщение уже в chats-ответе), GLM-вызов с `history_complete=false` (промпт уже умеет), уведомление с плашкой «история недоступна», forward в CRM.
- Paywall-заглушки продолжают фильтроваться как сейчас.
- Verify: synthetic-чат с 402 → уведомление + CRM-строка появляются, «ложный рекомендуемый ответ» не создаётся.
- **Параллельно (гейт владельца): решение по подписке Avito Messenger API** — снимает 402 целиком и открывает официальный вебхук.

### A4. Секреты из config.json → secrets.env (закрывает G)
- `AVITO_PROFILE_*_CLIENT_ID/SECRET`, `TELEGRAM_BOT_TOKEN` → `secrets.env` (0600); `config.json` оставляет user_id/name/chat_ids, chmod 640. Обновить `load_config()`.
- Verify: `--self-test`, один боевой прогон, diff логов идентичен.

## B. P1 — скорость ответа и приоритизация (методология: <60 сек; feed the killers)

### B1. Интервал опроса по времени суток (D)
- cron: каждые 2 мин в 10:00–20:00, каждые 5 мин в остальное (или одиночный cron каждые 2 мин + внутри скрипта расчёт depth-окна). flock уже защищает от наложения.
- ⚠ Лимиты Avito API: проверить квоты chats/messages при учащении; messages по-прежнему только для changed/unread.

### B2. Speed-to-lead метрики («game tape»)
- `leads`: `detected_at`, `first_suggestion_at`; представление `lead_sla`: медиана/90-перцентиль created→detected по дням.
- Еженедельный отчёт в Telegram: распределение по дням недели/часам, % лидов, «первые касания» ≤5 мин. База для решения о 24/7-покрытии.

### B3. BANT-скоринг от GLM + маршрутизация
- JSON агента расширить: `"score":"green|yellow|red"`, `"signals":{"budget":…,"authority":…,"need":…,"timing":…}` (строки-признаки из диалога, без выдумок).
- Колонки в `leads` + проброс `score` в CRM-webhook (`client.category` → отдельное поле, если приёмник поддержит; проверить mapping на стороне rental-репо).
- Зелёные: пуш сразу + reminder-тип `sla_breach` (через 15 мин без исходящего ответа менеджера → эскалационное сообщение в чат директора). Жёлтые: сразу; красные: дайджест 1×/день.

### B4. Слоты и next step в ответах (same-day show-up; BAMFAM)
- System-prompt GLM: (1) всегда предлагать 2 конкретных слота тест-райда сегодня/завтра из шаблона слотов (файл `avito_knowledge.json → general.slots`, редактируемый); (2) каждая рекомендация заканчивается следующим шагом (бронь слота); (3) детальный вопрос → встречный вопрос («на какой диапазон смотрите?»), никогда не предлагать скидку (уже есть — усилить).
- Verify: `--agent-health` + ручная выборка 10 рекомендаций.

## C. P2 — покрытие и nurture (методология: 7 дней/нед; no ≠ no forever; show-up)

### C1. Внеочередные/ночные лиды (7 дней в неделю)
- Решение владельца: (а) мгновенный Telegram-пуш 24/7 (сейчас только обнаружение быстрее, напоминания спят) или (б) авто-ответ клиенту в нерабочее время: «Менеджер ответит в 10:00; можете выбрать удобное время». Стиль авто-ответа — по `brand/voice-style.md`, гейт на ручную проверку первых 20 штук.

### C2. Show-up последовательность для броней (24 ч → утро → за 1 ч)
- Новые reminder-типы `booking_24h / booking_am / booking_1h`; источник брони — отметка в CRM (этап) или ручная команда менеджера в чате; текст с персонализацией («байк подготовлен, какой размер шлема?»).

### C3. Долгий nurture (+7 / +30 дней)
- Reminder-типы `nurture_7d`, `nurture_30d` для незакрытых лидов; поводы из `avito_knowledge.json` (возврат модели, новые слоты). Дедуп по статусу из CRM (если лид закрыт — не напоминать).

### C4. Social proof в базе знаний
- `avito_knowledge.json → general`: рейтинг 4.8, с 2019 года, формулировка «без категории А». GLM может вплетать в ответы.

### C5. Полнота синхронизации с CRM (E)
- Forward полного компакта диалога (до 10 сообщений) в `metadata.messages` при первом пересыле; при follow-up — отдельное событие `type:"follow_up"` (после расширения приёмника в rental-репо — согласовать контракт v3.1). Обратная связь CRM → монитор (закрыт/проигран) — гасить nurture-напоминания.

### C6. Мелочи
- `RELEVANT_KEYWORDS` + квадроцикл/трицикл/гидроцикл/эндуро/кросс (F).
- Deep-link на диалог в уведомлении (сейчас только объявление).
- `state.notified_chats` — чистка записей старше 30 дней.

## Гейты / решения владельца
1. A3: подтвердить деградацию 402 (уведомление по последнему сообщению) ИЛИ оплату подписки Messenger API (предпочтительно — снимает A целиком).
2. C1: мгновенный пуш 24/7 vs авто-ответ в нерабочее время (и текст авто-ответа).
3. B3: чат эскалации для sla_breach.
4. C5: расширение контракта webhook до v3.1 (metadata.messages, follow_up-события) — согласовать с rental-репо.
5. Проверить квоты Avito API перед B1 (интервал 2 мин).

## Effort
- A1 backoff+alert — **medium**; A2 webhook-outbox — **medium**; A3 402-деградация — **low** (код уже частично есть, fallback написан); A4 секреты — **low**.
- B1 интервал — **low**; B2 метрики — **medium**; B3 скоринг — **medium** (промпт + схема + эскалация); B4 промпт-протокол — **low**.
- C1 — **low/гейт**; C2 — **medium**; C3 — **medium**; C4 — **low**; C5 — **medium** (двусторонне, второй репо); C6 — **low**.

## Порядок работ
1. A1 + диагностика сети Telegram (инцидент) → 2. A2 → 3. A3 (+гейт подписки) → 4. A4 → 5. B1 → 6. B4 → 7. B2 → 8. B3 → 9. C-блок по одному.

## Ключевые файлы/пути
- Монитор: `/opt/vip-bike-avito/scripts/avito_monitor.py` (+ `avito_monitor.py.backup-20260901`), стор: `lead_store.py`, конфиг: `config.json`, секреты: `/opt/vip-bike-avito/secrets.env` (0600)
- БД: `/opt/vip-bike-avito/data/avito_leads.db` (SQLite WAL, 0600); логи: `scripts/monitor.log`, `scripts/cron.log`; state: `scripts/state.json`
- База фактов для GLM: `scripts/avito_knowledge.json` (локальная копия: `integrations/avito-agent/runtime/avito_knowledge.json`)
- Cron: root, каждые 10 мин (после B1 — пересобрать расписание)
- Приёмник CRM: `https://rental.vip-bike.ru/...` (секрет в `AVITO_LEADS_WEBHOOK_URL/SECRET`), таблица `franchize_intents`; локальный код CRM: `app-prototype/app/franchize/server-actions/intents.ts`
- Артефакт аудита: `logs/agents/2026-07-28/p2p/avito.md`, `analytics/bot/avito-delivery-audit-2026-07-28.md`
- Правила применения правок: бэкап файла → точечный дифф → `--self-test` → один боевой прогон → сверка логов → owner-подтверждение для write-вызовов
