# Rental Page UX Overhaul — PRD

> **Goal:** Make the rental page the most polished, impressive page in the app.
> It's the gateway from digests/notifications → the operator's daily workflow.
> Every visitor (operator, renter, owner) should see exactly what they need.

---

## Current Problems (Audited)

### 1. Crash: `formatRuDate` called with string
- **Status:** FIXED (this commit)
- `formatRuDate(Date)` was called with `rental.agreedEndDate` (string) → crash

### 2. Redundant damage inputs
- Damage inputs appear BOTH on the page (FranchizeRentalDocumentsPanel) AND in the closing modal
- **Fix:** Remove damage section from the page body when status=active. The modal is the single place for closure data entry.

### 3. Renter name not loaded from `rental_contract_artefacts`
- `renterFullName` is fetched from `rental_contract_artefacts.renter_full_name` BUT only if `rental_contract_artefacts.rental_id` matches
- For /doc-flow rentals, the artefact has `rental_id` set → works
- For older rentals without the FK → falls back to empty
- **Fix:** Also query by `contract_key` or `original_sha256` as fallback

### 4. Role shows "наблюдатель" for crew members
- The `crewSlug` fallback was added but `userCrewMemberships` might not have loaded yet
- **Fix:** Show "Загрузка…" while memberships are loading, then re-evaluate

### 5. No bike photo shown
- The rental page has no visual of the bike being rented
- **Fix:** Fetch `bike.gallery[0]` or `bike.imageUrl` from the catalog and display it

### 6. "Продлить" button is just a link to catalog
- Currently: opens catalog with the same bike → user starts a new checkout from scratch
- **Should:** Generate a new rental doc with same renter + bike + equipment, but new dates. Send to operator + crew email + renter (if QR claimed).
- **Fix:** This is a feature, not a bug fix — needs a new server action `extendRental(originalRentalId, newStartDate, newEndDate)`

### 7. Dates incomplete
- Only end date is shown (just fixed). Should show BOTH start and end.
- `agreedStartDate` is not in the `FranchizeRentalCard` return type — needs to be added.

---

## Target Layout (per role)

### Operator (crew member/owner/admin) — sees everything
```
┌─────────────────────────────────────────────────────┐
│ [BIKE PHOTO]     Карточка аренды #9c0ba304          │
│                  🟢 Активна                          │
│                  Wenbox U2 Pro                       │
├─────────────────────────────────────────────────────┤
│ Арендатор:  Иванов Иван Иванович                    │
│ Телефон:    +7 999 888 77 66                        │
│ Период:     31.07 18:00 → 02.08 21:30               │
│ Итого:      6 000 ₽                                 │
│ Оплата:     fully_paid                              │
│ Контракт:   ✓ Верифицирован (/doc)                  │
├─────────────────────────────────────────────────────┤
│ 📋 Текущие задачи (return checklist — toggleable)   │
│ ✓ Принять ключи                                     │
│ ○ Проверить ТС при возврате                         │
│ ○ Сравить одометр: было 405 км                      │
│ Прогресс: 1/5 готово                                │
├─────────────────────────────────────────────────────┤
│ [📅 Продлить]  [📤 Документы]  [✅ Закрыть аренду]  │
└─────────────────────────────────────────────────────┘
```

### Renter — sees their rental, can upload photos, message crew
```
┌─────────────────────────────────────────────────────┐
│ [BIKE PHOTO]     Карточка аренды #9c0ba304          │
│                  🟢 Активна                          │
│                  Wenbox U2 Pro                       │
├─────────────────────────────────────────────────────┤
│ Период:     31.07 18:00 → 02.08 21:30               │
│ Итого:      6 000 ₽                                 │
│ Контракт:   ✓ Верифицирован                         │
├─────────────────────────────────────────────────────┤
│ 📸 Фото (if web-app flow, unverified)               │
│ [Загрузить паспорт]  [Загрузить права]              │
├─────────────────────────────────────────────────────┤
│ 💬 Написать экипажу                                 │
└─────────────────────────────────────────────────────┘
```

### Guest (not authed) — minimal info
```
┌─────────────────────────────────────────────────────┐
│ [BIKE PHOTO]     Карточка аренды                    │
│                  🟢 Активна                          │
│                  Wenbox U2 Pro                       │
│ Период:     31.07 → 02.08                            │
│ Войдите через Telegram для полного доступа          │
└─────────────────────────────────────────────────────┘
```

