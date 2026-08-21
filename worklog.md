---
Task ID: 1
Agent: main (Super Z)
Task: Pull main, fix testdrive pricing (5000 → free), verify testdrive docx is saved to storage, implement leads-page SPA rental links properly, list biggest files in repo for removal.

Work Log:
- Pulled `origin/main` from `github.com/salavey13/carTest`.
- Explored codebase for testdrive pricing (`TESTDRIVE_PRICE` constant), testdrive .docx storage pipeline (`uploadDocxToStorage` → bucket `rental-contracts`), and leads page rental-link rendering (`DealsPanel.tsx` + `getFranchizeLeads`).
- Verified via `scripts/verify-testdrive-storage.js` that 6 testdrive .docx files exist in Supabase Storage bucket `rental-contracts` under `vip-bike/` prefix, all HEAD requests return 200, sizes ~11.5 KB. Storage upload IS working.
- Changed `TESTDRIVE_PRICE = 5000` → `0` in `app/webhook-handlers/commands/testdrive-manual.ts` (line 39). Testdrive is free; this flows into `total_sum` column in `testdrive_contract_artifacts`, into the TG confirmation message, and into the docx template vars (which the template doesn't render).
- Updated the TG operator confirmation message from `💰 5 000 ₽` to `🆓 Бесплатно (10 минут)` — clearer for operator.
- Added `linkTestdriveIntentsToRental()` helper in `app/franchize/lib/leads.ts` — looks up existing `test_drive` franchize_intents for the same crew + bike + customer (matched by phone OR telegram_user_id) and backfills `metadata.rentalId` + `metadata.convertedToRentalAt` + sets stage to `closed`. Idempotent: skips intents already linked to a different rental.
- In `app/webhook-handlers/commands/doc-manual.ts`, after creating the rental and upserting the rent intent:
  - Added `rentalId` to the rent intent's metadata (explicit FK link from intent → rental).
  - Called `linkTestdriveIntentsToRental()` to convert any pre-existing test_drive intents for the same customer+bike into closed, rental-linked intents.
- In `app/franchize/server-actions/leads.ts`:
  - Added `original_sha256` to the testdrive_contract_artifacts query (was missing — needed to back-link to franchize_intents via metadata.docSha256).
  - Added a new step "6.5" backfill pass: for each testdrive artifact, looks up its `original_sha256` in the franchize_intents metadata (where docSha256 matches), reads `metadata.rentalId`, finds the rental by id (already fetched in step 4), and attaches the rental to the testdrive artifact lead (deduped by rentalId). This catches the case where /testdrive and /doc operators entered the customer phone in different formats and phone-matching fails.
- Ran `npx tsc -p tsconfig.franchize.json --noEmit` — strict franchize slice passes (exit 0). My new code introduces no new TypeScript errors in the strict slice.
- Analyzed repo size: total tracked files ~250 MB, biggest culprits are `Configame/dist/*.exe + *.rar` (74 MB Windows installer binaries, not used by Next.js app), `skills/design/design-templates/` (54 MB HTML design templates), `public/supabase-mirror/carpix/` (41 MB bike photos mirrored from Supabase — should be served from Supabase directly), `public/images/portfolio-img*.jpeg` (12.7 MB), `books/geom.pdf + alg.pdf` (8.3 MB), and `app/franchize/[slug]/cart/megacart.png` (1.23 MB).

Stage Summary:
- Testdrive pricing fixed (5000 → 0, free across template/TG message/DB).
- Testdrive .docx storage verified working (6 files present in bucket `rental-contracts`, all downloadable).
- Leads page SPA rental links implemented properly via explicit `metadata.rentalId` linkage: write-side in `/doc-manual` backfills test_drive intents; read-side in `getFranchizeLeads` step 6.5 uses the linkage to attach the rental to the testdrive artifact lead (robust to phone-format mismatches).
- Repo size audit complete — top removal candidates identified for the user.
- Files modified: `app/webhook-handlers/commands/testdrive-manual.ts`, `app/webhook-handlers/commands/doc-manual.ts`, `app/franchize/lib/leads.ts`, `app/franchize/server-actions/leads.ts`.
- New file: `scripts/verify-testdrive-storage.js` (storage verification tool, kept for future audits).
- Ready to commit and push to `main`.
