# PRD: Lifecycle Messaging for VIP Bike Rental Customers

**Status:** Draft v0.3 · 2026-08-22
**Author:** Super Z (with corrections from PRD creator review + operator feedback + external review)
**Target surface:** Telegram bot direct messages (NOT web app notifications)
**Primary scope:** Feature 1 — immediate post-rental review request. Ship this first, measure, then decide on the rest.
**Time estimates:** Iterations with the AI agent. Feature 1 = 1-2 iterations. Features 2-4 = future PRDs, not this document.

---

## 1. Business Context (real numbers, not estimates)

| Metric | Value | Source |
|---|---|---|
| Total rentals (all-time) | 74 | `SELECT count(*) FROM rentals` |
| Unique real customers | 9 | `SELECT count(DISTINCT user_id) FROM rentals WHERE user_id != '356282674'` |
| One-time customers | 89% (8 of 9) | Same query, `HAVING count(rental_id) = 1` |
| Peak month (Jul 2026) | 34 rentals | `GROUP BY date_trunc('month', created_at)` |
| Yandex Maps reviews | 5 | Manual count on Yandex Maps org page |
| Crew members | 4 active | `SELECT count(*) FROM crew_members WHERE membership_status='active'` |
| DOB coverage | ~95% (both /doc and web checkout collect it) | See §4.2 |

**Natural rental frequency:** 1-3 times per year per customer. This is NOT a daily-use product. Gamification doesn't work here — lifecycle marketing does.

---

## 2. Problem Statement

| Current state | Impact |
|---|---|
| Post-rental review rate: ~0% (5 reviews on Yandex Maps, all organic) | No social proof for new customers |
| Existing closure receipt says "Будем рады отзыву" but it's buried in a wall of text with no link | The nudge exists but doesn't convert |
| No birthday/anniversary touch | Missed re-engagement window (future PRD) |
| No referral mechanism | No viral acquisition channel (future PRD) |
| New bikes added silently | Past renters don't know catalog is growing (future PRD) |

**This PRD focuses on the first row: post-rental review requests.** The other lifecycle features (birthday, referral, new-bike) are acknowledged as valuable but deferred to future PRDs pending Feature 1 validation.

---

## 3. What we're NOT building in this PRD (scope guard)

