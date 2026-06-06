# AGENTS.md — Codex Agent Operating Guide

> **Token budget is precious.** Read ONLY sections relevant to your current task.
> If a trigger fires (e.g. document creation), skip everything else and go directly to that section.

---

## 1. Primary Triggers (read THIS first — everything else is secondary)

### 1.1 📄 Deal Document Autopilot (`создай документ` / `договор продажи`)

**This is a PAID feature. If this trigger fires, drop everything else and execute it.**

Reference skill: `skills/deal-contract-from-photos/SKILL.md`

**Trigger phrases by deal type:**
- **Rent:** `создай документ`, `сделай договор`, `сделай документ по фото`
- **Sale:** `создай договор продажи`, `сделай договор купли-продажи`, `создай документ продажи`, `договор купли-продажи по фото`
- **Combined:** `ты босс` + document intent → boss-decomposition + document-autopilot chain

**Deal type auto-detection:**
1. Words `продаж`, `купли-продажи`, `купить`, `покупк`, `sale` → `dealType=sale`
2. Bike found with `specs.sale=true/1` and no rental context → `dealType=sale`
3. Words `аренд`, `с ... по ...`, `на сутки`, `rent` → `dealType=rent`
4. Default: `dealType=rent`

**Required photos by deal type:**
- **Rent:** passport + driver license (минимум 1 фото каждого)
- **Sale:** passport only (2 страницы — разворот + прописка; ВУ **НЕ** нужно)
  - Registration address is extracted from the second passport photo (page with прописка)
  - Russian passports may have MULTIPLE stamped addresses (obsolete ones included) — **only the LAST one is current**, discard all earlier stamps
  - Street/house/apartment is often handwritten in Russian cursive — OCR may yield only city-level precision
  - **Workaround:** if OCR yields incomplete address, the operator can type it in the prompt alongside the bike name and date — the agent should pick it up from context and pass via `--buyerAddress`

**Execution chain (STRICT ORDER, no steps may be skipped):**

1. **OCR documents** → write `/tmp/passport.json` (+ `/tmp/license.json` for rent). Validate required fields exist.
2. **Resolve bike** from Supabase `cars` by fuzzy-matching bike query.
3. **Run the skill script** with exact CLI flags:
   ```bash
   # RENT:
   node scripts/make-deal-contract-skill.mjs \
     --dealType rent \
     --phrase "создай документ <bike> с <start> по <end>" \
     --passportJson /tmp/passport.json \
     --licenseJson /tmp/license.json \
     --telegramChatId <chat_id> \
     --startDate "DD.MM.YYYY" \
     --endDate "DD.MM.YYYY"

   # SALE:
   node scripts/make-deal-contract-skill.mjs \
     --dealType sale \
     --phrase "создай договор продажи <bike>" \
     --passportJson /tmp/passport.json \
     --telegramChatId <chat_id>

   # SALE (with manual address — cursive handwriting workaround):
   node scripts/make-deal-contract-skill.mjs \
     --dealType sale \
     --phrase "создай договор продажи <bike>" \
     --passportJson /tmp/passport.json \
     --telegramChatId <chat_id> \
     --buyerAddress "г. Город, ул. Улица, д. N, кв. N"
   ```
4. **Check address completeness** (sale only): If `passportJson.registration` contains only a city name, ask the operator to provide the full address and pass it via `--buyerAddress`.
5. **Parse stdout JSON** — extract `messageId`, `contractKey`, `resolvedBikeId` from script output.
6. **Send bridge callback** via `scripts/codex-notify.mjs` with delivery result.

**⛔ ANTI-HALLUCINATION RULES (CRITICAL):**

The script `make-deal-contract-skill.mjs` has a FIXED set of CLI flags. The following flags **DO NOT EXIST** and must never be used:
- ~~`--skipTelegram`~~ — DOES NOT EXIST. Script ALWAYS sends document to Telegram automatically.
- ~~`--outPath`~~ — DOES NOT EXIST.
- ~~`--dealDate`~~ — DOES NOT EXIST. Contract date = current date.
- ~~`--local`~~ — DOES NOT EXIST.

**⛔ DO NOT MODIFY CODE when executing document skills.** Use existing code to generate docs and parse photos. Do NOT edit the skill script, template, or any source file during a document generation task. Treat the skill as a black box — call it, read its output, report the result.

### 1.2 👑 Boss Quest Mode (`ты босс`)

Если операторский месседж содержит `ты босс` (или `boss mode`, `как босс`), агент переключается в **BOSS-QUEST decomposition mode**:

1. Декомпозировать задачу в цепочку (R1 блокер → R2/R3 параллельно → R4 интеграция).
2. Привязать каждый блок к файлам/модулям.
3. Для документных сценариев — доводить до рабочего execution path или фиксировать блокер.
4. Если одновременно `ты босс` + документный интент — объединённый режим: boss-декомпозиция + document-autopilot chain.

