# PRD — Rentals, Sales & Services Analytics v2 (Operational Dashboard)

Last updated: 2026-07-23 (revised with production data verification + Services tab)
Status: Draft for implementation
Visual reference: `analytics_visual_description.md` (companion visual spec, mirrors `design_closups_prd.md` for leads)
Implementation spec: `analytics_implementation_SPEC.md` (companion file-by-file guide)
Sibling project: `leads_redesign_PRD.md` + `leads_redesign_implementation_SPEC.md` (Leads UI v2)
Codebase:
- `app/franchize/[slug]/rentals-analytics/` — current rentals analytics page (`RentalsAnalyticsClient.tsx`, ~1500 lines, 21 components)
- `app/franchize/[slug]/sales-analytics/` — current sales analytics (`SalesAnalyticsClient.tsx`, 122 lines)
- `app/franchize/[slug]/rentals/` — current rentals list (`RentalsListClient.tsx`, 274 lines, already uses `T.*` tokens)
Server actions:
- `app/franchize/server-actions/rentals-dashboard.ts` (~2846 lines, already works — DO NOT rewrite)
- `app/franchize/server-actions/crew-todos.ts`
- `app/franchize/server-actions/checklist.ts`
Skill references:
- `franchize_pages/_existing_skills/analytics-text__SKILL.md` — text-only CLI dashboard for rentals/sales/todos
- (Planned) `analytics-text` skill will be expanded with `service-dashboard` command (see §14)

---

## 0. Product decisions (2026-07-23)

Confirmed with product before implementation. These are the **non-negotiables** — the rest of this PRD is built on top of them.

1. **Three tabs, not two.** The current draft only covered Аренда (Rentals) and Продажа (Sales). The production crew (`vip-bike`, `2d5fde70-1dd3-4f0d-8d72-66ccf6908746`) has **10 service items** in the catalog (`cars.type='service'`) and service rentals that flow through the same `rentals` table. We add **Сервис** as a third tab. This matches the leads page pattern (`Mode = "rent" | "sale" | "service"` — see `leads-constants.ts`).

2. **Todos belong to a rental.** The primary mode is rental-first: you see a rental, you see its todos. The flat todo list is secondary (available via the "Все задачи" toggle, collapsed by default). Same decision as leads (`matchTodosToLead` from `pipeline-stages.ts`).

3. **RentalDetailDrawer reuses LeadDetailDrawer pattern.** Same animation (`framer-motion`, slide-from-right on desktop, slide-up on mobile), same section order (header → primary actions → SLA overview → info grid → documents → tasks → notes → history → sticky footer). The Leads UI v2 already proved this pattern works for an operator dashboard.

4. **ФИО is the primary display, not phone.** Every card shows renter/buyer/client ФИО first; phone is secondary metadata (info tile in the drawer, not on the card). Same decision as leads (`displayName = lead.full_name || "Без имени"` in `LeadDetailDrawer.tsx:107`). Production data shows names are inconsistent (`Test Test Test`, `Закиров Артур`, `Иванов Иван`) but always present when a rental exists.

5. **Mobile-first layout.** The primary target is Telegram WebApp on mobile. Desktop split-pane is secondary (adaptive, not the default). The detail drawer is a **slide-up sheet** on mobile (`max-w-full`, `bottom-0`, `rounded-t-3xl`), a right-side panel on desktop (`max-w-[640px]`, `right-0`, `h-full`). Same as leads (`LeadDetailDrawer.tsx:195-211` uses `flex justify-end` + `max-w-[640px]`; mobile override is `max-w-full` + slide from bottom).

6. **Theme tokens everywhere.** All colors come from `T: ThemeTokens` (`useCrewTokens` hook, see `RentalsListClient.tsx:43`). **No hardcoded hex colors.** The current `RentalsAnalyticsClient.tsx` uses CSS vars (`var(--franchize-bg-card)` etc.) — we migrate to `T.*` for consistency with the leads page. The only hardcoded colors allowed are semantic status colors (`#22c55e` green, `#facc15` yellow, `#f59e0b` orange, `#ef4444` red, `#a1a1aa` gray) — same whitelist as `LeadDetailDrawer.tsx:183-187`.

7. **No schema migrations required.** All data needed for the redesign already exists in the live Supabase. The `rentals` table has `metadata`, `agreed_start_date`, `agreed_end_date`, `total_cost`, `vehicle_id`, `user_id`, `status`. The `crew_todos` table has `rental_id` (FK), `category`, `status`, `priority`, `due_date`, `assigned_to`. The `sale_contract_artifacts` table (private schema) has `buyer_full_name`, `sale_price`, `resolved_bike_id`, `warranty_months`. The `cars` table has `type='service'` rows that define the service catalog. **No new tables, no new columns.** Only new server-side aggregation logic in a new `rentals-dashboard-extended.ts` file.

8. **Server actions are read-only extensions.** The existing `getRentalsDashboard`, `getSalesDashboard`, `getCrewTodos`, `getAllChecklistStates` work correctly and are production-verified. We **do not modify them**. We add new `getRentalsDashboardExtended`, `getSalesDashboardExtended`, `getServiceRentalsDashboard` server actions that wrap the existing ones + add the per-rental grouping. See SPEC §1.2.

9. **Service tab queries rentals, not a separate table.** Service rentals are `rentals` rows where `vehicle_id` IN (service catalog items, identified by `cars.type='service'` OR `vehicle_id LIKE 'vip-bike-svc-%'`). They appear in the regular `rentals` table but get filtered into the Сервис tab. See §4 for the workflow.

10. **Feature flag for rollout.** Render the new UI behind `?ui=v2` query param or `localStorage.analytics_ui_v2 = "true"`. Old UI (`RentalsAnalyticsClient.tsx`) remains the default until the new one passes the acceptance scenarios in §13. Same approach as leads (`leads_redesign_implementation_SPEC.md` §1.3).

---

## 1. Summary

Replace the current flat analytics page (`RentalsAnalyticsClient.tsx`, 1482 lines, 21 components in a single tree) with a **rental-centric operational dashboard** that makes the obvious at a glance:

1. **What's happening today** — upcoming returns, new rentals, outstanding docs per rental
2. **Todos per rental** — not one giant flat list. Each rental card shows its own todos.
3. **Rental status lifecycle** — `pending_confirmation → confirmed → active → return_due → completed` (+ `cancelled`), with dates and SLA countdown to return
4. **Document completeness per rental** — passport, license, odometer photo — visible on the card as `3/5 ✅`
5. **QR claim state per rental** — `unclaimed` / `sent` / `claimed` / `expired`
6. **Handoff status** — operator-to-renter handoff completed or pending (from `rental_handoffs` table)
7. **Revenue per rental** — actual cost, deposit, extras
8. **Service workflow visibility** — service rentals (Замена масла, Нормо-час, etc.) tracked end-to-end from booking → mechanic assignment → completion

### Key pain points (current)

