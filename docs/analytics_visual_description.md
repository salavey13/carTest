# Analytics Page Redesign — Visual Description

Source: Adapted from `design_closups_prd.md` (leads) + `analytics_redesign_PRD.md` + production data.
Last updated: 2026-07-23

This document describes the target visual design for the redesigned analytics page. It is the visual reference for the PRD (`analytics_redesign_PRD.md`) and the implementation spec (`analytics_implementation_SPEC.md`).

---

## 1. Overall layout

The page uses a **tabbed single-column layout** on mobile, expanding to a **split-pane** on desktop (lg+).

```
┌─────────────────────────────────────────────────────────────────┐
│  Top nav (CrewHeader — existing)                                 │
├─────────────────────────────────────────────────────────────────┤
│  Tab bar: Аренда (active) | Продажа | Сервис                     │
├─────────────────────────────────────────────────────────────────┤
│  Date navigator: ← 21 июля 2026 →  |  Сегодня                     │
├─────────────────────────────────────────────────────────────────┤
│  KPI row: Аренд сегодня | Выручка | Активных | Возвратов         │
├─────────────────────────────────────────────────────────────────┤
│  Search + filters (source, status, assignee)                     │
├──────────────────────────────────┬──────────────────────────────┤
│                                  │                              │
│  Rental card list (scrollable)   │  Detail panel (selected)     │
│                                  │                              │
│  ┌────────────────────────────┐  │  ┌────────────────────────┐  │
│  │ 🏍 Ducati Panigale S       │  │  │ Ducati Panigale S      │  │
│  │ Рудометов Михаил Сергеевич │  │  │ Рудометов М.С.         │  │
│  │ 🟢 Активна  20.07→21.07    │  │  │ 🟢 Активна              │  │
│  │ 35 000 ₽  3/5 ✅  Передан  │  │  │ 35 000 ₽               │  │
│  │ SLA: 2д 3ч до возврата     │  │  ├────────────────────────┤  │
│  └────────────────────────────┘  │  │ 📞 ✈️ 🔔 ⋯             │  │
│  ┌────────────────────────────┐  │  ├────────────────────────┤  │
│  │ 🏍 Falcon Lynx Purple      │  │  │ SLA: 🟡2д 🔴1 ⚠️0     │  │
│  │ Test Test Test             │  │  ├────────────────────────┤  │
│  │ 🟡 Ожидает  21.07→22.07    │  │  │ Info grid (2-col)      │  │
│  │ 8 500 ₽  2/5 🔴  Ожидает   │  │  ├────────────────────────┤  │
│  └────────────────────────────┘  │  │ ▸ Документы 3/5 ✅     │  │
│  ...                             │  │ ▸ Задачи (7)  1 просроч │  │
│                                  │  │ ▸ Handoff ✅            │  │
│                                  │  │ ▸ Заметки (1)           │  │
│                                  │  │ ▸ История               │  │
│                                  │  ├────────────────────────┤  │
│                                  │  │ Открыть аренду →        │  │
│                                  │  └────────────────────────┘  │
├──────────────────────────────────┴──────────────────────────────┤
│  (no bottom nav — postponed)                                     │
└─────────────────────────────────────────────────────────────────┘
```

**Visual theme:** Same as leads page — dark glass-panel aesthetic with crew theme tokens (T.*).

---

## 2. Tab bar (Аренда / Продажа / Сервис)

Three segmented tabs with underline indicator. Active tab uses T.accent.

| Tab | Russian | Active when | Data source |
|---|---|---|---|
| `rentals` | Аренда | Default — rental contracts | `rentals` table where vehicle_id NOT IN service items |
| `sales` | Продажа | Sale contracts | `sale_contract_artifacts` (private schema) |
| `services` | Сервис | Service work orders | `rentals` where vehicle_id IN (cars.type='service') |

---

## 3. Date navigator

Horizontal bar with:
- **←** (previous day)
- **21 июля 2026, среда** (current date, tappable to open date picker)
- **→** (next day)
- **Сегодня** button (jump to today)

---

## 4. KPI row (4 cards)

Same glass-panel style as leads KPI cards. Large numbers, small labels.

