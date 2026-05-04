# Configurator Order Contract (R4 skeleton)

Scope: `RENT-P1.3` / SupaPlan `0347b91a-73c1-4a24-837c-9c0d9f5dc987`.

## Goal
Provide a minimal, explicit contract for EV order configurator flow before full procurement/doc pipeline implementation.

## Phase-1 payload contract
`POST` payload (client -> action) must include:
- `crewSlug: string`
- `userId: string`
- `baseModel: string`
- `parts: Array<{ partType: string; chinaPartId: string; name: string; price?: number }>`
- `colors: { primary?: string; secondary?: string; accent?: string; chinaColorCode?: string }`
- `notes?: string`

## Phase-1 response contract
- `{ success: true, data: { draftId: string, status: "draft" } }`
- `{ success: false, error: string }`

## Status lifecycle target
`draft -> submitted -> approved -> ordered -> delivered` (+ `cancelled`).

## Doc linkage target
Scope convention for verifier/doc records: `bike_order:{draftId}`.

## Non-goals in this skeleton
- Supplier sync
- Final DOCX generation template completion
- Multi-party approval orchestration
