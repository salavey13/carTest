# PRD — Deep Link Enhancement for startParamRouter

> **What**: Enhance `hooks/useStartParamRouter.ts` to support deep links from
> Telegram notifications (boss commands, skill responses) that open specific
> pages with pre-set filters/params.
>
> **Why**: When the boss sends "🔥 Рудометов — urgency 95 — QR не принят 17ч",
> the operator should be able to tap a link that opens the leads page
> pre-filtered to that lead. Currently the link just opens `/leads` with no
> context.
>
> **Status**: Draft for implementation
> **Last updated**: 2026-07-24

---

## 1. Problem statement

### Current state

`useStartParamRouter.ts` maps startapp params to pages:

```ts
const START_PARAM_PAGE_MAP: Record<string, string> = {
  "rent-bike": "/franchize/vip-bike",
  leaderboard: "/leaderboard",
  // ... ~20 entries
};
```

These are simple page redirects — no query params, no filters, no context.

### What's missing

When a boss command notification says "Рудометов — QR не принят", the link
should open the leads page **pre-filtered to show that lead's detail drawer**.
Currently the operator has to:
1. Tap the link → opens `/leads` (no filter)
2. Search for "Рудометов" manually
3. Tap the lead to open the detail drawer

This is 3 steps. With deep links it should be 1 step: tap → lead detail opens.

---

## 2. Proposed deep link formats

### 2.1 Lead deep links

```
startapp=lead_<leadId>
```
Opens `/franchize/vip-bike/leads?leadId=<leadId>` — the leads page reads
`?leadId=` and auto-opens the detail drawer for that lead.

**Already partially supported**: `LeadsClient.tsx` already reads
`?leadId=` from the URL (lines 198-210):
```ts
useEffect(() => {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const leadId = params.get("leadId");
  if (!leadId) return;
  if (leads.some((l) => l.user_id === leadId)) {
    setSelectedId((prev) => (prev === leadId ? prev : leadId));
  }
}, [leads]);
```

**What's needed**: Add `lead_<id>` to `START_PARAM_PAGE_MAP` and redirect to
`/franchize/vip-bike/leads?leadId=<id>`.

### 2.2 Lead with filter

```
startapp=leads_hot
startapp=leads_overdue
startapp=leads_segment:hot
```
Opens `/franchize/vip-bike/leads?segment=hot` — the leads page pre-selects
the "Горячие" segment tab.

**What's needed**: LeadsClient needs to read `?segment=` and set the active
segment. The URL becomes shareable.

### 2.3 Rental deep links

```
startapp=rental_<rentalId>
```
Opens `/franchize/vip-bike/rentals-analytics?ui=v2&rentalId=<rentalId>` —
the analytics page opens with that rental's detail drawer expanded.

**What's needed**: AnalyticsClientV2 needs to read `?rentalId=` and set
`selectedRentalId`.

### 2.4 Analytics with preset params

```
startapp=analytics_date_<YYYY-MM-DD>
startapp=analytics_tab_<rentals|sales|services>
startapp=analytics_<tab>_<date>
```
Opens `/franchize/vip-bike/rentals-analytics?ui=v2&date=<date>&tab=<tab>`
— the analytics page opens on a specific date + tab.

**What's needed**: AnalyticsUiSwitch + AnalyticsClientV2 read `?date=` and
`?tab=` from the URL.

### 2.5 Sale deep links

```
startapp=sale_<saleId>
```
Opens `/franchize/vip-bike/rentals-analytics?ui=v2&tab=sales&saleId=<saleId>`.

### 2.6 Service deep links

```
startapp=service_<rentalId>
```
Opens `/franchize/vip-bike/rentals-analytics?ui=v2&tab=services&rentalId=<rentalId>`.

---

## 3. Implementation plan

### Phase 1: Lead deep links (highest value)

**Files to modify:**

| File | Change |
|---|---|
| `hooks/useStartParamRouter.ts` | Add `parseLeadDeepLink()` + map `lead_<id>` → `/franchize/vip-bike/leads?leadId=<id>` |
| `app/franchize/[slug]/leads/components/LeadsClient.tsx` | Already reads `?leadId=` — no change needed |

**New code in `useStartParamRouter.ts`:**

```ts
function parseLeadDeepLink(param: string): { leadId: string } | null {
  if (!param.startsWith("lead_")) return null;
  const leadId = param.slice(5).trim();
  if (!leadId) return null;
  return { leadId };
}

// In the main effect:
const leadLink = parseLeadDeepLink(startParam);
if (leadLink) {
  router.push(`/franchize/${crewSlug}/leads?leadId=${leadLink.leadId}`);
  clearStartParam();
  return;
}
```

