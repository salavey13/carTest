# PRD: Full Testdrive Functionality Overhaul

**Status:** Draft
**Author:** Super Z (AI)
**Date:** 2026-08-09
**Target:** `/testdrive` bot command + `testdrive-manual.ts` + supporting infrastructure

---

## 1. Background & Problem Statement

The `/testdrive` command (`app/webhook-handlers/commands/testdrive-manual.ts`, 1134 lines) currently generates a DOCX contract and sends it to the operator — but it's missing **5 critical pieces of functionality** that the `/doc` command (rental + sale) already implements in `doc-manual.ts` (3525 lines):

| # | Feature | `/doc` (rental/sale) | `/testdrive` | Impact |
|---|---------|---------------------|--------------|--------|
| 1 | User secret data → `private.user_rental_secrets` | ✅ With `isCrewMember` check (chat_id NULL for crew) | ❌ Always sets chat_id to operator | Renter can NEVER claim data via QR |
| 2 | Contract artifact → `private.rental_contract_artifacts` | ✅ Full fields + `rental_id` FK | ⚠️ Partial fields, no rental_id | QR claim has nothing to link to |
| 3 | Lead creation → `public.franchize_intents` + `crew_todos` | ✅ `upsertFranchizeLead` + follow-up todos | ⚠️ Phone-as-userId bug, no todos | Lead appears on /leads page but can't be worked |
| 4 | QR code generation + send | ✅ `api.qrserver.com` + `sendPhoto` | ❌ None | Renter can't link Telegram account to saved data |
| 5 | Email to crew | ✅ Fire-and-forget `nodemailer` | ⚠️ Blocking `await nodemailer` | Vercel timeout risk |

**Goal:** Bring `/testdrive` to feature parity with `/doc` so testdrive leads flow through the same pipeline as rental/sale leads — visible on `/franchize/[slug]/leads`, claimable via QR, and emailed to the crew.

---

## 2. User Stories

### US-1: Operator runs /testdrive
As a crew operator, when I run `/testdrive` and walk a customer through the bike selection + document collection flow, the system should:
- Generate the testdrive DOCX contract (already works)
- Save the customer's passport/license data to `private.user_rental_secrets` with `chat_id = NULL` (so the customer can claim it later)
- Save the contract metadata to `private.testdrive_contract_artifacts` (new table) with full fields
- Create a lead on `/franchize/[slug]/leads` with `intentType: "test_drive"`, `stage: "contract_generated"`
- Create follow-up crew_todos for the testdrive (damage check, return confirmation)
- Generate a QR code encoding `testdrive_{bikeId}_{docSha256}` and send it as a photo
- Send the DOCX to the crew email
- Send the operator a success message with deep links

### US-2: Customer scans QR after testdrive
As a customer who just completed a testdrive, when I scan the QR code the operator shows me:
- The bot opens with `startapp=testdrive_{bikeId}_{docSha256}`
- The bot links my Telegram account to the saved testdrive data
- I see a pre-filled profile (name, phone, license) for future rentals
- The lead on `/franchize/[slug]/leads` updates to show me as the verified customer (not the operator)

### US-3: Crew views testdrive lead on /leads page
As a crew owner, when I open `/franchize/[slug]/leads`:
- Testdrive leads appear in the list with `intentType: "test_drive"`
- The lead card shows the customer's phone, bike, and testdrive date
- Clicking the lead opens the detail drawer with passport/license info pre-filled
- Follow-up todos (damage check, return) appear in the todo list
- When the customer later does a full rental, the pre-filled data speeds up the /doc flow

---

## 3. Technical Design

### 3.1 New Table: `private.testdrive_contract_artifacts`

**Migration SQL** (file: `supabase/migrations/20260809000000_create_testdrive_contract_artifacts.sql`):

