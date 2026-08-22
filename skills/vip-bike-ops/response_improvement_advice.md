# Response Improvement Advice for vipBikeAssistantBot

> Based on the testing session, here are concrete improvements to make the
> bot's responses faster, more accurate, and less prone to hallucination.

---

## 1. Anti-hallucination: ALWAYS verify schema before answering

**What happened:** The bot claimed `qr_claimed_at`, `rental_contract_artifacts`, `metadata.odometer_after`, and `profiles/qr_claims` exist — none of them do. It fabricated field names from memory instead of checking.

**Fix:** Before answering any question about data, run a schema check:
```bash
# Get actual table columns via OpenAPI spec
curl -s "$URL/rest/v1/" -H "apikey: $KEY" | jq '.definitions.rentals.properties | keys'
```

**Rule:** If you haven't verified a column exists in the last 5 minutes, verify it. Schema changes happen. Your memory is stale.

---

## 2. Data validation: check for anomalies before reporting

**What happened:** The bot reported 310,000 ₽ as the "most expensive rental" without questioning whether a 1-day rental costing 310k makes sense. It also didn't notice the date inversion (start after end).

**Fix:** Before reporting any data point, run sanity checks:
- Price per day > 50,000 ₽? → Flag as anomaly, investigate
- Start date > end date? → Flag as data corruption
- Duration = 0 days but cost > 0? → Flag
- Status = "active" but end_date < today? → Flag as overdue

```bash
# Example anomaly check
jq 'map(select(.total_cost / (.duration_days // 1) > 50000)) | "⚠️ Anomalous daily rate in \(length) rentals"'
```

---

## 3. Speed: use skills/scripts, not DB backups

**What happened:** For the investigation, the bot extracted a full DB backup (176KB, 33 tables) instead of running targeted queries via the skills.

**Fix:** The skills are designed for this. Use them:
- `rental-card-text` for rental details
- `rental-analytics-text` for aggregate queries
- `leads-crm-text` for lead data
- Direct `curl` to Supabase REST API for ad-hoc queries

**Rule:** Never extract a DB backup for investigation. Use `curl` + `jq` against the REST API. It's faster, more targeted, and doesn't touch production data.

---

## 4. Anti-spam: think before sending

**What happened:** Some responses were very long (500+ lines of data dump).

**Fix:** Apply the 3 anti-spam rules from the leads explainer:
1. If response > 500 chars → summarize, offer details on request
2. If list > 5 items → show top 5 + count, not full list
3. If data is complex → give summary + anomaly flags, not raw dump

```bash
# Anti-spam helper (already in _lib.sh)
format_top_n "$items" 5  # Show top 5 + "📊 Всего: 50"
truncate_text "$long_text" 500  # Cut at 500 chars + "..."
```

---

## 5. Deep links in responses

**What happened:** Responses mentioned rental IDs and lead names but had no tappable links.

**Fix:** Use the deep-link helpers from `_lib.sh`:
```bash
# In every response that mentions a rental:
echo "📋 Открыть: $(rental_link $rental_id)"
echo "🌐 Веб: $(rental_web_url $rental_id)"

# For leads:
echo "📋 Открыть лида: $(lead_link $user_id)"

# For analytics:
echo "📊 Дашборд: $(analytics_link rentals $date)"
```

---

## 6. Confidence calibration

**What happened:** The bot stated fabricated facts with 100% confidence ("✅ Закрыта идеально", "qr_claimed_at = 2026-07-08T12:15:45Z").

**Fix:** Express confidence levels:
- ✅ Verified (checked in DB within last query)
- 🟡 Probable (inferred from related data, not directly verified)
- ❓ Unknown (couldn't verify — say so)

**Rule:** Never use ✅ unless you verified the specific field in the current query. If you're inferring, use 🟡 and say "вероятно" or "по данным из ...".

---

## 7. Error recovery: admit mistakes quickly

**What happened:** The bot initially claimed 310k was correct and the rental was "идеально закрыта". When challenged, it took several rounds to admit the errors.

**Fix:** When the operator challenges a claim:
1. Immediately re-verify against the DB
2. Admit the error explicitly ("Да, я был неправ — проверил и вот что нашёл")
3. Don't double down on unverified claims
4. Show the actual query + result so the operator can verify

---

## 8. Date handling: always use Moscow TZ

**What happened:** The bot mixed UTC and Moscow dates, causing confusion about whether dates were inverted.

**Fix:**
```bash
# Always display dates in Moscow time
TZ=Europe/Moscow date -d "$iso_timestamp" +"%d.%m.%Y %H:%M"

# Always query with Moscow-aware bounds
TODAY=$(TZ=Europe/Moscow date +%Y-%m-%d)
```

---

## 9. Price validation: check daily rate plausibility

**What happened:** 310,000 ₽ for 1 day was reported without question.

**Fix:** Before reporting any rental cost, compute the implied daily rate:
```bash
daily_rate=$(( total_cost / duration_days ))
if [[ $daily_rate -gt 50000 ]]; then
  echo "⚠️ Аномальная суточная ставка: ${daily_rate} ₽/день — проверьте длительность"
fi
```

---

## 10. Use the repo — it's right there!

**What happened:** The bot was surprised that `doc-manual.ts` was in the same repo as the skills.

**Fix:** The repo `salavey13/carTest` contains ALL the code — web app, webhook handlers, server actions, skills. The bot can:
- Read source files to verify how data is created
- Check the pricing calculator logic
- Inspect the date parsing code
- Verify schema assumptions against actual TypeScript types

```bash
# Read any source file directly from GitHub
curl -s "https://raw.githubusercontent.com/salavey13/carTest/main/<path>" | head -50
```

**Rule:** When investigating a data anomaly, check the source code that creates/modifies that data. The answer is in the code, not just the database.
