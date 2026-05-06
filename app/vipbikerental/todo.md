# 🔥 `/vipbikerental` Enhancement TODO (v2 – Interactive Info Sections)

> **Core problem:**  
> Hero, Electro-Enduro, MapRiders, "Как это работает" и другие блоки сейчас – **статичные текст + кнопки**, которые просто уводят на другие страницы.  
> Пользователь не вовлекается на месте, а просто читает и уходит.  
> **Решение:** заменить статику на микро‑интерактивы прямо внутри секций.  
> Так лендинг станет не навигатором, а эмоциональным полигоном.

## 📐 0. Принцип: «кликай, не покидая секцию»

- Любая секция должна давать пользователю возможность **совершить действие прямо здесь**: переключить вкладку, перетащить слайдер, посмотреть модалку, ткнуть на карту.
- Внешние ссылки – только как финальное «продолжить», а не первая кнопка.
- Использовать **данные, которые уже есть в системе** (MapRiders API, items, роуты), без новых эндпоинтов.

## 1. ⚡ Hero – живой переключатель вместо пачки кнопок

**Сейчас:** 4 кнопки рядом (аренда, покупка, карта, мои аренды).  
**Нужно:** один таб‑селектор, который на лету меняет превью и целевую кнопку.

### Что сделать
- [x] Добавить состояние `heroMode: 'rent' | 'buy' | 'map' | 'rentals'`.
- [ ] Вместо статичного заголовка показать **динамический превью‑блок**:
  - При `rent`: фото лучшего байка для аренды, цена, кнопка «Выбрать байк».
  - При `buy`: фото байка из конфигуратора, цена, кнопка «Конфигуратор».
  - При `map`: мини‑статистика (сколько райдеров онлайн, маршрутов), кнопка «Открыть карту».
  - При `rentals`: последняя аренда или CTA «Мои аренды».
- [ ] Использовать **существующие данные**: `items` (из пропсов или хука), MapRiders `/api/map-riders/overview`.
- [ ] Добавить плавный transition между режимами (`AnimatePresence`).

## 2. 🔋 Electro-Enduro – слайдер с реальными байками и быстрым просмотром

**Сейчас:** две колонки с текстом про аренду и продажу. Нет визуала.  
**Нужно:** горизонтальный слайдер, где каждый слайд – **реальный байк** из каталога.

### Что сделать
- [  ] Заменить сетку из двух `Card` на `<HorizontalSlider />`.
- [ ] Слайды: изображение байка + название + цена аренды/покупки + кнопка «Быстрый просмотр».
- [ ] Кнопка «Быстрый просмотр» открывает **модалку** с мини‑конфигуратором (цвета, опции) без перехода на другую страницу.
  - *Можно переиспользовать `ItemModal` или сделать упрощённый `PreviewModal`.*
- [ ] Данные брать из `items` (уже есть на странице).

## 3. 🗺️ MapRiders – живая мини‑карта и социальные пруфы

**Сейчас:** три текстовые карточки «Живые точки», «Новичкам просто», «Геймификация».  
**Нужно:** мини‑карта Leaflet с реальными точками (недраггируемая, без зума) + блок с последней завершённой поездкой.

### Что сделать
- [ ] Вставить статичную карту (размер ~400×300) с:
  - 2‑3 активными райдерами (из `/api/map-riders/overview`),
  - 2‑3 маршрутами (из `getPublicRacingRoutes()` или `mapData.routes`),
  - 1 meetup точкой.
- [ ] Карта **не скроллится, не зумится**; при клике – переход в полноценный MapRiders.
- [ ] Ниже карты – блок «Последняя поездка»:
  - Имя райдера, дистанция, время, маленький график скорости (SVG path из точек сессии).
  - Данные из `latestCompleted` (есть в API).

## 4. 📖 Пошаговая секция – интерактивный степпер

**Сейчас:** три отдельные карточки «Шаг 1/2/3».  
**Нужно:** горизонтальный степпер с анимированной сменой контента.

### Что сделать
- [ ] Заменить сетку карточек на компонент `StepsProgress`.
- [ ] Под активным шагом показывать **конкретную визуализацию**: например, на шаге «Выбор байка» – карусель из 3‑х популярных байков, на шаге «Корзина» – мини‑превью корзины.
- [ ] Использовать `AnimatePresence` для плавного перехода между шагами.

## 5. 🔧 Быстрые действия – замена на карточки с быстрым экшеном внутри

