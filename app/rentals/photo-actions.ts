// /app/rentals/photo-actions.ts
"use server";

import { createHash, randomUUID } from "crypto";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

/**
 * I3 — Rental photo upload server actions.
 *
 * Pipeline:
 *   1. Validate input (rental exists, status allows photo_type, uploader authorized)
 *   2. Server-side compression via sharp (max 1280px, JPEG quality 75, EXIF stripped)
 *      - If output > 500 KB, progressively reduce quality by 5 (floor: 50)
 *      - Hard reject if still > 500 KB
 *   3. Compute SHA-256 hash
 *   4. Dedup check: if (rental_id, photo_type, hash) already exists → return existing photoId
 *   5. Upload to private `rental-photos` bucket under `<rental_id>/<type>/<seq>-<ts>-<uploader>.jpg`
 *   6. Insert metadata row in `rental_photos` table
 *   7. Increment `rentals.start_photo_count` or `end_photo_count`
 *   8. Insert `events` row (type=`photo_start`|`photo_end`) for audit trail
 *
 * Storage budget (PRD §5.4):
 *   - Average photo: 50-200 KB (target ≤150 KB)
 *   - 100 rentals/month × 4 photos × 150 KB = 60 MB/month
 *   - 12-month retention → 720 MB/year (fits 1GB free tier)
 *
 * Related: docs/RENTAL_PHOTO_UPLOAD_PRD.md v1.2 §5.5
 */

const PHOTO_BUCKET = "rental-photos";
const MAX_SIZE_BYTES = 500 * 1024; // 500 KB hard limit post-compression
const MAX_DIMENSION = 1280; // longest edge after compression
const QUALITY_FLOOR = 50;

export interface UploadRentalPhotoInput {
  rentalId: string;
  photoType: "start" | "end";
  /** Raw file bytes (will be compressed server-side). */
  file: Buffer;
  mimeType: string;
  /** User ID of the uploader (renter, operator, admin, owner, or bot system id). */
  uploaderUserId: string;
  /** I3 hotfix (C4): uploaderRole is now DERIVED server-side from the user's
   *  relationship to the rental — the client-supplied value is IGNORED.
   *  Kept in the interface for backward compat but not read. */
  uploaderRole?: "renter" | "operator" | "admin" | "owner" | "bot";
  /** Which surface initiated the upload. */
  source: "webapp" | "bot" | "operator_ui" | "drag_drop";
  /** Optional notes (e.g. damage description for ПОСЛЕ photos). */
  notes?: string;
  /** I4: damage_note — operator marks a ПОСЛЕ photo as evidence of new damage
   *  with a description. Stored in metadata.damage_note. Surfaces in the
   *  gallery as a red badge on the thumbnail + in the lightbox. */
  damageNote?: string;
}

export interface UploadRentalPhotoResult {
  success: boolean;
  photoId?: string;
  deduped?: boolean; // true if returned photoId is an existing duplicate
  error?: string;
}

/**
 * Compress an image buffer to JPEG ≤500 KB.
 * Strategy:
 *   1. Rotate (auto-orient from EXIF) + resize to max 1280px on long edge
 *   2. JPEG quality 75 (mozjpeg)
 *   3. If > 500 KB, reduce quality by 5 until ≤500 KB or quality floor (50) reached
 *   4. Strip all EXIF metadata (privacy + size)
 *
 * Returns the compressed buffer + dimensions.
 */
async function compressImage(
  input: Buffer,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  let quality = 75;
  let metadata = await sharp(input).metadata();
  let width = metadata.width ?? 0;
  let height = metadata.height ?? 0;

  let compressed = await sharp(input)
    .rotate() // auto-orient from EXIF
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  let { data, info } = compressed;
  width = info.width;
  height = info.height;

  // Progressive quality reduction if over size limit
  while (data.length > MAX_SIZE_BYTES && quality > QUALITY_FLOOR) {
    quality -= 5;
    compressed = await sharp(input)
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    data = compressed.data;
  }

  if (data.length > MAX_SIZE_BYTES) {
    throw new Error(
      `Не удалось сжать фото до 500 КБ (минимальное качество ${QUALITY_FLOOR}, размер ${Math.round(data.length / 1024)} КБ). Используйте другое фото.`,
    );
  }

  return { buffer: data, width, height };
}

