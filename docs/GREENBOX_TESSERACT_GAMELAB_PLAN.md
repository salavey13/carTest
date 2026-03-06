# GREENBOX × PROJECT TESSERACT — AI GAMELAB EXECUTION PLAN

Status: `active`
Owners: `alice + codex + operators`
Mode: `collaborative / scenario-driven / hardware-sim-first`

---

## 0) Why this exists

This plan turns greenhouse automation development into a **game-like production loop**:

- we design UX/UI + automation flows first,
- we run them on simulated "slow realtime" data,
- players/operators submit gameplay feedback,
- Alice + Codex update scenarios, UI, and logic together.

Core idea: build a **multi-tenant Greenbox runtime** now, connect real hardware later without rewriting product UX.

---

## 1) Product framing (new era narrative)

### 1.1 Story arc inside current app
1. `/` — mission control + high-level health of all Greenboxes.
2. `/nexus` — architecture map: sensors, controllers, alert channels, automation policies.
3. `/repo-xml` — execution lab: prompt packs, scenario scripts, patches, PR cycle.

This keeps existing product progression intact: **entry -> framing -> execution**.

### 1.2 New domain concept
- **Greenbox** = one logical growing unit (greenhouse zone, rack, or Tesseract cube).
- **Crew** = tenant/operator team managing one or more Greenboxes.
- **Scenario** = game level with controlled conditions and expected outcomes.
- **Run** = one executed simulation session with score + incident log.

---

## 2) IA blueprint (pages to build)

## 2.1 Operator-facing pages
- `/greenbox` — portfolio dashboard (all crews/boxes overview).
- `/greenbox/[slug]` — crew mission control (live cards + current phase).
- `/greenbox/[slug]/map` — topology of cubes/zones and dependency graph.
- `/greenbox/[slug]/alerts` — incident feed, ack workflow, escalation timers.
- `/greenbox/[slug]/automation` — rules editor (if/then + safety windows).
- `/greenbox/[slug]/scenarios` — playable scenario list (levels).
- `/greenbox/[slug]/scenarios/[id]` — scenario run console + playback timeline.
- `/greenbox/[slug]/academy` — info pages for dummies (hardware, sensors, terms).
- `/greenbox/[slug]/academy/glossary` — simple dictionary (pH, EC, runoff, VPD, etc).
- `/greenbox/[slug]/academy/wiring` — beginner wiring diagrams and safe checklists.
- `/greenbox/[slug]/settings` — crew metadata, simulator presets, notification channels.

## 2.2 Simulation/test pages
- `/greenbox/[slug]/simulator` — control panel to inject lag, packet loss, drift, and noise.
- `/greenbox/[slug]/replay/[runId]` — deterministic replay of a completed run.
- `/greenbox/[slug]/scoreboard` — team score, stability KPI, incident response score.

## 2.3 Collaboration pages
- `/greenbox/[slug]/playbook` — SOP steps, shift handoff, ownership matrix.
- `/greenbox/[slug]/changelog` — operator-visible change log from scenario updates.

---

## 3) "For dummies" academy content (phase-1 mandatory)

Each academy article must be short, visual, and actionable:

1. **What is simulated vs real**
   - simulated stats: pH/EC/temp/humidity/water-level/light/CO2/battery/network health.
   - non-simulated: physical relay switching, real sensor calibration, electrical safety.
2. **How decisions are made**
   - threshold model,
   - hysteresis/cooldown,
   - safety caps per hour/day.
3. **Why alerts happen**
   - examples with plain-language "cause -> risk -> action" cards.
4. **How to test safely**
   - sandbox mode first,
   - two-step confirm for risky actions,
   - rollback button.

---

## 4) Scenario gameplay model

## 4.1 Scenario schema (single source of truth)
`docs/greenbox-scenarios.md` should contain:
- `scenario_id`
- `difficulty` (`tutorial`, `normal`, `hard`, `nightmare`)
- `objective`
- `initial_state`
- `events_timeline`
- `expected_operator_actions`
- `score_rules`
- `failure_conditions`
- `notes_from_players`

