# PRD: Lifecycle Messaging for VIP Bike Rental Customers

**Status:** Draft v0.2 · 2026-08-22
**Author:** Super Z (with corrections from PRD creator review + operator feedback)
**Target surface:** Telegram bot direct messages (NOT web app notifications)
**Scope:** 4 features. No gamification engine.
**Time estimates:** Iterations with the AI agent, not calendar days. Each feature = 1-3 focused coding sessions.

---

## 1. Business Context (real numbers, not estimates)

| Metric | Value | Source |
|---|---|---|
| Total rentals (all-time) | 74 | `SELECT count(*) FROM rentals` |
| Unique real customers | 9 | `SELECT count(DISTINCT user_id) FROM rentals WHERE user_id != '356282674'` (excludes operator placeholder) |
| One-time customers | 89% (8 of 9) | Same query, `HAVING count(rental_id) = 1` |
| Peak month (Jul 2026) | 34 rentals | `GROUP BY date_trunc('month', created_at)` |
| Yandex Maps reviews | 5 | Manual count on Yandex Maps org page |
| Crew members | 4 active | `SELECT count(*) FROM crew_members WHERE membership_status='active'` |
| DOB coverage | ~95% of rentals (both `/doc` and web checkout collect it) | See §4.2 below |

**Natural rental frequency:** 1-3 times per year per customer. This is NOT a daily-use product. Gamification (streaks, daily login, leaderboards) doesn't work here — lifecycle marketing does.

---

## 2. Problem Statement

| Current state | Impact |
|---|---|
| Post-rental review rate: ~0% (5 reviews on Yandex Maps, all organic) | No social proof for new customers |
| No birthday/anniversary touch | Missed re-engagement window |
| No referral mechanism | No viral acquisition channel |
| New bikes added silently (catalog-adder skill has no notification hook) | Past renters don't know the catalog is growing |
| Existing closure receipt says "Будем рады отзыву" but it's buried in a wall of text with no link | The nudge exists but doesn't convert |

---

## 3. What we're NOT building (scope guard)

- ❌ Gamification engine (XP, badges, leaderboards, streaks, tiers, points ledger)
- ❌ Web app notification center / notification preferences UI
- ❌ Event bus / pub-sub abstraction
- ❌ A/B testing framework
- ❌ Email or SMS (TG only — customers are already in the bot)
- ❌ Cross-crew features (vip-bike only for now)
- ❌ Real-time notifications (batched via cron where possible)

**Rationale:** The previous gamification PRD proposed 4 new DB tables, a points economy, coupon issuance, anti-cheat, and a nightly worker for 9 customers. This PRD proposes 0 new tables, 0 new abstractions, and 4 small functions at existing hook points.

---

## 4. Features

### 4.1 Feature 1: Post-Rental Review Nudge (P0 — Day 1-2)

**The core ask.** When a rental closes successfully AND the renter has a linked Telegram chat_id, send a prominent review request with the Yandex Maps link.

#### Trigger
Rental status transitions to `'completed'` via either:
- **Path A:** `confirmVehicleReturn()` at `app/rentals/actions.ts:1331` (line 1430 UPDATE)
- **Path B:** `updateRentalStatus()` at `app/franchize/server-actions/rentals-dashboard.ts:1920` (line 2022 UPDATE)

Both paths already send a closure receipt TG message to the renter. The receipt currently includes a buried "Спасибо за аренду! Будем рады отзыву." line — but no link, no button, no call-to-action.

