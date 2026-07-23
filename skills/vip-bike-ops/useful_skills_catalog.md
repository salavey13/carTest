# VIP Bike — Complete Skills Catalog

> All skills, capabilities, and operator runbooks available to the vip-bike-ops
> agent. Organized by domain. Each entry has a one-line purpose + trigger
> phrases + where the full doc lives.

---

## 1. vip-bike-ops Umbrella (Router)

The boss skill. Doesn't run code — routes operator requests to one of 15
leaf skills. Also provides Supabase/GitHub/VPS/Telegram context.

| Property | Value |
|---|---|
| **Skill name** | `vip-bike-ops` |
| **Path** | `skills/vip-bike-ops/SKILL.md` |
| **Trigger phrases** | any VIP Bike operational question (the router figures out which leaf) |
| **Companion docs** | `boss_skill_explainer.md` (agent operating manual), `boss_commands_cron.md` (cron schedule), `boss_status_report.html` (visual report) |

---

## 2. Leaf Skills (15 text-based, curl + Supabase)

All live under `skills/<name>/SKILL.md`. Zero dependencies — just bash + curl + jq.

### 2.1 CRM & Leads

| Skill | Path | Purpose | Triggers |
|---|---|---|---|
| `leads-crm-text` | `skills/leads-crm-text/` | Leads pipeline: list, detail, dismiss, KPIs, todos, funnel | "лиды", "горячие", "воронка", "dismiss", "QR не принят" |
| `rider-profile-text` | `skills/rider-profile-text/` | Client profile: history, achievements, documents, activity | "профиль клиента", "история клиента", "достижения" |

### 2.2 Analytics (3 tabs — mirrors v2 web dashboard)

| Skill | Path | Purpose | Triggers |
|---|---|---|---|
| `rental-analytics-text` | `skills/rental-analytics-text/` | Rentals: KPIs, detail (10 sections), todos, docs, handoff, history, activate, complete, returns-due, overdue | "аренды сегодня", "возвраты", "просроченные", "kpi аренд", "карточка аренды" |
| `sale-analytics-text` | `skills/sale-analytics-text/` | Sales: KPIs, detail (5 sections), contract status, delivery status, warranty, stats, update | "продажи", "статус договора", "доставка", "гарантия", "kpi продаж" |
| `service-analytics-text` | `skills/service-analytics-text/` | Services: KPIs, detail (5 sections), catalog (10 items), mechanic get/assign, stats, activate, complete | "сервис", "обслуживание", "нормо-час", "механик", "каталог услуг" |

### 2.3 Catalog & Rentals

| Skill | Path | Purpose | Triggers |
|---|---|---|---|
| `franchize-catalog-text` | `skills/franchize-catalog-text/` | Bike catalog: list, detail, pricing, availability check | "байки", "каталог", "цена", "доступность" |
| `rental-card-text` | `skills/rental-card-text/` | Single rental deep-dive: card, todos, docs, handoff, activate, complete, status, send-message, history | "карточка аренды", "документы аренды", "QR-claim" |

### 2.4 Crew & Operations

| Skill | Path | Purpose | Triggers |
|---|---|---|---|
| `crew-management-text` | `skills/crew-management-text/` | Crew: info, members, member detail, stats, todos, todo-stats, update role, shifts | "команда", "кто онлайн", "смены", "задачи оператора" |
| `crew-admin-text` | `skills/crew-admin-text/` | Admin config: prices, availability, bikes, promo | "админка", "цены", "промо", "конфигурация" |
| `crew-info-text` | `skills/crew-info-text/` | Crew public info: about, contacts, community, onboarding | "контакты", "адрес", "о экипаже", "онбординг" |
| `leaderboard-text` | `skills/leaderboard-text/` | Rider leaderboard: top, by rider, stats | "лидерборд", "топ клиентов", "топ операторов" |

### 2.5 Reviews & Contracts

| Skill | Path | Purpose | Triggers |
|---|---|---|---|
| `reviews-text` | `skills/reviews-text/` | Reviews: list, detail, moderate, stats | "отзывы", "рейтинг", "модерация" |
| `contract-draft-text` | `skills/contract-draft-text/` | Contract drafts: draft, submit, approve, decline, status | "договор", "черновик", "одобрить", "STS" |

### 2.6 Orders & Checkout

| Skill | Path | Purpose | Triggers |
|---|---|---|---|
| `orders-checkout-text` | `skills/orders-checkout-text/` | Orders: detail, list, create-checkout, create-invoice, notifications, retry | "заказ", "корзина", "чекаут", "счёт", "уведомления" |

