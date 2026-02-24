# T49 — Software-engineering hardening sweep (security/SPA/state/CSS/cart-write load)

**Status:** `in_progress`
**Updated_at:** `2026-02-23T17:30:00Z`
**Owner:** `codex`
**Dependencies:** T48
**Parent Plan:** [THE_FRANCHEEZEPLAN.md](./THE_FRANCHEEZEPLAN.md)

---

## Summary

Continued hardening pass with anti-workaround fixes plus style-system discipline. This document captures all **successfully implemented fixes** ready to be reapplied in the main repository.

---

## Completed Fixes (Ready for Reapplication)

### 0. Links fix

### T49 — Software-engineering hardening sweep (security/SPA/state/CSS/cart-write load)
- status: `in_progress`
- updated_at: `2026-02-23T17:30:00Z`
- owner: `codex`
- notes: Continued hardening pass with anti-workaround fixes plus style-system discipline. Detailed implementation instructions extracted to separate doc for easy reapplication across repos.
- next_step: Finish remaining T49 substeps — broader franchize style-system variable migration and AppContext decomposition/realtime strategy audit, then run full regression smoke.
- risks: Cart persistence is now safer for DB load but depends on explicit checkpoints (`/cart`, `/order/*`, pagehide); must verify no data loss in abrupt mobile-session kills.
- dependencies: T48
- deliverables:
  - `docs/T49-security_sweep.md` (detailed implementation guide)
  - `src/lib/supabase-server.ts` (new server-only module)
  - `src/hooks/supabase.ts` (modified to use server module)
  - `src/components/franchize/CrewHeader.tsx` (smooth header transition)
- implementation checklist:
  1. **Header transition smoothing:** replace jittery `maxHeight` with smooth `transform: scaleY() translateY()` animation - see T49 doc section 1.
  2. **Server-only Supabase admin:** create `src/lib/supabase-server.ts` with `server-only` package, update imports in `supabase.ts` - see T49 doc section 2.
  3. **SPA recovery (TODO):** remove full-reload navigation fallbacks and restore deterministic Next.js `Link`/router transitions.
  4. **Cart DB load guard (TODO):** stop high-frequency JSONB writes on every cart micro-change.
  5. **Style-system cleanup (TODO):** move palette delivery to CSS variables usable via Tailwind utilities.
  6. **Context split plan (TODO):** decompose oversized `AppContext` into smaller logical providers.
- acceptance criteria:
  - [x] Header transition is smooth (no jitter)
  - [x] No client-side bundle path can access admin/service-role Supabase credentials
  - [ ] Internal franchize navigation uses SPA transitions (no forced full reload)
  - [ ] Cart persistence no longer performs frequent metadata writes per tiny quantity edit
  - [ ] Interaction-state styles remain visible after theme application
  - [ ] Context updates avoid full-app rerenders for unrelated state
  - [ ] First paint does not flash incorrect light theme before dark theme sync
  - [ ] AI JSON tooling reports precise validation errors without crashing

**Detailed implementation guide:** `docs/T49-security_sweep.md`
```

---

## Summary of Completed Fixes

### ✅ Header Transition Smoothing
- Changed from jittery `maxHeight` transition to smooth `transform: scaleY(0.85) translateY(-8px)`
- Added `transformOrigin: 'top center'` for proper upward collapse
- Used `cubic-bezier(0.4, 0, 0.2, 1)` easing for natural animation
- Set `pointerEvents: 'none'` when compact

### ✅ SUPABASE_SERVICE_ROLE_KEY Server-Only Pattern
- Installed `server-only` package
- Created `src/lib/supabase-server.ts` as dedicated server-only module
- Updated `src/hooks/supabase.ts` to import from server module
- Added `getServiceRoleKey()` for Edge Function authorization
- Build-time protection against client imports

Both fixes are documented in `/home/z/my-project/docs/T49-security_sweep.md` with detailed code samples for reapplication in your repo.



Let me check the dropdown menu component more carefully - the issue might be with how Radix UI handles portals:
I see the issue. The DropdownMenuItem has `cursor-default` and no explicit `pointer-events-auto`. Also, Radix Portal might need a container reference. Let me fix this:
All fixes have been applied. Here's the summary of the **profile dropdown fix**:

## ✅ Profile Dropdown Fix

### Root Cause
The header creates a stacking context with `position: sticky` and `z-index: 50`. The dropdown was inside this stacking context, so even with `z-index: 80`, it was being affected by the parent's stacking context.

### Key Fix: `isolation: isolate`

```tsx
// Wrapping the dropdown in a container with isolation
<div style={{ 
  isolation: 'isolate',  // Creates NEW stacking context
  pointerEvents: 'auto', // Ensures clicks work
}}>
  <DropdownMenu>...</DropdownMenu>
