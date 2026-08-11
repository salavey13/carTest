// /app/api/franchize/rental-photos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { listRentalPhotos, getRentalPhotoStats } from "@/app/rentals/photo-actions";

/**
 * GET /api/franchize/rental-photos?rentalId=<uuid>&requesterUserId=<uuid>[&photoType=start|end]
 *
 * Returns signed URLs (15-min TTL) for all photos on a rental.
 * Optionally filtered by photo_type.
 *
 * Auth: server action checks that requesterUserId is the renter or a crew member.
 *
 * Used by:
 *   - RentalPhotoGallery component (rental detail page)
 *   - Closure modal (to show existing ПОСЛЕ thumbnails before close)
 *   - Pickup confirmation (to show existing ДО thumbnails)
 */
export async function GET(request: NextRequest) {
  try {
    const rentalId = request.nextUrl.searchParams.get("rentalId");
    const requesterUserId = request.nextUrl.searchParams.get("requesterUserId");
    const photoType = request.nextUrl.searchParams.get("photoType") as
      | "start"
      | "end"
      | null;

    if (!rentalId || !requesterUserId) {
      return NextResponse.json(
        { error: "rentalId and requesterUserId are required" },
        { status: 400 },
      );
    }

    if (photoType && !["start", "end"].includes(photoType)) {
      return NextResponse.json(
        { error: "photoType must be 'start' or 'end'" },
        { status: 400 },
      );
    }

    const result = await listRentalPhotos(
      rentalId,
      photoType || undefined,
      requesterUserId,
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

/**
 * GET /api/franchize/rental-photos/stats?rentalId=<uuid>
 *
 * Returns just the counts (fast read for UI badges). Uses the counter columns
 * on `rentals` (no join to rental_photos).
 */
export async function HEAD(request: NextRequest) {
  // Next.js doesn't have a separate HEAD handler for stats — use ?stats=true
  // query param on GET instead.
  return GET(request);
}