---

## Improvement Roadmap

### Phase 1: Fix crashes + core data (DONE / IN PROGRESS)
- [x] Fix `formatRuDate` crash
- [x] Fix deep link re-redirect
- [x] Fix modal visibility (scroll + opacity)
- [x] Fix crew member auth (server-side `member` role)
- [x] Fix verification status (active = always verified)
- [ ] Add `agreedStartDate` to `getFranchizeRentalCard` return type
- [ ] Fetch renter phone from `rental_contract_artefacts.renter_phone`
- [ ] Fetch bike photo from `cars.gallery[0]` or `cars.image_url`

### Phase 2: Remove redundancy + clean layout
- [ ] Remove damage inputs from page body (keep only in closure modal)
- [ ] Remove redundant sections that duplicate info
- [ ] Show return checklist progress: "1/5 готово"
- [ ] Show role as "Загрузка…" while memberships load

### Phase 3: "Продлить" enhancement
- [ ] Create `extendRental` server action
- [ ] Opens a date picker → generates new rental doc with same renter/bike/equipment
- [ ] Sends DOCX to operator + crew email + renter (if QR claimed)
- [ ] Creates new rental row linked to original

### Phase 4: Bike photo + visual polish
- [ ] Show bike photo at top of rental page
- [ ] Themed card layout with bike photo as hero image
- [ ] Status badge overlaid on photo

### Phase 5: Role-specific views
- [ ] Operator: full checklist + closure modal + documents panel
- [ ] Renter: photo upload (if unverified) + message crew + contract download
- [ ] Guest: minimal info + "open in Telegram" CTA

---

## Text Inventory (what each role sees)

### Status hints (positive reframe applied)
| Status | Hint |
|--------|------|
| pending_confirmation | "Аренда готова к активации — подтвердите выдачу" |
| confirmed | "Аренда подтверждена. Можно активировать." |
| active | "ТС у арендатора. Готовьте возврат к указанной дате." |
| completed | "Аренда завершена ✓ — запросите отзыв у клиента" |
| cancelled | "Аренда отменена." |

### Role labels
| Role | Label |
|------|-------|
| owner | "владелец" |
| renter | "арендатор (Иванов И.И.)" |
| member | "участник экипажа" |
| guest | "Загрузка…" → "наблюдатель" (after memberships load) |

### Closure modal
```
Подтвердить возврат

Заполните поля перед закрытием аренды. Все данные сохранятся в карточку.

Состояние ТС при возврате:
[Без повреждений]  [Лёгкие]  [Серьёзные]

Финальный одометр (км):
[было: 405 км]  [___________]

☑ Депозит возвращён арендатору

Комментарий оператора (необязательно):
[___________________________]

[Отмена]  [Закрыть аренду]
```

### Return checklist
```
Что вернуть
Прогресс: 1/5 готово

✓ Принять ключи от Wenbox U2 Pro
○ Проверить ТС при возврате: Wenbox U2 Pro (02.08 21:30)
○ Проверить документы при возврате Wenbox U2 Pro
○ Сравить одометр: было 405 км
○ Осмотр на повреждения: Wenbox U2 Pro

Нажмите на кружок, чтобы отметить пункт выполненным.
```

---

## Data Sources to Wire

