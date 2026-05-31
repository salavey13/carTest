# Codex Run 4: THE MEGA RUN — Execute Everything Until Done

## Mission

**You are executing the ENTIRE remaining roadmap for the VIP Bike Rental 1-Click Next Rent feature.** Every unchecked checkbox in `docs/TODO-1-click-next-rent.md` is your target. Execute tasks in dependency order, check off each checkbox inline in the TODO as you complete it, append a diary entry to `docs/THE_FRANCHEEZEPLAN.md` per logical group, and keep going until you run out of context or complete everything.

**Priorities**: Task B (QR) → Bug M3/D1 → 3.1 (access tiers) → Task E (deep-link) → Task J (time picker) → Task F (picker UI) → Task L (hot-stage) → Task G (profile) → 3.2 (VIP status) → 3.3 (VIP flow) → 4.0–4.4 (OCR pipeline)

**Rule**: After completing each task, immediately update `docs/TODO-1-click-next-rent.md` — change `- [ ]` to `- [x]` for every sub-item you implemented. This is your progress checkpoint. If you get interrupted, the TODO shows exactly where you stopped.

---

## ALREADY COMPLETE (do NOT redo)
- Task A ✅, Task C ✅, Task D ✅, Task H ✅, Task I ✅, Task K ✅, Task M (M1+M2) ✅
- Phase 1 investigations ✅

---

## TASK B: QR Code Alongside Rental Contract

### Why This Matters
When a client receives their rental contract (DOCX), they currently just get a document. The QR code is the **gateway to VIP Club** — scan once, agree to ФЗ-152, link your profile, and never photograph documents again.

### B.1: QR URL format
```
https://t.me/oneBikePlsBot/app?startapp=rent_{bike_id}_{doc_sha256}
```
- `bike_id` = `cars.id` (slug like `kawasaki-ex650k`, NOT UUID)
- `doc_sha256` = SHA256 hex from `originalSha256` (already computed in both pipelines)
- Uses `rent_` prefix (already in router for `/api/startapp/vehicle?flow=rent`)
- 3-part format `rent_{bikeId}_{docSha}` must NOT break existing `rent_{bikeId}` (2-part) or `rental-{id}` parsing

### B.2: Install `qrcode` npm package
Add `qrcode` to `package.json`. Local QR generation — no network dependency.
```javascript
import QRCode from 'qrcode';
const qrPngBuffer = await QRCode.toBuffer(qrUrl, {
  type: 'png', width: 512, margin: 2,
  color: { dark: '#000000', light: '#ffffff' }
});
```

### B.3: Update skill script (`scripts/make-rental-contract-skill.mjs`)

After computing `originalSha256` (line ~398), replace the `sendDocument` call with `sendMediaGroup`:

