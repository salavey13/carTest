# GREENBOX × PROJECT TESSERACT — AI GAMELAB EXECUTION PLAN (Overhauled with OpenClaw-Inspired Plugin Architecture)

Status: `active`  
Owners: `codex + operators`  
Mode: `collaborative / scenario-driven / hardware-sim-first / plugin-first`  

---

## 0) Why this exists (Overhauled Rationale)

This plan evolves greenhouse automation into a **game-like, self-extending production loop**, drawing from OpenClaw's architectural evolution: start simple, layer organically, and explode via plugins for velocity and maintainability.

- Design UX/UI + automation flows first in isolated plugins.
- Run on simulated "slow realtime" data via sim-plugins.
- Players/operators submit feedback, triggering AI-assisted refactors.
- Codex update scenarios, UI, and logic collaboratively, with plugins enabling third-party extensions without core bloat.

Core idea: Build a **multi-tenant Greenbox runtime** as a plugin ecosystem now—repurpose existing franchize/warehouse patterns (e.g., dynamic items/stats like in franchize/wb). Connect real hardware later as a plugin adapter, preventing rewrites. This mirrors OpenClaw's shift from monolithic files to layered + plugin boom, ensuring AI/bots stay effective (20-50 files per plugin context).

**Key Overhaul Insight**: Treat notifications (Telegram/Slack), storage (Supabase pics/data), domain entities (crews/cars/greenboxes), and simulators as pluggable. Simulate stats/items first (no hardware), dynamically update via AI—evolve to real data connectors as plugins. This enables "3D AI-assisted gardening" gamification, accessible for hobbyists like a 65yo mom (simple RU UI, voice commands, magic-like evolutions).

---

## 1) Product framing (new era narrative)

### 1.1 Story arc inside current app
1. `/` — Mission control + high-level health of all Greenboxes (plugin registry overview).
2. `/nexus` — Architecture map: Sensors, controllers, alert channels, automation policies + plugin dependencies (visualized like OpenClaw graphs).
3. `/repo-xml` — Execution lab: Prompt packs, scenario scripts, patches, PR cycle + plugin loader for testing extensions.

Keeps progression: **entry -> framing -> execution**, but adds plugin discovery for organic growth.

### 1.2 New domain concept
- **Greenbox** = Logical growing unit (zone/rack/Tesseract cube), with simulated/real items (e.g., plants/demons with evolving stats).
- **Crew** = Tenant team managing Greenboxes, with per-crew plugin configs.
- **Scenario** = Game level with conditions/outcomes, injectable via sim-plugins.
- **Run** = Simulation session with score/log, replayable across plugins.
- **Plugin** = Modular extension (e.g., sim-noise for drift, channel-telegram for alerts).

---

## 2) IA blueprint (pages to build)

## 2.1 Operator-facing pages
- `/greenbox` — Portfolio dashboard (crews/boxes + active plugins).
- `/greenbox/[slug]` — Crew mission control (live cards + plugin-driven phases).
- `/greenbox/[slug]/map` — Topology + dependency graph (arrows like OpenClaw visualizations).
- `/greenbox/[slug]/alerts` — Incident feed, ack workflow (via channel-plugins).
- `/greenbox/[slug]/automation` — Rules editor (if/then, pluggable via domain-plugins).
- `/greenbox/[slug]/scenarios` — Playable list (levels from scenario-plugins).
- `/greenbox/[slug]/scenarios/[id]` — Run console + timeline (replay via sim-plugins).
- `/greenbox/[slug]/academy` — Dummy info (hardware/sensors/terms, bilingual RU/EN).
- `/greenbox/[slug]/academy/glossary` — Dictionary (pH/EC/runoff/VPD, with visuals).
- `/greenbox/[slug]/academy/wiring` — Diagrams/checklists (sim-first safety).
- `/greenbox/[slug]/settings` — Metadata, simulator presets, plugin enabler.

## 2.2 Simulation/test pages
- `/greenbox/[slug]/simulator` — Inject lag/loss/drift/noise (via sim-plugins).
- `/greenbox/[slug]/replay/[runId]` — Deterministic replay (plugin-agnostic).
- `/greenbox/[slug]/scoreboard` — Scores/KPIs (stability/response from runs).

