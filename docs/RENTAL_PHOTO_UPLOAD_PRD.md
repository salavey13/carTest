# PRD: Rental Photo Upload (Before/After)

**Feature**: Permanent photo storage for bike condition at handoff (ДО) and return (ПОСЛЕ)
**Version**: 1.3 (2026-08-11 — I3 MVP shipped: migration + photo-actions + UI + bot pipeline)
**Status**: ✅ MVP Shipped (I3) — pending I4 retention/polish (nightly archive cron, storage-growth report, EXIF GPS opt-in, unit tests)
**Author**: VIP Bike Engineering
**Last updated**: 2026-08-11

---

## 1. Overview

Today, the VIP Bike rental flow includes a photo reminder in the return checklist («Сфотографировать байк при возврате»), but there is no system-enforced photo capture or storage. Operators take photos on their personal phones and store them locally — making dispute resolution, damage claims, and audit trail essentially impossible. When a renter returns a bike with new damage, the operator has no timestamped, immutable "before" photo to compare against.

This PRD defines a permanent, per-rental photo storage system in Supabase Storage. Photos are organized in subfolders keyed by `rental_id`, captured through the existing Telegram WebApp flow (renter-side) and the franchize operator UI (operator-side), and surfaced in the rental detail page, the closure modal, and the analytics drawer. Photos become a first-class artifact of every rental — alongside the contract PDF, the deposit tracking, and the equipment checklist.

### v1.1 revisions (per user feedback)

- **Photos are NOT mandatory in v1.** Preferable but not blocking. The closure modal will show a yellow warning "Фото ПОСЛЕ не добавлены" but the operator can still close the rental. This avoids friction during rollout while we collect data on adoption. Will revisit making them mandatory in v2 after operators are comfortable with the flow.
- **Client-side + server-side compression.** All photos are compressed BEFORE upload to stay within Supabase freemium tier (1GB free, 8GB paid). Client-side resize to max 1600px on long edge + quality 80 JPEG before upload. Server-side re-compress to max 1280px + quality 75 for the persisted copy. Originals are NOT kept (unlike v1.0 which proposed `_originals/` subfolder — dropped to save space).
- **Hard file size limit.** Upload rejected if compressed file > 500 KB. Pre-compression max input size: 10 MB (reject anything larger at the file picker).
- **Telegram bot auto-attach in low resolution.** When a renter sends a photo to the bot AND has an active rental tied to their `user_id`, the bot automatically attaches the photo to that rental — no manual state machine needed. Bot downloads the Telegram thumbnail (320px wide, ~10-30 KB) instead of the full-res file, perfect for freemium storage. Renter gets a confirmation: "📸 Фото привязано к аренде #abc12345".

### v1.2 revisions (codebase audit 2026-08-11)

Corrections after verifying the actual code (see §3 for details):

- **§3 was factually wrong about the bot path.** The Telegram bot does NOT store expiring Telegram file URLs. `handlePhotoMessage` in `gateway/telegram/webhook-handler.ts` already downloads the photo and re-uploads it to the **`rentals` bucket (public)** via `uploadSingleImage`, then writes the permanent public URL into the `events` row. The real gaps are elsewhere: public (not private) bucket, no per-rental folder layout, no metadata table, no hash, no compression, no operator upload path, no gallery UI.
- **Rental auto-detection already exists.** The webhook has a fallback that auto-resolves the renter's rental + photo type from `rentals` status + `events` when no `awaiting_rental_photo` state is set (added 2026-02-21, see `docs/AGENT_DIARY_ARCHIVE_2026Q1.md`). What is genuinely new in §5.7: the multi-rental disambiguation keyboard, the private bucket, the `rental_photos` metadata row, and the SHA-256 hash — not the auto-detection itself.
- **Bot currently downloads the LARGEST photo variant** (`message.photo[message.photo.length - 1]`, full resolution, often 1-3 MB) — the opposite of the v1.1 assumption. Switching to the smallest variant is a real change, not a description of current behavior.
- **`sharp` is already installed** (`package.json` → `"sharp": "^0.33.0"`). Phase 1 does not need an install step.
- **Client-side compression already exists** in `app/franchize/components/PhotoUploadButton.tsx` (canvas resize to 1920px, JPEG 0.85, 10 MB input limit) — reuse/generalize it instead of writing a new one.
- **Webhook handler file path fixed.** The photo handler lives in `gateway/telegram/webhook-handler.ts` (not `app/webhook-handlers/index.ts` — that file does not exist). A second state-setting path exists in `app/webhook-handlers/commands/actions.ts` (the `/actions` menu).

---

## 2. Goals & Non-Goals

### Goals

