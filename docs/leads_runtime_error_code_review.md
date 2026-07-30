# Leads Page Runtime Error — Code Review

## Error

```
ReferenceError: leadsState is not defined
    at e2 (page-c641b3294d463ae2.js:1:83575)
```

## Root Cause

The leads page (`app/franchize/[slug]/leads/page.tsx`) imports `LeadsClient` from `./components/LeadsClient` — **NOT** from `./LeadsClient`. There are TWO `LeadsClient.tsx` files:

1. `app/franchize/[slug]/leads/LeadsClient.tsx` (431 lines) — old version, still uses `useFilteredSortedLeads`, doesn't import the new hooks. Was the focus of my earlier code review.
2. `app/franchize/[slug]/leads/components/LeadsClient.tsx` (470 lines) — **the actual file used in production**. This is the one that was refactored to use `useLeadFilters` + `useLeadActions`, but the refactor was incomplete.

## Bugs in `components/LeadsClient.tsx` (before fix)

### BUG A (CRITICAL — caused the runtime crash): `leadsState` referenced before declaration

```tsx
// Line 153-180 (BEFORE fix):
const [selectedId, setSelectedId] = useState<string | null>(null);
// ── Filters + derived data (extracted to useLeadFilters hook) ──
const {
  // ...
} = useLeadFilters({
  leadsState,     // ← referenced here
  todosState,     // ← referenced here
  getTodosForLead,  // ← referenced here
  getLeadSignals,   // ← referenced here
});

// ... but leadsState, todosState, getTodosForLead, getLeadSignals
// were NEVER declared above this point!
```

JavaScript's TDZ (Temporal Dead Zone) throws `ReferenceError: leadsState is not defined` when the hook tries to read the prop.

### BUG B (CRITICAL): `useLeadActions` imported but never called

```tsx
// Line 34:
import { useLeadActions } from "../hooks/useLeadActions";

// ...but the hook was NEVER called in the component body.
// All these symbols were referenced in JSX but never declared:
//   - fetchKpis (line 196)
//   - kpis (line 260)
//   - dismissDialogOpen (line 377)
//   - dismissLead (line 378)
//   - handleDismissLeadRequest (line 308, 343, 381, 425, 451)
//   - handleDismissLeadConfirm (line 381)
//   - handleCreateTodo, handleToggleTodo, handleDeleteTodo (line 339-341, 366-368)
//   - handleAddNote (line 342, 369)
//   - handleDrawerAction (line 338, 364)
//   - setDismissDialogOpen (line 383)
//   - DISMISS_REASONS (line 504)
```

### BUG C (HIGH): `selectedLead` referenced but never declared

```tsx
// Line 183-186:
const selectedLeadTodos = useMemo(
  () => (selectedLead ? getTodosForLead(selectedLead) : []),  // ← selectedLead undefined
  [selectedLead, getTodosForLead]
);
// Plus line 330, 333, 343, 351, 353, 405, 431, 432, 433, etc.
```

### BUG D (MEDIUM): `handleSelectLead` referenced but never declared

```tsx
// Line 366, 382, 406, 422:
onSelectLead={handleSelectLead}
```

### BUG E (MEDIUM): `notesState` referenced but never declared

```tsx
// Line 410, 436:
notes={notesState}
```

### BUG F (LOW): `setActiveStageFilter` referenced but not exported by `useLeadFilters`

```tsx
// Line 363 (BEFORE fix):
onStageChange={(v) => setActiveStageFilter(v === "all" ? null : (v as StageKey))}
// useLeadFilters exports `handleStageSelect` (toggle behavior), not `setActiveStageFilter`.
```

### BUG G (LOW): `setDismissLeadId` referenced but not exported by `useLeadActions`

```tsx
// Line 509 (BEFORE fix):
onCancel={() => {
  setDismissDialogOpen(false);
  setDismissLeadId(null);  // ← not exported by the hook
}}
```

## Fix Applied

Inserted the missing state declarations and hook calls in the correct order:

