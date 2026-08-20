# Skills Inventory — VIP Bike / CarTest

> Complete catalog of all skills available in the repo. Organized by category.
> Updated 2026-08-20. Total: 90+ skills.
> Your dev friend can use this to identify which skills to port to .NET.

---

## 🏍️ VIP-Bike-Specific Skills (Text-Based Telegram Bot Skills)

These are the core business skills for the VIP Bike motorcycle rental operation. They query Supabase REST API directly (via curl) and output formatted text. Each has a SKILL.md with trigger phrases, Supabase access patterns, and report formats.

### Rental Lifecycle

| Skill | Trigger phrases | What it does | .NET port priority |
|---|---|---|---|
| **rental-ops-text** | "продли аренду", "закрой аренду", "список аренд", "просроченные аренды", "возвраты сегодня", "детали аренды", "карточка аренды", "статус аренды" | Extend, close, list, find overdue, see today's returns, show rental detail card | ⭐⭐⭐ HIGH — core rental ops |
| **rental-card-text** | "карточка аренды", "детали аренды" | Show one rental: status, dates, renter, bike, deposit, contract, photos, todos | ⭐⭐⭐ HIGH |
| **rental-analytics-text** | "аналитика аренд", "дашборд аренд" | Mirrors v2 web dashboard: revenue, utilization, trends, comparisons | ⭐⭐ MEDIUM |
| **rental-contract-from-photos** | "договор по фото", "сделай контракт" | Generate rental/sale contract DOCX from passport/license photos via OCR | ⭐⭐ MEDIUM |
| **extract-rental-info** | (internal) | Extract structured rental data from text/images | ⭐ LOW |

### Equipment & Catalog

| Skill | Trigger phrases | What it does | .NET port priority |
|---|---|---|---|
| **franchize-catalog-text** | "каталог", "показать байки", "цены" | Query bikes, equipment, pricing, availability via Supabase REST | ⭐⭐⭐ HIGH |
| **catalog-adder-text** | "добавь байк", "новый каталог" | Add new bikes/services/sale-items to catalog (public.cars table) | ⭐⭐ MEDIUM |
| **catalog-csv-exporter** | "экспорт каталога" | Export catalog from Supabase to clean compact CSV (rent + sale tabs) | ⭐⭐ MEDIUM |
| **service-work-text** | "запиши работу", "добавь услугу" | Log performed service work + add service items to catalog | ⭐⭐ MEDIUM |

### Orders & Sales

| Skill | Trigger phrases | What it does | .NET port priority |
|---|---|---|---|
| **orders-checkout-text** | "заказы", "корзина", "оформление" | List orders, cart state, checkout flow, pending/abandoned carts | ⭐⭐ MEDIUM |
| **sale-analytics-text** | "аналитика продаж", "дашборд продаж" | Sales analytics: revenue, items sold, trends | ⭐⭐ MEDIUM |
| **bulk-sale-pdf** | "прайс лист", "каталог PDF" | Generate bulk sale price list PDF from catalog | ⭐ LOW |

### Leads CRM

| Skill | Trigger phrases | What it does | .NET port priority |
|---|---|---|---|
| **leads-crm-text** | "лиды", "заявки", "воронка" | CRM leads dashboard: pipeline, statuses, conversion, operator assignment | ⭐⭐⭐ HIGH — **directly relevant to your friend's "save new leads" use case** |
| **pricing-quote-text** | "цена аренды", "прайс", "стоимость" | Instant rental price quotes: daily/hourly, weekday/weekend, tiers | ⭐⭐ MEDIUM |

### Deposits & Payments

| Skill | Trigger phrases | What it does | .NET port priority |
|---|---|---|---|
| **deposit-tracer-text** | "где депозиты", "баланс карт", "сколько на картах" | Trace deposit states across cash, T-Bank card, Sber card. Lists collected/returned/penalty per destination | ⭐⭐⭐ HIGH |
| **deposit-tracker-text** | "возврат залога", "депозит статус" | Track rental deposits: collected? returned? cash or transfer? Auto-flag unreturned | ⭐⭐⭐ HIGH |