**Сейчас:** сетка карточек «Контроль сделок», «MapRiders» и т.д. с кнопками‑ссылками.  
**Нужно:** оставить сетку, но каждая карточка должна выполнять **микро‑действие** на месте (например, показать последнюю аренду, количество активных райдеров, открыть модалку с контактом).

### Что сделать
- [ ] Для «Контроль сделок»: fetch последней аренды пользователя и покажи её статус.
- [ ] Для «MapRiders»: показать живой счётчик райдеров.
- [ ] Для «Быстрый вход»: сразу открыть модалку выбора байка.

## 🧪 6. Мелкие, но важные фиксы

- [ ] Удалить дублирующиеся константы `CONFIG_OPTIONS` / `COLOR_OPTIONS` из серверного `SaleBikeLanding.tsx`.
- [ ] Заменить OSRM public server на любой защищённый слой (хотя бы продублировать local fallback).
- [ ] Продумать лёгкую загрузку маршрутов (не грузить все `points_of_interest` с большими GeoJSON каждый раз).

## 📅 План реализации (в порядке удара)

1. **Hero interactive tabs** (1 день) – сразу меняет восприятие.
2. **Electro-Enduro слайдер + модалка** (1 день) – добавляет визуала.
3. **MapRiders мини‑карта** (1 день) – wow‑эффект и соц.доказательство.
4. **Интерактивный степпер** (0.5 дня) – делает путь новичка живым.
5. **Улучшение быстрых действий** (по желанию, но быстро).

Каждое улучшение – изолированный компонент, не ломает существующую структуру, использует уже готовые данные.

После этого `/vipbikerental` перестанет быть «витриной ссылок» и станет живым продуктом, который затягивает в экосистему.
Here's **comprehensive analysis** of the app (almost full context attached, broken into digestable parts) and actionable recommendations for enhancing the `/vipbikerental` landing page:

---

## 🏗️ 1. App Architecture Overview

**Stack:** Next.js (App Router) + Supabase + Tailwind CSS + Framer Motion + Leaflet

**Core business model:** A **multi-crew franchise platform** for electric motorcycle rental and sales, with the flagship franchise being **VIP-Bike**. The app operates as a Telegram Mini App with dual authentication (Supabase Auth + Telegram WebApp JWT).

**Key architectural patterns:**
- **Server Actions** (`"use server"`) for all DB operations — no REST endpoints for core franchise flows
- **Crew-based theming** via `FranchizeTheme` / `crewPaletteForSurface()` — each franchise gets its own palette (accent, borders, cards, text)
- **Cart system** per franchise slug (`useFranchizeCart(slug)`) with localStorage hydration
- **Mixed rental+sale flow** — the same catalog supports both rental (duration-based) and purchase (configurator-based) with `flowType: "rental" | "sale" | "mixed"`
- **Real-time MapRiders** with a full reducer pattern, eviction logic, GPS spoof protection, and privacy controls

---

## 🏍️ 2. VIP-Bike Franchise System

**Current state:**

| Layer | What exists | Observations |
|-------|-------------|-------------|
| **Data model** | `FranchizeCrewVM` with `slug`, `theme`, `header`, `contacts`, `catalog` | Crew slug defaults to `"vip-bike"`, phone defaults to `+79999005588` |
| **Theming** | `FranchizeTheme` → `palette` (accentMain, borderSoft, textPrimary, bgBase, bgCard) | Deep cyberpunk aesthetic — dark mode native, gold/lime accents |
| **Navigation** | `HeaderMenu` with `menuLinks[]` + `tagline` | Mobile-first hamburger, portal-based |
| **Market** | Catalog with rental items + sale items (`saleAvailable` flag) | Items can be rent-only, buy-only, or both |
| **Social** | VK group link: `vk.ru/vip_bike_electro` | Single social touchpoint, no community features on-site |

**Gaps for the landing page:**
- **No franchise story/identity section** — who is VIP-Bike, what's their mission, why electric enduro?
- **No feature showcase** — the configurator, electro-enduro lineup, and map-riders are buried in sub-pages
- **Trust section is static/hardcoded** — one review from "Алексей, Москва", sold count defaults to 120, rating defaults to 4.9
- **No visual brand hero** — the landing page jumps straight into catalog, missing the "why VIP-Bike" moment

---

## ⚙️ 3. Configurator Feature Analysis

**What exists now:**

The configurator lives inside `SaleBikeLandingClient.tsx` and supports:

| Feature | Implementation | Data Source |
|---------|---------------|-------------|
| **Config options** | 3 tiers: Стандарт / Long Range / Comfort | `specs.buy_options` from DB, falls back to `DEFAULT_CONFIG_OPTIONS` |
| **Color picker** | 4 colors: Black / Graphite / Lime / White | `specs.buy_colors` from DB, falls back to `DEFAULT_COLOR_OPTIONS` |
| **Dynamic pricing** | `basePrice + selectedOption.priceDelta` | Real-time calc from `specs.price_rub` + deltas |
| **Cart integration** | Adds to cart with `buyConfigId`, `buyPriceDelta`, `buyColorId` | Full cart flow |
| **Specs display** | 8-card grid: Type, Power, Battery, Range, Speed, Weight, Charge, Drive | From `item.rawSpecs` |

**Critical gaps for landing page enhancement:**

1. **No visual configurator preview** — selecting "Long Range" or "Lime" doesn't update the bike image. The image gallery is static, not config-aware
2. **No 3D/AR preview** — modern eMoto configurators (Zero, LiveWire) show real-time color changes
3. **No comparison mode** — users can't compare Стандарт vs Long Range side-by-side
4. **Configurator is buried on the buy page only** — rental customers never see it, even though they'd benefit from understanding options
5. **No technical deep-dive** — the 8-card spec grid is minimal; no battery chemistry details, charging curves, or motor specs
6. **Price transparency** — when `basePrice === 0`, shows "по запросу" but no CTA to actually request a quote
7. **`safeGallery` is defined AFTER the return statement** (line 749) — this is a **runtime bug** — the gallery with broken-URL filtering never actually applies in the component

---

## ⚡ 4. Electro-Enduro Feature Analysis

From the code context, "electro-enduro" is both a **vehicle category** and a **brand positioning**:

**Evidence in code:**
- `item.category` is used but never explicitly typed as "electro-enduro" — it's a free-text field
- The `SaleBikeLandingClient` shows a `Premium eMoto` badge with `<Sparkles>` icon — this is the closest to an "electro-enduro" brand moment
- Specs focus on electric: `power_kw`, `battery`, `range_km`, `charge_time_h`, `drive`
- The tagline references "электро" in the VK group: `vip_bike_electro`

**What's missing for the landing page:**

1. **No "Why Electro-Enduro?" educational section** — potential customers need to understand: no noise, no emissions, instant torque, lower maintenance, urban+off-road versatility
2. **No eMoto vs ICE comparison** — first-time electric buyers need reassurance on range anxiety, charging infrastructure, performance equivalence
3. **No range calculator** — interactive "how far can you go?" based on riding style (eco/normal/sport)
4. **No charging map** — integration with the existing VibeMap to show charging stations near routes
5. **Category is not structured** — the `category` field is a string, so there's no dedicated "electro-enduro" filter, landing section, or taxonomy

---

## 🗺️ 5. Map-Riders Feature Analysis

This is the **most sophisticated** feature in the codebase. Here's the full architecture:

### Data Flow

```
Supabase (maps table + rider_sessions + rider_locations + meetups)
    ↓
Server Actions (map-actions.ts) → getMapCapability(identifier?)
    ↓
MapRiders Reducer (map-riders-reducer.ts) → Single source of truth
    ↓
React Components → Live map with Leaflet + real-time updates
```

### Key Capabilities

| Capability | Implementation | Maturity |
|-----------|---------------|----------|
| **Live GPS tracking** | `LiveRider` with lat/lng/speed/heading, stale/eviction lifecycle (30s stale, 2min evict) | Production-grade |
| **GPS spoof protection** | Haversine distance + max plausible speed (280 km/h) + out-of-order packet rejection | Strong |
| **Ride sessions** | Start/stop, ride name, vehicle label, mode (rental/personal) | Complete |
| **Privacy controls** | Visibility (crew/public), auto-expire (1/5/15/60 min), home blur, pause sharing | Excellent |
| **Meetup points** | Create/join meetup spots with title, comment, scheduled_at, location | Functional |
| **Weekly leaderboard** | Rank, distance, sessions, avg/max speed | Functional |
| **Route management** | Save/edit/delete routes with GeoJSON, OSRM road-snapping, custom highlight styles | Admin-level |
| **Multi-crew maps** | `getMapCapability(identifier)` resolves by UUID, crew slug, or default | Scalable |
| **Security** | Dual auth (Supabase + Telegram JWT), origin allowlist, X-Requested-With guard, rate limiting | Enterprise-grade |

### Gaps for the Landing Page

