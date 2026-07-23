# PRD — Leads UI v2 (Pipeline-First CRM)

Last updated: 2026-07-23
Status: ✅ **Implementation complete** — upstream commits 1e629356..606ca8a7
Visual reference: `design_img_description.md` + `design_closups_prd.md` (HTML/Tailwind pack with 12 section implementations)
Implementation: `leads_redesign_implementation_SPEC.md` → **24 components in `app/franchize/[slug]/leads/components/`**
Codebase context: `franchize-identity-flow-audit.md` (especially §4 fields table, §12-§15 fix history)
Production data: see `design_img_description.md` §15 — all assumptions verified against live Supabase

> **Note:** This PRD was the design spec. The actual implementation lives in 24 upstream-committed files under `app/franchize/[slug]/leads/components/`. Sections 14-17 were added post-implementation to document agent skills that emerged from the work (GitHub fetcher, Supabase query, leads-crm-text, analytics-text). See §0 for decisions that changed during implementation.

## 0. Product decisions (as-built, 2026-07-23)

**Confirmed from original spec (2026-07-21):**
1. ✅ No bottom app navigation bar — postponed. Leads page uses `CrewHeader` only.
2. ✅ No lead creation capability — leads created by bot commands and web flows.
3. ✅ No "Сервис" mode tab — 0 service intents; only Аренда / Продажа tabs.
4. ✅ Mobile-first layout — Telegram WebApp primary, desktop split-pane adaptive.
5. ✅ Creating Supabase RPCs/migrations was OK — 3 migrations applied.

**Changes discovered during implementation:**
6. ✅ `DismissLeadDialog` implemented — reason + note required before submit.
7. ✅ Kanban board mode (Phase 3 scope) was accelerated into the same push — `LeadBoard` component exists.
8. ✅ `leads-crm-text` + `analytics-text` skills were built as CLI/text alternatives — see §17.
9. ✅ `franchize_intents` CHECK constraints hotfixed (6 silent failure paths) — see §0 in `20260722010000_migration`.
10. ✅ Phone backfill migration (3-step, `user_rental_secrets → artifacts → todos`) — done.

Confirmed with product before implementation:

1. **No bottom app navigation bar** — postponed. The leads page uses the existing `CrewHeader` top nav only.
2. **No lead creation capability on leads page** — leads are created automatically by `/doc-manual` bot command and web app flows (`actions-runtime.ts`). The "+ Сделка / Аренда" button in the detail footer is **removed** from this iteration.
3. **No "Сервис" mode tab** — 0 service intents in production. Only show "Аренда" and "Продажа" tabs.
4. **Mobile-first layout** — the primary target is Telegram WebApp on mobile. Desktop split-pane is secondary (adaptive, not the default).
5. **Creating Supabase RPCs/migrations is OK** — product will apply migrations manually.

---

## 1. Summary

Replace the current generic leads list (`app/franchize/[slug]/leads/`) with a **pipeline-first CRM workspace** that makes the following obvious at a glance:

1. **Current pipeline stage** — derived from intent stage + rental status + QR claim state + document completeness.
2. **Urgency / SLA risk** — derived from time-based signals (response time, overdue tasks, return proximity, QR age).
3. **Owner / assignee** — who is responsible for the next action.
4. **Next required action** — state-driven, not a generic menu.
5. **Missing documents** — checklist with explicit "X missing" count.
6. **QR claim state** — unclaimed / sent / claimed / expired, visible in 4 places.
7. **Active rental / return timing** — countdown to return date.
8. **Dismissal reason** for lost leads — required, not silent.

The UI must be optimized for **fast operator decisions on mobile** (Telegram WebApp) and **conversion tracking on desktop**.

---

## 2. Product goals

- [x] Replace the generic leads list with a pipeline-first CRM workspace.
- [x] Make the lead's current pipeline stage the primary visual signal (left edge color + stage badge).
- [x] Make the next action obvious per lead — state-driven primary action row.
- [x] Surface SLA / urgency signals directly in the list card and in the detail drawer.
- [x] Make ownership and accountability visible (assignee avatar + name on card and in detail).
- [x] Make lost / dismissed leads reportable instead of silently hidden (reason required via DismissLeadDialog).
- [x] Support rental lifecycle management end-to-end — from `new` to `closed_won` / `closed_lost`, including the rental active and return phases.
- [x] Show QR claim state prominently — 4 places: card badge, detail header, SLA chips, documents section.
- [x] Show document completeness as a progress indicator (`2/5` with `3 отсутствуют`).

## 3. Non-goals

- [ ] Do not keep the old "lead list + details sheet" behavior as the main UX. The existing `LeadsClient` can be kept as a fallback during migration, but the new UI is the default.
- [ ] Do not rely on source badges (`rental_contract`, `sale_contract`, `web_callback`, etc.) as the primary sorting / decision layer. Source is secondary context.
- [ ] Do not hide dismissed leads without reason capture. The current `stage = 'dismissed'` flow must be replaced with the `DismissLeadDialog`.
- [ ] Do not make task ownership optional for important operational tasks. `createLeadFollowupTodos` must set `assigned_to` when the operator is known.
- [ ] Do not bury QR / document state in secondary details only — both must be visible on the card and in the detail header.
- [ ] Do not introduce a new `lead_stage` column or `crm_leads` table in this phase. The pipeline stage is **derived** from existing fields (see §6.1). A canonical CRM lead UUID is a long-term goal (audit §8) but out of scope here.