| # | Pain point | Current behavior | Desired behavior |
|---|---|---|---|
| 1 | **Todos flat list** | `TodosSection` shows ALL 313 crew todos in a 3-col grid, unrelated to rentals | Todos grouped under their rental; rental card shows "3 задачи" badge and inline list of this rental's todos only |
| 2 | **No rental detail drawer** | Clicking a rental row only shows actions menu (status change, QR, email). To see rental detail you have to navigate to `/franchize/[slug]?vehicle=...` | Clicking opens `RentalDetailDrawer` with full rental detail: renter, bike, dates, docs, todos, QR, timeline, handoff — same pattern as `LeadDetailDrawer` |
| 3 | **No document status per card** | Docs are checked in the `ChecklistPanel` modal but not surfaced on the card. Operator must open the modal to know if docs are complete | Each rental card shows doc completeness as `2/5 ✅` (green) or `3 missing 🔴` (red) — same visual as `LeadDocumentsSection` |
| 4 | **No handoff tracking on card** | `RentalHandoffModal` exists but handoff state is not visible on the card. Operator must open the modal to see if handoff happened | Rental card shows handoff badge: "Передан ✅" (green) or "Ожидает 🔄" (yellow) — derived from `rental_handoffs` table |
| 5 | **Empty sales page** | `SalesAnalyticsClient.tsx` is a basic list (buyer name, bike, price, date) — no contract status, no delivery status, no detail | Sales tab shows buyer ФИО, bike, price, contract status (`signed` / `pending` / `cancelled`), delivery status (`pending` / `in_transit` / `delivered` / `picked_up`) — plus a `SaleDetailDrawer` (simpler than rental drawer) |
| 6 | **No service visibility** | Service rentals (10 catalog items: Нормо-час 2000₽, Замена масла 2000₽, etc.) are invisible — they don't appear in the analytics page because the page only shows `cars.type IN ('electric', 'gas')` bikes | Service tab shows service rentals with: service type (from catalog), client ФИО, status, cost, assigned mechanic (from `crew_todos.assigned_to` on the service rental) |
| 7 | **Phone shown everywhere, ФИО nowhere** | Current rental rows show `+7 999 123-45-67` but not renter name. Phone formats are inconsistent (see §11 production data) | All cards show ФИО first; phone is in the drawer info grid only |
| 8 | **Hardcoded hex colors** | `RentalsAnalyticsClient.tsx:91-97` uses `getStatusConfig` with hardcoded `#34d399`, `#60a5fa`, `#4ade80`, `#f87171`, `#fbbf24`. Other components use CSS vars (`var(--franchize-bg-card)`). Inconsistent. | All colors come from `T.*` theme tokens (`useCrewTokens`). Status colors come from `T.styles.accentBadge`, `T.styles.successBadge`, etc. (extend `ThemeTokens` if needed). Hardcoded colors banned except semantic status whitelist (§0.6). |
| 9 | **No SLA countdown to return** | Active rentals show "Активна" badge but no countdown to return date. Operator has to mentally subtract dates. | Rental card shows SLA countdown: "↩ Возврат: завтра 18:00" (orange if within 24h, red if overdue). Same as leads `time_until_return` signal. |

---

## 2. Page structure — Rentals Analytics tab (Аренда)

```
┌──────────────────────────────────────────────────────┐
│ 📅 <— date nav —>  │  🔄 Обновить                       │
├──────────────────────────────────────────────────────┤
│ 🔄 Tab nav: Аренда │ Продажа │ Сервис                   │ ← new Сервис tab
├──────────────────────────────────────────────────────┤
│ 📊 KPI row (4 cards)                                  │
│  Активных: 22 │ Возврат сегодня: 3 │ Просрочек: 1 │   │
│  Выручка: 85 000 ₽                                   │
├──────────────────────────────────────────────────────┤
│ 🔎 Search + filter bar (status, renter ФИО, bike)     │
│ + pill filters: ⚠ Просроч. 📄 Нет док. 📱 QR не принят │
├──────────────────────────────────────────────────────┤
│ Rental cards (selected date, vertical stack)          │
│ ┌─────────────────────────────────────────────┐      │
│ │ 🟢 Активная  │ 🏍 Falcon PRO                  │      │
│ │ 👤 Иванов И.  │ +7 999 123-45-67 (in drawer)  │      │
│ │ 📅 24 Jul → 27 Jul  │ 💰 12 000 ₽            │      │
│ │ 📋 Доки: 3/5 ✅  │ 📱 QR: ✅ принят          │      │
│ │ ✅ Передан     │ ↩ Возврат: завтра 18:00 🟡   │      │
│ │ ──── задачи (3) ────                          │      │
│ │ ☐ Верифицировать паспорт (high)              │      │
│ │ ☑ Подтвердить одометр (medium)               │      │
│ │ ☐ Отправить договор (low)                    │      │
│ │ [📂 Открыть карточку →]                       │      │
│ └─────────────────────────────────────────────┘      │
│ ...more cards...                                      │
├──────────────────────────────────────────────────────┤
│ 📋 Все задачи (expandable flat list — collapsed)     │
└──────────────────────────────────────────────────────┘
```

### Acceptance criteria — Rentals tab

- [ ] Rental card shows renter **ФИО** (not phone) + bike + dates + cost + status at a glance
- [ ] Rental card shows document completeness `verified/total` with visual indicator
- [ ] Rental card shows QR claim state (`unclaimed` / `sent` / `claimed` / `expired`) with badge
- [ ] Rental card shows handoff state (`pending` / `completed`) with badge
- [ ] Rental card shows SLA countdown to return ("завтра 18:00" / "просрочен на 2 ч")
- [ ] Todos are rendered INSIDE the rental card (filtered by `rental_id`), not in a separate section
- [ ] Clicking a rental card opens `RentalDetailDrawer` (slide-up sheet on mobile, right panel on desktop)
- [ ] Date navigator works (prev/next day, today button, date picker)
- [ ] Search works across renter name, phone, bike title
- [ ] Filter by status (active, confirmed, completed, cancelled, pending_confirmation)
- [ ] "Все задачи" section at bottom shows all 313 crew todos (collapsed by default)
- [ ] All colors come from `T.*` theme tokens — no hardcoded hex except semantic status whitelist

---

## 3. Page structure — Sales Analytics tab (Продажа)

```
┌──────────────────────────────────────────────────────┐
│ 📅 <— date nav —>  │  🔄 Обновить                       │
├──────────────────────────────────────────────────────┤
│ 🔄 Tab nav: Аренда │ Продажа │ Сервис                   │
├──────────────────────────────────────────────────────┤
│ 📊 KPI row (4 cards)                                  │
│  Продаж: 18 │ Выручка: 6.3M ₽ │ Средний чек: 350K │   │
│  Гарантия ср.: 12 мес                                │
├──────────────────────────────────────────────────────┤
│ 🔎 Search + filter bar (buyer ФИО, bike, status)      │
├──────────────────────────────────────────────────────┤
│ Sale cards (selected date, vertical stack)            │
│ ┌─────────────────────────────────────────────┐      │
│ │ 💳 Продажа   │ 🏍 Bad Boy 15kW                │      │
│ │ 👤 Петров П. │ 📅 22 Jul 2026                 │      │
│ │ 💰 700 000 ₽ │ 📋 Договор: ✅ подписан         │      │
│ │ 🚚 Доставка: 🟡 ждёт                          │      │
│ │ ──── задачи (2) ────                          │      │
│ │ ☐ Подготовить ПТС (high)                     │      │
│ │ ──── заметки (1) ────                         │      │
│ │ 📝 "Установить доп.зеркала" — Антон, 2ч       │      │
│ │ [📂 Открыть карточку →]                       │      │
│ └─────────────────────────────────────────────┘      │
│ ...more cards...                                      │
└──────────────────────────────────────────────────────┘
```

### Acceptance criteria — Sales tab

- [ ] Sale card shows buyer **ФИО** (not phone) + bike + price + date at a glance
- [ ] Sale card shows contract status (`signed` / `pending` / `cancelled`) — derived from `sale_contract_artifacts` presence
- [ ] Sale card shows delivery status (`pending` / `in_transit` / `delivered` / `picked_up`) — derived from `sale_contract_artifacts.metadata.deliveryStatus` (falls back to `pending` if absent)
- [ ] Todos for the sale are shown inside the card (matched by `rental_id` = sale_id OR `lead_id` = buyer phone)
- [ ] Notes for the sale are shown inside the card (matched by same logic)
- [ ] Search works across buyer name, phone, bike title
- [ ] Clicking a sale card opens `SaleDetailDrawer` (simpler than rental — no document checklist, no QR state)

