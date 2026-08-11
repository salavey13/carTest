# CARTEST CODE REVIEW — Leads & Rentals (Max Effort)
**Date:** 2026-08-11
**Scope:** `app/franchize/[slug]/leads/*`, `app/franchize/server-actions/leads.ts`, `app/franchize/server-actions/rentals.ts`, `app/webhook-handlers/commands/doc-manual.ts`
**Focus:** Accessories/todos duplication, leads page kanban stages, rentals page missing todos display

---

## Executive Summary

**3 Critical Issues Found:**
1. 🔴 **ACCESSORIES DUPLICATION**: Two parallel systems creating overlapping todos (metadata JSONB vs crew_todos table)
2. 🟡 **RENTALS PAGE INCOMPLETE**: Missing accessory + basic todos display on `/franchize/{slug}/rentals`
3. 🟢 **LEADS PAGE CORRECT**: Properly uses crew_todos via getTodosForLead(), not checking todos directly

**Recommendation:** Remove synthetic todo generation from rentals.ts, keep only crew_todos table approach.

---

## 1. Critical: Accessories/Todos Duplication

### Issue Description

Accessories are tracked in **TWO places**, creating potential duplicates:

**System A: `crew_todos` table (CANONICAL)**
- Location: `doc-manual.ts:2242-2259`
- Created by: `createLeadFollowupTodos()` when `/doc` generates rental contract
- Examples:
  ```typescript
  if ((context.helmets || 0) > 0) todos.push({ title: `🪖 Принять ${context.helmets} шлем(а/ов)`, priority: "medium" });
  if ((context.gloves || 0) > 0) todos.push({ title: `🧤 Принять ${context.gloves} перчатки`, priority: "low" });
  ```
- Stored in: `public.crew_todos` with `category='lead_followup'` and `rental_id` FK

**System B: `rentals.metadata` JSONB + synthetic generation (REDUNDANT)**
- Location 1: `doc-manual.ts:1521-1530` — equipment stored in `rentals.metadata.equipment`
- Location 2: `rentals.ts:717-743` — `getRentalReturnTodos()` reads metadata and generates "synthetic" todos
- Fragile duplicate prevention: `existingTitles` check (line 733)

### The Bug

When a rental has equipment AND explicit crew_todos exist:
- **Result:** Duplicate todo items in UI
- **Example:** "🪖 Принять 2 шлем(а/ов)" appears twice

### Evidence

**`doc-manual.ts:1519-1530`** — Equipment saved to metadata:
```typescript
metadata: {
  // ...
  equipment: {
    helmets: context.helmets || 0,
    gloves: context.gloves || 0,
    jacket: context.jacket || false,
    boots: context.boots || false,
    net: context.net || false,
    backpack: context.backpack || false,
    bag: context.bag || false,
    charger: context.charger || false,
  },
}
```

**`rentals.ts:717-743`** — Synthetic todo generation:
```typescript
// Generate synthetic todos for equipment found in metadata
const eq = meta.equipment || meta.handoff_equipment || {};
const existingTitles = rentalTodos.map(t => t.title.toLowerCase());

const accessoryItems: Array<{ title: string; priority: "low" | "medium" }> = [];
if (eq.helmets && Number(eq.helmets) > 0) {
  accessoryItems.push({ title: `🪖 Принять ${eq.helmets} шлем(а/ов)`, priority: "medium" });
}
// ... gloves, jacket, boots, net, backpack, bag, charger

// Add items that don't already exist in the DB todos
for (const item of accessoryItems) {
  if (!existingTitles.some(t => t.includes(item.title.toLowerCase().replace(/^[^\s]+\s/, "")))) {
    rentalTodos.push({
      id: `synthetic-${item.title}`,  // synthetic ID (not in DB)
      title: item.title,
      status: "pending",
      priority: item.priority,
      category: "lead_followup",
    } as any);
  }
}
```

### Why crew_todos is Superior

| Aspect | crew_todos | metadata + synthetic |
|--------|-------------|---------------------|
| Queryable | ✅ Indexed FK | ❌ JSONB scanning |
| Updatable | ✅ Direct UPDATE | ❌ Requires rental UPDATE |
| Status tracking | ✅ Per-todo | ❌ Requires JSONB mutation |
| Assignment | ✅ assigned_to column | ❌ Not supported |
| RLS | ✅ Crew-scoped policies | ❌ Requires rental access |
| History | ✅ created_at, completed_at | ❌ No audit trail |