### Crew Management

| Skill | Trigger phrases | What it does | .NET port priority |
|---|---|---|---|
| **crew-management-text** | "экипаж", "участники", "кто на смене" | List members, roles, live status, todos, invite links | ⭐⭐ MEDIUM |
| **crew-admin-text** | "настройки экипажа", "админка" | Manage crew settings, catalog prices, promotions, theme | ⭐⭐ MEDIUM |
| **crew-info-text** | "информация экипажа", "контакты" | Show public crew info: name, description, logo, contacts, map | ⭐ LOW |
| **crew-customization-text** | "кастомизация", "тема экипажа" | Customize crew config + contract defaults via Node script | ⭐ LOW |

### Shifts & Workforce

| Skill | Trigger phrases | What it does | .NET port priority |
|---|---|---|---|
| **shift-tracker-text** | "смены", "кто на смене", "зарплата за смены", "вечерний отчёт смен", "сколько отработано" | Active/completed shifts, salary calc on the fly, per-member evening digest | ⭐⭐⭐ HIGH — **per-member earnings for payouts** |
| **leaderboard-text** | "лидерборд", "топ райдеров", "топ операторов" | Top renters, top operators, most rented bikes | ⭐ LOW |

### Reviews & Profiles

| Skill | Trigger phrases | What it does | .NET port priority |
|---|---|---|---|
| **reviews-text** | "отзывы", "рейтинг" | List rental reviews, ratings, comments, moderation | ⭐ LOW |
| **rider-profile-text** | "профиль райдера", "информация клиента" | Show rider: identity, contacts, rental history, crew memberships | ⭐⭐ MEDIUM |

### Documents & PDFs

| Skill | Trigger phrases | What it does | .NET port priority |
|---|---|---|---|
| **contract-draft-text** | "договор аренды", "драфт контракта", "одобрить контракт", "STS pledge" | Contract artifacts: draft state, approval flow, STS pledge info, storage path | ⭐⭐ MEDIUM |
| **commercial-proposal-from-offer** | "коммерческое предложение" | Generate commercial proposal from an offer | ⭐ LOW |
| **pdf-bike-sheet-on-demand** | "прайс байка", "карточка байка PDF" | Generate single-bike "buy sheet" PDF on demand | ⭐ LOW |
| **send-document-by-email** | "пришли на почту", "на email", "send by email" | Send .docx/.pdf as email attachment via SMTP (mail.ru/Yandex/Gmail) | ⭐⭐ MEDIUM |
| **qr-deeplink-on-demand** | "QR код", "диплинк" | Generate QR codes for Telegram WebApp deep links | ⭐ LOW |

### Analytics & Reports

| Skill | Trigger phrases | What it does | .NET port priority |
|---|---|---|---|
| **analytics-text** | "аналитика", "дашборд", "отчёт" | Text-based analytics dashboards: revenue, utilization, trends | ⭐⭐ MEDIUM |
| **testdrive-analytics-text** | "аналитика тест-драйвов", "конверсия" | Test-drive KPIs, conversion to rentals | ⭐ LOW |
| **service-analytics-text** | "аналитика услуг", "работы" | Service analytics: revenue per service, most performed | ⭐ LOW |
| **rentals-csv-exporter** | "экспорт аренд" | Export active rentals from Supabase to CSV | ⭐⭐ MEDIUM |

### Infrastructure

| Skill | What it does | .NET port priority |
|---|---|---|
| **vip-bike-ops** | Umbrella skill router: 19 text skills, routing, allowlist | ⭐⭐ MEDIUM — routing layer |
| **supaplan-csv** | SupaPlan CSV skill for database migration planning | ⭐ LOW |
| **supaplan-supabase-operator** | SupaPlan operator protocol for Supabase migrations | ⭐ LOW |
| **quest-chain-generator** | Quest chain generator with callback-auto, agent-safe statuses | ⭐ LOW |
| **franchize-click-smoke** | Click smoke test for franchize pages | ⭐ LOW |

---

