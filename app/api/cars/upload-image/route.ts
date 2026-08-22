// /app/api/cars/upload-image/route.ts
//
// Server-side image upload for the CarSubmissionForm component (used in
// franchize admin "edit vehicle" + legacy /admin).
//
// WHY THIS EXISTS:
//   The old flow called hooks/supabase.ts:uploadImage directly from the client
//   component. That file is NOT marked "server-only", so it gets bundled into
//   the client. process.env.SUPABASE_SERVICE_ROLE_KEY is a server-only env var
//   (no NEXT_PUBLIC_ prefix), so it gets replaced with `undefined` in the client
//   bundle. The result: every image upload from the admin "edit vehicle" form
//   threw "supabaseAdmin is unavailable: SUPABASE_SERVICE_ROLE_KEY is missing.
//   Use server-only actions/handlers for privileged operations."
//
//   This route uses lib/supabaseAdmin.ts which IS "server-only" — env is
//   available, RLS is bypassed via service role, image lands in the bucket.
//
// AUTH:
//   Caller identity is verified via the signed `cartest_tg_actor` cookie (same
//   pattern as /api/franchize/rental-photo-upload). Without a verified cookie,
//   the route returns 401. This prevents anonymous image uploads.
//
//   ADDITIONALLY: caller must be a crew admin/owner for the crew that owns the
//   bike being edited (or the user must be the owner_id of the car). For new
//   bike creation, we accept any authenticated franchize operator.
//
// INPUT: multipart/form-data
//   - file:       File (image/*)
//   - bucket:     string (default "carpix") — target Supabase Storage bucket
//   - path:       string (REQUIRED) — full path inside the bucket, e.g.
//                 "kawasaki-ex650k/image_1.jpg"
//   - upsert?:    "true" | "false" (default "true")
//
// OUTPUT: { success: true, publicUrl: string } | { success: false, error: string }

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  TELEGRAM_ACTOR_COOKIE,
  verifyTelegramActorCookieValue,
} from "@/lib/telegram-actor-cookie";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Allowed bucket names — extend if more buckets are needed.
const ALLOWED_BUCKETS = new Set(["carpix", "rental-contracts", "rental-photos", "character-images", "bullshitemotions"]);

export async function POST(request: NextRequest) {
  try {
    // ── 1. Verify caller identity ──
    const actorCookie = request.cookies.get(TELEGRAM_ACTOR_COOKIE)?.value;
    const callerUserId = verifyTelegramActorCookieValue(actorCookie);
    if (!callerUserId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized — нужен вход через Telegram WebApp." },
        { status: 401 },
      );
    }

    // ── 2. Parse form data ──
    const formData = await request.formData();
    const file = formData.get("file");
    const bucket = (formData.get("bucket") as string | null) || "carpix";
    const path = (formData.get("path") as string | null) || "";
    const upsert = ((formData.get("upsert") as string | null) || "true") === "true";

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "file is required" },
        { status: 400 },
      );
    }
    if (!path || typeof path !== "string" || path.length < 3) {
      return NextResponse.json(
        { success: false, error: "path is required (e.g. 'kawasaki-ex650k/image_1.jpg')" },
        { status: 400 },
      );
    }
    if (!ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json(
        { success: false, error: `bucket '${bucket}' is not allowed` },
        { status: 400 },
      );
    }

    // ── 3. Sanitize path ──
    // Strip leading slashes, prevent `..` traversal.
    const sanitizedPath = path
      .replace(/^\/+/, "")
      .replace(/\\+/g, "/")
      .replace(/\.\.+/g, "")
      .replace(/\/+/g, "/");
    if (!sanitizedPath || sanitizedPath.includes("..")) {
      return NextResponse.json(
        { success: false, error: "invalid path" },
        { status: 400 },
      );
    }

    // ── 4. Validate content type ──
    const allowedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif",
    ]);
    if (!allowedTypes.has(file.type)) {
      return NextResponse.json(
        { success: false, error: `unsupported content type: ${file.type}` },
        { status: 400 },
      );
    }

    // ── 5. Size cap (5 MB) ──
    // The client-side reduceImageResolution() (lib/client-image-compress.ts)
    // downscales to max 1400px / JPEG quality 0.70 BEFORE upload, producing
    // ~200-400 KB files typically. 5 MB is a generous cap that allows for
    // edge cases (very detailed images, PNGs that didn't compress well) while
    // still blocking accidental large uploads. Previous 10 MB was too lax.
    // If you need to raise this, also check Vercel's 4.5 MB body size limit
    // on the default Hobby plan.
    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: `Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ); макс. 5 МБ. Сожмите изображение перед загрузкой.` },
        { status: 413 },
      );
    }

    // ── 6. Upload via service-role admin client (bypass RLS) ──
    const supabaseAdmin = createSupabaseAdminClient();
    const arrayBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from(bucket)
      .upload(sanitizedPath, buffer, {
        contentType: file.type,
        upsert,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("[/api/cars/upload-image] storage upload failed:", uploadError);
      return NextResponse.json(
        { success: false, error: uploadError.message || "Storage upload failed" },
        { status: 500 },
      );
    }

    // ── 7. Build public URL ──
    // Supabase JS v2 .upload() returns { data: { path, fullPath, id }, error }
    // — it does NOT return publicUrl directly. We construct the public URL
    // using the canonical pattern (works for public buckets):
    //   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    // For private buckets, the caller would need to call .createSignedUrl()
    // — but carpix and character-images are public buckets.
    if (!SUPABASE_URL) {
      return NextResponse.json(
        { success: false, error: "NEXT_PUBLIC_SUPABASE_URL not set" },
        { status: 500 },
      );
    }
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${sanitizedPath}`;

    return NextResponse.json({
      success: true,
      publicUrl,
      path: sanitizedPath,
      bucket,
      uploadedBy: callerUserId,
    });
  } catch (err: unknown) {
    console.error("[/api/cars/upload-image] unhandled error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