**Boss command integration:**

In `boss-commands/morning-standup.sh` and other boss commands, the Telegram
message should include a deep-link button:

```bash
# In the message:
MESSAGE="🔥 Рудометов Михаил — urgency 95
...
📱 Открыть: https://t.me/oneBikePlsBot/app?startapp=lead_<userId>"
```

Or use inline keyboard:
```json
{
  "reply_markup": {
    "inline_keyboard": [[
      {"text": "📋 Открыть лида", "url": "https://t.me/oneBikePlsBot/app?startapp=lead_<userId>"},
      {"text": "📞 Позвонить", "url": "tel:+79991234567"}
    ]]
  }
}
```

### Phase 2: Analytics deep links

**Files to modify:**

| File | Change |
|---|---|
| `hooks/useStartParamRouter.ts` | Add `parseAnalyticsDeepLink()` |
| `app/franchize/[slug]/rentals-analytics/page.tsx` | Read `?rentalId=`, `?tab=`, `?date=` from searchParams |
| `app/franchize/[slug]/rentals-analytics/AnalyticsClientV2.tsx` | Accept initial `rentalId` / `tab` / `date` props |
| `app/franchize/[slug]/rentals-analytics/components/AnalyticsClient.tsx` | Read initial selection from props |

**New code in `useStartParamRouter.ts`:**

```ts
function parseAnalyticsDeepLink(param: string): { tab?: string; date?: string; rentalId?: string; saleId?: string } | null {
  // analytics_rentals_2026-07-24
  // analytics_rental_<uuid>
  // analytics_sales
  // analytics_sale_<id>
  if (!param.startsWith("analytics_")) return null;
  const rest = param.slice(10); // after "analytics_"

  // Tab-only: analytics_rentals, analytics_sales, analytics_services
  if (["rentals", "sales", "services"].includes(rest)) {
    return { tab: rest };
  }

  // Tab + date: analytics_rentals_2026-07-24
  const dateMatch = rest.match(/^(rentals|sales|services)_(\d{4}-\d{2}-\d{2})$/);
  if (dateMatch) {
    return { tab: dateMatch[1], date: dateMatch[2] };
  }

  // Specific rental: analytics_rental_<uuid>
  const rentalMatch = rest.match(/^rental_(.+)$/);
  if (rentalMatch) {
    return { tab: "rentals", rentalId: rentalMatch[1] };
  }

  // Specific sale: analytics_sale_<id>
  const saleMatch = rest.match(/^sale_(.+)$/);
  if (saleMatch) {
    return { tab: "sales", saleId: saleMatch[1] };
  }

  return null;
}
```

### Phase 3: Filter URLs (shareable)

Make all filter states shareable via URL:

| Filter | URL param | Example |
|---|---|---|
| Lead segment | `?segment=hot\|warm\|verified\|troubled` | `/leads?segment=hot` |
| Lead stage | `?stage=new\|needs_contact\|...` | `/leads?stage=awaiting_qr_claim` |
| Lead search | `?q=Рудометов` | `/leads?q=Рудометов` |
| Analytics tab | `?tab=rentals\|sales\|services` | `/rentals-analytics?tab=sales` |
| Analytics date | `?date=2026-07-24` | `/rentals-analytics?date=2026-07-24` |
| Rental detail | `?rentalId=<uuid>` | `/rentals-analytics?rentalId=<uuid>` |
| Sale detail | `?saleId=<id>` | `/rentals-analytics?tab=sales&saleId=<id>` |

**What's needed**: Each filter component reads its state from the URL on
mount and writes to the URL on change. Use `useSearchParams` + `router.replace`.

---

## 4. Telegram deep-link URL format

Telegram WebApp deep links use:
```
https://t.me/<botUsername>/app?startapp=<payload>
```

For VIP Bike bot:
```
https://t.me/oneBikePlsBot/app?startapp=lead_<userId>
https://t.me/oneBikePlsBot/app?startapp=analytics_rentals_2026-07-24
https://t.me/oneBikePlsBot/app?startapp=rental_<rentalId>
```

**Important**: The `startapp` payload is passed to the WebApp via
`window.Telegram.WebApp.initDataUnsafe.start_param`. The `useStartParamRouter`
hook reads this on mount and redirects.

---

## 5. Boss command integration

### 5.1 Morning standup

Current message ends with:
```
Что дальше?
1. Позвонить Рудометову (лид + возврат сегодня)
```