---

## 3. Factory Skills (docs/skills/ — for content/design/deployment)

These live in `docs/skills/` and are NOT part of the vip-bike-ops umbrella
(they cover different domains: contracts, site admin, video gen, Avito,
rental catalog KB, global rules). The boss CAN route to them if the operator
asks about those domains.

### 3.1 `fk-pasha-admin` (Pasha's admin runbook)
- **Path:** `docs/skills/fk-pasha-admin.md` (39KB — the biggest skill doc)
- **Purpose:** Admin of the rental repo (salavey13/carTest) — docs, analytics, /doc bot cmd, deployment, Supabase schema
- **Triggers:** "деплой", "VPS", "supabase schema", "git push", "rental repo", "Pasha"
- **Key capabilities:** SSH to VPS, git push to main, Vercel auto-deploy, Docker container management, image sync, Avito pipeline
- **Boss integration:** Boss routes here for deployment + repo admin questions

### 3.2 `fk-contract` (Contract document generation)
- **Path:** `docs/skills/fk-contract.md`
- **Purpose:** Generate ready-to-sign .docx contracts (rent + sale) from client data, deterministic (no LLM text generation)
- **Triggers:** "договор .docx", "сгенерировать контракт", "аренда docx", "продажа docx"
- **Key capability:** Template-based docx generation from Supabase data
- **Boss integration:** Boss routes here when operator asks for a printable contract

### 3.3 `fk-site-admin` (vip-bike.ru site admin)
- **Path:** `docs/skills/fk-site-admin.md`
- **Purpose:** Point edits to vip-bike.ru Next.js site content, git commit, redeploy Docker container on VPS
- **Triggers:** "сайт", "vip-bike.ru", "правка контента", "редеплой"
- **Boss integration:** Boss routes here for site content changes (NOT rental repo — those go to fk-pasha-admin)

### 3.4 `fk-video-gen` (AI promo video generation)
- **Path:** `docs/skills/fk-video-gen.md` (26KB)
- **Purpose:** AI promo videos from first frame — orbit, flyby, matrix-style for bikes and products. Seedance 2 + Veo 3 Fast via Kie.ai
- **Triggers:** "промо видео", "video gen", "orbit", "flyby", "matrix-style"
- **Boss integration:** Boss routes here for marketing video generation

### 3.5 `rental-catalog-kb` (Shared knowledge base)
- **Path:** `docs/skills/rental-catalog-kb.md`
- **Purpose:** Shared KB for working with bikes, images, Supabase, rental repo. READ THIS FIRST when touching bike catalog
- **Triggers:** (referenced by other skills, not directly triggered)
- **Boss integration:** Boss reads this for context before any catalog question

### 3.6 `avito-seller` (Avito lead manager)
- **Path:** `docs/skills/avito-seller.md`
- **Purpose:** Read incoming Avito chats, qualify leads, prepare DRAFT replies in seller's style, handle objections. Draft mode (no auto-send)
- **Triggers:** "авито", "avito chats", "лид с авито", "ответ авито"
- **Boss integration:** Boss routes here for Avito lead management

### 3.7 `avito-profile` (Avito API manager)
- **Path:** `docs/skills/avito-profile.md` (8KB)
- **Purpose:** Manage Avito profile + listings via official API (MCP avito-profile, 25 domains / 248 operations) — analytics, balance, listings, stats, promotion, messages, reviews, auto-load
- **Triggers:** "авито объявления", "авито статистика", "авито баланс", "продвижение"
- **Boss integration:** Boss routes here for Avito listing management

### 3.8 `factory-global-rules` (Universal content rules)
- **Path:** `docs/skills/factory-global-rules.md` (10KB)
- **Purpose:** Universal rules for ALL content factory agents — bans ("voice" word, emojis in markup, etc.), human-style gate, hook-first, visual prompt protocol
- **Triggers:** (referenced by all content skills, not directly triggered)
- **Boss integration:** Boss applies these rules when generating any client-facing text

---

## 4. Capability Docs (docs/ — integration powers)

These document reusable integration capabilities (Telegram, PDF+QR, etc.)
that skills can build on.

### 4.1 `CAPABILITIES.md`
- **Path:** `docs/CAPABILITIES.md`
- **Covers:** Telegram capability (WebApp, bot, invoices, documents, deep links), PDF + QR capability (pdf-lib, QR generation, sendTelegramDocument)
- **Boss use:** Knows the capability surface area to suggest the right integration

