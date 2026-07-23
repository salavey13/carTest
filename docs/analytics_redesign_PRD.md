# PRD — Rentals & Sales Analytics v2 (Rental-Centric Dashboard)

Last updated: 2026-07-23
Status: Draft for review
Visual reference: `leads_redesign_PRD.md` (component patterns to reuse)
Codebase: `app/franchize/[slug]/rentals-analytics/`, `sales-analytics/`, `commercial-offers-analytics/`
Server actions: `app/franchize/server-actions/rentals-dashboard.ts`, `crew-todos.ts`

---

## 0. Product decisions (proposed)

1. **Todos belong to a rental** — the primary mode is rental-first: you see a rental, you see its todos. Flat todo list is secondary (available via "Все задачи" toggle).
2. **Rentals detail drawer** — reuse the same drawer pattern from Leads UI v2: right panel on desktop, slide-up sheet on mobile.
3. **No kanban for rentals** — rentals are linear (timeline), not pipeline stages. Board view doesn't apply.
4. **Calendar is the primary navigation** — the existing `RentalsCalendar` is the default view. List view is secondary.
5. **Sales analytics reuses RentalsCalendar pattern** — same calendar nav, same date picker, but shows sales data.

---

## 1. Summary

Replace the current flat analytics page with a **rental-centric operational dashboard** that makes the obvious at a glance:

1. **What's happening today** — upcoming returns, new rentals, outstanding docs per rental
2. **Todos per rental** — not one giant flat list. Each rental card shows its own todos.
3. **Rental status lifecycle** — confirmed → active → return_due → completed, with dates and SLA
4. **Document completeness per rental** — passport, license, odometer photo — visible on the card
5. **QR claim state per rental** — sent / claimed / unclaimed
6. **Handoff status** — operator-to-renter handoff completed or pending
7. **Revenue per rental** — actual cost, deposit, extras

### Key pain points (current)

| # | Pain point | Current behavior | Desired behavior |
|---|---|---|---|
| 1 | **Todos flat list** | `TodosSection` shows ALL crew todos in a 3-col grid, unrelated to rentals | Todos grouped under their rental; rental card shows "3 задачи" badge |
| 2 | **No rental detail** | Clicking a rental row only shows actions menu (status change, QR, email) | Clicking opens a drawer with full rental detail: renter, bike, dates, docs, todos, QR, timeline |
| 3 | **No document status** | Docs are checked in the `ChecklistPanel` but not shown per rental | Each rental card shows doc completeness as `2/5 ✅` or `3 missing 🔴` |
| 4 | **No handoff tracking** | `RentalHandoffModal` exists but handoff state is not visible on the card | Rental card shows handoff badge: "Передан ✅" or "Ожидает 🔄" |
| 5 | **Empty sales page** | Sales analytics has only a basic list with summary stats | Sales should show buyer detail, contract status, document checklist |

---

## 2. Page structure — Rentals Analytics

```
┌──────────────────────────────────────────────────────┐
│ 📅 <— date nav —>  │  📊 summary stats row            │
├──────────────────────────────────────────────────────┤
│ 🔄 Tab nav: Аренда │ Продажи │ Ком.предложения │ Субаренда │
├──────────────────────────────────────────────────────┤
│ 🔎 Search + filter bar (status, renter, bike, date)  │
├──────────────────────────────────────────────────────┤
│ 🗓️ Calendar view (default)  │  📋 List view toggle     │
│ ┌────────────────┐ ┌─────────┐                        │
│ │  Mon 24  │  5  │ │ Tue 25  │ 3  │ ← days with      │
│ │  Wed 26  │  8  │ │ Thu 27  │ 2  │   rental count    │
│ └────────────────┘ └─────────┘                        │
├──────────────────────────────────────────────────────┤
│ Rental cards (selected date)                          │
│ ┌─────────────────────────────────────────────┐      │
│ │ 🟢 Активная  │ 🏍 Falcon PRO                │      │
│ │ 👤 Иванов И.  │ 📞 +7 999 123-45-67          │      │
│ │ 📅 24 Jul → 27 Jul  │ 💰 12 000₽            │      │
│ │ 📋 Доки: 3/5 🔴  │ 📱 QR: ✅ принят          │      │
│ │ ✅ Передан     │ ⚠️ 2 задачи просрочено      │      │
│ │ ──── задачи ────                              │      │
│ │ ☐ Верифицировать паспорт (high)              │      │
│ │ ☑ Подтвердить одометр (medium)               │      │
│ │ 📎 + Добавить задачу                          │      │
│ │ [📂 Открыть] [🔄 Переслать QR] [📧 Отправить]  │      │
│ └─────────────────────────────────────────────┘      │
│ ...more cards...                                      │
├──────────────────────────────────────────────────────┤
│ 📋 Все задачи (expandable flat list — opt-in)        │
└──────────────────────────────────────────────────────┘
```