/**
 * Compute SHA-256 hash of a buffer (for dedup + tamper detection).
 */
function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Ensure the rental-photos bucket exists. Idempotent.
 * Pattern borrowed from doc-verifier/actions.ts:ensureBucket().
 */
async function ensureBucket(): Promise<void> {
  const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
  if (error) {
    logger.error("[uploadRentalPhoto] Failed to list buckets:", error);
    return;
  }
  const exists = (buckets ?? []).some((b) => b.name === PHOTO_BUCKET);
  if (!exists) {
    logger.info("[uploadRentalPhoto] Bucket doesn't exist, creating...");
    const { error: createErr } = await supabaseAdmin.storage.createBucket(
      PHOTO_BUCKET,
      {
        public: false,
        fileSizeLimit: MAX_SIZE_BYTES,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      },
    );
    if (createErr) {
      logger.error("[uploadRentalPhoto] Bucket create failed:", createErr);
    }
  }
}

/**
 * Validate that the rental exists, the photo_type is allowed for its status,
 * and the uploader is authorized (renter or crew member).
 *
 * I3 hotfix (C4): returns the DERIVED uploader role — caller no longer trusts
 * the client-supplied role. The role is determined by the user's relationship
 * to the rental:
 *   - rental.user_id === uploader → "renter"
 *   - rental.owner_id === uploader → "owner"
 *   - crew_members.role === "member" → "operator"
 *   - crew_members.role === "admin"/"co_owner"/"owner" → that role
 */
async function validateUpload(
  rentalId: string,
  photoType: "start" | "end",
  uploaderUserId: string,
): Promise<
  | { ok: true; role: "renter" | "operator" | "admin" | "owner" | "bot" }
  | { ok: false; error: string }
> {
  const { data: rental, error } = await supabaseAdmin
    .from("rentals")
    .select("rental_id, user_id, owner_id, vehicle_id, status, agreed_start_date")
    .eq("rental_id", rentalId)
    .maybeSingle();

  if (error || !rental) {
    return { ok: false, error: "Аренда не найдена." };
  }

  // Status check: start photos before pickup OR within 1 hour of start;
  // end photos only when active.
  // I4 enhancement: allow ДО photos for active rentals within 1 hour of
  // agreed_start_date — operator might have flipped to active at handoff
  // but still wants to capture pre-rental photos.
  if (photoType === "start") {
    const allowedStatuses = ["pending_confirmation", "confirmed"];
    // Also allow 'active' if within ±1 hour of agreed_start_date
    if (rental.status === "active" && rental.agreed_start_date) {
      const startTime = new Date(rental.agreed_start_date).getTime();
      const now = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;
      if (Math.abs(now - startTime) < ONE_HOUR) {
        allowedStatuses.push("active");
      }
    }
    if (!allowedStatuses.includes(rental.status)) {
      return {
        ok: false,
        error: "Фото ДО можно добавить только до выдачи или в течение часа после начала аренды.",
      };
    }
  } else {
    if (rental.status !== "active") {
      return {
        ok: false,
        error: "Фото ПОСЛЕ можно добавить только для активной аренды.",
      };
    }
  }

  // Auth + role derivation: renter (user_id) matches
  if (rental.user_id === uploaderUserId) {
    return { ok: true, role: "renter" };
  }
  // owner_id matches
  if (rental.owner_id === uploaderUserId) {
    return { ok: true, role: "owner" };
  }

  // Auth: crew member of the bike's crew
  if (rental.vehicle_id) {
    const { data: vehicle } = await supabaseAdmin
      .from("cars")
      .select("crew_id")
      .eq("id", rental.vehicle_id)
      .maybeSingle();

    if (vehicle?.crew_id) {
      const { data: membership } = await supabaseAdmin
        .from("crew_members")
        .select("role, membership_status")
        .eq("crew_id", vehicle.crew_id)
        .eq("user_id", uploaderUserId)
        .maybeSingle();

      if (
        membership?.membership_status === "active" &&
        ["owner", "admin", "co_owner", "member"].includes(membership.role)
      ) {
        // Map crew role to uploader role
        const roleMap: Record<string, "operator" | "admin" | "owner"> = {
          member: "operator",
          admin: "admin",
          co_owner: "admin",
          owner: "owner",
        };
        return { ok: true, role: roleMap[membership.role] };
      }
    }
  }

  return { ok: false, error: "Недостаточно прав для загрузки фото." };
}