```tsx
// 1. Writable leads/todos state (was missing)
const [leadsState, setLeadsState] = useState<LeadRow[]>(leads);
const [todosState, setTodosState] = useState<LeadTodoRow[]>(todos);

// 2. Sync local state when server props change
useEffect(() => { setLeadsState(leads); }, [leads]);
useEffect(() => { setTodosState(todos); }, [todos]);

// 3. Todo mapping (was missing)
const { getTodosForLead } = useTodosMapping(todosState);

// 4. SLA signals callback (was missing)
const getLeadSignals = useCallback((lead: LeadRow): LeadSignal[] => {
  try { return computeLeadSignals(lead, todosState); } catch { return []; }
}, [todosState]);

// 5. Todo CRUD handler (was missing) — passed to useLeadActions for optimistic updates
const handleTodoUpdate = useCallback(
  (action: "toggle" | "delete" | "add", todoId: string, todo?: LeadTodoRow) => {
    setTodosState((prev) => { /* ... */ });
  },
  []
);

// 6. useLeadFilters call (already existed, now has its props defined)

// 7. selectedLead (was missing) — depends on sortedLeads from useLeadFilters
const selectedLead = useMemo(
  () => (selectedId ? sortedLeads.find((l) => l.user_id === selectedId) ?? null : null),
  [selectedId, sortedLeads]
);

// 8. Notes state (was missing) — for LeadDetailContent drawer
const [notesState, setNotesState] = useState<LeadDetailContentNote[]>([]);
useEffect(() => { setNotesState([]); }, [selectedId]);  // reset on selection change

// 9. handleSelectLead (was missing)
const handleSelectLead = useCallback((lead: LeadRow) => {
  setSelectedId(lead.user_id);
}, []);

// 10. useLeadActions call (was missing) — wires up all async actions
const {
  dismissDialogOpen, setDismissDialogOpen, dismissLead, kpis, fetchKpis,
  handleDismissLeadRequest, handleDismissLeadConfirm,
  handleCreateTodo, handleToggleTodo, handleDeleteTodo,
  handleAddNote: handleAddNoteFromHook,  // renamed to wrap below
  handleDrawerAction, DISMISS_REASONS,
} = useLeadActions({
  slug, crewId, selectedLead, leadsState, dbUser, passwordAuthOwnerId,
  onTodoUpdate: handleTodoUpdate,
  onDismissOptimistic: (leadId) => setLeadsState((prev) => prev.filter((l) => l.user_id !== leadId)),
  onClearSelection: () => setSelectedId(null),
  router,
});

// 11. Wrap handleAddNote to also update notesState immediately
const handleAddNote = useCallback(async (text: string) => {
  const newNote = await handleAddNoteFromHook(text);
  if (newNote) {
    setNotesState((prev) => [{ id, text, created_at, created_by }, ...prev]);
  }
}, [handleAddNoteFromHook]);
```

Also fixed:
- `onStageChange` now uses `handleStageSelect` (toggle) instead of non-existent `setActiveStageFilter`
- `onCancel` of DismissLeadDialog no longer references non-existent `setDismissLeadId`
- Removed unused imports (`dismissLeadWithReason`, `computeLeadStage`, `computeQrStatus`, `isHotLead`, `PIPELINE_STAGES`, `STAGE_LABELS`, `STAGE_COLORS`) — they live in the hooks now
- Added `LeadDetailContentNote` type import (needed for `notesState` typing)

## Verification

- Brace balance check: ✓ balanced (depth 0)
- TypeScript syntax check: ✓ no errors (only module-resolution errors from isolation, no actual syntax errors)
- All referenced symbols now have declarations
- Hook call order respects dependencies: `leadsState` → `todosState` → `getTodosForLead` → `getLeadSignals` → `useLeadFilters` → `selectedLead` → `useLeadActions`

## Lesson

When refactoring a god component into hooks, **always run the app after the refactor** to catch missing wiring. TypeScript would have caught most of these errors at compile time, but the build was apparently succeeding due to loose tsconfig or the errors being suppressed.

The earlier code review (Task ID: analytics-33) focused on the wrong file (`LeadsClient.tsx` at the parent level) and didn't notice that the actual production file is `components/LeadsClient.tsx`. Always verify which file is actually imported by the page entry point.
