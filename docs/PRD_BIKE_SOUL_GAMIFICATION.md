# PRD: «BikeSoul» — Bikes as Pets 🏍️💗

## A gamification layer for the bike wall: levels, moods, duels, seasons, work digests

| | |
|---|---|
| **Codename** | BikeSoul (Души мото) |
| **Status** | Draft v1.1 — polished for review |
| **Date** | 2026-09-01 |
| **Iteration** | 29 (vision) → rollout iters 30–36 |
| **Builds on** | iter28 «Мотопарк» wall (shipped, commit `86705f55c`), iter27 money discipline, iter25 money split engine |
| **Author** | Product, from the owner's tamagotchi / Pokémon / «на Луну» idea |
| **Related** | `docs/FRANCHIZE_METADATA_CONTRACT.md`, `docs/analytics_redesign_PRD.md`, `app/franchize/lib/bike-wall.ts` |

---

## 0. TL;DR

> **Origin note.** This started as banter — tamagotchi, Pokémon battles, «пусть самые крутые летят на Луну». We are building it anyway, with full engineering discipline, because the joke pointed at something real: the cheapest known lever for daily engagement, pointed at idle motorcycles. The discipline exists so the joke can be dropped cheaply: display-only, metric-gated, one money engine, no permanent deletes. If the numbers don't move after iter32, we stop.

We already shipped a **VK-style wall for bikes** (iter28): every rental and service job is a feed post with real photos, money, kilometres and odometer story. It did something no fleet dashboard does: **gave each bike a biography**.

This PRD adds a **character layer** on top of that biography. Every bike becomes a pet / character:

- It **grows** — XP and levels from rentals, revenue, kilometres, perfect returns; evolution stages from «Пони» to «Легенда Гаража».
- It **feels** — a tamagotchi mood layer driven by service freshness, idle days and utilization («скучает», «спит», «на больничном»).
- It **competes** — weekly 1v1 bike battles, monthly leaderboards, seasons with Hall of Fame.
- It **works** — work-to-earn digests: «Твой BMW F800R вчера заработал 6 500 ₽», streaks, monthly salary sheets per bike.
- It **travels** — bike swaps between subrenters and cities, «отпуск для мото», with wall postcards.
- It **can go to the Moon** — the annual Bike of the Year program: trophy plate, golden wall skin, shareable year card.

**The one rule that governs everything: gamification is display-only. It never touches real money math.** Earnings, splits, deposits and salary stay computed by the exact same engines as today (`computePartnerSplit`, iter27 rules). Souls, XP and moods are a *lens* on that truth, never a second source of it.

**Why we believe it works:** the fleet's #1 business lever is **utilization** (idle bikes = dead capital), and the #1 human lever is **subrenter attachment** (partners who *love* their bike don't pull it from the fleet). Pet-game mechanics are a proven way to make humans check on something daily. We are pointing that psychology at idle motorcycles — and measuring whether it moves the needle (§3), so this is a hypothesis with a kill date, not a faith.

---

## 1. Background — what we just shipped (the foundation)

Iter28 delivered, live on the vip-bike crew:

- **`/franchize/{slug}/bikes`** — fleet index: photo cards, per-bike revenue / rentals / service stats, partner badges, on-rent pulse, sort pills.
- **`/franchize/{slug}/bikes/{id}`** — the bike's story: hero photo, KPI band (all-time earnings, month, avg check, days in rent, km, odometer, service spend), and a chronological VK-style wall with date dividers («Сегодня», «Вчера»), VK photo-grid rules (1 full / 2 squares / 3 row / 4+ with «+N»), lightbox, and service work cards via the `metadata.bike` linkage discovery.
- **Access**: owner / admin / co_owner / member see all; subrenter sees his bikes only; analytics password auth works too.
- **Money discipline**: cancelled rentals render crossed-out, worth ₽ 0, never counted anywhere (iter27).

### 1.1 Live baseline (vip-bike, 2026-08-30)

| Metric | Value |
|---|---|
| Bikes in fleet (`cars.type='bike'`) | 30 |
| Fleet all-time earnings (wall engine) | **740 294 ₽** |
| Top earner | BMW F800R — 93 100 ₽ / 9 rentals |
| Hero bike | Ducati Panigale S Electro Black — 88 500 ₽ + 1 500 ₽ service, 10 rentals + 3 service events |
| Service events linkable via `metadata.bike` | 17 on the fleet wall (26 with bike linkage overall) |
| Crew roles | 1 owner, 2 admin, 2 co_owner, 5 member |
| Crew menu links | 12 («Мотопарк» included) |

These numbers are the **XP genesis block**: when BikeSoul ships, every bike's soul is back-filled from this real history (see §15, Open Questions, for backfill rules).

### 1.2 What the wall already gives us for free

Every mechanic in this PRD is an **event on top of the wall**, and the wall already has: identity (bike), chronology (date dividers), media (photo grids + signed URLs), money truth (single engine), audience (all crew roles), and distribution (Telegram crew chat + `@oneBikePlsBot`). We are not building a new surface — we are adding a soul to an existing one.

