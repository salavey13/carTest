// /app/api/franchize/rental-photos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { listRentalPhotos, getRentalPhotoStats } from "@/app/rentals/photo-actions";
// I3 hotfix (C3): validate caller identity via signed cookie.
import {
  TELEGRAM_ACTOR_COOKIE,
  verifyTelegramActorCookieValue,
} from "@/lib/telegram-actor-cookie";

// Force dynamic rendering because this route uses request.cookies for auth
export const dynamic = 'force-dynamic';

/**
 * GET /api/franchize/rental-photos?rentalId=<uuid>[&photoType=start|end]
 *
 * Returns signed URLs (15-min TTL) for all photos on a rental.
 * Optionally filtered by photo_type.
 *
 * I3 hotfix (C3): caller identity extracted from signed `cartest_tg_actor`
 * cookie — no longer trusts client-supplied `requesterUserId` query param.
 * The server action validates that the caller (from cookie) is authorized.
 *
 * task168 (boss: «show photos in rental page even for not authenticated
 * users — rental page opened on PC from rentals-analytics via password, and
 * in a nearby tab there are no photos visible»): the actor cookie is now
 * OPTIONAL for this READ endpoint. With a cookie → the same per-user
 * authorization as before. Without → callerUserId = null and
 * listRentalPhotos falls back to the RENTAL-CAPABILITY gate: the rentalId
 * uuid is unguessable and the rental page itself is already public with it,
 * so knowing the id is the same level of access the page already grants.
 * Uploads (POST /api/franchize/rental-photo-upload) still REQUIRE the cookie.
 */
export async function GET(request: NextRequest) {
  try {
    // ── C3: caller identity from signed cookie — OPTIONAL since task168 ──
    const cookieStore = request.cookies;
    const actorCookie = cookieStore.get(TELEGRAM_ACTOR_COOKIE)?.value;
    const callerUserId = verifyTelegramActorCookieValue(actorCookie);

    const rentalId = request.nextUrl.searchParams.get("rentalId");
    const photoType = request.nextUrl.searchParams.get("photoType") as
      | "start"
      | "end"
      | null;

    if (!rentalId) {
      return NextResponse.json(
        { error: "rentalId is required" },
        { status: 400 },
      );
    }

    if (photoType && !["start", "end"].includes(photoType)) {
      return NextResponse.json(
        { error: "photoType must be 'start' or 'end'" },
        { status: 400 },
      );
    }

    // C3: pass callerUserId from cookie (was: from query param).
    // task168: null (no cookie) is legal — listRentalPhotos then applies the
    // rental-capability gate instead of per-user authorization.
    const result = await listRentalPhotos(
      rentalId,
      photoType || undefined,
      callerUserId,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      photos: result.photos,
    });
  } catch (error: any) {
    console.error("[rental-photos] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to list photos" },
      { status: 500 },
    );
  }
}