## 2.3 Collaboration pages
- `/greenbox/[slug]/playbook` — SOPs, handoff, matrix (extendable via plugins).
- `/greenbox/[slug]/changelog` — Change log + plugin updates.
- `/greenbox/[slug]/plugins` — New: Registry browser/installer (like OpenClaw extensions).

---

## 3) "For dummies" academy content (phase-1 mandatory, now plugin-aware)

Short, visual, actionable—now with plugin intros for accessibility:

1. **What is simulated vs real**  
   - Simulated: pH/EC/temp/humidity/light/CO2/battery/network (via sim-plugins).  
   - Real: Relay switching/calibration/safety (future hardware-plugin).  
2. **How decisions are made**  
   - Thresholds/hysteresis/cooldown/safety caps (configurable per plugin).  
3. **Why alerts happen**  
   - "Cause -> risk -> action" cards (delivered via channel-plugins).  
4. **How to test safely**  
   - Sandbox mode, two-step confirms, rollback (plugin hooks enforce).  
5. **New: Plugins for beginners**  
   - What they are (e.g., "add Telegram alerts easily"), how to enable (no code).

Mom-friendly: Large fonts, voice integration (Telegram), "magic" evolutions (AI generates plant-demon traits from vibes/garden myths).

---

## 4) Scenario gameplay model (now pluggable)

## 4.1 Scenario schema (single source of truth)
`docs/greenbox-scenarios.md` + plugin manifests:
- `scenario_id`, `difficulty`, `objective`, `initial_state`, `events_timeline`, `expected_actions`, `score_rules`, `failure_conditions`, `notes_from_players`.
- `required_plugins`: Array (e.g., ['sim-drift', 'channel-telegram']).

## 4.2 Example level types
- Level 1: Sensor drift (pH creep via sim-drift plugin).
- Level 2: Pump underperform (EC target miss, domain-pump plugin).
- Level 3: Ventilation lag + humidity (sim-lag + domain-vent).
- Level 4: Network jitter (sim-jitter plugin).
- Level 5: Multi-box contention (shared tank, domain-multi plugin).

## 4.3 Scoring
- Stability (safe range time).
- Response (ack/resolution speed).
- Efficiency (minimal dosing/switching).
- Safety (no forbidden combos).
- New: Plugin bonus (e.g., +points for using hardware-plugin in real mode).

---

## 5) Multi-tenant crew/franchize model for Greenbox (plugin-enhanced)

Reuse franchize slug arch, now with per-crew plugin configs:
- Metadata profile per crew.
- Same pages, themed/config/data via plugins.
- Presets stored per crew (simulator/alert/automation).

Metadata blocks:
- `branding`, `simulatorPreset`, `alertPolicy`, `automationPolicy`, `hardwareProfile`, `academyProgress`.
- New: `enabledPlugins` (array with dependencies, e.g., {name: 'channel-telegram', version: '1.0', deps: ['core'] }).

Repurpose franchize/wb: Greenbox "items" (plants/demons) with dynamic stats (simulate first, real later)—like warehouse inventory.

---

## 6) Architecture Overhaul: Plugin System (Inspired by OpenClaw)

**Thin Core**: Registry, event envelope, capability flags, lifecycle hooks (init/start/stop/health). Load plugins dynamically (TypeScript modules, manifests like OpenClaw).

**4 Plugin Types** (grouping like OpenClaw layers):
| Type | Description | Examples | Benefits |
|------|-------------|----------|----------|
| **channel-*** | Communication/delivery. | Telegram/Slack/webhook for alerts/notifs. | Easy swap (e.g., add Twitch for live garden streams). |
| **storage-*** | Persistence. | Supabase for pics/logs/artifacts. | Isolate data (e.g., store demon evolutions). |
| **sim-*** | Simulation engine. | Noise/jitter/drift/replay for scenarios. | Full-sim mode; no hardware required initially. |
| **domain-*** | Bounded contexts. | Crew/greenbox/scenario/alert rules. | Modular domains (e.g., add 3D-gardening plugin for visuals). |