/**
 * Upload a rental photo with full pipeline: validate → compress → hash → dedup →
 * upload to private bucket → insert metadata → increment counter → log event.
 */
export async function uploadRentalPhoto(
  input: UploadRentalPhotoInput,
): Promise<UploadRentalPhotoResult> {
  const { rentalId, photoType, file, mimeType, uploaderUserId, source, notes, damageNote } = input;
  // I3 hotfix (C4): ignore client-supplied uploaderRole — derive from auth
  // The `input.uploaderRole` field is kept for backward compat but not read.

  if (!rentalId || !file || file.length === 0) {
    return { success: false, error: "rentalId and file are required." };
  }

  // Pre-compression size guard — I4 enhancement: raised from 10 MB → 25 MB
  // because modern phones (especially iPhones with HEIC) produce 10-12 MB photos.
  // The sharp compression pipeline handles them fine.
  if (file.length > 25 * 1024 * 1024) {
    return {
      success: false,
      error: `Файл слишком большой (${Math.round(file.length / 1024 / 1024)} МБ, макс. 25 МБ до сжатия).`,
    };
  }

  try {
    // 1. Validate (returns derived role)
    const validation = await validateUpload(rentalId, photoType, uploaderUserId);
    if (!validation.ok) {
      return { success: false, error: validation.error };
    }
    const derivedRole = validation.role; // C4: server-derived, not client-supplied

    // 2. Compress
    const { buffer: compressed, width, height } = await compressImage(file);

    // 3. Hash
    const hash = sha256(compressed);

    // 4. Dedup check
    const { data: existing } = await supabaseAdmin
      .from("rental_photos")
      .select("id")
      .eq("rental_id", rentalId)
      .eq("photo_type", photoType)
      .eq("sha256_hash", hash)
      .maybeSingle();

    if (existing) {
      logger.info("[uploadRentalPhoto] Dedup hit, returning existing", {
        rentalId,
        photoType,
        hash: hash.slice(0, 16),
      });
      return { success: true, photoId: existing.id, deduped: true };
    }

    // 5. Ensure bucket exists
    await ensureBucket();

    // 6. Build storage path: <rental_id>/<type>/<seq>-<ts>-<uploader>.jpg
    //    seq = current count + 1 (preserves capture order)
    const { count: existingCount } = await supabaseAdmin
      .from("rental_photos")
      .select("id", { count: "exact", head: true })
      .eq("rental_id", rentalId)
      .eq("photo_type", photoType);
    const seq = (existingCount ?? 0) + 1;
    const timestamp = Date.now();
    const storagePath = `${rentalId}/${photoType}/${seq}-${timestamp}-${uploaderUserId}.jpg`;

    // 7. Upload to storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .upload(storagePath, compressed, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      logger.error("[uploadRentalPhoto] Storage upload failed:", uploadError);
      return { success: false, error: `Storage upload failed: ${uploadError.message}` };
    }

    // 8. Insert metadata row
    const { data: photoRow, error: insertError } = await supabaseAdmin
      .from("rental_photos")
      .insert({
        rental_id: rentalId,
        photo_type: photoType,
        storage_path: storagePath,
        file_size_bytes: compressed.length,
        sha256_hash: hash,
        mime_type: "image/jpeg", // always JPEG after compression
        width,
        height,
        uploaded_by: uploaderUserId,
        uploader_role: derivedRole, // C4: server-derived, not client-supplied
        source,
        // I4: store notes + damage_note in metadata JSONB
        metadata: {
          ...(notes ? { notes } : {}),
          ...(damageNote ? { damage_note: damageNote } : {}),
        },
      })
      .select("id")
      .single();

    if (insertError) {
      // Rollback storage upload if metadata insert fails
      await supabaseAdmin.storage.from(PHOTO_BUCKET).remove([storagePath]);
      logger.error("[uploadRentalPhoto] Metadata insert failed:", insertError);
      return { success: false, error: `Metadata insert failed: ${insertError.message}` };
    }

    // 9. Increment counter on rentals (atomic RPC — added in I3 hotfix C5)
    const counterColumn = photoType === "start" ? "start_photo_count" : "end_photo_count";
    const { error: counterError } = await supabaseAdmin.rpc("increment_photo_count", {
      p_rental_id: rentalId,
      p_column: counterColumn,
      p_delta: 1,
    });

    if (counterError) {
      // RPC should exist after migration 20260811000002. If it doesn't, log loudly.
      logger.error("[uploadRentalPhoto] Counter increment RPC failed (non-fatal but counters will drift):", counterError);
    }

    // 10. Insert event row for audit trail (compatible with existing photo_start/photo_end events)
    const { error: eventError } = await supabaseAdmin.from("events").insert({
      rental_id: rentalId,
      type: `photo_${photoType}`,
      status: "completed",
      created_by: uploaderUserId,
      payload: {
        photo_id: photoRow.id,
        storage_path: storagePath,
        sha256_hash: hash,
        file_size_bytes: compressed.length,
        width,
        height,
        source,
        uploader_role: derivedRole, // C4: server-derived
        notes: notes || null,
      },
    });

    if (eventError) {
      logger.warn("[uploadRentalPhoto] Event insert failed (non-fatal):", eventError);
    }

    logger.info("[uploadRentalPhoto] Success", {
      rentalId,
      photoType,
      photoId: photoRow.id,
      sizeBytes: compressed.length,
      hash: hash.slice(0, 16),
    });

    return { success: true, photoId: photoRow.id };
  } catch (err: any) {
    logger.error("[uploadRentalPhoto] Exception:", err);
    return {
      success: false,
      error: err?.message || "Unknown error during photo upload.",
    };
  }
}