1. Construct QR URL:
```javascript
const bikeSlug = bike.id;
const qrUrl = `https://t.me/oneBikePlsBot/app?startapp=rent_${bikeSlug}_${originalSha256}`;
```

2. Generate QR PNG:
```javascript
import QRCode from 'qrcode';
const qrPngBuffer = await QRCode.toBuffer(qrUrl, {
  type: 'png', width: 512, margin: 2,
  color: { dark: '#000000', light: '#ffffff' }
});
```

3. Send DOCX + QR via `sendMediaGroup`:
```javascript
const telegramMediaUrl = `https://api.telegram.org/bot${token}/sendMediaGroup`;
const form = new FormData();
form.append('chat_id', telegramChatId);
const mediaJson = JSON.stringify([
  { type: 'document', media: 'attach://docx', caption: `📄 Договор аренды — ${bike.make} ${bike.model}\n🔗 ${qrUrl}` },
  { type: 'photo', media: 'attach://qr' }
]);
form.append('media', mediaJson);
form.append('docx', new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}), docFileName);
form.append('qr', new Blob([qrPngBuffer], {type:'image/png'}), `qr-${bikeSlug}.png`);
const res = await fetch(telegramMediaUrl, { method: 'POST', body: form });
```

4. **Fallback**: If `sendMediaGroup` fails, send DOCX alone via the existing `sendDocument` pattern. Doc delivery > QR delivery.

5. Add to result: `result.qrUrl = qrUrl; result.qrSent = true;`

### B.4: Update web-app pipeline (`app/franchize/actions-runtime.ts`)

Current: `sendTelegramDocument` from `@/app/actions`. New: also send QR alongside.

1. Create `sendTelegramMediaGroup` helper (in same file as `sendTelegramDocument` lives, or local in actions-runtime.ts):
```typescript
async function sendTelegramMediaGroup(
  chatId: string, documentBlob: Blob, documentFileName: string,
  photoBlob: Blob, photoFileName: string, caption?: string
): Promise<{ success: boolean; error?: string }>
```

2. After SHA256 is computed (already available as `sha256`), generate QR:
```typescript
import QRCode from 'qrcode';
const bikeSlug = payload.vehicleId || '';
const qrUrl = `https://t.me/oneBikePlsBot/app?startapp=rent_${bikeSlug}_${sha256}`;
const qrPngBuffer = await QRCode.toBuffer(qrUrl, { type:'png', width:512, margin:2, color:{dark:'#000000',light:'#ffffff'} });
```

3. Replace `sendTelegramDocument` loop:
```typescript
for (const recipientId of recipientSet) {
  const sendResult = await sendTelegramMediaGroup(recipientId, new Blob([bytes]), docFileName, new Blob([qrPngBuffer]), `qr-${bikeSlug}.png`, `📄 Договор аренды\n🔗 ${qrUrl}`);
  if (!sendResult.success) {
    await sendTelegramDocument(recipientId, new Blob([bytes]), docFileName); // fallback
  }
}
```

### B.5: QR URL safety
- If bike slug contains underscores, parse from the RIGHT: split on last `_` — before = bikeId, after = docSha (always 64 hex chars). Validate docSha length.
- `rent_` prefix distinct from `rental-` prefix. No collision.
- QR never expires unless doc revoked.

**Check off all Task B checkboxes in TODO after completing.**

---

## BUG M3: PostgREST FK Disambiguation (ONE-LINER)

In `app/franchize/actions-runtime.ts`, `getFranchizeSuccessfulRentals`:
```typescript
// BEFORE (broken — rentals has user_id AND owner_id FKs to users):
.select("...user:users(user_id, full_name, username, metadata)")

// AFTER (explicit FK):
.select("...user:users!rentals_user_id_fkey(user_id, full_name, username, metadata)")
```
If `rentals_user_id_fkey` doesn't work, try `users!user_id(...)` as fallback.

**Check off Bug M3 in TODO.**

---

## BUG D1: `renter_address` null in web-app pipeline (ONE-LINER)

In `app/franchize/actions-runtime.ts`, `buildFranchizeOrderDocAndNotify`:
```typescript
// BEFORE:
renter_address: null,
// AFTER:
renter_address: variables.renter_address || null,
```

Add to Task D section in TODO and check off.

---

## PHASE 3.1: Bike Access Tiers — `access_tier` Field + Utility

### 3.1a: Add `access_tier` to gold seed CSV

File: `download/cars_rows_7bikes_golden.csv`

Add `"access_tier"` to each bike's `specs` JSON:

| Bike ID | `specs.license_class` | `specs.access_tier` |
|---------|----------------------|---------------------|
| falcon-gt-2025 | "М (49 сс), подходят права В или А1" | `"entry"` |
| falcon-pro-2025 | "М (49 сс), подходят права В или А1" | `"entry"` |
| horwin-sk3-plus | "125 сс (A1 / B)" | `"mid"` |
| sequence-zero | "А (электро 30 кВт, экв. 125 сс+)" | `"pro"` |
| y-volt-surge-v | "А (электро 35 кВт, экв. 125 сс+)" | `"pro"` |
| ducati-panigale-s | "М (49 сс), достаточно прав В или М1" | `"entry"` |
| kawasaki-ex650k | "А / L3" | `"pro"` |

### 3.1b: Create `lib/derive-access-tier.ts`

```typescript
export type AccessTier = "entry" | "mid" | "pro";

