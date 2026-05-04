# /app relevance audit (2026-05-04)

Goal: identify **delete candidates** in `/app` without removing anything yet.

## Method
1. Searched `/app` for explicit legacy/demo naming (`example|demo|old|backup|test|tmp`).
2. Enumerated static routes (`app/**/page.tsx`) and counted text references across repo as a weak signal of discoverability.
3. Marked risk based on likely business impact + possibility of direct/deep links.

> Important: low reference count does **not** prove a route is unused (Telegram, bookmarks, manual URLs may still rely on it).

## Candidate table (no removals yet)

| Candidate | Type | Evidence | Risk | Recommendation |
|---|---|---:|---|---|
| `app/greenbox/demo-content.ts` | demo data file | filename contains `demo`; not an entry route | Low | Remove if no imports from production page modules. |
| `app/wblanding/actions_demo.ts` | demo helper/actions | filename contains `demo` | Medium | Keep if imported by `wblanding` flow, otherwise remove. |
| `app/strikeball/test-lab/page.tsx` | route | route name includes `test-lab`, ref count = 0 | Medium | Gate behind dev-only flag or archive if not operator-facing. |
| `app/elon/testbase/arbitrage-viz-sandbox/page.tsx` | route | `testbase/sandbox` semantics, low refs | Medium | Move under explicit lab/archive namespace or remove. |
| `app/lab/tutorials/image-swap/page.tsx` | route | tutorial/lab semantics, low refs | Medium | Keep only if used for onboarding docs. |
| `app/md-doc/page.tsx` | route | utility/doc route, low refs | Medium | Confirm external links before trimming. |
| `app/sql-cheatsheet/page.tsx` | route | utility route, low refs | Medium | Confirm educational scope relevance. |
| `app/vpr/**` trees | route cluster | many low-ref pages; likely direct-link educational pages | High | Do not remove in bulk; require product decision first. |
| `app/bio30/**` routes | route cluster | low refs, but likely external/deep-link use | High | Keep until traffic/owner confirms deprecation. |

## Quick findings
- Hard low-risk candidates are mostly **demo-named files**, not core franchize pages.
- Many low-ref routes are likely deep-link content hubs; deleting them blindly is risky.
- Biggest safe win next is a **usage-verified demo cleanup** and route archival plan, not mass deletion.

## Suggested next cut plan
1. Build import graph for `demo` candidates (safe/unsafe buckets).
2. Add an explicit `/app-archive` or `feature flag` strategy for lab/test routes.
3. Track route hits for 7-14 days (middleware/server logs) before deleting low-ref routes.
4. Execute deletions in small PR slices (2-5 files each) with rollback-friendly commits.

## Estimated impact
- **Repo size/readability:** moderate gain from removing demo/lab files and stale docs.
- **Bundle size/runtime:** low-to-moderate unless removed files are imported in shipped routes.
- **DX/agent speed:** moderate gain (less search noise, faster context scans).
