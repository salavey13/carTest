# 🏴‍☠️ WarehouseBot (CyberVibe WMS)

**Stop paying for air. Start managing chaos.**

> "Marketplaces were milking us like cows until we started playing differently. This is the story of how warehouse chaos turned into a manageable beast."

**WarehouseBot** is a Telegram-first Warehouse Management System (WMS) built for e-commerce sellers (Wildberries, Ozon, Yandex Market). It strips away the bloat of enterprise ERPs (13k+ RUB/mo) and gives you exactly what you need: speed, gamification for staff, and zero-bullshit inventory tracking.

---

## ⚡ Features

*   **Mobile-First:** 100% functional via Telegram Web App (TWA). No heavy laptops required.
*   **Gamified Workflow:** Staff earn XP/Streaks for accurate scanning (`onload`/`offload`).
*   **Shift Management:** Auto-payroll calculation based on operations count.
*   **Marketplace Sync:** Real-time stock updates to WB/Ozon/YM to kill fines.
*   **Crew Architecture:** Multi-warehouse support with role-based access.
*   **Audit & Analytics:** "Pirate Copy" your competitor's efficiency with built-in audit tools.

---

## 🛠 Deployment Guide (The DIY Path)

You can deploy this completely free using the Vercel + Supabase + Telegram stack.

### 1. Fork the Repo
Go to [github.com/salavey13/cartest](https://github.com/salavey13/cartest) and click **Fork**. This creates your own copy of the pirate ship.

### 2. Set up Supabase (Database)
1.  Create a new project at [Supabase.com](https://supabase.com).
2.  Go to **Settings -> API** and copy your `URL`, `anon public` key, and `service_role` key.
3.  Go to **SQL Editor** and run the migration script below to set up your tables.

<details>
<summary>📜 <strong>Click to view SQL Migration Script</strong></summary>

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. USERS
create table public.users (
  user_id text primary key, -- Telegram ID
  username text,
  full_name text,
  role text default 'user', -- 'admin', 'user', 'support'
  status text default 'active',
  language_code text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. CREWS (Warehouses)
create table public.crews (
  id uuid default uuid_generate_v4() primary key,
  slug text unique not null,
  name text not null,
  description text,
  logo_url text,
  owner_id text references public.users(user_id),
  hq_location text,
  created_at timestamptz default now()
);

-- 3. CREW MEMBERS
create table public.crew_members (
  id uuid default uuid_generate_v4() primary key,
  crew_id uuid references public.crews(id),
  user_id text references public.users(user_id),
  role text default 'staff', -- 'owner', 'manager', 'staff'
  membership_status text default 'active',
  live_status text,
  joined_at timestamptz default now(),
  unique(crew_id, user_id)
);

-- 4. ITEMS (Cars/Inventory)
create table public.cars (
  id text primary key, -- SKU or Barcode
  crew_id uuid references public.crews(id),
  make text, -- Brand
  model text, -- Name
  type text default 'wb_item',
  specs jsonb default '{}'::jsonb, -- Stores locations: { warehouse_locations: [{voxel: 'A1', qty: 5}] }
  daily_price numeric default 0, -- Used for internal value
  image_url text,
  status text default 'available',
  created_at timestamptz default now()
);

-- 5. SHIFTS (Time tracking)
create table public.crew_member_shifts (
  id uuid default uuid_generate_v4() primary key,
  crew_id uuid references public.crews(id),
  member_id text references public.users(user_id),
  clock_in_time timestamptz default now(),
  clock_out_time timestamptz,
  actions jsonb default '[]'::jsonb, -- Log of scans
  checkpoint jsonb default '{}'::jsonb
);

-- 6. INVOICES & PAYMENTS
create table public.invoices (
  id text primary key,
  user_id text references public.users(user_id),
  amount numeric not null,
  status text default 'pending',
  type text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```
</details>

### 3. Set up Telegram Bot
1.  Talk to [@BotFather](https://t.me/BotFather) on Telegram.
2.  Create a new bot (`/newbot`).
3.  Copy the **HTTP API Token**.

### 4. Deploy to Vercel
1.  Go to [Vercel.com](https://vercel.com) and "Add New Project".
2.  Import your forked Git repository.
3.  **IMPORTANT:** Configure the Environment Variables in Vercel settings.

#### Required Environment Variables

```env
# Supabase Keys
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Telegram Config
TELEGRAM_BOT_TOKEN=123456:ABC-Def...
ADMIN_CHAT_ID=your-telegram-id

# App Config
NEXT_PUBLIC_BASE_URL=https://your-project.vercel.app
NEXT_PUBLIC_DEBUG=0

# Optional (AI Features)
COZE_API_KEY=your-coze-key
COZE_BOT_ID=your-bot-id
```

#### Marketplace Variables (Dynamic)
*Note: These are usually set per-crew in the database, but can be set globally for single-tenant deployments.*
*   `WB_API_TOKEN_[SLUG]`
*   `OZON_API_KEY_[SLUG]`
*   `YM_API_TOKEN_[SLUG]`

### 5. Connect Webhook
After Vercel deploys, set your bot's webhook to your new URL. You can use a simple browser call or `curl`:

```bash
curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_VERCEL_DOMAIN>/api/telegramWebhook
```

---

## 💸 Don't want to touch code?

Does the terminal scare you? Do you value your time more than digging through SQL migrations?

**I will configure everything for you.**

*   **Price:** 10,000 RUB (One-time fee).
*   **What you get:**
    *   Full server setup (Vercel/Supabase).
    *   Bot configuration.
    *   Marketplace API integration (WB/Ozon/YM).
    *   2-hour onboarding/training for you (the owner).
    *   30 days of "it just works" guarantee.

**👉 Contact me: [@salavey13](https://t.me/salavey13)**

---

## 🤖 The "Vibe Coding" Philosophy

This project was built using **Vibe Coding**:
1.  **Focus on Leaf Nodes:** We isolate risk in UI/Features.
2.  **Design for Verifiability:** Systems are built to be checked by humans easily.
3.  **AI as Architect:** Large portions of this codebase were synthesized by AI under strict architectural guidance.

---

## 📜 License

MIT License. Use it, fork it, sell it. Just don't blame us if you create a Skynet for cardboard boxes.

*Powered by [CyberVibe](https://t.me/oneBikePlsBot)*