### Acceptance criteria
- [ ] Rental card shows renter + bike + dates + cost + status at a glance
- [ ] Rental card shows document completeness (checked count / total)
- [ ] Rental card shows QR claim state (unclaimed/sent/claimed)
- [ ] Rental card shows handoff state (pending/completed)
- [ ] Todos are rendered INSIDE the rental card, not in a separate section
- [ ] Clicking a rental card opens a detail drawer (see §4)
- [ ] Calendar navigation works (prev/next day, today button)
- [ ] Search works across renter name, phone, bike title
- [ ] Filter by status (active, confirmed, completed, cancelled)

---

## 3. Page structure — Sales Analytics

```
┌──────────────────────────────────────────────────────┐
│ 📅 <— date nav —>  │  💰 summary stats row            │
├──────────────────────────────────────────────────────┤
│ 🔄 Tab nav: Аренда │ Продажи │ Ком.предложения │ Субаренда │
├──────────────────────────────────────────────────────┤
│ 🔎 Search + filter bar (buyer, bike, status)          │
├──────────────────────────────────────────────────────┤
│ Sales cards (selected date)                           │
│ ┌─────────────────────────────────────────────┐      │
│ │ 💳 Продажа    │ 🏍 Bad Boy 15kW              │      │
│ │ 👤 Петров П.  │ 📞 +7 987 654-32-10          │      │
│ │ 💰 700 000₽   │ 📅 22 Jul 2026               │      │
│ │ 📋 Договор: ✅ подписан    │ 🚚 Доставка: 🟡 ждёт │
│ │ ──── задачи ────                              │      │
│ │ ☐ Подготовить ПТС (high)                     │      │
│ │ ──── заметки ────                             │      │
│ │ 📝 "Клиент просил установить доп.зеркала"    │      │
│ │ [📂 Открыть] [📧 Договор] [📄 Акт]            │      │
│ └─────────────────────────────────────────────┘      │
│ ...more cards...                                      │
├──────────────────────────────────────────────────────┤
│ 📋 Все задачи (flat list — opt-in)                    │
└──────────────────────────────────────────────────────┘
```

### Acceptance criteria
- [ ] Sales card shows buyer + bike + price + date at a glance
- [ ] Sales card shows contract status (signed/pending/cancelled)
- [ ] Sales card shows delivery status (pending/in_transit/delivered)
- [ ] Todos for the sale are shown inside the card
- [ ] Notes for the sale are shown inside the card
- [ ] Search works across buyer name, phone, bike title

---

## 4. Detail drawer (rental-specific)

Reuse the same pattern as `LeadDetailDrawer` but for rental data:

| Section | Content | Comment |
|---|---|---|
| **Header** | Renter name, phone, stage badge (active/confirmed/completed) | Stage color from rental status |
| **Primary actions** | 📂 Open contract · 📧 Send doc · 🔄 Resend QR · 📞 Call | Same pattern as leads drawer |
| **Info grid** | 2-col: bike, dates, cost, deposit, odometer start, odometer end, fuel level, QR status, handoff status | 10 tiles |
| **Documents** | 5-item checklist with status per item: passport main, passport reg, license, odometer, dates | Reuse `ChecklistPanel` but inside drawer |
| **Timeline** | System-generated events: created → contract sent → QR sent → QR claimed → rental active → return due → completed | Same pattern as leads history |
| **Tasks** | Todos for THIS rental only (filtered by `rental_id`). Assignee + due date + sub-filters | Not all crew todos |
| **Notes** | Free-form notes attached to this rental | Chronological |
| **Sticky footer** | [Статус] [Действия] [Закрыть] | Status change triggers `RentalStatusChangeModal` |