---

## 4. Page structure — Services Analytics tab (Сервис) [NEW]

### 4.1 What is a "service rental"?

A **service rental** is a row in the `rentals` table where the linked `vehicle_id` points to a service catalog item (not a physical bike). The catalog lives in `cars` where `type='service'`. Production data shows 10 such items:

| `cars.id` (slug-like)        | `cars.make` | `cars.model`     | Price     |
|------------------------------|-------------|------------------|-----------|
| `vip-bike-svc-normochas`     | Сервис      | Нормо-час        | 2 000 ₽   |
| `vip-bike-svc-oil-change`    | Сервис      | Замена масла     | 2 000 ₽   |
| `vip-bike-svc-brake-pad`     | Сервис      | Замена колодок   | 1 500 ₽   |
| `vip-bike-svc-chain-tension` | Сервис      | Натяжка цепи     | 500 ₽     |
| `vip-bike-svc-diagnostics`   | Сервис      | Диагностика      | 1 000 ₽   |
| `vip-bike-svc-tire-replace`  | Сервис      | Замена шин       | 3 500 ₽   |
| `vip-bike-svc-balance`       | Сервис      | Балансировка     | 1 200 ₽   |
| `vip-bike-svc-battery`       | Сервис      | Замена батареи   | 8 000 ₽   |
| `vip-bike-svc-controller`    | Сервис      | Ремонт контроллера | 15 000 ₽ |
| `vip-bike-svc-custom`        | Сервис      | Прочие работы    | 1 000 ₽   |

(Approximate catalog from production; exact `make`/`model` may vary. The SPEC uses `cars.type='service'` filter, NOT a hardcoded list — so any future service item automatically appears.)

### 4.2 Service workflow

```
[1] Client requests service (phone / TG / walk-in)
       │
       ▼
[2] Operator creates a rental row with vehicle_id = service catalog item
       │   (rental.user_id = client's user_id)
       │   (rental.metadata.intent = "service")
       │   (rental.agreed_start_date = booking time)
       │   (rental.agreed_end_date = expected completion time)
       │   (rental.total_cost = service price × qty, default qty=1)
       │
       ▼
[3] System auto-creates a `rental_verification` todo
       │   (crew_todos.category = "rental_verification")
       │   (crew_todos.rental_id = the rental_id)
       │   (crew_todos.title = "Сервис: <service type> для <client ФИО>")
       │   (crew_todos.assigned_to = mechanic on duty, fallback: crew owner)
       │
       ▼
[4] Mechanic accepts the todo (status: pending → in_progress)
       │
       ▼
[5] Mechanic performs the work, checks off verification todos
       │   (passport not needed for service, but odometer + dates still apply)
       │
       ▼
[6] Mechanic marks rental as completed (status: active → completed)
       │   (rental_handoffs.returnCompleted = true)
       │
       ▼
[7] Service rental appears in Сервис tab with full timeline
```

### 4.3 Service tab layout

```
┌──────────────────────────────────────────────────────┐
│ 📅 <— date nav —>  │  🔄 Обновить                       │
├──────────────────────────────────────────────────────┤
│ 🔄 Tab nav: Аренда │ Продажа │ Сервис                   │
├──────────────────────────────────────────────────────┤
│ 📊 KPI row (4 cards)                                  │
│  Сервисов: 5 │ В работе: 2 │ Завершено: 3 │ Выручка:  │
│  9 500 ₽                                              │
├──────────────────────────────────────────────────────┤
│ 🔎 Search + filter bar (client ФИО, service type)     │
│ + pill: 🔄 Только активные                            │
├──────────────────────────────────────────────────────┤
│ Service cards (selected date, vertical stack)         │
│ ┌─────────────────────────────────────────────┐      │
│ │ 🔧 Сервис: Замена масла  │ 🟡 В работе       │      │
│ │ 👤 Закиров Артур  │ 💰 2 000 ₽               │      │
│ │ 📅 23 Jul 14:00 → 15:00                       │      │
│ │ 👨‍🔧 Механик: salavey13 (admin)               │      │
│ │ ──── задачи (1) ────                          │      │
│ │ ☑ Заменить масло (done)                      │      │
│ │ ☐ Обновить сервисный журнал (pending)        │      │
│ │ [📂 Открыть карточку →]                       │      │
│ └─────────────────────────────────────────────┘      │
│ ...more cards...                                      │
└──────────────────────────────────────────────────────┘
```

### Acceptance criteria — Services tab

