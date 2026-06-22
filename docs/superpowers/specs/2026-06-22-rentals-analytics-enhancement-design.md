# Rentals Analytics Enhancement Design

**Date:** 2026-06-22
**Status:** Draft
**Author:** Claude (with user collaboration)

## Overview

Enhance the rentals-analytics page (`/franchize/[slug]/rentals-analytics`) to be a real-time, export-capable, fully-themed franchize operator dashboard optimized for wall-mounted displays.

**Key Features:**
1. Real-time updates for checklists and crew todos (Supabase Realtime)
2. Excel export with date range selection
3. Wall-display optimized layout (compact, single-screen)
4. Franchize theme consistency
5. Profile dropdown link for crew members

---

## 1. Architecture

### Real-time Subscriptions

**Tables to subscribe:**
- `public.crew_todos` — Crew tasks
- `public.checklist_state` — Checklist states (handout/return)

**Required Migration:**
```sql
-- Enable Realtime for rentals-analytics
ALTER PUBLICATION supabase_realtime ADD TABLE public.crew_todos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_state;
```

**Hook: `useSupabaseRealtime`**
- Subscribe to INSERT/UPDATE/DELETE events
- Filter `crew_todos` by `crew_id` (current crew only)
- No filter for `checklist_state` (only 2 rows)
- Update local state directly from event payload
- Auto-reconnect with exponential backoff: 1s → 2s → 4s → 8s → max 30s

### Excel Export

**Hook: `useRentalsExport`**
- Date range picker (start/end dates)
- Default range: 7 days ago to today
- Min/max bounds from existing `getRentalsDateRange()`
- Use `xlsx` library (already installed v0.18.5)
- Auto-download generated file

### Styling

**Theme System:**
- Use existing `crew.theme.palette` variables
- Franchize accent colors, borders, text
- Dark/light mode support (existing)

---

## 2. Real-time Implementation

### Connection Status Indicator

**Visual States:**
| State | Indicator | Meaning |
|-------|-----------|---------|
| Connected | Green dot (pulsing) | Live updates active |
| Reconnecting | Yellow dot | Temporary connection issues |
| Disconnected | Red dot (solid) | Connection lost — refresh page |

**Placement:** Top-right corner of header, always visible, persistent

**No toast notifications** — invisible on wall displays

### Event Handling

**On RECEIVE event:**
```typescript
// INSERT: Add to local state
case 'INSERT':
  setTodos(prev => [...prev, payload.new])

// UPDATE: Update existing item
case 'UPDATE':
  setTodos(prev => prev.map(item =>
    item.id === payload.old.id ? payload.new : item
  ))

// DELETE: Remove from local state
case 'DELETE':
  setTodos(prev => prev.filter(item => item.id !== payload.old.id))
```

**Re-fetch only as fallback:**
- Event payload incomplete
- Error processing payload

### Error Handling

- **Connection timeout** → Yellow dot, keep retrying
- **Auth failure** → Red dot, tooltip "Refresh required"
- **Network offline** → Red dot, listen for `online` event
- **3+ consecutive failures** → Red dot, stop retrying

---

## 3. Excel Export

### UI Flow

1. Button on page header: "Экспорт в Excel" (Download icon)
2. Opens modal with date range picker
3. User selects start/end dates
4. "Export" button generates and downloads file

### Data Structure

**Columns:**
| Column | Description |
|--------|-------------|
| Время | Created timestamp (Russian format) |
| Клиент | User full name/username |
| Техника | Vehicle make + model |
| Сумма | Total cost (RUB format) |
| Статус | Rental status |
| Документы | Summary: "QR + Verified", "Pending", or "None" |

**Implementation:**
```typescript
import * as XLSX from 'xlsx';

const worksheet = XLSX.utils.json_to_sheet(formattedData);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "Аренды");
XLSX.writeFile(workbook, `rentals-${dateRange}.xlsx`);
```

### Formatting

- Bold header with franchize accent background
- Currency formatted as ₽
- Status text (no color coding in Excel)
- Alternating row colors for readability

### Error Handling

- **No data in range** → Toast "Нет данных за выбранный период"
- **Date invalid** → Toast "Некорректная дата"
- **XLSX generation fails** → Toast "Ошибка создания файла"

---

## 4. Styling & Wall Display Optimization

### Typography (Dense)

- Base font: `text-xs` (12px) everywhere
- Headers: `text-sm` (14px)
- Line-height: `leading-tight`
- Stats cards: compact number display

### Layout Density

- Padding: `p-2` instead of `p-4`
- Gaps: `gap-1.5` or `gap-2` instead of `gap-4`
- Checklist items: single-row with smaller checkbox
- Todo cards: minimal whitespace

### Single-Screen Dashboard Layout (PC)