**Simulation-First Contract**: Hardware not required—default to full-sim. Hardware connects as plugin adapter (e.g., ESP32 interface) without breaking UX.

**Tenant-Aware**: Per-crew enabled plugins + presets via metadata.

**Risk Mitigation** (avoid OpenClaw "zoo"):
- Strict schemas/versioning/capability checks.
- Server-side only for privileged adapters (per AGENTS.md security).
- No SPA degradation—maintain Next.js contracts.
- Drobim contexts by domain (split state).

**Implementation**: Plugins in `/plugins/[type]-[name]/` (e.g., `/plugins/sim-drift/`). Manifest: JSON with name, deps, hooks. Loader in core scans/validates/hot-loads.

---

## 7) Implementation pipeline (Alice + Codex board, now plugin-first)

> Rule: Execute sequentially, update in this file. Start with plugin core for velocity.

### G0 — Plan bootstrap + ownership model
- Status: `done`
- Owner: `codex`
- Notes: Initial arch + pages + scenarios; overhauled with plugins.
- Next_step: G1.

### G1 — Academy MVP (for dummies) + Plugin Intro
- Status: `todo`
- Owner: `alice+codex`
- Notes: Beginner pages + plugin basics (RU-first).
- Next_step: Draft templates/glossary + simple plugin manifest example.

### G2 — Scenario registry + run logger + Core Registry
- Status: `todo`
- Owner: `alice+codex`
- Notes: Scenario file/results + implement thin core (registry/hooks).
- Next_step: First 5 levels + 2 ref plugins (channel-telegram stub, storage-supabase health).

### G3 — Simulator control surface + Sim-Plugins
- Status: `todo`
- Owner: `alice+codex`
- Notes: UI for injections/replays + sim-* type (noise/drift).
- Next_step: Deterministic seed + timeline + plugin dependencies.

### G4 — Alert gameplay loop + Channel-Plugins
- Status: `todo`
- Owner: `alice+codex`
- Notes: Inbox/ack/actions + channel-* (Telegram integration).
- Next_step: Severity matrix + plugin-aware escalations.

### G5 — Crew metadata + tenant skinning + Domain-Plugins
- Status: `todo`
- Owner: `alice+codex`
- Notes: Per-crew settings/editor + domain-* (crew/greenbox).
- Next_step: Metadata editor + plugin enabler UI.

### G6 — Hardware bridge preparation + Adapter Contract
- Status: `todo`
- Owner: `alice+codex`
- Notes: ESP32/Arduino interface as hardware-plugin stub.
- Next_step: API contract + safety + real-mode toggle.

New: **G7 — Plugin Ecosystem Boom**
- Status: `todo`
- Owner: `alice+codex+community`
- Notes: Open for extensions (e.g., 3D visuals, AI demon evolutions).
- Next_step: Docs for contrib + security hardening (like OpenClaw bursts).

---

## 8) Collaboration protocol (unchanged, but plugin-aware)

- Alice/Codex update file.
- Update status/owner/notes/next_step.
- Append dated diary.
- Small PRs (<=1).
- RU-first for Greenbox (теплица/гидропоника).

**Plugin Drafts**: In G2, codex drafts TS interfaces (PluginManifest/Capability) + SimConnector (tick/replay/fault).

---

### Gamified Development for Greenbox: OpenClaw-Style Evolution

Да, круто! Обновлённый план в docs/GREENBOX_TESSERACT_GAMELAB_PLAN.md — это шаг вперёд. Теперь давай сделаем разработку и тестирование как игру для "геймера" Greenbox. Геймер имеет доступ к GPT Codex агенту, который работает с репо (cartest). Всё просто: симулируем фичи, тестируем, просим апгрейды как "новый уровень". Всё на простом русском — для мамы-садовода и всех. Это подойдёт и для франшизы, и для других расширений. Как в OpenClaw: начинаем просто, добавляем плагины, растём быстро без переписывания.