/**
 * List all photos for a rental (optionally filtered by type).
 * Returns signed URLs (15-minute TTL) since the bucket is private.
 *
 * Caller must be authorized (renter or crew member).
 */
export async function listRentalPhotos(
  rentalId: string,
  photoType?: "start" | "end",
  requesterUserId: string,
): Promise<{
  success: boolean;
  photos?: Array<{
    photoId: string;
    photoType: string;
    storagePath: string;
    signedUrl: string;
    signedUrlExpiresAt: string;
    fileSizeBytes: number;
    width: number | null;
    height: number | null;
    uploadedBy: string;
    uploaderRole: string;
    source: string;
    takenAt: string;
    metadata: Record<string, unknown>;
  }>;
  error?: string;
}> {
  if (!rentalId) return { success: false, error: "rentalId is required." };

  try {
    // Auth check (reuse validateUpload's auth logic but skip status check)
    const { data: rental, error: rentalErr } = await supabaseAdmin
      .from("rentals")
      .select("rental_id, user_id, owner_id, vehicle_id")
      .eq("rental_id", rentalId)
      .maybeSingle();

    if (rentalErr || !rental) {
      return { success: false, error: "Аренда не найдена." };
    }

    let authorized =
      rental.user_id === requesterUserId || rental.owner_id === requesterUserId;

    if (!authorized && rental.vehicle_id) {
      const { data: vehicle } = await supabaseAdmin
        .from("cars")
        .select("crew_id")
        .eq("id", rental.vehicle_id)
        .maybeSingle();
      if (vehicle?.crew_id) {
        const { data: membership } = await supabaseAdmin
          .from("crew_members")
          .select("role, membership_status")
          .eq("crew_id", vehicle.crew_id)
          .eq("user_id", requesterUserId)
          .maybeSingle();
        if (
          membership?.membership_status === "active" &&
          ["owner", "admin", "co_owner", "member"].includes(membership.role)
        ) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return { success: false, error: "Недостаточно прав для просмотра фото." };
    }

    // Fetch photo rows
    let query = supabaseAdmin
      .from("rental_photos")
      .select(
        "id, photo_type, storage_path, file_size_bytes, width, height, uploaded_by, uploader_role, source, created_at, metadata",
      )
      .eq("rental_id", rentalId)
      .order("created_at", { ascending: true });

    if (photoType) {
      query = query.eq("photo_type", photoType);
    }

    const { data: rows, error: queryErr } = await query;
    if (queryErr) {
      return { success: false, error: queryErr.message };
    }

    if (!rows || rows.length === 0) {
      return { success: true, photos: [] };
    }

    // Generate signed URLs (15-minute TTL)
    const paths = rows.map((r) => r.storage_path);
    const { data: signedUrls, error: signedErr } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(paths, 900);

    if (signedErr) {
      logger.error("[listRentalPhotos] Signed URL generation failed:", signedErr);
      return { success: false, error: "Failed to generate signed URLs." };
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const photos = rows.map((row, i) => ({
      photoId: row.id,
      photoType: row.photo_type,
      storagePath: row.storage_path,
      signedUrl: signedUrls?.[i]?.signedUrl ?? "",
      signedUrlExpiresAt: expiresAt,
      fileSizeBytes: row.file_size_bytes,
      width: row.width,
      height: row.height,
      uploadedBy: row.uploaded_by,
      uploaderRole: row.uploader_role,
      source: row.source,
      takenAt: row.created_at,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
    }));

    return { success: true, photos };
  } catch (err: any) {
    logger.error("[listRentalPhotos] Exception:", err);
    return { success: false, error: err?.message || "Unknown error." };
  }
}

/**
 * Fast read for UI badges and closure-modal warning state.
 * Uses the counter columns on `rentals` (avoids joining rental_photos).
 */
export async function getRentalPhotoStats(
  rentalId: string,
): Promise<{
  startCount: number;
  endCount: number;
  latestStartAt: string | null;
  latestEndAt: string | null;
} | null> {
  if (!rentalId) return null;

  // I3 hotfix (H2): query rental_photos DIRECTLY instead of trusting the
  // counter columns on rentals. The counters can drift if the RPC fails or
  // if rows are manually inserted. Querying the source of truth is safer
  // and only marginally slower (one indexed query).
  //
  // Single query: get all photo rows for this rental, aggregate in JS.
  const { data: rows, error } = await supabaseAdmin
    .from("rental_photos")
    .select("photo_type, created_at")
    .eq("rental_id", rentalId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("[getRentalPhotoStats] Query failed:", error);
    return null;
  }

  const startRows = (rows ?? []).filter((r) => r.photo_type === "start");
  const endRows = (rows ?? []).filter((r) => r.photo_type === "end");

  return {
    startCount: startRows.length,
    endCount: endRows.length,
    latestStartAt: startRows.length > 0 ? startRows[0].created_at : null,
    latestEndAt: endRows.length > 0 ? endRows[0].created_at : null,
  };
}

/**
 * Soft-delete a photo. Moves the file to `rental-photos/_trash/<rental_id>/<type>/<file>`
 * and sets `deleted_at` on the metadata row.
 *
 * Hard delete happens via the retention cron (I4) after 30 days in trash.
 *
 * Only crew owner/admin can delete. Renters cannot delete their own uploads
 * (audit trail integrity).
 */
export async function deleteRentalPhoto(
  photoId: string,
  actorUserId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!photoId || !actorUserId) {
    return { success: false, error: "photoId and actorUserId are required." };
  }

  try {
    // M1: fetch photo_type in the INITIAL query (was a separate query after update)
    const { data: photo, error: photoErr } = await supabaseAdmin
      .from("rental_photos")
      .select("id, rental_id, storage_path, photo_type, deleted_at")
      .eq("id", photoId)
      .maybeSingle();

    if (photoErr || !photo) {
      return { success: false, error: "Фото не найдено." };
    }

    if (photo.deleted_at) {
      return { success: false, error: "Фото уже удалено." };
    }

    // Auth: only crew owner/admin can delete
    const { data: rental } = await supabaseAdmin
      .from("rentals")
      .select("vehicle_id")
      .eq("rental_id", photo.rental_id)
      .maybeSingle();

    let authorized = false;
    if (rental?.vehicle_id) {
      const { data: vehicle } = await supabaseAdmin
        .from("cars")
        .select("crew_id")
        .eq("id", rental.vehicle_id)
        .maybeSingle();
      if (vehicle?.crew_id) {
        const { data: membership } = await supabaseAdmin
          .from("crew_members")
          .select("role, membership_status")
          .eq("crew_id", vehicle.crew_id)
          .eq("user_id", actorUserId)
          .maybeSingle();
        if (
          membership?.membership_status === "active" &&
          ["owner", "admin"].includes(membership.role)
        ) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return { success: false, error: "Только owner/admin экипажа может удалять фото." };
    }

    // M2: TOCTOU guard — conditional update, only if deleted_at IS NULL.
    // If another caller already deleted it, this returns 0 rows updated.
    const { error: claimErr, count: claimCount } = await supabaseAdmin
      .from("rental_photos")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", photoId)
      .is("deleted_at", null)
      .select("id", { count: "exact", head: true });

    if (claimErr) {
      logger.error("[deleteRentalPhoto] Claim update failed:", claimErr);
      return { success: false, error: "Не удалось обновить запись фото." };
    }
    if (claimCount === 0) {
      // Another caller already deleted it
      return { success: false, error: "Фото уже удалено другим вызовом." };
    }

    // Move file to _trash/
    const trashPath = photo.storage_path.replace(
      /^([^/]+)\//,
      "_trash/$1/",
    );

    // Copy to trash
    const { data: fileData, error: downloadErr } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .download(photo.storage_path);
    if (downloadErr) {
      logger.error("[deleteRentalPhoto] Download for move failed:", downloadErr);
      // Rollback the deleted_at claim so another caller can retry
      await supabaseAdmin.from("rental_photos").update({ deleted_at: null }).eq("id", photoId);
      return { success: false, error: "Не удалось прочитать файл для перемещения." };
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const { error: trashUploadErr } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .upload(trashPath, buffer, { contentType: "image/jpeg" });
    if (trashUploadErr) {
      logger.error("[deleteRentalPhoto] Trash upload failed:", trashUploadErr);
      await supabaseAdmin.from("rental_photos").update({ deleted_at: null }).eq("id", photoId);
      return { success: false, error: "Не удалось переместить файл в корзину." };
    }

    // H1: Remove original — CHECK the error (was silently swallowed)
    const { error: removeErr } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .remove([photo.storage_path]);
    if (removeErr) {
      // Rollback: delete the trash copy so we don't have a duplicate
      await supabaseAdmin.storage.from(PHOTO_BUCKET).remove([trashPath]);
      // Rollback the deleted_at claim
      await supabaseAdmin.from("rental_photos").update({ deleted_at: null }).eq("id", photoId);
      logger.error("[deleteRentalPhoto] Original remove failed; rolled back trash copy + claim:", removeErr);
      return { success: false, error: "Не удалось удалить оригинал файла." };
    }

    // Update storage_path to trash path (so future hard-delete can find it)
    const { error: updateErr } = await supabaseAdmin
      .from("rental_photos")
      .update({ storage_path: trashPath })
      .eq("id", photoId);

    if (updateErr) {
      logger.error("[deleteRentalPhoto] Storage path update failed (non-fatal — file already moved):", updateErr);
    }

    // C5: Decrement counter atomically via RPC (was read-modify-write race)
    const counterColumn = photo.photo_type === "start" ? "start_photo_count" : "end_photo_count";
    const { error: decErr } = await supabaseAdmin.rpc("increment_photo_count", {
      p_rental_id: photo.rental_id,
      p_column: counterColumn,
      p_delta: -1, // GREATEST(0, ...) clamps to 0
    });
    if (decErr) {
      logger.error("[deleteRentalPhoto] Counter decrement RPC failed (non-fatal but counters will drift):", decErr);
    }

    logger.info("[deleteRentalPhoto] Soft-deleted", {
      photoId,
      actorUserId,
      originalPath: photo.storage_path,
      trashPath,
    });

    return { success: true };
  } catch (err: any) {
    logger.error("[deleteRentalPhoto] Exception:", err);
    return { success: false, error: err?.message || "Unknown error." };
  }
}