</div>
```

### Other Fixes Applied:

1. **DropdownMenuContent** (`dropdown-menu.tsx`):
   - Added `pointer-events-auto` to the class
   - Already had `z-[80]`

2. **DropdownMenuItem** (`dropdown-menu.tsx`):
   - Changed `cursor-default` → `cursor-pointer`
   - Added `pointer-events-auto`

3. **FranchizeProfileButton**:
   - Wrapped dropdown in `<div style={{ isolation: 'isolate' }}>`
   - Removed `relative z-10` from trigger (was causing stacking issues)
   - Added explicit `pointerEvents: 'auto'`

4. **CrewHeader**:
   - Moved `backdrop-blur` to a pseudo-element with `z-index: -1`
   - Added `pointerEvents: 'auto'` to all interactive elements
   - Removed `overflow: hidden` from the grid container

### How `isolation: isolate` Works

```
Without isolation:
  header (z-50, stacking context)
    └── dropdown (z-80, but limited to header's context)
        └── Can't escape header's z-index scope

With isolation:
  header (z-50)
    └── dropdown container (isolation: isolate, NEW stacking context)
        └── dropdown content (z-80, works independently!)
```


### 1. Header Transition Smoothing ✅

**Problem:** Header transition from "only section balloon sticky bar" visible to "ALL visible" jittered during collapse/expand.

**File:** `app/franchize/components/CrewHeader.tsx`

**Before (jittery):**
```tsx
<div
  style={{
    display: 'grid',
    gridTemplateColumns: '44px 1fr auto',
    alignItems: 'center',
    gap: '0.75rem',
    maxHeight: isCompact ? 0 : '8rem',
    opacity: isCompact ? 0 : 1,
    paddingBottom: isCompact ? 0 : '0.5rem',
    transition: 'all 0.3s',
    pointerEvents: 'auto',
  }}
>
```

**After (smooth):**
```tsx
<div
  style={{
    display: 'grid',
    gridTemplateColumns: '44px 1fr auto',
    alignItems: 'center',
    gap: '0.75rem',
    opacity: isCompact ? 0 : 1,
    paddingBottom: isCompact ? 0 : '0.5rem',
    transform: isCompact ? 'scaleY(0.85) translateY(-8px)' : 'scaleY(1) translateY(0)',
    transformOrigin: 'top center',
    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, padding 0.3s ease',
    pointerEvents: isCompact ? 'none' : 'auto',
  }}
>
```

**Why this works:**
- `transform: scaleY()` animates smoothly without layout recalculations
- `transformOrigin: 'top center'` ensures content collapses upward
- `cubic-bezier(0.4, 0, 0.2, 1)` provides natural easing
- `pointerEvents: 'none'` when compact prevents interaction with hidden content
- No `overflow: hidden` needed (was interfering with dropdown menus)

---

### 2. SUPABASE_SERVICE_ROLE_KEY Server-Only Access Pattern ✅

**Problem:** The service role key was potentially accessible from client-side code, creating a security boundary violation.

**Solution Architecture:**
```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Bundle                                │
│  (can NEVER access SUPABASE_SERVICE_ROLE_KEY)                   │
│                                                                  │
│  └── imports supabaseAnon (public, RLS-protected)              │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                     Server-Only Code                             │
│  (API routes, Server Actions, Server Components)                │
│                                                                  │
│  └── imports from @/lib/supabase-server.ts                      │
│       └── 'server-only' package throws build error              │
│           if accidentally imported by client code               │
│       └── supabaseAdmin (bypasses RLS)                          │
│       └── getServiceRoleKey() (for Edge Functions)              │
└─────────────────────────────────────────────────────────────────┘
```

#### Step 1: Install `server-only` Package

```bash
bun add server-only
```

#### Step 2: Create Server-Only Admin Module

**File:** `src/lib/supabase-server.ts` (NEW FILE)

```typescript
/**
 * Server-only Supabase Admin Client
 * 
 * This file MUST only be imported by server-side code:
 * - Server Components
 * - API Routes (Route Handlers)
 * - Server Actions
 * 
 * Importing this in client components will cause a build error.
 */
import 'server-only';

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://inmctohsodgdohamhzag.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Validates that the service role key is available.
 * Call this at the start of any server operation that needs admin access.
 */
export function validateServiceRoleKey(): { valid: boolean; error?: string } {
  if (!serviceRoleKey) {
    const error = "SUPABASE_SERVICE_ROLE_KEY is missing. Set this environment variable for admin operations.";
    logger.error(error);
    return { valid: false, error };
  }
  return { valid: true };
}

/**
 * Supabase Admin Client (Service Role)
 * 
 * This client bypasses Row Level Security (RLS) and should only be used
 * for server-side operations that require elevated privileges.
 * 
 * @throws Error if SUPABASE_SERVICE_ROLE_KEY is not set
 */
export const supabaseAdmin: SupabaseClient<Database> = (() => {
  if (!serviceRoleKey) {
    // During build/development, return a placeholder that throws clear errors
    logger.warn("SUPABASE_SERVICE_ROLE_KEY not found. Admin operations will fail until this is configured.");
    
    // Return a proxy that throws meaningful errors
    return new Proxy({} as SupabaseClient<Database>, {
      get(target, prop) {
        if (prop === 'from') {
          return () => {
            throw new Error(
              "supabaseAdmin cannot be used: SUPABASE_SERVICE_ROLE_KEY is missing.\n" +
              "Please add SUPABASE_SERVICE_ROLE_KEY to your environment variables.\n" +
              "See: https://supabase.com/dashboard/project/_/settings/api"
            );
          };
        }
        if (typeof prop === 'string' && ['auth', 'storage', 'rpc', 'functions', 'realtime'].includes(prop)) {
          return new Proxy({}, {
            get() {
              throw new Error(
                `supabaseAdmin.${prop} is not available: SUPABASE_SERVICE_ROLE_KEY is missing.\n` +
                "Please add SUPABASE_SERVICE_ROLE_KEY to your environment variables."
              );
            }
          });
        }
        return undefined;
      }
    });
  }
  
  logger.info("Supabase Admin client initialized with service role key.");
  
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    }
  });
})();