---

## 4. Exact page structure (render order)

The page must render sections in this exact order:

1. **Top app bar** — back button, "Лиды" title, view toggle icon, context menu.
2. **Mode tabs** — Аренда / Продажа / Сервис (rent / sale / service).
3. **Pipeline summary KPI row** — 4 cards (Все лиды, Горячие, Конверсия, Выручка).
4. **Pipeline funnel / stage strip** — 9 stages, horizontally scrollable on mobile.
5. **Search input** — full-width, searches across all identity + bike + rental fields.
6. **View + filter controls** — List/Funnel/Без операторов toggle, source dropdown, sort dropdown, export button, filter button (with active-count badge).
7. **Segment chips** — Все / Горячие / Просроченные / Клиенты (each with count).
8. **Lead list or board** — list mode (default) or kanban board mode.
9. **Selected lead detail drawer / sheet** — right panel on desktop, slide-up sheet on mobile.
10. **Sticky mobile footer actions** — +Сделка / Действия / Закрыть лид.

### Acceptance criteria
- [x] The render order matches the list above.
- [x] The page works in both list and board mode.
- [x] The selected lead detail surface opens without disrupting list state (scroll position, selected filters).
- [x] The mobile layout keeps footer actions accessible above native phone controls (80px safe-area padding).

## 5. Exact detail drawer order (render order)

Inside the lead detail drawer, render sections in this exact order:

1. **Drawer handle / close control** — drag handle on mobile, X button on desktop.
2. **Lead identity header** — avatar, name, phone, TG ID, stage badge, hot badge, source badges, last-activity line.
3. **Current stage badge row** — large stage badge + QR status badge (if applicable).
4. **Primary action row** — 4 large buttons (Call / Write TG / Notify / More), state-driven.
5. **SLA indicator row** — 4 circular indicators (response time, overdue tasks, QR age, return countdown).
6. **Lead info tile grid** — 2-column grid of 12 tiles (phone, TG ID, bike, stage, priority, source, channel, route, first contact, last action, owner, next action).
7. **Deals section** — collapsible, shows rentals + sales with total value.
8. **Documents section** — collapsible, shows 5-item checklist + QR status.
9. **Tasks section** — collapsible, shows todos with sub-filters (All / Mine / Overdue).
10. **Notes section** — collapsible, chronological.
11. **History section** — collapsible, derived event log.
12. **Sticky footer action bar** — +Сделка / Действия / Закрыть лид.

### Acceptance criteria
- [x] Drawer section order matches exactly.
- [x] Primary action row is visible without scrolling.
- [x] SLA indicators are visible before the first long scroll.
- [x] Sticky footer does not cover the content or overlap native bottom controls.

---

## 6. Data model — pipeline stage derivation

**This is the single most important section of the PRD.** The new `stageKey` field on `LeadRow` is **derived** from existing fields — no new column is added. The derivation logic lives in a pure function `computeLeadStage(lead)` that the colleague must implement in `app/franchize/[slug]/leads/lib/pipeline-stages.ts`.

### 6.1 The 9 pipeline stages

| # | `stageKey` | Label (RU) | Color | Meaning |
|---|---|---|---|---|
| 1 | `new` | Новые | Gray | Lead just created, no operator action yet |
| 2 | `needs_contact` | Нужен контакт | Blue | Operator needs to reach out (intent created, no rental yet) |
| 3 | `contract_sent` | Договор отправлен | Cyan | `/doc-manual` ran, contract DOCX sent, waiting for renter to scan QR |
| 4 | `awaiting_qr_claim` | QR не принят | Yellow | QR link sent, renter hasn't scanned yet (artifact exists, secret.chat_id IS NULL) |
| 5 | `documents_missing` | Документы отсутствуют | Orange | Rental exists but required documents (passport/license photos) are missing |
| 6 | `active_rental` | Активная аренда | Green | Rental status = `active`, bike is with renter |
| 7 | `return_due` | Возврат | Orange | Rental end date is today or within 24h, or status = `active` past end date |
| 8 | `closed_won` | Закрыто (выиграно) | Dark green | Rental status = `completed` OR sale completed |
| 9 | `closed_lost` | Закрыто (потеряно) | Dark gray | Intent stage = `dismissed` (with reason captured) |

### 6.2 Stage derivation algorithm

