# START HERE — CARTEST FRANCHIZE PLATFORM

> **Telegram-first product studio on Next.js + Supabase**
> **Working directory:** `C:\Users\SLY13\carTest`

---

## 1. What This Project Is

**VipBike Franchize Platform** — A franchise management system for bike rental/sales operations with three surfaces:
- **Telegram Bot** (`@oneBikePlsBot`) — Contract generation, equipment tracking, operator commands
- **Web App** (`/franchize/{slug}`) — Catalog, rentals, leads, analytics for crew operators
- **Admin APIs** — Deposit tracking, photo management, crew operations

**Tech Stack:**
- Next.js (App Router) + React + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres, Auth, Storage, RLS)
- Telegram Bot API + WebApp integration

---

## 2. Quick Start (5 minutes)

```bash
cd C:\Users\SLY13\carTest

# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test                    # Vitest unit tests
npm run test:e2e           # Playwright E2E tests
npm run qa:map-riders      # Franchize module QA
```

**Environment Variables Required:**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`, `ADMIN_CHAT_ID`
- `GITHUB_TOKEN`, `GEMINI_API_KEY`, `NEXT_PUBLIC_SITE_URL`
- Slack: `SLACK_BOT_TOKEN` + `SLACK_CODEX_CHANNEL_ID` OR `SLACK_INCOMING_WEBHOOK_URL`

**Test verification:**
```bash
npm test                    # Expected: all tests pass
```

---

## 3. Key Architecture Facts

### Authentication
**Custom Telegram auth, NOT Supabase Auth.**
- User identity = `chat_id` from Telegram, stored in `users` table
- Private schema tables: `user_rental_secrets`, `crew_secrets`
- RLS uses `auth.jwt() ->> 'chat_id'` (TEXT), NOT `auth.uid()` (UUID)

### Database Access
- **Server:** `supabaseAdmin` with `SUPABASE_SERVICE_ROLE_KEY`
- **Client:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` with RLS
- **Private schema:** `privateSchema()` helper for restricted tables

### Key Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | Telegram users | `user_id TEXT PK`, `metadata JSONB` |
| `rentals` | Bike/equipment rentals | `rental_id UUID PK`, `rental_id→rentals`, `status`, `metadata JSONB` |
| `crew_todos` | Operator tasks | `id UUID PK`, `rental_id→rentals`, `category`, `status` |
| `franchize_intents` | Lead tracking | `id UUID PK`, `telegram_user_id`, `stage`, `intent_type` |
| `deposit_entries` | Deposit ledger | `rental_id`, `entry_type`, `amount`, `destination` |
| `rental_photos` | Rental photos | `rental_id`, `storage_path`, `sha256` |

### Important Rules
1. **Never expose `SUPABASE_SERVICE_ROLE_KEY` client-side**
2. **Prefer additive, reversible changes** — don't delete, deprecate
3. **Validate AI-generated JSON** — surface precise parse errors
4. **Use existing skills/scripts** before improvising

---

## 4. Project Structure

```
carTest/
├── app/
│   ├── api/                      # API routes (Telegram webhook, Codex bridge, etc.)
│   ├── franchize/
│   │   ├── [slug]/              # Franchise module (multi-tenant)
│   │   │   ├── leads/           # Leads page (kanban stages)
│   │   │   ├── rentals/         # Rentals list page
│   │   │   ├── rental/[id]/     # Rental detail page
│   │   │   └── rentals-analytics/ # Analytics dashboard
│   │   ├── components/          # Shared franchize components
│   │   ├── server-actions/      # Server actions (leads, rentals, todos)
│   │   ├── lib/                 # Franchize utilities
│   │   └── actions.ts           # Public actions
│   ├── webhook-handlers/
│   │   └── commands/            # Telegram bot commands (/doc, /start, etc.)
│   └── actions.ts               # Root server actions
├── components/                   # Shared React components
├── contexts/                     # React context providers
├── lib/                          # Shared utilities
├── scripts/                      # Helper scripts (testing, notifications, screenshots)
├── skills/                       # Agent skill definitions
├── supabase/migrations/          # SQL migrations (apply in order)
└── tests/                        # Vitest + Playwright tests
```

---