---

## 2. The Insight — why bikes-as-pets works *here*

1. **Subrenters already anthropomorphize their bikes.** A partner who put his Ducati into the fleet calls it «мой Панигале», not «asset #14». The wall proved it: the first thing partners did was scroll their own bike's story.
2. **Idle capital is an emotional problem disguised as an operational one.** Dashboards shame owners with red numbers; a pet that «скучает» (is bored) makes the *same* fact feel like a to-do: «развлеки его — снизь цену или закинь в своп».
3. **Crews are small social graphs.** 10 people, one Telegram chat, shared garage. Leaderboards and battles fit a group this size perfectly — no global matchmaking needed.
4. **Rent exists already.** Pokémon needs you to walk; tamagotchi needs feeding. Our bikes already «eat» (rentals, service, washes) — we only need to *count* it as XP. The grind loop is the business itself.

> Product one-liner for the landing: **«Ваш мото — не железо. Ваш мото — личность.»**

---

## 3. Vision & North Star

**Vision (2 years):** a subrenter opens the Mini App the way he opens a pet game — first to check *how his bike feels and what it earned yesterday*, and only then to do ops. Fleets that run BikeSoul have measurably higher utilization and partner retention than fleets that don't.

**North Star Metric: WAWV — Weekly Active Wall Viewers per crew.** Unique crew members (any role) who open `/bikes` or a bike story at least once in 7 days. Target for vip-bike after iter31: **≥ 9 of 10 crew members weekly**.

**Business proxy metrics** (must move together with WAWV or the project is decoration):

| Proxy | Baseline | Target (90 days post-iter32) |
|---|---|---|
| Fleet utilization (bikes rented ≥ 1× / 30d) | measure at iter30 ship | **+5 pp** |
| Avg idle days between rentals | measure at iter30 ship | **−30 %** |
| Subrenter 90-day retention in fleet | 100 % (1 partner cohort today) | stays 100 %, add ≥ 2 partners |
| Wall reactions per post | n/a (feature ships iter31) | ≥ 2 |

**Anti-metric (guardrail):** zero diffs in real money outputs. Any PR that changes `computePartnerSplit` outputs or earnings counters while touching BikeSoul code is rejected unless the money change is its own separately-reviewed PR.

---

## 4. Personas

| Persona | Who | What they want | BikeSoul gives |
|---|---|---|---|
| **Партнёр-субрендер «Petrovich»** | Put his beloved bike into the fleet | Know his bike is treated well and earning; feel pride | His pet's life story, daily earnings digest, mood, battles, trophies |
| **Владелец флота (crew owner)** | Runs the business | Utilization, discipline, happy partners | Mood radar = idle-capital heatmap, nudges instead of spreadsheets, seasonal wrap reports |
| **Оператор / member** | Hands the bikes over, photographs, washes | Recognition, low friction | Care actions logged as wall posts, reaction culture, «помыл Panigale» credit |
| **Арендатор (renter)** | Rents for a weekend | A cool bike, a good story to tell | v1: invisible. v2 (optional): a public share card «я катал Легенду Гаража» |
| **Клонер (future franchisee)** | Clones the repo for his own crew | A turnkey product | BikeSoul ships default-on with feature flag off, demo seed data |

---

## 5. Core Concepts

### 5.1 Soul

A **Soul** is a per-bike record: level, XP (season + all-time), stage, mood, rarity, title, skin, achievement set, streaks. One soul per `cars.id` where `type='bike'`. Souls are crew-scoped (RLS mirrors `crew_members`). A bike that leaves the fleet keeps its soul **parked** (soft state), not deleted — deleting a bike's accumulated history would break the emotional contract this whole layer depends on.

### 5.2 XP — the grind is the business

XP is computed **only from verified ledger events** (see §9 data model). v1 formula:

| Event | XP | Notes |
|---|---|---|
| Rental completed | **+25** | statuses completed / active+closed properly |
| Per 1 000 ₽ earned | **+1** | partner + company share, iter27 earning statuses only |
| Per 100 km ridden | **+5** | positive odometer deltas only (engine already garbage-tolerant) |
| «Идеальная сдача» | **+25** | deposit returned in full, no damage notes |
| Service on time | **+15** | within the bike's service interval |
| Loyal renter (3rd rental by same phone) | **+40** | comeback = the highest-value event in rental biz |
| Care action (wash w/ photo, etc.) | **+5** | operator-logged |
| Rental expired (просрочка) | **−20** | bike «устал»; capped at −200/bike/season |
| Cancelled rental | **0 — always** | iter27 discipline: cancelled does not exist |

**Cheating guard:** a rental grants XP only if it has at least one start photo (already enforced by ops flow) and a non-cancelled status. Disputed rentals count as rentals (they physically happened) but grant **0 revenue-XP and 0 completion-XP**.

### 5.3 Level curve & evolution stages

