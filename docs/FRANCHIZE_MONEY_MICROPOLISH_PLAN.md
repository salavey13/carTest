# Franchize Money Micropolish Plan

Status: `active-planning`  
Owner: `product + codex`  
Default QA slug: `vip-bike`  
Updated: `2026-05-08T00:00:00Z`

## 1) Verdict: loading is correct, early `vip-bike` theme hint is implemented

Current franchize loading now has the God-tier baseline for known crews: it remains instant, static, safe for Suspense, not blocked on Supabase, and `/franchize/vip-bike/*` can paint the VIP Bike Pepperolli-dark palette from an early static manifest hint before page data queries resolve.

Implemented loading path:

1. Static slug theme manifest contains the high-value `vip-bike` crew.
2. Middleware derives the slug from `/franchize/:slug/*` and sets the cheap `franchize_slug_theme` cookie scoped to `/franchize`.
3. `loading.tsx` reads only `cookies()`, the static hint helper, `DEFAULT_FRANCHIZE_THEME`, and `crewPaletteForSurface`; it does not query Supabase or import client modules.
4. Unknown crews intentionally fall back to `DEFAULT_FRANCHIZE_THEME` until they are added to the manifest or a later safe theme-token path is introduced.

Definition of God-tier loading: **instant fallback + crew-accurate palette + no server/data fetch inside loading fallback**.

## 2) Money-printing product question per flow

### Rent flow

Primary question: **Can I ride today?**

The 5-second rent flow should surface, in order:

1. today availability;
2. start date/time picker;
3. deposit, total, pickup address, and required docs;
4. one dominant CTA: `Hold this bike`;
5. Telegram confirmation card for the rider;
6. structured hot-deal card for the operator.

### Prebuy flow

Primary question: **Should I buy this bike or rent first?**

The purchase-intent flow should surface:

1. price, availability, condition, and checked status;
2. rent-before-buy comparison;
3. test-ride request;
4. trade-in estimate entry point;
5. financing/monthly payment hint;
6. small reservation deposit via Telegram Stars or another configured payment path;
7. operator cockpit lead, not just a generic message.

## 3) Target shape: Franchize Intent Ledger

The next money layer is a durable intent ledger. Every meaningful rent/prebuy/contact/trade-in/test-ride/finance/map action should create or update a single commercial-memory row.

Minimum event shape:

```ts
type FranchizeIntentType =
  | 'rent'
  | 'prebuy'
  | 'trade_in'
  | 'test_ride'
  | 'finance'
  | 'contact'
  | 'map_visit';

type FranchizeIntentStage =
  | 'viewed'
  | 'configured'
  | 'checkout_started'
  | 'payment_failed'
  | 'operator_notified'
  | 'closed';

interface FranchizeIntentLedgerRow {
  intent_type: FranchizeIntentType;
  slug: string;
  bike_id?: string;
  source_route: string;
  contact_channel: 'telegram' | 'phone' | 'unknown';
  urgency_score: number; // 0-100
  stage: FranchizeIntentStage;
  metadata: Record<string, unknown>; // dates, price, selected options, blockers, utm/startapp
}
```

This turns the app from a catalog into sales memory: failed payments, checkout blockers, repeated views, map opens, trade-in clicks, and return visits become recoverable revenue.

## 4) Seven sequential polishing iterations

### R1 — Franchize Intent Ledger

- SupaPlan task: `92bdb264-a626-450a-93b2-6eca5021711a`
- Status: `todo`
- Capability: `franchize.backend.supabase`
- Primary zone: `supabase/migrations/*`, `app/franchize/*/actions.ts`
- Goal: create the durable commercial-memory table/API for rent, prebuy, trade-in, test ride, finance, contact, and map intents.
- Depends on: none.
- Acceptance: intent upsert action validates slug/type/stage, keeps service-role paths server-only, and stores metadata without exposing secrets.

### R2 — Ride-today availability strip

- SupaPlan task: `558d6b85-3f4a-48b5-ad4d-98b92746991e`
- Status: `ready_for_pr`
- Capability: `franchize.rental`
- Primary zone: catalog cards and bike modal components.
- Goal: answer “Can I ride today?” directly on bike cards and modal open.
- Depends on: R1 for event capture, but visual availability can be built behind a feature-safe fallback first.
- Acceptance: rider sees today/tomorrow availability, pickup hint, and a `Hold this bike` CTA in under five seconds.
- Updated: `2026-05-08T14:30:00Z`
- Notes: Catalog cards and item modal now show today availability, nearest start window, pickup hint, deposit/price teaser, and the dominant hold/reserve CTA; rent intents are recorded as `viewed` on modal open and `configured` on CTA taps.