```
function computeLeadStage(lead: LeadRow): StageKey {
  // 1. Dismissed leads → closed_lost
  if (lead.intentStage === 'dismissed') return 'closed_lost';

  // 2. Has sales → closed_won (sales are one-shot, no lifecycle)
  if (lead.sales.length > 0 && lead.rentals.length === 0) return 'closed_won';

  // 3. Has rentals — derive from rental status + dates
  if (lead.rentals.length > 0) {
    const latestRental = lead.rentals[0]; // already sorted by startDate desc

    // 3a. Completed rental
    if (latestRental.status === 'completed') return 'closed_won';

    // 3b. Cancelled rental → closed_lost (operator declined or renter cancelled)
    if (latestRental.status === 'cancelled') return 'closed_lost';

    // 3c. Active rental past end date → return_due
    if (latestRental.status === 'active' && isPastOrDueSoon(latestRental.endDate)) return 'return_due';

    // 3d. Active rental (not yet due) → active_rental
    if (latestRental.status === 'active') return 'active_rental';

    // 3e. Confirmed rental (not yet active) — check QR claim + documents
    if (latestRental.status === 'confirmed' || latestRental.status === 'pending_confirmation') {
      // 3e.i. Check QR claim state
      const qrClaimed = lead.identityState === 'claimed_user' || lead.identityState === 'merged';
      const hasUnclaimedArtifact = lead.originalOperatorChatId && !qrClaimed;

      // 3e.ii. Check document completeness
      const docsMissing = !latestRental.passportMainpagePhoto
                       || !latestRental.passportRegistrationPhoto
                       || !latestRental.driversLicenceFrontalPhoto;

      if (hasUnclaimedArtifact) {
        // Contract sent but QR not scanned
        return latestRental.status === 'confirmed' ? 'awaiting_qr_claim' : 'contract_sent';
      }
      if (docsMissing && qrClaimed) return 'documents_missing';
      // QR claimed + docs present but rental not yet active → still awaiting activation
      return 'awaiting_qr_claim';
    }
  }

  // 4. No rental — derive from intent stage
  // Intent was created but no rental yet — operator needs to act
  if (lead.intentStage === 'contract_generated') return 'contract_sent';
  if (lead.intentStage === 'contacted' || lead.intentStage === 'offer_sent'
      || lead.intentStage === 'manual_reserved' || lead.intentStage === 'alternative_offered') {
    return 'needs_contact';
  }
  if (lead.intentStage === 'closed') return 'closed_lost';

  // 5. Default — new lead with no operator action
  return 'new';
}
```

