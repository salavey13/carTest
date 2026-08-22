# PRD: Lifecycle Messaging for VIP Bike Rental Customers

**Status:** Draft v0.4 · 2026-08-22
**Author:** Super Z (with corrections from PRD creator review + operator feedback + 2 external reviews)
**Target surface:** Telegram bot direct messages (NOT web app notifications)
**Primary scope:** Feature 1 — immediate post-rental review request. Ship this first, measure, then decide on the rest.
**Time estimates:** Iterations with the AI agent. Feature 1 = 1 iteration (both closure paths + opt-out integration).

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
| DOB coverage | ~95% (both /doc and web checkout collect it) | See §9.1 |

**Natural rental frequency:** 1-3 times per year per customer. This is NOT a daily-use product. Gamification doesn't work here — lifecycle marketing does.

---

## 2. Problem Statement

| Current state | Impact |
|---|---|
| Post-rental review rate: ~0% (5 reviews on Yandex Maps, all organic) | No social proof for new customers |
| Existing closure receipt says "Будем рады отзыву" but it's buried in a wall of text with no link | The nudge exists but doesn't convert |

**This PRD focuses on: post-rental review requests.** Birthday, referral, new-bike features are deferred to future PRDs pending Feature 1 validation.

---

## 3. What we're NOT building in this PRD (scope guard)