### 4.2 `AUTOMATION_EXPANSION_PLAN.md`
- **Path:** `docs/AUTOMATION_EXPANSION_PLAN.md`
- **Covers:** Codex Bridge automation — `/codex` → Slack → PR flow, runtime callback execution, lifecycle statuses, idempotency, schema introspection
- **Boss use:** Phase 2+ of boss development (auto-execute SupaPlan tasks → callback)

### 4.3 `SUPAPLAN_FOR_DUMMIES.md`
- **Path:** `docs/SUPAPLAN_FOR_DUMMIES.md`
- **Covers:** Deploying SupaPlan — the system the boss's `supaplan-runner.sh` integrates with
- **Boss use:** Already integrated via `supaplan-runner.sh` boss command

### 4.4 `DOC_COMMAND_ENHANCEMENT_PLAN.md`
- **Path:** `docs/DOC_COMMAND_ENHANCEMENT_PLAN.md`
- **Covers:** /doc bot command enhancement — 4-state machine for rental contract generation via Telegram bot
- **Boss use:** Knows the /doc command flow for rental contract questions

---

## 5. Other Useful Docs (docs/ — plans + references)

### 5.1 Plans (operational roadmaps)

| Doc | Purpose |
|---|---|
| `FRANCHIZE_MONEY_MICROPOLISH_PLAN.md` | Money-flow micropolish plan for franchize |
| `PLAN-profile-rental-overhaul.md` | Profile + rental overhaul plan |
| `RENTAL_OCR_MIGRATION_PLAN.md` | OCR migration plan (20KB) |
| `WEB-APP-RENTAL-DOC-PLAN.md` | Web-app rental doc plan (12KB) |
| `GREENBOX_TESSERACT_GAMELAB_PLAN.md` | Greenbox Tesseract Gameworkshop plan (37KB) |

### 5.2 The Francheezeplan (the big picture)

| Doc | Purpose |
|---|---|
| `THE_FRANCHEEZEPLAN.md` | The master plan (60KB) |
| `THE_FRANCHEEZEPLAN_BLUEPRINT.md` | Blueprint (128KB — the biggest doc) |
| `THE_FRANCHEEZEPLAN_STATUS.MD` | Current status (21KB) |
| `THE_FRANCHEEZEPLAN_HISTORY_ARCHIVE.md` | History archive (19KB) |
| `FRANCHEEZEPLAN.md` | TL;DR version (2KB) |

### 5.3 Agent operations

| Doc | Purpose |
|---|---|
| `AGENT_DIARY.md` | Agent diary (current) |
| `AGENT_DIARY_ARCHIVE_2026Q1.md` | Archived agent diary (68KB) |
| `AGENTS.MD2.JUDGEMDAY.MD` | Agent runbook |
| `TODO-1-clicknr-codex-prompt-run4.md` | Codex prompt runbook (28KB) |

### 5.4 Crew docs (docs/crewDocs/)

| Doc | Purpose |
|---|---|
| `vip-bike-franchize-hydration.sql` | Seed SQL for vip-bike franchize |
| `vip-bike-service-seed.sql` | Seed SQL for service items |
| `vip-bike-service-items.csv` | Service items CSV (10 items) |
| `vip-bike_COMMERCIAL_PROPOSAL_TEMPLATE.html` | CP template |
| `vip-bike_RENTAL_DEAL_TEMPLATE.html` | Rental deal template |
| `vip-bike_SALE_DEAL_TEMPLATE.html` | Sale deal template |
| `vip-bike_SUBRENTAL_DEAL_TEMPLATE.html` | Subrental deal template |
| `sly13-franchize-hydration.sql` | Seed SQL for sly13 franchize |
| `sly13-seed.sql` | Seed SQL |
| `sly13_items.csv` | Items CSV |

### 5.5 Cases (docs/cases/)

| Doc | Purpose |
|---|---|
| `sauna-flow.md` | Sauna flow case study |
| `streamer-studio.md` | Streamer studio case study |

### 5.6 Skill installer (docs/skill_installer/)

| Doc | Purpose |
|---|---|
| `ZAI_AGENT_INSTRUCTIONS.md` | ZAI agent install instructions |
| `Zai-LocalClaudeCLITGBOT.html` | Local Claude CLI TG bot setup |
| `install.mjs` | Skill installer script |

---

## 6. Boss Commands (9 scheduled scripts)

All live in `boss-commands/`. See `skills/vip-bike-ops/boss_commands_cron.md`
for full schedule + per-command detail.

