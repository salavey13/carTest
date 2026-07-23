# Analytics UI v2 — Implementation Spec

Last updated: 2026-07-23
For: frontend/fullstack agent implementing the analytics redesign.
Companion docs: `analytics_redesign_PRD.md` (product spec), `analytics_visual_description.md` (visual reference).

---

## 0. Prerequisites

1. Read `analytics_redesign_PRD.md` §0 (product decisions) — non-negotiables
2. Read `analytics_visual_description.md` — visual design
3. Read existing `RentalsAnalyticsClient.tsx` — current code (65KB)
4. Read `rentals-dashboard.ts` — server actions (108KB, DO NOT modify)
5. Read leads page v2 components for pattern reuse (LeadDetailDrawer, MobileLeadSheet, etc.)
6. **Import paths**: use `../` relative (NOT `@/app/franchize/[slug]`)
7. **Theme**: use `T: ThemeTokens` from `../hooks/useTheme` (NOT CSS vars)
8. **ФИО primary**: `displayName = rental.user?.full_name || "Без имени"` (NOT phone)
9. **Mobile-first**: slide-up sheet, not desktop split-pane as default

---

## 1. Files to create (new)

### Phase 1 — Cards + List + Orchestrator

| File | Purpose |
|---|---|
| `app/franchize/[slug]/rentals-analytics/components/AnalyticsClient.tsx` | Main orchestrator (replaces RentalsAnalyticsClient) |
| `app/franchize/[slug]/rentals-analytics/components/AnalyticsTabNav.tsx` | Tab bar (Аренда/Продажа/Сервис) |
| `app/franchize/[slug]/rentals-analytics/components/AnalyticsDateNav.tsx` | Date navigator |
| `app/franchize/[slug]/rentals-analytics/components/AnalyticsKPICards.tsx` | 4-card KPI row |
| `app/franchize/[slug]/rentals-analytics/components/AnalyticsRentalCard.tsx` | Rental card with docs/handoff/SLA |
| `app/franchize/[slug]/rentals-analytics/components/AnalyticsSaleCard.tsx` | Sale card |
| `app/franchize/[slug]/rentals-analytics/components/AnalyticsServiceCard.tsx` | Service card |
| `app/franchize/[slug]/rentals-analytics/components/AnalyticsRentalList.tsx` | Virtualized rental list |
| `app/franchize/[slug]/rentals-analytics/components/AnalyticsEmptyState.tsx` | Empty state |

### Phase 2 — Detail Drawers

| File | Purpose |
|---|---|
| `app/franchize/[slug]/rentals-analytics/components/RentalDetailDrawer.tsx` | Full rental detail (10 sections) |
| `app/franchize/[slug]/rentals-analytics/components/AnalyticsMobileSheet.tsx` | Bottom sheet for mobile |

### Phase 3 — Sales + Service Detail

| File | Purpose |
|---|---|
| `app/franchize/[slug]/rentals-analytics/components/SaleDetailDrawer.tsx` | Sale detail |
| `app/franchize/[slug]/rentals-analytics/components/ServiceDetailDrawer.tsx` | Service detail |

---

## 2. Files to modify

| File | Change |
|---|---|
| `app/franchize/[slug]/rentals-analytics/page.tsx` | Import AnalyticsClient instead of RentalsAnalyticsClient (behind feature flag) |

---

## 3. Files NOT to touch

- `app/franchize/server-actions/rentals-dashboard.ts` — works, don't break it
- `app/franchize/server-actions/rentals.ts` — works
- `app/franchize/server-actions/crew-todos.ts` — works
- `app/franchize/server-actions/checklist.ts` — works
- All leads page components (separate concern)

---

## 4. TypeScript types