- [ ] Service tab filters `rentals` where `vehicle_id` resolves to `cars.type='service'`
- [ ] Service card shows service type (from `cars.model`), client ФИО, status, cost
- [ ] Service card shows assigned mechanic (from `crew_todos.assigned_to` on this rental's todos)
- [ ] Service card shows booking date range (`agreed_start_date → agreed_end_date`)
- [ ] Service todos are rendered inside the card (same as rental cards)
- [ ] Clicking a service card opens `ServiceDetailDrawer` (uses same drawer pattern, but with mechanic assignment section instead of handoff section)
- [ ] Filter by status (active, completed, cancelled)
- [ ] Empty state: "Нет сервисных записей за выбранную дату" with explanation

### 4.4 Why service rentals live in `rentals` (not a new table)

Service rentals reuse the entire rentals infrastructure:
- Same `rentals` table → same RLS, same dedupe, same status lifecycle
- Same `rental_handoffs` table → mechanic "handoff" = completing the service
- Same `crew_todos` table → `rental_verification` category applies
- Same `user_rental_secrets` table → not strictly needed (no passport for service) but harmless
- Same `rentals-dashboard.ts` server actions → no new server action needed beyond the service-specific filter

This is **the same architectural decision** as the leads page treating `Mode = "service"` as a filter on `franchize_intents.intent_type`, not a separate pipeline.

---

## 5. Rental detail drawer (Leads pattern reuse)

`RentalDetailDrawer` mirrors `LeadDetailDrawer` (`download/ui_components/LeadDetailDrawer.tsx`, 689 lines). Same section order, same animation, same component breakdown.

### 5.1 Section order (matches LeadDetailDrawer exactly)

| # | Section | LeadDetailDrawer source | RentalDetailDrawer adaptation |
|---|---|---|---|
| 1 | **Header** | Avatar (initials in colored circle), name, verified badge, hot badge, phone • relative time, stage badge | Same — initials from renter ФИО, status badge (color from `STAGE_COLORS` for rentals, see §6.1), QR claimed badge |
| 2 | **Primary actions** | 4 large buttons: Call / Telegram / Notify / More | 4 large buttons: 📂 Open contract / 🔄 Resend QR / 📧 Send doc / ⋯ More (status change, handoff, dismiss) |
| 3 | **SLA overview** | `LeadSLAOverview` — 4 circular indicators | New `RentalSLAOverview` — 4 indicators: time_until_return / overdue_todos / unclaimed_qr_age / docs_missing |
| 4 | **Info grid** | `LeadInfoGrid` — 2-col, 12 tiles | `RentalInfoGrid` — 2-col, 10 tiles: bike, dates, cost, deposit, odometer start, odometer end, fuel level, QR status, handoff status, owner |
| 5 | **Documents** | `LeadDocumentsSection` — 5-item checklist + QR status row | `RentalDocumentsSection` — same 5 items (passport_mainpage, passport_registration, drivers_license, odometer, dates) + QR status row + "Resend QR" button |
| 6 | **Tasks** | `TodoList` filtered by lead, with All/Mine/Overdue sub-filters | `TodoList` filtered by `rental_id`, with same sub-filters + "Add todo" inline form |
| 7 | **Notes** | `NotesPanel` filtered by lead | `NotesPanel` filtered by `rental_id` (notes stored in `crew_todos.description` JSON OR a new `rental_notes` table — see §10.4 open question) |
| 8 | **History timeline** | `LeadHistorySection` — vertical timeline, colored icons | `RentalHistorySection` — same timeline pattern, derived from status changes + todo completions + handoff events |
| 9 | **Sticky footer** | Status change / Actions / Close | Same — status change triggers `RentalStatusChangeModal`, handoff triggers `RentalHandoffModal` inline |

### 5.2 Animation

Reuse `LeadDetailDrawer.tsx:189-211` pattern exactly:

```tsx
<AnimatePresence>
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-40 flex justify-end"  // mobile: items-end
    style={{ background: "rgba(0,0,0,0.6)" }}
    onClick={onClose}
  >
    <motion.aside
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}  // mobile: y: "100%"
      transition={{ type: "spring", damping: 30, stiffness: 280 }}
      className="flex h-full w-full max-w-[640px] flex-col"  // mobile: max-w-full h-[90vh] rounded-t-3xl
      style={{ background: T.bgCard, ... }}
    >
```

Mobile detection: `useMediaQuery` hook or `window.innerWidth < 768` (same approach as leads). Mobile = slide-up sheet, desktop = right panel.

### 5.3 Reuse from Leads UI v2

These components from `app/franchize/[slug]/leads/components/` are generic enough to reuse directly (with prop type changes) OR to copy as the basis for rental equivalents:

| Component | Reuse strategy |
|---|---|
| `Section.tsx` (collapsible wrapper) | **Reuse directly** — pure presentational, takes `title`, `icon`, `children`, `defaultOpen` |
| `LeadInfoGrid.tsx` | **Copy as `RentalInfoGrid.tsx`** — same 2-col grid, different `InfoTile[]` content |
| `LeadDocumentsSection.tsx` | **Copy as `RentalDocumentsSection.tsx`** — same checklist pattern, same 5 doc types (rentals already have these columns) |
| `NotesPanel.tsx` | **Reuse directly** — takes `notes: Note[]` and `onAdd(text)`, no lead-specific logic |
| `TodoList.tsx` | **Reuse directly** — takes `todos: CrewTodo[]` and `onCreateTodo`, `onToggleTodo`, `onDeleteTodo`. Filtering by `rental_id` happens upstream (in `RentalDetailDrawer`). |
| `LeadSLAOverview.tsx` | **Copy as `RentalSLAOverview.tsx`** — same 4-indicator layout, different signals (see §6.2) |
| `LeadHistorySection.tsx` | **Copy as `RentalHistorySection.tsx`** — same timeline pattern, different event types |

**Reuse decision rule:** if a component touches `LeadRow` directly → copy and rename. If it only takes primitive props (`title`, `icon`, `children`) → reuse directly.

---

## 6. Data model — new / extended types

### 6.1 `RENTAL_STATUSES` constant (replaces hardcoded `getStatusConfig`)

Replace `RentalsAnalyticsClient.tsx:91-97`:

```ts
export const RENTAL_STATUSES = {
  pending_confirmation: { label: "Ожидает",   tone: "yellow",  color: "#fbbf24", icon: "AlertCircle" },
  confirmed:            { label: "Подтв.",     tone: "green",   color: "#34d399", icon: "CheckCircle2" },
  active:               { label: "Активна",    tone: "blue",    color: "#60a5fa", icon: "Clock" },
  completed:            { label: "Завершена",  tone: "green",   color: "#4ade80", icon: "CheckCircle2" },
  cancelled:            { label: "Отменена",   tone: "gray",    color: "#a1a1aa", icon: "XCircle" },
} as const;

export type RentalStatus = keyof typeof RENTAL_STATUSES;
```

This lives in `app/franchize/[slug]/rentals-analytics/lib/rental-statuses.ts` (new file). Same pattern as `PIPELINE_STAGES` in `leads/lib/pipeline-stages.ts`.

### 6.2 `RentalCardItem` (new frontend type, extends existing `RentalDashboardItem`)

```ts
import type { RentalDashboardItem } from "@/app/franchize/server-actions/rentals-dashboard";
import type { CrewTodo } from "@/app/franchize/server-actions/crew-todos";

export interface RentalCardItem extends RentalDashboardItem {
  /** Renter ФИО (from user.full_name, fallback to secret.renter_full_name) */
  renterName: string | null;
  /** Renter phone (from user.metadata.phone, fallback to secret.renter_phone) */
  renterPhone: string | null;
  /** Bike title — "make model" joined */
  bikeTitle: string | null;

  // Document completeness — derived from rental columns + secret
  docsTotal: number;       // 5
  docsVerified: number;    // 0-5
  docsMissing: string[];   // ["passport_mainpage", "drivers_license", ...]

  // QR state — derived from secret + identityState
  qrStatus: "unclaimed" | "sent" | "claimed" | "expired";

  // Handoff — from rental_handoffs table (already on RentalDashboardItem as odometerStart/handoutCompleted)
  handoffStatus: "pending" | "completed";

  // SLA countdown — computed client-side from agreed_end_date
  slaReturnMs: number | null;  // ms until return (negative = overdue)

  // Todos for THIS rental only — filtered by rental_id
  todos: CrewTodo[];

  // Notes count (for the badge in the card footer)
  notesCount: number;

  /** Tab this rental belongs to — derived from vehicle.type */
  tab: "rent" | "service";
}
```

### 6.3 `SaleCardItem` (new frontend type, extends existing `SaleDashboardItem`)

```ts
import type { SaleDashboardItem } from "@/app/franchize/server-actions/rentals-dashboard";
import type { CrewTodo } from "@/app/franchize/server-actions/crew-todos";

export interface SaleCardItem extends SaleDashboardItem {
  /** Buyer ФИО */
  buyerName: string | null;
  /** Buyer phone — from sale_contract_artifacts.buyer_email fallback chain */
  buyerPhone: string | null;
  /** Bike title */
  bikeTitle: string | null;
  /** Parsed numeric price — sale_price comes as string "390 000" */
  salePriceNumeric: number;

  // Derived statuses
  contractStatus: "signed" | "pending" | "cancelled";
  deliveryStatus: "pending" | "in_transit" | "delivered" | "picked_up";

  // Todos for this sale (matched by rental_id=sale_id OR lead_id=buyer phone)
  todos: CrewTodo[];

  // Notes
  notes: Array<{ id: string; text: string; created_at: string; author: string | null }>;
}
```

### 6.4 `ServiceCardItem` (new frontend type — extends `RentalCardItem`)

```ts
import type { RentalCardItem } from "./RentalCardItem";

export interface ServiceCardItem extends RentalCardItem {
  /** Service type — from cars.model (e.g. "Замена масла") */
  serviceType: string;
  /** Assigned mechanic — from crew_todos.assigned_to on this rental's todos */
  mechanicId: string | null;
  /** Mechanic display name */
  mechanicName: string | null;
  /** Mechanic role */
  mechanicRole: string | null;
}
```

### 6.5 Server action additions (NO changes to existing actions)

**Current:** `getRentalsDashboard` returns `RentalDashboardItem[]` + `RentalDashboardSummary`. Todos fetched separately via `getCrewTodos`.

**New (separate file, wraps existing):** `app/franchize/server-actions/rentals-dashboard-extended.ts`:

```ts
"use server";

import { getRentalsDashboard, type RentalDashboardItem, type RentalDashboardResult } from "./rentals-dashboard";
import { getCrewTodos, type CrewTodo } from "./crew-todos";
import { computeRentalCardFields } from "../[slug]/rentals-analytics/lib/rental-card-fields";

export interface RentalsDashboardExtendedResult extends RentalDashboardResult {
  items: RentalCardItem[];  // extended
  allTodos: CrewTodo[];     // flat list for "Все задачи" section
}

export async function getRentalsDashboardExtended(input: {
  slug: string;
  actorUserId: string;
  date: string;
  tab?: "rent" | "service" | "all";  // default: "all" (current behavior)
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; data?: RentalsDashboardExtendedResult; error?: string }>;
```

Similarly: `getSalesDashboardExtended` and `getServiceRentalsDashboard` (the latter is just `getRentalsDashboardExtended` with `tab="service"`).

**No schema migration needed.** All data exists. Just new server-side aggregation that:
1. Calls existing `getRentalsDashboard` (no changes to it)
2. Calls existing `getCrewTodos` (no changes to it)
3. Groups todos by `rental_id` server-side
4. Computes `qrStatus`, `docsVerified`, `handoffStatus`, `renterName`, `bikeTitle` server-side
5. Returns enriched items + flat `allTodos`

---

## 7. Todos-per-rental: exact change

### Current flow (broken)

```
getRentalsDashboard(slug, date)     → RentalDashboardItem[]   (no todos)
getCrewTodos(crewId)                → CrewTodo[]              (ALL 313 todos, no rental grouping)
  ↓
<RentalsAnalyticsClient>
  ├─ <RentalsList rentals={items} />           ← flat list of rentals
  └─ <TodosSection todos={allTodos} />         ← flat grid of ALL 313 todos
                                                  (unrelated to rentals above)
```

### Proposed flow

```
getRentalsDashboardExtended(slug, date)
  → items: RentalCardItem[]   ← each item has .todos[] (filtered by rental_id)
  → allTodos: CrewTodo[]      ← flat list (for "Все задачи" toggle)

<RentalsAnalyticsClientV2>
  ├─ <RentalsTab>
  │    └─ <RentalCard item={item} />
  │         └─ <TodoList todos={item.todos} />   ← only THIS rental's todos
  └─ <AllTodosSection todos={allTodos} />         ← collapsed by default
```

### Server-side grouping logic

In `rentals-dashboard-extended.ts`:

```ts
// 1. Get base rentals (existing action, no changes)
const baseResult = await getRentalsDashboard({ slug, actorUserId, date, ... });
if (!baseResult.success) return baseResult;

// 2. Get all crew todos (existing action, no changes)
const todosResult = await getCrewTodos({ crewId, actorUserId });
const allTodos = todosResult.data || [];

// 3. Group todos by rental_id (server-side, single pass)
const todosByRentalId = new Map<string, CrewTodo[]>();
for (const todo of allTodos) {
  if (todo.rental_id) {
    const arr = todosByRentalId.get(todo.rental_id) || [];
    arr.push(todo);
    todosByRentalId.set(todo.rental_id, arr);
  }
}

// 4. Enrich each rental item with its todos + computed fields
const items: RentalCardItem[] = baseResult.data.items.map((base) => {
  return computeRentalCardFields(base, todosByRentalId.get(base.rental_id) || []);
});

// 5. Filter by tab if requested
const filtered = input.tab === "all" ? items : items.filter(i => i.tab === input.tab);

return { success: true, data: { ...baseResult.data, items: filtered, allTodos } };
```

### Client side

- `RentalCard` renders its own todos list (`item.todos.length > 0` → show; else hide)
- "Все задачи" bottom section uses `allTodos` — same flat grid as today, but **collapsed by default** (`<details>` element or state-toggled accordion)

---

## 8. Service workflow implementation

### 8.1 Service rental creation

Service rentals are created via the existing rental creation flow (`/doc-manual` bot command or web app). The operator picks a service catalog item as the "bike". No new creation flow needed.

The rental row will have:
- `vehicle_id` = service catalog item ID (e.g. `vip-bike-svc-oil-change`)
- `user_id` = client's user_id (must exist in `users`)
- `metadata.intent` = `"service"` (optional, used for analytics)
- `total_cost` = service price (from `cars.specs.price`)
- `agreed_start_date` / `agreed_end_date` = booking window

### 8.2 Auto-todo creation (already exists)

The existing `rental-verification-todos.ts` server action already creates `rental_verification` todos when a rental is created. For service rentals, the same mechanism applies — the auto-todo will have:
- `category = "rental_verification"`
- `rental_id = <service rental_id>`
- `title = "Сервис: <service type> для <client ФИО>"` (or generic — depends on how `rental-verification-todos.ts` is configured)

**No changes needed** to `rental-verification-todos.ts` for v1. If the title is generic ("Верифицировать паспорт"), we accept it for v1 and improve in v1.1.

### 8.3 Mechanic assignment

The mechanic is the operator who is `assigned_to` on the service rental's todos. The ServiceCard shows this name resolved from `users.full_name` (already done server-side by the existing `getCrewTodos` action which joins `users`).

If multiple operators are assigned to different todos on the same service rental, the card shows the **first** assignee (by `created_at ASC`) — typically the mechanic who picked up the work first.

### 8.4 Service completion

The mechanic marks the rental as completed via the existing `updateRentalStatus` server action (status: `active → completed`). The `rental_handoffs.returnCompleted` flag is set via the existing `RentalHandoffModal` "return" phase.

**No changes needed** to `updateRentalStatus` or `RentalHandoffModal` for v1.

---

## 9. Production data verification

All numbers below were verified against the live Supabase (`inmctohsodgdohamhzag.supabase.co`) on 2026-07-23. The verification script lives in the `analytics-text` skill (`franchize_pages/_existing_skills/analytics-text__SKILL.md`).

### 9.1 Rentals (36 total)

| Status                  | Count | Notes |
|-------------------------|-------|-------|
| `active`                | 22    | Primary tab content — most cards in the list |
| `completed`             | 7     | Shows in list with `Завершена` badge (gray) |
| `cancelled`             | 6     | Shows in list with `Отменена` badge (gray, dimmed) |
| `pending_confirmation`  | 1     | Shows with `Ожидает` badge (yellow) |
| **Total**               | **36** | |

Of these 36, the service rentals (where `vehicle_id` IN service catalog) are a small subset — verify on implementation by running:

```bash
curl -sS "https://inmctohsodgdohamhzag.supabase.co/rest/v1/rentals?select=rental_id,vehicle_id,vehicle:cars!inner(id,type)&vehicle.type=eq.service" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: a small number (likely 0-5 in production today). The Сервис tab will work even with 0 — it shows an empty state explaining "service rentals are created when a client books a service".

### 9.2 Sales (18 total)

18 rows in `private.sale_contract_artifacts` (filtered to this crew's bikes via `resolved_bike_id IN (crew bike IDs)`). Each row has:
- `buyer_full_name` — populated
- `sale_price` — string like `"390 000"` (parse to int via `Number(sale_price.replace(/\s/g, ""))`)
- `warranty_months` — populated (default "12")
- `resolved_bike_id` — populated

`contractStatus` is always `"signed"` in production (sales are only created after the contract is signed). The `pending` / `cancelled` states exist in the type system but don't appear in production data — the UI must still handle them.

`deliveryStatus` is not stored in production today. The card defaults to `"pending"` if `metadata.deliveryStatus` is absent. **Open question Q5** (§10.5) — should we add this column, or compute it from `rental_handoffs`?

### 9.3 Service catalog (10 items)

10 rows in `cars` where `type='service'` AND `crew_id=2d5fde70-1dd3-4f0d-8d72-66ccf6908746`. Each has:
- `id` — slug-like, prefixed with `vip-bike-svc-`
- `make` — `"Сервис"` (constant)
- `model` — the service name (e.g. `"Замена масла"`)
- `specs` — JSONB with `price` field (e.g. `{ "price": 2000 }`)
- `type` — `"service"`

The Сервис tab joins `rentals` to this catalog via `vehicle_id = cars.id` and filters `cars.type = 'service'`.

### 9.4 Crew todos (313 total)

| Category               | Status    | Count | Notes |
|------------------------|-----------|-------|-------|
| `lead_followup`        | `pending` | 159   | The bulk of the work — leads waiting for operator action |
| `lead_followup`        | `done`    | 13    | Completed followups |
| `rental_verification`  | `pending` | 120   | Document verification todos on rentals |
| `rental_verification`  | `done`    | 21    | Completed verifications |
| **Total**              |           | **313** | |

Of the 120 pending `rental_verification` todos, those with `rental_id` set (the majority) will appear inside the corresponding `RentalCard`. Those without `rental_id` (a small number) appear only in the "Все задачи" section with a "Без аренды" badge.

The 159 pending `lead_followup` todos are **not** rendered inside rental cards (they belong to leads, not rentals). They appear only in the "Все задачи" flat list. Same for the 13 done `lead_followup` todos.

### 9.5 Crew

- `crew_slug` = `vip-bike`
- `crew_id` = `2d5fde70-1dd3-4f0d-8d72-66ccf6908746`
- `owner_id` = `356282674` (the only operator with `role = "owner"`)

### 9.6 Operators (4 active crew members)

| `user_id`    | Role      | Notes |
|--------------|-----------|-------|
| `356282674`  | `owner`   | Crew owner — default fallback for unassigned todos |
| `244736261`  | (member)  | |
| `413553377`  | (member)  | |
| `7813830016` | (member)  | |

These are the only 4 operators visible in the "Assign to" dropdown when creating a todo. The `getCrewMembersForTodos` server action already returns this list.

### 9.7 Phone formats (inconsistent — known issue)

Phones in production come in multiple formats:
- `+7 999 123-45-67` (with spaces and dashes)
- `+79991234567` (no separators)
- `79200789888` (no + prefix, 11 digits)
- `89200789888` (8 prefix instead of 7, Russian style)

The leads page already consolidated this via `normalizePhone` in `lib/phone-utils.ts` (see `leads_redesign_implementation_SPEC.md` §0.4). The analytics page **must use the same `normalizePhone`** for any phone display or matching. Do not write a new normalizer.

### 9.8 ФИО presence

Every rental with `status != 'cancelled'` has a `renter_full_name` either:
- In `users.full_name` (for web-flow rentals where the renter claimed via QR), OR
- In `user_rental_secrets.renter_full_name` (for `/doc-manual` rentals where the operator entered the name)

Cancelled rentals may have null names — display "Без имени" (same as leads `displayName = lead.full_name || "Без имени"`).

---

## 10. Open questions with answers (based on production data)

### Q1. Calendar vs list default — should the default view be calendar (days with counts) or list (all rentals for the selected date)?

**Answer:** List is the default. Calendar is a secondary toggle (`calendar` view shows days as a horizontal strip with rental counts; list is the primary content). The current `RentalsAnalyticsClient.tsx:174` has `analyticsView` state with `"table" | "calendar"` — we keep this toggle but default to `"table"` (renamed to `"list"`). The calendar strip is shown above the list as a navigation aid (iOS calendar style — horizontal day strip, scrollable).

### Q2. Mobile layout — on mobile, should the calendar collapse to a date picker input?

**Answer:** Horizontal day strip (Mon 24 / Tue 25 / Wed 26) with horizontal scroll, like iOS calendar week view. Tapping a day selects it. The full date picker (with month grid) opens via a calendar icon button — same pattern as the leads page `AnalyticsDateNav` component. The current `AnalyticsDateNav` already does this — we reuse it.

### Q3. Sale detail drawer — should sales have the same detail drawer as rentals?

**Answer:** Yes, but simpler. `SaleDetailDrawer` uses the same animation and section layout but with fewer sections:
- Header (buyer name, contract status badge, price)
- Primary actions (📂 Contract / 📧 Email / 🚚 Delivery update / ⋯ More)
- Info grid (6 tiles: bike, price, date, warranty, contract key, delivery status)
- Tasks (filtered by sale_id)
- Notes (filtered by sale_id)
- History (sale_created, todo events)
- Sticky footer (status change, close)

No document checklist (sale doesn't need photo docs). No QR state (no QR for sales). No handoff (delivery is a separate concept).

### Q4. Todos that belong to NO rental — where do they go?

**Answer:** In the "Все задачи" section only, with a "Без аренды" badge. Production data: 0 of the 120 `rental_verification` todos are missing `rental_id` (the backfill migration from leads SPEC §3.4 already set it). The 159 `lead_followup` todos have `lead_id` (phone or user_id) but no `rental_id` — they appear only in "Все задачи" with their `lead_id` shown.

### Q5. Handoff modal — currently standalone. Should it be embedded in the drawer?

**Answer:** Yes — the handoff action button is in the drawer's primary actions row (or "More" menu), opens inline form. The existing `RentalHandoffModal` component is reused as a controlled modal triggered from the drawer. No new modal — just wire the existing one to the drawer's action button.

### Q6. Where do service rental notes come from?

**Answer:** For v1, notes are stored in `crew_todos.description` JSON (`{ note: "text", created_at, created_by }`). This is a hack — the proper solution is a `rental_notes` table (similar to how leads have a notes concept). For v1, we accept the hack and create a `rental_notes` table in v1.1 (separate migration). The `NotesPanel` component is written to be table-agnostic — it takes `notes: Note[]` and renders them. The data source (JSON hack vs new table) is encapsulated in the server action.

### Q7. Should the Сервис tab have its own KPI row, or share with Аренда?

**Answer:** Each tab has its own KPI row. The Сервис KPIs are: Сервисов (total), В работе (active), Завершено (completed), Выручка (sum of `total_cost` for service rentals). The Аренда KPIs are: Активных, Возврат сегодня, Просрочек, Выручка. The Продажа KPIs are: Продаж, Выручка, Средний чек, Гарантия ср.

### Q8. Should the redesign touch the rentals list page (`/franchize/[slug]/rentals`)?

**Answer:** No — that page (`RentalsListClient.tsx`) is already a clean, modern, mobile-first list view that uses `T.*` theme tokens. It's a separate concern (the "all my rentals" view) from the analytics dashboard (the "operational dashboard for the crew"). Leave it as-is. The redesign only touches `rentals-analytics/`, `sales-analytics/`, and adds the new `service-analytics/` (which reuses `rentals-analytics/` components).

### Q9. Should we use `react-resizable-panels` for desktop split-pane (like leads)?

**Answer:** No — the analytics page is a vertical stack of cards, not a two-pane layout. The detail drawer is a modal overlay (slide-up sheet on mobile, right panel on desktop), not a persistent side panel. This matches the current `RentalsAnalyticsClient.tsx` UX (clicking a rental row opens a modal). We keep the drawer-as-overlay pattern, not split-pane.

### Q10. Should the redesign remove the `SubrentsSection`, `CommercialProposalsListSection`, and other secondary sections from the current page?

**Answer:** Yes, for v1. The current page has 5 tabs (Аренда / Продажа / Ком.предложения / Субаренда / Все задачи). The redesign collapses to 3 tabs (Аренда / Продажа / Сервис). Subrents and commercial proposals move to a separate page (`/franchize/[slug]/subrents` and `/franchize/[slug]/commercial-offers`) — they're low-traffic and don't belong on the main operational dashboard. The "Все задачи" section becomes a collapsible footer in each tab (not a separate tab).

---

## 11. Skill references

### 11.1 Existing skill: `analytics-text`

The `analytics-text` skill (`franchize_pages/_existing_skills/analytics-text__SKILL.md`) provides a text-only CLI dashboard with 4 commands:
- `rentals-dashboard [--date YYYY-MM-DD]` — text rentals table
- `sales-dashboard [--date YYYY-MM-DD]` — text sales table
- `todos-dashboard` — text todos grouped by category
- `crew-stats` — per-member todo statistics

This skill is the **verification oracle** for the redesign — every number on the new UI must match the corresponding text output. The skill queries Supabase directly via `curl`, so it's independent of the server actions and can be used to verify the server actions are returning correct data.

### 11.2 Skill expansion planned

The `analytics-text` skill will be expanded with:
- `service-dashboard [--date YYYY-MM-DD]` — text service rentals table (filtered by `cars.type='service'`)
- `rental-detail <rental_id>` — text dump of one rental with all fields (for debugging the drawer)
- `sale-detail <sale_id>` — text dump of one sale

These commands live in the same skill file. The trigger phrases already include "сервис" via the general "аналитика" pattern. The expansion is a separate task (post-redesign).

### 11.3 Pattern reuse from `leads-crm-text`

The `analytics-text` skill follows the same pattern as the sibling `leads-crm-text` skill — same `curl` invocation style, same `fmtRub` / `fmtRange` helpers, same PostgREST query patterns. Any new command added to `analytics-text` should reuse these helpers, not duplicate them.

---

## 12. Mobile-first layout decisions (same as leads)

These decisions are copied verbatim from `leads_redesign_PRD.md` §0.4 — the analytics page targets the same audience (Telegram WebApp on mobile) and uses the same patterns.

1. **Primary target: Telegram WebApp on mobile** (320-414px wide). Desktop (1280px+) is secondary.
2. **Default layout: vertical stack.** Cards stack vertically, full-width. No multi-column grid on mobile.
3. **Detail drawer: slide-up sheet on mobile.** `max-w-full`, `h-[90vh]`, `rounded-t-3xl`, slide from bottom. Closes via swipe-down (gesture) or X button. Same as `LeadDetailDrawer` mobile mode.
4. **Detail drawer: right panel on desktop.** `max-w-[640px]`, `h-full`, `right-0`, slide from right. Same as `LeadDetailDrawer` desktop mode.
5. **Touch targets: minimum 44×44px.** All buttons, cards, list items follow this minimum.
6. **No hover-only interactions.** All actions available via tap. Hover states are progressive enhancement only.
7. **Search bar: sticky top.** Stays visible when scrolling the list. Filters appear below the search bar as collapsible section.
8. **Tab bar: horizontal scroll on mobile.** If tabs don't fit, they scroll horizontally (Аренда | Продажа | Сервис). Active tab highlighted with accent color underline.
9. **KPI cards: 2×2 grid on mobile, 1×4 row on desktop.** Same as current `StatCard` grid (`grid-cols-2 md:grid-cols-4`).
10. **Pull-to-refresh.** The current `RentalsAnalyticsClient.tsx:181-185` already implements pull-to-refresh. Keep it.

---

## 13. Theme consistency requirements

### 13.1 ThemeTokens (`T.*`)

All colors come from `T: ThemeTokens` via the `useCrewTokens` hook (see `RentalsListClient.tsx:43`). The tokens are:

```ts
interface ThemeTokens {
  bg: string;          // page background (very dark charcoal)
  bgCard: string;      // card background (slightly lighter than bg)
  bgElevated: string;  // elevated surfaces (modals, drawers)
  text: string;        // primary text
  textMuted: string;   // secondary text
  textInverse: string; // text on accent backgrounds
  accent: string;      // accent color (yellow for vip-bike)
  accentSoft: string;  // accent with low opacity for backgrounds
  border: string;      // border color
  borderSoft: string;  // softer border
  success: string;     // green
  warning: string;     // yellow
  danger: string;      // red
  info: string;        // blue
  styles: {
    card: CSSProperties;
    ctaPrimary: CSSProperties;
    ctaSecondary: CSSProperties;
    accentBadge: CSSProperties;
    accentPill: CSSProperties;
    successBadge: CSSProperties;
    warningBadge: CSSProperties;
    dangerBadge: CSSProperties;
    // ... add as needed
  };
}
```

### 13.2 Hardcoded color whitelist

The only hardcoded colors allowed are the **semantic status colors** (same as `LeadDetailDrawer.tsx`):

| Color    | Hex       | Usage |
|----------|-----------|-------|
| Green    | `#22c55e` | success, active, completed, verified |
| Yellow   | `#facc15` | pending, waiting, accent |
| Orange   | `#f59e0b` | due soon, warning |
| Red      | `#ef4444` | overdue, danger, missing |
| Gray     | `#a1a1aa` | cancelled, muted, neutral |
| Blue     | `#3b82f6` | info, communication |
| Dark bg  | `#0c0c0e` | drawer background (matches `LeadDetailDrawer.tsx:207`) |

These are **not** in `ThemeTokens` because they're semantic (independent of crew theme). They appear in `RENTAL_STATUSES` (§6.1) and the SLA signal tones.

### 13.3 Migration from CSS vars

The current `RentalsAnalyticsClient.tsx` uses CSS vars:
- `var(--franchize-bg-base)` → `T.bg`
- `var(--franchize-bg-card)` → `T.bgCard`
- `var(--franchize-accent-main)` → `T.accent`
- `var(--franchize-text-primary)` → `T.text`
- `var(--franchize-text-secondary)` → `T.textMuted`
- `var(--franchize-border-soft)` → `T.borderSoft`

The migration is mechanical — replace each `var(...)` with the corresponding `T.*` token. The `SalesAnalyticsClient.tsx` and `RentalsListClient.tsx` use a mix; standardize on `T.*` everywhere.

### 13.4 Glass panel pattern

The `design_closups_prd.md` "shared design tokens" section defines `.glass-panel`:

```css
.glass-panel {
  background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025));
  border: 1px solid var(--border);
  box-shadow: 0 18px 50px rgba(0,0,0,0.35);
  backdrop-filter: blur(12px);
}
```

This is used for cards, drawers, and modals. Implement as a `T.styles.glassPanel` style object (add to `ThemeTokens.styles`) so it inherits the crew theme's border color.

---

## 14. Phasing

### Phase 1 — Rentals tab + RentalCard + per-rental todos (3 days)

- [ ] Create `app/franchize/[slug]/rentals-analytics/lib/rental-statuses.ts` (§6.1)
- [ ] Create `app/franchize/[slug]/rentals-analytics/lib/rental-card-fields.ts` (computes `RentalCardItem` from `RentalDashboardItem` + todos)
- [ ] Create `app/franchize/server-actions/rentals-dashboard-extended.ts` (§6.5)
- [ ] Create `app/franchize/[slug]/rentals-analytics/components-v2/RentalCard.tsx`
- [ ] Create `app/franchize/[slug]/rentals-analytics/components-v2/RentalTodoList.tsx` (inline todos on card)
- [ ] Create `app/franchize/[slug]/rentals-analytics/components-v2/AllTodosSection.tsx` (collapsed flat list)
- [ ] Create `app/franchize/[slug]/rentals-analytics/RentalsAnalyticsClientV2.tsx` (feature-flagged)
- [ ] Wire feature flag: `?ui=v2` or `localStorage.analytics_ui_v2 = "true"`

### Phase 2 — RentalDetailDrawer (3 days)

- [ ] Create `app/franchize/[slug]/rentals-analytics/components-v2/RentalDetailDrawer.tsx` (copy from `LeadDetailDrawer.tsx`)
- [ ] Create `app/franchize/[slug]/rentals-analytics/components-v2/RentalInfoGrid.tsx`
- [ ] Create `app/franchize/[slug]/rentals-analytics/components-v2/RentalDocumentsSection.tsx`
- [ ] Create `app/franchize/[slug]/rentals-analytics/components-v2/RentalSLAOverview.tsx`
- [ ] Create `app/franchize/[slug]/rentals-analytics/components-v2/RentalHistorySection.tsx`
- [ ] Reuse `NotesPanel` and `TodoList` from leads components (generic enough)
- [ ] Wire drawer open/close to `RentalCard` click

### Phase 3 — Sales tab + SaleCard + SaleDetailDrawer (2 days)

- [ ] Create `app/franchize/server-actions/sales-dashboard-extended.ts` (wraps `getSalesDashboard` + adds todos/notes)
- [ ] Create `app/franchize/[slug]/sales-analytics/components-v2/SaleCard.tsx`
- [ ] Create `app/franchize/[slug]/sales-analytics/components-v2/SaleDetailDrawer.tsx` (simpler than rental — no docs, no QR)
- [ ] Migrate `SalesAnalyticsClient.tsx` to `SalesAnalyticsClientV2.tsx` (feature-flagged)

### Phase 4 — Services tab (2 days)

- [ ] Create `app/franchize/server-actions/service-dashboard.ts` (wraps `getRentalsDashboardExtended` with `tab="service"`)
- [ ] Create `app/franchize/[slug]/rentals-analytics/components-v2/ServiceCard.tsx` (extends `RentalCard`)
- [ ] Create `app/franchize/[slug]/rentals-analytics/components-v2/ServiceDetailDrawer.tsx` (extends `RentalDetailDrawer` — mechanic section instead of handoff)
- [ ] Add Сервис tab to the tab nav

### Phase 5 — Migration + cleanup (1 day)

- [ ] Move `SubrentsSection` to `/franchize/[slug]/subrents` page (separate route)
- [ ] Move `CommercialProposalsListSection` to `/franchize/[slug]/commercial-offers` page (separate route)
- [ ] Remove old `RentalsAnalyticsClient.tsx` (replaced by V2)
- [ ] Remove old `SalesAnalyticsClient.tsx` (replaced by V2)
- [ ] Remove feature flag — V2 becomes default
- [ ] Update `analytics-text` skill with `service-dashboard` command (§11.2)

**Total: ~11 days.** Can be parallelized — Phase 3 and Phase 4 are independent and can be done in parallel after Phase 2.

---

## 15. Definition of done

- [ ] Three tabs (Аренда / Продажа / Сервис) work with independent KPI rows and card lists
- [ ] Todos are per-rental, not a flat giant list — each `RentalCard` shows only its relevant todos
- [ ] Rental card shows doc completeness with visual indicator (`3/5 ✅` or `3 missing 🔴`)
- [ ] Rental card shows QR claim state with badge
- [ ] Rental card shows handoff state with badge
- [ ] Rental card shows SLA countdown to return ("завтра 18:00" / "просрочен на 2 ч")
- [ ] Rental card shows renter **ФИО** (not phone)
- [ ] Clicking a rental card opens `RentalDetailDrawer` with all 9 sections (§5.1)
- [ ] Rental detail drawer shows: info grid, documents, SLA overview, tasks, notes, history
- [ ] "Все задачи" section at bottom shows all 313 crew todos (collapsed by default)
- [ ] Sales cards show buyer **ФИО** + bike + price + contract status + delivery status
- [ ] Sales cards have embedded todos + notes
- [ ] Service tab shows service rentals with mechanic assignment
- [ ] All colors come from `T.*` theme tokens — no hardcoded hex except semantic status whitelist (§13.2)
- [ ] Mobile-first: slide-up sheet on mobile, right panel on desktop (same as leads)
- [ ] Feature flag works — old UI accessible until V2 passes acceptance scenarios
- [ ] No new schema migrations required (all data exists)
- [ ] No server actions modified (only new wrappers added)
- [ ] `analytics-text` skill output matches the new UI numbers (verification oracle)

---

## 16. References

### Companion docs (this redesign)
- `analytics_visual_description.md` — visual design spec (mirrors `design_closups_prd.md` for leads)
- `analytics_implementation_SPEC.md` — file-by-file implementation guide (mirrors `leads_redesign_implementation_SPEC.md`)

### Sibling project (leads)
- `download/leads_redesign_PRD.md` — leads PRD (pattern reference)
- `download/leads_redesign_implementation_SPEC.md` — leads implementation spec (pattern reference)
- `download/design_closups_prd.md` — leads visual moodboard (visual reference)
- `download/ui_components/LeadDetailDrawer.tsx` — drawer pattern to copy (689 lines)

### Current codebase
- `app/franchize/[slug]/rentals-analytics/RentalsAnalyticsClient.tsx` — current rentals analytics (1482 lines, to be replaced)
- `app/franchize/[slug]/sales-analytics/SalesAnalyticsClient.tsx` — current sales analytics (122 lines, to be replaced)
- `app/franchize/[slug]/rentals/RentalsListClient.tsx` — clean modern rentals list (274 lines, already uses `T.*` — reference for theme token usage)
- `app/franchize/[slug]/rentals-analytics/RentalsCalendar.tsx` — existing calendar component (reuse)
- `app/franchize/[slug]/rentals-analytics/RentalHandoffModal.tsx` — existing handoff modal (reuse, wire to drawer)
- `app/franchize/[slug]/rentals-analytics/analytics-components/` — existing sub-components (StatCard, AnalyticsDateNav, AnalyticsCrossNav, AnalyticsPasswordEntry, AnalyticsLoading — reuse; TodosSection, ChecklistPanel, RentalRowActions, RentalsStatsRow — replace)
- `app/franchize/[slug]/rentals-analytics/analytics-utils.ts` — formatting helpers (reuse: `formatRubles`, `formatRussianDate`, `formatRussianDateOnly`)

### Server actions (DO NOT MODIFY — only wrap)
- `app/franchize/server-actions/rentals-dashboard.ts` (~2846 lines) — `getRentalsDashboard`, `getSalesDashboard`, `updateRentalStatus`, `regenerateRentalQr`, `sendRentalDocByEmail`, `getRentalsDateRange`, `getRentalsForExport`, `getCommercialProposalsDashboard`, `getSubrentContractsDashboard`
- `app/franchize/server-actions/crew-todos.ts` — `getCrewTodos`, `getCrewTodoStats`, `createCrewTodo`, `getCrewMembersForTodos`
- `app/franchize/server-actions/checklist.ts` — `getAllChecklistStates`, `updateChecklistState`
- `app/franchize/server-actions/rental-verification-todos.ts` — auto-todo creation (do not touch)
- `app/franchize/server-actions/subrent-approval.ts` — subrent application flow (do not touch)

### Theme + utilities
- `app/franchize/hooks/useFranchizeTheme.ts` — theme hook (sets CSS vars)
- `app/franchize/lib/use-crew-tokens.ts` — `useCrewTokens` hook (returns `T: ThemeTokens`)
- `app/franchize/lib/theme.ts` — `withAlpha` helper, `crewPaletteWithCssVars`
- `app/franchize/lib/phone-utils.ts` — `normalizePhone` (consolidated in leads SPEC §0.4)
- `app/franchize/hooks/useSupabaseRealtime.ts` — realtime subscription hook

### Skills
- `franchize_pages/_existing_skills/analytics-text__SKILL.md` — text-only analytics CLI (verification oracle)
- `download/skills/leads-crm-text/SKILL.md` — sibling skill (pattern reference)

### Supabase tables (reference)
- `public.rentals` — 36 rows, schema in `analytics-text__SKILL.md` §Schema reference
- `public.cars` — service catalog filter: `type='service'`
- `public.users` — renter/buyer/mechanic ФИО
- `public.crew_todos` — 313 rows, has `rental_id` FK
- `public.rental_handoffs` — handoff state (odometer, completed flags)
- `private.sale_contract_artifacts` — 18 rows (PII, service-role only)
- `private.user_rental_secrets` — QR claim state, verification status (PII, service-role only)