| Field | Source | Currently working? |
|-------|--------|-------------------|
| Renter ФИО | `rental_contract_artefacts.renter_full_name` | ✅ (if rental_id FK exists) |
| Renter phone | `rental_contract_artefacts.renter_phone` | ❌ (not fetched) |
| Renter TG username | `users.username` (after QR claim) | ❌ (shows operator's) |
| Bike photo | `cars.gallery[0]` or `cars.image_url` | ❌ (not fetched) |
| Start date | `rentals.agreed_start_date` | ❌ (not in return type) |
| End date | `rentals.agreed_end_date` | ✅ (just fixed) |
| Odometer start | `rentals.metadata.odometer_before` | ✅ (in closure todos) |
| Deposit | `rental_contract_artefacts.deposit_rub` | ❌ (not shown) |
| Daily price | `rental_contract_artefacts.daily_price` | ❌ (not shown) |
| Equipment | `rentals.metadata.equipment` | ❌ (not shown on page) |

---

## Progress Log

| Date | What | Status |
|------|------|--------|
| 2026-07-31 | Fixed formatRuDate crash | ✅ DONE |
| 2026-07-31 | Fixed deep link re-redirect | ✅ DONE |
| 2026-07-31 | Fixed modal scroll + opacity | ✅ DONE |
| 2026-07-31 | Fixed crew member auth (server) | ✅ DONE |
| 2026-07-31 | Fixed verification status (active=verified) | ✅ DONE |
| 2026-07-31 | Fixed renter name (operator placeholder) | ✅ DONE |
| 2026-07-31 | Fixed todos cross-rental leak | ✅ DONE |
| 2026-08-01 | Added agreedStartDate + renterPhone + bikePhotoUrl | ✅ DONE |
| 2026-08-01 | Bike photo (9:16) on rental page | ✅ DONE |
| 2026-08-01 | Full date range (start → end) | ✅ DONE |
| 2026-08-01 | Renter phone display | ✅ DONE |
| 2026-08-01 | Collapsible documents panel (reduce noise) | ✅ DONE |
| 2026-08-01 | Checklist progress badge (1/5 → ✓ Готово!) | ✅ DONE |
| 2026-08-01 | Role 'загрузка…' while memberships load | ✅ DONE |
| TBD | Enhance "Продлить" button (extendRental) | Pending |
| TBD | Role-specific views (operator/renter/guest) | Pending |
| TBD | Deposit + daily price display | Pending |
| TBD | Equipment list display | Pending |
| TBD | "Идеальная аренда ⭐" badge | Pending |

---

## New Ideas (Agent Proposals)

### A. "Идеальная аренда ⭐" badge
When a rental has: all docs verified ✓ + all return todos done ✓ + odometer captured ✓ + deposit returned ✓ → show a gold "⭐ Идеальная аренда" badge. This celebrates perfection and gives operators a target.

### B. Quick-action floating bar
Instead of scrolling to find buttons, add a sticky bottom bar (mobile) / sticky sidebar (desktop) with the 3 key actions:
- [📅 Продлить] — always visible
- [✅ Закрыть] — visible when status=active
- [💬 Написать] — always visible (renter) / hidden (operator)

The bar stays visible while scrolling, so the operator always has the next action one tap away.

### C. Timeline view
Replace the "Текущие задачи" static list with a horizontal timeline:
```
Создан → Договор → Выдан → Активен → Возврат → Закрыт
  ●        ●        ●        ●        ○        ○
31.07    31.07    31.07    31.07    02.08    ?
```
Each dot is a stage. Filled = done, empty = pending. Tap a dot to see details. This gives instant visual status without reading text.

### D. Smart "Продлить" flow
When operator taps "Продлить":
1. Show a date picker (start = today, end = +1 day default)
2. Pre-fill everything from the original rental (renter, bike, equipment, price)
3. Generate new DOCX with new dates
4. Send to operator TG + crew email + renter (if QR claimed)
5. Create new rental row linked to original via metadata.extended_from

This is the single biggest time-saver for repeat rentals.

### E. Renter's "my rental" view
When the renter opens this page (via QR or deep link), they should see:
- Bike photo + dates + "when to return"
- "Upload photos" section (if not verified)
- "Message crew" button
- "Download contract" button
- NO operator panels (checklists, lifecycle controls, documents panel)

This is already partially implemented via FranchizeRentalRoleGuard — just need to also hide the documents panel and lifecycle controls for renters.

### F. Deposit tracker
Show deposit amount + status:
- "Депозит: 10 000 ₽ (получен при выдаче)" — when active
- "Депозит: 10 000 ₽ → возвращён ✓" — when closed with depositReturned=true
- "Депозит: 10 000 ₽ → удержан (уточните у оператора)" — when closed with depositReturned=false

Data source: `rental_contract_artefacts.deposit_rub` + `rentals.metadata.deposit_returned`

### G. Odometer delta display
When both start + end odometer are known:
- "Пробег: 405 → 412 км (7 км за аренду)"
- If overage: "Пробег: 405 → 450 км (45 км — превышение 25 км × 30 ₽/км = 750 ₽)"

This helps the operator see at a glance if there's an overage charge to collect.