1. **Map-Riders is completely invisible on the landing page** — a customer lands on `/vipbikerental` and has NO idea this social riding feature exists
2. **No "Community" showcase** — active riders count, weekly distance, upcoming meetups — all this data exists in `CrewStats` but isn't surfaced
3. **No route preview** — the racing routes with glowing road highlights are a huge selling point but require navigating deep into the map
4. **No "Join a ride" CTA** — meetup points could be promoted as "Saturday group ride — join 8 riders"
5. **No session replay teaser** — completed rides with distance/speed/duration could be shown as social proof

---

## 🚀 6. Landing Page Enhancement Recommendations

Here's my prioritized plan for enhancing the `/vipbikerental` landing page:

### Phase 1: Franchise Identity Hero Section
**Add above the catalog:**
- Hero banner with tagline: "VIP-Bike — Электро-эндуро нового поколения"
- 3 value props: **Rent → Ride → Race** with icons
- Animated counter: "X riders on map right now" (from `CrewStats.activeRiders`)
- CTA buttons: "Выбрать байк" → catalog, "Карта маршрутов" → map-riders

### Phase 2: Configurator Showcase Section
**Embed a mini-configurator directly in the landing page:**
- Interactive card showing 1-2 hero bikes with the existing config/color pickers
- **Fix the `safeGallery` bug** — move it before the return statement
- Add **config-aware images** — when user picks "Lime", swap to the lime bike image
- Show "Ваша конфигурация: [summary]" with total price
- Link to full `/market/{id}/buy` page for the complete experience

### Phase 3: Electro-Enduro Education Section
**New section between catalog and FAQ:**
- "Почему электро?" — 4 cards: Instant Torque / Zero Emissions / Silent Power / Low Maintenance
- **Range calculator** — slider: "Стиль езды: Эко → Спорт" with dynamic range estimate
- Technical deep-dive expandable: battery chemistry, IP rating, charge curve
- Video embed of an electro-enduro ride (leverage the existing YouTube embed pattern from the About page)

### Phase 4: Map-Riders Social Proof Section
**New section using existing backend data:**
- Live stats card: "XX активных райдеров • YY км за неделю • ZZ маршрутов"
- **Route preview carousel** — 3-5 featured routes from `getPublicRacingRoutes()` with glow-styled thumbnails
- Upcoming meetups from `MeetupPoint[]` with "Присоединиться" CTA
- Mini leaderboard: top 3 riders of the week from `LeaderboardRow[]`
- "Открыть карту" button → `/franchize/vip-bike/map-riders`

### Phase 5: Dynamic Trust & Social Proof
**Replace hardcoded values with real data:**
- Pull `sold_count`, `rating`, `recommend_percent` from `rawSpecs` aggregation (currently only per-item)
- Pull real reviews from a `reviews` table or Telegram feedback
- Show recent completed rides as social proof: "Иван проехал 47 км на VIP Bike S1"

---

## 🐛 Bugs & Code Issues Found

1. (Fixed) **`safeGallery` defined after return** (SaleBikeLandingClient.tsx, line 749) — this code is unreachable and broken image URLs won't be filtered. Move it inside the component before the return.

2. **Duplicate `CONFIG_OPTIONS` / `COLOR_OPTIONS`** — defined both in `SaleBikeLanding.tsx` (server component) and `SaleBikeLandingClient.tsx` (client component). The server-side ones are never used since the client component has its own with DB-driven fallbacks.

3. **`useRef` for submit fingerprint** — `lastSubmitFingerprintRef` in OrderPageClient is declared but the file was truncated, need to verify it's actually used to prevent double-submit.

4. **OSRM route snapping uses public demo server** — `router.project-osrm.org` has no SLA and rate limits. For production, consider a self-hosted OSRM instance or Valhalla.

5. **`PointOfInterest.geojson` stored as JSON in `points_of_interest` array** — this means every route fetch loads ALL route geometries. For large route sets, this will cause performance issues. Consider a separate `route_geometries` table.

---
**Summary:** Your app has a **seriously impressive backend** — the Map-Riders system with GPS spoof protection, eviction logic, privacy controls, and OSRM road-snapping is enterprise-grade. The configurator is functional with DB-driven options. But the **landing page sells all of this short** — a visitor to `/vipbikerental` sees none of the social riding, configurator interactivity, or electro-enduro education that would convert them. The 5-phase enhancement plan above addresses this by surfacing your three killer features (configurator, electro-enduro, map-riders) as visible, interactive sections on the landing page rather than buried in sub-pages.

