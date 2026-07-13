# OCR Implementation Summary

**Date:** 2026-01-13  
**Status:** ✅ Ready for Deployment  
**Timeline:** 3 days (completed!)

---

## What Was Implemented

### 1. OCR Recognition Library (`app/lib/ocr-recognize.ts`)
- **Source:** ClaudeClaw bot (`/opt/claudeclaw/vip-bike/modules/contract/lib/recognize.ts`)
- **Simplified:** Removed Tesseract fallback, Groq (geo-blocked), mock mode
- **Providers:**
  - **gen-api.ru** (Gemini 2.5 Flash) — PRIMARY
  - **Z.AI** (GLM 5.2 via Anthropic endpoint) — fallback
- **Features:**
  - 60s timeout (VPS, no Vercel limit)
  - Date normalization (ISO → DD.MM.YYYY)
  - 152-ФЗ compliant (no photo storage)
  - Retry logic (MAX_RETRIES = 2)

### 2. VPS OCR API Endpoint (`app/api/docphotoocr/route.ts`)
- **Purpose:** Accepts photo from Supabase Storage, runs OCR, updates user_rental_secrets
- **Flow:**
  1. Validates rental exists
  2. Downloads photo from docpix bucket
  3. Runs OCR via `recognizeDocument()`
  4. Converts ISO dates to DD.MM.YYYY
  5. Updates `user_rental_secrets` (private schema)
  6. Updates `rentals.passport_photo_path` / `license_photo_path`
  7. Deletes photo from docpix (152-ФЗ compliance)
  8. Returns `{ success: true, fields }`
- **Timeout:** 60s (VPS has no limit)

### 3. Photo Upload Button Component (`app/franchize/components/PhotoUploadButton.tsx`)
- **Features:**
  - Client-side image reduction (max 1920px, JPEG q85)
  - Upload to Supabase Storage (docpix bucket)
  - Fire-and-forget POST to VPS OCR API
  - Success/error messages
  - Mobile camera support (`capture="environment"`)
- **Integration:** Added to OrderPageClient before passport and license fields

### 4. Verification Checklist Endpoint (`app/api/verify-rental-checklist/route.ts`)
- **Purpose:** Updates verification status, removes photo paths after verification
- **Flow:**
  1. Accepts `{ rentalId, updates: { passport_verified, license_verified, ... } }`
  2. Merges checklist updates into `rentals.metadata.checklist`
  3. If `passport_verified = true`, sets `passport_photo_path = null`
  4. If `license_verified = true`, sets `license_photo_path = null`
  5. Returns `{ success: true, checklist, allCompleted }`

### 5. Supabase Migrations
- **20260113120000_create_docpix_storage_bucket.sql**
  - Creates non-public `docpix` bucket
  - RLS policy: service_role only
- **20260113120001_add_photo_fields_to_rentals.sql**
  - Adds `passport_photo_path` and `license_photo_path` to `rentals` table
- **20260113120002_add_photo_fields_to_user_rental_secrets.sql**
  - Adds same fields to `user_rental_secrets` (private schema)

### 6. Environment Variables (`.env.local`)
```bash
# OCR (Document Recognition)
GENAPI_API_KEY=sk-XXXXXX...XXXXXX
GENAPI_MODEL=gemini-2-5-flash
ANTHROPIC_AUTH_TOKEN=XXXXXX...XXXXXX
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
ANTHROPIC_MODEL=glm-5.2
OCR_MODE=genapi
```

---

## Architecture

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
         │ 3. Upload to docpix/{orderId}/{docType}.jpg
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
         │    { storagePath, rentalId: orderId, docType, chatId }
         │
         ▼
┌─────────────────┐
│  VPS OCR API    │
│  (rental.vip-   │
│   bike.ru)      │
└────────┬────────┘
         │
         │ 6. Download photo from Supabase Storage
         │ 7. Run OCR (gen-api.ru Gemini)
         │ 8. Update private.user_rental_secrets
         │ 9. Update rentals.passport_photo_path / license_photo_path
         │ 10. Delete photo from docpix (152-ФЗ compliance)
         │
         ▼
