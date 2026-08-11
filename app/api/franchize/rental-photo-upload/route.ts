// /app/api/franchize/rental-photo-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { uploadRentalPhoto } from "@/app/rentals/photo-actions";

/**
 * POST /api/franchize/rental-photo-upload
 *
 * Multipart form data:
 *   - file:        the image file (will be compressed server-side via sharp)
 *   - rentalId:    UUID of the rental
 *   - photoType:   "start" | "end"
 *   - uploaderUserId: user ID of the uploader
 *   - uploaderRole:    "renter" | "operator" | "admin" | "owner"
 *   - source:      "webapp" | "operator_ui" | "drag_drop"
 *   - notes?:      optional notes (e.g. damage description)
 *
 * Returns: { success, photoId?, deduped?, error? }
 *
 * Auth: the server action validates that the uploader is authorized
 * (renter or crew member of the bike's crew). No separate auth here —
 * the server action is the source of truth.
 *
 * Used by:
 *   - RentalPhotoGallery component (rental detail page)
 *   - Closure modal "Добавить фото ПОСЛЕ" button (I3)
 *   - Pickup confirmation "Добавить фото ДО" button (I3)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const rentalId = formData.get("rentalId") as string | null;
    const photoType = formData.get("photoType") as "start" | "end" | null;
    const uploaderUserId = formData.get("uploaderUserId") as string | null;
    const uploaderRole = formData.get("uploaderRole") as
      | "renter"
      | "operator"
      | "admin"
      | "owner"
      | null;
    const source = (formData.get("source") as string | null) || "webapp";
    const notes = (formData.get("notes") as string | null) || undefined;

    // Validate required fields
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!rentalId || !photoType || !uploaderUserId || !uploaderRole) {
      return NextResponse.json(
        { error: "rentalId, photoType, uploaderUserId, uploaderRole are required" },
        { status: 400 },
      );
    }
    if (!["start", "end"].includes(photoType)) {
      return NextResponse.json(
        { error: "photoType must be 'start' or 'end'" },
        { status: 400 },
      );
    }
    if (!["renter", "operator", "admin", "owner"].includes(uploaderRole)) {
      return NextResponse.json(
        { error: "uploaderRole must be renter|operator|admin|owner" },
        { status: 400 },
      );
    }

    // Read file into Buffer for the server action
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadRentalPhoto({
      rentalId,
      photoType,
      file: buffer,
      mimeType: file.type || "image/jpeg",
      uploaderUserId,
      uploaderRole,
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