## 🔧 General-Purpose Skills (Not VIP-Bike Specific)

These are generic Z.ai skills. Your assistant bot correctly identified ~80 of these as "мусор" (irrelevant) for the VIP Bike bot — they're from a mass import (commit b08218a) and include Chinese college entrance exam tools, academic search, quiz generators, etc.

### AI/Media Processing

| Skill | What it does |
|---|---|
| **ASR** | Speech-to-text (automatic speech recognition) |
| **LLM** | Large language model chat completions |
| **TTS** | Text-to-speech (natural voice generation) |
| **VLM** | Vision-based AI chat (image understanding) |
| **image-generation** | AI image generation from text descriptions |
| **image-edit** | AI image editing and modification |
| **image-search** | Web image search service |
| **image-understand** | Image analysis and description |
| **video-generation** | AI video generation |
| **video-understand** | Video content analysis |
| **web-search** | Web search capabilities |
| **web-reader** | Web page content extraction |

### Development Tools

| Skill | What it does |
|---|---|
| **fullstack-dev** | Full-stack Next.js 16 development |
| **coding-agent** | General-purpose coding agent |
| **agent-browser** | Headless browser automation |
| **github-fetcher** | Fetch files from GitHub repos |
| **pull-request** | Create and manage GitHub PRs |
| **concat-files** | Bundle multiple files into one |
| **version-management** | Version management for projects |
| **charts** | Professional chart/diagram creation |

### Document Creation

| Skill | What it does |
|---|---|
| **pdf** | Professional PDF toolkit (reports, posters, resumes) |
| **docx** | Word document creation/editing |
| **xlsx** | Excel spreadsheet creation |
| **pptx** | PowerPoint presentation creation |

### Productivity & Research

| Skill | What it does |
|---|---|
| **multi-search-engine** | Multi-engine web search |
| **research-explorer** | Research topic exploration |
| **literature-survey** | Academic literature survey |
| **market-research-reports** | Market research report generation |
| **content-strategy** | Content strategy planning |
| **seo-content-writer** | SEO-optimized content writing |
| **blog-writer** | Blog article generation |
| **podcast-generate** | Podcast script generation |

### Other

| Skill | What it does |
|---|---|
| **skill-creator** | Create new skills |
| **skill-finder-cn** | Find and install skills (Chinese) |
| **task-review** | Review completed tasks for skill creation |
| **boss-mode** | Boss mode installer |
| **boss-self-improve** | Self-improving boss agent |
| **codex-bridge-operator** | Codex bridge for Slack integration |
| **design** | Visual design foundations |
| **ui-ux-pro-max** | UI/UX design skill |
| **stock-analysis-skill** | Stock market analysis |
| **finance** | Financial analysis tools |
| **homework-ocr-intake** | Homework OCR intake |
| **homework-pdf-rag-runtime** | PDF RAG for homework |
| **homework-solution-store-supabase** | Store homework solutions |
| **cheat-sheet** | Generate cheat sheets |
| **experiment-suite** | Experiment management |
| **gift-evaluator** | Gift evaluation tool |
| **dream-interpreter** | Dream interpretation |
| **get-fortune-analysis** | Fortune analysis |
| **mindfulness-meditation** | Mindfulness meditation |
| **interview-designer** | Interview design |
| **interview-prep** | Interview preparation |
| **jd-resume-tailor** | Resume tailoring for job descriptions |
| **job-intent-tracker** | Job application tracking |
| **resume-builder** | Resume builder |
| **storyboard-manager** | Storyboard management |
| **study-buddy** | Study assistant |
| **writing-plans** | Writing plan generation |
| **marketing-mode** | Marketing mode skill |
| **visual-design-foundations** | Visual design foundations |
| **web-shader-extractor** | Web shader extraction |
| **contentanalysis** | Content analysis |
| **auto-target-tracker** | Auto target tracking |
| **ai-news-collectors** | AI news collection |
| **anti-pua** | Anti-PUA (detect manipulation) |
| **qingyan-research** | Research tool |
| **quest-chain-generator** | Quest chain generator |