```
┌────────────────────────────────────────────────────────────┐
│ Header + Date Picker + Export + Connection Status        │
├────────────────────────────────────────────────────────────┤
│ [Summary Stats: 4 cards in one row]                       │
├──────────────┬─────────────────────────────────────────────┤
│ Checklist    │ Todos List (scrollable if > ~8 items)       │
│ Handout      │                                             │
│ Return       │                                             │
├──────────────┴─────────────────────────────────────────────┤
│ Rentals List (scrollable, max ~300px height)               │
└────────────────────────────────────────────────────────────┘
```

### Mobile Responsiveness

- Everything stacks vertically
- Extra small fonts: `text-[11px]` where needed
- Horizontal date picker scroll (no wrapping)
- Checklist: 2-column grid on mobile, side-by-side on larger

### Visual Enhancements

- Smooth hover transitions (0.2s ease)
- Subtle card lift effect on hover
- Fade-in animation for new todos/checklist changes
- Pulsing dot for real-time indicator

### Theme Consistency

- All colors use `crew.theme.palette.*` or CSS vars
- Borders use `borderSoft`
- Text uses `textPrimary` / `textSecondary`
- Background uses `bgBase` / `bgCard`

---

## 5. Profile Dropdown Link

### Access Control

**Logic:**
```typescript
const showRentalsAnalytics = userCrewInfo?.slug === currentSlug;
```

- Use existing `userCrewInfo` from `AppContext`
- Compare crew slug with current page slug
- If match → user is crew member → show link
- **No extra Supabase queries**

### Placement

**In `FranchizeProfileButton` dropdown:**
```
...
Дашборд франшизы
Аналитика аренд  ← NEW (between Dashboard and Profile)
Профиль франшизы
...
```

### Implementation

```typescript
{userCrewInfo?.slug === currentSlug && (
  <DropdownMenuItem asChild>
    <Link href={`/franchize/${currentSlug}/rentals-analytics`} className="...">
      Аналитика аренд
    </Link>
  </DropdownMenuItem>
)}
```

---

## 6. Checklist & Todo Conflict Prevention

**Real-time prevents conflicts:**
- Multiple crew members see updates instantly
- No stale data races
- Last-write-wins for simultaneous edits
- Local state updates from realtime payload

**Optimistic updates:**
- Toggle checklist item → update UI immediately
- Server confirms via realtime
- On error → revert UI, re-fetch

---

## 7. Testing Approach

**Unit Tests (Minimal):**
- `formatRussianDate` — Russian output, UTC+3 handling
- `formatRussianDateOnly` — no time component
- Date picker navigation — correct day boundaries

**Manual Testing:**
- Real-time: Two browsers, toggle checklist, verify sync
- Export: Generate file, verify content
- Wall display: View on monitor, verify single-screen fit

**Skip:**
- Real-time mocked tests (too complex)
- XLSX library tests (trust library)
- Full E2E (manual smoke test sufficient)

---

## 8. Implementation Files

### New Files

- `app/franchize/hooks/useSupabaseRealtime.ts` — Real-time subscription hook
- `supabase/migrations/20260622000000_rentals_analytics_realtime.sql` — Enable Realtime

### Modified Files

- `app/franchize/[slug]/rentals-analytics/RentalsAnalyticsClient.tsx`
  - Integrate `useSupabaseRealtime`
  - Add export functionality
  - Update styling for wall display
  - Add connection status indicator
  - Remove 30s polling for checklists/todos (keep for rentals)

- `app/franchize/components/FranchizeProfileButton.tsx`
  - Add rentals-analytics dropdown link for crew members

---

## 9. Migration Details

**File:** `supabase/migrations/20260622000000_rentals_analytics_realtime.sql`

```sql
-- Enable Realtime for rentals-analytics real-time updates
-- Allows crew members to see checklist and todo changes instantly

ALTER PUBLICATION supabase_realtime ADD TABLE public.crew_todos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_state;
```

**Note:** Both tables already have RLS policies allowing public access for dashboard simplicity.

---

## 10. Success Criteria

- [ ] Real-time updates work for checklists and todos
- [ ] Connection status indicator shows correct state (green/yellow/red)
- [ ] Excel export generates file with correct data and formatting
- [ ] Page fits on single screen without scrolling (1920x1080)
- [ ] All colors and styling use franchize theme
- [ ] Profile dropdown link appears for crew members only
- [ ] Date formatting handles UTC+3 correctly
- [ ] Mobile layout stacks and remains readable

---

## Appendix: Database Schema References

### `public.crew_todos`
- `id` TEXT PRIMARY KEY
- `crew_id` TEXT NOT NULL
- `assigned_to` TEXT (users.user_id)
- `title` TEXT NOT NULL
- `status` TEXT ('pending', 'in_progress', 'done')
- `priority` TEXT ('low', 'medium', 'high')
- `category` TEXT
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

### `public.checklist_state`
- `type` TEXT PRIMARY KEY ('handout' or 'return')
- `items` JSONB (Array of {id, text, checked})
- `updated_at` TIMESTAMPTZ

### `public.crew_members`
- `crew_id` UUID
- `user_id` TEXT
- `role` TEXT ('member', 'co_owner', 'mechanic')
- `membership_status` TEXT