```sql
-- Create testdrive_contract_artifacts table (mirrors rental_contract_artifacts
-- but without rental-specific fields like rent_start_date, rent_end_date,
-- daily_price, deposit_rub, sts_pledge_*).
-- A testdrive is a free 10-minute ride — no rental period, no deposit,
-- no STS pledge. The table exists so testdrive artifacts don't pollute
-- rental_contract_artifacts and so the QR claim flow can distinguish them.

create table if not exists private.testdrive_contract_artifacts (
  id uuid not null default gen_random_uuid (),
  contract_key text not null,
  requested_bike_id text null,
  resolved_bike_id text null,
  telegram_chat_id text null,
  telegram_message_id bigint null,
  customer_full_name text null,
  customer_passport text null,
  customer_passport_issued_by text null,
  customer_passport_issue_date text null,
  customer_registration text null,
  customer_driver_license text null,
  customer_birth_date text null,
  license_categories text null,
  testdrive_date text null,
  total_sum numeric null,
  original_sha256 text not null,
  doc_verifier_id uuid null,
  template_version integer null,
  created_at timestamp with time zone not null default now(),
  storage_path text null,
  crew_slug text not null,
  customer_phone text null,
  created_by_operator_chat_id text null,
  constraint testdrive_contract_artifacts_pkey primary key (id),
  constraint testdrive_contract_artifacts_contract_key_key unique (contract_key),
  constraint testdrive_contract_artifacts_doc_verifier_id_fkey
    foreign key (doc_verifier_id) references doc_verifier_records (id)
);

create index if not exists idx_testdrive_artifacts_key
  on private.testdrive_contract_artifacts using btree (contract_key) tablespace pg_default;

create index if not exists idx_testdrive_artifacts_sha256
  on private.testdrive_contract_artifacts using btree (original_sha256) tablespace pg_default;

create index if not exists idx_testdrive_artifacts_chat
  on private.testdrive_contract_artifacts using btree (telegram_chat_id)
  where (telegram_chat_id is not null) tablespace pg_default;

create index if not exists idx_testdrive_artifacts_storage_path
  on private.testdrive_contract_artifacts using btree (storage_path)
  where (storage_path is not null) tablespace pg_default;

create index if not exists idx_testdrive_artifacts_crew_slug
  on private.testdrive_contract_artifacts using btree (crew_slug) tablespace pg_default;

-- RLS policies (mirror rental_contract_artifacts)
alter table private.testdrive_contract_artifacts enable row level security;

create policy "Service role can read testdrive artifacts"
  on private.testdrive_contract_artifacts for select
  to service_role using (true);

create policy "Service role can insert testdrive artifacts"
  on private.testdrive_contract_artifacts for insert
  to service_role with check (true);

create policy "Service role can update testdrive artifacts"
  on private.testdrive_contract_artifacts for update
  to service_role using (true) with check (true);
```

**Design rationale — separate table vs reuse `rental_contract_artifacts`:**

The existing `testdrive-manual.ts` writes to `rental_contract_artifacts` (with `flow_type: "testdrive"` in metadata). This was a shortcut, but it causes problems:
- The `/leads` page aggregates from `rental_contract_artifacts` assuming all rows are rentals — testdrive rows pollute rental counts
- The QR claim RPC `claim_rental_by_qr` expects a `rental_id` FK (testdrive has none)
- Sale flow already has its own `sale_contract_artifacts` table — testdrive should follow the same pattern

**Alternative considered:** Add a `flow_type` column to `rental_contract_artifacts` and filter. Rejected because:
- The leads aggregation SQL would need `WHERE flow_type = 'rental'` everywhere
- The QR claim RPC would need conditional logic
- A separate table is cleaner and matches the sale pattern

### 3.2 New RPC: `claim_testdrive_by_qr`

**Migration SQL** (same file):

