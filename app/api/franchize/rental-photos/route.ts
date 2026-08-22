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
 */
export async function GET(request: NextRequest) {
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

    // C3: pass callerUserId from cookie (was: from query param)
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