| Command | Schedule (MSK) | Silent? | Purpose |
|---|---|---|---|
| `morning-standup.sh` | 09:00 daily | No | Hot leads + returns + overdue + todos |
| `evening-summary.sh` | 21:00 daily | No | 3-tab KPI digest + total revenue |
| `returns-reminder.sh` | hourly 09–21 | Yes | Returns due in next 3h |
| `overdue-alert.sh` | every 2h 09–21 | Yes | Overdue active rentals (severity emojis) |
| `qr-claim-watchdog.sh` | every 4h 09–21 | Yes | Unclaimed QRs > 17h old |
| `weekly-revenue.sh` | Mon 10:00 | No | 7-day revenue + breakdown + top-3 bikes |
| `supaplan-runner.sh` | every 30min 09–21 | Yes | Pick + claim SupaPlan task, notify |
| `lead-stuck-watchdog.sh` | every 4h 09–21 | Yes | Leads stuck in same stage (72h/48h/24h) |
| `revenue-anomaly.sh` | every 2h 13–21 | Yes | Today vs 7-day avg, alert if > 40% below |

---

## 7. Skill Routing Decision Tree

When the boss receives a request, here's the decision tree:

```
Operator asks...
│
├─ about LEADS / pipeline / "горячие" / dismiss / QR
│  └─► leads-crm-text
│
├─ about RENTALS today / returns / overdue / activate / KPIs / handoff / history
│  └─► rental-analytics-text
│
├─ about SALES / contracts / delivery / warranty
│  └─► sale-analytics-text
│
├─ about SERVICE / maintenance / mechanic / catalog
│  └─► service-analytics-text
│
├─ about a SPECIFIC RENTAL (deep-dive, docs, QR-claim)
│  └─► rental-card-text
│
├─ about BIKE CATALOG / pricing / availability
│  └─► franchize-catalog-text
│
├─ about CREW / members / shifts / roles
│  └─► crew-management-text
│
├─ about ADMIN config / prices / promo
│  └─► crew-admin-text
│
├─ about CREW PUBLIC INFO / contacts / about
│  └─► crew-info-text
│
├─ about LEADERBOARD / top clients
│  └─► leaderboard-text
│
├─ about CLIENT PROFILE / history / achievements
│  └─► rider-profile-text
│
├─ about REVIEWS / rating / moderation
│  └─► reviews-text
│
├─ about CONTRACT DRAFTS / approve / decline / STS
│  └─► contract-draft-text
│
├─ about ORDERS / checkout / invoices
│  └─► orders-checkout-text
│
├─ about DEPLOYMENT / VPS / git push / repo admin
│  └─► fk-pasha-admin (factory skill)
│
├─ about vip-bike.ru SITE content
│  └─► fk-site-admin (factory skill)
│
├─ about GENERATING .docx CONTRACTS
│  └─► fk-contract (factory skill)
│
├─ about PROMO VIDEO generation
│  └─► fk-video-gen (factory skill)
│
├─ about AVITO chats / leads
│  └─► avito-seller (factory skill)
│
├─ about AVITO listings / stats / balance
│  └─► avito-profile (factory skill)
│
└─ else: ask operator to clarify
```

---

## 8. How to Add a New Skill

1. Create `skills/<skill-name>/SKILL.md` with:
   - YAML frontmatter (`name`, `description` with trigger phrases)
   - Supabase access section (URL + key location + crew ID)
   - Commands section (one bash block per command)
   - Anti-hallucination section
   - Security section (PII masking, private schema headers)
   - Related files section
2. Add the skill to the routing table in `skills/vip-bike-ops/SKILL.md`
3. Add the skill to the decision tree in this catalog
4. (Optional) Add a boss command in `boss-commands/` if the skill should run on a schedule
5. Test with `--dry-run` (for boss commands) or direct curl (for leaf skills)
6. Push to GitHub

---

## 9. Anti-Hallucination Rules (apply to ALL skills)

1. NEVER invent IDs (rental_id, lead_id, user_id, sale_id, todo_id) — look them up first
2. NEVER invent prices, tariffs, bike specs — pull from `cars` table
3. NEVER invent statuses — only CHECK constraint values are valid
4. NEVER echo the Supabase service key
5. ALWAYS respond in Russian (unless operator wrote in English)
6. ALWAYS mask PII: phone `+7XXXXXXXX42`, passport `XXXX…1234`, email `i…@x.ru`
7. ALWAYS include web link at end of detail responses
8. ALWAYS end composite answers with "Что дальше?" suggestions
9. ALWAYS use `TZ=Europe/Moscow date` for "today" (never `date -u`)
10. ALWAYS use `Accept-Profile: private` header for private-schema tables