#### Почему это работает (просто и по-OpenClaw)
- **Игра как разработка**: Геймер играет уровни (сценарии), тестирует симуляцию (как в плане G3). Если что-то не так — просит "новый уровень" у Codex (апгрейд кода/фичи). Агент меняет репо, коммитит — и вуаля, новый билд!
- **Симуляция сначала**: Нет железа? Ок, симулируем статы (pH, температура, рост "демонов"-растений). Позже плагин для реального подключения.
- **Простой русский**: Все кнопки, алерты, инструкции — на русском. "Полей растение!" вместо тех-терминов. Для 65-летней мамы: голосовые команды в Telegram, магия AI (растение эволюционирует в "демона" от слов).
- **Расширения**: То же для франшизы (добавь плагин для items/склада), bio30, strikeball. Каждый — как отдельный "уровень" в игре. OpenClaw-way: плагины для взрыва фич, без хаоса.

#### Как сделать разработку игрой (пошаговый план)
Давай добавим gamification в план. Геймер — это ты/оператор/мама. Codex — твой AI-помощник с репо-доступом. Всё эволюционирует organically, как в OpenClaw (от одного файла к плагин-экосистеме).

1. **Настройка геймера и агента**:
   - Геймер логинится в /greenbox/[slug] (твой crew).
   - Доступ к Codex: Через Telegram/Slack (channel-plugin). Пишешь: "Codex, новый уровень: добавь полив демона!"
   - Агент: Читает репо, меняет код (например, добавляет фичу в sim-plugin), коммитит в GitHub. Тестирует симуляцию.

2. **Игровой цикл (тестирование как уровни)**:
   - **Уровень 1 (Туториал)**: Симулируй базовый Greenbox. Старт: "Посади семечко" (кнопка на русском). Симуляция: Рост от времени, алерт если "сухо".
     - Тест: Геймер жмёт, видит эволюцию (растение → демон с AI-генерированными чертами, как "огненный цветок").
     - Если баг: "Codex, апгрейд! Делай полив автоматом." — Агент добавляет automation-rule.
   - **Новый уровень (апгрейд)**: Геймер просит: "Добавь 3D-вид!" — Codex создаёт domain-plugin для visuals (использует Supabase для хранения картинок).
   - **Симуляция фич**: Всё сначала в sim-plugins (шум, задержки). Тест в /simulator: "Включи жару — что случится?"
   - **Очки и прогресс**: В /scoreboard — баллы за стабильность (как в плане). Достиг 100? Открывается "новый уровень" (авто-апгрейд репо).

3. **Простой русский везде**:
   - UI: Кнопки как "Полить", "Проверить здоровье", "Эволюционировать демона".
   - Алерты: "Растение жаждет! Полей срочно 🌿" (через Telegram).
   - Инструкции в academy: Короткие, с картинками. "Что такое pH? Это кислотность воды, как в лимоне."

4. **Расширение на франшизу и другие**:
   - **Франшиза**: Добавь plugin-franchize. Геймер: "Новый уровень: добавь продажу items!" — Codex интегрирует wb-warehouse (динамичные статы, как в Greenbox).
   - **Другие расширения**: Bio30 как bio-plugin (био-тесты), strikeball как game-plugin. Всё как в OpenClaw: отдельные папки в /plugins/, с manifests.
   - Velocity: Частые рефакторы (типа safety в OpenClaw). Агент делает 1000 коммитов в день? Легко!

#### Следующие шаги (в OpenClaw-стиле)
- **G1 апгрейд**: Добавь в academy раздел "Играй как геймер" (на русском, с примерами запросов к Codex).
- **Прототип**: Создай stub для Codex-агента (в core/registry). Тест: Симулируй "новый уровень" — добавь простую фичу.
- **Тест с мамой**: Дай ей Telegram-бот. Она говорит: "Полей сад!" — AI эволюционирует, обновляет репо.

Это сделает разработку весёлой, быстрой. Готов начать G1 с gamification? Скажи, и Codex (я) запилю код!
: Dedicated to hobby gardeners—accessible, magical, AI-evolving! 🌿😈