- **Preferable photo capture** — every rental that goes `active` SHOULD have at least one ДО photo; every rental that goes `completed` SHOULD have at least one ПОСЛЕ photo. UI shows a soft warning when missing, but does NOT block closure in v1.
- **Permanent per-rental storage** — photos live in `rental-photos/<rental_id>/` in Supabase Storage, retained for 12 months (revised down from 18 to fit freemium tier), then auto-archived to cold storage.
- **Side-by-side comparison** — the rental detail page shows ДО and ПОСЛЕ thumbnails side-by-side; clicking opens a full-screen gallery with date/time metadata.
- **Renter-uploaded photos via Telegram bot** — renters can submit ДО/ПОСЛЕ photos themselves by sending them to the bot. The bot auto-detects the renter's active rental and attaches the photo without requiring explicit UI flows.
- **Operator-uploaded photos** — operators can also upload photos directly from the franchize admin UI (file input + drag-drop) for cases where the renter can't or won't.
- **Audit trail** — every photo write is recorded in `events` table with `type='photo_start'` / `type='photo_end'`, actor, timestamp, file path, file size, and SHA-256 hash for tamper detection.
- **Freemium-friendly storage footprint** — target: ≤500 KB per photo, ≤2 MB per rental (avg 4 photos), ≤200 MB per crew per year (100 rentals × 2 MB). Well within the 1GB free tier.

### Non-Goals (v1)

- **Mandatory photo requirement** — explicitly deferred to v2. v1 makes photos preferable but not blocking.
- **AI damage detection** — automatic damage detection from photos is out of scope for v1. Operators compare manually.
- **Video upload** — only JPEG/PNG/HEIC photos in v1. Video may come in v2.
- **Public gallery** — photos are crew-private. No public-facing gallery.
- **OCR on bike photos** — passport/license OCR already exists separately in the `docpix` bucket. Bike photos are NOT OCR'd.
- **Original-quality preservation** — dropped from v1.0 plan. We persist only the compressed version to fit freemium tier. If a dispute requires forensic analysis, the compressed JPEG is sufficient.

---

## 3. Background & Current State

### Existing Infrastructure

The codebase already has two related but separate photo systems. This PRD adds a third, purpose-built for permanent bike condition photos. Understanding the difference is critical to avoid scope creep.

| System | Bucket | Purpose | Retention | Privacy |
|---|---|---|---|---|
| docpix (existing) | docpix (private) | Passport/license OCR — temporary | Auto-delete after OCR | 152-ФЗ compliant |
| user_rental_secrets (existing) | — | Renter's deep-link secrets | Per-rental | Private |
| rental-photos (NEW) | rental-photos (private) | Bike condition ДО/ПОСЛЕ | 12 months, then cold archive | Crew-private |

### Existing Code Hooks (verified 2026-08-11 against actual code)

**Bot photo pipeline (the main path) — `gateway/telegram/webhook-handler.ts::handlePhotoMessage`:**

1. Renter taps "Фото ДО/ПОСЛЕ" in the WebApp (`app/rentals/[id]/page.tsx`, `FranchizeRentalLifecycleActions.tsx`) → `initiateTelegramRentalPhotoUpload(rentalId, userId, photoType)` (`app/rentals/actions.ts:675`) sets `user_states.state='awaiting_rental_photo'` with a 15-minute TTL and context `{rental_id, photo_type}`. The `/actions` bot menu (`app/webhook-handlers/commands/actions.ts:135`) sets the same state.
2. **If the state is missing/expired, the webhook already auto-resolves the rental**: it queries `rentals` by `user_id` with status IN (`pending_confirmation`, `confirmed`, `active`) and infers photo type from completed `photo_start`/`photo_end` events (`webhook-handler.ts:207-258`). Silent first-match — no disambiguation when several rentals qualify.
3. The webhook downloads the **LARGEST** Telegram photo variant (`message.photo[message.photo.length - 1]`, full-res), uploads it to the **`rentals` bucket (public)** via `uploadSingleImage` (random UUID filename), and inserts an `events` row (`type='photo_start'|'photo_end'`, `status='completed'`, `payload.photo_url` = permanent public Supabase URL). State is cleared; renter gets a confirmation message.

> ⚠️ v1.0/v1.1 claimed "the photo URL is just the Telegram file URL, which expires" — **this is not true for the bot path.** Photos are already persisted permanently, but in a **public** bucket with flat UUID names, no per-rental structure, no metadata table, no hash, and no compression.

**WebApp page path — `addRentalPhoto(rentalId, userId, photoUrl, photoType)` (`app/rentals/actions.ts:949`):**

Writes `rentals.metadata.start_photo_url|end_photo_url` (single URL per type — overwritten on re-upload) + the same `events` row. Only the renter may call it; no operator path exists.

This PRD adds a new `uploadRentalPhoto` server action that downloads the Telegram file (or its thumbnail — see §5.7 bot auto-attach), compresses it, uploads it to the **private** `rental-photos` bucket under `<rental_id>/<photo_type>/<seq>-<timestamp>.jpg`, computes a SHA-256 hash, inserts a `rental_photos` metadata row, and records the event. The old event-based log and the public `rentals` bucket path are preserved for backward compatibility.