```sql
-- Lightweight RPC: links a testdrive artifact to the renter's Telegram account.
-- Unlike claim_rental_by_qr (which updates 6 tables), this only updates 2:
--   1. testdrive_contract_artifacts.telegram_chat_id → renter's chat_id
--   2. user_rental_secrets.chat_id → renter's chat_id
-- No rentals table (testdrive has no rental), no franchize_intents (lead already
-- created with operator's chat_id; we update it separately), no crew_todos
-- (todos are tied to lead_id, not chat_id).

create or replace function private.claim_testdrive_by_qr(
  p_doc_sha256 text,
  p_renter_chat_id text
) returns json as $$
declare
  v_artifact record;
  v_secrets_updated int;
begin
  -- Find the testdrive artifact by sha256
  select * into v_artifact
  from private.testdrive_contract_artifacts
  where original_sha256 = p_doc_sha256
  limit 1;

  if not found then
    return json_build_object('status', 'not_found');
  end if;

  -- Check if already claimed by a non-crew user
  if v_artifact.telegram_chat_id is not null
     and v_artifact.telegram_chat_id != p_renter_chat_id
     and v_artifact.telegram_chat_id != v_artifact.created_by_operator_chat_id then
    return json_build_object('status', 'already_claimed_by_other');
  end if;

  -- Update artifact
  update private.testdrive_contract_artifacts
  set telegram_chat_id = p_renter_chat_id
  where id = v_artifact.id;

  -- Update user_rental_secrets (if a secrets row exists with this doc_sha256)
  update private.user_rental_secrets
  set chat_id = p_renter_chat_id
  where doc_sha256 = p_doc_sha256
    and (chat_id is null or chat_id = v_artifact.created_by_operator_chat_id);

  get diagnostics v_secrets_updated = row_count;

  -- Update franchize_intents (link the lead to the renter)
  update public.franchize_intents
  set telegram_user_id = p_renter_chat_id
  where crew_slug = v_artifact.crew_slug
    and metadata->>'doc_sha256' = p_doc_sha256;

  return json_build_object(
    'status', 'ok',
    'artifact_id', v_artifact.id,
    'secrets_updated', v_secrets_updated,
    'customer_full_name', v_artifact.customer_full_name,
    'customer_phone', v_artifact.customer_phone
  );
end;
$$ language plpgsql security definer;
```

### 3.3 QR Code Deep Link Format

**Current rental format:** `https://t.me/oneBikePlsBot/app?startapp=rent_{bikeId}_{docSha256}`

**New testdrive format:** `https://t.me/oneBikePlsBot/app?startapp=testdrive_{bikeId}_{docSha256}`

**Why a new prefix (`testdrive_`) instead of reusing `rent_`:**

| Aspect | Reuse `rent_` | New `testdrive_` |
|--------|--------------|-----------------|
| Code changes | Minimal (testdrive writes to rental_contract_artifacts) | Moderate (new router branch + new claim action) |
| Data separation | Testdrive artifacts pollute rental table | Clean separation in `testdrive_contract_artifacts` |
| QR claim RPC | Reuses `claim_rental_by_qr` (6-table update — overkill for testdrive) | New `claim_testdrive_by_qr` (2-table update — lean) |
| Leads page | Rental aggregation includes testdrive rows (wrong counts) | Clean — testdrive rows in separate table |
| Future extensibility | Hard to add testdrive-specific fields | Easy — add columns to testdrive table |
| Semantic clarity | `rent_` prefix on a testdrive QR is confusing | `testdrive_` prefix is self-documenting |

**Decision:** Use `testdrive_` prefix. The moderate code cost is worth the clean separation.

### 3.4 Router Update: `hooks/useStartParamRouter.ts`

Add a new branch for `testdrive_` deep links:

```typescript
// Existing: rent_ and rental_ prefixes
if (paramToProcess.startsWith("rent_") || paramToProcess.startsWith("rental_")) {
  // ... existing rental claim flow ...
}
// NEW: testdrive_ prefix
else if (paramToProcess.startsWith("testdrive_")) {
  const { bikeId, docSha256 } = parseTestdriveDeepLink(paramToProcess);
  const result = await claimTestdriveSecretsAction(user_id, docSha256);
  // Route to testdrive confirmation page or bike page
}
```

**`parseTestdriveDeepLink`:**
```typescript
function parseTestdriveDeepLink(param: string): { bikeId: string; docSha256: string } {
  // Format: testdrive_{bikeId}_{docSha256}
  const parts = param.split("_");
  if (parts.length < 3) return { bikeId: "", docSha256: "" };
  return { bikeId: parts[1], docSha256: parts.slice(2).join("_") };
}
```

### 3.5 New Server Action: `claimTestdriveSecretsAction`

File: `app/franchize/server-actions/testdrive-secrets-claim.ts`