┌─────────────────┐
│  User sees      │
│  fields filled  │
│  in profile     │
│  automatically  │
└─────────────────┘
```

**Key Points:**
- ✅ No polling (VPS updates user_rental_secrets directly)
- ✅ No Tesseract fallback (no key = no OCR = manual input)
- ✅ No webhooks (fire-and-forget)
- ✅ 152-ФЗ compliant (photos deleted immediately after OCR)
- ✅ Operator verifies during rental activation (compares photo vs OCR data)
- ✅ After verification, photo paths removed from rentals

---

## Deployment Instructions

### Step 1: Apply Supabase Migrations

Run these migrations in Supabase SQL Editor (in order):

1. `supabase/migrations/20260113120000_create_docpix_storage_bucket.sql`
2. `supabase/migrations/20260113120001_add_photo_fields_to_rentals.sql`
3. `supabase/migrations/20260113120002_add_photo_fields_to_user_rental_secrets.sql`

**Note:** Migration 1 creates the `docpix` storage bucket. Verify it exists in Supabase Dashboard → Storage.

### Step 2: Add Environment Variables to VPS

SSH to VPS and add OCR keys to `/opt/vip-bike-rental/.env.local`:

```bash
ssh -i /opt/vip-bike-electro-factory/secrets/clients_vps root@212.67.11.25

cat >> /opt/vip-bike-rental/.env.local << 'EOF'

# ── OCR Providers (gen-api.ru + Z.AI) ──
GENAPI_API_KEY=sk-XXXXXX...XXXXXX
GENAPI_MODEL=gemini-2-5-flash
ANTHROPIC_AUTH_TOKEN=XXXXXX...XXXXXX
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
ANTHROPIC_MODEL=glm-5.2
OCR_MODE=genapi
EOF
```

### Step 3: Commit and Push Changes

```bash
cd /opt/vip-bike-electro-factory/rental-repo
git add -A
git commit -m "feat: add OCR via gen-api.ru (Gemini 2.5 Flash)

