# Strikeball Profile Capabilities (Goldmine Map)

Scope: `app/strikeball/stats/page.tsx` + related actions/context.

## 1) What already works (production-ready patterns)

1. **Identity card for operator**
   - Uses `useAppContext()` (`user`, `dbUser`, `userCrewInfo`) to render player identity + squad binding.
2. **Battle stats hydration**
   - Calls `getUserCombatStats(userId)` and displays matches/wins/KD/accuracy cards.
3. **Inventory feed (personal stash)**
   - Calls `getUserPurchases(userId)` and renders owned items with status-based UX.
4. **Dual QR capability**
   - Profile QR (`user_<id>`) for admin scans.
   - Item QR (`purchase_<id>`) for transactional verification.
5. **Operator-style visual telemetry**
   - Compact "личное дело" dashboard style with clear combat/ownership signals.

## 2) Reusable capability contract for other domains (Franchize/CyberFitness)

Use Strikeball profile as reference architecture for personalized surfaces:

- **Identity layer:** user + crew context (AppContext).
- **Stats layer:** compact KPI cards from domain actions.
- **Ownership layer:** per-user inventory/achievements list.
- **Verification layer:** QR/deep-link primitive for operator confirmations.
- **Progressive reveal:** dashboard first, drill-down second.

## 3) Integration notes

- For franchize profile evolution, replicate the same 4-layer stack:
  1. identity (crew + role),
  2. performance stats,
  3. unlock inventory,
  4. verification/ops tokens.
- Keep metadata snapshots in `AppContext` to avoid repeated reads in each page.
- Achievement triggers should emit `source` and optional `context` for future analytics.

## 4) Next technical steps

1. Move strikeball profile KPI schema into shared typed capability (`types/profileCapabilities.ts`).
2. Add server action returning strikeball profile snapshot in one read.
3. Bridge strikeball unlock events into unified achievement stream alongside franchize/cyberfitness.