```typescript
"use server";

import { supabaseAdmin } from "@/hooks/supabase";

export async function claimTestdriveSecretsAction(
  renterChatId: string,
  docSha256: string
): Promise<{ success: boolean; status: string; customerName?: string; customerPhone?: string }> {
  const { data, error } = await supabaseAdmin
    .rpc("claim_testdrive_by_qr", {
      p_doc_sha256: docSha256,
      p_renter_chat_id: renterChatId,
    })
    .single();

  if (error) return { success: false, status: "error" };
  if (data.status === "not_found") return { success: false, status: "not_found" };
  if (data.status === "already_claimed_by_other") return { success: false, status: "already_claimed" };

  return {
    success: true,
    status: "ok",
    customerName: data.customer_full_name,
    customerPhone: data.customer_phone,
  };
}
```

### 3.6 testdrive-manual.ts Changes

The following changes bring `testdrive-manual.ts` to feature parity with `doc-manual.ts`:

#### 3.6.1 User Secret Data (`private.user_rental_secrets`)

**Current (broken):**
```typescript
await privateSchema().from("user_rental_secrets").insert({
  chat_id: String(userId),  // ← always operator's chat_id → blocks QR claim
  // ...
});
```

**Fixed:**
```typescript
import { isCrewMember } from "@/app/lib/user-rental-secrets";

const creatorIsCrewMember = await isCrewMember(String(userId), resolvedSlug);
const secretChatId = creatorIsCrewMember ? null : String(userId);

await privateSchema().from("user_rental_secrets").insert({
  chat_id: secretChatId,  // ← NULL for crew operators → renter can claim via QR
  crew_slug: resolvedSlug,
  doc_sha256: sha256,
  renter_full_name: context.fullName,
  renter_passport: `${context.passportSeries} ${context.passportNumber}`.trim(),
  renter_passport_issue_date: context.passportIssueDate,
  renter_passport_issued_by: context.passportIssuedBy,
  renter_registration: context.registrationAddress,
  renter_driver_license: `${context.licenseSeries} ${context.licenseNumber}`.trim(),
  renter_birth_date: context.birthDate,
  renter_phone: context.phone,
  source_doc_key: documentKey,
  verification_status: "verified",
  template_version: 1,
});
```

#### 3.6.2 Contract Artifact (`private.testdrive_contract_artifacts`)

**Current (writes to rental_contract_artifacts):**
```typescript
await privateSchema().from("rental_contract_artifacts").insert({
  // ... partial fields, flow_type: "testdrive" in metadata ...
});
```

**Fixed (writes to new testdrive table):**
```typescript
const dedupKey = `${resolvedSlug}_${context.fullName}_${bike.id}`;
const { data: existing } = await privateSchema()
  .from("testdrive_contract_artifacts")
  .select("id, storage_path")
  .eq("crew_slug", resolvedSlug)
  .eq("customer_full_name", context.fullName)
  .eq("requested_bike_id", bike.id)
  .maybeSingle();

if (existing) {
  // Backfill storage_path if missing, skip insert
  if (!existing.storage_path && storagePath) {
    await privateSchema().from("testdrive_contract_artifacts")
      .update({ storage_path: storagePath })
      .eq("id", existing.id);
  }
} else {
  await privateSchema().from("testdrive_contract_artifacts").insert({
    contract_key: dedupKey,
    crew_slug: resolvedSlug,
    storage_path: storagePath,
    original_sha256: sha256,
    requested_bike_id: bike.id,
    resolved_bike_id: bike.id,
    telegram_chat_id: String(userId),  // operator's chat_id (updated on QR claim)
    created_by_operator_chat_id: String(userId),
    customer_full_name: context.fullName,
    customer_passport: `${context.passportSeries} ${context.passportNumber}`.trim(),
    customer_passport_issued_by: context.passportIssuedBy,
    customer_passport_issue_date: context.passportIssueDate,
    customer_registration: context.registrationAddress,
    customer_driver_license: `${context.licenseSeries} ${context.licenseNumber}`.trim(),
    customer_birth_date: context.birthDate,
    license_categories: context.licenseCategories,
    testdrive_date: new Date().toISOString(),
    total_sum: 0,  // testdrive is free
    template_version: 1,
    customer_phone: context.phone,
  });
}
```

#### 3.6.3 Lead Creation (`public.franchize_intents` + `crew_todos`)

**Current (buggy — phone as userId):**
```typescript
const leadUserId = leadPhone || String(userId);  // ← bug
await upsertFranchizeLead({
  slug: resolvedSlug,
  userId: leadUserId,
  intentType: "test_drive",
  // ...
});
```

