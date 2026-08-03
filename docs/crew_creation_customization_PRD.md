# PRD — Crew Creation & Customization v2 (Editor + Bot Skill)

Last updated: 2026-08-04
Status: 🚧 **Draft — Phase 1 (contract foundation) implemented**
Codebase context: `app/franchize/create/CreateFranchizeForm.tsx`, `app/franchize/actions-runtime.ts`, `app/franchize/[slug]/admin/page.tsx`, `app/franchize/components/FranchizeAdminClient.tsx`
Skill references: `skills/catalog-adder-text/SKILL.md` (write-pattern), `skills/franchize-catalog-text/SKILL.md` (read-pattern), `skills/crew-management-text/SKILL.md` (crew+bot pattern)
Quality bar: `app/franchize/[slug]/leads/` (modular, tokenized, empty/loading states) and `rentals` / `rentals-analytics` pages.

---

## 0. Why this PRD exists (background)

On 2026-07-29 commit `f66300fd` added an inline **"Создать экипаж"** tab to `/franchize/create`. It shipped a regression: `handleCreateCrew` referenced `onLoad` in its `useCallback` deps **before** `onLoad` was declared, throwing a TDZ `ReferenceError` on every render — the page crashed into the error boundary when opened. Fixed in `9f0a1cd7`.

That incident is a symptom of a deeper problem: the create page is an **832-line monolith** hosting 6 unrelated stages, with **no shared config contract**, **no field-level validation surfacing**, **no design-token system**, and **no skill-facing interface**. Meanwhile the leads/rentals pages are modular, tokenized, resilient, and each has a sibling `*-text` skill so the bot can do the same job from Telegram.

This PRD plans the **enhancement and simplification** of crew creation + customization, and — critically — **architects the config layer to be reusable by a skill** so crew members can customize their own crew through the bot, mirroring how `catalog-adder-text` already lets agents add bikes straight to `public.cars`.

---

## 1. Summary

Replace the fragile single-file editor with a **contract-first architecture**:

1. **A shared, pure "config contract" module** (`app/franchize/lib/franchize-config-contract.ts`) that owns:
   - the `FranchizeConfigInput` shape,
   - the zod validation schema,
   - the pure `configToMetadata(input)` → `crews.metadata.franchize` mapping,
   - the pure `metadataToConfig(metadata, secrets)` → flat input mapping.
   Both the **editor UI** and the **bot skill script** import this same module — one source of truth, identical behavior, zero drift.
