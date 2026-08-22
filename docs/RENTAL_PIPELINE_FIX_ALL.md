# Rental Document Pipeline: Fix 8 Bugs + SHA Verification + HTML-to-DOCX


---

## Context

Five Codex-generated PRs (#1280–#1284) built features for the rental document super-skill pipeline. Each introduces regressions that block merge. This task consolidates ALL fixes into one sweep, plus integrates missing infrastructure (SHA verification, HTML-to-DOCX, migration).

### Two pipelines, one verification gap

The **web-app pipeline** (`buildFranchizeDocxFromTemplate` → `docx-capability.ts`) already implements full document integrity: SHA256 hash → `registerVerifierOriginalForBuffer()` → `doc_verifier_records` table → rental metadata attachment with `contract_verifier.originalSha256`.

The **super-skill script** (`scripts/make-rental-contract-skill.mjs`) generates DOCX and sends via Telegram curl with **zero integrity tracking** — no hash, no verifier, no anti-forgery. This must be unified so that both pipelines produce verifiable documents.

### Birth date availability — two different situations

- **Super-skill pipeline**: Birth date comes from OCR of passport photo — it is ALWAYS present in a Russian passport, so `renterBirthDate` is never missing here. PR #1284 correctly hard-fails on missing birth date in the super-skill.
- **Web-app pipeline**: Birth date comes from checkout form fields (`OrderPageClient.tsx`) or `userSensitive` — current producers do NOT send this field. The web checkout has no OCR step, so hard-failing on missing `renterBirthDate` blocks document delivery for otherwise valid orders. This is BUG-1.

---

## PR #1281 MERGE CONFLICT RESOLUTION

PR #1281 conflicts with main (after merging #1284) in `scripts/make-rental-contract-skill.mjs`. Both PRs insert new code at the same location (after `arg()` helper):

**Current (#1281)** adds: template mode constants + `renderTemplateWithVars` + `renderHtmlTemplateAdapter`
**Incoming (main / #1284)** adds: `failStage`

**Resolution: KEEP BOTH** — they are independent additions, not conflicting logic:

```js
// From #1281 — keep all three
const RENTAL_DOC_TEMPLATE_MODE = String(process.env.RENTAL_DOC_TEMPLATE_MODE || 'md').trim().toLowerCase();
const RENTAL_DOC_BASELINE_TEMPLATE_PATH = 'docs/RENTAL_DEAL_TEMPLATE.md';
const RENTAL_DOC_HTML_TEMPLATE_PATH = 'docs/RENTAL_DEAL_TEMPLATE.html';

function renderTemplateWithVars(template, vars) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_,k)=> String(vars[k] ?? ''));
}

function renderHtmlTemplateAdapter(htmlTemplate, vars) {
  const renderedHtml = renderTemplateWithVars(htmlTemplate, vars);
  const text = renderedHtml
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    .replace(/<\s*\/tr\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .trim();

  if (!text) { throw new Error('HTML adapter produced empty output'); }
  return text;
}

// From main (#1284) — keep
function failStage(stage, reason, details = {}) {
  const payload = { ok: false, stage, reason, details };
  console.error(JSON.stringify(payload, null, 2));
  process.exit(2);
}
```

After resolving the conflict, immediately apply BUG-2 and BUG-3 fixes (same file) — see below.

---

## BUG INVENTORY (8 bugs across 5 PRs)

### BUG-1: `renterBirthDate` hard-fail breaks web-app backward compat (PR #1280)
- **File**: `app/franchize/actions-runtime.ts`
- **Problem**: `resolveAndValidateFranchizeDocVariables` throws `FranchizeOrderDocValidationError` when `renterBirthDate` is empty. In the **web-app pipeline** (checkout form → doc generation), current producers like `OrderPageClient.tsx` do NOT send this field, and `getUserSensitiveDataOrDefault` doesn't provide it either. This blocks doc generation for otherwise valid orders. Note: in the **super-skill pipeline** this is correct behavior — OCR always extracts birth date from passport.
- **Fix**: Make `renterBirthDate` optional with fallback `"указывается при выдаче"` in the web-app pipeline ONLY. Move `renterBirthDate` out of `FRANCHIZE_DOC_REQUIRED_FIELDS` to the optional group (same tier as `renterEmail`). Keep `renterPhone` as the only required field (already populated via `payload.phone`). Add a deprecation warning log when birth date falls back, so operators know to update checkout producers to start sending it.
- **Codex Task**: https://chatgpt.com/codex/cloud/tasks/task_e_6a162712b268832597a5d39be28798fc

### BUG-2: HTML template read unconditionally → ENOENT crash (PR #1281)
- **File**: `scripts/make-rental-contract-skill.mjs`
- **Problem**: `htmlTemplate = readFileSync(RENTAL_DOC_HTML_TEMPLATE_PATH, 'utf8')` executes at module top level even when `RENTAL_DOC_TEMPLATE_MODE=md`. If the HTML template file doesn't exist, the default Markdown flow crashes with ENOENT before the advertised fallback path ever runs. This is a regression from the previous single-template behavior.
- **Fix**: Move `readFileSync(RENTAL_DOC_HTML_TEMPLATE_PATH)` inside the `if (RENTAL_DOC_TEMPLATE_MODE === 'html')` branch. Only read the HTML file when actually needed:
  ```js
  const mdTemplate = readFileSync(RENTAL_DOC_BASELINE_TEMPLATE_PATH, 'utf8');
  let rendered;
  if (RENTAL_DOC_TEMPLATE_MODE === 'html') {
    try {
      const htmlTemplate = readFileSync(RENTAL_DOC_HTML_TEMPLATE_PATH, 'utf8');
      rendered = renderHtmlTemplateAdapter(htmlTemplate, vars);
    } catch (error) {
      console.warn(`[rental-doc] html render failed, fallback to md: ${error?.message || error}`);
      rendered = renderTemplateWithVars(mdTemplate, vars);
    }
  } else {
    rendered = renderTemplateWithVars(mdTemplate, vars);
  }
  ```
- **Codex Task**: https://chatgpt.com/codex/cloud/tasks/task_e_6a1627149a288325948c86e525b17db6

### BUG-3: Table cell boundaries stripped in HTML adapter (PR #1281)
- **File**: `scripts/make-rental-contract-skill.mjs`
- **Problem**: `renderHtmlTemplateAdapter` strips all HTML tags via `.replace(/<[^>]+>/g, '')` but does not insert delimiters for `<td>`/`<th>` boundaries before the generic strip. Cells in the same `<tr>` merge into one undelimited string — e.g., a two-cell row containing `"г. Нижний Новгород"` and `"27.05.2026"` becomes `"г. Нижний Новгород27.05.2026"`, destroying legal document structure and readability.
- **Fix**: Add `.replace(/<\s*\/t[dh]\s*>/gi, '\t')` before the generic tag strip. This preserves cell boundaries as tab characters:
  ```js
  const text = renderedHtml
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    .replace(/<\s*\/tr\s*>/gi, '\n')
    .replace(/<\s*\/t[dh]\s*>/gi, '\t')   // ← ADD THIS LINE
    .replace(/<[^>]+>/g, '')
    // ... rest of entity replacements
  ```
- **Codex Task**: https://chatgpt.com/codex/cloud/tasks/task_e_6a1627149a288325948c86e525b17db6

### BUG-4: Legal checklist runs for ALL doc types, not just rental (PR #1282)
- **File**: `app/franchize/lib/docx-capability.ts`
- **Problem**: `runLegalTemplateChecklist` is called unconditionally in `buildFranchizeDocxFromTemplate`, but this function is also used by sale and configurator doc flows whose templates do NOT contain rental legal markers (§3.3, Приложение №1, etc.). Those flows now throw `TemplateIntegrityError` before rendering, blocking non-rental document generation entirely.
- **Fix**: Gate the checklist behind a parameter on `BuildFranchizeDocxInput`. Add `flowType?: 'rental' | 'sale' | 'mixed'` or `skipLegalChecklist?: boolean`. Only run legal validation when `flowType === 'rental'` (or when `skipLegalChecklist` is not set for rental flow). Sale and configurator docs must skip it entirely:
  ```ts
  if (input.flowType === 'rental') {
    const checklist = runLegalTemplateChecklist(input.template);
    // ... existing validation logic
  }
  ```
- **Codex Task**: https://chatgpt.com/codex/cloud/tasks/task_e_6a1627180f248325a5d85d292960a31f

### BUG-5: Strict marker matching rejects valid templates (PR #1282)
- **File**: `app/franchize/lib/legalChecklist.ts`
- **Problem**: The checklist uses `source.includes(marker)` for strict substring matching. The marker set contains `§3.3` but templates may use `3.3.` (dot after number); markers use `Приложение №2` but templates may have `Приложение № 2` (space before number). Valid templates with these formatting differences are incorrectly rejected as having missing legal content.
- **Fix**: Replace literal `includes()` with regex matching that normalizes format variants. Build a regex from each marker that handles spacing and section-symbol variations:
  ```ts
  // Section markers: §3.3 matches §3.3, 3.3., § 3.3, etc.
  // Appendix markers: Приложение №2 matches Приложение №2, Приложение № 2, etc.
  function markerToRegex(marker: string): RegExp {
    if (marker.startsWith('§')) {
      const num = marker.replace('§', '').replace('.', '\\.');
      return new RegExp(`§?\\s*${num}\\.?`);
    }
    if (marker.startsWith('Приложение')) {
      const num = marker.match(/\d+/)?.[0] ?? '';
      return new RegExp(`Приложение\\s*№\\s*${num}`);
    }
    return new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  }
  ```
- **Codex Task**: https://chatgpt.com/codex/cloud/tasks/task_e_6a1627180f248325a5d85d292960a31f

### BUG-6: `prUrl` required breaks non-PR callbacks (PR #1283)
- **Files**: `app/api/codex-bridge/callback/route.ts`, `scripts/codex-notify.mjs`
- **Problem**: Making `prUrl` required in `validateRequired()` breaks existing callback producers that emit status updates before a PR exists — e.g., `supaplan-skill.mjs` calls `callback-auto` without `--prUrl`, and `homework-solution-store-skill.mjs` posts callbacks without `prUrl`. These are now rejected with HTTP 400, so Telegram/Slack delivery silently stops for in-progress and task-status notifications.
- **Fix**: Make `prUrl` optional in validation. Only require it when `status === 'done'` or `status === 'completed'`. For `in_progress` and other intermediate statuses, `prUrl` should be optional:
  ```ts
  // In validateRequired():
  if (!body.prUrl && (body.status === 'done' || body.status === 'completed')) {
    errors.push('prUrl is required when status is done/completed');
  }
  ```
  Mirror the same logic in `scripts/codex-notify.mjs` `validateCallbackPayload()`.
- **Codex Task**: https://chatgpt.com/codex/cloud/tasks/task_e_6a16273644d083259551bbfcac2a9fa4

### BUG-7: Fallback cURL leaks auth secret to logs (PR #1283)
- **File**: `scripts/codex-notify.mjs`
- **Problem**: `buildFallbackCurl` includes the resolved secret value in the `x-codex-bridge-secret` header. When callback delivery fails, the full cURL command with the real secret is printed to stdout/logs. In CI or shared runner environments, this leaks an auth credential that can be reused to forge callback requests to the bridge endpoint.
- **Fix**: Always use the literal placeholder `'$CODEX_BRIDGE_CALLBACK_SECRET'` in the fallback cURL instead of the resolved value. Add a comment instructing the operator to substitute the real value:
  ```js
  function buildFallbackCurl(endpoint, secret, payload, reason) {
    const safePayload = { ...payload, fallbackReason: reason, previewUrl: buildPreviewUrl(payload.branch, payload.taskPath) };
    return [
      `# Replace $CODEX_BRIDGE_CALLBACK_SECRET with actual value before running`,
      `curl -X POST "${endpoint}" \\`,
      '  -H "Content-Type: application/json" \\',
      `  -H "x-codex-bridge-secret: $CODEX_BRIDGE_CALLBACK_SECRET" \\`,
      `  -d '${JSON.stringify(safePayload, null, 2)}'`,
    ].join('\n');
  }
  ```
- **Codex Task**: https://chatgpt.com/codex/cloud/tasks/task_e_6a16273644d083259551bbfcac2a9fa4

### BUG-8: `saveMetadata` defaults to enabled but table doesn't exist (PR #1284)
- **File**: `scripts/make-rental-contract-skill.mjs`
- **Problem**: `--saveMetadata` defaults to `'1'` (enabled) and `--metadataTable` defaults to `rental_contract_artifacts`, but this table does not exist in any migration or config. After successful Telegram delivery, the script fails at `metadata_write_failed`, turning successful document delivery into a hard failure. This creates retry/duplication risk for bridge automation — the document was already sent to Telegram but the script exits with error code 2.
- **Fix**: Default `--saveMetadata` to `'0'` (disabled). The script works correctly without metadata persistence. When the migration is created (see MIGRATION-1 below) and the table exists in production, the default can be flipped to `'1'`:
  ```js
  const saveMetadata = arg('saveMetadata', '0') !== '0';
  ```
- **Codex Task**: https://chatgpt.com/codex/cloud/tasks/task_e_6a16272fce188325928b6dde835362fe

---

## MISSING FEATURES / INTEGRATION

### MIGRATION-1: Create `rental_contract_artifacts` table
- **What**: Supabase migration to create the table that PR #1284 references but doesn't create.
- **Why**: The super-skill's read-after-write verification needs a place to persist contract metadata (bike, renter, dates, Telegram delivery info, SHA256 hash, verifier record link).
- **Schema** (minimum viable):
  ```sql
  CREATE TABLE rental_contract_artifacts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_key        TEXT NOT NULL UNIQUE,
    requested_bike_id   TEXT,
    resolved_bike_id    TEXT,
    telegram_chat_id    TEXT,
    telegram_message_id BIGINT,
    renter_full_name    TEXT,
    rent_start_date     DATE,
    rent_end_date       DATE,
    doc_verifier_id     UUID REFERENCES doc_verifier_records(id),
    original_sha256     TEXT,
    created_at          TIMESTAMPTZ DEFAULT now()
  );

  CREATE INDEX idx_rental_contract_artifacts_key ON rental_contract_artifacts(contract_key);
  CREATE INDEX idx_rental_contract_artifacts_sha256 ON rental_contract_artifacts(original_sha256);
  ```
- **Key columns**: `doc_verifier_id` links to the existing `doc_verifier_records` table (the anti-forgery system). `original_sha256` is the SHA256 hash of the generated DOCX bytes — same value stored in `contract_verifier.originalSha256` by the web-app pipeline.

### INVESTIGATION-1: Integrate super-skill with existing doc verification pipeline
- **What**: The web-app pipeline already implements full document integrity verification. The super-skill does none of it. Both pipelines must produce documents verifiable by the same anti-forgery system.
- **Web-app pipeline** (already working in `docx-capability.ts`):
  1. `createHash("sha256").update(bytes).digest("hex")` — compute SHA256 of DOCX bytes
  2. `registerVerifierOriginalForBuffer()` from `@/app/doc-verifier/actions` — insert into `doc_verifier_records`
  3. SHA256 + verifier ID stored in rental metadata: `contract_verifier.originalSha256` + `contract_verifier.docVerifierRecordId`
  4. `reconcileRentalContractVerifierAttachment()` — re-link rentals to verifier records if attachment failed

- **Required investigation** (read these files and understand their interfaces before implementing):
  1. `app/franchize/lib/docx-capability.ts` — `BuildFranchizeDocxInput/Output`, SHA256 computation, `registerVerifierOriginalForBuffer()` call signature
  2. `app/doc-verifier/actions.ts` — `registerVerifierOriginalForBuffer()` — what params it takes, what it writes to `doc_verifier_records`, what it returns
  3. `app/markdown-doc/actions.ts` — `generateDocxBytes()` interface
  4. `lib/markdownTemplate.ts` — `applyTemplateVariables()` interface
  5. `app/franchize/actions-runtime.ts` lines ~1747-1969 — the full pipeline wiring (variables → docx → SHA256 → verifier → Telegram → rental metadata attachment)

- **Implementation for super-skill** (`scripts/make-rental-contract-skill.mjs`):
  1. After generating DOCX bytes (`Packer.toBuffer()`), compute SHA256: `createHash("sha256").update(buf).digest("hex")`
  2. Register verifier record — since this is a standalone script (not a server action), either:
     - Import and call `registerVerifierOriginalForBuffer()` directly if the script runs in Node with full app context
     - Or replicate the Supabase insert into `doc_verifier_records` with the same schema (scope, document_key, original_sha256, etc.)
  3. When `saveMetadata` is enabled, store `doc_verifier_id` and `original_sha256` in the `rental_contract_artifacts` row
  4. Result: super-skill-generated documents are verifiable by the same anti-forgery system the web app uses

### FEATURE-1: HTML-to-DOCX proper pipeline
- **What**: Replace the naive HTML→text adapter (from PR #1281) with a proper HTML→DOCX conversion that preserves legal document formatting.
- **Current state**: `renderHtmlTemplateAdapter` strips all tags and produces plain text. This loses: centered/bold section headers, table borders (damage price list in Приложение №3), two-column date/city layout, signature blocks with aligned columns (АРЕНДОДАТЕЛЬ / АРЕНДАТОР), page breaks between contract and appendices, consistent indentation for sub-clauses.
- **Implementation options** (investigate and choose the best fit):
  1. **`html-to-docx` npm package** — converts HTML directly to DOCX with styling preserved. Simplest integration, may not handle all formatting edge cases.
  2. **Playwright: HTML → PDF → DOCX** — render HTML in headless browser, export as PDF, convert to DOCX. Heavier dependency but pixel-perfect output.
  3. **Custom `cheerio`/`jsdom` → `docx` constructs** — parse HTML and map to `docx` package primitives (Paragraph with alignment, Table with borders, TextRun with bold, PageBreak). Most control, most implementation work, no new dependencies beyond cheerio.
- **Requirements**:
  - Template variable substitution (`{{variable}}`) must work on the HTML string before conversion
  - Tables with visible borders (Приложение №3 damage price list)
  - Centered/bold section headers (ДОГОВВОР АРЕНДЫ ТС)
  - Signature blocks with aligned two-column layout
  - Page breaks between main contract body and appendices
  - Graceful fallback to Markdown pipeline if HTML conversion fails for any reason
- **Files affected**:
  - `scripts/make-rental-contract-skill.mjs` — replace `renderHtmlTemplateAdapter` with proper HTML→DOCX path
  - `app/franchize/lib/docx-capability.ts` — add HTML template support to `buildFranchizeDocxFromTemplate`
  - `scripts/rental-doc-template-smoke.mjs` — verify both MD and HTML template variable parity

### FEATURE-2: Wire new template variables with backward-compatible fallbacks
- **What**: Ensure `{{renter_birth_date}}`, `{{renter_phone}}`, `{{renter_email}}` are populated in both pipelines with correct source priority and fallbacks.
- **Per-pipeline behavior**:

  | Variable | Web-app (`actions-runtime.ts`) | Super-skill (`make-rental-contract-skill.mjs`) |
  |----------|-------------------------------|-----------------------------------------------|
  | `renter_phone` | Required. Source: `payload.phone` → `userSensitive.phone` | Required. Source: `passportJson.phone` |
  | `renter_birth_date` | **Optional** with fallback `"указывается при выдаче"`. Source: `payload.renterBirthDate` → `userSensitive.renterBirthDate` → fallback. Log deprecation warning on fallback. | Required (always from OCR). Source: `passportJson.birthDate` |
  | `renter_email` | Optional with fallback `"указывается при выдаче"`. Source: `payload.renterEmail` → `userSensitive.renterEmail` → fallback | Optional with fallback. Source: not in OCR — use `"указывается при выдаче"` |

- **Files affected**:
  - `app/franchize/actions-runtime.ts` — fix `resolveAndValidateFranchizeDocVariables` (BUG-1): move `renterBirthDate` out of required fields
  - `scripts/make-rental-contract-skill.mjs` — already wired correctly in PR #1284 (hard-fail on missing is correct for OCR pipeline)

---

## AFFECTED FILES SUMMARY

| File | Bugs | Features | Changes |
|------|------|----------|---------|
| `app/franchize/actions-runtime.ts` | BUG-1 | FEATURE-2 | Make `renterBirthDate` optional with fallback, add deprecation warning |
| `scripts/make-rental-contract-skill.mjs` | BUG-2, BUG-3, BUG-8 | FEATURE-1, INVESTIGATION-1 | Lazy HTML read, cell delimiters, saveMetadata default off, SHA256 + verifier, HTML-to-DOCX |
| `app/franchize/lib/docx-capability.ts` | BUG-4 | FEATURE-1 | Gate legal checklist to rental flowType, add HTML template support |
| `app/franchize/lib/legalChecklist.ts` | BUG-5 | — | Regex/fuzzy marker matching instead of strict `includes()` |
| `app/api/codex-bridge/callback/route.ts` | BUG-6 | — | Make `prUrl` optional unless status is done/completed |
| `scripts/codex-notify.mjs` | BUG-6, BUG-7 | — | `prUrl` conditional validation, redact secret in fallback cURL |
| `supabase/migrations/XXXXXX_create_rental_contract_artifacts.sql` | — | MIGRATION-1 | New migration with indexes |
| `scripts/rental-doc-template-smoke.mjs` | — | FEATURE-1 | Verify both template modes and variable parity |
| `skills/rental-contract-from-photos/SKILL.md` | — | INVESTIGATION-1 | Document SHA verification integration in pipeline |

---

## PR REFERENCE

| PR | Title | Codex Task |
|----|-------|------------|
| #1280 | Validate and normalize contract contact fields | https://chatgpt.com/codex/cloud/tasks/task_e_6a162712b268832597a5d39be28798fc |
| #1281 | RENTAL_DOC_TEMPLATE_MODE with HTML render adapter | https://chatgpt.com/codex/cloud/tasks/task_e_6a1627149a288325948c86e525b17db6 |
| #1282 | Legal template checklist integrity validation | https://chatgpt.com/codex/cloud/tasks/task_e_6a1627180f248325a5d85d292960a31f |
| #1283 | Enforce bridge callback contract and validation | https://chatgpt.com/codex/cloud/tasks/task_e_6a16273644d083259551bbfcac2a9fa4 |
| #1284 | Harden rental document pipeline, validation, and read-after-write | https://chatgpt.com/codex/cloud/tasks/task_e_6a16272fce188325928b6dde835362fe |

---

## EXECUTION ORDER

1. **Resolve PR #1281 merge conflict** — keep both sides (template constants + render helpers from #1281, `failStage` from #1284)
2. **BUG fixes** (BUG-1 through BUG-8) — all are regressions blocking current functionality; can be done in parallel across different files
3. **MIGRATION-1** — create `rental_contract_artifacts` table so BUG-8's default can eventually be flipped
4. **INVESTIGATION-1** — study existing verification code in `docx-capability.ts` and `doc-verifier/actions.ts`, then implement SHA256 + verifier registration in super-skill
5. **FEATURE-2** — wire template variables with backward-compatible fallbacks (small, depends on BUG-1 fix)
6. **FEATURE-1** — HTML-to-DOCX proper pipeline (largest scope, depends on BUG-2 + BUG-3 fixes in same file)

---

## DONE WHEN

- [ ] PR #1281 merged with conflict resolved (both sides kept)
- [ ] All 8 bugs fixed with no regressions
- [ ] `rental_contract_artifacts` migration created and tested
- [ ] Super-skill computes SHA256 and registers verifier record for every generated document
- [ ] `{{renter_birth_date}}` has backward-compatible fallback in web-app pipeline (doesn't block doc generation); super-skill pipeline keeps hard-fail (OCR always provides it)
- [ ] HTML template pipeline produces properly formatted DOCX (tables, headers, signatures, page breaks)
- [ ] Legal checklist only runs for rental contracts (`flowType === 'rental'`), with fuzzy marker matching
- [ ] Bridge callback accepts updates without `prUrl` when status isn't done/completed
- [ ] Fallback cURL never contains real secrets (uses `$CODEX_BRIDGE_CALLBACK_SECRET` placeholder)
- [ ] `--saveMetadata` defaults to `'0'` (off)
- [ ] Smoke test passes for both MD and HTML template modes