- Copy OCR code from ClaudeClaw bot (Oleg's implementation)
- Simplify: remove Tesseract fallback, Groq (geo-blocked)
- Add VPS OCR API endpoint (app/api/docphotoocr)
- Add PhotoUploadButton component (fire-and-forget)
- Add verification checklist endpoint
- Add Supabase migrations (docpix bucket + photo fields)
- Add API keys to .env.local

Architecture:
- WebApp uploads photo to Supabase Storage (docpix)
- Fire-and-forget POST to VPS OCR API
- VPS runs OCR, updates user_rental_secrets
- VPS deletes photo (152-ФЗ compliance)
- User sees fields filled automatically

Providers:
- gen-api.ru (Gemini 2.5 Flash) — PRIMARY
- Z.AI (GLM 5.2) — fallback

Cost: ~$5-10/month for 5000 rentals"
git push origin main
```

### Step 4: Deploy to VPS

```bash
bash /opt/vip-bike-electro-factory/rental-repo/deploy-rental.sh "feat: OCR implementation"
```

This will:
- Commit and push to GitHub
- SSH to VPS
- Git pull on VPS
- Docker rebuild
- Health check

### Step 5: Verify Deployment

```bash
# Check VPS logs
ssh -i /opt/vip-bike-electro-factory/secrets/clients_vps root@212.67.11.25 "tail -50 /opt/vip-bike-rental/deploy.log"

# Check container is running
ssh -i /opt/vip-bike-electro-factory/secrets/clients_vps root@212.67.11.25 "docker ps | grep rental"

# Health check
ssh -i /opt/vip-bike-electro-factory/secrets/clients_vps root@212.67.11.25 "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3006/franchize/vip-bike"
```

Expected: HTTP 200

---

## Testing

### Test 1: Photo Upload (Manual)

1. Open WebApp order page: `https://rental.vip-bike.ru/franchize/vip-bike/order/{orderId}`
2. Click "Загрузить фото паспорта"
3. Select passport photo
4. Verify:
   - ✅ Success message appears
   - ✅ Photo uploaded to Supabase Storage (docpix bucket)
   - ✅ VPS OCR API called (check VPS logs)
   - ✅ Photo deleted from docpix after OCR
   - ✅ `user_rental_secrets` updated with OCR data
   - ✅ `rentals.passport_photo_path` set (temporarily)

### Test 2: OCR Accuracy

```bash
# On VPS
ssh -i /opt/vip-bike-electro-factory/secrets/clients_vps root@212.67.11.25

cd /opt/vip-bike-rental
node -e "
const { recognizeDocument } = require('./app/lib/ocr-recognize.ts');
const fs = require('fs');

const base64 = fs.readFileSync('/tmp/passport.jpg', 'base64');
recognizeDocument('passport', { base64 }).then(result => {
  console.log(JSON.stringify(result, null, 2));
});
"
```

Expected output:
```json
{
  "fields": {
    "fullName": "Иванов Иван Иванович",
    "birthDate": "15.05.1990",
    "passportSeries": "2222",
    "passportNumber": "333444",
    "passportIssuedBy": "ГУ МВД России по Нижегородской области",
    "passportIssuedDate": "20.06.2015",
    "registrationAddress": "г. Нижний Новгород, ул. Пример, д. 1, кв. 1"
  },
  "raw": { ... }
}
```

### Test 3: Verification Checklist

```bash
# Call verification endpoint
curl -X POST https://rental.vip-bike.ru/api/verify-rental-checklist \
  -H "Content-Type: application/json" \
  -d '{
    "rentalId": "uuid-here",
    "updates": {
      "passport_verified": true,
      "license_verified": true
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "checklist": {
    "passport_verified": true,
    "license_verified": true
  },
  "allCompleted": false
}
```

Verify:
- ✅ `rentals.passport_photo_path` set to `null`
- ✅ `rentals.license_photo_path` set to `null`
- ✅ `rentals.metadata.checklist` updated

---

## Cost Estimation

- **gen-api.ru:** ~$0.001 per OCR call (Gemini Flash)
- **Z.AI:** ~$0.01 per OCR call (GLM 5.2)

**Estimated cost:** $5-10/month for 5000 rentals

---

## Success Metrics

- **OCR accuracy:** >95% (manual corrections <5%)
- **OCR latency:** 5-10s (gen-api.ru)
- **Uptime:** 99.9% (VPS, no Vercel timeout issues)
- **Cost:** <$10/month

---

## Troubleshooting

### Issue: OCR API returns "OCR не настроен"
**Solution:** Check environment variables on VPS:
```bash
ssh -i /opt/vip-bike-electro-factory/secrets/clients_vps root@212.67.11.25 "grep GENAPI /opt/vip-bike-rental/.env.local"
```

### Issue: Photo not deleted from docpix
**Solution:** Check VPS logs for errors in `/api/docphotoocr`:
```bash
ssh -i /opt/vip-bike-electro-factory/secrets/clients_vps root@212.67.11.25 "docker logs vip_bike_rental 2>&1 | grep -A 5 'docphotoocr'"
```

### Issue: user_rental_secrets not updated
**Solution:** Check Supabase permissions. VPS must have service_role key in `.env.local`:
```bash
ssh -i /opt/vip-bike-electro-factory/secrets/clients_vps root@212.67.11.25 "grep SUPABASE_SERVICE_ROLE_KEY /opt/vip-bike-rental/.env.local"
```

### Issue: OCR accuracy <90%
**Solution:** 
1. Check photo quality (resolution, lighting, angle)
2. Try Z.AI fallback: set `OCR_MODE=anthropic` in `.env.local`
3. Restart VPS container

---

## Next Steps (Future Enhancements)

1. **Add verification UI to LEADS page**
   - Show photo thumbnails
   - Show OCR data side-by-side
   - "Verify" buttons for passport/license

2. **Add OCR status indicator**
   - Show "Processing..." while OCR runs
   - Show "✅ Verified" after operator confirms

3. **Add batch OCR**
   - Upload multiple photos at once
   - Process in parallel

4. **Add OCR confidence score**
   - Show confidence % in UI
   - Highlight low-confidence fields for manual review

5. **Add OCR audit log**
   - Track who verified what and when
   - Store raw OCR responses for debugging

---

## Files Created/Modified

### Created:
- `app/lib/ocr-recognize.ts` (OCR library)
- `app/api/docphotoocr/route.ts` (VPS OCR endpoint)
- `app/api/verify-rental-checklist/route.ts` (verification endpoint)
- `app/franchize/components/PhotoUploadButton.tsx` (UI component)
- `supabase/migrations/20260113120000_create_docpix_storage_bucket.sql`
- `supabase/migrations/20260113120001_add_photo_fields_to_rentals.sql`
- `supabase/migrations/20260113120002_add_photo_fields_to_user_rental_secrets.sql`

### Modified:
- `app/franchize/components/OrderPageClient.tsx` (added PhotoUploadButton)
- `.env.local` (added OCR API keys)

---

## Summary

✅ **All tasks completed in 3 days!**

- Day 1: Copied OCR code, created VPS endpoint
- Day 2: Added API keys, created migrations
- Day 3: Updated WebApp, added verification endpoint

**Ready for deployment!** 🚀

Follow the deployment instructions above to go live.