Enhanced with deep links:
```
Что дальше?
1. 📋 Рудометов — https://t.me/oneBikePlsBot/app?startapp=lead_<userId>
2. 🏍 Falcon PRO возврат — https://t.me/oneBikePlsBot/app?startapp=rental_<rentalId>
3. 📊 Дашборд — https://t.me/oneBikePlsBot/app?startapp=analytics_rentals_2026-07-24
```

### 5.2 Inline keyboard (Phase 2 — requires bot-reply flow)

```json
{
  "reply_markup": {
    "inline_keyboard": [
      [
        {"text": "📋 Открыть лида", "url": "https://t.me/oneBikePlsBot/app?startapp=lead_<userId>"},
        {"text": "📞 Позвонить", "url": "tel:+79991234567"}
      ],
      [
        {"text": "📊 Дашборд", "url": "https://t.me/oneBikePlsBot/app?startapp=analytics_rentals"}
      ]
    ]
  }
}
```

### 5.3 Web links (for non-Telegram contexts)

For email notifications or web dashboards:
```
https://vip-bike.ru/franchize/vip-bike/leads?leadId=<userId>
https://vip-bike.ru/franchize/vip-bike/rentals-analytics?ui=v2&rentalId=<rentalId>
https://vip-bike.ru/franchize/vip-bike/leads?segment=hot
```

---

## 6. URL builder helper

Create a shared helper in `boss-commands/_lib.sh`:

```bash
# Build a Telegram WebApp deep link
tg_deep_link() {
  local payload="$1"
  echo "https://t.me/oneBikePlsBot/app?startapp=${payload}"
}

# Build a web URL
web_url() {
  local path="$1"
  local params="${2:-}"
  if [[ -n "$params" ]]; then
    echo "https://vip-bike.ru${path}?${params}"
  else
    echo "https://vip-bike.ru${path}"
  fi
}

# Build a lead deep link
lead_link() {
  local lead_id="$1"
  tg_deep_link "lead_${lead_id}"
}

# Build a rental deep link
rental_link() {
  local rental_id="$1"
  tg_deep_link "rental_${rental_id}"
}

# Build an analytics deep link
analytics_link() {
  local tab="${1:-rentals}"
  local date="${2:-}"
  if [[ -n "$date" ]]; then
    tg_deep_link "analytics_${tab}_${date}"
  else
    tg_deep_link "analytics_${tab}"
  fi
}
```

---

## 7. Acceptance criteria

- [ ] `startapp=lead_<userId>` opens leads page with that lead's detail drawer expanded
- [ ] `startapp=analytics_rentals_2026-07-24` opens analytics on the rentals tab for that date
- [ ] `startapp=rental_<rentalId>` opens analytics with that rental's detail drawer
- [ ] `?segment=hot` in the URL pre-selects the "Горячие" segment on the leads page
- [ ] `?tab=sales` in the URL pre-selects the "Продажа" tab on the analytics page
- [ ] Boss command notifications include tappable deep links
- [ ] Web URLs work when opened in a browser (not just Telegram WebApp)
- [ ] Deep links are shareable (copy-paste to another operator works)

---

## 8. Migration plan

1. **Phase 1** (lead deep links): Add `parseLeadDeepLink` to `useStartParamRouter.ts` + add deep links to boss command messages. LeadsClient already supports `?leadId=`.
2. **Phase 2** (analytics deep links): Add `parseAnalyticsDeepLink` + modify page.tsx + AnalyticsClientV2 to accept URL params.
3. **Phase 3** (filter URLs): Make all filter states shareable via URL params. Each filter component reads/writes URL state.
4. **Phase 4** (inline keyboards): Requires the bot-reply flow (Phase 2 of the boss roadmap). Add inline keyboard buttons to Telegram messages.

---

## 9. Related files

- `hooks/useStartParamRouter.ts` — the main file to enhance
- `app/franchize/[slug]/leads/components/LeadsClient.tsx` — already reads `?leadId=`
- `app/franchize/[slug]/rentals-analytics/page.tsx` — needs to read `?rentalId=`, `?tab=`, `?date=`
- `app/franchize/[slug]/rentals-analytics/AnalyticsClientV2.tsx` — needs to accept URL-driven props
- `boss-commands/_lib.sh` — add URL builder helpers
- `boss-commands/morning-standup.sh` — add deep links to notification messages
- `skills/leads-crm-text/SKILL.md` — add deep link format to output spec
- `skills/rental-analytics-text/SKILL.md` — add deep link format to output spec