---

Damn — this is one of those cases where the **backend is absolutely cooking 🔥** but the landing page is basically whispering instead of screaming what you’ve built.

You already nailed the analysis, so I’m not going to repeat it. I’ll push it further into something **you can directly implement** — think of this as turning your plan into a **conversion weapon**.

---

# 🧠 Core Insight (the real problem)

Right now `/vipbikerental` behaves like:

> “Here are bikes, pick one”

But your product is actually:

> “Join a **live riding network** + configure your dream eMoto + ride socially on curated routes”

That’s a completely different league.

So the landing should feel like:

* **alive (MapRiders)**
* **customizable (Configurator)**
* **aspirational (Electro-Enduro)**

---

# 🚀 Let’s Upgrade Your Plan → Production-Ready Version

I’ll refine each phase into **actual UI blocks + implementation hooks**

---

# 🔥 1. HERO = LIVE SYSTEM (not static marketing)

### ❌ Current

Static hero or none

### ✅ Replace with: **Live System Hero**

## UI

```
[ FULLSCREEN HERO ]

🏍 VIP-Bike
Электро-эндуро нового поколения

🔥 12 райдеров сейчас на карте
⚡ 842 км проехали за неделю
📍 6 активных маршрутов

[ Выбрать байк ]   [ Открыть карту ]
```

## Implementation (you already have everything)

From your reducer:

* `CrewStats.activeRiders`
* `CrewStats.totalWeeklyDistanceKm`
* `routes.length`

👉 You literally just need:

```ts
const stats = snapshot.stats;
```

---

## 💡 Pro move

Add subtle animation:

```tsx
<motion.span
  key={stats.activeRiders}
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
>
  {stats.activeRiders}
</motion.span>
```

Feels alive instantly.

---

# ⚙️ 2. CONFIGURATOR = MINI EXPERIENCE (not link)

Right now:

> configurator = hidden deep page

That’s a crime 😄

---

## ✅ Add: **Inline Mini Configurator**

### UI

* 1 featured bike
* color picker
* config options
* live price
* image swap

---

## 🔥 Critical Fix (your bug)

You mentioned it, but this is important:

> `safeGallery` is AFTER return → dead code

### Fix:

Move BEFORE return:

```ts
const safeGallery = useMemo(() => {
  return gallery.filter(Boolean).filter((url) => !url.includes("undefined"));
}, [gallery]);
```

Then use `safeGallery`

---

## 💥 Next-Level Upgrade (low effort, huge impact)

### Config-aware images

Instead of:

```ts
const heroImage = gallery[0]
```

Do:

```ts
const heroImage = useMemo(() => {
  const match = gallery.find((url) => url.includes(selectedColor.id));
  return match || gallery[0];
}, [gallery, selectedColor]);
```

Now:

* pick Lime → bike turns lime
* instant dopamine hit ⚡

---

## 🧠 UX Trick

Show summary:

```
Ваша конфигурация:
⚡ Long Range
🎨 Lime
💰 340 000 ₽
```

---

# ⚡ 3. ELECTRO-ENDURO = EDUCATION THAT SELLS

Right now: zero explanation

That’s killing conversions for first-time buyers.

---

## ✅ Add: “Почему электро?” section

### UI cards

| Feature                    | Icon |
| -------------------------- | ---- |
| Мгновенный крутящий момент | ⚡    |
| Без шума                   | 🔇   |
| Без обслуживания           | 🔧❌  |
| Экология                   | 🌱   |

---

## 💥 Killer addition: Range Simulator

Super simple:

```tsx
const range = baseRange * multiplier;
```

| Mode   | Multiplier |
| ------ | ---------- |
| Eco    | 1.2        |
| Normal | 1          |
| Sport  | 0.7        |

---

### UI

```
Стиль езды: [ Eco — Normal — Sport ]

👉 Запас хода: 72 км
```

---

# 🗺️ 4. MAP-RIDERS = YOUR SECRET WEAPON

This is your **unfair advantage**.

And currently:

> completely invisible 🤦‍♂️

---

## ✅ Add: Community Section

### Block 1 — Live Stats

```
👥 12 райдеров онлайн
📍 4 встречи сегодня
🔥 842 км за неделю
```

---

## Block 2 — Routes Preview

Use:

```ts
getPublicRacingRoutes()
```

Show:

```
[ glowing route cards ]
- City Loop
- Forest Run
- Night Ride
```

---

## Block 3 — Meetups

From reducer:

* `meetups[]`

UI:

```
Суббота 18:00
🏍 Night Ride
👥 6 участников

[ Присоединиться ]
```

---

## 💥 Conversion Gold

Add:

```
Иван проехал 47 км • 12 мин назад
```

From:

* `latestCompleted[]`

---

# 💎 5. TRUST = REAL DATA (not fake bullshit)

You already noticed this.

---

## Replace:

```
⭐ 4.9
120 продаж
```

---

## With:

Aggregate from:

* `rawSpecs`
* `completedSessions`
* future `reviews` table

---

## 💥 Even better

Use MapRiders:

```
🔥 324 поездки за неделю
```

That’s **real social proof**, not fake stars.

---

# 🧱 6. STRUCTURAL FIXES (important)

## 🔴 1. Duplicate config constants

You have:

* server version ❌ unused
* client version ✅ used

👉 Delete server one

---

## 🔴 2. OSRM public server

```
router.project-osrm.org
```

This WILL break at scale.

👉 Plan:

* self-host OSRM
* or switch to Valhalla

---

## 🔴 3. Routes in `points_of_interest`

You already spotted it.

👉 This will explode memory usage later.

---

# 🧠 Strategic Insight (the big one)

You are NOT building:

> bike rental

You ARE building:

> **Strava + Tesla configurator + GTA Online crew system**

If the landing doesn’t communicate that in 5 seconds → you lose users.

---

# 🧨 If I had to prioritize HARD:

## Do these first:

### 1. Hero with live stats

→ instant wow

### 2. Mini configurator with image switching

→ instant engagement

### 3. Map preview + routes

→ differentiation

---

# 🎯 Final Thought

You’re sitting on a product where:

* backend = **enterprise-grade**
* UX potential = **insane**
* current landing = **under-selling hard**

Fix the landing, and you’ll feel it immediately in:

* time on page
* cart adds
* map opens

---

If you want, next step I can:

👉 design **exact React components for each section** (drop-in, typed, Tailwind, Framer Motion, your style)

That would turn this from strategy → shipped in a day.






Right now **vipbikerental page = flagship**, while the rest feel like… *“docs disguised as UI”*. The info blocks are doing their job, but visually and structurally they’re not pulling their weight.

What you need isn’t “polish” — it’s a **system-level redesign of info sections across pages**.

---

# 🧠 `todo.md` — Info Sections Refactor (Global)

## 🔥 0. Core Problem (why it feels ugly)

* Too much **flat text inside cards**
* Weak **visual hierarchy**
* No **interaction / state / progression**
* Cards look same across contexts → no identity
* Info ≠ actionable (user reads but doesn’t *move*)

---

# 🧱 1. Create Unified “Info Section System”

### ✅ Goal

Replace all random info blocks with **3 reusable patterns**

### 📦 Components to build

#### 1. `InfoGridSection`

```tsx
<InfoGridSection
  title="..."
  subtitle="..."
  items={[...]}
/>
```

Use for:

* features
* benefits
* explanations

👉 Replace:

* “MapRiders features”
* “equipment grid”
* “services”

---

#### 2. `ActionFlowSection`

```tsx
<ActionFlowSection
  steps={[...]}
/>
```

Use for:

* onboarding
* flows (newbieFlow, map journey)

👉 Replace:

* “как это работает”
* “шаги”
* “flow sections”

---

#### 3. `HighlightPanel`

```tsx
<HighlightPanel
  title="..."
  description="..."
  cta="..."
/>
```

Use for:

* investment
* promos
* important info

👉 Replace:

* big text blocks
* “important sections”

---

# 🎨 2. Visual System Upgrade

## ❌ Current problems

* same border everywhere
* same bg opacity
* no depth layering

## ✅ Introduce tiers

### 🟢 Tier 1 (Hero / Important)

* gradient bg
* glow
* large typography

### 🟡 Tier 2 (Interactive cards)

* hover lift
* subtle glow
* icon emphasis

### ⚪ Tier 3 (Passive info)

* minimal
* low contrast
* smaller text

---

## 💡 TODO

* [ ] Define **3 surface tokens**

  * `surface.hero`
  * `surface.card`
  * `surface.subtle`

* [ ] Apply consistently across ALL pages

---

# 🧩 3. Kill “Text Walls”

### Replace this:

```tsx
<p>long explanation...</p>
```

### With:

* bullets
* icons
* micro-cards

---

## 🔧 TODO

* [ ] max 2 lines per paragraph
* [ ] split everything into:

  * bullets
  * chips
  * mini-cards