### Existing Upload Server Actions (verified inventory)

| # | Action / path | Location | Bucket | Privacy | Compression | Used by |
|---|---|---|---|---|---|---|
| 1 | `uploadImage(bucketName, file, fileName?)` | `hooks/supabase.ts:851` | caller-chosen | Public URL returned | none | `app/youtube_actions/actions.ts` (character images) |
| 2 | `uploadSingleImage(formData{file, bucketName})` | `app/rentals/actions.ts:272` | caller-chosen (`rentals` for bot photos) | Public URL returned | none | Telegram bot photo handler, rental pages |
| 3 | `uploadBatchImages(formData{files[], bucketName})` | `app/actions.ts:739` | caller-chosen | **Requires public bucket** (explicit check) | none | generic batch uploads |
| 4 | `PhotoUploadButton` (client component, direct upload w/ anon client) | `app/franchize/components/PhotoUploadButton.tsx` | `docpix` | Private (RLS allows anon INSERT) | **canvas resize 1920px, JPEG 0.85, 10 MB cap** | passport/license OCR flow → `/api/docphotoocr` |
| 5 | `verifyAndStoreDocument` (+ FormData wrapper) | `app/doc-verifier/actions.ts:91` | `DOC_BUCKET` | Private | none — but **computes SHA-256, stores metadata row, re-verifies by hash on download** | document integrity verification |

**Takeaways for this PRD:**

- #5 (`doc-verifier`) is the closest existing analog of the target design: private bucket + SHA-256 + metadata row. Copy its hash pattern.
- #4 proves client-side canvas compression works in this codebase — extract `reduceImageResolution` into a shared util and parameterize max size/quality instead of writing a second implementation.
- #2 is what the bot uses today; `uploadRentalPhoto` (§5.5) is its private-bucket, compressed, hashed successor. Keep #2 untouched for other callers.
- All current actions return **public URLs** — none fit a private bucket with signed URLs. `listRentalPhotos` (§5.5) must use `supabaseAdmin.storage.from('rental-photos').createSignedUrl(path, 900)`.
- Two admin clients exist: `@/hooks/supabase` and `@/lib/supabase-server`. New photo actions should use `@/lib/supabase-server` (the same one the OCR route and franchize server actions use).

---

## 4. User Stories

### 4.1 Operator — Capture ДО Photo at Handoff

**As** an operator of the VIP Bike crew, **when** I hand over a bike to a renter, **I want** to be prompted (but not forced) to take or collect at least one photo of the bike's current condition before the rental status flips to `active`, **so that** I have an immutable "before" state to compare against at return.

**Acceptance criteria** (v1 — soft warning, not blocking):
- The `confirmVehiclePickup` server action logs a warning if no photos exist in `rental-photos/<rental_id>/start/`, but does NOT reject the request.
- The franchize rental detail page shows a yellow "Фото ДО: 0" badge until photos are uploaded.
- The pickup confirmation modal shows a "Добавить фото ДО" button (optional, can skip).

### 4.2 Operator — Capture ПОСЛЕ Photo at Return

**As** an operator, **when** a renter returns a bike, **I want** to take or collect at least one photo of the returned condition before closing the rental, **so that** I have proof of the bike's state at return for damage disputes.

**Acceptance criteria** (v1 — soft warning, not blocking):
- The `confirmVehicleReturn` server action (closure modal submit) logs a warning if no photos exist in `rental-photos/<rental_id>/end/`, but does NOT reject the request.
- The closure modal shows a thumbnail strip of existing ПОСЛЕ photos with an "Добавить фото" button that opens a file picker.
- If the operator clicks "Закрыть аренду" without any ПОСЛЕ photos, show a confirmation dialog: "Не добавлено ни одного фото ПОСЛЕ. Всё равно закрыть?" with [Закрыть без фото] / [Добавить фото] buttons.

### 4.3 Renter — Upload Photo via Telegram (Bot Auto-Attach)

**As** a renter, **when** I receive the bike, **I want** to take a photo of any pre-existing damage and send it to the Telegram bot, **so that** I'm not held responsible for it at return — without needing to navigate any UI.

**Acceptance criteria**:
- The Telegram bot's photo handler (`gateway/telegram/webhook-handler.ts::handlePhotoMessage`) checks if the sender has an active rental (status `pending_confirmation`, `confirmed`, or `active`) tied to their `user_id` — this check already exists; see §5.7 note.
- If yes, the bot auto-detects the photo type based on rental status:
  - `pending_confirmation` or `confirmed` → photo_type = `start`
  - `active` → photo_type = `end`
- The bot downloads the Telegram file thumbnail (320px wide, JPEG, ~10-30 KB) — NOT the full-res file.
- The bot uploads the thumbnail to `rental-photos/<rental_id>/<photo_type>/` via the new `uploadRentalPhoto` server action.
- The renter sees a confirmation message: "📸 Фото привязано к аренде #abc12345 (ДО/ПОСЛЕ)" with a thumbnail preview.
- If the renter has multiple active rentals (rare edge case), the bot asks: "У вас 2 активные аренды: 1) Ducati Panigale (#abc12345), 2) Kawasaki EX650 (#def67890). К какой привязать фото?"

