# VIP-BIKE + GREENBOX — Client onboarding brief (parallel-ready)

Status date: 2026-03-20
Audience: potential partner/client + new contributors joining in parallel.

## 1) What already works today (VIP-BIKE / franchize)

### Storefront runtime
- Slug-based public storefront: `/franchize/[slug]` with catalog, cart, order, about, contacts, rentals, admin scopes.
- Metadata-first branding (crew-specific theme, menu links, promos, payment options).
- Mobile-first interaction model with floating cart + catalog modal flow.

### Operator controls
- `/franchize/create` no-code style editor for branding/theme/content slices.
- Crew-aware admin surfaces for inventory/rental operations.
- Order notification pipeline with fallback template strategy and retry log path (`franchize_order_notifications`).

### Reliability work already landed
- Security boundaries and server-only privileged paths were hardened in prior sweeps.
- Cart persistence moved to checkpoint/queue style to reduce mobile-lag losses.
- SPA navigation reliability improved across franchize shell.

## 2) What is planned next (VIP-BIKE / franchize)

### Contract-first blocker (must go first)
- **FRZ-R1** (`franchize.integration`): freeze metadata + fallback contract.

### Parallel lanes (after FRZ-R1)
- **FRZ-R2** (`franchize.telegram`): checkout callback parity with Telegram bridge.
- **FRZ-R3** (`franchize.analytics`): operator integration widgets in `/nexus`.

Why this matters for client onboarding:
- predictable contract -> safer partner customization;
- parallel lanes -> faster iteration with fewer merge conflicts;
- analytics visibility -> easier confidence during pilot launch.

## 3) What already works today (GREENBOX)

### Present baseline
- Dedicated domain surface under `/greenbox` with plugin-first narrative.
- Existing DB foundations include plants + irrigation queue migrations.
- Fake-door UX and scenario framing already make demos understandable for non-technical users.

### Current gaps (known and planned)
- No strict runtime manifest validator yet.
- Simulator persistence ordering requires stronger race-condition protection.
- Franchize x Greenbox shared inventory bridge still conceptual.

## 4) Greenbox next roadmap (parallel-ready)

### Contract-first blocker
- **GBX-R7** (`greenbox.platform`): plugin manifest validator + contract guards.

### Parallel lanes (after GBX-R7)
- **GBX-R8** (`greenbox.simulator`): ordered write queue + replay guard.
- **GBX-R9** (`greenbox.franchize`): shared inventory bridge draft with franchize model.

## 5) Parallel collaboration model for new contributors

1. Start from blocker task only.
2. Once blocker is done, assign parallel lanes by different capability.
3. Keep each lane mapped to different file hotspots.
4. Merge small PRs frequently; avoid cross-lane refactors until sync checkpoint.

## 6) Why this is exciting for a new client

- You get a live product now (not just concept slides).
- You see clear near-term roadmap with measurable integration milestones.
- Your team can join immediately and work in parallel without architecture chaos.
- VIP-BIKE gives monetizable storefront path; Greenbox gives expandable simulation/game layer for retention and differentiation.

## 7) Fresh SupaPlan tasks for immediate parallel execution

### Franchize
- `941503e4-9092-4d1f-bc93-3bf3147dbd69` — FRZ-R4 onboarding checklist page.
- `913e8a73-46f6-4c22-8278-c1b5aabe661e` — FRZ-R5 KPI scoreboard.

### Greenbox
- `68db3501-debc-4b7f-8ef1-295d455bf958` — GBX-R10 demo scenario pack.
- `a4d7a5aa-c820-4002-88c1-fedcdc463ce0` — GBX-R11 storytelling cards.

These can be executed by separate contributors once contract blockers (FRZ-R1 and GBX-R7) are finished.

