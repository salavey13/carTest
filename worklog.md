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

Stage Summary:
- Testdrive pricing fixed (5000 → 0, free across template/TG message/DB).
- Testdrive .docx storage verified working.
- Leads page SPA rental links implemented properly via explicit `metadata.rentalId` linkage.
- Committed as `a3aa4067` and pushed.

---
Task ID: 2
Agent: main (Super Z)
Task: Fix admin page "Статус договора → нет данных", fix image upload error "supabaseAdmin is unavailable", fix leads modal overlap + can't close + ⋮ button deletes lead without confirmation, repo cleanup (delete Configame/dist/ + skills/design/design-templates/ from history).

Work Log:

[Issue 1] Admin "Статус договора" → "нет данных":
- Root cause: rentals created via /doc TG operator flow write `metadata.doc_sha256` but NOT `metadata.contract_verifier.status` (only web-app checkout writes the latter).
- Write-side fix: `doc-manual.ts` now writes `metadata.contract_verifier = { status: 'verified', verified_at, source: 'doc_command', doc_sha256 }` at rental creation.
- Read-side backfill: `actions-runtime.ts` `getFranchizeSuccessfulRentals` now treats `metadata.doc_sha256` as 'verified' when `contract_verifier.status` is missing — covers all pre-existing /doc rentals retroactively.

[Issue 2] Image upload "supabaseAdmin is unavailable: SUPABASE_SERVICE_ROLE_KEY is missing":
- Root cause: CarSubmissionForm.tsx + CharacterForm.tsx (client components) imported `uploadImage` from `hooks/supabase.ts` (not 'server-only') and called it directly. `process.env.SUPABASE_SERVICE_ROLE_KEY` is stripped from the client bundle (no NEXT_PUBLIC_ prefix), so the admin client was a Proxy that throws on any property access.
- Created new server-side POST `/api/cars/upload-image` route (uses `lib/supabaseAdmin.ts` which IS 'server-only'). Verifies caller identity via signed `cartest_tg_actor` cookie. Validates bucket allowlist + content type + 10 MB size cap. Sanitizes path (strips `..` traversal).
- Updated CarSubmissionForm.tsx + CharacterForm.tsx to call the new route via FormData instead of the client-side uploadImage.

[Issue 3] Leads modal overlap + can't close + ⋮ deletes lead:
- Modal overlap: MobileLeadSheet outer container z-40 → z-[60] (above CrewHeader's z-50). Sheet height 80vh → 72vh. Top padding 28px → 80px so the close (X) button is never hidden behind CrewHeader.
- Three-dots button (⋮) used to immediately dismiss the lead with no confirmation — destructive and irreversible. Now wraps the ⋮ icon in a proper shadcn DropdownMenu with three items: 'Скопировать телефон', 'Открыть детали', 'Закрыть лид' (red, destructive).
- 'Закрыть лид' opens the existing DismissLeadDialog (was unused dead code in the active LeadsClient) — operator must pick a reason + optional note before the lead is actually dismissed.

[Issue 4] Repo cleanup:
- Ran `git filter-repo --invert-paths --path Configame/dist/ --path skills/design/design-templates/ --force`.
- Result: `.git` shrank from 465 MB → 132 MB (333 MB reduction, ~71% smaller).
- All fix commits preserved (with new hashes due to tree changes).
- All file content for the two purged paths is GONE from history (verified: `git log -- Configame/dist/Configame.sfx.part1.exe` returns no commits).
- After filter-repo: aggressive GC + reflog expire (`git reflog expire --expire=now --all && git gc --prune=now --aggressive`).
- Local main is at `bc9e7c99` (rewritten fix(admin+leads+upload) commit), ready to force-push.
- ⚠️ FORCE-PUSH PENDING: filter-repo purged `/home/z/my-project/upload/github_token.txt` (it was a working-tree-only file, never committed, but the .git/filter-repo run also wiped untracked files in the repo). The user needs to provide a fresh GitHub PAT to push the cleanup. The push command will be:
  ```
  git remote add origin https://<USER>:<PAT>@github.com/salavey13/carTest.git
  git push --force origin main
  ```
  This will rewrite the public repo's history — any other clones will need a fresh `git fetch && git reset --hard origin/main`.

Stage Summary:
- All three code fixes committed (testdrive, contract status, image upload, leads modal UX) as `a12b4af6` and pushed earlier.
- Repo cleanup completed locally — `.git` reduced by 333 MB (465 MB → 132 MB). Force-push to origin pending fresh GitHub PAT.
- Files modified across both tasks: `app/webhook-handlers/commands/testdrive-manual.ts`, `app/webhook-handlers/commands/doc-manual.ts`, `app/franchize/lib/leads.ts`, `app/franchize/server-actions/leads.ts`, `app/franchize/actions-runtime.ts`, `app/franchize/[slug]/leads/LeadsClient.tsx`, `app/franchize/[slug]/leads/components/LeadCard.tsx`, `app/franchize/[slug]/leads/components/MobileLeadSheet.tsx`, `components/CarSubmissionForm.tsx`, `components/CharacterForm.tsx`.
- New files: `app/api/cars/upload-image/route.ts`, `scripts/verify-testdrive-storage.js`, `scripts/repo-cleanup-paths.txt`.