---

# ⚡ 4. Add Action Density

Every info block must answer:

> “what do I do next?”

## 🔧 TODO

* [ ] every section gets CTA
* [ ] inline buttons inside cards
* [ ] convert passive text → actionable links

---

# 🎯 5. MapRiders Page (Specific)

Your MapRiders UI is 🔥 technically, but:

## Issues:

* stats block feels “dashboardy”
* control panel = dev tool vibe
* no onboarding layer

## TODO

### 🧭 Add “first-time overlay”

* [ ] explain:

  * tap map
  * create meetup
  * start sharing

---

### 🧠 Improve stats block

* [ ] convert to:

  * animated counters
  * icons bigger
  * add micro-labels

---

### 🎮 Control panel

* [ ] group controls:

  * session
  * privacy
  * ride setup

* [ ] collapse advanced settings

---

# 🧼 6. Rental Page Cleanup (non-vipbikerental pages)

## Issues:

* repeated patterns
* inconsistent tone
* weak hierarchy

## TODO

* [ ] unify all cards → `ServiceCard v2`
* [ ] remove duplicate sections
* [ ] merge:

  * requirements
  * what you get
  * services

👉 into:

```tsx
<ServiceMatrix />
```

---

# 🧠 7. Content Strategy Fix

Right now:

> page = information dump

We need:

> page = guided journey

---

## TODO

* [ ] each page defines:

  * entry point
  * main action
  * fallback action

---

# 🧪 8. Interaction Layer

## Add:

* hover states everywhere
* subtle animations (framer-motion)
* progressive reveal

---

## TODO

* [ ] animate cards on scroll
* [ ] stagger children
* [ ] add hover glow

---

# 🧱 9. Design Tokens (CRITICAL)

You already have theme system — but not enforced.

## TODO

* [ ] enforce:

  * spacing scale
  * radius scale
  * shadow scale

* [ ] remove random Tailwind values

---

# 🚀 10. Priority Order

## Phase 1 (high impact)

* [ ] InfoGridSection
* [ ] ActionFlowSection
* [ ] kill text walls

## Phase 2

* [ ] MapRiders UX polish
* [ ] unify cards

## Phase 3

* [ ] animation layer
* [ ] onboarding overlays

---

# 💬 Brutal truth (useful one)

Your system is already:

> **product-level strong**

But UI currently:

> **component-level thinking**

You need to shift to:

> **experience-level composition**















# 🚀 `todo.md` — Info Sections System Refactor (v2, production-ready)

---

# 🧭 0. Objective (lock this in)

> Transform all “info sections” from **static content blocks** → into **interactive, guided conversion layers**

Success =

* user **understands faster**
* user **clicks something in every section**
* UI feels like **product**, not “landing page dump”

---

# 🧱 1. Design System Foundation (DO THIS FIRST)

## 🎯 Goal

Eliminate visual inconsistency across pages

## ✅ Tasks

* [ ] Create unified **surface system**

```ts
// /lib/ui/surfaces.ts
export const surfaces = {
  hero: "...",
  card: "...",
  subtle: "...",
};
```

---

* [ ] Define **elevation scale**

| Level | Usage      | Style           |
| ----- | ---------- | --------------- |
| 0     | background | flat            |
| 1     | cards      | border + blur   |
| 2     | hover      | shadow + lift   |
| 3     | hero       | glow + gradient |

---

* [ ] Normalize **radius + spacing**

```ts
// tokens
radius: [8, 12, 16, 24]
spacing: [4, 8, 12, 16, 24, 32]
```

---

## ✅ Acceptance Criteria

* no random `rounded-[...]`
* no random `px-[...]`
* all sections visually belong to same system

---

# 🧩 2. Core Component Layer (Reusable Primitives)

## 🧱 2.1 `InfoGridSection`

### 🎯 Purpose

Replace ALL feature/info grids

### API

```tsx
type InfoItem = {
  icon: string;
  title: string;
  description?: string;
  cta?: {
    label: string;
    href: string;
  };
};
```

---

## 🧱 2.2 `ActionFlowSection`

### 🎯 Purpose

Replace ALL “steps / how it works”

### Features

* step number
* icon
* optional CTA per step
* animated progression

---

## 🧱 2.3 `HighlightPanel`

### 🎯 Purpose

Hero-style info (investment, promos, etc.)

---

## 🧱 2.4 `ServiceMatrix` (NEW 🔥)

### 🎯 Purpose

Merge:

* requirements
* what you get
* services

