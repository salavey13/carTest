# Lead → Rental Lifecycle: Stage-Aware UX Design

## The Big Idea

Every lead goes through stages. Each stage has a **bottleneck** — the one thing
blocking transition to the next stage. The leads page should surface that
bottleneck as the **primary action** for each lead, so the operator doesn't
have to think "what do I do next?" — the card tells them.

## Stage Map (9 stages)

```
                    ┌─────────────────────────────────────────────────┐
                    │              LEAD LIFECYCLE                      │
                    │                                                 │
  New lead ──────► Needs contact ──► Contract sent ──► QR claimed ──►
  (web/bot)         (operator          (operator         (renter
   intent only       reaches out)       generates         opens TG
                     via TG/call)       DOCX via          WebApp)
   │                                    /doc cmd)          │
   │                                                       │
   │                  Bottleneck:                          │
   │                  ┌──────────┐                         │
   │                  │ No phone │                         ▼
   │                  │ or TG    │                 Documents verified
   │                  └──────────┘                 (passport + license)
   │                                                       │
   │                                              ┌────────┴────────┐
   │                                              │                 │
   │                                              ▼                 ▼
   │                                    /doc flow           web-app flow
   │                                    (already              (needs photo
   │                                     verified)             verification)
   │                                              │                 │
   │                                              ▼                 ▼
   │                                        Rental active    Rental pending
   │                                              │                 │
   │                                              ▼                 │
   │                                        Return due ────────────►
   │                                              │
   │                                              ▼
   │                                        Closed (won/lost)
```

## Stage Details: Bottleneck + Best Available Info + Next Action

### Stage 1: `new` — "Новые"
- **How they got here**: web app intent (click "Аренда", started checkout,
  added to cart but didn't complete) OR bot command (started /doc but didn't
  finish) OR /test-drive intent
- **Best available info**: bike they looked at, source (web/bot), timestamp,
  phone (if entered in web form), TG username (if authed via WebApp)
- **Bottleneck**: no human contact yet. Operator hasn't reached out.
- **Next action** (primary button): "Написать в TG" (if username) or "Позвонить" (if phone)
- **Card should show**: bike title, source badge, time-ago, phone/TG if available
- **Highlight**: 🔴 "Новый — контакта не было" in red

### Stage 2: `needs_contact` — "Нужен контакт"
- **How they got here**: operator sent a message, lead responded, but no
  contract yet. Lead is "warm" — interested but not committed.
- **Best available info**: conversation history, bike interest, any notes
  from operator
- **Bottleneck**: lead hasn't committed to dates / bike. No contract generated.
- **Next action**: "Создать договор" (deep link to /doc command with bike pre-filled)
  or "Написать в TG" (follow up)
- **Card should show**: last contact time, operator notes, bike interest
- **Highlight**: 🟡 "Ждёт договор" in amber

### Stage 3: `contract_sent` — "Договор отправлен"
- **How they got here**: operator ran /doc, generated DOCX, rental row
  created with status=pending_confirmation. BUT renter hasn't claimed QR yet.
- **Best available info**: renter ФИО (from passport in /doc), phone,
  bike, dates, daily price, deposit, contract SHA-256
