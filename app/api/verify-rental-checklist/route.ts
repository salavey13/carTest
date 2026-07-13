/**
 * Rental Checklist Verification Endpoint
 * 
 * Обновляет статус верификации документов в rental checklist.
 * Когда оператор подтверждает что документы верифицированы, удаляет photo paths из rentals.
 * 
 * Flow:
 * 1. Оператор в LEADS page сравнивает фото с OCR данными
 * 2. Оператор нажимает "Верифицировать паспорт" / "Верифицировать права"
 * 3. Этот endpoint обновляет metadata.checklist и удаляет photo path
 * 4. Фото уже удалены из docpix bucket (в /api/docphotoocr), остается только убрать reference
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

interface VerifyChecklistRequest {
  rentalId: string;
  updates: {
    passport_verified?: boolean;
    license_verified?: boolean;
    equipment_handover?: {
      keys?: boolean;
      helmet?: boolean;
      gloves?: boolean;
      other?: string[];
    };
    odometer_before?: number;
    odometer_after?: number;
    dates_confirmed?: boolean;
    payment_verified?: boolean;
  };
}

interface VerifyChecklistResponse {
  success: boolean;
  checklist?: Record<string, any>;
  allCompleted?: boolean;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<VerifyChecklistResponse>> {
  try {
    const body = (await request.json()) as VerifyChecklistRequest;
    const { rentalId, updates } = body;

    if (!rentalId || !updates) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: rentalId, updates" },
        { status: 400 }
      );
    }

    // 1. Fetch current rental
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from("rentals")
      .select("metadata, passport_photo_path, license_photo_path")
      .eq("rental_id", rentalId)
      .single();

    if (rentalError || !rental) {
      return NextResponse.json(
        { success: false, error: "Rental not found" },
        { status: 404 }
      );
    }

    // 2. Merge checklist updates
    const metadata = (rental.metadata || {}) as Record<string, any>;
    const checklist = metadata.checklist || {};
    const updatedChecklist = { ...checklist, ...updates };

    // 3. Check if all required items completed
    const requiredItems = [
      "passport_verified",
      "license_verified",
      "equipment_handover",
      "odometer_before",
      "dates_confirmed",
      "payment_verified",
    ];

    const allCompleted = requiredItems.every((item) => {
      if (item === "equipment_handover") {
        return updatedChecklist.equipment_handover?.keys && updatedChecklist.equipment_handover?.helmet;
      }
      return !!updatedChecklist[item];
    });

    // 4. Prepare update payload
    const updatePayload: Record<string, any> = {
      metadata: {
        ...metadata,
        checklist: updatedChecklist,
      },
    };

    // 5. Cleanup: remove photo paths after verification
    if (updates.passport_verified && rental.passport_photo_path) {
      updatePayload.passport_photo_path = null;
    }

    if (updates.license_verified && rental.license_photo_path) {
      updatePayload.license_photo_path = null;
    }

    // 6. Update rental
    const { error: updateError } = await supabaseAdmin
      .from("rentals")
      .update(updatePayload)
      .eq("rental_id", rentalId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: `Update failed: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      checklist: updatedChecklist,
      allCompleted,
    });
  } catch (error) {
    console.error("[verify-rental-checklist] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
