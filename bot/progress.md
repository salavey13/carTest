# Progress Log — vip-bot

## [2026-06-09] — Сессия: повторные клиенты + Groq как единый провайдер (OCR+STT)

### Повторные (постоянные) клиенты — переиспользование
- cli `find-client --query "<ФИО/телефон>"` → список сохранённых клиентов (id+ключевые поля).
- cli `gen-contract --client-id <id>` — оформление БЕЗ фото/OCR (данные клиента берутся из БД); меняются только байк+даты(+депозит). Альтернатива `--client <json>` для новых.
- cli `contracts [--limit N]` — история договоров.
- Тест: новый клиент→VB-001, find-client нашёл, --client-id→VB-002 (другой байк+даты, без фото) ✅. typecheck/build 0.
- SKILL.md: добавлен шаг 0 «повторный клиент?» (find-client→подтвердить→--client-id).

### Groq — один ключ на OCR + транскрибацию (замена Deepgram)
- `src/voice.ts`: добавлен `transcribeWithGroq` (whisper-large-v3-turbo, OpenAI-совместимый аудио-эндпоинт), приоритет Groq→Deepgram→OpenAI. Telegram .oga→.ogg для распознавания формата, чистка аудио после. build green.
- `.env.example`: GROQ_API_KEY теперь и STT (GROQ_STT_MODEL). Deepgram не нужен.

### Шаблоны: переименованы под слаги (повтор)
- contract-analyst пересоздал 5 шаблонов с +{deposit}+{client.phone} (12 плейсхолдеров; Horwin 11) и удалил мои переименованные дубли → lead снова переименовал motoland-breakout.docx / nibbler-regumoto-4v.docx под слаги bike_units. Рендер Motoland+deposit+phone ✅.

---

## [2026-06-09] — Сессия: миграция Supabase + per-model шаблоны + рендер E2E (команда vipbot-data-migration)

### Миграция (migrator, sonnet)
- Supabase `cars` (type=bike, не тест) → **26 байков в bike_units** (seed: `modules/contract/scripts/seed-from-supabase.ts`, креды через env, не хардкод, DELETE+INSERT идемпотентно).
- Маппинг: cars.id→model_slug, make+model→make_model, specs.{year,color,motor_peak_kw||power_kw,top_speed_kmh,battery}, availability_rules.manual_status→status. VIN=null (в Supabase нет; **у электро VIN отсутствует в принципе** — норма; актуален для ДВС).
- **lessor** создан: ИП Воробьев Роман Владимирович, ОГРНИП 326527500025145 (ИНН 525813643035 + банк — есть в эталонах/contract-data-form.md, можно дописать UPDATE; для per-model шаблонов не критично — там реквизиты литералом).
- ⚠️ Supabase шаред (байки разных owner_id) — взяты все type=bike; **фильтр owner_id VIP BIKE (356282674) — на подтверждение клиента** (могли попасть чужие).

### Кросс-сверка моделей (сайт ↔ Supabase ↔ договоры)
- **Все 5 моделей договоров ∈ Supabase 26** ✅.
- **8 премиум-байков сайта** (data/rental.ts: BMW/MV Agusta/Honda/Harley/VOGE/Ducati X-Diavel) **∉ Supabase/договоров** → отдельный премиум-парк VipBike Rental, не операционный парк бота.
- Покрытие шаблонами: **5 из 26** (21 байк, в осн. VipBike-электро, без шаблона).