**Fixed:**
```typescript
const leadUserId = String(userId);  // ← always operator's chat_id (same as doc-manual)

const { leadId } = await upsertFranchizeLead({
  slug: resolvedSlug,
  userId: leadUserId,
  intentType: "test_drive",
  stage: "contract_generated",
  bikeId: bike.id,
  bikeTitle: `${bike.make} ${bike.model}`,
  phone: leadPhone || undefined,  // ← phone as separate field, not userId
  fullName: context.fullName,
  sourceRoute: "/testdrive",
  contactChannel: "telegram_bot",
  urgencyScore: 85,
  metadata: {
    dealType: "test_drive",
    operatorId: String(userId),
    docSha256: sha256,  // ← needed for QR claim to update this lead
    hasPassport: !!(context.passportSeries && context.passportNumber),
    hasLicense: !!(context.licenseSeries && context.licenseNumber),
  },
  ensureUser: true,
});

// NEW: Create follow-up todos (mirrors doc-manual pattern)
await createLeadFollowupTodos({
  slug: resolvedSlug,
  leadId,
  intentType: "test_drive",
  bikeTitle: `${bike.make} ${bike.model}`,
  assigneeId: String(userId),
});
```

**New testdrive todo set** (in `crew-todos.ts`):
```typescript
const TESTDRIVE_TODOS = [
  {
    title: "Проверить ТС после тест-драйва",
    category: "return_check",
    priority: "high",
    description: "Осмотреть мотоцикл на повреждения после тест-драйва",
  },
  {
    title: "Подтвердить возврат ТС",
    category: "return_confirmation",
    priority: "medium",
    description: "Зафиксировать возврат транспортного средства",
  },
  {
    title: "Связаться с клиентом для повторной аренды",
    category: "follow_up",
    priority: "low",
    description: "Уточнить, понравился ли тест-драйв, предложить аренду",
    due_offset_days: 1,  // due tomorrow
  },
];
```

#### 3.6.4 QR Code Generation

**New code (copy from doc-manual.ts lines 1481-1517, adapt prefix):**
```typescript
// Generate QR code with testdrive_ prefix
const qrDeepLink = `https://t.me/oneBikePlsBot/app?startapp=testdrive_${bike.id}_${sha256}`;