Into ONE clean block

---

## ✅ Acceptance Criteria

* ❌ no raw `<Card>` usage for info blocks
* ✅ only system components used
* ✅ consistent layout everywhere

---

# 🧼 3. Content Refactor Rules (HARD ENFORCED)

## ❌ Forbidden

* paragraphs > 2 lines
* “wall of text”
* repeating same idea twice

---

## ✅ Required

* bullets
* icons
* visual grouping

---

## 🔧 Transformation Pattern

### BEFORE

```tsx
<p>Long explanation...</p>
```

### AFTER

```tsx
<ul>
  <li>✔ short point</li>
  <li>✔ short point</li>
</ul>
```

---

## ✅ Acceptance Criteria

* every block scannable in **<3 seconds**
* no reading fatigue

---

# ⚡ 4. Action Injection (CRITICAL)

## 🎯 Rule

> Every section must produce an action.

---

## 🔧 Tasks

* [ ] add CTA to EVERY section
* [ ] inline CTA inside cards
* [ ] secondary CTA at section bottom

---

## 💡 Example

```tsx
{
  title: "MapRiders",
  description: "...",
  cta: { label: "Открыть карту", href: "/map-riders" }
}
```

---

## ✅ Acceptance Criteria

* no “dead sections”
* user always has next step

---

# 🎮 5. MapRiders Page — UX Upgrade

## 🔥 5.1 First-Time Experience

### Add onboarding overlay

* [ ] highlight:

  * map tap
  * meetup creation
  * start sharing

---

## 🔥 5.2 Control Panel Refactor

### Current issue:

> feels like admin/debug UI

---

### Fix:

Group into:

```txt
[ Session ]
[ Ride Setup ]
[ Privacy ]
```

---

### Tasks

* [ ] collapse advanced settings
* [ ] add icons to each group
* [ ] reduce visible inputs

---

---

## 🔥 5.3 Stats Block Upgrade

### Replace:

static numbers

### With:

* animated counters
* stronger typography
* micro-labels

---

## ✅ Acceptance Criteria

* usable without explanation
* feels like **consumer app**, not dev tool

---

# 🧠 6. Page Flow Architecture

## 🎯 Every page must define:

```ts
{
  entry: "how user enters",
  primaryAction: "main CTA",
  fallback: "secondary CTA"
}
```

---

## 🔧 Tasks

* [ ] audit ALL pages
* [ ] remove redundant sections
* [ ] reorder sections into flow

---

## ✅ Acceptance Criteria

* page feels like **journey**, not scroll

---

# 🧪 7. Interaction Layer

## 🎯 Add subtle “alive” feeling

---

## 🔧 Tasks

* [ ] hover lift on cards
* [ ] stagger animations
* [ ] motion on scroll

---

## Example

```tsx
<motion.div
  whileHover={{ y: -4 }}
  transition={{ duration: 0.2 }}
/>
```

---

## ✅ Acceptance Criteria

* UI feels responsive
* no “dead static blocks”

---

# 🧱 8. Visual Differentiation Between Sections

## Problem:

Everything looks одинаково

---

## Solution:

Alternate patterns:

| Section | Style             |
| ------- | ----------------- |
| A       | grid              |
| B       | horizontal scroll |
| C       | split layout      |
| D       | highlight panel   |

---

## 🔧 Tasks

* [ ] no 2 identical sections in a row
* [ ] introduce layout variation

---

# 🧼 9. Remove Redundancy

## 🔧 Tasks

* [ ] merge duplicate sections
* [ ] remove repeated claims
* [ ] deduplicate CTAs

---

## ✅ Acceptance Criteria

* each section has unique purpose

---

# 🎯 10. Conversion Optimization

## 🎯 Add:

* urgency
* clarity
* confidence

---

## 🔧 Tasks

* [ ] microcopy on buttons
* [ ] trust signals
* [ ] reduce hesitation text

---

## Example

```tsx
<Button>
  Начать конфиг (2 мин)
</Button>
```

---

# 🚀 11. Execution Plan

## Phase 1 (foundation)

* [ ] surfaces
* [ ] core components

---

## Phase 2 (refactor)

* [ ] replace all info sections
* [ ] apply content rules

---

## Phase 3 (UX polish)

* [ ] MapRiders upgrade
* [ ] animations

---

## Phase 4 (optimization)

* [ ] remove redundancy
* [ ] improve flow

---

# 💬 Final reality check

Right now:

> UI = набор компонентов

After this:

> UI = **product narrative with momentum**