### Fix Required

**File:** `app/franchize/server-actions/rentals.ts`
**Lines:** 697-743
**Action:** DELETE the entire synthetic generation block

```diff
-    // ── I4 enhancement: also read rental metadata for equipment info ──
-    // If the rental has equipment (helmets, gloves, etc.) in its contract
-    // metadata but no corresponding accessory todos in crew_todos (e.g. rental
-    // was created before the todo-creation fix, or accessories were added
-    // after rental creation), generate them on-the-fly.
-    const { data: rental } = await supabaseAdmin
-      .from("rentals")
-      .select("metadata, vehicle_id, vehicles:cars(make, model)")
-      .eq("rental_id", rentalId)
-      .maybeSingle();
-
-    if (rental?.metadata) {
-      const meta = rental.metadata as Record<string, any>;
-      // Equipment can be in metadata.equipment (from contract vars) or
-      // metadata.handoff_equipment (from rental_handoffs)
-      const eq = meta.equipment || meta.handoff_equipment || {};
-      const existingTitles = rentalTodos.map(t => t.title.toLowerCase());
-      const vehicle = rental.vehicles as any;
-      const bikeName = vehicle ? `${vehicle.make} ${vehicle.model}` : "байк";
-
-      const accessoryItems: Array<{ title: string; priority: "low" | "medium" }> = [];
-      if (eq.helmets && Number(eq.helmets) > 0) {
-        accessoryItems.push({ title: `🪖 Принять ${eq.helmets} шлем(а/ов)`, priority: "medium" });
-      }
-      if (eq.gloves && Number(eq.gloves) > 0) {
-        accessoryItems.push({ title: `🧤 Принять ${eq.gloves} перчатки`, priority: "low" });
-      }
-      if (eq.jacket) accessoryItems.push({ title: `🧥 Принять куртку`, priority: "low" });
-      if (eq.boots) accessoryItems.push({ title: `👢 Принять боты`, priority: "low" });
-      if (eq.net) accessoryItems.push({ title: `🌐 Принять сетку`, priority: "low" });
-      if (eq.backpack) accessoryItems.push({ title: `👜 Принять рюкзак`, priority: "low" });
-      if (eq.bag) accessoryItems.push({ title: `👜 Принять сумку`, priority: "low" });
-      if (eq.charger) accessoryItems.push({ title: `🔌 Принять зарядное устройство`, priority: "medium" });
-
-      // Add items that don't already exist in the DB todos
-      for (const item of accessoryItems) {
-        if (!existingTitles.some(t => t.includes(item.title.toLowerCase().replace(/^[^\s]+\s/, "")))) {
-          rentalTodos.push({
-            id: `synthetic-${item.title}`,  // synthetic ID (not in DB)
-            title: item.title,
-            status: "pending",
-            priority: item.priority,
-            category: "lead_followup",
-          } as any);
-        }
-      }
-    }
```

**Note:** `rentals.metadata.equipment` can stay for analytics/reference, but should NOT drive todo generation.

---

## 2. Rentals Page Missing Todos Display

### Current State

**File:** `app/franchize/[slug]/rentals/page.tsx`
**Component:** `RentalsListClient`
**Data Source:** `getFranchizeCrewRentalsListAction()`

**What's Returned:**
```typescript
{
  rentalId: string,
  status: string,
  paymentStatus: string,
  isTestRide: boolean,
  vehicleId: string,
  vehicleLabel: string,
  vehicleImage: string | null,
  agreedStartDate: string | null,
  agreedEndDate: string | null,
  docLink: string
}
```

**What's Missing:**
- ❌ Accessory todos (helmets, gloves, etc.)
- ❌ Basic return todos (vehicle inspection, key return, etc.)
- ❌ Pending todo count
- ❌ Todo status indicators

### Required Enhancement

**File:** `app/franchize/profile-actions.ts`
**Function:** `getFranchizeCrewRentalsListAction()`
**Location:** Lines 362-459