```typescript
interface AnalyticsRentalRow {
  rental_id: string;
  user_id: string;
  owner_id: string;
  vehicle_id: string;
  status: "pending_confirmation" | "confirmed" | "active" | "completed" | "cancelled" | "disputed";
  payment_status: string;
  total_cost: number;
  requested_start_date: string | null;
  requested_end_date: string | null;
  agreed_start_date: string | null;
  agreed_end_date: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
  passport_mainpage_photo: string | null;
  passport_registration_photo: string | null;
  drivers_licence_frontal_photo: string | null;
  crew_id: string | null;
  created_by_operator_chat_id: string | null;
  vehicle?: { make: string; model: string } | null;
  user?: { full_name: string | null; username: string | null } | null;
}

interface AnalyticsSaleRow {
  id: string;
  buyer_full_name: string | null;
  buyer_phone: string | null;
  buyer_email: string | null;
  sale_price: string | null;
  total_sum: number | null;
  created_at: string;
  resolved_bike_id: string | null;
  vehicle?: { make: string; model: string } | null;
}

interface AnalyticsKpis {
  totalToday: number;
  revenueToday: number;
  activeCount: number;
  returnsDue: number;
}
```

---

## 5. Component specs

### AnalyticsClient.tsx
- State: `date`, `activeTab` ("rentals"|"sales"|"services"), `selectedId`, `rentals`, `sales`, `serviceRentals`, `todos`, `kpis`
- Fetch: `getRentalsDashboard({slug, actorUserId, date})` for rentals, `getSalesDashboard({slug, date})` for sales
- Services: filter rentals where `vehicle_id` starts with `vip-bike-svc-` (or join cars.type='service')
- Render: TabNav → DateNav → KPICards → List → Detail (split-pane desktop, sheet mobile)
- Feature flag: `?ui=v2` or `localStorage.analytics_ui_v2`

### AnalyticsRentalCard.tsx
- Left edge: 3px status color
- Bike: `rental.vehicle?.make + " " + rental.vehicle?.model`
- Renter: `rental.user?.full_name || "Без имени"` (ФИО, NOT phone)
- Status badge: colored pill
- Dates: format `requested_start_date` → `requested_end_date`
- Cost: `rental.total_cost` formatted as ₽
- Docs: count from `rental.passport_mainpage_photo` + `passport_registration_photo` + `drivers_licence_frontal_photo` (+ 2 from metadata) → "3/5 ✅" or "2 missing 🔴"
- Handoff: from `rental.metadata.handoff` → "Передан ✅" or "Ожидает 🔄"
- SLA: compute from `agreed_end_date` → "2д 3ч до возврата" (red if past)

### RentalDetailDrawer.tsx
- Same 10-section pattern as LeadDetailDrawer
- Section 6 (Todos): filter `allTodos` by `rental_id === rental.rental_id` (NOT a flat list)
- Section 7 (Handoff): show odometer before/after from `rental.metadata`, equipment checklist
- Actions: call existing server actions (activateRental, updateRentalStatus)
- Import paths: `../` relative

### AnalyticsMobileSheet.tsx
- Same as MobileLeadSheet: 70vh, useDragControls, safe-area, ARIA
- Import from leads components if possible (reuse pattern)

---

## 6. Migration plan

1. Create all new components in `components/` subdirectory
2. Add feature flag to `page.tsx`: `?ui=v2` → render AnalyticsClient, else render RentalsAnalyticsClient
3. Test new UI with feature flag on
4. Once verified, remove feature flag and delete old RentalsAnalyticsClient

---

## 7. Definition of done

- [ ] Three tabs work (Аренда / Продажа / Сервис)
- [ ] RentalCard shows ФИО (not phone), docs status, handoff badge, SLA
- [ ] RentalDetailDrawer shows this rental's todos only (not flat list)
- [ ] Service tab shows service rentals (vehicle_id IN service catalog)
- [ ] Mobile: slide-up sheet works (70vh, drag handle, no scroll glitch)
- [ ] Desktop: split-pane works
- [ ] All theme tokens used (no hardcoded colors)
- [ ] Import paths use ../ relative
- [ ] No TypeScript errors