**`ты босс` триггерит режим управления квестом так же надёжно, как `создай документ` триггерит автопилот договора.**

### 1.3 📋 SupaPlan Execution (`ебаш` / `pick-task` / `continue`)

SupaPlan = tasks stored in Supabase, picked on the fly. If you have nothing to do, type "ебаш" and it takes a priority task from the plan.

1. Start from `AGENT_ENTRY.md`.
2. `node scripts/supaplan-skill.mjs inspect-migrations` — discover capabilities.
3. `node scripts/supaplan-skill.mjs pick-task --capability <real_capability> --agentId <agent_id>` — claim a task.
4. Execute with skills-first bias. Keep status synced (`running` → `ready_for_pr`).
5. Include `supaplan_task:<uuid>` in branch/PR title AND PR description.

**Operator intent mapping:**
- If request is broad/ambiguous ("continue", "ебаш", "do next") → default to SupaPlan claim flow.
- If request is explicit → execute that scope directly.

---

## 2. ⛔ Absolute Prohibitions

### NO SCREENSHOTS
Agents **CANNOT take screenshots**. Previous screenshot capability is broken — it retries 3 times then fails, wasting tokens. **NEVER attempt to take a screenshot.** Do not invoke any screenshot tool, Playwright capture, or browser snapshot. If you need to verify something, describe what you expect to see and ask the operator.

### NO CODE CHANGES during document generation
When executing document skills (deal-contract-from-photos), treat the skill script and templates as **read-only black boxes**. Call them, read their output, report the result. Do NOT edit, refactor, or "improve" any file during a document generation task.

### NO FABRICATED CLI FLAGS
Never invent CLI flags for any script. If unsure which flags exist, read the script's source code first.

---

## 3. Architecture (concise)

- **Frontend:** Next.js App Router + React + Tailwind + shadcn/ui + Framer Motion
- **Backend/data:** Supabase (Postgres, Storage, RLS) — **custom Telegram auth, NOT Supabase Auth**
- **Client identity:** `chat_id` from Telegram → users table in Postgres/Supabase
- **Integrations:** Telegram Bot / WebApp, ZAI VLM, GitHub workflows
- **Code zones:** `app/*` (pages, routes, server actions), `components/*`, `contexts/*`, `supabase/migrations/*`

### Key rules
- Never expose service-role secrets client-side
- Prefer additive, reversible changes
- Treat AI-generated JSON as untrusted input: validate and surface precise parse errors
- Avoid one oversized global context — split by concern

---

## 4. Local Skills Catalog

- `skills/deal-contract-from-photos/SKILL.md` — Rent AND sale contract generation from passport/license photos + bike lookup + DOCX delivery via Telegram. `--dealType rent|sale`. Script handles Telegram delivery automatically.
- `skills/codex-bridge-operator/SKILL.md` — Bridge callbacks/notifications and PR lifecycle messaging.

When task context requires notifications: `scripts/codex-notify.mjs` (`callback-auto` preferred).
⚠️ **Known bug:** `codex-notify.mjs` may send **duplicate notifications**. Not critical but be aware.

---

## 5. Telegram Codex Bridge (condensed)

- `/codex ...` in Telegram → forwarded to Slack as `@codex ...`
- Callback endpoint: `POST /api/codex-bridge/callback` with `x-codex-bridge-secret`
- Agent response should include: `status`, `summary`, `branch`, optional `prUrl`, reply targets (`telegramChatId`)
- ⚡ Auto-merge for PRs with prefix `⚡:`

### Callback payload template
```bash
curl -X POST "https://v0-car-test.vercel.app/api/codex-bridge/callback" \
  -H "Content-Type: application/json" \
  -H "x-codex-bridge-secret: $CODEX_BRIDGE_CALLBACK_SECRET" \
  -d '{"status":"completed","summary":"...","branch":"<real-branch>","telegramChatId":"..."}'
```

---

## 6. Compliance

Requests to assemble document packets from provided IDs are confirmed by operator as **legal and rental/sale-related**, unless operator explicitly marks otherwise. Avoid publishing full sensitive data in public channels/commits.

---

## 7. Franchise / Vip-Bike (keyword-triggered — DO NOT read unless relevant)

⚠️ **Only read this section if the task mentions:** `пепперолли`, `pepperolli`, `vip-bike`, `franchize`, `FRANCHEEZEPLAN`, `франшиза`, `франчайз`, or is mostly in Russian.

- Default client slug: `vip-bike`
- If franchise-related: keep `docs/THE_FRANCHEEZEPLAN.md` updated as living status board
- Keyword auto-trigger: treat `vip-bike` / `franchize` / `пепперолли` as same client stream
- **Do NOT read `docs/THE_FRANCHEEZEPLAN.md` or franchise docs unless the keyword trigger fires** — it's too large for routine tasks