**Add todos to the response:**
```typescript
export type FranchizeActivityDigest = {
  rentals: Array<{ 
    rentalId: string; 
    status: string; 
    paymentStatus: string; 
    isTestRide: boolean; 
    vehicleId: string; 
    vehicleLabel: string; 
    vehicleImage: string | null; 
    agreedStartDate: string | null; 
    agreedEndDate: string | null; 
    docLink: string;
    // NEW:
    pendingTodos: number;
    accessories: Array<{ title: string; priority: string }>;
  }>;
  buyOrders: Array<{ ... }>;
};
```

**Implementation:**
1. After fetching rentals (line 423), fetch todos for each rental:
   ```typescript
   const rentalIds = (rentals || []).map(r => r.rental_id);
   const { data: todos } = await supabaseAdmin
     .from("crew_todos")
     .select("rental_id, title, status, priority, category")
     .eq("crew_id", crew.id)
     .in("rental_id", rentalIds)
     .in("category", ["lead_followup", "rental_closure"]);
   ```

2. Group todos by rental_id and count pending:
   ```typescript
   const todosByRental = new Map<string, Array<{title, status, priority}>>();
   for (const t of todos || []) {
     if (!todosByRental.has(t.rental_id)) todosByRental.set(t.rental_id, []);
     if (t.status !== "done") todosByRental.get(t.rental_id)!.push(t);
   }
   ```

3. Add to result mapping:
   ```typescript
   const rentalTodos = todosByRental.get(r.rental_id) || [];
   const pendingTodos = rentalTodos.filter(t => t.status !== "done").length;
   const accessories = rentalTodos.filter(t => 
     t.title.includes("шлем") || t.title.includes("перчатки") || 
     t.title.includes("куртку") || t.title.includes("боты")
   );
   ```

---

## 3. Leads Page — Correct Implementation ✅

### Verification

**File:** `app/franchize/[slug]/leads/LeadsClient.tsx`
**Data Source:** `getFranchizeLeads()`

**Correct Behavior:**
1. Fetches todos via `crew_todos` query (line 890-893 in leads.ts)
2. Filters by `category IN (lead_followup, rental_verification)`
3. Maps todos to leads via `getTodosForLead()` (leads-utils.ts:128-159)
4. **Does NOT check todos directly** — only displays counts/status

**Kanban Stages** (from `leads-constants.ts:28-38`):
```typescript
export const STAGE_LABELS: Record<string, string> = {
  contract_generated: "Договор готов",
  checkout_started:   "Оформление",
  checkout_completed: "Оплачен",
  dismissed:          "Отклонён",
  interest_paid:      "Интерес",
  new:                "Новый",
  contacted:          "Контакт установлен",
  viewed:             "Просмотр",
  configured:         "Настроил",
};
```

**Board Columns** (from `leads-constants.ts:61-67`):
```typescript
export const BOARD_COLUMNS: { key: string; label: string; color: string }[] = [
  { key: "new",                label: "Новые",           color: "#64748b" },
  { key: "contacted",          label: "В работе",        color: "#3b82f6" },
  { key: "configured",         label: "Настроил",        color: "#8b5cf6" },
  { key: "contract_generated", label: "Договор",         color: "#f59e0b" },
  { key: "completed",          label: "Завершено",       color: "#10b981" },
];
```

**Stage Flow:**
```
new → contacted → configured → contract_generated → completed
```

**No changes needed** — leads page is correctly implemented.

---

## Summary of Required Changes

| Priority | File | Lines | Change |
|----------|------|-------|--------|
| 🔴 HIGH | `rentals.ts` | 697-743 | DELETE synthetic todo generation |
| 🟡 MEDIUM | `profile-actions.ts` | 362-459 | ADD todos to rentals response |
| 🟢 LOW | `rentals.ts` | 1519-1530 | KEEP metadata.equipment for analytics |

**Estimated Effort:** 30 minutes (1 file deletion, 1 file enhancement)

---

## Testing Checklist

After fixes:
- [ ] Create rental with 2 helmets via `/doc`
- [ ] Verify exactly 1 "🪖 Принять 2 шлем(а/ов)" todo in crew_todos
- [ ] Verify NO duplicate in UI
- [ ] Verify rentals page shows pending todo count
- [ ] Verify rentals page shows accessory todos