### 4.4 Operator — Compare ДО and ПОСЛЕ

**As** an operator, **when** I'm reviewing a rental before closure, **I want** to see ДО and ПОСЛЕ photos side-by-side, **so that** I can spot new damage quickly.

**Acceptance criteria**:
- The rental detail page renders a "Фото байка" section with two columns: ДО (left) and ПОСЛЕ (right).
- Each column shows a grid of thumbnails.
- Clicking a thumbnail opens a fullscreen gallery with keyboard navigation (←/→) and metadata overlay (timestamp, uploader, file size, hash).

### 4.5 Admin — Audit Photo History

**As** a crew owner/admin, **when** a damage dispute arises weeks after a rental ended, **I want** to retrieve the rental's full photo history, **so that** I can resolve the dispute with timestamped evidence.

**Acceptance criteria**:
- The rental detail page on a `completed` rental shows the photo section in read-only mode.
- Photos are retained for 12 months (configurable via `crew.metadata.photo_retention_months`).
- A nightly cron job moves photos older than 12 months to a `rental-photos-archive` bucket (cold storage, requires admin action to restore).

---

## 5. Technical Design

### 5.1 Storage Bucket & Path Schema

New private Supabase Storage bucket:

```sql
insert into storage.buckets (id, name, public)
values ('rental-photos', 'rental-photos', false)
on conflict (id) do nothing;
```

Path schema inside the bucket:

```
rental-photos/
  └─ <rental_id>/
     ├─ start/
     │  ├─ 1-<timestamp>-<uploader_id>.jpg
     │  ├─ 2-<timestamp>-<uploader_id>.jpg
     │  └─ ...
     └─ end/
        ├─ 1-<timestamp>-<uploader_id>.jpg
        └─ ...
```

Sequential prefix (1-, 2-, ...) preserves capture order even if timestamps are identical. Uploader ID supports audit ("who took this photo"). File extension is normalized to `.jpg` server-side — HEIC/RAW/etc are converted on upload via sharp.

### 5.2 RLS Policies

Three policies on `storage.objects` for the `rental-photos` bucket:

- **SELECT** — crew members (owner/admin/co_owner/member) of the bike's crew, OR the rental's renter (`auth.uid() = rentals.user_id`), OR service role.
- **INSERT** — service role only (uploads go through server actions using `supabaseAdmin`, never the anon client). This avoids RLS-bypass issues like the one we just fixed for VIN updates.
- **DELETE** — service role only (only the retention cron deletes photos).

The SELECT policy requires a join: `storage.objects` doesn't have a direct rental_id column, so we parse it from the file path. The policy uses a Postgres function `can_access_rental_photo(object_path text, user_id text)` that extracts the rental_id from the path and checks if the user is authorized.

### 5.3 Database Schema Changes

New table `rental_photos` (metadata index — the actual files live in Storage):

```sql
create table public.rental_photos (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rentals(rental_id) on delete cascade,
  photo_type text not null check (photo_type in ('start', 'end')),
  storage_path text not null,
  file_size_bytes integer not null,
  sha256_hash text not null,
  mime_type text not null default 'image/jpeg',
  width integer,
  height integer,
  uploaded_by text not null references users(user_id),
  uploader_role text not null check (uploader_role in ('renter', 'operator', 'admin', 'owner', 'bot')),
  source text not null default 'webapp' check (source in ('webapp', 'bot', 'operator_ui', 'drag_drop')),
  taken_at timestamptz not null default now(),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_rental_photos_rental on rental_photos(rental_id);
create index idx_rental_photos_type on rental_photos(rental_id, photo_type);
create index idx_rental_photos_taken on rental_photos(taken_at desc);
```

We also add two convenience columns to `rentals` for fast KPI queries:

```sql
alter table public.rentals
  add column if not exists start_photo_count integer not null default 0,
  add column if not exists end_photo_count integer not null default 0;
```

### 5.4 Compression Strategy (Freemium-Friendly)

Two-stage compression ensures we stay well within Supabase's 1GB free tier:

**Stage 1 — Client-side (browser/TG WebApp):**
- Use `canvas` + `toBlob` to resize image to max 1600px on long edge.
- Re-encode as JPEG quality 80.
- Reject input files > 10 MB at the file picker (don't even attempt to read).
- Typical output: 100-300 KB per photo.

**Stage 2 — Server-side (in `uploadRentalPhoto`):**
- Use `sharp` npm package to re-compress to max 1280px on long edge, JPEG quality 75.
- Strip all EXIF metadata (privacy + size).
- If output > 500 KB, progressively reduce quality by 5 until under 500 KB (floor at quality 50).
- Typical final output: 50-200 KB per photo.

**Telegram bot auto-attach (special case):**
- When the bot receives a photo message, it downloads the **thumbnail** (Telegram `getFile` for the smallest size variant, typically 320px wide).
- Thumbnail is already ~10-30 KB — no further compression needed.
- This is the most storage-efficient path — perfect for freemium.

**Storage budget projection:**
- Average rental: 4 photos (2 ДО + 2 ПОСЛЕ) × 150 KB = 600 KB per rental.
- 100 rentals/month × 600 KB = 60 MB/month.
- 12-month retention → 720 MB/year.
- Fits within 1GB free tier with margin. Upgrade to paid tier ($25/month for 8GB) needed only if rental volume doubles.

### 5.5 Server Actions

**uploadRentalPhoto(input) → {success, photoId?, error?}**

- Input: `{ rentalId, photoType: 'start' | 'end', file: Buffer, mimeType, uploaderUserId, uploaderRole, source }`
- Validates rental exists, status allows the photo type (start: pending_confirmation/confirmed; end: active).
- Validates uploader is authorized (renter or crew member).
- Server-side compression via sharp (max 1280px, quality 75, EXIF stripped).
- Hard reject if compressed size > 500 KB.
- Computes SHA-256 hash, checks for duplicates (same hash already on this rental+type → returns success with existing photoId, no re-upload).
- Uploads to `rental-photos/<rental_id>/<type>/<seq>-<timestamp>-<uploader>.jpg` via supabaseAdmin.storage.from('rental-photos').upload().
- Inserts row in `rental_photos`, increments `rentals.start_photo_count`/`end_photo_count`.
- Inserts `events` row with type `photo_start`/`photo_end`, payload includes storage_path, hash, size, source.

**listRentalPhotos(rentalId, photoType?) → {success, photos[]}**

- Returns array of `{ photoId, storagePath, signedUrl, takenAt, uploadedBy, uploaderRole, fileSizeBytes, sha256Hash, width, height }`
- Generates short-lived (15-min) signed URLs for each photo (since bucket is private).
- Caller must be authorized (renter or crew member).

**deleteRentalPhoto(photoId, actorUserId) → {success, error?}**

- Soft delete only in v1 — sets `metadata.deleted_at` and moves file to `rental-photos/_trash/<rental_id>/<type>/<file>`.
- Hard delete happens via retention cron after 30 days in trash.
- Only crew owner/admin can delete. Renter cannot delete their own uploads.

**getRentalPhotoStats(rentalId) → {startCount, endCount, latestStartAt, latestEndAt}**

- Fast read for UI badges and closure-modal warning state.

### 5.6 UI Integration Points

1. **Rental detail page** (`app/franchize/[slug]/rental/[id]/page.tsx`) — new `RentalPhotoGallery` component, rendered between the equipment checklist and the lifecycle actions. Two columns (ДО/ПОСЛЕ), thumbnails grid, click → fullscreen lightbox.

2. **Closure modal** in `FranchizeRentalLifecycleActions.tsx` — add a "Фото ПОСЛЕ" step before the final "Закрыть аренду" button. Shows existing ПОСЛЕ photos as thumbnails with an "Добавить фото" button (file input). Submit is ALLOWED without photos, but shows a confirmation dialog first.

3. **Pickup confirmation** in `FranchizeRentalLifecycleActions.tsx` — "Подтвердить выдачу" button opens a similar photo step for ДО photos. Also non-blocking.

4. **Telegram bot handler** in `gateway/telegram/webhook-handler.ts` (+ state-setting menu in `app/webhook-handlers/commands/actions.ts`) — see §5.7 below for bot auto-attach logic.

5. **Analytics drawer** in `app/franchize/[slug]/rentals-analytics/components/RentalDetailDrawer.tsx` — add a "Фото" section showing thumbnails (read-only, no upload).

### 5.7 Telegram Bot Auto-Attach (Key v1.1 Feature)

The bot auto-attaches photos to the renter's active rental without requiring explicit UI flows. This is the lowest-friction path for renters — they just send a photo to the bot like they would any Telegram message.

> **Already exists (verified 2026-08-11):** `handlePhotoMessage` in `gateway/telegram/webhook-handler.ts` already performs steps 1-4 below as a fallback when no `awaiting_rental_photo` state is set. The genuinely new work in this section is: step 5 (multi-rental disambiguation keyboard), writing the `rental_photos` metadata row + SHA-256 hash, uploading to the private `rental-photos` bucket instead of the public `rentals` bucket, and downloading the smallest photo variant instead of the largest.

**Detection logic** (in `gateway/telegram/webhook-handler.ts::handlePhotoMessage` — NOT `app/webhook-handlers/index.ts`, which does not exist):

1. On incoming photo message, extract `user_id` from `message.from.id`.
2. Query Supabase: `SELECT rental_id, status, vehicle_id FROM rentals WHERE user_id = ? AND status IN ('pending_confirmation', 'confirmed', 'active') ORDER BY agreed_end_date ASC LIMIT 5`.
3. If 0 active rentals → ignore (or reply: "У вас нет активных аренд. Если хотите загрузить фото — откройте карточку аренды на сайте.")
4. If 1 active rental → auto-attach. Determine photo_type:
   - status `pending_confirmation` or `confirmed` → `start`
   - status `active` → `end`
5. If >1 active rentals → reply with inline keyboard: "У вас N активных аренд. К какой привязать фото?" + buttons for each rental.

**Download strategy:**
- Telegram sends photos with multiple size variants (`photo[0]` is smallest, `photo[-1]` is largest).
- The bot downloads `photo[0]` (typically 320px wide, ~10-30 KB) — perfect for our use case (thumbnail quality sufficient for damage documentation, very freemium-friendly).
- If only `photo[1]` is available (160px), download that. Never download `photo[2]` or larger.
- This avoids the existing `initiateTelegramRentalPhotoUpload` flow entirely — no user state machine, no 15-min TTL, no manual redirect. The renter just sends a photo and it gets attached.

**Confirmation message:**
```
📸 Фото привязано к аренде #abc12345 (ДО)

Байк: Ducati Panigale S Electro Red
Статус: Ожидает выдачи

Спасибо! Фото сохранено и будет доступно оператору при возврате.
```

If the renter sends multiple photos in a row, each gets its own confirmation message.

**Backward compatibility:**
- The existing `initiateTelegramRentalPhotoUpload` flow (with explicit user state) stays for the WebApp-initiated path.
- The bot auto-attach is the new default for any direct photo message to the bot — no state required.

### 5.8 Closure Modal — Soft Warning (v1)

Modify `confirmVehiclePickup` and `confirmVehicleReturn` in `app/rentals/actions.ts`:

- If `rentals.start_photo_count = 0` (for pickup) or `end_photo_count = 0` (for return), log a warning and include `{ photoWarning: true }` in the response.
- Do NOT reject the request.
- The UI receives `photoWarning: true` and shows a toast: "⚠ Фото не добавлены. Рекомендуется добавить до закрытия." but the rental transitions normally.

This is the explicit v1 decision — make photos preferable, not mandatory. Will revisit in v2 based on adoption metrics.

---

## 6. Implementation Plan

### Phase 1 — Backend (Week 1)

- Create migration: `20260811000000_create_rental_photos.sql` (bucket + table + RLS + indexes + columns on rentals).
- Implement `uploadRentalPhoto`, `listRentalPhotos`, `deleteRentalPhoto`, `getRentalPhotoStats` server actions in `app/rentals/photo-actions.ts` (use `@/lib/supabase-server` admin client).
- ~~Install `sharp` npm package~~ — ✅ already installed (`package.json` → `sharp@^0.33.0`). Verify it loads in the Vercel serverless runtime; no action needed otherwise.
- Extract `reduceImageResolution` from `PhotoUploadButton.tsx` into a shared client util (parameterize max size + quality) for reuse in the rental photo UI.
- Add server-side compression + 500 KB hard limit + SHA-256 dedup logic (hash pattern: copy from `app/doc-verifier/actions.ts`).
- Add `photoWarning` field to `confirmVehiclePickup` and `confirmVehicleReturn` responses (soft warning, NOT blocking — v1 decision).
- Write unit tests for: RLS policy (renter can SELECT own rental photos; non-crew user cannot), hash dedup, sharp compression, 500 KB limit enforcement.

### Phase 2 — UI (Week 2)

- Build `RentalPhotoGallery` component (thumbnails + fullscreen lightbox).
- Wire it into the rental detail page.
- Add photo step to closure modal and pickup confirmation (non-blocking with warning).
- Add "Добавить фото" button → file picker → client-side compression (canvas + toBlob) → `uploadRentalPhoto` call.
- Add analytics drawer read-only photo section.
- Add soft warning toast when closing without photos.

### Phase 3 — Telegram Bot Auto-Attach (Week 2)

- Update photo handler in `gateway/telegram/webhook-handler.ts::handlePhotoMessage` to:
  - ~~Query rentals by `user_id` for active status~~ — ✅ already exists (auto-resolve fallback, lines 207-258).
  - ~~Auto-detect photo_type from rental status~~ — ✅ already exists.
  - Switch from downloading the LARGEST photo variant (`photo[photo.length - 1]`) to the smallest (`photo[0]`).
  - Add multi-rental disambiguation inline keyboard (currently silent first-match).
  - Call `uploadRentalPhoto` with `source: 'bot'`, `uploaderRole: 'renter'` (or `'bot'`) instead of `uploadSingleImage` → public `rentals` bucket.
- Send confirmation message with rental reference + thumbnail preview (Telegram `sendPhoto` with the persisted file's signed URL).
- Handle multi-active-rental edge case with inline keyboard.
- Keep existing `initiateTelegramRentalPhotoUpload` flow for WebApp-initiated uploads (backward compat).

### Phase 4 — Retention & Cleanup (Week 3)

- Nightly cron job (Supabase Edge Function or Vercel Cron) to archive photos older than 12 months.
- Move to `rental-photos-archive` bucket, delete from `rental-photos`, mark `rental_photos.archived_at`.
- Hard-delete from trash after 30 days.
- Admin UI to restore archived photos on dispute (admin-only server action).
- Weekly storage usage report: `SELECT sum(file_size_bytes) FROM rental_photos WHERE created_at > now() - interval '7 days'` → notify admin if growth exceeds 100 MB/week.

### Phase 5 — Polish (Week 3)

- Client-side EXIF GPS opt-in: renter sees a "Share location?" prompt when uploading ДО photo via WebApp. If yes, GPS coords stored in metadata for damage-dispute geolocation. Bot path: no GPS (Telegram strips it).
- Per-crew retention override: `crew.metadata.photo_retention_months` (default 12).
- Progressive quality reduction in sharp when output > 500 KB.
- HEIC support: detect iOS HEIC and convert via sharp + heic-decode.

---

## 7. Edge Cases & Risks

### Edge Cases

- **Renter uploads no photos, operator uploads all** — supported. Uploader role is recorded per photo.
- **Multiple photos on same rental** — supported. No hard cap in v1 (soft warning after 20 photos — "Слишком много фото, удалите старые").
- **Renter uploads photo AFTER rental ended** — rejected with "Аренда уже завершена — фото нельзя добавить".
- **Same photo uploaded twice (hash dedup)** — returns existing photoId, no re-upload. Saves storage.
- **Crew owner closes without photos (soft warning)** — allowed in v1. Owner sees "Закрыть без фото?" confirmation dialog. Event logged for audit.
- **Storage quota exceeded (1GB freemium)** — `uploadRentalPhoto` returns `{ success: false, error: 'Storage quota exceeded — upgrade plan or delete old photos' }`. UI shows actionable error.
- **Renter sends photo to bot with no active rental** — bot replies with friendly explanation and link to rentals page.
- **Renter sends non-photo (document, sticker)** — bot ignores (or replies "Пришлите фото в формате изображения").
- **Telegram thumbnail download fails (network error)** — bot retries once, then replies "Не удалось сохранить фото, попробуйте ещё раз".

### Risks

- **Storage cost growth** — mitigated by aggressive compression (500 KB hard limit), 12-month retention (down from 18), and bot-thumbnail path (~10-30 KB per photo). Monitor with weekly storage report. Upgrade trigger: 800 MB used.
- **Privacy / 152-ФЗ** — bike photos are NOT personal data (no faces, no plates required). However, GPS metadata is personal — strip by default, opt-in only on WebApp path. Bot path: no GPS (Telegram strips it).
- **Operator over-reliance on soft warning** — v1 explicitly accepts this risk. Will revisit making photos mandatory in v2 after collecting 3 months of adoption data.
- **Telegram file URL expiry** — the existing flow uses Telegram file URLs which expire. `uploadRentalPhoto` downloads and re-uploads to Supabase immediately, so the URL is never depended on long-term. Bot path downloads thumbnail, not full URL.
- **Sharp dependency size** — `sharp` adds ~25 MB to the server bundle. Acceptable for Vercel serverless. If bundle size becomes an issue, switch to `@squoosh/lib` (pure WASM, smaller but slower).

---

## 8. Success Metrics

Tracked weekly via the existing analytics pipeline:

- **Photo coverage rate** — % of completed rentals with ≥1 ДО AND ≥1 ПОСЛЕ photo. Target: 60% by week 4 post-launch (lower than v1.0's 95% target because photos are not mandatory).
- **Bot contribution rate** — % of photos uploaded via Telegram bot auto-attach (vs WebApp UI). Target: 50% (bot is the lowest-friction path).
- **Renter contribution rate** — % of photos uploaded by renters (vs operators). Target: 30% (renters opting in to document pre-existing damage).
- **Average photo size** — should be ≤150 KB. If average > 250 KB, compression logic needs investigation.
- **Storage growth** — GB/month. Target: linear, predictable. Anomalies trigger investigation.
- **Close-without-photos rate** — % of closures that proceeded without ПОСЛЕ photos. Target: <30% in month 1, <15% by month 3 (as adoption grows).

---

## 9. Open Questions

- Should renters be able to DELETE their own uploaded photos within 5 minutes of upload (typo correction window)? v1 says no — once uploaded, immutable. Revisit if renters complain.
- Should we OCR license plates in photos for theft recovery? Out of scope for v1 (no OCR on bike photos), but could be a v2 feature if bike theft becomes a problem.
- Should photos be watermarked with the rental_id + timestamp? Helps dispute evidence. Plan to add in Phase 5 polish if time permits.
- Should the operator be able to mark a specific ПОСЛЕ photo as "evidence of new damage" with a description? Yes — add `rental_photos.metadata.damage_note` field. Plan for Phase 5.
- Should we let renters upload via bot in FULL resolution (not just thumbnail)? v1.1 says no (freemium constraint). v2 could add a "high-quality upload" command (`/hqphoto`) that uses the WebApp flow with full compression pipeline.
- Should there be a "request photo from renter" button that sends the renter a Telegram notification asking them to send a photo? Yes — defer to v2.

---

## 10. Appendix

### A. Related Files

Files that will be modified during implementation:

- `supabase/migrations/20260811000000_create_rental_photos.sql` — new migration
- `app/rentals/photo-actions.ts` — new server actions file
- `app/rentals/actions.ts` — modify `confirmVehiclePickup`, `confirmVehicleReturn` (add `photoWarning` field)
- `app/franchize/components/RentalPhotoGallery.tsx` — new component
- `app/franchize/components/FranchizeRentalLifecycleActions.tsx` — add photo step to closure/pickup modals (non-blocking)
- `app/franchize/[slug]/rental/[id]/page.tsx` — render `RentalPhotoGallery`
- `app/franchize/[slug]/rentals-analytics/components/RentalDetailDrawer.tsx` — add read-only photo section
- `gateway/telegram/webhook-handler.ts` — bot auto-attach: disambiguation keyboard, smallest-variant download, `uploadRentalPhoto` call (auto-resolve fallback already present)
- `app/franchize/components/PhotoUploadButton.tsx` — extract `reduceImageResolution` into shared util
- ~~`package.json` — add `sharp` dependency~~ — ✅ already present (`sharp@^0.33.0`)

### B. Glossary

- **ДО photo** — photo of the bike at handoff (before rental starts). Russian: «фото ДО».
- **ПОСЛЕ photo** — photo of the bike at return (after rental ends). Russian: «фото ПОСЛЕ».
- **Soft warning** — v1 decision: UI shows a warning when photos are missing, but does not block the action.
- **Bot auto-attach** — bot detects renter's active rental from their `user_id` and attaches the photo automatically (no UI flow required).
- **Cold archive** — photos older than retention period, moved to a separate bucket, restored on-demand only.

### C. References

- Existing photo infrastructure: `supabase/migrations/20260113120000_create_docpix_storage_bucket.sql`
- Existing renter-side upload flow: `app/rentals/actions.ts:initiateTelegramRentalPhotoUpload` (line 675)
- Existing event-only log: `app/rentals/actions.ts:addRentalPhoto` (line 949 — also writes `rentals.metadata.*_photo_url`)
- Existing generic uploads: `hooks/supabase.ts:uploadImage` (851), `app/rentals/actions.ts:uploadSingleImage` (272), `app/actions.ts:uploadBatchImages` (739)
- Existing private-bucket + SHA-256 pattern: `app/doc-verifier/actions.ts` (line 91)
- Existing client-side compression: `app/franchize/components/PhotoUploadButton.tsx` (`reduceImageResolution`, 1920px/0.85)
- Rental lifecycle actions: `app/franchize/components/FranchizeRentalLifecycleActions.tsx`
- Telegram bot photo handler: `gateway/telegram/webhook-handler.ts::handlePhotoMessage` (line 181 — to be modified; auto-resolve fallback at 207-258 already exists)
- Bot `/actions` menu (sets `awaiting_rental_photo` state): `app/webhook-handlers/commands/actions.ts` (line 135)

### D. Compression Pseudocode

**Client-side (browser):**
```typescript
async function compressImageClient(file: File): Promise<Blob> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Файл слишком большой (макс. 10 МБ)');
  }
  const img = await createImageBitmap(file);
  const maxDim = 1600;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = new OffscreenCanvas(img.width * scale, img.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
}
```

**Server-side (in uploadRentalPhoto):**
```typescript
import sharp from 'sharp';

async function compressImageServer(input: Buffer): Promise<Buffer> {
  let quality = 75;
  let output = await sharp(input)
    .rotate()  // auto-orient from EXIF
    .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  while (output.length > 500 * 1024 && quality > 50) {
    quality -= 5;
    output = await sharp(input)
      .rotate()
      .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  }

  if (output.length > 500 * 1024) {
    throw new Error('Фото не удалось сжать до 500 КБ. Используйте другое фото.');
  }

  return output;
}
```

**Telegram bot thumbnail download:**
```typescript
async function downloadTelegramThumbnail(fileId: string): Promise<Buffer> {
  // Get file metadata
  const meta = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
  ).then(r => r.json());

  if (!meta.ok) throw new Error('Telegram getFile failed');

  // Download the file — for photos, this is already the smallest variant
  // (the bot should pass photo[0].file_id, not the largest size).
  const filePath = meta.result.file_path;
  const fileResp = await fetch(
    `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`
  );
  return Buffer.from(await fileResp.arrayBuffer());
}
```