### R3 — Hold/reservation CTA

- SupaPlan task: `a55a75bb-2e1d-4685-b26b-53596a95b594`
- Status: `ready_for_pr`
- Capability: `franchize.sales`
- Primary zone: checkout/order/payment server actions.
- Goal: make small hold fee/deposit a visible product mechanism instead of hidden payment plumbing.
- Depends on: R1, R2.
- Acceptance: hold attempt writes an intent, successful payment marks hot intent/rental metadata, failed payment creates recovery-ready ledger details.
- Updated: `2026-05-08T15:10:00Z`
- Notes: Checkout now exposes configurable hold copy (`Забронировать за 500₽ / XTR` by default), forwards deposit/blockers/date/bike metadata into `franchize_intents` as `intent_type='rent'`, records XTR send failures as `payment_failed`, and webhook confirmation marks rent intent/rental metadata hot + confirmed.

### R4 — Prebuy test-ride + trade-in mini-flow

- SupaPlan task: `6c5623ac-4e8a-4499-9bef-b062887a9feb`
- Status: `ready_for_pr`
- Capability: `franchize.marketplace`
- Primary zone: sale/buy pages and configurator handoff.
- Goal: turn purchase pages into rent-before-buy, test-ride, trade-in, and financing lead machines.
- Depends on: R1.
- Acceptance: buyer can request test ride, trade-in estimate, financing hint, or rent-first comparison from the bike page.
- 2026-05-08 update: Sale bike pages now expose the five-way comparison (`Купить сейчас`, rent-first, test-drive, trade-in, finance), write R1 ledger events with bike/option/source metadata, and include minimal trade-in/contact + finance estimate UX.

### R5 — Abandoned checkout recovery

- SupaPlan task: `cc5ec5ef-e6bb-446b-8d91-a12002fbb57d`
- Status: `ready_for_pr`
- Capability: `franchize.telegram`
- Primary zone: checkout blocker logic and operator notifications.
- Goal: convert unfinished checkout state into a compact operator card with exact next action.
- Depends on: R1, R3.
- Acceptance: if a rider leaves after meaningful blockers, operator sees bike, dates, phone/Telegram channel when available, last blocker, and suggested next message.
- 2026-05-08 update: Checkout now records validated rent recovery snapshots in `franchize_intents`, debounces client writes, rate-limits server writes/notifications, forces `payment_failed` snapshots for XTR failures, and sends compact admin Telegram cards only for meaningful abandonment signals.
- 2026-05-08 self-review: Recovery intents now carry a stable `dedupeKey` so anonymous/date-only checkout snapshots stay tied to the order instead of merging by default payment channel, while write and notification throttling are keyed by order/stage to prevent phone-typing bypasses and repeated readiness/date changes from spamming Telegram.

### R6 — Operator closer dashboard

- SupaPlan task: `5993dab3-dd18-49dc-8138-52862bc32edb`
- Status: `todo`
- Capability: `franchize.ui.ux`
- Primary zone: franchize admin/operator console.
- Goal: show ranked hot leads with one-click Telegram replies, manual reserve, and alternative-bike offer actions.
- Depends on: R1, R5.
- Acceptance: operator can sort by urgency score, see last blocker, and take one closing action without opening raw database rows.

### R7 — AI closer assistant

- SupaPlan task: `734d604d-e96f-4b56-830f-977e3d3cfa07`
- Status: `todo`
- Capability: `franchize.analytics`
- Primary zone: server-only AI summarization and admin console display.
- Goal: summarize lead intent, generate best next message, suggest alternative bike/discount/deposit, and follow up after abandoned checkout.
- Depends on: R1, R5, R6.
- Acceptance: AI output is validated, recoverable on malformed JSON, and displayed as operator suggestions rather than automatic unsafe actions.

## 5) Parallelization map after blocker

Sequential execution remains safest for production, but once R1 lands the work can split with low conflict risk:

- R2: catalog/modal conversion strip.
- R4: sale/prebuy route mini-flow.
- R5: checkout/Telegram recovery path.

R3 should wait for R2 + payment-product copy, R6 waits for R1/R5 data, and R7 waits until the dashboard has stable operator affordances.

## 6) Success metric

The money metric is not “more forms submitted.” The target is: **every high-intent click becomes structured, ranked, recoverable commercial intent that Telegram/operator workflows can close.**


## 7) Diary

- 2026-05-08 — R3 hold/reservation CTA: moved checkout XTR copy from hidden 1% tip language to explicit configurable hold deposit, persisted rent intent metadata for checkout/payment states, and linked successful Telegram payment to hot confirmed rental/order metadata.