| Card | Label | Value | Source |
|---|---|---|---|
| 1 | Аренд сегодня | 5 | Count of rentals for the selected date (created OR period overlapping) |
| 2 | Выручка | 85 000 ₽ | Sum of total_cost for active+completed rentals on this date |
| 3 | Активных | 22 | Count of rentals with status=active |
| 4 | Возвратов | 3 | Count of rentals where agreed_end_date = today AND status=active |

---

## 5. RentalCard

Each card is a horizontal rectangle with a 3px colored left edge.

### Card anatomy:
- **Left edge stripe**: status color (green=active, gray=completed, red=cancelled, yellow=pending)
- **Bike title**: make + model (bold, 14px mobile / 16px desktop)
- **Renter ФИО**: full_name (NOT phone — secondary, shown in detail only)
- **Status badge**: colored pill (right-aligned)
- **Date range**: "20.07 → 21.07" (formatted, muted text)
- **Total cost**: "35 000 ₽" (bold)
- **Document status**: "3/5 ✅" (green) or "2 missing 🔴" (red)
- **Handoff badge**: "Передан ✅" (green) or "Ожидает 🔄" (yellow)
- **SLA countdown**: "2д 3ч до возврата" (orange if <24h, red if past)
- **Tap**: opens detail panel

### Mobile sizing:
- Padding: 12px (p-3)
- Avatar: 40px (not shown — bike icon instead)
- Font: 14px name, 11px metadata
- Card gap: 8px

---

## 6. SaleCard

Simpler than RentalCard:
- **Bike title**
- **Buyer ФИО** (full_name, not phone)
- **Price**: "420 000 ₽" (bold)
- **Contract status badge**: "Договор отправлен" / "Подписан" / "Передан"
- **Created date**
- **Tap**: opens SaleDetailDrawer

---

## 7. ServiceCard

- **Service type**: "Замена масла" (from cars.make + model)
- **Client ФИО**
- **Status badge**: same as rental
- **Cost**: "2 000 ₽"
- **Assigned mechanic**: "Артур Б." (from rental.user_id → users.full_name)
- **Date**
- **Tap**: opens ServiceDetailDrawer

---

## 8. RentalDetailDrawer

Same pattern as LeadDetailDrawer — 10 sections in order:

1. **Header**: bike title, renter ФИО, status badge, close button
2. **Primary actions**: Activate (green) / Complete (blue) / Cancel (red) / Open rental page
3. **SLA overview**: 4 indicators (days active, overdue todos, until return, document status)
4. **Info grid**: bike, renter, phone, status, payment, start, end, cost, deposit, operator, crew
5. **Documents**: 5-item checklist with verify/request actions
6. **Todos**: ONLY this rental's todos, with All/Mine/Overdue sub-filters
7. **Handoff**: odometer before/after, equipment checklist, damage inspection
8. **Notes**: notes for this rental
9. **History**: timeline of events
10. **Sticky footer**: "Открыть аренду →" link

### Mobile: slide-up sheet (70vh), drag handle, safe-area padding
### Desktop: right panel (max-w-640px), slide from right

---

## 9. Color coding (same as leads)

| Color | Hex | Used for |
|---|---|---|
| Green | #22c55e | Active, completed, verified, good SLA |
| Yellow | #eab308 | Pending, caution SLA, QR not accepted |
| Orange | #f59e0b | Warning SLA, return due soon |
| Red | #ef4444 | Cancelled, overdue, missing docs, critical SLA |
| Blue | #3b82f6 | Info, communication |
| Gray | #64748b | Cancelled, inactive, neutral |

---

## 10. Mobile-specific notes

- Tab bar: full-width, 44px touch targets
- Date navigator: compact, 44px arrows
- KPI: 2×2 grid on mobile (not 1×4)
- Rental cards: full-width, compact
- Detail: slide-up sheet (70vh), drag handle, safe-area
- Info grid: 1 column on mobile
- Action buttons: 2×2 grid on mobile
- No bottom nav (postponed)

---

## 11. Desktop-specific notes

- Tab bar: centered, max-w-1600px
- KPI: 1×4 horizontal
- Split-pane: list left (5/12), detail right (7/12)
- Info grid: 2 columns
- Action buttons: 4×1 row
- Detail panel: right side, max-w-640px, slide from right