/**
 * Check if the admin client is properly initialized
 */
export function isSupabaseAdminAvailable(): boolean {
  return !!serviceRoleKey;
}

/**
 * Get the error message if admin client is not available
 */
export function getSupabaseAdminError(): string | null {
  if (!serviceRoleKey) {
    return "SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations require this environment variable.";
  }
  return null;
}

/**
 * Get the service role key for Edge Function calls
 * Only available on the server
 */
export function getServiceRoleKey(): string | null {
  return serviceRoleKey;
}

/**
 * Wrapper for safe admin operations with automatic error handling
 */
export async function withSupabaseAdmin<T>(
  operation: (client: SupabaseClient<Database>) => Promise<T>
): Promise<{ success: boolean; data?: T; error?: string }> {
  const validation = validateServiceRoleKey();
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  
  try {
    const result = await operation(supabaseAdmin);
    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Supabase admin operation failed:", error);
    return { success: false, error: message };
  }
}
```

#### Step 3: Update Hooks File to Use Server-Only Module

**File:** `src/hooks/supabase.ts`

**Changes:**

1. **Add new imports at the top:**
```typescript
/**
 * Supabase Hooks and Helper Functions
 *
 * IMPORTANT: This module is server-only because it imports supabaseAdmin.
 * All functions here that use supabaseAdmin bypass Row Level Security (RLS).
 *
 * For client-side operations, use supabaseAnon directly or create a separate
 * client-side module.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { generateJwtToken } from "@/lib/auth";
import type { WebAppUser } from "@/types/telegram";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types.ts";

// Import the server-only admin client - this makes the entire module server-only
import {
  supabaseAdmin,
  isSupabaseAdminAvailable,
  getSupabaseAdminError,
  withSupabaseAdmin,
  getServiceRoleKey,
} from "@/lib/supabase-server";

// Re-export for convenience
export { supabaseAdmin, isSupabaseAdminAvailable, getSupabaseAdminError, withSupabaseAdmin };
```

2. **Remove the old admin client definition:**
```typescript
// REMOVE THIS ENTIRE BLOCK (approximately lines 30-100):
// const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// let adminClientInitError: string | null = null;
// export const supabaseAdmin: SupabaseClient<Database> = (() => { ... })();
// export function isSupabaseAdminAvailable(): boolean { ... }
// export function getSupabaseAdminError(): string | null { ... }
// export async function withSupabaseAdmin<T>(...): Promise<...> { ... }
```

3. **Replace with just the anon client:**
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://inmctohsodgdohamhzag.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgzMzk1ODUsImV4cCI6MjA1MzkxNTU4NX0.AdNu5CBn6pp-P5M2lZ6LjpcqTXrhOdTOYMCiQrM_Ud4";

if (!supabaseUrl || !supabaseAnonKey) {
    logger.error("Supabase URL or Anon Key is missing from environment variables.");
}

// Anon client - can be used for client-side operations with RLS
export const supabaseAnon: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

4. **Update `generateCarEmbedding` function to use `getServiceRoleKey()`:**
```typescript
export async function generateCarEmbedding(
  mode: 'single' | 'batch' | 'create' = 'batch',
  payload?: { ... }
): Promise<{ success: boolean; message: string; carId?: string; error?: string }> {
    const serviceRoleKey = getServiceRoleKey();  // ADD THIS LINE
    if (!serviceRoleKey || !supabaseUrl) {
        return { success: false, message: "Service role key or Supabase URL missing.", error:"Configuration error." };
    }
    // ... rest of function unchanged
```

---

## Why This Is The Correct Approach

| Aspect | Previous Approach | New Approach |
|--------|-------------------|--------------|
| **Build-time protection** | None | `server-only` throws error if imported by client |
| **Environment variable safety** | Could leak to client | `SUPABASE_SERVICE_ROLE_KEY` never in client bundle |
| **Graceful degradation** | Proxy pattern in same file | Proxy pattern in dedicated server-only module |
| **Error clarity** | Generic error messages | Actionable error with docs link |
| **Edge Function support** | Direct variable access | `getServiceRoleKey()` function for authorized calls |
| **Module boundary** | Unclear | Clear separation: `supabaseAnon` (client) vs `supabase-server.ts` (server) |

---

## Remaining T49 Scope (Not Yet Implemented)

1. **SPA recovery** - Remove full-reload navigation fallbacks, restore Next.js `Link`/router transitions
2. **Root-cause tap fix** - Audit z-index/overlay/stopPropagation conflicts
3. **Cart DB load guard** - Local-first cart with checkpoint persistence
4. **Style-system cleanup** - Move palette delivery to CSS variables
5. **Context split plan** - Decompose `AppContext` into smaller providers
6. **Theme flash hardening** - Bootstrap theme from server-readable signal
7. **Micro-optimization rollback** - Remove cargo-cult `React.memo`
8. **AI JSON resilience** - Harden parsing/validation for malformed payloads
9. **Regression pack** - Full smoke for Telegram-style navigation

---

## Acceptance Criteria

- [x] No client-side bundle path can access admin/service-role Supabase credentials
- [ ] Internal franchize navigation uses SPA transitions (no forced full reload workaround)
- [ ] Cart persistence no longer performs frequent metadata writes per tiny quantity edit
- [ ] Interaction-state styles (`hover/focus/active`) remain visible after theme application
- [ ] Context updates avoid full-app rerenders for unrelated state
- [ ] First paint does not flash incorrect light theme before dark theme sync
- [ ] AI JSON tooling reports precise validation errors without crashing

---

## Files Modified

| File | Change Type |
|------|-------------|
| `src/components/franchize/CrewHeader.tsx` | Modified (transition smoothing) |
| `src/lib/supabase-server.ts` | NEW (server-only admin module) |
| `src/hooks/supabase.ts` | Modified (import from server-only module) |
| `package.json` | Modified (added `server-only` dependency) |

---

## Verification Commands

```bash
# Install server-only package
bun add server-only

# Run lint
bun run lint

# Verify build succeeds
bun run build
```