- ❌ Gamification engine (XP, badges, leaderboards, streaks, tiers, points ledger)
- ❌ Birthday gift card (Feature 2 — deferred; needs promo code infra verification first)
- ❌ Referral program (Feature 3 — deferred; it's really 3 features, needs its own PRD)
- ❌ New bike notification (Feature 4 — deferred; lowest priority, highest spam risk)
- ❌ Web app notification center / notification preferences UI
- ❌ Event bus / pub-sub abstraction
- ❌ A/B testing framework
- ❌ Email or SMS (TG only)
- ❌ Cross-crew features (vip-bike only for now)
- ❌ Real-time notifications (batched via cron where applicable)
- ❌ Delayed message scheduling (Vercel serverless can't hold a 2h `setTimeout`)

---

## 4. Feature 1: Post-Rental Review Request (the only feature in this PRD)

### 4.1 Trigger

Rental status transitions to `'completed'` via either:
- **Path A:** `confirmVehicleReturn()` at `app/rentals/actions.ts:1331` (line 1430 UPDATE)
- **Path B:** `updateRentalStatus()` at `app/franchize/server-actions/rentals-dashboard.ts:1920` (line 2022 UPDATE)

Both paths already send a closure receipt TG message to the renter. The receipt currently includes a buried "Спасибо за аренду! Будем рады отзыву." line — but no link, no button, no call-to-action.

### 4.2 Approach: Immediate second message (NOT delayed)

**Why immediate, not delayed:** Vercel serverless functions don't survive for 2 hours. A `setTimeout(2 * 60 * 60 * 1000)` would be killed when the function invocation ends. Adding a queue (Upstash QStash, pg_cron + pg_net, Vercel Cron polling every 15 min) is infrastructure overhead that Feature 1 doesn't need. **Immediate second message is the only approach that works without adding infrastructure.**

The receipt and the review request are sent as two separate messages back-to-back. Slightly less elegant than a 2h delay, but it works and requires zero new infrastructure.

### 4.3 Condition (gate the send)

Before sending the review request, check ALL of these:
- `rental.user_id` IS NOT NULL (renter linked via QR claim or web checkout)
- `rental.user_id` is NOT a crew member (don't send review requests to operators who test-rented their own bikes — check `crew_members` table)
- `users.metadata.notifications_disabled` is NOT `true` (opt-out)
- `rental.metadata.review_request_sent` is NOT set (dedup — 1 request per rental)
- `LIFECYCLE_MESSAGING_ENABLED` env var is NOT `'false'` (kill switch)

### 4.4 Channel

TG direct message from the bot, sent as a **separate message** immediately after the closure receipt.

### 4.5 Message template

```
👋 {renter_first_name}, спасибо за аренду {bike_make} {bike_model}!

Если понравилось — оставь отзыв на Яндекс Картах. Это помогает другим райдерам найти нас, а нам — расти:

⭐ [Оставить отзыв на Яндекс Картах]({reviews_link})

Занимает 30 секунд. Спасибо! 🙏
```

With an inline keyboard button (better mobile UX than markdown link):
```
[[{ text: "⭐ Оставить отзыв", url: <crew.reviewsLink from Supabase> }]]
```

Footer on every message:
```
Отправь STOP боту чтобы отключить такие уведомления.
```

### 4.6 Yandex Maps link source

**Dynamic from Supabase crew metadata** — already implemented at `app/franchize/actions-runtime.ts:951-955`:
```ts
reviewsLink: readPath(franchize, ["catalog", "reviewsLink"], readPath(franchize, ["reviewsLink"], "")),
```

Hydrated via `docs/crewDocs/vip-bike-franchize-hydration.sql:300` → currently resolves to `https://yandex.ru/maps/org/vip_bike_electro/81589395232/reviews/`.

The sender reads this from the crew row at send time — **never hardcode the URL**. The closure hook already has `crew_id` (from `rentals.crew_id`) → query `crews.metadata->catalog->reviewsLink` (or top-level `reviewsLink` fallback).

### 4.7 Dedup

After sending (or attempting to send), write to `rental.metadata.review_request_sent`:
```json
{
  "sent_at": "2026-08-22T14:30:00Z",
  "yandex_url": "https://yandex.ru/maps/org/vip_bike_electro/81589395232/reviews/",
  "succeeded": true
}
```

If the send fails:
```json
{
  "sent_at": "2026-08-22T14:30:00Z",
  "succeeded": false,
  "error": "Telegram API timeout"
}
```

This prevents retries AND lets us measure the send failure rate. Check this field before sending — if `review_request_sent` exists (regardless of `succeeded`), don't retry automatically. Failed sends are visible in the metadata for manual review.

### 4.8 Opt-out mechanism

**STOP/START via free-text bot command:**
- Bot receives "STOP" / "СТОП" / "stop" (case-insensitive) → set `users.metadata.notifications_disabled = true`
- Bot receives "START" / "СТАРТ" / "start" → set to `false`
- Confirmation message: "Уведомления отключены. Отправь START чтобы включить снова."

**Hook point:** `app/webhook-handlers/commands/command-handler.ts` — add a STOP/START check BEFORE the existing command routing (which expects `/`-prefixed commands). The handler already processes free-text via `handleDocText` / `handleEkipText` / `handleTestDriveText` — add a pre-command check that catches STOP/START before those handlers run.

**Limitation:** This is a boolean (all-or-nothing). If a customer wants to stop review requests but keep birthday messages, they can't. Acceptable for v1 — if this becomes a real complaint, build a notification preferences system in a future PRD.

### 4.9 Kill switch

Env var `LIFECYCLE_MESSAGING_ENABLED` (default: `'true'`). If set to `'false'`, all lifecycle messaging features are disabled. Checked at the top of every send function. Allows instant rollback without a code deploy (just change the env var in Vercel).

### 4.10 Failure handling

If `sendComplexMessage` throws (bot blocked by user, TG API timeout, rate limit):
1. **Log the error** via `logger.error('[review-nudge] send failed', { rentalId, error })`
2. **Write the failure to metadata** (see §4.7 — `succeeded: false, error: "..."`)
3. **Don't retry automatically** — failed sends are visible in the metadata for manual review
4. **Don't block the receipt** — the receipt and review nudge are separate `sendComplexMessage` calls; if the nudge fails, the receipt already succeeded

### 4.11 Anti-spam

- Max 1 review request per `rental_id` (via `metadata.review_request_sent`)
- If renter has < 3 lifetime rentals AND already received a review request in the last 90 days, skip (prevents spamming one-time customers who re-rent quickly)
- Daily message cap: max 2 lifecycle messages per renter per day (priority: review nudge > everything else). For v1 with only Feature 1, this cap is unlikely to trigger — but implement it now so Features 2-4 (when built) compose safely.

### 4.12 Existing code to modify

| File | Line | Change |
|---|---|---|
| `app/rentals/actions.ts` | 1583-1625 | Remove the buried "Будем рады отзыву" line from the receipt. After the receipt `sendComplexMessage` succeeds, call `sendReviewNudge(rental, crew)` (new helper). |
| `app/franchize/server-actions/rentals-dashboard.ts` | 2036-2064 | Same — remove buried nudge, add `sendReviewNudge()` call after receipt. |
| `app/webhook-handlers/commands/command-handler.ts` | ~55 (after `handleCommand` entry) | Add STOP/START free-text check before command routing. |
| `app/franchize/lib/lifecycle-messaging.ts` | New file | `sendReviewNudge(rental, crew)` helper: checks conditions, reads crew.reviewsLink, sends message, writes metadata dedup. |

---

## 5. Shared Infrastructure (minimal — no new tables)

### 5.1 Opt-out field
- `users.metadata.notifications_disabled` (boolean, default false)
- Set via STOP/START bot command (§4.8)
- Checked before every lifecycle send

### 5.2 Daily message cap
- `users.metadata.last_lifecycle_message_date` (ISO date string, e.g. `"2026-08-22"`)
- `users.metadata.lifecycle_messages_today` (number, reset to 0 when date changes)
- Max 2 lifecycle messages per renter per day
- Priority order: review nudge > birthday > referral > new bike
- For v1 (only Feature 1), this cap rarely triggers — but implementing it now prevents composition bugs when Features 2-4 are added

### 5.3 Kill switch
- Env var `LIFECYCLE_MESSAGING_ENABLED` (default `'true'`)
- Checked at the top of `sendReviewNudge()` and every future lifecycle send function
- Allows instant rollback without code deploy

### 5.4 Dedup pattern
| Field | Location | Purpose |
|---|---|---|
| `rental.metadata.review_request_sent` | `rentals.metadata` | 1 review nudge per rental + failure tracking |

### 5.5 Message sending
Uses `sendComplexMessage(chatId, text, buttons?, options?)` from `app/webhook-handlers/actions/sendComplexMessage.ts:88`. This is the canonical sender used everywhere in the codebase.

---

## 6. Pre-Flight Checks (run before writing any code)

### 6.1 Verify DOB format consistency (for future Feature 2)
```sql
SELECT renter_birth_date,
       renter_birth_date ~ '^\d{2}\.\d{2}\.\d{4}$' AS properly_formatted
FROM private.user_rental_secrets
WHERE renter_birth_date IS NOT NULL
LIMIT 20;
```
If any rows return `properly_formatted = false`, the birthday feature (Feature 2, future PRD) will need input normalization before the SQL query works.

### 6.2 Verify promo code generation capability (for future Features 2/3)
```bash
grep -n "INSERT INTO promotions" app/franchize/server-actions/promotions.ts
grep -n "export.*function.*create" app/franchize/server-actions/promotions.ts
```
If no `createPromoCode()` function exists, Features 2 (birthday) and 3 (referral) are blocked until one is built. This is a shared prerequisite, not a per-feature question.

### 6.3 Confirm VPS cron is running (for future Features 2/4)
Check that the existing VPS crontab is active:
```bash
# On the VPS:
crontab -l | grep boss-commands
# Should show: morning-standup, evening-summary, returns-reminder, etc.
```
If the VPS cron isn't running, Features 2 (birthday) and 4 (new bike) can't ship — they need daily cron. Feature 1 (review nudge) doesn't need cron — it's triggered inline by the rental closure hook.

### 6.4 Verify crew.reviewsLink is set
```sql
SELECT slug, metadata->'catalog'->>'reviewsLink' AS reviews_link
FROM crews
WHERE slug = 'vip-bike';
```
If `reviews_link` is NULL, the review nudge can't send a Yandex Maps button. Hydrate it first via `docs/crewDocs/vip-bike-franchize-hydration.sql`.

---

## 7. Implementation Plan

| Iteration | What ships | Depends on |
|---|---|---|
| 1 | `sendReviewNudge()` helper + inline call from `confirmVehicleReturn()` (Path A only) + dynamic `crew.reviewsLink` lookup + dedup metadata + kill switch | Pre-flight §6.4 (reviewsLink set) |
| 2 | STOP/START opt-out handler in `command-handler.ts` + daily message cap + failure logging | Iteration 1 |
| 3 (optional) | Inline call from `updateRentalStatus()` (Path B) — only if Path A doesn't cover all closure flows | Iteration 1 |

**Ship Iteration 1 first.** Measure for 2 weeks:
- How many review requests sent?
- How many Yandex Maps reviews appeared? (manual count)
- What's the opt-out rate?
- What's the send failure rate?

If opt-out rate > 15% or send failure rate > 10%, reconsider before building Features 2-4.

---

## 8. Metrics (realistic, measurable)

| Metric | Baseline | Target (2 weeks post-ship) | Measurement |
|---|---|---|---|
| Review requests sent | 0 | ~15 (half of monthly closures) | `count(rentals) WHERE metadata->'review_request_sent'->>'succeeded' = 'true'` |
| Yandex Maps reviews | 5 | 8-10 | Manual count on Yandex Maps |
| Opt-out rate | n/a | < 15% | `count(users) WHERE metadata->>'notifications_disabled' = 'true'` / `count(users messaged)` |
| Send failure rate | n/a | < 10% | `count(rentals) WHERE metadata->'review_request_sent'->>'succeeded' = 'false'` / `count(rentals) WHERE metadata ? 'review_request_sent'` |

---

## 9. Future Features (deferred — not in this PRD)

These are acknowledged as valuable but depend on Feature 1 validation + shared prerequisites:

### 9.1 Birthday Gift Card (was Feature 2)
- **Deferred because:** needs promo code generation capability (Pre-flight §6.2) + daily cron (Pre-flight §6.3)
- **Known bug to fix when built:** the SQL query must match the FIRST 5 characters of the DOB string (day.month), not the last 5. DOB is stored as `"DD.MM.YYYY"` — a customer born Aug 22 has DOB `"22.08.1990"`. The LIKE pattern `'%.08.22'` looks for month.day at the END, but the year is at the end. Correct query:
  ```sql
  -- Match first 5 chars (day.month) for today + next 7 days
  substring(renter_birth_date from 1 for 5) IN ('22.08', '23.08', '24.08', ...)
  -- Or anchored to start:
  renter_birth_date LIKE '22.08.%' OR renter_birth_date LIKE '23.08.%' OR ...
  ```
- **DOB coverage:** ~95% (both /doc and web checkout collect it). Pre-flight §6.1 verifies format consistency (zero-padding).

### 9.2 Referral Program (was Feature 3)
- **Deferred because:** it's really 3 features (code generation + checkout tracking + dual-side reward), needs its own PRD
- **Step 3a (code generation + TG suggestion):** 1 iteration. Measure adoption (how many renters share the code) before building 3b/3c.
- **Steps 3b/3c (checkout tracking + dual reward):** only if 3a shows adoption. Also blocked on promo code generation (Pre-flight §6.2).
- **Should NOT be bundled into this PRD.** When ready, write a separate `PRD_REFERRAL_PROGRAM.md`.

### 9.3 New Bike Notification (was Feature 4)
- **Deferred because:** lowest priority, highest spam risk
- **Design when built:** daily cron (not real-time hook — can't intercept all insert paths). Dedup via `cars.specs.announced_to_renters = true`. Per-renter dedup via `users.metadata.notified_bikes[]` (cap at 20, FIFO).
- **Anti-spam:** weekly digest if 3+ bikes added in one day. Consider segment-based targeting (only notify renters who rented a similar bike type).

---

## 10. Out of Scope (explicitly)

- **Gamification engine** — XP, badges, leaderboards, streaks, tiers, points ledger. Revisit when there are 50+ crews and thousands of renters.
- **Web app notification center** — customers don't open the web app between rentals. TG is the only channel that reaches them.
- **Event bus / pub-sub** — each feature calls `sendComplexMessage` directly at its hook point. No abstraction layer.
- **Email / SMS** — TG only. Email requires SMTP setup; SMS requires a paid provider.
- **Cross-crew features** — vip-bike only. Other crews don't have enough volume.
- **Real-time notifications** — review nudge is immediate (triggered by rental closure). Birthday + new-bike (when built) are batched via cron.
- **Notification preferences UI** — just STOP/START via TG. No web form for choosing which notifications to receive.
- **Delayed message scheduling** — Vercel serverless can't hold a `setTimeout` for hours. All v1 messages are immediate.
- **Features 2, 3, 4** — deferred to future PRDs. This document ships Feature 1 only.

---

## 11. What the external reviewer caught (bugs fixed in v0.3)

### Bug #1: Birthday SQL query never matches (FIXED in §9.1)

The v0.2 birthday query used `renter_birth_date LIKE '%.08.22'` — but DOB is stored as `"DD.MM.YYYY"`, so a customer born Aug 22 has DOB `"22.08.1990"`. The LIKE pattern `'%.08.22'` looks for month.day at the END of the string, but the year is at the end. The query would have returned zero rows forever.

**Fix:** documented in §9.1 (Future Features). The correct query matches the first 5 characters (day.month): `substring(renter_birth_date from 1 for 5) IN ('22.08', '23.08', ...)` or `renter_birth_date LIKE '22.08.%'`.

Also added Pre-flight §6.1 to verify DOB format consistency (zero-padding) before building Feature 2.

### Bug #2: 2-hour delay won't work on Vercel (FIXED in §4.2)

Vercel serverless functions don't survive for 2 hours. A `setTimeout(2 * 60 * 60 * 1000)` would be killed when the function invocation ends. The v0.2 "Alternative (simpler)" — immediate second message — is now the **primary and only approach** in v0.3. The 2h delay is removed entirely.

### Bug #3: Referral features 3b/3c also need promo code generation (FIXED in §6.2 + §9.2)

Open Question #1 flagged this for birthday but not for referral 3b/3c. It's a shared prerequisite. Pre-flight §6.2 now verifies promo code generation capability up front, and §9.2 notes that referral 3b/3c are blocked on the same prerequisite.

### Structural issue: Self-roast identified problems but didn't solve them (FIXED)

- **Scope creep:** v0.3 cuts Features 2, 3, 4 from the primary scope. They're now in §9 (Future Features) with brief design notes + known bugs, not full specs.
- **Referral = 3 features:** v0.3 explicitly says "should NOT be bundled into this PRD" and recommends a separate `PRD_REFERRAL_PROGRAM.md` when ready.
- **Daily message cap:** v0.3 adds it to Shared Infrastructure §5.2 (max 2 lifecycle messages per renter per day, priority order).
- **Kill switch:** v0.3 adds it to Shared Infrastructure §5.3 + §4.9 (env var `LIFECYCLE_MESSAGING_ENABLED`).
- **Failure logging:** v0.3 adds it to §4.7 (dedup metadata records `succeeded: false, error: "..."`) + §4.10 (failure handling).
- **Pre-flight checks:** v0.3 adds §6 with 4 concrete pre-flight queries to run before writing any code.

---

## 12. File Touch-List

| File | Change type | Iteration |
|---|---|---|
| `app/franchize/lib/lifecycle-messaging.ts` | **New** — `sendReviewNudge()` helper | 1 |
| `app/rentals/actions.ts` | Modify receipt message (remove buried nudge) + add `sendReviewNudge()` call | 1 |
| `app/franchize/server-actions/rentals-dashboard.ts` | Same — modify receipt + add nudge call | 3 (optional) |
| `app/webhook-handlers/commands/command-handler.ts` | Add STOP/START free-text handler | 2 |

---

*This PRD ships one feature. If that feature works (opt-out < 15%, review conversion > 15%), write PRDs for Features 2-4. If it doesn't, no code was wasted on birthday cron or referral tracking. Ship Feature 1, measure, decide.*
