---
name: commercial-proposal-from-offer
description: Commercial proposal generation for rental/sale/test-drive/corporate offers
---

# Commercial Proposal Generator

Trigger phrases: **`создай коммерческое предложение`**, **`сделай кп`**, **`коммерческое предложение для`**

## Overview

Generates formal commercial proposals (Коммерческое предложение / КП) for VIP Bike services including rental packages, motorcycle sales, test-drives, and corporate partnerships. The proposal is delivered as a formatted DOCX document via Telegram.

## When to Use

Use this skill when:
- Client requests a formal commercial proposal for motorcycle rental services
- Corporate client needs pricing for long-term partnership or fleet rental
- Sales lead requests detailed offer for motorcycle purchase
- Test-drive proposal is needed for B2B clients

## CLI Usage

```bash
# Basic usage
node scripts/make-commercial-proposal-skill.mjs --offerType rent --clientName "ООО Вектор" --telegramChatId 123456

# With custom pricing
node scripts/make-commercial-proposal-skill.mjs --offerType corporate --clientName "Иванов И.И." --totalPrice 500000 --telegramChatId 123456

# With custom validity period
node scripts/make-commercial-proposal-skill.mjs --offerType sale --clientName "Компания Рога и Копыта" --validityDays 14 --telegramChatId 123456

# With crew-specific details (loads organization info from crew_secrets)
node scripts/make-commercial-proposal-skill.mjs --offerType rent --clientName "Петров П.П." --userId 123456 --telegramChatId 789
```

## Input/Output Contracts

### Required Inputs

- `--offerType`: Offer type - "rent", "sale", "test-drive", "corporate", or "custom"
- `--clientName`: Client organization or individual name
- `--telegramChatId`: Telegram chat ID for document delivery

### Optional Inputs

- `--userId`: User ID to determine crew membership (for loading crew-specific organization details)
- `--crewSlug`: Direct crew slug override (skips crew lookup)
- `--validityDays`: Proposal validity period in days (default: 30)
- `--warrantyMonths`: Warranty period in months (default: 12)
- `--totalPrice`: Total offer price in rubles (required for auto-generated pricing table)
- `--offerSummary`: Brief description of the offer
- `--pricingTable`: Custom pricing table HTML (alternative to totalPrice)
- `--offerDescription`: Detailed offer description
- `--specialConditions`: Special conditions text
- `--paymentTerms`: Payment terms (default: "100% предоплата")
- `--deliveryTerms`: Delivery terms (default: "в течение 5 рабочих дней")
- `--saveMetadata`: Set to "1" to save metadata to Supabase

### Output

- Generated DOCX document delivered via Telegram
- JSON result with:
  - `proposalKey`: Unique proposal identifier
  - `docFileName`: Generated document filename
  - `originalSha256`: Document hash for verification
  - `totalPrice`: Price information (if provided)
  - `validityDays`: Validity period
  - `crewSlug`: Crew used for organization details

## Integration Patterns

### Crew Secrets Loading

The script automatically loads organization details from `private.crew_secrets`:

1. Determines crew membership via `crew_members` table using `--userId`
2. Loads `contract_defaults` from `crew_secrets`
3. Uses organization name, bank details, contact info for proposal

Fallback to "vip-bike" crew if no membership found.

### Template System

Uses HTML template at `docs/COMMERCIAL_PROPOSAL_TEMPLATE.html` with `{{variable}}` placeholders:

- Organization details (name, bank, contacts)
- Client information
- Pricing table
- Terms and conditions
- Validity period

### Document Generation Pipeline

1. Load HTML template
2. Replace placeholders with variables
3. Convert HTML to DOCX via `htmlToDocxElements`
4. Deliver via Telegram Bot API
5. Optional: Save metadata to Supabase

## Examples

### Rental Proposal for Corporate Client

```bash
node scripts/make-commercial-proposal-skill.mjs \
  --offerType corporate \
  --clientName "ООО ТехноПром" \
  --totalPrice 250000 \
  --validityDays 45 \
  --paymentTerms "50% предоплата, 50% upon completion" \
  --specialConditions "Предусмотрена гибкая система скидок для постоянных клиентов" \
  --telegramChatId 123456789
```

### Sales Proposal

```bash
node scripts/make-commercial-proposal-skill.mjs \
  --offerType sale \
  --clientName "Иванов Иван Иванович" \
  --totalPrice 310000 \
  --warrantyMonths 24 \
  --telegramChatId 123456789
```

## Russian Language Triggers

- "создай коммерческое предложение для <клиент>"
- "сделай кп по аренде"
- "коммерческое предложение на продажу"
- "сформируй коммерческое предложение"

## Error Handling

- `offer_type`: Invalid or missing offer type
- `client_parse`: Missing client name
- `telegram_parse`: Missing Telegram chat ID
- `template_read`: HTML template file not found
- `doc_generation`: HTML to DOCX conversion failed
- `telegram_delivery`: Document delivery failed
- `metadata_write`: Supabase metadata save failed

## Related Files

- Template: `docs/COMMERCIAL_PROPOSAL_TEMPLATE.html`
- Script: `scripts/make-commercial-proposal-skill.mjs`
- Crew secrets: `app/lib/private-secrets.ts`
- HTML conversion: `lib/htmlToDocx.mjs`