### Chinese Education (from mass import — irrelevant to VIP Bike)

| Skill | What it does |
|---|---|
| **gaokao-collect-student-info** | Chinese college entrance exam: student info collection |
| **gaokao-fetch-volunteers** | Fetch volunteer recommendations |
| **gaokao-generate-report** | Generate college application report |
| **gaokao-recommend-majors** | Recommend majors |
| **gaokao-recommend-schools** | Recommend schools |
| **aminer-academic-search** | Academic paper search |
| **aminer-daily-paper** | Daily paper digest |
| **aminer-deep-search** | Deep academic search |
| **aminer-free-academic** | Free academic search |
| **quiz-html** | HTML quiz generator |
| **quiz-mastery** | Quiz mastery tool |

---

## .NET Porting Recommendations

For your dev friend who wants to port skills to .NET (especially for saving new leads):

### Tier 1 — Port First (Core Business Logic)

1. **leads-crm-text** — Lead CRM pipeline, statuses, conversion, operator assignment. **Directly answers the "save new leads" use case.** Queries `franchize_intents` table in Supabase.
2. **rental-ops-text** — Rental lifecycle: create, extend, close, list, find overdue. Queries `rentals` table.
3. **shift-tracker-text** — Shift tracking + per-member salary calculation. Queries `crew_member_shifts` table.
4. **deposit-tracer-text** — Deposit flow tracking across cash/bank cards. Queries `deposit_entries` table.
5. **franchize-catalog-text** — Catalog query: bikes, equipment, pricing, availability. Queries `cars` table.

### Tier 2 — Port Second (Analytics & Reports)

6. **rental-analytics-text** — Revenue, utilization, trends.
7. **analytics-text** — General analytics dashboard.
8. **pricing-quote-text** — Price calculation engine.
9. **rentals-csv-exporter** — CSV export (simple REST query → CSV format).

### Tier 3 — Port If Needed (Documents & Admin)

10. **contract-draft-text** — Contract artifact management.
11. **crew-admin-text** — Crew settings management.
12. **send-document-by-email** — Email delivery (SMTP in .NET is straightforward).

### Key Supabase Tables for .NET Integration

```sql
-- Leads
SELECT * FROM franchize_intents WHERE crew_id = $crewId;

-- Rentals  
SELECT * FROM rentals WHERE crew_id = $crewId;

-- Shifts
SELECT * FROM crew_member_shifts WHERE crew_id = $crewId;

-- Deposits
SELECT * FROM deposit_entries WHERE rental_id IN (
  SELECT rental_id FROM rentals WHERE crew_id = $crewId
);

-- Catalog
SELECT * FROM cars WHERE crew_id = $crewId AND type IN ('bike', 'equipment', 'service');
```

All queries use the Supabase REST API (PostgREST), which works identically from .NET via `HttpClient`.

---

## About the Assistant Bot's "~80 generic skills" Comment

Your assistant bot was correct! The `skills/` directory contains ~90 skills total. Of those:

- **~25 are VIP-Bike-specific** (the `*-text` skills listed in the first section above)
- **~65 are generic Z.ai skills** (image generation, PDF creation, coding agent, Chinese exam tools, etc.)

The generic skills came from a **mass import** (commit b08218a) that bulk-installed many Z.ai platform skills into the repo. They're useful for a general-purpose AI assistant but irrelevant to the VIP Bike motorcycle rental bot. Your assistant bot correctly identified them as "мусор" (junk) for this specific use case and only installed the VIP-Bike-specific skills.

The generic skills include things like:
- `gaokao-*` (Chinese college entrance exam — clearly irrelevant to a motorcycle rental)
- `aminer-*` (academic paper search)
- `quiz-*` (quiz generators)
- `homework-*` (homework OCR)
- `interview-*` (interview prep)
- `resume-*` (resume building)
- `stock-analysis-skill` (stock market analysis)
- `mindfulness-meditation`
- `dream-interpreter`

These are all legitimate skills in the Z.ai ecosystem, just not useful for running a motorcycle rental business. Your assistant bot made the right call.

---

**Document End**