---

## 5. Data model — new / extended fields

### 5.1 `RentalCardItem` (new frontend type)

```ts
interface RentalCardItem {
  rentalId: string;
  status: 'confirmed' | 'active' | 'completed' | 'cancelled' | 'pending_confirmation';
  renterName: string | null;
  renterPhone: string | null;
  bikeTitle: string | null;
  startDate: string;
  endDate: string;
  totalCost: number;
  deposit: number | null;

  // Document completeness
  docsTotal: number;     // 5
  docsVerified: number;  // verified count
  docsMissing: string[]; // list of missing doc types

  // QR state
  qrStatus: 'unclaimed' | 'sent' | 'claimed' | 'expired';

  // Handoff
  handoffStatus: 'pending' | 'completed';

  // Todos for this rental
  todos: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    assignedTo: string | null;
    dueDate: string | null;
  }>;

  // Notes count
  notesCount: number;
}
```

### 5.2 `SaleCardItem` (new frontend type)

```ts
interface SaleCardItem {
  saleId: string;
  buyerName: string | null;
  buyerPhone: string | null;
  bikeTitle: string | null;
  salePrice: number;
  saleDate: string;
  contractStatus: 'signed' | 'pending' | 'cancelled';
  deliveryStatus: 'pending' | 'in_transit' | 'delivered' | 'picked_up';

  // Todos for this sale (matched by rental_id = sale_id or lead_id)
  todos: Array<{...}>;

  // Notes
  notes: Array<{ text: string; created_at: string; author: string }>;
}
```

### 5.3 Server action changes

**Current:** `getRentalsDashboard` returns `RentalDashboardItem[]` with basic fields + a separate `getCrewTodos` call.

**Proposed:** `getRentalsDashboardExtended(slug, date)` returns:
- `items: RentalCardItem[]` — each with embedded `todos` + `notesCount`
- `summary: RentalDashboardSummary` — same as today
- `allTodos: CrewTodo[]` — flat list for the "Все задачи" section (optional, opt-in)

Similarly for sales: `getSalesDashboardExtended` returns `SaleCardItem[]` with embedded todos + notes.

**No schema migration needed** — all data exists. Just new server-side aggregation.

---

## 6. Todos-per-rental: exact change

### Current flow
```
getCrewTodos(crewId) → CrewTodo[] → { id, title, status, assigned_name }
  ↓
<TodosSection todos={todos} />  ← flat grid of ALL crew todos
```

### Proposed flow
```
getRentalsDashboardExtended(slug, date)
  → items: RentalCardItem[]  ← each item has .todos[] (filtered by rental_id)
  → allTodos: CrewTodo[]     ← flat list (for "Все задачи" toggle)

Inside RentalCard:
  → <RentalTodoList todos={item.todos} />  ← compact, per-rental
```

**Server side:** extend `getRentalsDashboard` to:
1. Fetch ALL crew todos via existing `getCrewTodos`
2. Group them by `rental_id` (the FK on `crew_todos`)
3. Attach each group to its rental item
4. Store ungrouped todos in a separate `allTodos` field

**Client side:** 
- `RentalCard` component renders its own todos list (`filteredTodos.length > 0` → show; else hide)
- "Все задачи" bottom section uses `allTodos` — same flat grid as today, but collapsed by default

---

## 7. Rental detail drawer (Leads pattern reuse)