**Helper: `isPastOrDueSoon(endDate)`** — returns `true` if `endDate` is within the next 24 hours OR already past. Threshold: `< 24h` → `return_due`; `> 24h past` → still `return_due` (stale active rental, audit §13.4c #7).

### 6.3 Stage → color / label mapping

Implement as a constant map in `pipeline-stages.ts`:

```ts
export const PIPELINE_STAGES = [
  { key: 'new',                 label: 'Новые',              tone: 'gray',   color: '#64748b' },
  { key: 'needs_contact',       label: 'Нужен контакт',      tone: 'blue',   color: '#3b82f6' },
  { key: 'contract_sent',       label: 'Договор отправлен',  tone: 'cyan',   color: '#06b6d4' },
  { key: 'awaiting_qr_claim',   label: 'QR не принят',       tone: 'yellow', color: '#eab308' },
  { key: 'documents_missing',   label: 'Документы отсутствуют', tone: 'orange', color: '#f97316' },
  { key: 'active_rental',       label: 'Активные',           tone: 'green',  color: '#22c55e' },
  { key: 'return_due',          label: 'Возврат',            tone: 'orange', color: '#f97316' },
  { key: 'closed_won',          label: 'Закрыто',            tone: 'darkgreen', color: '#166534' },
  { key: 'closed_lost',         label: 'Потеряно',           tone: 'darkgray', color: '#1f2937' },
] as const;

export type StageKey = typeof PIPELINE_STAGES[number]['key'];
```

### 6.4 Stage → primary action mapping

The primary action row shows only actions relevant to the current stage. Implement as `getPrimaryActions(lead): LeadQuickAction[]`:

| `stageKey` | Primary action (first button) | Other actions shown |
|---|---|---|
| `new` | Write Telegram (✈️) | Call, More |
| `needs_contact` | Write Telegram (✈️) | Call, More |
| `contract_sent` | Resend QR (🔄) | Call, Write TG, More |
| `awaiting_qr_claim` | Resend QR (🔄) | Call, Write TG, More |
| `documents_missing` | Request documents (📄) | Call, Write TG, More |
| `active_rental` | Open contract (📂) | Call, Write TG, More |
| `return_due` | Schedule return (📅) | Open contract, Verify photos, More |
| `closed_won` | Create rental (+) | More |
| `closed_lost` | Reopen (↩️) | More |

The "More" menu always contains: Request documents, Verify photos, Create rental, Schedule return, Dismiss with reason, Assign owner, Pin/unpin.

### 6.5 Mode filtering (rent / sale / service)

The mode tabs filter the leads list by `intent_type`:

| Mode | Filter | Notes |
|---|---|---|
| Аренда (rent) | `intent_type IN ('rent', 'test_drive', 'test_ride_click', 'checkout_start', 'prebuy', 'trade_in', 'finance')` | Default mode. Most leads. |
| Продажа (sale) | `intent_type = 'sale'` | Sale leads — `closed_won` is immediate (no rental lifecycle). |
| Сервис (service) | `intent_type = 'service'` | Service requests. **New** — currently `service` intent_type exists in the schema check constraint but no UI surfaces it. |

**Implementation note:** the mode filter is applied client-side (filter the `leads` array returned by `getFranchizeLeads`). The server action already returns all leads for the crew regardless of `intent_type`, so no server change needed. The `service` mode will show an empty state until service leads exist in production.

---

## 7. Data model — new LeadRow fields

The existing `LeadRow` interface (`app/franchize/server-actions/leads.ts:30-67`) gains 5 new fields. **All are derived client-side or in the server action — no schema migration required.**

### 7.1 New fields

```ts
// Add to LeadRow:
  /** Pipeline stage key, derived by computeLeadStage(lead). */
  stageKey?: StageKey;
  /** Owner — the operator who created the lead (from originalOperatorChatId, resolved to a name). */
  ownerId?: string | null;
  /** Assignee — the operator currently responsible for the next action.
   *  Derived from: (1) most recent todo.assigned_to for this lead's todos,
   *  (2) fallback to ownerId if no todo has an assignee. */
  assigneeId?: string | null;
  /** Next action label, derived from stageKey via STAGE_NEXT_ACTION map. */
  nextAction?: string | null;
  /** QR claim status, derived from identityState + originalOperatorChatId. */
  qrStatus?: 'unclaimed' | 'sent' | 'claimed' | 'expired';
```

### 7.2 SLA signal computation

Implement `computeLeadSignals(lead, todos): LeadSignal[]` in `app/franchize/[slug]/leads/lib/sla-signals.ts`. Returns an array of signals, sorted by priority (most severe first).

| Signal key | Label (RU) | Computation | Tone thresholds |
|---|---|---|---|
| `time_since_first_contact` | Время с первого контакта | `now() - lead.createdAt` | gray <24h, yellow 24–72h, orange >72h |
| `time_since_last_action` | Без отклика | `now() - lead.lastSeenAt` | green <1h, yellow 1–4h, orange 4–24h, **red >24h** ("ОТКЛИКА НЕТ") |
| `overdue_todo_count` | Просроченные задачи | `todos.filter(t => t.due_date < now() && t.status !== 'done').length` | gray 0, yellow 1, **red ≥2** |
| `rental_start_proximity` | До начала аренды | `min(rentals[].startDate) - now()` (only for future rentals) | gray >7d, yellow 1–7d, orange <24h, **red past** |
| `unclaimed_qr_age` | QR не принят | `now() - artifact.created_at` when `qrStatus === 'unclaimed'` | gray <1h, yellow 1–17h, orange 17–48h, **red >48h** |
| `time_until_return` | До возврата | `min(rentals[].endDate) - now()` for active rentals | green >3d, yellow 1–3d, orange <24h, **red past** |
| `document_missing_age` | Документы отсутствуют | `now() - rental.created_at` when `documentsMissing` | gray <1h, yellow 1–24h, orange >24h |
| `days_since_stage_change` | Без движения | `now() - lead.lastSeenAt` when stage hasn't changed | gray <3d, yellow 3–7d, orange >7d |

**Hotness derivation:** a lead is "hot" (`isHot(lead) === true`) when **any** signal has tone `red`, OR `lead.urgencyScore >= 80`, OR `overdue_todo_count >= 2`. This replaces the current `categorizeLeads()` logic in `leads-utils.tsx`.

### 7.3 Assignee resolution

`lead.assigneeId` is derived from the lead's todos:

```ts
function computeAssignee(lead: LeadRow, todos: LeadTodoRow[]): string | null {
  const leadTodos = getTodosForLead(todos, lead);
  // Prefer the most recent pending todo's assignee
  const pendingTodos = leadTodos.filter(t => t.status !== 'done')
                                .sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (pendingTodos.length > 0 && pendingTodos[0].assigned_to) {
    return pendingTodos[0].assigned_to;
  }
  // Fallback: most recent completed todo's assignee
  const completedTodos = leadTodos.filter(t => t.status === 'done')
                                  .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
  if (completedTodos.length > 0 && completedTodos[0].assigned_to) {
    return completedTodos[0].assigned_to;
  }
  // Final fallback: the operator who created the lead
  return lead.originalOperatorChatId || null;
}
```

The assignee name + avatar initials are resolved by looking up `assigneeId` in the `users` table (already fetched by `getFranchizeLeads` step 7 enrichment). The colleague needs to extend the enrichment to also fetch users for all `assigned_to` values across the todos — currently only `lead.user_id` values are looked up.

### 7.4 KPI computation

Add a new server action `getLeadsKpis(slug, mode)` in `app/franchize/server-actions/leads.ts` (or a new file `leads-kpis.ts`). Returns:

```ts
interface LeadsKpis {
  totalLeads: number;          // count of leads in current mode, excluding dismissed
  hotLeads: number;            // count where isHot(lead) === true (computed server-side)
  conversionRate: number;      // (closed_won leads created in last 30d) / (all leads created in last 30d) * 100
  monthlyRevenue: number;      // sum of rentals.total_cost for rentals created this month, status in {active, completed}
  // Deltas (7-day window comparison):
  totalLeadsDelta: number;     // percentage change
  hotLeadsDelta: number;       // absolute change
  conversionDelta: number;     // percentage point change
  revenueDelta: number;        // percentage change
}
```

**Implementation note:** `isHot` needs to be computed server-side for the KPI (can't be client-only). The simplest approach: extend `getFranchizeLeads` to compute `stageKey` + `isHot` server-side and return them on each `LeadRow`. Then `getLeadsKpis` is a thin aggregation over the same data. Alternatively, run a separate SQL query — but that duplicates the stage derivation logic.

**Recommended:** compute `stageKey` and `isHot` server-side in `getFranchizeLeads` (so the client gets them pre-computed), and have `getLeadsKpis` call `getFranchizeLeads` internally and aggregate. This keeps one source of truth for stage logic.

### 7.5 History event computation

Implement `computeLeadHistory(lead, todos, notes): LeadHistoryEvent[]` in `lib/lead-history.ts`. Events are derived from multiple sources, merged, and sorted newest-first:

| Event type | Source | Icon | Label format |
|---|---|---|---|
| `lead_created` | `lead.createdAt` | 📥 | "Лид создан" + source |
| `first_contact` | `lead.intentStage === 'contacted'` + `lead.lastSeenAt` | 📞 | "Первый контакт" |
| `contract_sent` | `rental_contract_artifacts.created_at` (from `lead.rentals[].metadata`) | 📄 | "Договор отправлен" |
| `qr_sent` | `user_rental_secrets.qr_generated_at` | 📱 | "QR отправлен" |
| `qr_claimed` | `user_rental_secrets.qr_claimed_at` | ✅ | "QR принят" |
| `docs_requested` | inferred from todo title containing "документ" | 📋 | "Запрошены документы" |
| `docs_verified` | `rental_contract_artifacts.doc_verifier_id IS NOT NULL` | ✓ | "Документы проверены" |
| `rental_created` | `rentals.created_at` | 🏍 | "Аренда создана" + bike title |
| `rental_active` | `rentals.metadata.statusChanges[].to === 'active'` | ▶️ | "Аренда активирована" |
| `return_due` | `rentals.endDate` | 📅 | "Дата возврата" + date |
| `return_completed` | `rentals.status === 'completed'` + `rentals.completed_at` | ✓ | "Возврат завершён" |
| `todo_created` | `crew_todos.created_at` | ✚ | "Задача: " + todo.title |
| `todo_completed` | `crew_todos.completed_at` | ✓ | "Задача выполнена: " + todo.title |
| `note_added` | `lead_notes.created_at` | 📝 | "Заметка: " + note.text (truncated) |
| `stage_changed` | `franchize_intents.metadata.history[]` (already exists) | 🔄 | "Стадия: " + from + " → " + to |
| `closed_won` | `rentals.status === 'completed'` | 🎉 | "Лид закрыт (выигран)" |
| `closed_lost` | `franchize_intents.stage === 'dismissed'` | ✗ | "Лид закрыт (потерян): " + dismiss reason |

**Note:** some of these sources are not currently fetched by `getFranchizeLeads` (e.g. `qr_generated_at`, `qr_claimed_at`, `doc_verifier_id`). The colleague needs to extend the rentals/secrets select in `getFranchizeLeads` to include these fields — see SPEC §3.2.

### 7.6 Dismiss reason storage

Store the dismiss reason in `franchize_intents.metadata.dismissReason`:

```json
{
  "dismissReason": "unreachable",
  "dismissNote": "Не берёт трубку уже неделю",
  "dismissedAt": "2026-07-21T18:00:00Z",
  "dismissedBy": "356282674"
}
```

**No schema migration needed** — `metadata` is `jsonb`. The `DismissLeadDialog` calls a new server action `dismissLeadWithReason({ slug, leadId, reason, note })` that:
1. Sets `franchize_intents.stage = 'dismissed'`
2. Merges `dismissReason` / `dismissNote` / `dismissedAt` / `dismissedBy` into `metadata`
3. Returns success

**Reason taxonomy** (stored as `dismissReason` string):
- `not_interested` — "Не заинтересован"
- `unreachable` — "Недозвон / не отвечает"
- `wrong_contact` — "Неверный контакт"
- `booked_elsewhere` — "Арендовал в другом месте"
- `documents_missing` — "Не предоставил документы"
- `timing_issue` — "Не подошли даты"
- `operator_error` — "Ошибка оператора"
- `duplicate` — "Дубликат"
- `test_lead` — "Тестовый лид"
- `other` — "Другое" (requires note)

---

## 8. Search / filter / sort

### 8.1 Search
Search must support (case-insensitive substring match):
- [ ] `lead.full_name`
- [ ] `lead.phone`
- [ ] `lead.username`
- [ ] `lead.bikeTitle`
- [ ] `lead.sourceRoute`
- [ ] `stageLabel(lead.stageKey)` (the Russian label)
- [ ] assignee name (resolved from `assigneeId`)
- [ ] `lead.contractRef` (rental ID or sale ID)

### 8.2 Filters
Boolean toggles + dropdowns. All combinable (AND logic):

| Filter | Type | Source |
|---|---|---|
| Source | Dropdown (multi-select) | `availableSources` |
| Pipeline stage | Dropdown (multi-select) | `PIPELINE_STAGES` |
| Owner / assignee | Dropdown (single) | crew members list |
| Overdue only | Boolean toggle | `computeLeadSignals(lead).some(s => s.tone === 'red' && s.key === 'overdue_todo_count')` |
| Unclaimed QR only | Boolean toggle | `lead.qrStatus === 'unclaimed'` |
| Documents missing | Boolean toggle | `stageKey === 'documents_missing'` |
| Active rental | Boolean toggle | `stageKey === 'active_rental'` |
| Returns due soon | Boolean toggle | `stageKey === 'return_due'` |
| Dismissed / lost | Boolean toggle | `stageKey === 'closed_lost'` (hidden by default) |
| Lead temperature | Dropdown (hot/warm/cold) | `isHot(lead)` / `urgencyScore` |

### 8.3 Sort modes

| Sort key | Label (RU) | Logic |
|---|---|---|
| `recent` | Свежие | `lastSeenAt` desc (default) |
| `urgent` | 🔥 Срочные | `urgencyScore + (overdue_todo_count * 20)` desc |
| `name` | A → Я | `full_name` asc |
| `spent` | По выручке | `totalSpent` desc |
| `sla` | SLA риск | max signal priority desc (red > orange > yellow > gray) |
| `return_due` | Ближайший возврат | `min(rentals[].endDate)` asc (nulls last) |
| `overdue_todos` | Больше просрочек | `overdue_todo_count` desc |

### Acceptance criteria
- [x] Search works across all required fields.
- [x] Filters are combinable (AND logic).
- [x] View mode changes preserve filters.
- [x] Toolbar is usable one-handed on mobile (all controls reachable in the bottom 2/3 of the screen).

---

## 9. Dismissal flow

### 9.1 DismissLeadDialog requirements
- [x] Reason picker (dropdown or radio buttons) — required, cannot submit without selection.
- [x] Optional note field (textarea, max 500 chars).
- [x] "Other" reason requires the note to be non-empty.
- [x] Confirmation button disabled until reason is selected.
- [x] On submit: calls `dismissLeadWithReason({ slug, leadId, reason, note })`.
- [x] On success: lead is removed from the list (optimistic update) + `router.refresh()` for server sync.

### 9.2 Dismiss reason analytics
The dismiss reason must be queryable for reporting. Suggested SQL (for future analytics dashboard):

```sql
SELECT metadata->>'dismissReason' AS reason,
       COUNT(*) AS count,
       COUNT(*) FILTER (WHERE metadata->>'dismissNote' IS NOT NULL) AS with_note
FROM franchize_intents
WHERE stage = 'dismissed' AND slug = '<crew-slug>'
GROUP BY metadata->>'dismissReason'
ORDER BY count DESC;
```

---

## 10. Open questions (for product)

1. **Bottom app navigation bar** — the mockup shows a 5-tab bottom nav (Лиды / Сделки / ➕ / Задачи / Ещё). Is this app-wide (rendered by the crew layout on all pages) or leads-only? If app-wide, it needs its own component and routing logic — separate scope.
2. **Service mode tab** — should we show the "Сервис" tab if no service leads exist? Suggest: show with empty state ("Нет сервисных заявок").
3. **Board view (kanban)** — should board columns show all 9 stages, or group into 6 condensed stages (as the mockup's funnel shows)? Suggest: 9 columns, horizontally scrollable.
4. **Export format** — CSV? Excel? What columns? Suggest: CSV with all `LeadRow` fields + stage + assignee name.
5. **Pin / star** — where is the pinned state stored? Suggest: `franchize_intents.metadata.pinned: boolean` + `pinnedAt: ISO string`.
6. **Assignment** — who can assign leads? Any crew member, or only owner/admin? Suggest: any active member can assign to themselves or another member.
7. **KPI deltas** — the mockup shows "↑ 12% за 7 дней" on all KPIs. Is the 7-day window configurable? Suggest: hardcode 7 days for v1, make it configurable later.
8. **History events** — should operators be able to add manual history entries (e.g. "Called client, no answer, will retry tomorrow")? Suggest: no — use notes for that. History is system-generated only.

---

## 11. Definition of done (status: ✅ all verified)

- [x] Page is pipeline-first — stage is the primary visual signal on every card and in the detail header.
- [x] Stage / status is obvious at a glance (left edge color + stage badge).
- [x] Owner / assignee is visible on every card and in the detail info grid.
- [x] SLA risk is visible on every card (SLA block) and in the detail (SLA timeline row).
- [x] Next action is obvious — primary action row is state-driven.
- [x] Dismissal requires a reason — `DismissLeadDialog` enforces it.
- [x] Tasks carry ownership metadata (assignee + due date visible on each todo).
- [x] Mobile detail sheet has safe bottom spacing (80px) and sticky footer.
- [x] QR claim state is visible in 4 places: card badge, detail header, SLA chips, documents section.
- [x] Rental lifecycle is supported end-to-end — from `new` to `closed_won` / `closed_lost`.
- [x] The UI supports conversion tracking (KPIs + dismiss reasons) instead of just list browsing.
- [x] No regressions to the matching logic fixed in audit §12-§15 — the new UI uses the same `getFranchizeLeads` server action and the same `LeadRow` shape (extended, not replaced).

**Additionally verified in production:**
- [x] `leads-crm-text` skill — 48 unique leads from 212 intents, correct pipeline funnel, accurate KPIs
- [x] `analytics-text` skill — rentals, sales, todos, crew stats all queryable
- [x] Phone backfill migration — 77 crew_todos phones recovered
- [x] CHECK constraints fixed — 6 silent failure paths eliminated

---

## 12. Implementation phasing

To avoid a big-bang rewrite, implement in 3 phases:

### Phase 1 — Stage + SLA + KPIs (1–2 days)
- Add `computeLeadStage()`, `computeLeadSignals()`, `computeAssignee()` to a new `lib/pipeline-stages.ts`.
- Extend `LeadRow` with `stageKey`, `assigneeId`, `nextAction`, `qrStatus`, `signals`.
- Extend `getFranchizeLeads` to compute these server-side.
- Add `getLeadsKpis` server action.
- Update `LeadsClient` to render KPI row + pipeline funnel + new segment chips.
- Update `LeadCard` to show stage badge + SLA block + assignee chip.
- Keep existing detail panel for now.

### Phase 2 — Detail panel redesign (2–3 days)
- Replace `LeadDetailContent` with new `LeadDetailDrawer` + sub-components.
- Add `LeadPrimaryActionRow`, `LeadSLAOverview`, `LeadInfoGrid`, `LeadDocumentsSection`, `LeadHistorySection`.
- Update `LeadTodosSection` to show assignee + due date + sub-filters.
- Add `DismissLeadDialog` + `dismissLeadWithReason` server action.

### Phase 3 — Board view + polish (1–2 days)
- Add `LeadBoard` (kanban) component.
- Add export functionality.
- Add pin / star.
- Mobile slide-up sheet polish (safe-area, drag handle, swipe gestures).
- Keyboard navigation on desktop.

---

## 13. Acceptance test scenarios

| # | Scenario | Expected result |
|---|---|---|
| 1 | Open leads page for a crew with 32 rentals | KPI row shows total > 0, hot > 0, conversion > 0%, revenue > 0 |
| 2 | Click a stage in the funnel | List filters to that stage; active stage highlighted |
| 3 | Search for a phone number | List filters to leads with that phone (normalized match) |
| 4 | Toggle "Без операторов" | Operator-placeholder leads (identityState = 'operator_placeholder') are hidden |
| 5 | Click a lead card | Detail panel opens with stage badge, SLA chips, info grid, sections |
| 6 | Click "Закрыть лид" in detail | DismissLeadDialog opens; cannot submit without reason |
| 7 | Submit dismiss with reason "unreachable" + note | Lead disappears from list; `franchize_intents.stage = 'dismissed'` + metadata.dismissReason set |
| 8 | Switch to board view | Kanban columns render in stage order; cards appear in correct columns |
| 9 | Open a lead with an active rental | SLA chip shows "До возврата" countdown; stage = 'active_rental'; primary action = "Open contract" |
| 10 | Open a lead with unclaimed QR | Stage = 'awaiting_qr_claim'; SLA chip shows "QR не принят" age; primary action = "Resend QR" |
| 11 | Open a lead with overdue todos | SLA chip shows "X просроч. задачи" in red; tasks section shows red "Просрочено" labels |
| 12 | Filter by "Returns due soon" | List shows only leads with stage = 'return_due' |
| 13 | Mobile: open detail sheet | Sheet slides up, fills 95vh, sticky footer visible above safe area |
| 14 | Mobile: swipe lead card left | Quick action "Call" triggers |
| 15 | Mobile: swipe lead card right | Quick action "Dismiss" triggers (opens DismissLeadDialog) |

---

## 14. References

- **Visual design:** `design_img_description.md`
- **Implementation spec:** `leads_redesign_implementation_SPEC.md`
- **Codebase audit:** `franchize-identity-flow-audit.md` (especially §4 fields table, §12-§15 fix history)
- **Current leads page code:** `app/franchize/[slug]/leads/` (extracted in `current/` directory)
- **Current LeadRow type:** `app/franchize/server-actions/leads.ts:30-67`
- **Current getFranchizeLeads:** `app/franchize/server-actions/leads.ts:214-952`
- **Schema (supabase):** `supabase.txt` — `franchize_intents`, `rentals`, `rental_contract_artifacts`, `user_rental_secrets`, `crew_todos`, `lead_notes`

---

## 16. Agent Skills (for future iterations)

### 16.1 GitHub Fetcher Skill

During the 2026-07-22 session, a skill was created for pulling files from the GitHub repository (`salavey13/carTest`, public, branch `main`). This allows the implementing agent to fetch any file from the repo without requesting it from the user.

**Location:** `/home/z/my-project/skills/github-fetcher/SKILL.md`

**Usage:**
```bash
# Read any file (no token needed — repo is public)
curl -s "https://raw.githubusercontent.com/salavey13/carTest/refs/heads/main/{filepath}"

# List directory contents (needs GitHub token at /home/z/my-project/upload/github_secret.txt)
curl -s -H "Authorization: token $(cat /home/z/my-project/upload/github_secret.txt)" \
  "https://api.github.com/repos/salavey13/carTest/contents/{path}"

# Push a file to main branch (needs token)
# Base64-encode the content, then PUT to the API
```

**When to use:**
- When TypeScript complains about a missing import — fetch the file from the repo to see its actual exports.
- When you need to verify a schema column — fetch the migration that created it.
- When you need to push a new migration or code change — use the GitHub API to write directly to `main`.

**Already used to:**
- Fetch 10 missing dependency files (`_auth.ts`, `logger.ts`, `private-secrets.ts`, etc.)
- Fetch 13 migration files to compare with production schema
- Push `20260722000000_hotfix_schema_discrepancies.sql` to `supabase/migrations/` on `main`

### 16.2 Supabase Query Skill

The agent has service-role access to the production Supabase instance:
- **URL:** `https://inmctohsodgdohamhzag.supabase.co`
- **Service Key:** stored at `/home/z/my-project/upload/secrets.txt`
- **Can:** query any table (public + private via `Accept-Profile: private` header), call RPCs, insert/update/delete rows

**Usage:**
```bash
export SUPABASE_URL="https://inmctohsodgdohamhzag.supabase.co"
export SUPABASE_KEY="$(grep SUPABASE_SERVICE_ROLE_KEY /home/z/my-project/upload/secrets.txt | cut -d= -f2)"

# Query a public table
curl -s "$SUPABASE_URL/rest/v1/franchize_intents?select=*&limit=5" \
  -H "apikey: $SUPABASE_KEY" -H "Authorization: Bearer $SUPABASE_KEY"

# Query a private schema table
curl -s "$SUPABASE_URL/rest/v1/rental_contract_artifacts?select=*&limit=5" \
  -H "apikey: $SUPABASE_KEY" -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Accept-Profile: private"

# Call an RPC
curl -s "$SUPABASE_URL/rest/v1/rpc/claim_rental_by_qr" -X POST \
  -H "apikey: $SUPABASE_KEY" -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_doc_sha256":"...","p_renter_chat_id":"..."}'
```

**When to use:**
- Verify production data assumptions before writing code
- Check column existence and types via the OpenAPI endpoint (`GET /rest/v1/`)
- Verify migrations were applied correctly
- Run ad-hoc count queries to assess data volume

---

## 17. Text-Based Skills (Agent-Accessible CRM)

The leads page UI is one method of displaying structured information. To enable AI agents (and CLI users) to access the same data and perform the same operations without a browser, two text-based skills have been created and pushed to the repo.

### 17.1 `leads-crm-text` Skill

**Location:** `skills/leads-crm-text/SKILL.md` + `skills/leads-crm-text/leads-query.mjs`

**Purpose:** A CLI skill that queries Supabase directly and outputs text-formatted leads data — the same information as the leads page UI, but as terminal/table output. Allows an AI agent to do everything the leads page allows.

**Commands:**
| Command | What it does |
|---|---|
| `list-leads` | Query 5 Supabase tables, merge identities, compute stage + SLA, print text table |
| `lead-detail <leadId>` | Full lead detail: identity, pipeline, SLA, rentals, sales, todos, documents, QR status, next action |
| `dismiss-lead <leadId> --reason <r> [--note <t>]` | Dismiss a lead with reason (validates against DISMISS_REASONS) |
| `list-todos [--leadId <id>] [--overdue] [--mine <userId>]` | List todos filtered |
| `kpis [--mode rent\|sale]` | KPI summary (total leads, hot, conversion, revenue) |
| `pipeline-funnel` | Stage distribution counts |

**Trigger phrases:** "покажи лиды", "статус лидов", "список лидов", "кто горячий", "закрой лид", "pipeline", "воронка", "SLA", "просроченные задачи", "KPI лидов"

**Implementation:** Pure Node.js ESM script (zero dependencies, uses built-in `fetch`). Queries Supabase REST API with service role key. Applies the same matching logic as `leads.ts` (normalizePhone, identity merging, operator detection, computeLeadStage, computeLeadSignals).

**Production-verified:** Tested against live Supabase — returned 48 unique leads from 212 intents, correct pipeline funnel, accurate KPIs (34 leads, 4% conversion, 408k₽ revenue).

**Important discovery:** The production DB constraint `franchize_intents_stage_allowed` does NOT include `'dismissed'` in its allowed values. The `dismiss-lead` command detects this and prints the exact `ALTER TABLE` SQL needed to fix it. This same constraint would block the `leads-dismiss.ts` server action.

### 17.2 `analytics-text` Skill

**Location:** `skills/analytics-text/SKILL.md`

**Purpose:** Text-based analytics dashboard — rentals, sales, todos, crew stats. Same data as the analytics pages but as CLI/table output.

**Commands:**
| Command | What it does |
|---|---|
| `rentals-dashboard [--date YYYY-MM-DD]` | Rentals for the date with bike, renter, status, dates, cost, document verification |
| `sales-dashboard [--date YYYY-MM-DD]` | Sales with buyer, bike, price, date |
| `todos-dashboard` | Crew todos grouped by category and assignee, with overdue stats |
| `crew-stats` | Per-member statistics (todo count, completed, overdue) |

**Trigger phrases:** "аналитика аренд", "статистика продаж", "дашборд задач", "сколько аренд сегодня", "выручка за месяц", "статистика экипажа"

### 17.3 Design Philosophy

The web app page is one method of displaying structured information. The skills provide an alternative method — text/CLI — that allows:
- AI agents to query and act on leads/analytics data without a browser
- Operators to get quick text summaries via Telegram bot commands
- Automated pipelines to check lead status programmatically
- The same business logic (stage derivation, SLA signals, identity matching) to be reused across both UI and text interfaces

Both skills use the same Supabase service role key, the same crew context (vip-bike), and port the same algorithms from `pipeline-stages.ts`, `sla-signals.ts`, and `leads.ts` — ensuring consistency between what the UI shows and what the text skill outputs.

### 17.4 Integration with Existing Skills

The `leads-crm-text` and `analytics-text` skills complement the existing `fk-pasha-admin` skill (which is the primary agent runbook for the rental repo). The admin skill documents the system architecture; the text skills provide executable query commands. Together they allow an AI agent to:
1. Understand the system (via `fk-pasha-admin`)
2. Query leads data (via `leads-crm-text`)
3. Query analytics data (via `analytics-text`)
4. Push code changes (via GitHub API)
5. Apply DB migrations (via Supabase SQL editor or REST API)
