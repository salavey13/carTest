# Crew Creation Tree — Code Review

## File Inventory (concat order)

| # | Path | Lines | Role |
|---|------|------:|------|
| 01 | `app/franchize/create/page.tsx` | 19 | Page wrapper — just renders `<CreateFranchizeForm initialSlug={...} />` |
| 02 | `app/franchize/create/CreateFranchizeForm.tsx` | 635 | **Customization** editor (palette/content/map/ai/ops) for an EXISTING crew |
| 03 | `app/franchize/actions.ts` | 231 | Re-export wrapper over actions-runtime |
| 04 | `app/franchize/actions-runtime.ts` | 5002 | `loadFranchizeConfigBySlug` + `saveFranchizeConfig` + `resolveFranchizeEditorAccess` |
| 05 | `hooks/useStartParamRouter.ts` | 675 | Deep-link router — `create_crew` → `/wblanding` |
| 06 | `app/franchize/[slug]/onboarding/page.tsx` | 151 | Partner onboarding checklist (NOT creation) |
| 07 | `app/wblanding/page.tsx` | 427 | Landing page — renders `<CrewCreationForm>` |
| 08 | `app/wblanding/components/CrewCreationForm.tsx` | 152 | **REAL create form** — calls `createCrew()` server action |
| 09 | `app/actions.ts` (`createCrew`) | 100 | Inserts into `public.crews` + `crew_members` (role=owner) + assigns bikes |
| 10 | `app/franchize/components/FranchizeProfileButton.tsx` | 530 | Profile dropdown — already links to `/franchize/create` (customization only) |
| 11 | `docs/crewDocs/vip-bike-franchize-hydration.sql` | 430 | Crew seed — sets metadata.franchize config |

## Critical Finding

**There ARE two distinct flows, but they're disconnected:**

```
FLOW A — ACTUAL CREATE (no UI link from crew pages):
  t.me/bot/app?startapp=create_crew
    → useStartParamRouter.ts:32  (create_crew → "/wblanding")
    → /wblanding page renders <CrewCreationForm>
    → createCrew() server action inserts crew + owner + bikes
    → user becomes owner of a NEW crew with empty metadata

FLOW B — CUSTOMIZATION ONLY (currently linked from profile dropdown):
  Profile dropdown → "Создать франшизу" → /franchize/create
    → CreateFranchizeForm loads crew by slug
    → saveFranchizeConfig() REQUIRES existing crew row (line 1462-1467):
        "Slug не найден: сохранение не выполнено."
    → Cannot create a new crew. Only edits metadata of existing one.
```

**The profile dropdown label is misleading.** It says "Создать франшизу" but goes to Flow B which can only edit. Real creation (Flow A) lives at `/wblanding#create-crew-form` and is unreachable from crew context.

## Bugs Found

### BUG #1 (HIGH) — `CreateFranchizeForm.tsx:178` has a syntax-corrupted line
```typescript
const essage, setMessage] = useState("Укажите slug, подберите...");
```
Should be `const [message, setMessage] = useState(...)`. The `[mess` prefix was lost somehow. This is a TypeScript compile error — the page would not build. (Verified in raw GitHub fetch, line 178 of CreateFranchizeForm.tsx.)

### BUG #2 (MEDIUM) — `useStartParamRouter.ts:32` has a stale route
```typescript
create_crew: "/wblanding",
```
Routes to `/wblanding` (generic landing) instead of `/wblanding#create-crew-form` (anchor scroll to actual form). User has to scroll past 6 other sections to find the form.

### BUG #3 (MEDIUM) — `CrewCreationForm.tsx:61` has wrong deep link
```typescript
const inviteUrl = `https://t.me/oneBikePlsBot/sklad?startapp=crew_${userCrewInfo.slug}_join_crew`;
```
Uses `/sklad` (old bot path) instead of `/app` (current Telegram WebApp path). Deep link may 404 in production.

### BUG #4 (LOW) — `FranchizeProfileButton.tsx` "Создать франшизу" passes current slug context
```tsx
href={effectiveSlug ? `/franchize/create?slug=${effectiveSlug}` : "/franchize/create"}
```
For a logged-in user who has NO crew, `effectiveSlug` is empty → goes to `/franchize/create` → loads `vip-bike` as fallback (line 348 of CreateFranchizeForm) → user lands on VIP BIKE customization in read-only mode. Confusing for someone who clicked "Создать франшизу".

### BUG #5 (LOW) — `createCrew()` in `app/actions.ts` doesn't validate slug uniqueness before insert
The `insert` at line 159-171 will fail with a Postgres unique-violation error if slug already exists, but the error message returned is generic. Should pre-check with a friendly error like "Slug 'vip-bike' already taken".

### BUG #6 (LOW) — `resolveFranchizeEditorAccess()` only allows `owner` role
```typescript
return membership?.membership_status === "active" && membership.role === "owner";
```
Admins of a crew (role="admin" or "co_owner") cannot edit franchize config, even though they're trusted operators. Inconsistent with `isCurrentCrewAdmin` check in `FranchizeProfileButton.tsx:88-91` which DOES include admin/co_owner.

## Architecture Recommendation

```
User clicks "Создать франшизу" in profile dropdown
  ↓
IF user has no crew:
  → /wblanding#create-crew-form  (FLOW A — real create)
  → after createCrew() succeeds → redirect to /franchize/create?slug=<new-slug>
  → user customizes their new crew (FLOW B — edit, but now crew exists)

IF user already has crew:
  → /franchize/create?slug=<their-slug>  (FLOW B — customization)
```

This requires:
1. Update `FranchizeProfileButton.tsx` dropdown to branch on `userCrewInfo`
2. Update `useStartParamRouter.ts` to route `create_crew` → `/wblanding#create-crew-form`
3. Update `CrewCreationForm.tsx` to redirect to `/franchize/create?slug=...` after success
4. Fix the syntax error in `CreateFranchizeForm.tsx` line 178
5. Make "create franchize" button visibility configurable via `metadata.franchize.ui.showCreateButton` (default true)
6. Update `vip-bike-franchize-hydration.sql` to set `ui.showCreateButton: true`