### Implementation approach
Reuse `LeadDetailDrawer` component structure but create a parallel `RentalDetailDrawer`:
- Same animation (AnimatePresence, slide from right)
- Same section layout (header, actions, info grid, docs, tasks, notes)
- Different data source (rental data, not lead data)
- No SLA signals (rentals have status, not signals)
- No pipeline stage (rentals have linear lifecycle)

**Reuse from Leads UI v2:**
- `Section.tsx` — collapsible section wrapper
- `LeadInfoGrid.tsx` — adapt props to rental fields
- `LeadDocumentsSection.tsx` — adapt to rental docs checklist
- `NotesPanel.tsx` — same, just filter by rental_id
- `TodoList.tsx` — same, just filter by rental_id

---

## 8. Phasing

### Phase 1 — Todos-per-rental + RentalCard (2 days)
- [ ] Extend `getRentalsDashboard` server action to embed `todos[]` per item
- [ ] Create `RentalCard` component with embedded todo list
- [ ] Modify `RentalsAnalyticsClient` to use `RentalCard` instead of flat rental rows
- [ ] Add collapsible "Все задачи" section at bottom

### Phase 2 — Rental detail drawer (2 days)
- [ ] Create `RentalDetailDrawer` component (adapt from `LeadDetailDrawer`)
- [ ] Add document checklist panel inside drawer
- [ ] Add rental timeline (computed from status changes + dates)
- [ ] Add notes section inside drawer

### Phase 3 — Sales analytics upgrade (1 day)
- [ ] Extend `getSalesDashboard` to embed `todos[]` + `notes` per item
- [ ] Create `SaleCard` component with embedded todos
- [ ] Add contract status + delivery status to sale card
- [ ] Same calendar navigation as rentals

---

## 9. Definition of done

- [ ] Todos are per-rental, not a flat giant list — each `RentalCard` shows only its relevant todos
- [ ] Rental card shows doc completeness with visual indicator (count + missing labels)
- [ ] Rental card shows QR claim state (unclaimed/sent/claimed/expired) with badge
- [ ] Rental card shows handoff state (pending/completed)
- [ ] Clicking a rental card opens a detail drawer with all sections
- [ ] Rental detail drawer shows: info grid, documents, timeline, tasks, notes
- [ ] "Все задачи" section at bottom shows all crew todos (collapsed by default)
- [ ] Sales cards show buyer + bike + price + contract status + delivery status
- [ ] Sales cards have embedded todos + notes
- [ ] No new schema migrations required (all data exists)

---

## 10. Open questions

1. **Calendar vs list default** — should the default view be calendar (days with counts) or list (all rentals for the selected date)?
   Suggest: Calendar is the navigation, list is the content. Calendar on top, list below.

2. **Mobile layout** — on mobile, should the calendar collapse to a date picker input?
   Suggest: horizontal day strip (Mon 24 / Tue 25 / Wed 26) with scroll, like iOS calendar.

3. **Sale detail drawer** — should sales have the same detail drawer as rentals?
   Suggest: Yes, but simpler — no document checklist (sale doesn't need photo docs), no QR state.

4. **Todos that belong to NO rental** — where do they go?
   Suggest: in the "Все задачи" section only, with a "Без аренды" badge.

5. **Handoff modal** — currently standalone. Should it be embedded in the drawer?
   Suggest: yes — the handoff action button is in the drawer primary actions row, opens inline form.

---

## 11. References

- **Leads detail drawer pattern:** `leads_redesign_PRD.md` §5 (drawer section order, animation, sticky footer)
- **Current rentals analytics:** `app/franchize/[slug]/rentals-analytics/` (21 components)
- **Current sales analytics:** `app/franchize/[slug]/sales-analytics/` (2 files)
- **Server actions:** `app/franchize/server-actions/rentals-dashboard.ts` (~2600 lines)
- **Crew todos:** `app/franchize/server-actions/crew-todos.ts`
- **Checklist:** `app/franchize/server-actions/checklist.ts`
- **Handoff modal:** `app/franchize/[slug]/rentals-analytics/RentalHandoffModal.tsx`
- **Calendar:** `app/franchize/[slug]/rentals-analytics/RentalsCalendar.tsx`
