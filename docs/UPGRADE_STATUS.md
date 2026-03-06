# UPGRADE_STATUS

Last reviewed: 2026-03-06

## Package upgrade matrix (current cycle)

| Package | Current (`package.json`) | Latest stable | Selected target (this cycle) | Risk note (peer deps / breaking changes / migration links) |
|---|---:|---:|---:|---|
| `next` | `^14.2.28` | `16.1.6` | `14.2.35` | Major jump to Next 16 is intentionally deferred this cycle to avoid App Router + runtime behavior drift; patch-upgrade inside Next 14 line first. Migration refs: <https://nextjs.org/docs/app/guides/upgrading/version-15>, <https://nextjs.org/docs/app/guides/upgrading/version-16>. |
| `react` | `^18.3.1` | `19.2.4` | `18.3.1` | React 19 adoption is coupled with Next 15/16 and ecosystem readiness; keep React 18 stable for Telegram-first UX predictability this cycle. Migration ref: <https://react.dev/blog/2024/04/25/react-19-upgrade-guide>. |
| `react-dom` | `^18.3.1` | `19.2.4` | `18.3.1` | Must stay in lockstep with `react`; React 19 upgrade deferred with framework-major step. Migration ref: <https://react.dev/blog/2024/04/25/react-19-upgrade-guide>. |
| `eslint-config-next` | `^14.2.28` | `16.1.6` | `14.2.35` | Keep aligned with selected Next major to avoid lint rule incompatibility; do not mix Next 14 app with Next 16 lint config. |
| `typescript` | `^5` | `5.9.3` | `5.9.3` | Minor/patch changes may tighten type checks; validate CI lint/build after lockfile update. Release notes: <https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html>. |
| `@types/react` | `18.2.79` | `19.2.14` | `18.3.28` | Keep on React 18 type line while runtime stays React 18; React 19 types can introduce incompatible definitions for legacy patterns. |
| `@types/react-dom` | `18.2.25` | `19.2.3` | `18.3.7` | Keep synchronized to React 18 type family; avoid accidental type-only major mismatch with runtime. |
| `@supabase/supabase-js` | `2.48.1` | `2.98.0` | `2.98.0` | High-impact runtime dep (auth/session/storage). Even within major v2, verify auth/session flows and server/client boundary assumptions after upgrade. Release notes: <https://github.com/supabase/supabase-js/releases>. |
| `framer-motion` | `12.0.6` | `12.35.0` | `12.35.0` | High-visibility UI runtime dep; check animation API/typing adjustments and interaction smoothness on mobile Telegram WebView. Docs: <https://motion.dev/docs/react-upgrade-guide>. |
| `axios` *(Telegram Bot API transport in scripts/server utilities)* | `^1.8.4` | `1.13.6` | `1.13.6` | Telegram-related delivery path relies on HTTP client behavior; validate webhook and notify scripts against API response/error-shape changes. Changelog: <https://github.com/axios/axios/releases>. |

> Note: no dedicated Telegram SDK package is currently declared in `package.json`; Telegram integration is primarily via direct Bot API HTTP calls in repo scripts/routes.

---

## Definition of demonstrably up-to-date

A cycle is considered complete only when all checks below are green on the target branch:

1. **Lockfile updated**
   - `package-lock.json` reflects selected target versions and no partial/manual drift.
2. **Clean install**
   - fresh dependency install succeeds from lockfile (no missing postinstall artifacts).
3. **Lint + build pass**
   - `npm run lint`
   - `npm run build`
4. **Smoke checks for critical routes**
   - `/`
   - `/nexus`
   - `/repo-xml`
   - `/franchize/vip-bike`

---

## Excluded from this cycle (scope guard)

To prevent scope creep, the following are explicitly out-of-scope for this cycle:

- Next major migration (`next@15`/`next@16`) and associated React 19 runtime migration work.
- Refactors unrelated to dependency compatibility (UI redesign, routing reshuffles, non-upgrade feature work).
- New Telegram framework adoption (`telegraf`, `grammY`, etc.); this cycle only tracks current HTTP-based integration path.
- Database schema/policy rewrites not required by package upgrade compatibility.
- Performance optimization passes not caused by upgraded package regressions.

---

## Execution log (this run)

### Stage A — core (`next` + `react` + `react-dom`)

- **Dependency action:** `npm install next@14.2.35 react@18.3.1 react-dom@18.3.1`
- **Result:** ✅ success (`next` moved to `^14.2.35`; `react`/`react-dom` remained on `18.3.1` latest in React 18 line).

Checks:
- ✅ `npm run lint` (completed with pre-existing warnings only; no new dependency-caused lint errors)
- ✅ `timeout 300 npm run build` (build completed on Next `14.2.35`)

### Stage B — alignment (`eslint-config-next`, `@types/react`, `@types/react-dom`, TS if needed)

- **Dependency action attempted:** `npm install -D eslint-config-next@14.2.35 @types/react@18.3.28 @types/react-dom@18.3.7`
- **Result:** ❌ blocked by registry outage in this environment.

Failure evidence:
- `npm error code E503`
- `npm error 503 Service Unavailable - GET https://registry.npmjs.org/@types%2freact`
- `npm error 503 Service Unavailable - GET https://registry.npmjs.org/eslint-config-next`

Additional check:
- `curl -I https://registry.npmjs.org/eslint-config-next` returned upstream `503 Service Unavailable` in current runner path.

Status after this run:
- Stage A: **done**
- Stage B: **blocked (external npm registry 503)**