2. **A refactored editor** — stage components, `useCrewTokens`, per-field error display (the server's `fieldErrors` are currently discarded), step progress, positive empty/loading states.
3. **Admin page polish** — surface silent loader failures, add fleet search, skeletons, route-level `error.tsx` / `loading.tsx` / `FranchizeErrorBoundary`.
4. **A new bot skill** `crew-customization-text` (Node script + SKILL.md) that reads/validates/writes crew config through the **same contract module**, usable by crew members from Telegram — like `catalog-adder-text` but for `crews.metadata.franchize`.

---

## 2. Product goals

- [x] Fix the TDZ crash that broke `/franchize/create` (done in `9f0a1cd7`).
- [ ] Make the crew config a **single documented contract** reused by UI + skill + validation.
- [ ] Show **field-level validation** errors in the editor (server `errors.fieldErrors` → inline field hints, not just a toast).
- [ ] Adopt `useCrewTokens` / shared primitives so the editor stops repeating inline styles on ~60 inputs.
- [ ] Add a **6-step progress indicator** for the create → ops flow.
- [ ] Add `loading.tsx` / `error.tsx` / `FranchizeErrorBoundary` to `create/` and `admin/` routes.
- [ ] Surface **silent failures** on the admin page (rentals/reviews/notifications loaders) with toasts + retry.
- [ ] Add **fleet search** + **skeletons** on the admin page.
- [ ] Ship a **skill** so a crew member can customize their crew from Telegram: read config, validate, update branding/theme/contacts/catalog/order, run readiness checks.

## 3. Non-goals (this phase)

- [ ] No new DB columns / no new tables. Config stays in `crews.metadata.franchize` + private crew secrets.
- [ ] No rewrite of `FranchizeAdminClient` into new files — polish in place (tokens, toasts, search).
- [ ] No PII exposure in skills: skill output must not print phone numbers/VINs to public channels.
- [ ] Do **not** change the config storage format — the contract must remain backward compatible with existing `metadata.franchize` JSON.

---

## 4. Current-state audit (2026-08-04)

### 4.1 Create / customize page — `app/franchize/create/CreateFranchizeForm.tsx` (832 lines)

| Stage | Lines | UI | Notes |
|---|---|---|---|
| create | ~525–623 | plain inputs | only place using `sonner` toasts; createCrew + redirect to palette |
| palette | ~632–674 | native color inputs + contrast list | no tokens |
| content | ~676–714 | plain inputs/textareas | no per-field validation |
| map | ~717–751 | plain inputs + links | |
| ai | ~752–763 | copy JSON + apply | `validateAdvancedJson` → `readPath` into form |
| ops | ~765–824 | 6-check readiness + score bar | nice, but isolated |

Cross-cutting issues:
- **TDZ bug class** — deps array referenced a `const` declared later (`handleCreateCrew` → `onLoad`). Moving declarations below usage fixed it; the new contract module eliminates the class of error by keeping logic in pure leaf modules.
- **`errors` discarded** — `saveFranchizeConfig` returns `errors: parsed.error.flatten().fieldErrors` (actions-runtime.ts:1456) but the editor only shows `result.message` (CreateFranchizeForm.tsx ~422).
- **No tokens** — ~60 inputs repeat `style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }}`.
- **`useAppContext() as { ...: any }`** cast (line ~199) — real types unused.
- **No skeletons / empty states / optimistic UI.**

### 4.2 Admin page — `app/franchize/[slug]/admin/page.tsx` + `FranchizeAdminClient.tsx` (759 lines)

- Thin server page (57 lines), logic in a 759-line client monolith.
- **Silent failures** — loaders for successful rentals / reviews / failed notifications `return` without toast (FranchizeAdminClient.tsx:206-207, 235-236, 245-246).
- **No search** — only all/bike/car tab filter; leads has debounced search.
- **No skeletons** — single `<Loading>` from `useAppContext().isLoading`.
- **No optimistic updates**, 60 s polling with no caching.
- **Bulk VIN fabrication** in the view layer (`buildSyntheticVin` + raw `fetch("/api/cars")`) — move to server action, or at minimum gate + confirm.

### 4.3 The good news (what to copy)

- `leads/` = modular: ~30 components + 11 hooks + lib/; `useCrewTokens` (`app/franchize/lib/use-crew-tokens.ts:114-218`) gives `T.styles.*`, `T.styles.card`, `ctaPrimary`, accent/success/warning/danger badges.
- `leads/EmptyState.tsx` — positive copy + reset CTA + source chips.
- `LeadsKPICards.tsx` — spring entrances, semantic deltas, `Intl.NumberFormat("ru-RU")`.
- `LeadsToolbar.tsx` — 44px touch targets, debounced search, scrollable pill filters.
- `MobileLeadSheet` vs `LeadDetailDrawer` — same content via `asSheetChild`.
- `FranchizeErrorBoundary` + `AnalyticsLoading` are ready-made shared components.
- `catalog-adder-text` + `franchize-catalog-text` — proven skill patterns for read/write via service role.

---

## 5. Target architecture (contract-first, skill-reusable)

```
                    ┌─────────────────────────────────────────────┐
                    │  app/franchize/lib/franchize-config-contract.ts │  PURE (no IO)
                    │  • FranchizeConfigInput / State types         │
                    │  • zod configSchema (single source of truth)   │
                    │  • defaultFranchizeConfig                     │
                    │  • configToMetadata(input) → metadata.franchize│
                    │  • metadataToConfig(metadata, secrets) → input │
                    │  • normalizeCrewSlug / splitCsv / parse*       │
                    └───────────────┬─────────────────────────────┘
                                    │ imports
              ┌─────────────────────┼──────────────────────┐
              │                     │                      │
  ┌───────────▼───────────┐ ┌───────▼───────────┐ ┌────────▼──────────────────┐
  │ actions-runtime.ts    │ │ CreateFranchize   │ │ scripts/crew-customization│
  │ (server, supabaseAdmin)│ │ Form stages (UI)  │ │  -skill.mjs (bot/CLI)     │
  │ load/save/access      │ │ tokens+validation │ │ get-config/set-field/    │
  └───────────┬───────────┘ └───────────────────┘ │ validate/list-crews      │
              │                                    └──────────────────────────┘
      crews.metadata.franchize
      private crew secrets
```

**Why this is skill-reusable:** the skill script is a thin CLI over the same pure module. Whatever the UI can validate/map, the bot can do identically. The SKILL.md then only has to document **commands + the contract**, not re-implement mapping.

### 5.1 Contract module responsibilities (Phase 1)

- `FranchizeConfigInput` — exactly as today (do not rename keys; backward compatible).
- `configSchema` — zod object, moved verbatim from actions-runtime.ts:307-357.
- `defaultFranchizeConfig` — moved from actions-runtime.ts:359-409.
- Pure helpers moved out: `readPath`, `readArrayPath`, `splitCsv`, `normalizeCrewSlug`, `withSlug`, `normalizeCampaignHref`, `trimCampaignTitle`, `parseMenuLinks`, `parseSocialLinks`, `parsePromoBanners`, `parseAdCards`, `extractFooterSocialLinks`, `extractFooterColumns`, `fallbackMenuLinks`, `normalizeCatalogOrder`.
- `configToMetadata(input, existingMetadata)` — the exact merge built in saveFranchizeConfig (actions-runtime.ts:1515-1611), including palettes (dark/light), header menuLinks, footer/contacts, catalog groupOrder/promo/ad, order delivery/payment/defaultMode, plus `advancedJson`/`contractDefaultsJson`/`docTemplatesJson` override handling.
- `metadataToConfig(metadata, crew, secrets)` — the exact read in toFranchizeConfigInput (actions-runtime.ts:1314-1425), with `secrets` passed in (so the module stays IO-free).
- `validateAdvancedJson(json)` — extracted from the editor's `validateAdvancedJson` (CreateFranchizeForm.tsx:103-127).

### 5.2 Skill interface (Phase 4)

`scripts/crew-customization-skill.mjs` (Supabase via `@supabase/supabase-js`, same env as `make-deal-contract-skill.mjs`):

| Command | Purpose |
|---|---|
| `list-crews` | list crews (slug, name, owner) |
| `get-config --slug X` | read full config, formatted text (branding/theme/contacts/catalog/order/contract) |
| `show-field --slug X --field brandName\|accentMain\|...` | read one field |
| `set-field --slug X --field <k> --value <v>` | validate + update one field, print new value |
| `set-contract-default --slug X --key <k> --value <v>` | update contract defaults |
| `validate-config --slug X` | zod-validate current config + ops readiness checks |
| `get-readiness --slug X` | replicate the editor's 6 ops checks |

Permissions: write ops require `owner` (via `crew_members` role=owner) or `admin` user — the script resolves access the same way `resolveFranchizeEditorAccess` does (actions-runtime.ts:1284-1312).

---

## 6. Phase plan

### Phase 1 — Config contract foundation ✅ (this PRD's implementation)
1. Create `app/franchize/lib/franchize-config-contract.ts` (types + schema + defaults + pure mapping both ways).
2. Rewire `loadFranchizeConfigBySlug` / `saveFranchizeConfig` in actions-runtime.ts to use the module (behavior-preserving).
3. Typecheck the slice.

### Phase 2 — Editor refactor (UI)
1. Split `CreateFranchizeForm.tsx` stages into `components/` (one file per stage: `CreateCrewStage`, `PaletteStage`, `ContentStage`, `MapStage`, `AiStage`, `OpsStage`).
2. Add a **StepProgress** header (6 steps, current highlight, per-step completion check).
3. Adopt `useCrewTokens` (`T.styles.*`) in stage components — remove per-input inline style repetition.
4. **Per-field errors**: keep server `errors.fieldErrors` in state and render inline hints under inputs (`fieldErrors[field]?.map`).
5. Type the `useAppContext()` destructure properly (drop `any` cast).
6. Add positive empty/loading states per stage; skeleton while `loadFranchizeConfigBySlug` in flight.

### Phase 3 — Admin page polish
1. Toast loader failures + "Попробовать снова" on rentals/reviews/notifications panels.
2. Add debounced fleet search (filter the KPI/editor vehicle select).
3. Add `loading.tsx`, `error.tsx`, wrap `FranchizeAdminClient` in `FranchizeErrorBoundary`.
4. Add empty states + skeletons (adopt `AnalyticsLoading` / shadcn `skeleton`).
5. Move `buildSyntheticVin` + bulk VIN write behind a server action with confirm dialog.

### Phase 4 — Bot skill
1. `scripts/crew-customization-skill.mjs` — CLI over the contract module (5.2).
2. `skills/crew-customization-text/SKILL.md` — commands, schema access, anti-hallucination flags, error table, security (PII masking), related files.
3. Wire into `boss-mode` / `vip-bike-ops` umbrella as a sibling skill so Telegram triggers like "поменяй акцентный цвет", "смени телефон в контактах", "покажи статус запуска" route to it.

---

## 7. Data model — config contract reference (kept in sync with `app/franchize/lib/franchize-config-contract.ts`)

### 7.1 `FranchizeConfigInput` (flat editor shape)

| Field | Type | Default | Notes |
|---|---|---|---|
| slug | string | "" | normalized via `normalizeCrewSlug` |
| brandName | string | DEFAULT_FRANCHIZE_BRAND.brandName | min 2 |
| tagline | string | DEFAULT | min 2 |
| logoUrl | string | "" | optional |
| themeMode | string | defaultTheme.mode | dark/light |
| bgBase/bgCard/accentMain/accentMainHover/textPrimary/textSecondary/borderSoft | string | defaultTheme.palette | dark palette |
| lightBgBase…lightBorderSoft | string | DEFAULT_LIGHT_THEME_PALETTE | light palette |
| phone/email/address/telegram | string | "" | contacts/footer |
| mapGps/mapImageUrl/mapBoundsTop/Bottom/Left/Right | string | DEFAULT_MAP_* | contacts.map |
| socialLinksText | string | DEFAULT_SOCIAL_LINKS_TEXT | pipe format `label\|href` per line |
| menuLinksText | string | DEFAULT_MENU_LINK_TEMPLATES | pipe format |
| categoryOrderText | string | DEFAULT_CATEGORY_ORDER | CSV |
| promoBannersText / adCardsText | string | DEFAULT_* | pipe format, 10 fields |
| allowPromo | boolean | true | order.allowPromo |
| deliveryModesText / paymentOptionsText | string | DEFAULT_* | CSV |
| defaultMode | string | "pickup" | |
| issuerName/issuerRepresentative/includedMileage/overageRateRub/bikeValueRub/bikeValueWords/lateReturnPenaltyRub/returnAddress | string | DEFAULT_CONTRACT_PREFILL | contract defaults |
| contractDefaultsJson | string | "" | JSON → private secrets |
| docTemplatesJson | string | "" | JSON → private secrets |
| advancedJson | string | "" | JSON → deep-merge into metadata.franchize |

### 7.2 Stored shape — `crews.metadata.franchize` (canonical)

```
{
  version, enabled, slug,
  branding: { name, tagline, logoUrl },
  theme: { mode, palette: {…}, palettes: { dark: {…}, light: {…} } },
  header: { menuLinks: [{label,href}] },
  footer: { phone, email, address, socialLinks: [{label,href}] },
  contacts: { phone, email, address, telegram, map: { gps, imageUrl, bounds: {top,bottom,left,right} } },
  catalog: { groupOrder: [], promoBanners: [], adCards: [], showcaseGroups: [] },
  order: { allowPromo, deliveryModes: [], paymentOptions: [], defaultMode }
}
```

Private crew secrets (separate storage, `getCrewSensitiveDataOrDefault`):
`contractDefaults.defaults.{issuerName, issuer_representative, included_mileage, overage_rate, bike_value_rub, bike_value_words, late_return_penalty_rub, return_address}` and `docTemplates`.

---

## 8. Acceptance criteria

- [ ] `tsc --noEmit` clean for the franchize slice.
- [ ] `/franchize/create` opens without error boundary; create → palette flow works (manual QA).
- [ ] Save with invalid field shows the error **under the input**, not just a toast.
- [ ] Skill `get-config --slug X` output matches what the editor shows after `loadFranchizeConfigBySlug(X)`.
- [ ] Skill `set-field --slug X --field accentMain --value #FF0000` then editor reload shows the same value, and `crews.metadata.franchize.theme.palettes.dark.accentMain` matches.
- [ ] Admin loader failures show a toast + retry.
- [ ] `error.tsx` present in `create/` and `admin/`, wraps client tree.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Config mapping drift between UI/skill | Single pure module imported by both; `get-config` vs editor cross-checked in QA |
| Breaking existing `metadata.franchize` | Contract is read-backward-compatible; `advancedJson` deep-merge preserved |
| Skill writing bad config via service role | Skill script validates with the same zod schema; access gated to owner/admin; anti-hallucination section lists non-existent flags |
| Editor refactor regressions (like the TDZ bug) | Stage split is behavior-preserving; keep `handleCreateCrew` after `onLoad`; typecheck slice |
| PII leakage in skill output | Skill masks phones; SKILL.md security section |

---

## 10. Milestones

| # | Deliverable | Status |
|---|---|---|
| M1 | PRD | ✅ this doc |
| M2 | Config contract module + actions-runtime rewiring | 🚧 Phase 1 |
| M3 | Editor stage split + tokens + field errors + progress | ⏳ Phase 2 |
| M4 | Admin polish (toasts/search/skeletons/boundary) | ⏳ Phase 3 |
| M5 | `crew-customization-skill.mjs` + `SKILL.md` | ⏳ Phase 4 |
| M6 | Cross-check skill output vs editor + typecheck + QA | ⏳ |

---

## 11. Related files

- Editor: `app/franchize/create/CreateFranchizeForm.tsx`, `app/franchize/create/page.tsx`
- Server config: `app/franchize/actions-runtime.ts`, `app/franchize/server-actions/config.ts`, `app/franchize/actions.ts`
- Admin: `app/franchize/[slug]/admin/page.tsx`, `app/franchize/components/FranchizeAdminClient.tsx`, `app/franchize/[slug]/admin/prices/page.tsx`
- Defaults: `lib/franchize-config.ts`, `app/franchize/lib/theme-resolver.ts`, `app/franchize/lib/use-crew-tokens.ts`
- Secrets: `lib/private-secrets.ts` (`getCrewSensitiveDataOrDefault`, `saveCrewSensitiveData`)
- Skills to mirror: `skills/catalog-adder-text/SKILL.md`, `skills/franchize-catalog-text/SKILL.md`, `skills/crew-management-text/SKILL.md`, `skills/deal-contract-from-photos/SKILL.md` (script pattern)
- QA: `npm run typecheck:franchize`, `npm run test:franchize`