### Per-model шаблоны (contract-analyst, opus)
- 5 шаблонов `modules/contract/templates/by-model/<slug>.docx`: ducati-panigale-s-electro, horwin-ek1, motoland-breakout, nibbler-regumoto-4v, suzuki-gsx-s1000f (2 переименованы lead'ом под слаги bike_units).
- Плейсхолдеры ТОЛЬКО клиент+сделка: {contractNumber} {contractDate} {rentStart} {rentEnd} {client.fullName} {client.birthDate} {client.passportSeries} {client.passportNumber} {client.passportIssuedDate} {client.registrationAddress}. Байк/реквизиты ИП/тарифы/штрафы/депозит — ЛИТЕРАЛ из эталона. Имена плейсхолдеров = data-объект contractDoc.ts (новые поля в код не нужны).
- ⚠️ В эталонах ПУСТЫ (не плейсхолдеры): passportIssuedBy, passportDeptCode, licenseNumber, licenseCategories, phone. Наш Groq-OCR их извлекает, но в шаблоне слотов нет → решить, добавлять ли в шаблоны (для ВУ юр-значимо).
- Анализ: `_tmp/reference-contracts/ANALYSIS.md`; форма реквизитов: `tenants/vip-bike/contract-data-form.md` (gitignored).

### Подключение per-model в генератор (lead)
- `contractDoc.ts`: `resolveTemplatePath(modelSlug)` — by-model/<slug>.docx если есть, иначе contract-rental.docx. Выбор по `bike.modelSlug`.
- **Рендер-тест E2E (Ducati, реальный байк + lessor + мок-клиент):** 0 сырых тегов, ФИО/№/даты подставлены, литерал Ducati+ИП Воробьев+ОГРНИП на месте, sha256 стабилен. ✅ Генерация договора из реальных данных работает.
- typecheck 0.

### Открытые решения клиента
1. Шаблоны на остальные 21 байк (или только эти 5 пока)?
2. owner_id-фильтр Supabase (все 26 точно VIP BIKE?).
3. Добавлять ли в шаблоны слоты для № ВУ/категорий/кем выдан (Groq их читает, в эталонах пусто).
4. VIN для ДВС-байков (электро — не нужен).

### Финал по шаблонам/рендеру (lead)
- Шаблоны обновлены аналитиком: + {deposit} + {client.phone} плейсхолдеры (итого 12; Horwin 11 — нет passportIssuedDate в эталоне). Дубли коротких слагов удалены аналитиком → lead ПЕРЕИМЕНОВАЛ канонические обратно под слаги bike_units (motoland-breakout.docx, nibbler-regumoto-4v.docx).
- Рендер Motoland (переименованный слаг) + deposit 15000 + phone: 0 тегов, всё подставлено ✅. Ducati ранее тоже ✅.
- Тестовые записи (2 договора+2 клиента) вычищены из БД → боевые с VB-2026-001. В store только зашифрованный contracts.db.
- ⚠️ В шаблонах НЕТ слотов: passportIssuedBy, passportDeptCode, licenseNumber, licenseCategories (в эталонах отсутствуют как строки). Groq их читает — но добавление = структурная правка тела договора (решение клиента).

### Кросс-сверка — ИТОГ (migrator)
- **Два бизнеса:** rental.ts = VipBike Rental NN (бензин-премиум, НЕ парк бота); Supabase = VIP BIKE ELECTRO (парк бота, 26). Пересечений 0.
- **🔥 Реальные сделки БЕЗ шаблона:** KAWASAKI EX650K (2 сделки!), Sequence Zero (1). kawasaki-ninja-400 — сделка есть, в bike_units нет (был is_test_result, отфильтрован).
- Сделки по моделям: Ducati 1, Nibbler 1, Kawasaki EX650K 2, Sequence Zero 1, kawasaki-ninja-400 1.
- 15 VipBike-электро (A4…Z1000) — без шаблонов (вероятно основной объём). Рекомендация migrator: унифицированный шаблон «электро VipBike» параметризованный.

### Следующий шаг
- E2E через бота: `.env` (GROQ_API_KEY+OCR_MODE=groq+CONTRACTS_DB_KEY+TELEGRAM_BOT_TOKEN+ANTHROPIC_AUTH_TOKEN=z.ai+ANTHROPIC_BASE_URL) → `npm run dev` → фото в @vipBikeAssistantBot → подтверждение → .docx в чат.

---

## [2026-06-09] — Сессия: OCR — выбран Groq vision (протестирован на реальном паспорте)

### Контекст
z.ai coding-plan: движок (Anthropic-эндпоинт) ✅ работает (glm-4.6), но vision сломан — paas/v4 без баланса (429/1113), coding-эндпоинт галлюцинирует на картинках. → нужен отдельный OCR.

### Что сделано — мульти-режимный OCR в recognize.ts
- `OCR_MODE`: `groq | local | paas | mock`, авто-выбор по наличию ключей. `callOpenAIVision()` — общий OpenAI-совместимый vision-вызов (Z.AI и Groq).
- **local-гибрид** (tesseract.js + sharp препроцесс/поворот + glm-4.6 текст→поля): доделан по запросу, но на реальном паспорте **серию/номер/категории/адрес читает неверно/нестабильно** (вертикальный красный микротекст; дом дома 30→16 между прогонами). Убрана MRZ-догадка (давала уверенно неверный номер). Вывод: free-tesseract недостаточен для юр-полей. Оставлен как офлайн-fallback.
- **Groq vision** (`meta-llama/llama-4-scout-17b-16e-instruct`, free tier) — **ВЫБРАН**.
- Поддержка 3-го фото (страница прописки) — `--registration`, отдельный FIELD_SPEC, merge в recognizeClient (адрес со страницы прописки приоритетнее главного разворота).
- Зависимости: + tesseract.js, sharp (для local-fallback).

### Тест на реальном паспорте (Новоселов Г.И., 3 фото)
- **Groq: 10/11 полей верно** — серия 2214 ✅, номер 288494 ✅, категории A,A1,B,B1,M ✅, прописка «Героя Васильева 17А кв.18» ✅, ФИО/даты/кем выдан/код ✅. Единственная ошибка — 1 цифра в № ВУ (9949398184 vs 389184) → оператор правит на шаге подтверждения. Уровень Claude, бесплатно.
- tesseract на тех же фото: серию/номер не взял, категории «B», дом прописки неверный.

### Решение
- **OCR = Groq vision** (`OCR_MODE=groq`, free). Ключ `gsk_...` сохранён в vps-access.md + .env.example. Лимит 1000/день — для проката достаточно.
- ПДн-гигиена: тестовые фото паспорта из /tmp удалены после теста.

### Ключи (статус)
- z.ai coding ✅ (движок), Groq ✅ (OCR), CONTRACTS_DB_KEY ✅ (сгенерирован). Telegram-токен ✅. Остаётся: telegram_id операторов (ALLOWED_CHAT_ID), реквизиты lessor + bike_units (миграция из Supabase).

### Следующий шаг
- ШАГ 5 E2E локально: `.env` (GROQ_API_KEY+OCR_MODE=groq+CONTRACTS_DB_KEY+TELEGRAM_BOT_TOKEN+ANTHROPIC_AUTH_TOKEN+ANTHROPIC_BASE_URL) → `npm run dev` → фото в бота → подтверждение → .docx.
- Миграция Supabase (cars→bike_units, реквизиты lessor) — данные есть в облаке клиента.

---

## [2026-06-09] — Сессия: ШАГ 3 (личность+роутинг) + ШАГ 4 (tenant.yaml)

### Что сделано
- **`workspace/CLAUDE.template.md`** переписан под VIP BIKE: ассистент оператора проката, `contract-agent` — главный навык в роутинге и жёстких правилах; убраны media-gen/composio/маркетинг; добавлены ПДн-правила (фото только в uploads, модуль сам чистит). Оставлены плейсхолдеры `{{PROJECT_PATH}}` (рендерит bootstrap).
- **Обрезка под VIP:**
  - skills/: оставил contract-agent, transcribe-file, schedule-task, task-recall, voice-reply. Убрал daily-brief, publish-to-cloud, web-research.
  - reference/: оставил calendar-dates, telegram-output, tools-web, ops. Убрал composio.md, media-gen.md, skills-and-agents.md.
  - `.claude/settings.template.json`: оставил только `zai-vision` MCP (фолбэк-анализ фото; основной OCR — recognize.ts напрямую). Убрал kie-ai/zai-search/playwright — экономия стартового контекста 200k.
  - `welcome.md` переписан под операторов VIP (договоры в центре, без Notion/vault/маркетинга).
- **`tenants/vip-bike/tenant.yaml`** создан (схема KLOD-BOX): slug vip-bike, VPS 212.67.11.25, service claudeclaw-vip-bike, install_path /opt/claudeclaw/vip-bike, MCP zai-vision, секция contracts (encrypted SQLite), needed_from_client (ключи/реквизиты/{{уточнить}}). Секреты НЕ в yaml — в .env/vps-access.md. Operators/owner_id = {{уточнить}}.

### Открытые вопросы / следующий шаг (ШАГ 5 E2E — ЗАБЛОКИРОВАН ключами)
- E2E локально требует `.env` с **ANTHROPIC_AUTH_TOKEN** (z.ai-ключ для Claude Code CLI движка) — его НЕТ ({{уточнить}}). Без него бот стартует, но «мозг» (Agent SDK) не работает → оформление не пройдёт.
- Также для боевого: Z_AI_API_KEY (или RECOGNIZE_MOCK=1 для теста), CONTRACTS_DB_KEY, telegram_id операторов (ALLOWED_CHAT_ID), реквизиты lessor + bike_units (или миграция из Supabase).
- TELEGRAM_BOT_TOKEN есть (`@vipBikeAssistantBot`, в vps-access.md).
- Что проверяемо без ANTHROPIC_AUTH_TOKEN — уже зелёное: модуль договоров (recognize+gen-contract+SQLite шифрование, verifier PASS), build бота green.

---

## [2026-06-09] — Сессия: ШАГ 2 — копия рантайма KLOD-BOX

### Что сделано
- Сверка deps: KLOD-BOX v0.9.5 deps (grammy, @grammyjs/runner, claude-agent-sdk, cron-parser, pino, pino-pretty, better-sqlite3) — **подмножество** нашего package.json. tsconfig идентичен. Build не упал на отсутствующих зависимостях.
- `rsync -a $UP/src/ src/` — 22 модуля движка (agent, bot, db, memory, media, voice, scheduler, composio, onboarding, ops-bot, relay, …).
- `rsync -a --exclude=.DS_Store $UP/workspace/ workspace/` — **БЕЗ --delete** → наш `skills/contract-agent` и `store/` сохранены; добавлены CLAUDE.template.md, welcome.md, active-context.md, reference/ (7), штатные skills (7), .claude/settings.template.json.
- `bundled-skills/` — lean ×5 (docx, officecli, pdf, task-planner, todo).
- `scripts/` — bootstrap-vps.sh, seed-mcp-settings.sh, install-default-skills.sh.
- Убран тестовый артефакт `workspace/store/contract-VB-2026-001.docx`.

### Verify
- `npm run typecheck` → exit 0, 0 ошибок TS.
- `npm run build` → exit 0, `dist/` собран (22 .js). DoD «build green» выполнен.

### Открытые вопросы / следующий шаг
- **ШАГ 3:** в `workspace/CLAUDE.template.md` адаптировать личность под VIP BIKE (ассистент оператора проката) + строка роутинга «договор/паспорт/ВУ/аренда → skill contract-agent»; обрезать reference/ и штатные skills/ до VIP-релевантных (убрать daily-brief/publish-to-cloud если не нужны); сверить cli-вызов в SKILL (уже `npx tsx`).
- **ШАГ 4:** tenants/vip-bike/tenant.yaml + .env (токен/ключи есть в vps-access.md).
- **ШАГ 5:** E2E локально (мок-OCR) + security E2E.

---

## [2026-06-09] — Сессия: security-фиксы модуля (по решению Олега «все сейчас»)

### Что сделано (5 находок security-аудита закрыты кодом)
- **#1 шифрование at-rest (HIGH):** `better-sqlite3` → `better-sqlite3-multiple-ciphers` (SQLCipher; держим ОБА пакета — plain для памяти бота из рантайма, ciphers для БД договоров). `db.ts`: `PRAGMA key` из `CONTRACTS_DB_KEY` (экранирование `''`), `throw` в `NODE_ENV=production` без ключа, `chmod 600` на db+wal+shm. Smoke + verifier: файл зашифрован (нет plaintext, header не «SQLite format 3»), без ключа `SQLITE_NOTADB`, с ключом читается, права `-rw-------`.
- **#4 pdn_consent (MED):** флаг `--consent` в CLI gen-contract → `createClient(.., {pdnConsent:true})` → проставляет `pdn_consent_at`.
- **#5 path traversal (MED):** `assertInUploads` — `--passport/--license/--cleanup-files` только внутри `CONTRACTS_UPLOADS_DIR` (дефолт `workspace/uploads`).
- **#3 детерминированная чистка фото (MED):** `--cleanup-files a,b` — модуль сам `unlink` фото после генерации (не LLM-шаг), печатает `cleaned`. SKILL.md обновлён.
- **#7 утечка ПДн в лог (LOW):** тело ответа Z.AI убрано из текста ошибки.
- **R1 (LOW, от security2):** `assertInUploads` через `fs.realpathSync` (обе стороны) — симлинк внутри uploads наружу тоже отвергается.
- `.env.example`: + `CONTRACTS_DB_KEY` (openssl rand -hex 32), `CONTRACTS_UPLOADS_DIR`. package.json: + ciphers, bump better-sqlite3 → 11.x.

### Verify (тимейты vipbot-security-verify, tmux)
- **verifier2 (sonnet): PASS** — 10/10 (typecheck 0, recognize-sample 19/19, gen-sample sha256 `c9155c0c…` стабилен, шифрование write/read/reject-без-ключа/chmod600, CLI флоу с consent+cleanup, path-traversal отклоняется). **R1 re-check: PASS** (симлинк evil.jpg→/etc/hosts отвергается через realpathSync, exit 1; норм-путь читается; recognize-sample 19/19).
- **security2 (opus): PASS-with-recommendations** — 5/8 CLOSED (#1×2 HIGH, #3,#4,#5,#7); #2 (трансгран Z.AI) + #6 (гейт в боте) OPEN-by-design; #8 LIKE acceptable. Новых критичных дыр фиксы не внесли.

### Остаётся до боевых паспортов (НЕ код)
- **#2:** юр-основа трансграничной передачи фото в Z.AI (api.z.ai, КНР) — согласие субъекта + уведомление РКН ЛИБО РФ-OCR. Решение клиента.
- Деплойная обвязка: реальный `CONTRACTS_DB_KEY` в `.env` (chmod 600), Z_AI_API_KEY, реквизиты lessor, telegram_id операторов.

---

## [2026-06-09] — Сессия: ШАГ 1 — порт модуля договоров на SQLite + доступы клиента

### Что сделано
- **Порт модуля `modules/contract/` с Postgres на SQLite** (цепочка одним писателем: types → db → schema → contracts → cli, чтобы избежать гонки импортов из стартовой заметки):
  - `lib/types.ts` — урезан до трека A (Lessor, Client, ClientOcrFields, BikeUnit, RentalContract); `_types-FULL-from-site.ts` остаётся как референс.
  - `lib/db.ts` — `pg.Pool` → `better-sqlite3` (sync). `getDb()` открывает БД по `CONTRACTS_DB_PATH` (дефолт `workspace/store/contracts.db`), `PRAGMA journal_mode=WAL` + `foreign_keys=ON`, авто-применяет `db/schema.sql` при первом открытии. `query()` стал sync. `dbConfigured()` → всегда true.
  - `db/schema.sql` + `db/migrations/001_init.sql` (идентичны) — SQLite-синтаксис: SERIAL→INTEGER AUTOINCREMENT, UUID→TEXT (id из `randomUUID()`), TIMESTAMPTZ/DATE→TEXT(ISO), BOOLEAN→INTEGER 0/1, JSONB→TEXT, NUMERIC→REAL, now()→`datetime('now')`/код.
  - `lib/contracts.ts` — `@/lib/*`→`./*.js`, убран `await`, `$1`→`?`, RETURNING * → INSERT + повторный SELECT по id, JSON parse/stringify в мапперах, `is_active===1`, nextContractNumber по `substr(contract_date,1,4)`, id через `randomUUID()`.
  - `lib/contractDoc.ts` — TEMPLATE_PATH через `import.meta.url` (не cwd); `require()`→`createRequire(import.meta.url)` для pizzip/docxtemplater (ESM).
  - **`cli.ts` (НОВЫЙ)** — команды `recognize | gen-contract | migrate`, парсер флагов, чтение фото в base64, JSON в stdout, .docx в `workspace/store/`, attachContractDoc.
- **SKILL.md** — вызовы `node cli.js` → `npx tsx modules/contract/cli.ts` (решено гонять через tsx, без отдельного билда модуля).
- **scripts/{recognize-sample,gen-contract-sample}.ts** — фикс ESM (`createRequire`, `.js` в импортах).
- `npm install` выполнен (tsx, better-sqlite3 и пр. встали).
- **recognize-sample (мок): 19/19 ✅** (прогнан инлайн). gen-sample/CLI+SQLite — на независимой проверке у verifier-тимейта.

### Доступы клиента (получены 2026-06-09, сохранены)
- `tenants/vip-bike/vps-access.md` (gitignored) — VPS `212.67.11.25` (root, ключ `~/.ssh/clients_vps`, домен vip-bike.ru; на сервере Docker `vip_bike`→3005 + nginx — НЕ трогать), Telegram-бот `@vipBikeAssistantBot` + токен, Supabase (URL+service_role_key — источник миграции данных сайта в SQLite).
- Память: `memory/access-vip-bike-client.md` + `MEMORY.md`.
- Изоляция: `.gitignore` (vip-bot/ + родитель) + `.dockerignore` (vip-bot) — подтверждены.

### Принятые решения
- **CLI гоняем через `tsx`**, не отдельным билдом → SKILL.md синхронизирован на `npx tsx modules/contract/cli.ts`.
- **ESM + CJS-пакеты**: `"type":"module"` → `require` падает; pizzip/docxtemplater через `createRequire(import.meta.url)`. Относительные импорты с `.js` (NodeNext).
- **id генерируем в коде** (`crypto.randomUUID()`), не в SQLite (нет gen_random_uuid). RETURNING не используем (старый sqlite) — INSERT + SELECT по id.
- **Параллельность по правилам:** порт-цепочка = один писатель (инлайн, корректно). Финальный verify + 152-ФЗ security = 2 независимых агента → запущены через **TeamCreate + tmux** (`vipbot-contract-verify`: verifier sonnet, security opus). Verifier ≠ автор.

### Verify (тимейты vipbot-contract-verify, tmux)
- **verifier (sonnet): RE-VERIFY PASS** после фикса 3 багов:
  1. `recognize.ts:20` — импорт `./types` без `.js` (ломал strict `tsc`, tsx-рантайм работал) → `.js`.
  2. `recognize.ts:127-137` — `keyof` включал `symbol` (5 ошибок TS) → cast `(keyof ClientOcrFields & string)[]`.
  3. `cli.ts` — продакшн-баг `lessorId=null` (getActiveLessor вызывался ПОСЛЕ createContract) → вынес выше, передаю `lessorId`.
  Evidence: recognize-sample 19/19; gen-sample sha256 `c9155c0c…` стабилен 2/2; CLI gen-contract → договор VB-2026-001, lessorId=1, status=active, docx+sha256+связи; tsc exit 0.
- **security (opus): PASS-with-recommendations.** SQL чисто (параметризовано), секретов нет, фото в БД нет, sha256 детерминирован. Находки (для боевого режима, НЕ блок порта): #1 паспорта в SQLite plaintext без шифрования at-rest + файл без chmod 600; #2 трансгран передача фото в Z.AI (юр-основа); #3 чистка фото отдана LLM-агенту (лучше детерминированно); #4 pdn_consent_at не проставляется; #5 path traversal в readFileAsBase64 + риск инъекции на стыке бот→CLI; #6 нет гейта в модуле (только ALLOWED_CHAT_ID бота).
- Команда `vipbot-contract-verify` закрыта (shutdown обоих).

### Открытые вопросы / следующий шаг
- **STEP 1 = DONE.** README ШАГ 1-3 → ✅.
- Развилка по security-фиксам (на решении Олега): дёшево сейчас (#4 consent, #5 path, chmod 600 файла БД) vs отложить на deploy (#1 шифрование, #2 юр-основа Z.AI). #3 чистка фото — после ШАГ 2 (нужен src/media.ts бота).
- Затем ШАГ 2 (копия рантайма KLOD-BOX: src/ + workspace/ + lean bundled-skills/ + scripts/), npm typecheck/build.

---

## [2026-06-09] — Сессия: скелет проекта (создан из координатора vip-bike-site)

### Что сделано
- Создана структура `vip-bike-site/vip-bot/` (src, workspace/{reference,skills/contract-agent,.claude,store}, modules/contract/{lib,db/migrations,templates,scripts}, scripts, bundled-skills, tenants/vip-bike).
- Continuity-доки: `CLAUDE.md`, `PRD.md`, `README.md`, этот `progress.md`.
- Конфиги: `package.json` (рантайм KLOD-BOX deps + docxtemplater/pizzip/better-sqlite3; **БЕЗ pg/@types/pg**), `tsconfig.json` (NodeNext, rootDir=src), `.env.example`.
- Скилл-агент: `workspace/skills/contract-agent/SKILL.md` (каркас Олега, 1:1).
- Сырые файлы ТРЕКа A скопированы в `modules/contract/` как отправная точка (ещё на Postgres):
  `lib/{recognize,contractDoc,contracts,db}.ts`, `lib/_types-FULL-from-site.ts` (полный types.ts сайта — урезать до трека A), `db/_schema-postgres-ORIGINAL.sql` (исходная pg-схема — портировать в SQLite), `templates/contract-rental.docx`, `scripts/{gen-contract-sample,recognize-sample,make-contract-template}`.
- Refined-план: `PLAN-2026-06-09-vip-bot-klodbox.md`. Старт-промпт: `LAUNCH-PROMPT.md`.

### Принятые решения
- **БД → SQLite** (better-sqlite3, уже в рантайме KLOD-BOX), не Postgres. better-sqlite3 синхронный → при портаже pg→sqlite убрать `await` у запросов, `query()` станет sync.
- **Договоры = SKILL**, не субагент. Бот single-agent (фикс вывода субагентов в KLOD-BOX v0.9.5), `.claude/agents/` не создаём. Имя `contract-agent` сохранено как «агент» для Олега, физически — скилл.
- **Модуль гоняем через `tsx`** (`node_modules/.bin/tsx modules/contract/cli.ts`), а не отдельным билдом — рантайм компилируется `src→dist`, модуль исключён из tsconfig. (Если SKILL.md писал `node cli.js` — сверить с фактическим cli.ts при его написании.)
- **OCR оставлен на `recognize.ts`** (прямой Z.AI, точнее generic-vision для документов). MCP `zai-vision` — доступный фолбэк.
- Копируем KLOD-BOX **пост-v0.9.5** (лёгкий контекст, без notionApi/zai-reader, рендер reference).

### Отклонённые подходы
- Старый план «отдельный grammY-процесс `bot/`» — отменён в пользу форка рантайма KLOD-BOX (договоры как скилл единого Claude-бота).
- Postgres — убран по решению клиента (лишний провижн для одного оператора; SQLite самодостаточен).

### Открытые вопросы / следующий шаг
- Следующая сессия (изнутри `vip-bot/`) стартует с **шага 1** плана: порт `db.ts`+`contracts.ts`→better-sqlite3, `schema.sql`→SQLite, `types.ts`→только трек A, фикс `@/`→относительные пути; затем `cli.ts`; verify в моке.
- Затем шаг 3: rsync рантайма KLOD-BOX в `src/`+`workspace/`+lean `bundled-skills/`+`scripts/`.
- Боевой режим ждёт данные клиента ({{уточнить}}): реквизиты lessor, тарифы, VIN, Z_AI_API_KEY, TELEGRAM_BOT_TOKEN+операторы, VPS.

### Изоляция от Next-сайта (TODO для шага 1)
- Добавить `vip-bot/` в `.dockerignore` сайта и в rsync-excludes деплоя; в `.gitignore` — `vip-bot/node_modules`, `vip-bot/dist`. Подтвердить, что `next build` не трогает `vip-bot/`.

### Дополнение — перенос команды агентов из KLOD-BOX (для автономной работы)
- `cp -R KLOD-BOX/.agents → vip-bot/.agents` — обученная команда: 20 members + 7 исходных teams (референс) + shared-context + _template.
- Добавлены 4 рабочие команды vip-bot: `.agents/teams/{vipbot-contract-module, vipbot-runtime, vipbot-deploy, vipbot-ops}.md` (под шаги PLAN).
- `cp -R vip-bike-site/agents → vip-bot/agents` — 11 generic coding-субагентов (architect, security, code-reviewer, verifier, …) для `subagent_type`.
- Переписаны под vip-bot: `.agents/shared-context.md` (структура/SQLite/запреты/DoD), `.agents/README.md` (команды + как добавить агента), `AGENTS.md` (агенты бота = скиллы).
- `.claude/settings.json` — tmux-режим команд (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, `teammateMode: tmux`) + permissions + additionalDirectories (vip-bot, KLOD-BOX upstream, VIP-BIKE-ELECTRO brand, ~/.claude).
- `.tasks/`, `.dev-skills/` созданы (autonomy scaffolding).
- **Цель:** проект автономен — следующий человек запускает команды через TeamCreate и добавляет своих агентов (members → `.agents/members/`, агенты бота → `workspace/skills/`).

### Extracted Patterns
| Паттерн | Контекст | Дата | В .dev-skills? |
|---|---|---|---|
| pg→better-sqlite3 порт (sync, без await, JSONB→TEXT+JSON.parse) | модуль договоров | 2026-06-09 | нет (пока 1 раз) |