`xpForLevel(n) = round(50 · (n−1)^1.6)` cumulative XP to reach level `n` (calibrated so the fleet's current all-time heroes land at ~L5 «Городской Волк» on genesis day, and «Легенда Гаража» takes roughly a strong year of rentals).

| Level | Cumulative XP | Stage | Emoji |
|---|---|---|---|
| 1 | 0 | «Пони» | 🐴 |
| 4 | 290 | «Пони» | 🐴 |
| 5 | 459 | «Городской Волк» | 🐺 |
| 8 | 1 125 | «Городской Волк» | 🐺 |
| 9 | 1 393 | «Ночной Гонщик» | 🌙 |
| 13 | 2 665 | «Ночной Гонщик» | 🌙 |
| 14 | 3 029 | «Трековый Воин» | ⚔️ |
| 18 | 4 653 | «Трековый Воин» | ⚔️ |
| 19 | 5 098 | «Легенда Гаража» | 👑 |
| 24 | 7 546 | «Легенда Гаража» | 👑 |
| 25 | 8 078 | «Бессмертный» | ♾️ |

Stage-up is a **Moment** (auto wall post + bot ping to the subrenter): *«Эволюция! Panigale стал 🌙 Ночным Гонщиком»*. All-time XP never resets; season XP resets monthly (§ P3).

### 5.4 Mood (tamagotchi layer)

Mood is a **derived** value, recomputed on every soul-touching event and by a nightly job — never hand-set.

Inputs: days since last rental end, 30-day utilization, service freshness vs interval, unresolved damage flags, deposit incidents.

| Mood | Condition (any match, top-down) | Copy in UI |
|---|---|---|
| 🤒 «На больничном» | unresolved damage OR service overdue by > 14d | «Мне нужен сервис» + book-service CTA |
| 😴 «Спит» | idle ≥ 15 days | «Разбудите меня: снизьте цену или отправьте в своп» |
| 😐 «Скучает» | idle 8–14 days OR utilization < 20 % (30d) | «Скучаю по дороге» |
| 😎 «На волне» | utilization ≥ 60 % (30d) AND service fresh | «Живу на полную» |
| 🙂 «В порядке» | everything else | default |

**Tone rule:** mood is playful and always ships with an **actionable next step** (nudge to reprice, book service, join swap). Never a red badge of shame. Mood NEVER affects money, leaderboard placement is XP-only (mood is cosmetic + notification trigger).

### 5.5 Rarity

Assigned once at intake (admin-editable), tiers:

- **Обычный** — commuters (CB400-class, scooters)
- **Редкий** — premium tier (F800R-class)
- **Эпический** — flagships (Panigale-class)
- **Легендарный** — fleet icons: ≤ 2 per crew, admin-granted, must have a story (survivor, record-holder, anniversary bike)

Rarity affects **cosmetics and battle brackets only** — never XP rates (no pay-to-win: rarity is not chosen by the partner anyway).

---

## 6. Feature Pillars

Each pillar: story → mechanics → UX → data → metrics → risks. Priority order = rollout order.

### P0. Wall v2 — reactions & moments *(iter31)*

**Story.** The wall is a feed; feeds die without interaction. The smallest social feature — emoji reactions from crew — turns passive readers into participants, and unlocks «Любовь экипажа» as a measurable, rankable metric (used by battles and Moon scoring).

**Mechanics.**
- Any wall post (rental, service, moment) accepts reactions from crew members: 🔥 ❤️ 😂 💪 🤝 (fixed set of 5, no free-form — moderation-free by design).
- Unique per (post, user, emoji); tapping again removes.
- **Moments** — auto-generated posts, the «photo albums» of the bike's life: first rental, every 10th rental, stage-up, anniversary in fleet («1 год в парке 🎂»), best revenue month, comeback after ≥ 30 idle days («Вернулся в строй 💪»), swap departure/return postcards.
- Reaction counts render as `🔥 3 · ❤️ 1` chips; tapping opens the reactor list (crew names).

**UX.** Long-press (mobile) / hover (desktop) on the post action row → reaction bar. Zero new pages. Moments render with a distinct gradient card style so they read as «memories», not ops.

**Data.** `wall_reactions` table (§9). Moments are `bike_events` rows rendered by kind.

**Metrics.** Reactions/post (target ≥ 2), % of crew reacting weekly (target ≥ 60 %), WAWV lift.

**Risks.** Reaction spam → cap 5 reactions/user/post (one per emoji, trivially enforced by uniques). Fatigue → moments capped at ~2/week/bike.

### P1. Bike Profiles & Evolution *(iter30)*

**Story.** Level badge, stage name, mood and XP progress bar appear on the wall card (fleet index) and in the story header. The bike stops being a row and becomes a character sheet.

**Mechanics.** XP engine = pure lib (`bike-soul.ts`, mirroring `bike-wall.ts` discipline: pure functions, full unit tests, no I/O). Ledger is append-only (`bike_events`); level/mood are **derived and cached** on `bike_souls`, recomputed incrementally on each event — never a full recompute in a request path (Vercel 60s ceiling respected by design).

**UX.** Story header: stage emoji + name + level ring (SVG progress). Fleet cards: mood emoji chip + mini level bar. «Достижения» strip (scrollable) under KPIs.

**Data.** `bike_souls`, `bike_events` (§9); backfill script (§15).

**Metrics.** % of stories opened with soul header visible (should be 100 %), stage distribution across fleet (health signal: too many «Пони» = young fleet or stalled XP engine).

**Risks.** Retroactive backfill disputes → backfill is deterministic + dry-run report before write; XP visible only after backfill verified.

### P2. Mood & Needs *(iter30, dashboards iter31)*

**Story.** The tamagotchi. The bike asks for care; care is already happening (washes, service) — we log it and reward it.

**Mechanics.** Mood model per §5.4. **Care actions** are logged through existing ops flows + one new lightweight action («Помыли» with photo) in the crew UI → +5 XP + wall post. Service bookings (existing service items, `metadata.bike` linkage) automatically count as «лечение».

**UX.** Fleet index gets a **mood radar** view for owners: grid of bikes by mood (🤒 column first). Owner tap → pre-filled action sheet (сервис / снизить цену / своп).

**Data.** Mood cached on `bike_souls`; care actions as `bike_events`.

**Metrics.** Time-to-recover from 🤒 (target < 5 days), idle-days delta (target −30 %), care actions/week.

**Risks.** Mood-shaming a partner's bike → tone rule §5.4 + moods are fleet-private, never public. Fake wash-spam for XP → wash XP capped 3/week/bike.

### P3. Leaderboards & Seasons *(iter32)*

**Story.** Monthly seasons give the grind a shape: reset, race, crown, hall of fame. Pokémon has gyms; we have seasons.

**Mechanics.**
- Season = calendar month, MSK boundaries (canonical tz everywhere, like the wall).
- Season XP resets at month boundary; all-time XP keeps growing.
- Five boards: **Выручка** (₽), **Загрузка** (% days rented), **Пробег** (km), **Любовь экипажа** (reactions received), **Комбо** (rentals without incidents).
- Season wrap = auto wall Moment + bot message: top-3 cards per board; winner of Выручка gets a «Корона месяца» cosmetic for the next season.
- **Hall of Fame** page (`/bikes/hall-of-fame`): every past season's winners, pinned forever.

**UX.** Podium strip on `/bikes` (top-3 by season XP) during a live season; «Сезон заканчивается через 4 дня» banner last week.

**Data.** `bike_seasons` (one row per crew per month, denormalized winners), `bike_events` carry `season_xp_delta`.

**Metrics.** Season participation (bikes with ≥ 1 event), leaderboard views, utilization in final week vs mid-season (the «deadline effect» — expect +10–20 %; it's the point).

**Risks.** Sandbagging (saving rentals for next season) — impossible: XP accrues at event time, not at booking. Leaderboard anxiety → five boards mean five different winners; a commuter scooter can win Комбо.

### P4. Bike Battles 🥊 *(iter33)*

**Story.** Beyond the leaderboard: weekly 1v1 duels with crew voting. Zero money, deliberately silly — crowns, memes, emoji.

**Mechanics.**
- Opt-in per bike (subrenter/owner toggles «Участвует в битвах»).
- Pairing every **Friday 12:00 MSK**: random same-rarity (±1 stage) pairs from opted-in bikes.
- 3 rounds, scored on the week's real data:
  1. **Выручка** — revenue earned Mon–Thu
  2. **Загрузка** — days rented Mon–Thu
  3. **Народное голосование** — crew reactions on the two bikes' wall posts, Fri 12:00 → Mon 12:00
- Round win = 1 point; 2–0 / 2–1 wins the duel.
- Winner: **+100 XP**, «Корона чемпиона» cosmetic (7 days), ×1.05 season-XP multiplier for the next week (XP-rate only — never money).
- Loser: nothing. A «Реванш» button queues a preferential rematch pairing next Friday.

**UX.** Battle card renders as a VS split card on the wall and `/bikes` («⚔️ Panigale vs F800R — голосование открыто»), inline vote buttons (member reactions = votes).

**Data.** `bike_battles` (§9): pairing, per-round scores, votes, winner, status.

**Metrics.** Battles opted-in %, vote participation % (target ≥ 50 % of crew), Friday-revenue delta for participants (the «battle hustle»).

**Risks.** Toxic rivalry → battles are explicitly silly (emoji, crowns, memes); copy tone tested with the crew first. Unfair pairing (fresh vs veteran) → rarity ± 1 stage brackets + a mercy rule: a bike with 0 wins in a season gets a bye-week + «Тренировка» XP bonus.

### P5. Bike Swaps 🔄 *(iter35)*

**Story.** «Отпуск для мото»: a Moscow partner's bike spends August in a St. Petersburg crew, earning for its home partner while away. New city, new photos, new wall postcards — and both fleets' utilization improves.

**Mechanics.**
- `swap_contracts`: draft → confirmed → in_transit → active → returned → closed; each transition = wall Moment on BOTH crews' walls.
- Gates: same insurance tier, mood ≥ 🙂 at departure, service fresh ≥ 30 days, deposit rules unchanged.
- Revenue split: **70 / 30 home/away partner** (computed by the existing split engine with a new swap mode — the ONLY place this PRD touches money-adjacent code, and it's a new, separately-tested path).
- Duration 2–8 weeks, hard cap 1 active swap per bike per quarter.

**UX.** «Отправить в своп» action on the mood sheet → pick city/crew → contract card (dates, split, insurance) → both owners sign in-app (existing signature flow).

**Data.** `swap_contracts` (§9). Geo tags on Moments («Panigale уехал в Санкт-Петербург ✈️»).

**Metrics.** Swaps/quarter, away-period utilization of swapped bikes (target ≥ 40 %), incident rate vs fleet baseline (guardrail: not worse).

**Risks.** Cross-crew RLS (the hard one) → separate design doc before iter35; v1 can be single-crew-only (bikes between subrenters within one crew) to derisk. Damage disputes → departure/return photo protocol is already the rental protocol; reuse verbatim.

### P6. Work-to-Earn — «байки идут на работу» 💼 *(iter34)*

**Story.** «Байки идут на работу»: bikes go to work and bring wages home. The subrenter gets a daily digest (like a pet-trainer report) and a monthly salary sheet per bike — passive income framing for a real revenue share he already receives today, made visible and predictable.

**Mechanics.**
- Daily digest 09:00 MSK from `@oneBikePlsBot` per subrenter: per bike — yesterday's earnings, days-in-work streak, mood, one nudge if 😐/😴/🤒.
  - *«Твой BMW F800R вчера заработал 6 500 ₽. Дней в работе подряд: 12. Настроение: 😎 На волне.»*
- Streaks: 7 busy days → «Трудяга» chip; 30 days → «Полный месяц без простоя» achievement.
- Monthly per-bike **salary sheet** (docx, existing document pipeline): revenue, days, km, service spend, net «зарплата мото», season place. Sent to the partner and pinned as a wall Moment.

**UX.** Digest = one TG message per day (hard cap: ≤ 2 proactive bot messages/day/user across ALL features — fatigue guardrail). Salary sheet = generated docx in the existing artifacts flow.

**Data.** No new tables — computed from `bike_events` + rentals. Docx via existing template engine.

**Metrics.** Digest open rate (TG read receipts), streak counts, subrenter WAWV.

**Risks.** Notification fatigue → the cap above + per-user opt-out («Тихий режим»). Money confusion → digest numbers come from the SAME `computeBikeStats` as the wall; one engine, zero forks.

### P7. Cosmetics & Achievements *(iter31 achievements, iter36 cosmetics)*

**Story.** Status needs to be visible. Cosmetics are earned by the bike's life, never bought — this is an internal crew product, not a monetization surface.

**Mechanics.**
- **Achievements v1 (18)** — catalog lives in code (versionable, testable), each with RU copy + emoji + condition + rarity tint: «Первая поездка» 🎬, «10 аренд» 🔟, «50 аренд» 🏅, «100k клуб» 💰, «250k клуб» 🏦, «Дальнобой 1 000 км» 🛣️, «Дальнобой 5 000 км» 🌍, «Идеальные сдачи ×10» ✨, «Чистюля ×5» 🧼, «Комбек» (renter returns 3rd time) 🔁, «Ночная смена» (return 00:00–05:00) 🌃, «Ранний пташка» (start < 09:00) 🌅, «Трудяга сезона» (30 rental-days) ⚒️, «Полный месяц без простоя» 📅, «Комбо 5 без инцидентов» 🧿, «Ветеран парка» (1 год) 🎖️, «Спасён с больничного» 💊, «Лунный кандидат» (top-3 сезона) 🚀.
- **Cosmetics**: wall themes (color palettes), hero-photo frames, titles under the bike name («Ночной Гонщик · 12 побед», «ГОДНОТА 2026»), entrance animation on story open (respect `prefers-reduced-motion`).
- Earned only — via achievements, battles, seasons, Moon.

**UX.** Achievement strip on story page; cosmetic picker for the subrenter (his bike, his choice among UNLOCKED items).

**Metrics.** Achievement unlock rate (target: median bike holds ≥ 3 after season 1), cosmetic usage rate.

**Risks.** Scope explosion of the catalog → catalog is code + tests, additions are cheap but reviewed like features; v1 is fixed at 18.

### P8. Virality & sharing *(iter36+)*

**Story.** Wall cards are gorgeous already — signed photo URLs, stage badges, battle crowns. Let them leave the app as TG stories/posts: free acquisition of new renters AND new subrenters («your bike can have a life too»).

**Mechanics.** Share button on Moments and battle cards → rendered image card (server-side, OG-image pipeline) → «Поделиться в Telegram». **Privacy rule:** shareable cards mask plate and VIN, show only stage + first name of bike + stats. Renter PII never leaves crew scope.

**Metrics.** Shares/week, inbound /rent flow from shared cards (start-param attribution already exists).

**Risks.** Public exposure of fleet data → masks above; shareable set is whitelisted card types only.

### P9. Moon Program 🚀 *(annual, first ceremony Dec 2026)*

**Story.** «Пусть самые крутые летят на Луну» — the annual Bike of the Year. Not the richest — the **coolest**: a weighted score of revenue (40 %), utilization (25 %), condition/care (15 %), crew love (10 %), tenure (10 %).

**Mechanics.**
- Winner announced 31 Dec, MSK, with a full-year wall retrospective Moment.
- Prizes: physical trophy plate riveted to the bike («ГОДНОТА 2026» — the owner fabs it; the app generates the plate spec), golden wall skin (12 months), pinned Hall of Fame card, TG channel post.
- **Party fund**: the app computes a *suggested* fund = 1 % of the bike's annual revenue (cap 50 000 ₽). Payout is the owner's manual decision **outside the system** — display-only rule holds (§0).
- «На Луну» year card: shareable image of the bike's 12 months (P8 pipeline).

**UX.** December = «Лунная гонка» banner on `/bikes`, live top-5 with score bars.

**Metrics.** Ceremony-week WAWV (expect annual peak), subrenter applications after ceremony (+2 partners target).

**Risks.** Winner drama → score weights are public from day one of the season; five season boards mean the Moon is one of several crowns.

---

## 7. Non-goals (what we deliberately do NOT build)

- ❌ **No real-money games.** No betting on battles, no paid cosmetics, no XP-for-money. Ever. (Internal crew product; gambling vibes would also be a legal minefield.)
- ❌ **No renter-facing gamification in v1.** Souls are crew-private. Renter share cards are P8 and optional.
- ❌ **No global cross-crew leaderboards in v1.** Crews compete internally. Cross-crew is a swaps-era question (P5), not a rankings one.
- ❌ **No public bike pages** (SEO bait) while plate/VIN masking isn't battle-tested.
- ❌ **No pet death.** A bike can never «die» or lose levels permanently. XP floors at 0; mood floors at «в порядке» after recovery. Tamagotchi guilt is a bug, not a feature.
- ❌ **No XP for cancelled rentals** — ever (iter27 discipline).

---

## 8. Ethics & guardrails

| Risk | Guardrail |
|---|---|
| Shaming low-performing bikes/partners | Mood is playful + actionable (§5.4); leaderboards are multi-board so different bikes win different boards; no red/punitive colors anywhere in soul UI |
| Notification fatigue | Hard cap 2 proactive bot msgs/user/day; global «Тихий режим» per user |
| Real-money confusion | One money engine (`computePartnerSplit` + `computeBikeStats`); souls read it, never fork it; guardrail test in CI asserts money outputs unchanged when soul code is touched |
| Data fabrication (XP farming) | XP only from ledger events tied to real rentals (photo-gated), verified service rows, operator-logged care; all grants append-only and auditable in `bike_events` |
| Privacy | Plates/VIN masked on any shareable surface; renter PII stays crew-scoped; reactor lists are crew-only |
| Exclusivity drift (legendary inflation) | Legendary cap ≤ 2/crew, admin-granted, each requires a written story |

---

## 9. Data model (new tables, all crew-RLS)

```sql
-- The soul: one per bike, derived cache + assigned cosmetics
create table public.bike_souls (
  bike_id        text primary key references public.cars(id) on delete cascade,
  crew_id        text not null,
  all_time_xp    integer not null default 0,
  season_xp      integer not null default 0,
  level          smallint not null default 1,
  stage          text not null default 'pony',        -- pony|wolf|night|track|legend|immortal
  mood           text not null default 'ok',          -- sick|sleeping|bored|thriving|ok
  mood_checked_at timestamptz,
  rarity         text not null default 'common',      -- common|rare|epic|legendary
  title          text,
  skin           text,
  streaks        jsonb  not null default '{}'::jsonb, -- {busy_days, perfect_returns, ...}
  is_parked      boolean not null default false,      -- bike left fleet: soul parked, not deleted
  updated_at     timestamptz not null default now()
);

-- Append-only life ledger: the ONLY source of XP truth
create table public.bike_events (
  id           bigint generated always as identity primary key,
  bike_id      text not null references public.cars(id) on delete cascade,
  crew_id      text not null,
  kind         text not null,          -- rental_completed|perfect_return|service_done|wash|
                                       -- stage_up|battle_won|swap_out|swap_in|moment_*|...
  payload      jsonb not null default '{}'::jsonb,
  xp_delta     integer not null default 0,
  season_xp_delta integer not null default 0,
  rental_id    uuid,                   -- nullable link to the rental that caused it
  created_at   timestamptz not null default now()
);
create index on public.bike_events (bike_id, created_at desc);
create index on public.bike_events (crew_id, kind, created_at desc);

-- Reactions on wall posts (posts are bike_events rows)
create table public.wall_reactions (
  id           bigint generated always as identity primary key,
  bike_event_id bigint references public.bike_events(id) on delete cascade,
  rental_id    uuid,                   -- reactions also allowed directly on rentals (wall v1 posts)
  actor_chat_id text not null,
  emoji        text not null,          -- 🔥|❤️|😂|💪|🤝 (fixed set)
  created_at   timestamptz not null default now(),
  unique (bike_event_id, actor_chat_id, emoji),
  unique (rental_id, actor_chat_id, emoji),
  check ((bike_event_id is not null) <> (rental_id is not null))
);

-- Weekly duels
create table public.bike_battles (
  id           bigint generated always as identity primary key,
  crew_id      text not null,
  season       text not null,          -- '2026-09'
  week_start   date not null,
  bike_a       text not null references public.cars(id),
  bike_b       text not null references public.cars(id),
  round_scores jsonb not null default '{}'::jsonb, -- {revenue:[a,b], utilization:[a,b], votes:[a,b]}
  votes_a      integer not null default 0,
  votes_b      integer not null default 0,
  winner       text references public.cars(id),
  status       text not null default 'voting',      -- voting|done|canceled
  created_at   timestamptz not null default now(),
  check (bike_a <> bike_b)
);

-- Season registry + denormalized winners (Hall of Fame)
create table public.bike_seasons (
  id           bigint generated always as identity primary key,
  crew_id      text not null,
  season       text not null,          -- '2026-09'
  boards       jsonb not null default '{}'::jsonb,  -- {revenue:{top:[...]}, utilization:{...}, ...}
  started_at   timestamptz not null,
  ends_at      timestamptz not null,
  closed       boolean not null default false,
  unique (crew_id, season)
);

-- Swap program (v1: intra-crew; cross-crew after its own design doc)
create table public.swap_contracts (
  id           bigint generated always as identity primary key,
  bike_id      text not null references public.cars(id),
  crew_id      text not null,
  partner_home_chat_id text not null,
  partner_away_chat_id text,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  split_home   numeric not null default 0.7,
  split_away   numeric not null default 0.3,
  status       text not null default 'draft', -- draft|confirmed|in_transit|active|returned|closed
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
```

**RLS**: every table is crew-scoped via the same active-`crew_members` membership pattern used across the app; `wall_reactions` insert allowed for any active member, update/delete none (append-only + own-reaction-toggle via delete of own row).

**Migrations hygiene** (per iter29 restructure): each table lands as its own numbered migration in the clean apply path; NO pg_cron jobs — nightly mood/season jobs run as Vercel cron hitting a protected route (60s budget each, incremental by design).

---

## 10. Bot & notification plan (`@oneBikePlsBot`)

| Message | Trigger | Cap |
|---|---|---|
| Daily work digest (P6) | 09:00 MSK, per subrenter | 1/day |
| Stage-up / achievement (P1/P7) | event time, per bike | bundled hourly |
| Battle open / result (P4) | Fri 12:00 / Mon 12:00 MSK | 2/week |
| Season wrap (P3) | month boundary | 1/month |
| Mood nudge (P2) | mood transition to 😐/😴/🤒 | 1/bike/week |
| Moon ceremony (P9) | Dec 31 | 1/year |

New commands: `/soul` (my bikes' souls: level, mood, streaks), `/top` (live season boards), `/battle` (this week's duel + vote buttons). All opt-out-able via «Тихий режим».

---

## 11. Metrics & instrumentation

- **Event analytics** ride on `bike_events` itself (it IS an analytics table) + existing Supabase analytics patterns — no new vendor.
- Weekly ops review (owner-facing, auto-generated Monday 10:00 MSK): WAWV, reactions/post, mood distribution, idle-capital list (😴 + 😐 bikes with suggested actions), battle participation.
- Every soul-touching PR must state its expected metric move (no «just fun» code after iter31 — fun must be measurable or cut).

---

## 12. Technical constraints & invariants

1. **Vercel Hobby, `maxDuration` ≤ 60s** — all soul recomputes are incremental (ledger-append + cache-update); no full-fleet recompute in request paths; nightly jobs chunked.
2. **One money engine** — souls read `computeBikeStats` / `computePartnerSplit` outputs; CI guard (test) fails if soul code computes ₽ on its own.
3. **MSK canonical** (UTC+3 fixed) for season boundaries, digests, date dividers — same as the wall.
4. **Pure-lib discipline** — XP/level/mood/battle-score formulas live in `app/franchize/lib/bike-soul.ts` (pure functions, imported by both server actions and tests; mirrors `bike-wall.ts`).
5. **Signed URLs TTL 3600s** for any photo surfaced by moments/share cards; plates masked at render time on public-facing cards.
6. **Access matrix unchanged** — souls inherit the wall's gate (owner/admin/co_owner/member: all bikes; subrenter: his bikes only). No new roles.
7. **Feature flag**: `crews.metadata.features.bikeSoul` — vip-bike on, everyone else off until clone-ready docs ship.

---

## 13. Rollout plan

| Iter | Ships | Flag | Success gate to proceed |
|---|---|---|---|
| **30** | `bike-soul.ts` engine + `bike_souls`/`bike_events` + backfill + souls on wall (level/mood chips) | vip-bike | engine tests 100 %, backfill dry-run matches manual audit on 3 bikes |
| **31** | Reactions + Moments v1 + achievements (18) + care actions + mood radar | vip-bike | reactions/post ≥ 1 by week 2 |
| **32** | Seasons + 5 leaderboards + Hall of Fame + season wrap | vip-bike | WAWV ≥ 9/10, deadline-effect visible |
| **33** | Battles (pairing, voting, crowns, rematch) | vip-bike | ≥ 50 % crew votes weekly |
| **34** | Work-to-earn digests + monthly salary sheets | vip-bike | digest read ≥ 80 %, fatigue cap holds |
| **35** | Swaps v1 (intra-crew) + swap postcards | vip-bike | 2 completed swaps, no incidents |
| **36** | Cosmetics + share cards (P8) + Moon prep («Лунная гонка» live top-5) | all flagged crews | shares ≥ 10/week |
| **Dec 2026** | 🌙 First Moon ceremony | public-ish | the trophy gets riveted |

---

## 14. Risks & mitigations (program-level)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Gamification fatigue after novelty | High | Medium | Low-frequency events, seasonal resets, fatigue caps, «Тихий режим» |
| Crew reads moods as management pressure | Medium | High | Tone rule §5.4, owner playbook doc, multi-board leaderboards |
| XP farming / fake care actions | Medium | Medium | Photo-gated events, caps (wash 3/wk), append-only audit ledger |
| Scope creep (this PRD is 7 iterations) | High | High | Rollout gates: each iter must hit its metric or the next one pauses |
| Soul UI slows the wall (main product) | Medium | High | Souls are cached chips; wall render path unchanged; perf budget test |
| Swap damage dispute | Medium | High | Photo protocol reuse, insurance gates, v1 intra-crew only |
| Money-display drift (soul shows ≠ reality) | Low | Critical | One-engine rule + CI guard + monthly reconciliation doc |

---

## 15. Open questions

1. **Backfill exact rules** — proposal: apply v1 XP formula to full rental history at iter30; expired-penalties capped at −200/bike; dry-run report reviewed by owner before write. Decision needed: do pre-iter28 rentals (before photo enforcement) count for photo-gated XP? (Proposal: yes — they were real ops; the photo gate applies prospectively only.)
2. **Rarity formula** — admin-assigned at intake vs formula on (price tier, model, year)? Proposal: formula suggests, admin confirms.
3. **Battle pairing fairness** — pure random within bracket vs seeded by last-week result (winners face winners)? Playtest in iter33 with two pairing modes behind a flag.
4. **Season XP multiplier cosmetics** (×1.05 battle crown) — keep or drop? It's the only compounding mechanic; drop if it reads as unfair in playtest.
5. **Renter-visible souls (v2)** — share cards only, or a renter-facing «твой мото — Ночной Гонщик» flourish in the rental flow? A/B after P8.
6. **Cross-crew swaps** — separate design doc (RLS, insurance, dispute arbitration) before any code.

---

## Appendix A — Live genesis numbers (backfill day reference)

Snapshot 2026-08-30, vip-bike crew, from the wall engine (iter28):

- Fleet: 30 bikes; all-time earnings **740 294 ₽**.
- Projected genesis levels (rough, pre-backfill-audit): median bike ≈ L2–3 «Пони»; BMW F800R (93 100 ₽ / 9 rentals ≈ 590 XP) ≈ **L5 «Городской Волк»**; hero Ducati (88 500 ₽ + service, 10 rentals ≈ 585 XP) ≈ **L5 «Городской Волк»**.
- 17 fleet service events already flow to the wall via `metadata.bike` — these become `service_done` ledger rows on backfill day.
- Expected day-one distribution: ~70 % «Пони», ~30 % «Городской Волк», zero «Ночных Гонщиков» — the first stage-up race (L9 = 1 393 XP) is winnable within the first season, which is exactly the point.

## Appendix B — Glossary

| RU | EN | Meaning |
|---|---|---|
| Душа мото | Soul | per-bike gamification record |
| Стена | Wall | the bike story feed (iter28) |
| Момент | Moment | auto-generated memory post |
| Битва | Battle | weekly 1v1 duel |
| Своп | Swap | temporary bike exchange program |
| Зарплата мото | Bike salary | monthly per-bike earnings sheet |
| ГОДНОТА | Bike of the Year | Moon Program winner plate |
| Тихий режим | Quiet mode | notification opt-out |

## Changelog

- **v1** (2026-08-31) — initial draft: full concept, XP/level/mood model, 10 pillars, data model, 7-iteration rollout.
- **v1.1** (2026-09-01) — polish pass, no scope change: grounded the tone (the concept started as a joke and the doc now says so, with the discipline that makes it safe to try), removed meta references to "the user asked", tightened TL;DR, restored the «Мотопарк» menu link to the vip-bike hydration SQL (lost in an environment reset before commit — live crew was already patched directly, so no production action was needed).
