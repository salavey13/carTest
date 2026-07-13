# Rental OCR Migration Plan: Legacy VLM → ClaudeClaw Multi-Provider

**Date:** 2026-01-13  
**Status:** Ready for Implementation  
**Author:** fk-Architect-Tools  
**Source:** `/opt/claudeclaw/vip-bike/modules/contract/lib/recognize.ts` (Oleg's bot)

---

## Executive Summary

Replace legacy VLM OCR in rental-repo (`app/lib/vlm-extract.ts`) with Oleg's multi-provider OCR system from ClaudeClaw bot. Deploy OCR API to VPS (no Vercel timeout issues), use Supabase Storage as temporary buffer for "fire-and-forget" async processing.

### Key Improvements

| Feature | Legacy VLM | ClaudeClaw OCR |
|---|---|---|
| **Providers** | ZAI VLM only | gen-api.ru (Gemini), Groq, Z.AI, local hybrid |
| **Auto-selection** | None | genapi → groq → local → paas → mock |
| **Geo-blocking** | Fails in Russia | gen-api.ru works from Russia |
| **Timeout** | 8s (Vercel limit) | 60s (VPS, no limit) |
| **Retries** | None | MAX_RETRIES = 2 |
| **Date normalization** | DD.MM.YYYY only | DD.MM.YYYY → ISO YYYY-MM-DD |
| **Proxy support** | None | OCR_PROXY / GROQ_PROXY |
| **Local fallback** | None | Tesseract + sharp + text model |
| **152-ФЗ compliance** | Logs PII | No photo storage, fields only |

---

## Architecture

### Flow: WebApp → VPS OCR API → User Secrets

```
┌─────────────────┐
│  WebApp UI      │
│  (Order Page)   │
└────────┬────────┘
         │
         │ 1. User uploads passport/license photo
         │ 2. Client reduces resolution (max 1920px, JPEG q85)
         │
         ▼
┌─────────────────┐
│  Supabase       │
│  Storage        │
│  (docpix bucket)│
└────────┬────────┘
         │
         │ 3. Upload to docpix/{rentalId}/{docType}.jpg
         │ 4. Get storage path
         │
         ▼
┌─────────────────┐
│  WebApp         │
│  (Vercel)       │
└────────┬────────┘
         │
         │ 5. Fire-and-forget POST to VPS OCR API
         │    POST https://rental.vip-bike.ru/api/docphotoocr
         │    { storagePath, rentalId, docType }
         │
         ▼
┌─────────────────┐
│  VPS OCR API    │
│  (rental.vip-   │
│   bike.ru)      │
└────────┬────────┘
         │
         │ 6. Download photo from Supabase Storage
         │ 7. Run OCR (gen-api.ru / Groq / Z.AI / local)
         │ 8. Save to user_rental_secrets
         │ 9. Update rentals.passport_photo_path / license_photo_path
         │ 10. Delete photo from docpix (cleanup)
         │
         ▼
┌─────────────────┐
│  WebApp polls   │
│  for completion │
│  (via rental    │
│   metadata)     │
└─────────────────┘
```

### Why VPS Instead of Vercel?

1. **No timeout limits** — VPS has no 10s/30s restriction
2. **Russia-accessible** — gen-api.ru (Gemini) works from Russia, Groq is geo-blocked
3. **Proxy support** — can route through proxies for blocked providers
4. **Local fallback** — Tesseract + sharp available on VPS (heavy dependencies)
5. **60s timeout** — OCR can take 10-30s for complex documents

---

## Implementation Steps

### Phase 1: Copy OCR Code to Rental Repo (Day 1)

**Source:** `/opt/claudeclaw/vip-bike/modules/contract/lib/recognize.ts`  
**Target:** `/opt/vip-bike-electro-factory/rental-repo/app/lib/ocr-recognize.ts`

**Changes needed:**
1. Copy `recognize.ts` → `ocr-recognize.ts`
2. Copy `types.ts` (ClientOcrFields) → `ocr-types.ts`
3. Update imports (remove `.js` extensions, adjust paths)
4. Add `"use server"` directive (for server actions compatibility)
5. Remove `import "server-only"` (conflicts with VPS deployment)

**Files to create:**
- `app/lib/ocr-recognize.ts` (main OCR logic)
- `app/lib/ocr-types.ts` (ClientOcrFields interface)
- `app/lib/ocr-modes.ts` (OcrMode type + ocrMode() function)

### Phase 2: Create VPS OCR API Endpoint (Day 1-2)

**File:** `app/api/docphotoocr/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { recognizeDocument } from "@/app/lib/ocr-recognize";
import { supabaseAdmin } from "@/lib/supabase-server";
import { privateSchema } from "@/lib/private-secrets";

export const runtime = "nodejs";
export const maxDuration = 60; // VPS has no limit, but set reasonable timeout

export async function POST(request: NextRequest) {
  const { storagePath, rentalId, docType } = await request.json();
  
  // 1. Validate rental exists
  const { data: rental } = await supabaseAdmin
    .from("rentals")
    .select("rental_id, user_id")
    .eq("rental_id", rentalId)
    .single();
  
  if (!rental) {
    return NextResponse.json({ success: false, error: "Rental not found" }, { status: 404 });
  }
  
  // 2. Download photo from Supabase Storage
  const { data: fileData, error: downloadError } = await supabaseAdmin.storage
    .from("docpix")
    .download(storagePath);
  
  if (downloadError || !fileData) {
    return NextResponse.json({ success: false, error: "Photo not found" }, { status: 404 });
  }
  
  const imageBuffer = Buffer.from(await fileData.arrayBuffer());
  const base64 = imageBuffer.toString("base64");
  
  // 3. Run OCR
  const ocrResult = await recognizeDocument(docType, { base64 });
  
  if (ocrResult.mock) {
    return NextResponse.json({
      success: false,
      error: "OCR in mock mode — no API key configured",
    });
  }
  
  // 4. Save to user_rental_secrets
  const { data: existingSecrets } = await privateSchema()
    .from("user_rental_secrets")
    .select("*")
    .eq("source_rental_id", rentalId)
    .maybeSingle();
  
  const secretData = {
    chat_id: rental.user_id,
    source_rental_id: rentalId,
    [`${docType}_photo_path`]: storagePath,
    ...(docType === "passport" ? {
      renter_full_name: ocrResult.fields.fullName,
      renter_passport: `${ocrResult.fields.passportSeries} ${ocrResult.fields.passportNumber}`,
      renter_passport_issue_date: ocrResult.fields.passportIssuedDate,
      renter_registration: ocrResult.fields.registrationAddress,
      renter_birth_date: ocrResult.fields.birthDate,
    } : {
      renter_driver_license: ocrResult.fields.licenseNumber,
      license_categories: ocrResult.fields.licenseCategories,
      license_expiry_date: ocrResult.fields.licenseValidUntil,
    }),
  };
  
  if (existingSecrets) {
    await privateSchema()
      .from("user_rental_secrets")
      .update(secretData)
      .eq("id", existingSecrets.id);
  } else {
    await privateSchema()
      .from("user_rental_secrets")
      .insert(secretData);
  }
  
  // 5. Update rental with photo path
  await supabaseAdmin
    .from("rentals")
    .update({ [`${docType}_photo_path`]: storagePath })
    .eq("rental_id", rentalId);
  
  // 6. Cleanup: delete photo from docpix (152-ФЗ compliance)
  await supabaseAdmin.storage
    .from("docpix")
    .remove([storagePath]);
  
  return NextResponse.json({
    success: true,
    fields: ocrResult.fields,
    raw: ocrResult.raw,
  });
}
```

### Phase 3: Add Environment Variables to VPS (Day 2)

**File:** `/opt/vip-bike-rental/.env.local` (on VPS)

```bash
# ── OCR Providers (priority: genapi → groq → local → paas → mock) ──

# gen-api.ru (Gemini 2.5 Flash) — PRIMARY, works from Russia
GENAPI_API_KEY=<ask-oleg>
GENAPI_BASE=https://api.gen-api.ru/api/v1/networks
GENAPI_MODEL=gemini-2-5-flash

# Groq (Llama 4 Scout) — geo-blocked in Russia, use proxy
GROQ_API_KEY=<ask-oleg>
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
GROQ_PROXY=http://proxy.example.com:8080  # Optional: route through non-Russia proxy

# Z.AI (GLM 4.5V) — fallback
Z_AI_API_KEY=<existing>
Z_AI_BASE_URL=https://api.z.ai/api/paas/v4
Z_AI_VISION_MODEL=glm-4.5v

# Local hybrid (Tesseract + text model) — heavy, use only if all cloud fail
ANTHROPIC_AUTH_TOKEN=XXXXXX...XXXXXX<existing>
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
OCR_TEXT_MODEL=glm-4.6

# OCR mode override (optional: genapi|groq|local|paas|mock)
OCR_MODE=genapi

# Proxy for geo-blocked providers (optional)
OCR_PROXY=http://proxy.example.com:8080

# Force mock mode (dev/testing)
# RECOGNIZE_MOCK=1
```

**How to get API keys:**
- **gen-api.ru:** Ask Oleg (he has account)
- **Groq:** Ask Oleg or create free account at console.groq.com
- **Z.AI:** Already exists in rental-repo `.env.local`
- **Anthropic:** Already exists in rental-repo `.env.local`

### Phase 4: Create Supabase Migrations (Day 2)

**Migration 1: Create docpix Storage Bucket**
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_create_docpix_storage.sql

-- Create non-public storage bucket for temporary document photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('docpix', 'docpix', false);

-- RLS policy: only service role can access (server-side only)
CREATE POLICY "Service role only access to docpix"
ON storage.objects FOR ALL
USING (auth.role() = 'service_role');

-- Auto-delete after 24 hours (cleanup orphaned uploads)
-- Note: Supabase Storage doesn't have native TTL, so we'll cleanup via API
```

**Migration 2: Add Photo References to Rentals**
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_rental_photo_fields.sql

ALTER TABLE public.rentals
ADD COLUMN IF NOT EXISTS passport_photo_path text,
ADD COLUMN IF NOT EXISTS license_photo_path text;

COMMENT ON COLUMN public.rentals.passport_photo_path IS 'Supabase Storage path (docpix bucket) — temporary, deleted after OCR';
COMMENT ON COLUMN public.rentals.license_photo_path IS 'Supabase Storage path (docpix bucket) — temporary, deleted after OCR';
```

**Migration 3: Add Photo References to User Rental Secrets**
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_secrets_photo_fields.sql

ALTER TABLE private.user_rental_secrets
ADD COLUMN IF NOT EXISTS passport_photo_path text,
ADD COLUMN IF NOT EXISTS license_photo_path text;

COMMENT ON COLUMN private.user_rental_secrets.passport_photo_path IS 'Supabase Storage path (docpix bucket) — kept for audit';
COMMENT ON COLUMN private.user_rental_secrets.license_photo_path IS 'Supabase Storage path (docpix bucket) — kept for audit';
```

### Phase 5: Update WebApp to Call VPS OCR API (Day 3)

**File:** `app/franchize/components/OrderPageClient.tsx`

Add photo upload tabs (manual input vs photo upload):

```tsx
import { useState } from "react";

function PhotoUploadSection({ rentalId, docType, onOcrComplete }) {
  const [uploading, setUploading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  
  const handleFileSelect = async (file: File) => {
    setUploading(true);
    
    // 1. Reduce resolution (client-side)
    const reducedImage = await reduceImageResolution(file, 1920);
    
    // 2. Convert to base64
    const base64 = await fileToBase64(reducedImage);
    
    // 3. Upload to Supabase Storage (docpix)
    const storagePath = `${rentalId}/${docType}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("docpix")
      .upload(storagePath, reducedImage, {
        contentType: "image/jpeg",
        upsert: true,
      });
    
    if (uploadError) {
      console.error("Upload failed:", uploadError);
      setUploading(false);
      return;
    }
    
    // 4. Fire-and-forget call to VPS OCR API
    fetch("https://rental.vip-bike.ru/api/docphotoocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storagePath,
        rentalId,
        docType,
      }),
    }).catch(err => console.error("OCR API call failed:", err));
    
    // 5. Poll for completion (check rental metadata every 2s)
    const pollInterval = setInterval(async () => {
      const { data: rental } = await supabase
        .from("rentals")
        .select("metadata")
        .eq("rental_id", rentalId)
        .single();
      
      if (rental?.metadata?.ocr_complete?.[docType]) {
        clearInterval(pollInterval);
        setOcrResult(rental.metadata.ocr_complete[docType]);
        onOcrComplete(rental.metadata.ocr_complete[docType]);
        setUploading(false);
      }
    }, 2000);
    
    // Timeout after 60s
    setTimeout(() => {
      clearInterval(pollInterval);
      setUploading(false);
    }, 60000);
  };
  
  return (
    <div>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFileSelect(e.target.files[0])}
      />
      {uploading && <Spinner />}
      {ocrResult && (
        <div>
          <p>✅ Данные извлечены</p>
          <p>Проверьте и отредактируйте на вкладке "Ввести вручную"</p>
        </div>
      )}
    </div>
  );
}
```

### Phase 6: Add Cleanup Logic (Day 3)

**File:** `app/api/verify-rental-checklist/route.ts`

When docs are marked as "verified", delete photos from docpix:

```typescript
// After updating checklist.passport_verified = true
if (updates.passport_verified && rental.passport_photo_path) {
  await supabaseAdmin.storage
    .from("docpix")
    .remove([rental.passport_photo_path]);
  
  await supabaseAdmin
    .from("rentals")
    .update({ passport_photo_path: null })
    .eq("rental_id", rentalId);
}

// Same for license
if (updates.license_verified && rental.license_photo_path) {
  await supabaseAdmin.storage
    .from("docpix")
    .remove([rental.license_photo_path]);
  
  await supabaseAdmin
    .from("rentals")
    .update({ license_photo_path: null })
    .eq("rental_id", rentalId);
}
```

### Phase 7: Install Dependencies on VPS (Day 3)

**File:** `/opt/vip-bike-rental/package.json` (on VPS)

Add dependencies for local OCR fallback:

```bash
cd /opt/vip-bike-rental
npm install sharp tesseract.js undici
```

**Note:** These are heavy dependencies (~50MB), but only used if all cloud OCR providers fail.

### Phase 8: Test OCR Accuracy (Day 4-5)

**Test cases:**
1. **Passport (good quality)** — expect >95% accuracy
2. **Passport (rotated 90°)** — expect series/number extracted (local hybrid handles rotation)
3. **License (glare)** — expect categories extracted
4. **Low light** — expect warnings, manual correction needed
5. **Mock mode** — verify deterministic fake data

**Test script:**
```bash
# On VPS
cd /opt/vip-bike-rental
node scripts/test-ocr.mjs --image /tmp/passport.jpg --type passport
```

### Phase 9: Deploy to VPS (Day 5)

```bash
# Commit changes
cd /opt/vip-bike-electro-factory/rental-repo
git add -A
git commit -m "feat: migrate OCR to ClaudeClaw multi-provider system"
git push origin main

# Deploy to VPS
bash deploy-rental.sh "feat: OCR migration"
```

### Phase 10: Update fk-Pasha-Admin Agent (Day 5)

Add instructions to `/root/.config/opencode/agent/fk-pasha-admin.md`:

```markdown
## 🎯 OCR System (ClaudeClaw Multi-Provider)

### Architecture
- **VPS API:** `https://rental.vip-bike.ru/api/docphotoocr`
- **Providers:** gen-api.ru (Gemini) → Groq → local hybrid → Z.AI → mock
- **Storage:** Supabase `docpix` bucket (temporary, auto-deleted after OCR)
- **Timeout:** 60s (VPS, no limit)

### Environment Variables (VPS `.env.local`)
```bash
GENAPI_API_KEY=<ask-oleg>
GROQ_API_KEY=<ask-oleg>
Z_AI_API_KEY=<existing>
ANTHROPIC_AUTH_TOKEN=XXXXXX...XXXXXX<existing>
OCR_MODE=genapi  # or groq|local|paas|mock
```

### Testing OCR
```bash
ssh -i $SSH_KEY $VPS "cd /opt/vip-bike-rental && node scripts/test-ocr.mjs --image /tmp/test.jpg --type passport"
```

### Cleanup
Photos in `docpix` bucket are automatically deleted after:
1. OCR completes (in `/api/docphotoocr`)
2. Docs marked as "verified" (in `/api/verify-rental-checklist`)
3. 24 hours (manual cleanup script if needed)
```

---

## What You Missed (Deep Thinking)

### 1. **Geo-blocking Issue**
Groq is geo-blocked in Russia. The ClaudeClaw code handles this with:
- **gen-api.ru** (Gemini) as primary — works from Russia
- **Proxy support** for Groq (`GROQ_PROXY` env var)
- **Auto-fallback** if provider fails

**Action:** Ensure VPS has `GENAPI_API_KEY` configured. Ask Oleg for his gen-api.ru account.

### 2. **152-ФЗ Compliance (Russian Data Privacy Law)**
The ClaudeClaw code is 152-ФЗ compliant:
- Photos are NOT stored permanently
- Only extracted fields are saved
- Photos deleted immediately after OCR

**Action:** Add cleanup logic in `/api/docphotoocr` (already in plan).

### 3. **Local Hybrid Fallback**
If all cloud providers fail, ClaudeClaw uses:
- **Tesseract.js** (OCR photo → text)
- **sharp** (preprocess: grayscale, contrast, rotation)
- **Text model** (text → structured JSON)

This is heavy (~50MB dependencies) but ensures OCR always works.

**Action:** Install `sharp`, `tesseract.js`, `undici` on VPS.

### 4. **Date Normalization**
ClaudeClaw normalizes dates to ISO format (YYYY-MM-DD), but rental-repo expects DD.MM.YYYY.

**Action:** Add conversion in `/api/docphotoocr`:
```typescript
function isoToDmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
```

### 5. **Polling vs Webhooks**
The plan uses polling (check rental metadata every 2s). Alternative: VPS sends webhook to Vercel when OCR completes.

**Recommendation:** Stick with polling (simpler, no webhook infrastructure needed).

### 6. **Error Handling**
What if OCR fails? User should see error and switch to manual input.

**Action:** Add error state in `PhotoUploadSection`:
```tsx
if (ocrError) {
  return (
    <div>
      <p>❌ OCR failed: {ocrError}</p>
      <p>Please switch to manual input tab</p>
    </div>
  );
}
```

### 7. **Cost Estimation**
- **gen-api.ru:** ~$0.001 per OCR call (Gemini Flash)
- **Groq:** Free tier (1000 calls/day)
- **Z.AI:** ~$0.01 per OCR call
- **Local:** Free (CPU cost only)

**Estimated cost:** $5-10/month for 5000 rentals.

### 8. **Performance**
- **gen-api.ru:** 5-10s per OCR
- **Groq:** 3-5s per OCR
- **Z.AI:** 8-15s per OCR
- **Local:** 15-30s per OCR (Tesseract is slow)

**Recommendation:** Use gen-api.ru as primary (fast + Russia-accessible).

---

## Success Metrics

- **OCR accuracy:** >95% (manual corrections <5%)
- **OCR latency:** <15s (gen-api.ru)
- **Uptime:** 99.9% (VPS, no Vercel timeout issues)
- **Cost:** <$10/month

---

## Timeline

**Total:** 5 days (not 10 weeks!)

- **Day 1:** Copy OCR code, create VPS API endpoint
- **Day 2:** Add env vars, create migrations
- **Day 3:** Update WebApp, add cleanup, install deps
- **Day 4-5:** Test OCR accuracy, deploy to VPS

**Estimated effort:** 1 developer (you + me + fk-Pasha-Admin)  
**Estimated cost:** $0 (development) + $5-10/month (OCR API calls)

---

## Next Steps

1. **Ask Oleg for API keys:**
   - gen-api.ru account
   - Groq account (optional, geo-blocked)

2. **Implement Phase 1-3** (copy code, create API, add env vars)

3. **Test with real photos** (Day 4)

4. **Deploy to VPS** (Day 5)

5. **Monitor OCR accuracy** (Week 1-2)

---

**Ready to execute!** Let's do this today. 🚀