- **Verification status**: ✅ VERIFIED (operator saw the physical docs
  during /doc command — passport + license were OCR'd in person)
- **Bottleneck**: renter hasn't opened the TG WebApp (QR not scanned).
  Rental is pending_confirmation, not active.
- **Next action**: "Переслать QR" (resend QR deep link to renter)
- **Card should show**: renter full name (from passport), contract verified ✓,
  "QR не отсканирован" warning
- **Highlight**: 🟡 "QR не отсканирован" + time since contract creation

### Stage 4: `awaiting_qr_claim` — "QR не принят"
- **How they got here**: QR was sent but renter hasn't opened the TG WebApp.
  (This is the same as contract_sent but with explicit QR tracking.)
- **Bottleneck**: renter needs to scan QR / open TG link. Without this,
  they can't access their rental card, can't upload photos, can't see
  contract details.
- **Next action**: "Переслать QR" + "Позвонить" (call to remind them)
- **Card should show**: time since QR was sent, QR regeneration count
- **Highlight**: 🟠 "QR отправлен Xч назад — перезвоните"

### Stage 5: `documents_missing` — "Документы отсутствуют"
- **How they got here**: QR claimed (renter opened TG WebApp), but photos
  of passport/license not uploaded. This is WEB-APP FLOW ONLY — /doc flow
  already has docs from OCR.
- **Verification status**: ❌ UNVERIFIED (renter self-reported, operator
  hasn't seen the physical docs)
- **Bottleneck**: operator needs to verify the uploaded photos OR request
  the renter bring physical docs to handoff.
- **Next action**: "Проверить фото" (open rental page → verify photos)
- **Card should show**: which photos are missing, "Фото не верифицированы"
- **Highlight**: 🟠 "Нужна проверка документов"

### Stage 6: `active_rental` — "Активные"
- **How they got here**: rental is active (bike handed off, pickup confirmed).
- **Best available info**: rental dates, bike, odometer start, deposit status
- **Bottleneck**: monitoring — operator needs to watch for return date approaching.
- **Next action**: "Открыть аренду" (deep link to /franchize/<slug>/rental/<id>)
- **Card should show**: return date, days remaining, odometer start, deposit
- **Highlight**: 🟢 "Активна" + countdown to return date

### Stage 7: `return_due` — "Возврат"
- **How they got here**: rental return date is within 24h (or past).
- **Bottleneck**: operator needs to perform return checklist, capture odometer,
  inspect for damage, return deposit, close rental.
- **Next action**: "Закрыть аренду" (deep link to rental page → closure modal)
- **Card should show**: overdue badge if past, return time, closure todo count
- **Highlight**: 🔴 "Возврат сегодня/просрочен"

### Stage 8: `closed_won` — "Закрыто"
- **How they got here**: rental completed successfully.
- **Next action**: "Запросить отзыв" (send review request) or "Создать новую аренду"
- **Card should show**: total spent, rental duration, review status
- **Highlight**: 🟢 "Завершено" + revenue

### Stage 9: `closed_lost` — "Потеряно"
- **How they got here**: dismissed, cancelled, or rental fell through.
- **Next action**: "Открыть повторно" (reactivate lead)
- **Highlight**: ⚫ "Потеряно"

## Two-Flow Distinction (critical for verification labels)

### /doc Command Flow (operator-initiated)
```
Operator runs /doc in TG → passport + license OCR → DOCX generated →
rental created with status=pending_confirmation → QR sent to renter →
renter claims QR → rental activated by operator
```
- **Verification**: ✅ VERIFIED on creation (operator physically saw the docs)
- **Renter identity**: ФИО + phone from passport OCR (stored in
  `rental_contract_artefacts.renter_full_name` + `user_rental_secrets`)
- **TG username**: only available AFTER QR claim (renter opens WebApp)
- **Photos**: not needed (docs were verified in person)
- **Bottleneck**: QR claim (renter needs to open TG WebApp)

### Web App Flow (renter-initiated)
```
Renter opens catalog → adds to cart → fills checkout form →
payment (interest or full) → rental created with status=pending_confirmation →
renter can upload passport/license photos → operator verifies →
rental activated
```
- **Verification**: ❌ UNVERIFIED on creation (renter self-reported)
- **Renter identity**: TG username (from WebApp auth), phone (from form),
  full name (from form — may be inaccurate)
- **Photos**: renter can upload → operator must verify before activation
- **Bottleneck**: photo verification (operator must check uploaded docs)

## UX Changes Needed

### 1. LeadCard: Show "Next Step" prominently
Each card should have a **colored "Next Step" pill** at the bottom:
- Stage `new`: "📞 Связаться" (red)
- Stage `needs_contact`: "📋 Создать договор" (amber)
- Stage `contract_sent`: "📱 Отправить QR" (amber)
- Stage `awaiting_qr_claim`: "📱 Переслать QR" (orange)
- Stage `documents_missing`: "🔍 Проверить фото" (orange)
- Stage `active_rental`: "🟢 Активна — X дней до возврата" (green)
- Stage `return_due`: "⚠️ Закрыть аренду" (red)
- Stage `closed_won`: "⭐ Запросить отзыв" (green)
- Stage `closed_lost`: "🔄 Открыть повторно" (gray)

### 2. LeadCard: Show verification status correctly
- `/doc` flow: show ✅ "Документы проверены" (green badge)
- Web app flow without photos: show ❌ "Фото не загружены" (red badge)
- Web app flow with unverified photos: show ⏳ "Фото на проверке" (amber badge)
- Web app flow with verified photos: show ✅ "Документы проверены" (green badge)

### 3. LeadCard: Show renter name from best source
Priority order:
1. `renter_full_name` from `rental_contract_artefacts` (/doc flow — passport OCR)
2. `full_name` from `users` table (web-app flow — TG profile or form)
3. `username` from `users` table (TG handle)
4. `phone` (last resort)
5. "Без имени" (fallback)

### 4. Rental Page: Show correct verification label
- `/doc` flow: "Контракт: ✅ Верифицирован (operator verified via /doc)"
- Web-app flow without photos: "Контракт: ❌ Не верифицирован (загрузите фото)"
- Web-app flow with unverified photos: "Контракт: ⏳ На проверке"
- Web-app flow with verified photos: "Контракт: ✅ Верифицирован"

### 5. Rental Page: Show "Best Available Info" based on flow
For `/doc`-flow rentals:
- Show renter ФИО (from passport) — already done via `renterFullName`
- Show "Создано через /doc командой" badge
- Show verification as ✅
- Skip "Upload photos" section (not needed — already verified)
- Show "Pickup confirmed" if `pickup_confirmed_at` is set in metadata

For web-app-flow rentals:
- Show renter TG username + phone
- Show "Создано через веб-приложение" badge
- Show verification as ❌ or ⏳
- Show "Upload photos" section for renter
- Show "Verify photos" button for operator

### 6. Boss Commands: Stage-aware messaging
- `morning-standup.sh`: group hot leads by stage, show bottleneck per stage
- `evening-summary.sh`: show stage distribution, highlight stuck leads
  (e.g., "3 лида застряли на QR не отсканирован > 24ч")
- `returns-reminder.sh`: already stage-aware (return_due stage)
- `lead-stuck-watchdog.sh`: detect leads stuck in same stage > X hours

### 7. Sales/Service Analytics: Same pattern
Sales have stages too:
- `new` → `offer_sent` → `contract_signed` → `paid` → `closed`
- Bottleneck: usually "contract signed but not paid" or "offer sent, no response"

Service orders have stages:
- `new` → `diagnosed` → `in_progress` → `completed` → `paid`
- Bottleneck: usually "diagnosed but not started" or "completed but not paid"

Each analytics page should show the stage funnel with bottleneck highlighted.

## Implementation Priority

1. **LeadCard "Next Step" pill** (highest impact — tells operator what to do)
2. **Verification label fix** (fixes the "unverified" confusion for /doc flow)
3. **Renter name priority** (already partially done — needs analytics fix)
4. **Rental page flow-aware sections** (show/hide based on /doc vs web flow)
5. **Boss commands stage-aware messaging** (stuck lead detection)
6. **Sales/Service stage funnels** (lower priority — fewer transactions)