## 5. What to Read Next

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project instructions for Claude Code agents |
| `README.MD` | Full project setup and operations guide |
| `docs/README_TLDR.md` | Quick reference for common operations |
| `AGENTS.md` | Agent operating guide with triggers and prohibitions |
| `CODEREVIEW_LEADS_RENTALS.md` | Latest code review findings (accessories/todos duplication — **fixed**) |
| `docs/META_PRD_ITERATIVE_IMPLEMENTATION_PLAN.md` | Coordination across 4 PRDs (deposit, doc-manual, photos, services) |
| `docs/FRANCHIZE_SERVICE_OPERATIONS_PRD.md` | Services PRD v4.1 (I5 — ready for implementation) |
| `PLAN-I5-SERVICE-OPERATIONS.md` | I5 wave orchestration (teams, contract, gates) |
| `docs/superpowers/plans/` | I5 task plans broken into tasks with ready tests — бери и делай по шагам |
| `docs/RENTAL_PHOTO_UPLOAD_PRD.md` | Photo upload PRD v1.3 (shipped) |

---

## 6. Current Status (2026-08-12)

**Recently Shipped (I1-I4):**
- ✅ Deposit trigger idempotency fix (`20260811000000_deposit_trigger_double_return_guard.sql`)
- ✅ Deposit visibility + penalty capture UI
- ✅ Rental photos MVP + retention cron + unit tests
- ✅ Doc-manual step correction + sale delivery
- ✅ Accessories/todos dedup — `crew_todos` is single source of truth; rentals page shows pending todos (`5437369e`)

**Shipped (I5, 2026-08-12):**
- ✅ **Equipment rentals** — Standalone equipment (helmets/jackets/gloves/boots) with table, UI, doc-manual integration
- ✅ **Cash ledger** — Unified cash_transactions table + triggers (idempotent I1 pattern) + backfill
- ✅ **Commissions** — Configurable rates per operation (percentage/fixed), default 10% rental_hourly
- ✅ **Salary** — Plans, calculations, payouts, "My Earnings"/"My Work" profile sections
- ✅ **8 migrations** — `20260812000001-20260812` (equipment, cash, commissions, salary, triggers, backfill)
- ✅ **4 commits pushed** — `feat/i5-service-operations` → ready for merge

**See `CODEREVIEW_LEADS_RENTALS.md` for details.**

---

## 7. Common Commands

```bash
# Development
npm run dev                  # Start dev server
npm run build                # Build for production
npm run start                # Start production server
npm run lint                 # Run ESLint

# Testing
npm test                     # Run Vitest unit tests
npm run test:ui              # Vitest UI
npm run test:e2e             # Playwright E2E tests
npm run qa:map-riders        # Map-riders feature QA
npm run qa:franchize         # Franchize module QA

# SupaPlan (agent task system)
npm run supaplan:skill node scripts/supaplan-skill.mjs inspect-migrations
node scripts/supaplan-skill.mjs pick-task --capability <capability> --agentId <id>

# Notifications
npm run notify:callback node scripts/codex-notify.mjs callback ...
npm run notify:telegram node scripts/codex-notify.mjs telegram ...
```

---

## 8. Git Workflow

```bash
# Create feature branch
git checkout -b feat/<what>

# Make changes
git add .
git commit -m "feat: <description>"

# Push and create PR
git push origin feat/<what>
```

**PR Title Format:** Use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`)

---

## 9. Important Notes

- **This repo has NO `.env` file** — Environment variables are managed separately
- **Do NOT commit:** `.env`, `node_modules/`, `.next/`, secrets, QA screenshots
- **Branches:** Work in `feat/*` or `fix/*`, merge to `main` via PR
- **Migrations:** Apply in order, minimum migrations: `20240101000000_init.sql`, `20260304_private_scheme.sql`, `20260508090000_repair_private_crew_secrets.sql`

---

## 10. Support

For questions or issues:
1. Check `CLAUDE.md` and `README.MD` first
2. Review relevant PRD in `docs/`
3. Check recent commits for context
4. Ask in project channel

---

**Last Updated:** 2026-08-12
**Status:** ✅ Active development — I5 (services) wave planned, Этап 1 ready to start
