# RENT-P0.2 — Rental contract E2E wiring (DOCX → doc-verifier → rental record attachment)

- **Task UUID:** `0642f801-4e7e-4620-90fa-ca4ecab9f206`
- **Capability:** `franchize.backend.supabase`
- **Scope:** `app/franchize/[slug]/rental/[id]/*`
- **Status:** `completed` ✅
- **Completed at:** `2026-05-04`

## Delivered

- [x] Investigated and documented integration points for:
  - DOCX generation capability (`buildFranchizeDocxFromTemplate`)
  - `doc-verifier` registration/verification storage path
  - buy/rent order flow contract attachment step
  - configurator flow verifier registration
- [x] Added guardrail logging in rental attachment path (`buildFranchizeOrderDocAndNotify`) for:
  - rental lookup errors,
  - rental-not-found by `metadata.orderId`,
  - rental metadata update failures.
- [x] Normalized rental-card verifier status parsing (`verified|ok|valid` => verified; explicit `expired` respected).
- [x] Surfaced verifier diagnostics on rental card:
  - `sourceScope`
  - `originalSha256`
- [x] Added reconciliation server action:
  - `reconcileRentalContractVerifierAttachment({ rentalId, orderId?, flowType?, slug? })`
  - backfills `rentals.metadata.contract_verifier` using `doc_verifier_records` lookup by `(integration_scope, document_key)`.

## Final contract shape (runtime)

`rentals.metadata.contract_verifier` expected fields:

- `scope: string` — canonical rental scope (`rental:<rental_id>`)
- `sourceScope: string` — source order scope (`<flowType>:<slug>:<orderId>`)
- `documentKey: string` — deterministic key (`rental-<slug>-<orderId>` or `sale-...`)
- `docVerifierRecordId: string | null`
- `originalSha256: string`
- `status: "verified" | "not_verified" | "expired"`
- `verifiedAt: ISO timestamp`
- `expiresAt: ISO timestamp | null`

## Notes

- Configurator flow intentionally registers DOCX in verifier without rental attachment, since it is pre-order lead flow.
- Reconciliation action is idempotent for same record pair and can be used by operator tooling/cron to repair partial failures.
- This `todo.md` is kept intentionally as a scoped execution artifact for RENT-P0.2 traceability; do not delete unless task-tracking policy changes.