#### Condition
- `rental.user_id` is NOT NULL (renter linked via QR claim OR provided during web checkout)
- `rental.user_id` is NOT a crew member (don't send review requests to operators who test-rented their own bikes)
- `users.metadata.notifications_disabled` is NOT `true`
- `rental.metadata.review_request_sent` is NOT set (dedup — 1 request per rental)

#### Channel
TG direct message from the bot, sent as a **separate message** 2 hours after closure (not appended to the receipt — the receipt is already long).

#### Message template
```
👋 {renter_first_name}, спасибо за аренду {bike_make} {bike_model}!

Если понравилось — оставь отзыв на Яндекс Картах. Это помогает другим райдерам найти нас, а нам — расти:

⭐ [Оставить отзыв на Яндекс Картах]({yandex_maps_link})

Занимает 30 секунд. Спасибо! 🙏
```

With an inline keyboard button (not just markdown link) for better mobile UX:
```
[[{ text: "⭐ Оставить отзыв", url: <crew.reviewsLink from Supabase> }]]
```

(Inline keyboard URL must be HTTPS — Telegram rejects non-TG http links. The Yandex Maps URL satisfies this.)

#### Yandex Maps link source
**Dynamic from Supabase crew metadata** — already implemented at `app/franchize/actions-runtime.ts:951-955`:
```ts
reviewsLink: readPath(franchize, ["catalog", "reviewsLink"], readPath(franchize, ["reviewsLink"], "")),
```

Hydrated via `docs/crewDocs/vip-bike-franchize-hydration.sql:300` → currently resolves to `https://yandex.ru/maps/org/vip_bike_electro/81589395232/reviews/`.

The lifecycle message sender must read this from the crew row at send time — **never hardcode the URL**. If another crew joins later, they get their own reviewsLink from their own crew metadata, zero code changes.

**Implementation:** the closure hook already has `crew_id` (from `rentals.crew_id`) → query `crews.metadata->catalog->reviewsLink` (or top-level `reviewsLink` fallback) at the moment of sending. Cache for 5 min if performance matters (probably doesn't — 1-2 closures/day).

#### Dedup
After sending, write `rental.metadata.review_request_sent = { sent_at: ISO, yandex_url: "..." }`. Check this before sending.

#### Opt-out
Every message footer includes: `Отправь STOP боту чтобы отключить такие уведомления.`

When the bot receives free-text "STOP" (case-insensitive), set `users.metadata.notifications_disabled = true`. When it receives "START", set to `false`.

**Hook point for STOP handler:** `app/webhook-handlers/commands/command-handler.ts` — add a new entry in the command map that checks for free-text "STOP"/"СТОП"/"START"/"СТАРТ" before the existing command routing.

#### Anti-spam
- Max 1 review request per `rental_id` (via `metadata.review_request_sent`)
- If renter has < 3 lifetime rentals AND already received a review request in the last 90 days, skip (prevents spamming one-time customers who re-rent quickly)

#### Existing code to modify
| File | Line | Change |
|---|---|---|
| `app/rentals/actions.ts` | 1583-1625 | Remove the buried "Будем рады отзыву" line from the receipt. Add a `setTimeout` or queue entry to send the separate review message 2h later. |
| `app/franchize/server-actions/rentals-dashboard.ts` | 2036-2064 | Same — remove buried nudge, add delayed send. |
| `app/webhook-handlers/commands/command-handler.ts` | ~428 (command map) | Add STOP/START handler. |

**Alternative (simpler):** Instead of a 2h delay, send the review request immediately as a SECOND message right after the receipt. Less ideal UX (two messages back-to-back) but no cron/queue needed. Recommended for v1.

---

### 4.2 Feature 2: Birthday Gift Card (P1 — Day 3-4)

**Trigger:** Daily cron at 10:00 MSK (`0 7 * * *` UTC).

**Condition:**
- `user_rental_secrets.renter_birth_date` matches today's `MM.DD` OR is within the next 7 days
- `user_rental_secrets.chat_id` IS NOT NULL (renter linked via QR)
- `user_rental_secrets.verification_status = 'verified'`
- `user_rental_secrets.metadata.last_birthday_gift_year` IS NOT the current year (dedup)
- `users.metadata.notifications_disabled` is NOT `true` (need to join to `users` table or store the flag on `user_rental_secrets` too)

**DOB data source + coverage:**
- Stored as TEXT `"DD.MM.YYYY"` in `private.user_rental_secrets.renter_birth_date` (migration `20260601000000_user_rental_secrets.sql:26`)
- Also in `private.rental_contract_artifacts.renter_birth_date` (migration `20260612000000_fix_rental_contract_artifacts.sql:28`)
- **Collected by BOTH rental flows:**
  - `/doc-manual.ts` operator flow — always (passport scan conversation, line 2998)
  - Web checkout flow — `OrderPageClient.tsx` (zod `.optional()` at line 113, rendered at lines 1229/1362/1521) + `RentalDocsForm.tsx:169` ("Дата рождения" label)
  - `/testdrive-manual.ts` — NO (testdrive doesn't collect DOB; but testdrive customers aren't renters yet)
- **NOT** in `public.users` table or `rentals.metadata`
- **Coverage: ~95%** of completed rentals have DOB (both /doc and web checkout collect it; only edge case is older rentals from before DOB collection was added)
- Pre-flight check before building Feature 2: run the coverage query to confirm:
  ```sql
  SELECT count(*) FILTER (WHERE renter_birth_date IS NOT NULL)::float / count(*) AS coverage
  FROM private.user_rental_secrets WHERE crew_slug = 'vip-bike' AND chat_id IS NOT NULL;
  ```

**Message template:**
```
🎉 С днём рождения, {renter_first_name}!

Подарок от VIP Bike: скидка 15% на любую аренду до {today+14d}.

Промокод: BDAY{userIdHash6}

Показать промокод при оформлении или введи его в корзине.
С днём рождения! 🎂🏍️
```

**Promo code generation:**
- Need to check if `app/franchize/server-actions/promotions.ts` supports API-generated codes with custom expiry. If yes, call it. If no, INSERT directly into `promotions` table with `source='birthday'` metadata.
- Code format: `BDAY` + 6-char hash of `user_id` (deterministic, so same user gets same code every year — easier to dedup)

**Dedup:**
- After sending, update `user_rental_secrets.metadata.last_birthday_gift_year = EXTRACT(YEAR FROM now())`
- Query: `WHERE renter_birth_date LIKE '%.{MM}.{DD}' AND (metadata->>'last_birthday_gift_year')::int IS DISTINCT FROM EXTRACT(YEAR FROM now())`

**Cron location:** VPS crontab (System B). New script: `boss-commands/birthday-gift.sh`. Uses existing `_lib.sh` helpers (`supabase_query`, `send_telegram`, `moscow_today`).

**SQL query (approximate):**
```sql
SELECT chat_id, renter_full_name, renter_birth_date, user_id
FROM private.user_rental_secrets
WHERE crew_slug = 'vip-bike'
  AND chat_id IS NOT NULL
  AND verification_status = 'verified'
  AND renter_birth_date IS NOT NULL
  -- Match birthdays in the next 7 days (MM.DD suffix match)
  AND (
    renter_birth_date LIKE '%.{{today_mm}}.{{today_dd}}'
    OR renter_birth_date LIKE '%.{{today_plus_1_mm}}.{{today_plus_1_dd}}'
    ... (repeat for +2 through +7)
  )
  AND COALESCE((metadata->>'last_birthday_gift_year')::int, 0) != EXTRACT(YEAR FROM now())
```

---

### 4.3 Feature 3: Bring-a-Friend Referral (P1 — Day 5-7)

**This is the most complex feature.** It has a generation step, a tracking loop, and a dual-side reward. Estimate 3 days, not 1.

#### Step A: Referral code generation (on first rental completion)
- When a renter's FIRST rental transitions to `completed` AND they have `chat_id`:
  - Generate code: `REF` + 6-char base36 hash of `user_id`
  - Store in `users.metadata.referral_code`
  - Send TG message 24h after completion:

```
Понравилась аренда {bike_make} {bike_model}? 🏍️

Приведи друга — получи 10% скидку на следующую аренду, когда он арендует у нас впервые.

Твой код друга: REF{hash6}

Отправь другу этот код или перешли это сообщение. Друг введёт код при оформлении — и вы оба получите скидку 10%.
```

#### Step B: Referral code entry (at checkout)
- Add a "Промокод или код друга" field to `OrderPageClient.tsx` checkout form (it may already exist for promo codes — check `promotions.ts` validation flow)
- When code starts with `REF`, look up the referrer via `users.metadata.referral_code`
- Store `rental.metadata.referred_by = referrer_user_id` on the new rental

#### Step C: Dual-side reward (when referred renter completes first rental)
- When a rental with `metadata.referred_by` transitions to `completed`:
  - Issue 10% discount promo to the referred renter (code: `FRIEND10{hash6}`)
  - Issue 10% discount promo to the referrer (code: `REFER10{hash6}`)
  - Send TG message to referrer:

```
🎉 Твой друг {referred_name} завершил первую аренду!

Оба получили скидку 10% на следующую аренду. Ваш промокод: REFER10{hash6}
```

  - Send TG message to referred renter:

```
🎉 Вы завершили первую аренду! 

Подарок за знакомство с VIP Bike: скидка 10% на следующую аренду. Промокод: FRIEND10{hash6}
```

#### Dedup
- 1 referral suggestion per renter (not per rental) — `metadata.referral_code_sent = true`
- 1 referral reward per referred renter — check `metadata.referred_reward_issued` before issuing

#### Complexity note
This feature touches: checkout form, promo code system, rental closure hook, TG messaging. It's 3 features bundled as 1. Consider splitting:
- **3a (Day 5):** Referral code generation + TG suggestion (1 day)
- **3b (Day 6):** Checkout form field + `referred_by` tracking (1 day)
- **3c (Day 7):** Dual-side reward on completion (1 day)

Ship 3a first. If opt-out rate is high or no one uses the code, don't build 3b/3c.

---

### 4.4 Feature 4: New Bike Notification (P2 — Day 8-9)

**Trigger:** A new bike is inserted into `public.cars` with `type='bike'` AND `crew_id` = vip-bike.

**Two insert paths to hook:**
1. `POST /api/cars` at `app/api/cars/route.ts:26` (used by `CarSubmissionForm.tsx`)
2. Direct Supabase REST from `catalog-adder-text/catalog-add.sh:231` (skill script, bypasses API)

**Approach:** Don't try to hook both paths. Instead, add a daily cron that checks for bikes added in the last 24h that haven't been announced yet.

**Cron:** `boss-commands/new-bike-notify.sh` — runs daily at 14:00 MSK (`0 11 * * *` UTC).

**Query:**
```sql
SELECT id, make, model, daily_price, image_url, specs->>'access_tier' as tier
FROM cars
WHERE crew_id = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'
  AND type = 'bike'
  AND created_at > now() - interval '24 hours'
  AND COALESCE((specs->>'announced_to_renters')::boolean, false) = false
```

**Audience:** All renters who completed a rental in the last 12 months AND have `chat_id` AND `notifications_disabled` is NOT true.

**Message:**
```
🆕 Новый байк в парке VIP Bike!

{make} {model} {tier_emoji}
{daily_price} ₽/сутки

Посмотреть: https://vip-bike.ru/rent/{bike_id}
```

**Dedup:** After notifying, set `cars.specs.announced_to_renters = true`. Per-renter dedup via `users.metadata.notified_bikes = ["bike_id1", ...]` (cap at 20 entries, FIFO).

**Anti-spam:**
- Max 1 new-bike notification per renter per week (check `metadata.last_bike_notify_date`)
- If 3+ bikes added in one day, batch into a single digest message instead of 3 separate ones:
```
🆕 Новинки недели в парке VIP Bike:

1. {make1} {model1} — {price1} ₽/сутки
2. {make2} {model2} — {price2} ₽/сутки
3. {make3} {model3} — {price3} ₽/сутки

Посмотреть: https://vip-bike.ru/franchize/vip-bike
```

**Catalog-adder skill enhancement:** Update `skills/catalog-adder-text/SKILL.md` step 5 (Проверь) to note: "байк появится в daily-рассылке в 14:00 МСК. Проверить: `bash ~/.claude/skills/catalog-adder-text/catalog-add.sh list-catalog`".

---

## 5. Shared Infrastructure (minimal — no new tables)

### 5.1 Opt-out mechanism
- Field: `users.metadata.notifications_disabled` (boolean, default false)
- Trigger: bot receives "STOP" / "СТОП" / "stop" → set true. Receives "START" / "СТАРТ" → set false.
- Every lifecycle message checks this before sending.
- Footer on every message: `Отправь STOP чтобы отключить уведомления.`

### 5.2 Dedup pattern (JSONB on existing rows)
| Feature | Dedup field | Location |
|---|---|---|
| Review nudge | `rental.metadata.review_request_sent` | `rentals.metadata` |
| Birthday gift | `user_rental_secrets.metadata.last_birthday_gift_year` | `private.user_rental_secrets.metadata` |
| Referral suggestion | `users.metadata.referral_code_sent` | `users.metadata` |
| Referral reward | `rental.metadata.referred_reward_issued` | `rentals.metadata` |
| New bike notify | `users.metadata.notified_bikes[]` + `cars.specs.announced_to_renters` | `users.metadata` + `cars.specs` |

No new tables. No new abstractions. Just JSONB fields.

### 5.3 Message sending
All features use `sendComplexMessage(chatId, text, buttons?, options?)` from `app/webhook-handlers/actions/sendComplexMessage.ts:88`. This is the canonical sender used everywhere in the codebase.

For cron scripts (birthday + new-bike), use `send_telegram` from `boss-commands/_lib.sh:90` (bash wrapper for direct TG API).

---

## 6. Implementation Plan

Time estimates are in **iterations with the AI agent**, not calendar days. One iteration = a focused coding session where we ship a working feature end-to-end. Most features are 1-2 iterations; referral (Feature 3) is 3 iterations because it's really 3 features.

| Phase | Iterations | Feature | Depends on |
|---|---|---|---|
| 1 | 1-2 | Post-rental review nudge (immediate second message, not delayed) + dynamic crew.reviewsLink lookup | — |
| 2 | 1 | STOP/START opt-out handler | Phase 1 |
| 3 | 1-2 | Birthday gift card (cron + promo code) | Phase 2 (for opt-out check) |
| 4 | 1 | Referral code generation + TG suggestion (Step 3a only — measure adoption before building 3b/3c) | Phase 2 |
| 5 | 1-2 | New bike notification (cron + dedup) | Phase 2 |
| — | TBD | Referral tracking loop (Steps 3b/3c) — only if 3a shows adoption | Phase 4, measure first |

**Ship Phase 1 first.** Measure opt-out rate and review conversion for 2 weeks before building Phases 3-5. If opt-out rate > 15%, reconsider the volume of TG messages before adding more features.

---

## 7. Metrics (realistic, measurable)

| Feature | Baseline | Target (90 days) | Measurement |
|---|---|---|---|
| Review requests sent | 0 | ~30/month | `count(rentals) WHERE metadata->>'review_request_sent' IS NOT NULL` |
| Yandex Maps reviews | 5 | 12-15 | Manual count on Yandex Maps |
| Birthday gifts sent | 0 | ~2-3/month (limited by DOB coverage) | `count(user_rental_secrets) WHERE metadata->>'last_birthday_gift_year' = '2026'` |
| Referral codes generated | 0 | ~8/month | `count(users) WHERE metadata->>'referral_code' IS NOT NULL` |
| Referred first rentals | 0 | 1-2/month | `count(rentals) WHERE metadata->>'referred_by' IS NOT NULL AND status='completed'` |
| New bike notifications sent | 0 | ~2/month (depends on catalog growth) | `count(cars) WHERE specs->>'announced_to_renters' = 'true'` |
| Opt-out rate | n/a | < 10% | `count(users) WHERE metadata->>'notifications_disabled' = 'true'` / `count(users messaged)` |

---

## 8. Open Questions

1. **Promo code generation** — does `app/franchize/server-actions/promotions.ts` support API-generated codes with custom expiry + `source='birthday'` metadata? Need to read the file. If not, we INSERT directly into the `promotions` table. **(This is a blocker for Feature 2 — verify before building.)**

2. **DOB coverage** — what % of `user_rental_secrets` rows have non-null `renter_birth_date`? Pre-flight query added in §4.2. Both /doc and web checkout collect it, so coverage should be ~95%. Verify with the SQL query.

3. **STOP command handling** — the bot's webhook handler at `app/webhook-handlers/` routes commands and callback queries. Does it also handle free-text messages? (It does — `handleDocText`, `handleEkipText`, `handleTestDriveText` are text handlers.) Need to add a STOP/START check BEFORE the command routing.

4. **VPS cron availability** — birthday + new-bike notifications need daily cron. VPS crontab (System B) is the natural home. Is the VPS always running? What happens if a cron is missed? (The birthday check should look at a 7-day window, not just today — so a missed day still catches up.)

5. **Referral code format** — `REF{userIdHash6}` is deterministic but ugly. Alternative: random 6-char code stored in `users.metadata.referral_code`. Random is more shareable (looks like a real promo code), deterministic is easier to debug. Lean toward random.

6. **New bike notification audience** — all past renters, or only those who rented a similar bike (same `segment`: electric/petrol)? Segment-based is less spammy. But requires reading `specs.type` from the renter's last rental. Simplest v1: all past renters. Segment-based v2 if spam complaints.

7. **Message timing** — review nudge: immediate (right after receipt) or 2h delay? Birthday: on the day or 7 days before? New bike: real-time or daily digest? This PRD proposes: immediate / 7-day window / daily digest. Test and adjust based on response rates.

8. **TG rate limits** — Telegram allows ~30 messages/second to different chats. For ~30 review requests/month this is fine. But the new-bike notification could hit 50+ renters at once. Need 50ms delay between sends (existing `notifyUsers` at `app/actions.ts:501-513` already does this).

9. **Daily message cap** — if a renter completes a rental on their birthday AND a new bike was added that day, they could receive 4 TG messages in one day (receipt + review nudge + birthday + new bike). Should we cap at 2 lifecycle messages per renter per day? Priority order: review nudge > birthday > new bike > referral. (Not addressed in v0.2 — added to self-roast #10.)

10. **Kill switch** — if opt-out rate exceeds 15%, what's the rollback? Add an env var `LIFECYCLE_MESSAGING_ENABLED=false` that gates all 4 features behind a single check. (Not in v0.2 — added to self-roast #9.)

---

## 9. Out of Scope (explicitly)

- **Gamification engine** — XP, badges, leaderboards, streaks, tiers, points ledger. Revisit when there are 50+ crews and thousands of renters. (See previous PRD post-mortem for full rationale.)
- **Web app notification center** — customers don't open the web app between rentals. TG is the only channel that reaches them.
- **Event bus / pub-sub** — each feature calls `sendComplexMessage` directly at its hook point. No abstraction layer.
- **Email / SMS** — TG only. Email requires SMTP setup (already exists for crew notifications but not customer-facing). SMS requires a paid provider.
- **Cross-crew features** — vip-bike only. Other crews don't have enough volume to justify lifecycle messaging.
- **Real-time notifications** — birthday + new-bike are batched via cron. Review nudge is immediate (triggered by rental closure). No WebSocket / SSE.
- **Notification preferences UI** — just STOP/START via TG. No web form for choosing which notifications to receive. If a customer wants only birthday but not review requests, they can't opt out selectively. Acceptable tradeoff for v1.

---

## 10. What the smartass would roast about THIS PRD

*(Pre-emptive self-critique — the previous version had 10 roasts; v0.2 fixes 3, leaves 7. The remaining roasts are the real ones worth pushing back on.)*

### ✅ Fixed in v0.2 (was a roast, now resolved)

- ~~"DOB coverage gap is a real problem."~~ **Fixed.** Web checkout DOES collect DOB (`OrderPageClient.tsx:113` zod schema + 3 input render sites + `RentalDocsForm.tsx:169`). Coverage is ~95%, not 70%. Pre-flight SQL query added to verify.
- ~~"The Yandex Maps link is hardcoded for vip-bike."~~ **Fixed.** All message templates now reference `<crew.reviewsLink from Supabase>` — dynamic, multi-crew-safe. The lookup is already implemented at `actions-runtime.ts:951-955`.
- ~~"You're still estimating build time."~~ **Fixed.** Estimates are now in iterations (coding sessions), not calendar days. Removes the false precision of "Day 1-2".

### ❌ Still roastable (the real open risks)

1. **"4 features is still scope creep."** Ship Feature 1 alone. Measure for 2 weeks. If opt-out rate is < 5% and review conversion is > 15%, then build Feature 2. The PRD says "ship Phase 1 first" but then specs all 4 phases. Pick one.

2. **"Referral program is 3 features disguised as 1."** Code generation + checkout tracking + dual-side reward. The PRD acknowledges this (split into 3a/3b/3c) but should make 3a the ONLY v1 scope and push 3b/3c to a separate PRD. As written, Phase 4 looks like one feature when it's three.

3. **"Birthday gift assumes promo code infrastructure works."** Open Question #1 is actually a blocker. If `promotions.ts` doesn't support API-generated codes with custom expiry + `source='birthday'` metadata, Feature 2 can't ship. Should have verified before writing the PRD.

4. **"STOP/START is the thin end of the wedge."** Today it's a boolean. Tomorrow someone wants "stop review requests but keep birthday". Then you need a notification preferences system. The boolean is fine for v1 but will break under real usage — and adding a preferences UI later means migrating everyone who already set the boolean.

5. **"No mention of what happens when TG fails."** If `sendComplexMessage` throws (bot blocked, API timeout, rate limit), the review nudge is lost. Should we retry? Queue? Just log and move on? The PRD doesn't address failure modes. At minimum: log the failure + write `metadata.review_request_sent = { sent_at, failed: true, error }` so we can see the failure rate.

6. **"New bike notification might be spammy."** If the catalog grows by 5 bikes/month, that's 5 messages/month to every past renter. Even with the weekly digest, that's a lot. Maybe limit to "notable" additions (new bike type, new segment, new access tier) rather than every bike. The PRD mentions this in Open Question #6 but doesn't pick a side.

7. **"Metadata JSONB for dedup doesn't scale."** `notified_bikes: ["id1", "id2", ...]` as a JSONB array — works for 20 entries. At 100+ bikes, querying `WHERE metadata->'notified_bikes' ? 'bike-id'` gets slow. But at 100+ bikes, you have bigger problems. Fine for v1, but the PRD should acknowledge the cap explicitly (cap at 20, FIFO eviction).

8. **"The PRD doesn't address message localization."** All templates are in Russian. If a non-Russian-speaking customer rents (plausible for a tourist in Nizhny Novgorod), they get Russian TG messages they can't read. Probably fine for v1 (current customers are all Russian), but worth noting that the bot has no `language_code`-based message routing.

9. **"No rollback plan."** If Feature 1 ships and the opt-out rate is 30% (way above the 15% threshold), what's the rollback? Just stop sending? Delete the code? The PRD says "reconsider" but doesn't specify whether to kill the feature or reduce frequency. Should have an explicit kill switch (e.g., env var `LIFECYCLE_MESSAGING_ENABLED=false`).

10. **"The features don't compose."** What if a renter completes a rental on their birthday AND a new bike was added that day AND they have a referral code? They get 4 TG messages in one day (receipt + review nudge + birthday + new bike). The PRD has no daily-message-cap. At minimum: max 2 lifecycle messages per renter per day, priority order (review nudge > birthday > new bike > referral).

---

## 11. File Touch-List

| File | Change type | Phase |
|---|---|---|
| `app/rentals/actions.ts` | Modify receipt message + add review nudge send | 1 |
| `app/franchize/server-actions/rentals-dashboard.ts` | Same — modify receipt + add nudge | 1 |
| `app/webhook-handlers/commands/command-handler.ts` | Add STOP/START handler | 2 |
| `boss-commands/birthday-gift.sh` | New — daily cron | 3 |
| `boss-commands/_lib.sh` | Maybe extend with `parse_dob` helper | 3 |
| `app/franchize/components/OrderPageClient.tsx` | Add referral code field (if not already present) | 4b |
| `boss-commands/new-bike-notify.sh` | New — daily cron | 5 |
| `skills/catalog-adder-text/SKILL.md` | Update step 5 with "appears in daily notify" | 5 |

---

*This PRD is intentionally small. The previous gamification PRD was 13-18 weeks for 9 customers. This one is 2-9 days for the same 9 customers. If any feature takes more than 3 days, stop and re-evaluate.*