- ❌ Gamification engine (XP, badges, leaderboards, streaks, tiers, points ledger)
- ❌ Birthday gift card (Feature 2 — deferred; needs promo code infra verification)
- ❌ Referral program (Feature 3 — deferred; it's really 3 features, needs its own PRD)
- ❌ New bike notification (Feature 4 — deferred; lowest priority, highest spam risk)
- ❌ STOP/START bot command handler (already exists via profile dropdown — see §4.8)
- ❌ Web app notification center (already exists in profile dropdown)
- ❌ Event bus / pub-sub abstraction
- ❌ A/B testing framework
- ❌ Email or SMS (TG only)
- ❌ Cross-crew features (vip-bike only for now)
- ❌ Delayed message scheduling (Vercel serverless can't hold a `setTimeout` for hours)

---

## 4. Feature 1: Post-Rental Review Request (the only feature in this PRD)

### 4.1 Trigger

Rental status transitions to `'completed'` via either:
- **Path A:** `confirmVehicleReturn()` at `app/rentals/actions.ts:1331` (line 1430 UPDATE)
- **Path B:** `updateRentalStatus()` at `app/franchize/server-actions/rentals-dashboard.ts:1920` (line 2022 UPDATE)

Both paths already send a closure receipt TG message to the renter. The receipt currently includes a buried "Спасибо за аренду! Будем рады отзыву." line — but no link, no button, no call-to-action.

**Both paths are instrumented in Iteration 1.** The change to both files is identical (remove buried nudge, add `sendReviewNudge()` call after receipt). If one path turns out to be dead code, the call never fires and costs nothing. But we don't risk invisible failure by leaving one un-instrumented.

### 4.2 Approach: Immediate second message (NOT delayed)

**Why immediate, not delayed:** Vercel serverless functions don't survive for 2 hours. A `setTimeout(2 * 60 * 60 * 1000)` would be killed when the function invocation ends. Adding a queue (Upstash QStash, pg_cron + pg_net, Vercel Cron polling every 15 min) is infrastructure overhead that Feature 1 doesn't need. **Immediate second message is the only approach that works without adding infrastructure.**

The receipt and the review request are sent as two separate messages back-to-back. Slightly less elegant than a 2h delay, but it works and requires zero new infrastructure.

### 4.3 Condition (gate the send)

Before sending the review request, check ALL of these:
- `rental.user_id` IS NOT NULL (renter linked via QR claim or web checkout)
- `rental.user_id` is NOT a crew member (don't send review requests to operators who test-rented their own bikes — check `crew_members` table)
- `users.metadata.notifications_disabled` is NOT `true` (legacy field — kept for backward compat)
- `FranchizeNotificationPreferences.reviewRequests` is NOT `false` (new field — see §4.8)
- `rental.metadata.review_request_sent` is NOT set (dedup — 1 request per rental)
- `LIFECYCLE_MESSAGING_ENABLED` env var is NOT `'false'` (kill switch)

**Note on the denominator:** the true ceiling isn't "all closures" — it's closures where `rental.user_id` is linked AND the renter is not a crew member. If QR-claim linkage is ~80% of closures, the sendable pool is smaller than the total closure count. Some closures will correctly skip the send (operator-created test rentals, unlinked rentals) — that's the gate working, not the feature failing.

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

**No STOP footer in the message.** Opt-out is handled via the profile dropdown in the web app (§4.8). Adding "Отправь STOP боту" to every message would be noise — the customer can disable notifications in 2 clicks from the profile menu without remembering a bot command.

### 4.6 Yandex Maps link source

**Dynamic from Supabase crew metadata** — already implemented at `app/franchize/actions-runtime.ts:951-955`:
```ts
reviewsLink: readPath(franchize, ["catalog", "reviewsLink"], readPath(franchize, ["reviewsLink"], "")),
```

Hydrated via `docs/crewDocs/vip-bike-franchize-hydration.sql:300` → currently resolves to `https://yandex.ru/maps/org/vip_bike_electro/81589395232/reviews/`.

The sender reads this from the crew row at send time — **never hardcode the URL**. The closure hook already has `crew_id` (from `rentals.crew_id`) → query `crews.metadata->catalog->reviewsLink` (or top-level `reviewsLink` fallback).

### 4.7 Dedup + failure tracking

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

### 4.8 Opt-out mechanism (already exists — just extend it)

**The web app already has a notification preferences dropdown** in the profile menu (`app/franchize/components/FranchizeProfileButton.tsx:478-485`). It saves to `FranchizeNotificationPreferences` (type at `app/franchize/profile-actions.ts:51-55`):

```ts
export type FranchizeNotificationPreferences = {
  orderUpdates: boolean;
  mapRidersAlerts: boolean;
  marketingDigest: boolean;
};
```

Currently 3 toggles: "Статусы заказов", "MapRiders", "Редкие акции". The UI renders them via `NOTIFICATION_OPTIONS` array (lines 51-55).

**v0.4 change: add a 4th toggle:**
```ts
export type FranchizeNotificationPreferences = {
  orderUpdates: boolean;
  mapRidersAlerts: boolean;
  marketingDigest: boolean;
  reviewRequests: boolean;  // NEW — gates the post-rental review nudge
};
```

Add to `DEFAULT_NOTIFICATION_PREFERENCES` (line 43): `reviewRequests: true`.

Add to `NOTIFICATION_OPTIONS` (line 51):
```ts
{ key: "reviewRequests", label: "Отзывы после аренды", helper: "просьба оставить отзыв после завершения" },
```

The existing `saveFranchizeNotificationPreferencesAction` (line 288) already persists the whole object — no new server action needed. The existing `getFranchizeNotificationPreferencesAction` (line 267) already reads it.

**The `sendReviewNudge()` helper checks `reviewRequests !== false` before sending.** (Using `!== false` instead of `=== true` so that `undefined` / missing field defaults to "send" — backward-compatible with existing users who don't have the field set yet.)

**No STOP/START bot command needed.** The reviewer pointed out that shipping a STOP footer before the STOP handler exists is a UX gap — but since the profile dropdown already handles opt-out, we skip the bot command entirely. Customers who want to opt out do it from the profile menu in 2 clicks.

### 4.9 Kill switch

Env var `LIFECYCLE_MESSAGING_ENABLED` (default: `'true'`). If set to `'false'`, all lifecycle messaging features are disabled. Checked at the top of every send function. Allows instant rollback without a code deploy (just change the env var in Vercel).

### 4.10 Failure handling

If `sendComplexMessage` throws (bot blocked by user, TG API timeout, rate limit):
1. **Log the error** via `logger.error('[review-nudge] send failed', { rentalId, error })`
2. **Write the failure to metadata** (see §4.7 — `succeeded: false, error: "..."`)
3. **Don't retry automatically** — failed sends are visible in the metadata for manual review
4. **Don't block the receipt** — the receipt and review nudge are separate `sendComplexMessage` calls; if the nudge fails, the receipt already succeeded

### 4.11 Daily message cap

`users.metadata.last_lifecycle_message_date` (ISO date string) + `users.metadata.lifecycle_messages_today` (number, reset when date changes). Max 2 lifecycle messages per renter per day. Priority: review nudge > birthday > referral > new bike.

For v1 (only Feature 1), this cap rarely triggers. But implementing it now prevents composition bugs when Features 2-4 are added.

**Known limitation:** the cap uses read-modify-write on JSONB. If two lifecycle sends fire concurrently for the same user, both read `lifecycle_messages_today: 1`, both increment to 2, and the cap undercounts by 1. With ~30 closures/month and one feature, this will never trigger in v1. Acceptable — will matter only when Features 2-4 exist and a real counter (or a `lifecycle_messages` table) becomes justified.

### 4.12 Existing code to modify

| File | Line | Change |
|---|---|---|
| `app/rentals/actions.ts` | 1583-1625 | Remove the buried "Будем рады отзыву" line from the receipt. After the receipt `sendComplexMessage` succeeds, call `sendReviewNudge(rental, crew)` (new helper). |
| `app/franchize/server-actions/rentals-dashboard.ts` | 2036-2064 | Same — remove buried nudge, add `sendReviewNudge()` call after receipt. **Both paths instrumented in Iteration 1** — see §4.1 rationale. |
| `app/franchize/profile-actions.ts` | 51-55 | Add `reviewRequests: boolean` to `FranchizeNotificationPreferences` type. |
| `app/franchize/components/FranchizeProfileButton.tsx` | 43, 51-55 | Add `reviewRequests: true` to defaults + add toggle to `NOTIFICATION_OPTIONS` array. |
| `app/franchize/lib/lifecycle-messaging.ts` | New file | `sendReviewNudge(rental, crew)` helper: checks conditions, reads crew.reviewsLink, sends message, writes metadata dedup. |

---

## 5. Shared Infrastructure (minimal — no new tables)

### 5.1 Opt-out field
- `FranchizeNotificationPreferences.reviewRequests` (boolean, default true) — new field on existing type
- Set via profile dropdown (existing UI)
- Checked before every lifecycle send via `!== false` (backward-compatible)

### 5.2 Daily message cap
- `users.metadata.last_lifecycle_message_date` (ISO date string)
- `users.metadata.lifecycle_messages_today` (number, reset when date changes)
- Max 2 lifecycle messages per renter per day
- Priority: review nudge > birthday > referral > new bike
- **Known limitation:** read-modify-write race on JSONB — concurrent sends may exceed cap by 1. Acceptable for v1.

### 5.3 Kill switch
- Env var `LIFECYCLE_MESSAGING_ENABLED` (default `'true'`)
- Checked at the top of `sendReviewNudge()` and every future lifecycle send function
- Allows instant rollback without code deploy

### 5.4 Dedup pattern
| Field | Location | Purpose |
|---|---|---|
| `rental.metadata.review_request_sent` | `rentals.metadata` | 1 review nudge per rental + failure tracking |

### 5.5 Message sending
Uses `sendComplexMessage(chatId, text, buttons?, options?)` from `app/webhook-handlers/actions/sendComplexMessage.ts:88`.

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

### 6.2 Verify promo code generation capability (for future Features 2/3)
```bash
grep -n "INSERT INTO promotions" app/franchize/server-actions/promotions.ts
grep -n "export.*function.*create" app/franchize/server-actions/promotions.ts
```

### 6.3 Confirm VPS cron is running (for future Features 2/4)
```bash
crontab -l | grep boss-commands
```

### 6.4 Verify crew.reviewsLink is set (REQUIRED for Feature 1)
```sql
SELECT slug, metadata->'catalog'->>'reviewsLink' AS reviews_link
FROM crews
WHERE slug = 'vip-bike';
```
If `reviews_link` is NULL, hydrate it first via `docs/crewDocs/vip-bike-franchize-hydration.sql`. Without it, the inline button has no URL and the send throws.

### 6.5 Verify notification preferences infrastructure (REQUIRED for Feature 1)
Confirm the profile dropdown + server actions exist and work:
- `app/franchize/profile-actions.ts:267` — `getFranchizeNotificationPreferencesAction`
- `app/franchize/profile-actions.ts:288` — `saveFranchizeNotificationPreferencesAction`
- `app/franchize/components/FranchizeProfileButton.tsx:478-485` — dropdown UI

Open the profile dropdown in the web app, toggle "Статусы заказов" off and on, verify it persists. If this works, adding `reviewRequests` is a 5-line change.

---

## 7. Implementation Plan

| Iteration | What ships | Depends on |
|---|---|---|
| 1 | `sendReviewNudge()` helper + inline call from BOTH `confirmVehicleReturn()` (Path A) AND `updateRentalStatus()` (Path B) + dynamic `crew.reviewsLink` lookup + dedup metadata + kill switch + `reviewRequests` toggle added to profile dropdown + failure logging | Pre-flight §6.4 (reviewsLink set) + §6.5 (notification prefs infra works) |

**Ship Iteration 1.** That's it — one iteration, one feature, both closure paths, opt-out via existing profile dropdown.

**Measure for 2 weeks:**
- How many review requests sent? (query `rentals.metadata.review_request_sent`)
- How many Yandex Maps reviews appeared? (manual count)
- What's the opt-out rate? (query `FranchizeNotificationPreferences.reviewRequests = false`)
- What's the send failure rate? (query `metadata.review_request_sent.succeeded = false`)

If opt-out rate > 15% or send failure rate > 10%, reconsider before building Features 2-4.

---

## 8. Metrics (realistic, measurable)

| Metric | Baseline | Target (2 weeks post-ship) | Measurement |
|---|---|---|---|
| Review requests sent | 0 | ~10-14 (linked closures, ~80% of total) | `count(rentals) WHERE metadata->'review_request_sent'->>'succeeded' = 'true'` |
| Yandex Maps reviews | 5 | 8-10 | Manual count on Yandex Maps |
| Opt-out rate | n/a | < 15% | `count(users) WHERE FranchizeNotificationPreferences.reviewRequests = false` / `count(users messaged)` |
| Send failure rate | n/a | < 10% | `count(rentals) WHERE metadata->'review_request_sent'->>'succeeded' = 'false'` / `count(rentals) WHERE metadata ? 'review_request_sent'` |

---

## 9. Future Features (deferred — not in this PRD)

### 9.1 Birthday Gift Card (was Feature 2)
- **Deferred because:** needs promo code generation capability (Pre-flight §6.2) + daily cron (Pre-flight §6.3)
- **Known bug to fix when built:** the SQL query must match the FIRST 5 characters of the DOB string (day.month), not the last 5. DOB is stored as `"DD.MM.YYYY"` — a customer born Aug 22 has DOB `"22.08.1990"`. The LIKE pattern `'%.08.22'` looks for month.day at the END, but the year is at the end. Correct query:
  ```sql
  substring(renter_birth_date from 1 for 5) IN ('22.08', '23.08', '24.08', ...)
  -- Or:
  renter_birth_date LIKE '22.08.%' OR renter_birth_date LIKE '23.08.%' OR ...
  ```
- **DOB coverage:** ~95% (both /doc and web checkout collect it). Pre-flight §6.1 verifies format consistency (zero-padding).

### 9.2 Referral Program (was Feature 3)
- **Deferred because:** it's really 3 features (code generation + checkout tracking + dual-side reward), needs its own PRD
- **Step 3a (code generation + TG suggestion):** 1 iteration. Measure adoption before building 3b/3c.
- **Steps 3b/3c (checkout tracking + dual reward):** only if 3a shows adoption. Also blocked on promo code generation (Pre-flight §6.2).
- **Should NOT be bundled into this PRD.** When ready, write a separate `PRD_REFERRAL_PROGRAM.md`.

### 9.3 New Bike Notification (was Feature 4)
- **Deferred because:** lowest priority, highest spam risk
- **Design when built:** daily cron (not real-time hook — can't intercept all insert paths). Dedup via `cars.specs.announced_to_renters = true`. Per-renter dedup via `users.metadata.notified_bikes[]` (cap at 20, FIFO).
- **Anti-spam:** weekly digest if 3+ bikes added in one day. Consider segment-based targeting (only notify renters who rented a similar bike type).

---

## 10. Out of Scope (explicitly)

- **Gamification engine** — XP, badges, leaderboards, streaks, tiers, points ledger. Revisit when there are 50+ crews and thousands of renters.
- **STOP/START bot command** — opt-out is handled via the profile dropdown in the web app (existing infrastructure). No need for a separate bot command handler.
- **Event bus / pub-sub** — `sendReviewNudge()` calls `sendComplexMessage` directly. No abstraction layer.
- **Email / SMS** — TG only.
- **Cross-crew features** — vip-bike only.
- **Delayed message scheduling** — Vercel serverless can't hold a `setTimeout` for hours.
- **Features 2, 3, 4** — deferred to future PRDs.

---

## 11. What changed in v0.4 (external reviewer round 2)

### Fixed: STOP handler UX gap
The v0.3 plan shipped the STOP footer in Iteration 1 but the STOP handler in Iteration 2 — advertising a control that didn't exist for 1-2 weeks. v0.4 removes the STOP footer AND the STOP handler entirely: opt-out is handled via the existing profile dropdown (`FranchizeProfileButton.tsx:478-485`). Adding a `reviewRequests` boolean to the existing `FranchizeNotificationPreferences` type is a 5-line change, and the existing `saveFranchizeNotificationPreferencesAction` persists it with zero new server actions.

### Fixed: Path B is no longer optional
v0.3 had Path B as "Iteration 3 (optional) — only if Path A doesn't cover all closures." But you can't know that from the PRD — you'd discover it from missing review nudges. v0.4 instruments BOTH paths in Iteration 1. The marginal cost is near zero (identical change in both files); the cost of missing closures is invisible failure (the exact class of bug from the post-mortem).

### Fixed: Daily message cap race condition documented
v0.3 didn't acknowledge the read-modify-write race on `lifecycle_messages_today`. v0.4 adds a known-limitation note: "concurrent sends may exceed cap by 1. Acceptable for v1."

### Fixed: Metric denominator clarified
v0.3's "~15 review requests sent" used total closures as the denominator. v0.4 clarifies: the true ceiling is closures where `rental.user_id` is linked AND the renter is not a crew member (~80% of closures). Some closures correctly skip the send — that's the gate working, not the feature failing.

---

## 12. File Touch-List

| File | Change type |
|---|---|
| `app/franchize/lib/lifecycle-messaging.ts` | **New** — `sendReviewNudge()` helper |
| `app/rentals/actions.ts` | Modify receipt message (remove buried nudge) + add `sendReviewNudge()` call (Path A) |
| `app/franchize/server-actions/rentals-dashboard.ts` | Same — modify receipt + add nudge call (Path B) |
| `app/franchize/profile-actions.ts` | Add `reviewRequests: boolean` to `FranchizeNotificationPreferences` type |
| `app/franchize/components/FranchizeProfileButton.tsx` | Add `reviewRequests: true` to defaults + add toggle to `NOTIFICATION_OPTIONS` array |

---

*This PRD ships one feature in one iteration. The opt-out reuses existing infrastructure. Both closure paths are instrumented. Failure is modeled. The kill switch allows instant rollback. Ship Iteration 1, measure for 2 weeks, then decide on Features 2-4.*
