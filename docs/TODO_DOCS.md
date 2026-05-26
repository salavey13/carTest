# Rental Deal Template — TODO

## New Template Variables (need implementation in code)

The following variables were added to the template to match the original docx contract. They need to be populated in `buildFranchizeOrderDocAndNotify()` or wherever the template variables are resolved:

| Variable | Source | Notes |
|---|---|---|
| `{{renter_birth_date}}` | OCR of driver license / user profile | Required for Приложение №4 (PD consent). Format: `DD.MM.YYYY` |
| `{{renter_phone}}` | User profile / payload | Required for Приложение №4. Format: `+7XXXXXXXXXX` |
| `{{renter_email}}` | User profile / payload | Optional, blank if not provided. Required for Приложение №4 |

### Where to wire these up

1. **Franchize order flow** (`actions-runtime.ts` → `buildFranchizeOrderDocAndNotify`):
   - Add `renter_birth_date`, `renter_phone`, `renter_email` to the `variables` object
   - Source from `userSensitive` (already fetched via `getUserSensitiveDataOrDefault`) or from `payload`
   - The `payload` type (`FranchizeOrderNotifyPayload`) may need these fields added

2. **SvarProfi flow** (`actions.ts` → `submitSvarProfiOrder`):
   - Not applicable (svarprofi is notification-only, no docx generation)

## New Legal Clauses Added to Template

These sections were missing from the old template but present in the original docx. Already added to `RENTAL_DEAL_TEMPLATE.md`:

- **§3.3** — 48-hour hidden damage discovery clause
- **§4.3** — Full deposit description with Art. 381.1 CC RF reference
- **§4.4** — Deposit shortfall obligation (renter pays difference)
- **§4.5** — Deposit return within 3 working days
- **§4.6** — Late payment interest (Art. 395 CC RF)
- **§5.3** — Extended maintenance obligations (no disassembly, no controller changes, Art. 644 CC RF)
- **§5.5** — Anti-theft obligation
- **§6.3** — Detailed damage cost breakdown (8 bullet items)
- **§6.4** — Payment method choice (STO / expert / price list), 3-day payment deadline
- **§6.5** — Loss/total destruction with market value option, criminal case independence
- **§6.6** — Downtime damages (daily rate, 90-day max)
- **§6.7** — Third-party harm liability
- **§6.8** — Third-party claims handling (6 obligations)
- **§6.9** — All fines/evacuation costs borne by renter
- **§6.10** — Accident protocol (6-step emergency checklist)
- **§6.11** — Transfer prohibition as essential condition (personal liability)
- **§6.12** — Contractual penalties table (5 items × 30,000₽)
- **§7.2** — Lessor liability limitation
- **§8.2** — "Lack of funds ≠ force majeure"
- **§9.2** — Early termination: rent not returned
- **§10.1** — Extended PD processing purposes (debt collection, legal reps)
- **§10.2** — GPS data purposes (safety, search, violations)
- **§11.2** — Consumer protection court rules
- **§12.1** — Electronic communication legal significance (messenger/SMS/email)
- **Appendix 1** — Full party intro block, detailed equipment checklist, dual signature blocks
- **Appendix 2** — "Ознакомлен" signature line
- **Appendix 3** — Damage price table with sample entries, supplementing clause (п.5)
- **Appendix 4** — Full 152-FZ GDPR-style consent (8 data categories, processing actions, 3rd party recipients, 5-year retention, withdrawal rights)
- **Lessor bank details** — р/сч, bank name, к/сч

## HTML Template Support

### Current state
- `RENTAL_DEAL_TEMPLATE.md` — Markdown with `{{variable}}` placeholders. Used by the existing docx generation skill (markdown → docx via docx template engine).
- `RENTAL_DEAL_TEMPLATE.html` — Same content but with full HTML formatting (Times New Roman, centered headers, tables with borders, proper signature blocks). **Not yet wired up.**

### Why HTML is better
The original docx has formatting that Markdown cannot express:
- Centered section headers (bold, uppercase)
- Right-aligned appendix references
- Proper tables with borders (Приложение №3 damage price list)
- Two-column date/city layout
- Signature blocks with aligned columns (АРЕНДОДАТЕЛЬ / АРЕНДАТОР)
- Consistent indentation for sub-clauses
- Page breaks between main contract and appendices

### Implementation plan
1. Update the docx generation skill to accept `.html` templates
2. Use an HTML→DOCX converter (e.g., `html-to-docx` npm package or Playwright PDF → DOCX)
3. Replace `RENTAL_DEAL_TEMPLATE.md` with `RENTAL_DEAL_TEMPLATE.html` as the primary template
4. Keep `.md` as fallback for the current markdown-based pipeline

### Alternative: keep both
- `.md` template — for the existing markdown-based docx pipeline (current, working)
- `.html` template — for a future enhanced pipeline with proper formatting
- Both use the same `{{variable}}` syntax, so variable resolution code is shared