const qrAbort = new AbortController();
const qrTimeout = setTimeout(() => qrAbort.abort(), 8000);
try {
  const qrResp = await fetch(
    `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(qrDeepLink)}&color=000000&bgcolor=ffffff`,
    { signal: qrAbort.signal }
  );
  clearTimeout(qrTimeout);

  if (qrResp.ok) {
    const qrBuf = Buffer.from(await qrResp.arrayBuffer());
    // Send QR as separate photo
    const qrFormData = new FormData();
    qrFormData.append("chat_id", String(userId));
    qrFormData.append("photo", new Blob([qrBuf]), "qr.png");
    qrFormData.append("caption", `📲 QR для тест-драйва\n${qrDeepLink}`);

    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendPhoto`,
      { method: "POST", body: qrFormData }
    );
  }
} catch (qrErr) {
  logger.warn("[/testdrive] QR generation failed:", qrErr);
}
```

#### 3.6.5 Email Sending

**Current (blocking):**
```typescript
await transporter.sendMail({...});  // ← blocks, Vercel timeout risk
```

**Fixed (fire-and-forget, matches doc-manual):**
```typescript
import nodemailer from "nodemailer";  // ← top-of-file import (was inline require)

// ... in generateContract():
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || process.env.SMTP_YANDEX_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  auth: {
    user: process.env.SMTP_USER || process.env.SMTP_YANDEX_USER,
    pass: process.env.SMTP_PASS || process.env.SMTP_YANDEX_PASS,
  },
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 8000,
});

const crewEmail = crewSecrets.email || "vip_bike@mail.ru";

// Fire-and-forget — don't block the command on email
transporter.sendMail({
  from: process.env.EMAIL_FROM || crewEmail,
  to: crewEmail,
  subject: `Договор тест-драйва — ${bike.make} ${bike.model}`,
  text: `Клиент: ${context.fullName}\nТелефон: ${context.phone}\nБайк: ${bike.make} ${bike.model}\nДата: ${new Date().toLocaleString("ru-RU")}`,
  attachments: [{
    filename: docFileName,
    content: docxBuf,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }],
}).then(() => {
  logger.info("[/testdrive] Email sent to", crewEmail);
}).catch((err) => {
  logger.warn("[/testdrive] Email send failed:", err);
});
```

#### 3.6.6 Success Message with Deep Links

**Current (plain text + 1 button):**
```typescript
await sendComplexMessage(chatId, "✅ Договор готов", [[{ text: "🚀 Открыть", url: "..." }]]);
```

**Fixed (matches doc-manual pattern):**
```typescript
import { buildDocSuccessMessage } from "@/app/franchize/lib/notification-templates";

const successMsg = buildDocSuccessMessage({
  dealType: "test_drive",
  bikeTitle: `${bike.make} ${bike.model}`,
  customerName: context.fullName,
  customerPhone: context.phone,
  docSha256: sha256,
  documentKey,
  crewSlug: resolvedSlug,
});

await sendComplexMessage(chatId, successMsg.text, successMsg.buttons);
```

---

## 4. Leads Page Integration

### 4.1 Leads Aggregation SQL Update

The `/leads` page aggregates from `rental_contract_artifacts` and `sale_contract_artifacts`. Update `app/franchize/server-actions/leads.ts` to also aggregate from `testdrive_contract_artifacts`:

```sql
-- Add to the leads aggregation query:
SELECT
  -- ... existing fields ...
  COALESCE(
    (SELECT array_agg(row_to_json(r)) FROM (
      SELECT rental_id, status, bike_title, start_date, end_date, total_cost
      FROM rentals WHERE user_id = u.user_id
    ) r),
    '[]'::json
  ) AS rentals,
  COALESCE(
    (SELECT array_agg(row_to_json(s)) FROM (
      SELECT sale_id, bike_title, sale_price, created_at
      FROM sales WHERE buyer_user_id = u.user_id
    ) s),
    '[]'::json
  ) AS sales,
  -- NEW: testdrive history
  COALESCE(
    (SELECT array_agg(row_to_json(t)) FROM (
      SELECT
        t.customer_full_name,
        t.customer_phone,
        t.testdrive_date,
        b.make || ' ' || b.model AS bike_title,
        t.license_categories
      FROM private.testdrive_contract_artifacts t
      LEFT JOIN cars b ON t.resolved_bike_id = b.id::text
      WHERE t.telegram_chat_id = u.user_id
         OR t.created_by_operator_chat_id = u.user_id
      ORDER BY t.created_at DESC
    ) t),
    '[]'::json
  ) AS testdrives
FROM users u
-- ...
```

### 4.2 Lead Card Display

On the `/leads` page, testdrive leads should:
- Show with a "Тест-драйв" badge (similar to "Аренда" / "Покупка" badges)
- Show the testdrive date (not a rental period)
- Show the bike that was test-driven
- Show the customer's phone (if claimed via QR) or "(оператор)" if not yet claimed

### 4.3 Lead Detail Drawer

When opening a testdrive lead:
- Show passport/license info from `testdrive_contract_artifacts` (if the customer provided them)
- Show "Предзаполнено для аренды" section — the passport/license/phone from the testdrive can pre-fill a future `/doc` rental flow
- Show the testdrive DOCX download link (from `storage_path`)
- Show the follow-up todos (damage check, return, follow-up)

### 4.4 Pre-fill for Future Rental

When a customer who did a testdrive later starts a `/doc` rental flow:
1. `/doc` command checks `user_rental_secrets` by `chat_id` (renter's Telegram ID, set during QR claim)
2. If found, pre-fills the rental flow with the saved passport/license/phone
3. Operator sees "Данные из тест-драйва" pre-filled → faster rental creation
4. This is the "partially filled h to make future first rent easier" the user requested

---

## 5. QR Code Linking — Rental vs Testdrive

### 5.1 Current State

| Flow | Deep link prefix | Artifact table | Claim RPC | Router handler |
|------|-----------------|----------------|-----------|----------------|
| Rental | `rent_` | `rental_contract_artifacts` | `claim_rental_by_qr` (6-table) | `useStartParamRouter.ts` ✅ |
| Sale | `rent_` (bug — same as rental) | `sale_contract_artifacts` | `claim_rental_by_qr` (broken for sale) | `useStartParamRouter.ts` |
| Testdrive | (none) | `rental_contract_artifacts` (wrong table) | (none) | (none) |

### 5.2 Target State

| Flow | Deep link prefix | Artifact table | Claim RPC | Router handler |
|------|-----------------|----------------|-----------|----------------|
| Rental | `rent_` | `rental_contract_artifacts` | `claim_rental_by_qr` | ✅ existing |
| Sale | `sale_` (new — future PRD) | `sale_contract_artifacts` | `claim_sale_by_qr` (future) | future |
| Testdrive | `testdrive_` | `testdrive_contract_artifacts` | `claim_testdrive_by_qr` | NEW |

### 5.3 Router Branch Logic

```
startapp param →
  if startsWith("rent_") or startsWith("rental_") →
    parseRentDeepLink() → claimRentalSecretsAction() → claim_rental_by_qr RPC
  else if startsWith("testdrive_") →              ← NEW
    parseTestdriveDeepLink() → claimTestdriveSecretsAction() → claim_testdrive_by_qr RPC
  else if startsWith("sale_") →                   ← FUTURE
    parseSaleDeepLink() → claimSaleSecretsAction() → claim_sale_by_qr RPC
  else →
    existing handlers (configurator, etc.)
```

---

## 6. Implementation Plan

### Phase 1: Database (1 migration)
- [ ] Create `supabase/migrations/20260809000000_create_testdrive_contract_artifacts.sql`
  - [ ] `private.testdrive_contract_artifacts` table
  - [ ] `claim_testdrive_by_qr` RPC
  - [ ] RLS policies
  - [ ] Indexes

### Phase 2: QR Claim Infrastructure
- [ ] Create `app/franchize/server-actions/testdrive-secrets-claim.ts`
  - [ ] `claimTestdriveSecretsAction(renterChatId, docSha256)`
- [ ] Update `hooks/useStartParamRouter.ts`
  - [ ] Add `parseTestdriveDeepLink()`
  - [ ] Add `testdrive_` branch
  - [ ] Route to testdrive confirmation page after claim

### Phase 3: testdrive-manual.ts Overhaul
- [ ] Fix `user_rental_secrets` insert (add `isCrewMember` check, `chat_id = NULL` for crew)
- [ ] Change artifact insert from `rental_contract_artifacts` → `testdrive_contract_artifacts`
- [ ] Fix lead creation (use `String(userId)` not `leadPhone || String(userId)`)
- [ ] Add `docSha256` to lead metadata (needed for QR claim to find the lead)
- [ ] Add `createLeadFollowupTodos` call with testdrive todo set
- [ ] Add testdrive todo definitions to `crew-todos.ts`
- [ ] Add QR code generation block (copy from doc-manual, adapt prefix to `testdrive_`)
- [ ] Add QR photo send via `sendPhoto`
- [ ] Fix email: move `nodemailer` import to top of file, make fire-and-forget
- [ ] Replace success message with `buildDocSuccessMessage` (adapted for testdrive)
- [ ] Add admin audit message with `buildDocAdminAuditMessage`

### Phase 4: Leads Page Integration
- [ ] Update `app/franchize/server-actions/leads.ts` to aggregate from `testdrive_contract_artifacts`
- [ ] Update `LeadRow` type to include `testdrives` array
- [ ] Update `LeadCard` component to show "Тест-драйв" badge
- [ ] Update `LeadDetailDrawer` to show testdrive info + pre-fill section
- [ ] Add `intentType: "test_drive"` to the leads pipeline stages and board columns

### Phase 5: Pre-fill for Future Rental
- [ ] Update `/doc` command to check `user_rental_secrets` by `chat_id` at flow start
- [ ] If secrets found, pre-fill `context.fullName`, `context.phone`, `context.passport*`, `context.license*`
- [ ] Show operator "Данные из тест-драйва" banner with option to edit

### Phase 6: Testing & Verification
- [ ] Run migration on staging Supabase
- [ ] Test `/testdrive` end-to-end: operator creates testdrive → DOCX generated → secrets saved → artifact saved → lead created → todos created → QR generated → email sent
- [ ] Test QR claim: renter scans QR → `claim_testdrive_by_qr` runs → lead updates → secrets claimed
- [ ] Test leads page: testdrive lead appears with correct badge + info
- [ ] Test pre-fill: renter who did testdrive starts `/doc` → fields pre-filled
- [ ] Test dedup: same operator + same customer + same bike → no duplicate artifact

---

## 7. Files to Create/Modify

### New files:
1. `supabase/migrations/20260809000000_create_testdrive_contract_artifacts.sql` — table + RPC + RLS
2. `app/franchize/server-actions/testdrive-secrets-claim.ts` — claim server action

### Modified files:
1. `app/webhook-handlers/commands/testdrive-manual.ts` — 5 major changes (secrets, artifact, lead, QR, email)
2. `app/franchize/server-actions/crew-todos.ts` — add testdrive todo set
3. `hooks/useStartParamRouter.ts` — add `testdrive_` branch
4. `app/franchize/server-actions/leads.ts` — aggregate from testdrive table
5. `app/franchize/[slug]/leads/leads-types.ts` — add `testdrives` to `LeadRow`
6. `app/franchize/[slug]/leads/leads-constants.ts` — add `test_drive` to SOURCE_META, BOARD_COLUMNS
7. `app/franchize/[slug]/leads/components/LeadCard.tsx` — show testdrive badge
8. `app/franchize/[slug]/leads/components/LeadDetailDrawer.tsx` — show testdrive info + pre-fill section
9. `app/webhook-handlers/commands/doc-manual.ts` — pre-fill from `user_rental_secrets` at flow start
10. `app/franchize/lib/notification-templates.ts` — add `test_drive` case to `buildDocSuccessMessage`

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Migration fails on production Supabase | Test on staging first; migration is idempotent (`if not exists`) |
| QR code API (`api.qrserver.com`) is down | Add fallback: generate QR client-side with `qrcode` npm package (already in dependencies) |
| `claim_testdrive_by_qr` RPC has security hole | `security definer` + RLS on table; RPC only updates rows where `created_by_operator_chat_id` matches or `telegram_chat_id IS NULL` |
| Pre-fill leaks customer data to wrong renter | `user_rental_secrets` is keyed by `doc_sha256` (unique); pre-fill only fires when `chat_id` matches the current user |
| Testdrive leads flood the /leads page | Add `intentType` filter to /leads page (already exists as "segment" filter — just add `test_drive` segment) |
| Email SMTP timeout blocks the bot | Fire-and-forget pattern (no `await`); 8s socket timeout; logger.warn on failure |
| Existing testdrive artifacts in `rental_contract_artifacts` | Migration includes data backfill: `INSERT INTO testdrive_contract_artifacts SELECT ... FROM rental_contract_artifacts WHERE metadata->>'flow_type' = 'testdrive'` |

---

## 9. Out of Scope (Future PRDs)

- Sale flow QR linking (`sale_` prefix) — separate PRD
- Testdrive-to-rental conversion flow (button on testdrive lead to start `/doc` pre-filled)
- Testdrive analytics dashboard (conversion rate, popular bikes)
- Testdrive duration tracking (actual vs. 10-minute limit)
- Testdrive damage report photo upload
- Multi-bike testdrive (customer test-drives 2+ bikes in one session)

---

## 10. Acceptance Criteria

- [ ] `/testdrive` generates DOCX, saves to `testdrive_contract_artifacts` (not `rental_contract_artifacts`)
- [ ] `/testdrive` saves customer data to `user_rental_secrets` with `chat_id = NULL` for crew operators
- [ ] `/testdrive` creates a lead on `/franchize/[slug]/leads` with `intentType: "test_drive"`
- [ ] `/testdrive` creates 3 follow-up todos (damage check, return, follow-up)
- [ ] `/testdrive` generates a QR code with `testdrive_` prefix and sends it as a photo
- [ ] `/testdrive` sends the DOCX to the crew email (fire-and-forget, no timeout)
- [ ] Renter scans QR → `claim_testdrive_by_qr` RPC runs → lead + secrets + artifact update to renter's chat_id
- [ ] Testdrive lead appears on `/leads` page with "Тест-драйв" badge
- [ ] Lead detail drawer shows testdrive info + pre-fill section
- [ ] `/doc` pre-fills from `user_rental_secrets` when renter has a prior testdrive
- [ ] No regression in existing rental/sale flows