export function deriveAccessTier(licenseClass: string): AccessTier {
  if (!licenseClass || typeof licenseClass !== "string") return "entry";
  const lc = licenseClass.toUpperCase();
  // Pro: Russian "А" category (full motorcycle)
  if (/^А\s*[\/(]/.test(lc) || /^А$/.test(lc.trim())) return "pro";
  // Mid: A1 or 125cc
  if (/A1/.test(lc) || /125\s*СС/.test(lc)) return "mid";
  // Entry: everything else (М category)
  return "entry";
}

export function deriveUserAccessTier(categories: string[]): AccessTier {
  if (!categories || categories.length === 0) return "entry";
  const upper = categories.map(c => c.toUpperCase().trim());
  if (upper.some(c => c === "A")) return "pro";
  if (upper.some(c => ["A1", "B", "M", "B1"].includes(c))) return "mid";
  return "entry";
}

export function canAccessTier(userTier: AccessTier, requiredTier: AccessTier): boolean {
  const tierLevel: Record<AccessTier, number> = { entry: 1, mid: 2, pro: 3 };
  return tierLevel[userTier] >= tierLevel[requiredTier];
}
```

### 3.1c: Use in bike queries with backward compat

```typescript
import { deriveAccessTier, type AccessTier } from "@/lib/derive-access-tier";
const accessTier: AccessTier = bike.specs?.access_tier || deriveAccessTier(bike.specs?.license_class || "");
```

**Check off all 3.1 checkboxes in TODO.**

---

## TASK E: QR Deep-Link Parsing & Data Auto-fill

### E.1: Parse `startParam` — extend existing `rent_` handler

Find the existing deep-link handler (search `startParam`, `start_param`, `rent_`). Extend it:

```typescript
// Existing: rent_{bikeId} → 2-part format
// New: rent_{bikeId}_{docSha} → 3-part format
function parseRentStartParam(startParam: string): { bikeId: string; docSha?: string } | null {
  if (!startParam.startsWith("rent_")) return null;
  const rest = startParam.slice(5); // after "rent_"

  // Try 3-part: if last segment is 64 hex chars, it's a docSha
  const lastUnderscore = rest.lastIndexOf("_");
  if (lastUnderscore > 0) {
    const possibleSha = rest.slice(lastUnderscore + 1);
    if (/^[0-9a-f]{64}$/.test(possibleSha)) {
      return { bikeId: rest.slice(0, lastUnderscore), docSha: possibleSha };
    }
  }

  // 2-part fallback: just bikeId
  return { bikeId: rest };
}
```

Must NOT break existing `rental-${id}` parsing (different prefix).

### E.2: Authenticate via `useTelegramAuth` → `chat_id`

### E.3: Lookup renter data from `private.user_rental_secrets`

```typescript
if (docSha) {
  const secrets = await getUserRentalSecretsByDocSha(docSha);
  if (secrets && secrets.chat_id === currentChatId && secrets.verification_status === "verified") {
    // Auto-fill rental form with secrets data
    prefillData = secrets;
  }
}
```

### E.4: Pre-fill rental form, skip doc photographing step

### E.5: Allow edit of any pre-filled field before submission

### E.6: First-time renter flow (no matching data): bike pre-selected, no auto-fill

### E.7: Error states — implement ALL:

| Scenario | Behavior |
|----------|----------|
| QR scanned by different user | Open rental with bike pre-selected, no auto-fill |
| Doc revoked | Error: "Документ аннулирован" → manual rental |
| Bike no longer in fleet | Error: "Мотоцикл не доступен" → suggest alternatives |
| Stale data (old rental) | Show with date context: "Данные от DD.MM.YYYY" |
| Multiple rentals for same user | Show picker (Task F) |
| No rental history | Standard rental flow |

**Check off all Task E checkboxes in TODO.**

---

## TASK J: Web-App Duration & Time Picker

### J.1: Add date/time picker for start+end dates (precise to hours)

Find the checkout form. Currently has quick preset buttons ("1 день", "3 дня", "неделя"). Add:
- Date input for start date
- Time input (hours) for start time
- Date input for end date
- Time input (hours) for end time
- Keep presets as shortcuts that pre-fill the picker values

### J.2: Presets pre-fill the picker, not replace it

When user clicks "1 день", set start=now, end=now+24h in the picker. User can then fine-tune.

**Check off all Task J checkboxes in TODO.**

---

## TASK F: "Previous Rental" Data Picker UI

### F.1: Query `user_rental_secrets`

```typescript
const secrets = await getUserRentalSecrets(currentChatId, crewSlug);
// Returns most recent verified row
```

### F.2: Display in rental flow

When user starts a rental and has verified data, show a picker:

```
📋 Ваши данные от предыдущей аренды:
Кавасаки EX650K — 15.05.2026
[Использовать данные] [Заполнить заново]
```

### F.3: On selection: pre-fill the rental creation form with the saved data

### F.4: Show date of last rental as context for staleness

**Check off all Task F checkboxes in TODO.**

---

## TASK L: Hot-Stage QR Entry (Rent-in-Progress View)

### L.1: QR scan during active rental → open rental detail page directly

When QR is scanned and the bike currently has an active rental for this user, navigate directly to the rental detail view instead of starting a new rental.

### L.2: Show "handoff mode" — damage photos, odometer, notes

`FranchizeRentalDocumentsPanel` already has `saveRentalPickupFreeze` and `addRentalDamageReport` — leverage these.

### L.3: No re-navigation required

**Check off all Task L checkboxes in TODO.**

---

## TASK G: Franchise Profile Page Enhancement

### G.1: Show user's saved rental data (masked)

On the profile page (`app/franchize/[slug]/profile/page.tsx`), add a section:

```
📋 Сохранённые данные
Паспорт: **** 4512
ВУ: 99 76 ******
Телефон: +7 *** *** ** 89
```

### G.2: Allow editing/clearing saved data

"Редактировать" → opens form, "Очистить" → revokes via `revokeUserRentalSecrets`

### G.3: Show linked rental documents

List of contracts associated with this user's data (by `doc_sha256`)

### G.4: Provide "Quick Rent" button → new rental using saved data

**Check off all Task G checkboxes in TODO.**

---

## PHASE 3.2: VIP Status — Derived from User's Verified Docs

### 3.2a: Determine user's access tier from verified documents

Create `app/lib/vip-access.ts`:

```typescript
import { getUserRentalSecrets } from "@/app/lib/user-rental-secrets";
import { deriveUserAccessTier, canAccessTier, type AccessTier } from "@/lib/derive-access-tier";

export async function getUserAccessTier(chatId: string, crewSlug: string): Promise<AccessTier> {
  const secrets = await getUserRentalSecrets(chatId, crewSlug);
  if (!secrets) return "entry";

  // Extract license categories from renter_driver_license field
  // The field stores something like "99 76 543210 (кат. А, В)" or just "99 76 543210"
  const licenseStr = secrets.renter_driver_license || "";
  const categoryMatch = licenseStr.match(/[АA]\s*$/i); // or parse categories from stored data

  // If we have explicit categories stored, use them
  // Otherwise, parse from the license string
  const categories = parseLicenseCategories(licenseStr);
  return deriveUserAccessTier(categories);
}

function parseLicenseCategories(licenseStr: string): string[] {
  // Try to extract "кат. А, В" or "кат.A, B, M" pattern from the string
  const catMatch = licenseStr.match(/кат\.?\s*([АA0-9,\s]+)/i);
  if (catMatch) {
    return catMatch[1].split(/[,\s]+/).filter(Boolean).map(c => c.toUpperCase());
  }
  // If no categories found, return empty (entry tier)
  return [];
}
```

### 3.2b: Access tier check in rental flow

When user selects a bike in the web-app rental flow, check their tier:

```typescript
const userTier = await getUserAccessTier(chatId, crewSlug);
const bikeTier = bike.specs?.access_tier || deriveAccessTier(bike.specs?.license_class || "");

if (!canAccessTier(userTier, bikeTier)) {
  return { error: `Для аренды этого мотоцикла необходимы права категории ${bikeTier === 'pro' ? 'А' : 'А1/В'}. Ваши документы позволяют аренду до уровня ${userTier === 'entry' ? 'Entry' : 'Mid'}.` };
}
```

### 3.2c: ФЗ-152 digital consent (on first QR scan)

When user scans QR for the first time (no existing `user_rental_secrets` with consent for this user), show a consent screen:

```
📜 Согласие на обработку персональных данных (ФЗ-152)

Вы соглашаетесь с хранением и использованием ваших персональных данных
(паспорт, водительское удостоверение) для оформления будущих аренд.

[Согласен] [Отказаться]
```

On consent: store `consent_given_at` timestamp in `user_rental_secrets.sensitive_metadata` (or add a `consent_given_at` column to the table via a new migration).

On refusal: proceed with standard rental flow, no data saved for re-use.

**Check off all 3.2 checkboxes in TODO.**

---

## PHASE 3.3: Streamlined VIP Re-Rental

### 3.3a: VIP rental flow (1-click for returning riders)

In the rental creation flow, when user has verified `user_rental_secrets`:
1. Skip "photograph documents" step entirely
2. Pre-fill all renter fields from secrets
3. Show "VIP ✅ — данные проверены" badge on the form
4. After submission, contract auto-generated with saved data
5. Admin notification includes VIP badge: "VIP-аренда: [Name] → [Bike] — данные проверены"

### 3.3b: Admin notification enhancement

In `FranchizeAdminClient.tsx`, distinguish VIP vs new rentals:
- VIP rentals: show "VIP ✅" badge
- First-time rentals: show "Новый клиент 🆕" badge
- Add config option in crew settings: `auto_confirm_vip_rentals: boolean`

### 3.3c: Bike catalog filtering by access tier

In the bike selection UI:
1. Filter available bikes by user's access tier
2. Show locked bikes greyed out with "Требуется категория А" label
3. Show upgrade prompt: "Получите доступ — предоставьте водительское удостоверение категории А"

**Check off all 3.3 checkboxes in TODO.**

---

## PHASE 4.0: OCR Architecture Decision

**Decision: VLM-based (Option A)** — send photo to GLM-4V via `z-ai-web-dev-sdk` → structured JSON extraction. Simplest, highest accuracy for Russian passports/licenses. Add Tesseract fallback later for cost optimization.

Create `app/lib/ocr-constants.ts`:
```typescript
export const OCR_PROVIDER = "vlm" as const;
export const OCR_PASSPORT_PROMPT = `Extract passport data from this Russian passport photo. Return JSON only:
{ "fullName": "...", "birthDate": "DD.MM.YYYY", "series": "1234", "number": "567890", "issueDate": "DD.MM.YYYY", "issuedBy": "...", "registration": "..." }`;

export const OCR_LICENSE_PROMPT = `Extract driver's license data from this Russian ВУ photo. Return JSON only:
{ "series": "99 76", "number": "543210", "categories": ["A", "B", "M"], "issueDate": "DD.MM.YYYY", "expiryDate": "DD.MM.YYYY", "fullName": "..." }`;
```

**Check off 4.0 checkboxes in TODO.**

---

## PHASE 4.1: Telegram Bot `/doc` Command

### 4.1a: Register `/doc` command

Find the webhook handler (search `app/webhook-handlers/` or `@cmd_start`). Add `/doc` alongside existing `/start`.

Register with BotFather: suggest in a comment that the user should run `/setcommands` in BotFather and add `doc - Создать договор аренды`.

### 4.1b: `/doc` conversation flow

```
User: /doc
Bot:  📄 Для создания договора аренды мне нужны:
      1️⃣ Фото паспорта (разворот с фото)
      2️⃣ Фото водительского удостоверения (если есть)
      Отправьте фото паспорта 👇

User: [sends passport photo]
Bot:  ✅ Паспорт получен. Отправьте фото водительского удостоверения или напишите "нет" 👇

User: [sends license photo] or "нет"
Bot:  ✅ Данные обработаны:
      👤 Иванов Иван Иванович
      🪪 Паспорт: 1234 567890
      🚗 ВУ: 99 76 543210 (кат. А, В)
      🏍️ Доступные мотоциклы: все категории
      Какой мотоцикл? Напишите название или выберите:
      [Inline keyboard with available bikes by tier]

User: [selects bike or types name]
Bot:  На какой срок?
      [Inline keyboard: 1 час / 3 часа / 1 день / 3 дня / неделя / Свой вариант]

User: [selects duration or types custom]
Bot:  ✅ Договор создан!
      [DOCX + QR in one message via sendMediaGroup]
```

### 4.1c: State machine

States: `idle` → `awaiting_passport` → `awaiting_license` → `confirming_data` → `selecting_bike` → `selecting_duration` → `generating_contract`

Store in `users.metadata.doc_flow_state` (temporary, cleared after completion or 5-min timeout).

### 4.1d: Photo handling

- Receive photo via `message.photo` (largest size)
- Download Telegram file or pass URL to VLM
- VLM extracts structured data → `passportJson` / `licenseJson` format
- Validate fields (non-empty name, valid series/number format)

**Check off all 4.1 checkboxes in TODO.**

---

## PHASE 4.2: OCR Service (Next.js API Route)

### 4.2a: Create `/api/ocr` endpoint

```typescript
// app/api/ocr/route.ts
// POST /api/ocr
// Body: { image: base64, type: "passport" | "license" }
// Response: { success: boolean, data?: PassportJson | LicenseJson, error?: string }
```

### 4.2b: VLM integration using `z-ai-web-dev-sdk`

```typescript
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: Request) {
  const { image, type } = await request.json();
  const zai = await ZAI.create();

  const prompt = type === "passport" ? OCR_PASSPORT_PROMPT : OCR_LICENSE_PROMPT;

  const completion = await zai.chat.completions.create({
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: [
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } },
        { type: "text", text: type === "passport" ? "Extract passport data" : "Extract license data" }
      ]}
    ],
  });

  // Parse JSON from response
  const content = completion.choices[0]?.message?.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return Response.json({ success: false, error: "Failed to parse OCR result" });

  return Response.json({ success: true, data: JSON.parse(jsonMatch[0]) });
}
```

### 4.2c: License category extraction → VIP tier

After OCR, extract `categories` array from license result:
```typescript
const categories = ocrResult.categories || []; // e.g. ["A", "B", "M"]
const userTier = deriveUserAccessTier(categories);
```

### 4.2d: Web-app OCR integration

In checkout flow, add "Сфотографируйте паспорт" option:
- Camera capture → upload to `/api/ocr` → pre-fill form
- Fallback: manual entry if OCR fails
- Progressive disclosure: passport first, then license (license = tier upgrade)

**Check off all 4.2 checkboxes in TODO.**

---

## PHASE 4.3: OCR Result → VIP Tier Auto-Upgrade

### 4.3a: On successful OCR + verification

```typescript
const categories = licenseOcrResult.categories || [];
const accessTier = deriveUserAccessTier(categories);

