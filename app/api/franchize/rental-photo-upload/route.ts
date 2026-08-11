// /app/api/franchize/rental-photo-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { uploadRentalPhoto } from "@/app/rentals/photo-actions";
// I3 hotfix (C3): validate caller identity via signed cookie — no longer trust
// client-supplied uploaderUserId (anyone could POST with someone else's id).
import {
  TELEGRAM_ACTOR_COOKIE,
  verifyTelegramActorCookieValue,
} from "@/lib/telegram-actor-cookie";

/**
 * POST /api/franchize/rental-photo-upload
 *
 * Multipart form data:
 *   - file:        the image file (will be compressed server-side via sharp)
 *   - rentalId:    UUID of the rental
 *   - photoType:   "start" | "end"
 *   - source:      "webapp" | "operator_ui" | "drag_drop"
 *   - notes?:      optional notes (e.g. damage description)
 *
 * Returns: { success, photoId?, deduped?, error? }
 *
 * I3 hotfix (C3): caller identity is now extracted from the signed
 * `cartest_tg_actor` cookie. The client no longer sends `uploaderUserId` or
 * `uploaderRole` — the server derives both:
 *   - userId = from verified cookie
 *   - role = from user's relationship to the rental (renter/owner/operator)
 *
 * This prevents auth bypass where anyone could POST with a forged user_id.
 */
export async function POST(request: NextRequest) {
  try {
    // ── C3: Verify caller identity from signed cookie ──
    const cookieStore = request.cookies;
    const actorCookie = cookieStore.get(TELEGRAM_ACTOR_COOKIE)?.value;
    const callerUserId = verifyTelegramActorCookieValue(actorCookie);

    if (!callerUserId) {
      return NextResponse.json(
        { error: "Unauthorized — нужен вход через Telegram WebApp." },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const rentalId = formData.get("rentalId") as string | null;
    const photoType = formData.get("photoType") as "start" | "end" | null;
    const source = (formData.get("source") as string | null) || "webapp";
    const notes = (formData.get("notes") as string | null) || undefined;

    // Validate required fields
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!rentalId || !photoType) {
      return NextResponse.json(
        { error: "rentalId and photoType are required" },
        { status: 400 },
      );
    }
    if (!["start", "end"].includes(photoType)) {
      return NextResponse.json(
        { error: "photoType must be 'start' or 'end'" },
        { status: 400 },
      );
    }

    // Read file into Buffer for the server action
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // C4: uploaderRole is NOT passed from client — server derives it in validateUpload
    const result = await uploadRentalPhoto({
      rentalId,
      photoType,
      file: buffer,
      mimeType: file.type || "image/jpeg",
      uploaderUserId: callerUserId, // C3: from verified cookie, not form data
      source: source as "webapp" | "operator_ui" | "drag_drop",
      notes,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      photoId: result.photoId,
      deduped: result.deduped,
    });
  } catch (error: any) {
    console.error("[rental-photo-upload] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload photo" },
      { status: 500 },
    );
  }
}