## 4.2 Example level types
- Level 1: Sensor drift (pH offset creeping slowly).
- Level 2: Pump underperforming (EC never reaches target).
- Level 3: Ventilation lag + humidity spike.
- Level 4: Network jitter/out-of-order telemetry.
- Level 5: Multi-box contention (shared nutrient tank).

## 4.3 Scoring
- Stability score (time in safe range).
- Response score (alert ack + resolution speed).
- Efficiency score (minimal over-dosing/over-switching).
- Safety score (no forbidden command combinations).

---

## 5) Multi-tenant crew/franchize model for Greenbox

Reuse franchize-style slug architecture:
- each crew has metadata profile,
- same page set, different theme/config/data,
- simulator and automation presets stored per crew.

Suggested metadata blocks:
- `branding`
- `simulatorPreset`
- `alertPolicy`
- `automationPolicy`
- `hardwareProfile` (planned wiring/controller map)
- `academyProgress`

---

## 6) Implementation pipeline (Alice + Codex board)

> Rule: execute sequentially, update status in this same file.

### G0 — Plan bootstrap + ownership model
- status: `done`
- owner: `codex`
- notes: Created initial gamelab architecture + page map + scenario model.
- next_step: Start G1.

### G1 — Academy MVP (for dummies)
- status: `todo`
- owner: `alice+codex`
- notes: Create beginner pages for sensors, actuator basics, and simulator boundaries.
- next_step: Draft article templates + glossary cards.

### G2 — Scenario registry + run logger
- status: `todo`
- owner: `alice+codex`
- notes: Add scenario source file and run result format.
- next_step: Implement first 5 scenario levels.

### G3 — Simulator control surface
- status: `todo`
- owner: `alice+codex`
- notes: Build UI to inject lag/noise/drift and replay outcomes.
- next_step: Add deterministic seed + timeline controls.

### G4 — Alert gameplay loop
- status: `todo`
- owner: `alice+codex`
- notes: Add alert inbox, ack flow, and action recommendations.
- next_step: Define alert severity matrix.

### G5 — Crew metadata + tenant skinning
- status: `todo`
- owner: `alice+codex`
- notes: Apply per-crew settings for simulator profile and UX skin.
- next_step: Add metadata editor section and fallback defaults.

### G6 — Hardware bridge preparation (no real switching yet)
- status: `todo`
- owner: `alice+codex`
- notes: Design adapter interface for ESP32/Arduino ingestion and command queue.
- next_step: Finalize API contract and queue safety constraints.

---

## 7) Collaboration protocol

- Alice and Codex both update this file directly.
- Every meaningful step updates:
  - `status`,
  - `owner`,
  - `notes`,
  - `next_step`.
- After each merged change, append a dated diary note.
- Keep tasks small and mergeable in <= 1 PR where possible.

### 7.1 RU-first communication mode (mandatory for Greenbox tasks)

When task context includes `greenbox`, `green box`, `tesseract`, `теплица`, `гидропоника`, or related variants:

- Default operator-facing copy to **Russian** (`ru`) in issues, docs, PR notes, UI hints, and scenario descriptions.
- Keep technical terms bilingual only when needed: `pH`, `EC`, `VPD`, `runoff`, but explain them in plain Russian nearby.
- For beginner docs (`academy/*`), use short Russian sentences first, and avoid long English-only blocks.
- For mixed-team collaboration, allow an optional EN appendix, but primary version remains RU-first.
- In gameplay/scenario feedback forms, label fields in Russian first so non-engineering teammates can respond quickly.

---

## 8) Diary (execution log)

### 2026-03-06
- Bootstrapped GREENBOX/TESSERACT gamelab plan.
- Locked simulator-first strategy to de-risk hardware in early phases.
- Added academy-first requirement so non-hardware operators can onboard quickly.