// Save to user_rental_secrets with tier info
await saveUserRentalSecrets({
  ...rentalSecretsData,
  renter_driver_license: `${licenseOcrResult.series} ${licenseOcrResult.number} (кат. ${categories.join(', ')})`,
  // Store categories for tier derivation
});
```

### 4.3b: No OCR result → Entry tier only

Users who never provided a license can only rent Entry bikes. Safe default.

Upgrade available at any time: "Улучшите доступ — предоставьте ВУ"

**Check off all 4.3 checkboxes in TODO.**

---

## PHASE 4.4: OCR Quality & Fallbacks

### 4.4a: Validation

```typescript
function validatePassportOcr(data: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!data.fullName || typeof data.fullName !== 'string') errors.push('Missing fullName');
  if (!/^\d{4}$/.test(String(data.series))) errors.push('Passport series must be 4 digits');
  if (!/^\d{6}$/.test(String(data.number))) errors.push('Passport number must be 6 digits');
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(String(data.birthDate))) errors.push('Birth date must be DD.MM.YYYY');
  return errors;
}
```

### 4.4b: Human verification in admin dashboard

Add "Проверка документов" section to `FranchizeAdminClient.tsx`:
- Show OCR result + original photo side-by-side
- Confirm or edit before saving to secrets

### 4.4c: OCR caching

Hash photo bytes → cache OCR result. Don't re-OCR same photo if user resends.

**Check off all 4.4 checkboxes in TODO.**

---

## PHASE 3.4: NFC Activation (Research — Speculative)

This is research only, no implementation:

- [ ] What NFC hardware is on the bikes? (reader model, protocol)
- [ ] Can phone NFC emulate the same card? (Web NFC API? Native Android/iOS?)
- [ ] Temporary NFC marks — can the system generate one-time NFC tokens?
- [ ] Security: NFC token tied to rental + user, expires at rental end
- [ ] Find NFC hardware integration code in repo
- [ ] What API/protocol does it use?

Search the codebase for NFC-related code. Document findings in the TODO inline. Check off items that can be answered from codebase inspection.

**Check off any 3.4 items you can resolve from codebase research.**

---

## EXECUTION ORDER

Work through tasks in this order (respecting dependencies):

```
1. Bug M3 + Bug D1                    (one-liners, do first)
2. Task B (QR alongside contract)     (main feature, depends on A+C ✅)
3. Phase 3.1 (access tier utility)    (depends on D ✅, independent of B)
4. Task E (deep-link auto-fill)       (depends on B, D ✅)
5. Task J (time picker)               (independent)
6. Task F (previous rental picker)    (depends on C ✅, D ✅)
7. Task L (hot-stage QR entry)        (depends on E)
8. Task G (profile page enhancement)  (depends on C ✅, D ✅)
9. Phase 3.2 (VIP status from docs)   (depends on 3.1, E)
10. Phase 3.3 (VIP rental flow)       (depends on 3.2)
11. Phase 4.0 (OCR architecture)      (independent decision)
12. Phase 4.1 (/doc command)          (depends on D ✅, B)
13. Phase 4.2 (OCR API endpoint)      (depends on 4.0, 4.1)
14. Phase 4.3 (OCR → tier upgrade)    (depends on 4.2, 3.2)
15. Phase 4.4 (OCR quality)           (depends on 4.2)
16. Phase 3.4 (NFC research)          (independent, research only)
```

Tasks 5, 6, 11, 16 can be done in parallel with their dependencies. If you reach a task whose dependency isn't met yet, skip it and come back.

---

## PROGRESS TRACKING (CRITICAL)

After completing EACH task group:
1. Edit `docs/TODO-1-click-next-rent.md` — change `- [ ]` to `- [x]` for every sub-item
2. Append diary entry to `docs/THE_FRANCHEEZEPLAN.md`:
```markdown
### 2026-06-01 — [Task Name]

