Here is the improved `readme_wh.md`.

I have infused it with the high-energy **CyberVibe / XYUINITY** branding from the main README, added the "Vibe Coding" badges, and structured it to feel like an extension of the main ecosystem while keeping the specific Warehouse instructions clear.

```markdown
# 🏴‍☠️ WarehouseBot // CyberVibe WMS Protocol

[![License: CyberVibe v0.42](https://img.shields.io/badge/License-CyberVibe_v0.42-ff69b4.svg)](LICENSE)
[![Stack: Vercel+Supabase](https://img.shields.io/badge/Stack-Vercel_%2B_Supabase-black?logo=vercel&logoColor=white)](https://vercel.com)
[![Mode: Pirate](https://img.shields.io/badge/Mode-Pirate_Copy-red?style=for-the-badge&logo=skull-and-crossbones)](https://t.me/oneSitePlsBot)
![Cybervibe: WTF Certified](https://img.shields.io/badge/cybervibe-WTF%20Certified-%23efefef?style=for-the-badge&labelColor=232323&color=ff69b4)

<!-- XYUINITY ON TOP -->
<p align="center">
  <img src="https://github.com/user-attachments/assets/910a623e-1c9d-4630-a8b4-7c361565dc97" width="180" alt="Xuinity logo"/>
</p>

> **"Marketplaces were milking us like cows. We built a pirate ship to fight back."**
>
> WarehouseBot is a **Vibe-Coded** Warehouse Management System (WMS) designed to execute e-commerce operations with military precision and arcade-game engagement.

---

## 🧬 WHAT IS THIS?

This is **Module: WAREHOUSE** of the [CyberVibe Studio](https://github.com/salavey13/carTest) ecosystem.

It is a direct assault on bloated, expensive enterprise software (13k+ RUB/mo). We stripped the corporate garbage and left only what prints money and saves time:

*   **Mobile-First Command Deck:** Run your entire logistics operation from a Telegram Mini App.
*   **Gamified Labor:** Staff earn XP, streaks, and bounties for `onload`/`offload` tasks. High score = High salary.
*   **Ghost Stock Killer:** Real-time API sync with Wildberries, Ozon, and Yandex Market. Zero fines.
*   **Crew Architecture:** Multi-warehouse support with role-based access control (Owner, Manager, Worker).

---

## 🚦 QUICKSTART (The Pirate Path)

You can deploy this 100% free using the Vercel + Supabase + Telegram stack.

### 1. Fork & Vibe
Go to the repo and click **Fork**. This creates your own instance of the system.

### 2. Database Injection (Supabase)
1.  Create a project at [Supabase.com](https://supabase.com).
2.  Go to **SQL Editor**.
3.  Copy/Paste the migration script below to initialize the `crews`, `shifts`, and `cars` tables.

<details>
<summary>📜 <strong>Click to view SQL Migration Script</strong></summary>

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. USERS (The Crew)
create table public.users (
  user_id text primary key, -- Telegram ID
  username text,
  full_name text,
  role text default 'user',
  status text default 'active',
  language_code text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. CREWS (The Warehouses)
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
  role text default 'staff',
  membership_status text default 'active',
  live_status text,
  joined_at timestamptz default now(),
  unique(crew_id, user_id)
);

-- 4. ITEMS (Inventory/Cars)
create table public.cars (
  id text primary key, -- SKU or Barcode
  crew_id uuid references public.crews(id),
  make text, -- Brand
  model text, -- Name
  type text default 'wb_item',
  specs jsonb default '{}'::jsonb, -- { warehouse_locations: [{voxel: 'A1', qty: 5}] }
  image_url text,
  created_at timestamptz default now()
);

-- 5. SHIFTS (Gamified Time Tracking)
create table public.crew_member_shifts (
  id uuid default uuid_generate_v4() primary key,
  crew_id uuid references public.crews(id),
  member_id text references public.users(user_id),
  clock_in_time timestamptz default now(),
  clock_out_time timestamptz,
  actions jsonb default '[]'::jsonb, -- Log of scans/XP
  checkpoint jsonb default '{}'::jsonb
);

-- 6. INVOICES (The Treasure)
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

### 3. Bot Authorization
1.  Talk to [@BotFather](https://t.me/BotFather).
2.  Create a new bot.
3.  Save the API Token.

### 4. Deploy to Vercel
Import your forked repo to Vercel and set these Environment Variables:

```env
# Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-Def...
ADMIN_CHAT_ID=your-telegram-id

# Core Config
NEXT_PUBLIC_BASE_URL=https://your-project.vercel.app
NEXT_PUBLIC_DEBUG=0
```

### 5. Link the Webhook
Connect your bot to your Vercel deployment:
```bash
curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_VERCEL_DOMAIN>/api/telegramWebhook
```

---

## 🤖 THE VIBE CODING PHILOSOPHY

This isn't just software. It's a methodology.

1.  **AI as Architect:** Large portions of this system were synthesized by AI under the guidance of the **CyberVibe Master Prompt**.
2.  **Leaf Node Focus:** We isolate risk in features so we can move fast without breaking the core.
3.  **Verifiability:** Inputs and outputs are designed for human auditability. We trust the AI, but we verify the loot.

---

## 💸 "I DON'T WANT TO CODE, I WANT TO SELL"

Does the terminal scare you? Do you value your time more than digging through SQL?

**I will deploy the entire Pirate Ship for you.**

*   **Price:** 10,000 RUB (One-time fee).
*   **Included:** Full Server Setup, Bot Configuration, Marketplace Integration, and a 2-hour Masterclass for you and your crew.

**👉 Contact the Captain: [@salavey13](https://t.me/salavey13)**

---

## 🔥 JOIN THE TRIBE

- [CYBERVIBE Studio Main Repo](https://github.com/salavey13/carTest)
- [Telegram Entrypoint](https://t.me/oneSitePlsBot)
- [Full Contribution Guide](https://github.com/salavey13/carTest/blob/main/README.md#contributing)

<p align="center" style="font-size:1.2em">
  <b>Ready?</b>
  <br />
  <i>Stop paying fines. Start playing the game.</i>
</p>
```