- `status`: ready_for_pr
- `updated_at`: 2026-06-01T00:00:00Z
- `owner`: codex
- `notes`: [what you did]
- `next_step`: [what comes next]
- `risks`: [any concerns]
```

3. Run `npm run lint` on modified files to catch errors early

---

## CONSTRAINTS

- **No breaking changes**: Existing `rental-{id}` deep-links must continue to work
- **Private schema for secrets**: Sensitive renter data MUST live in `private.*` tables, never `public.*`
- **Metadata principle**: `users.metadata` stores raw signals only. Derived state goes in secret table
- **Crew isolation**: Scoped per franchise (`crew_slug`). No cross-franchise data sharing
- **Privacy**: Paper consent (Appendix 4) for initial rental. ФЗ-152 digital consent for re-use (Phase 3.2+)
- **Bike IDs are slugs**: `cars.id` is human-readable (`kawasaki-ex650k`), NOT a UUID
- **`specs.license_class` already in gold seed**: Tier derivation needs NO new bike schema columns, just `access_tier` computed/parsed field
- **No multi-bike support**: 1 bike = 1 doc = 1 contract
- **Russian language**: All user-facing text in Russian. Code/comments can be English
- **Supabase-first**: Use Supabase client (service role for `private.*` access), not raw SQL from app code
- **Non-blocking saves**: Rental secret saves must NEVER prevent doc delivery

---

## KEY FILES

- `scripts/make-rental-contract-skill.mjs` — Skill script (Codex/Slack trigger)
- `lib/docx-capability.ts` — Web-app doc builder
- `lib/rental-template-version.ts` — Shared `CURRENT_RENTAL_TEMPLATE_VERSION`
- `app/franchize/actions-runtime.ts` — Main server actions + `getFranchizeSuccessfulRentals`
- `app/franchize/components/FranchizeAdminClient.tsx` — Admin dashboard
- `app/lib/user-rental-secrets.ts` — Rental secrets access module
- `app/actions` — Shared Telegram helpers (`sendTelegramDocument`)
- `supabase/migrations/20260601000000_user_rental_secrets.sql` — Rental secrets migration
- `download/cars_rows_7bikes_golden.csv` — Gold bike seed (has `specs.license_class`)
- `docs/TODO-1-click-next-rent.md` — Living TODO with checkboxes
- `docs/THE_FRANCHEEZEPLAN.md` — Execution diary

## KEY SEARCH TERMS

- `private.user_rental_secrets` / `getUserRentalSecrets` — rental secrets
- `startapp` / `startParam` / `rent_` — deep-link handling
- `contract_verifier` / `originalSha256` — document verification
- `sendMediaGroup` / `sendDocument` — Telegram delivery
- `license_class` / `access_tier` — bike tier data
- `franchize` / `franchise` — both spellings exist in codebase
- `useTelegramAuth` — Telegram auth hook
- `doc_flow_state` — /doc command conversation state
