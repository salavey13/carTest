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
 * 5. После успешной верификации вызывает activateRentalIfReady (fire-and-forget)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { activateRentalIfReady } from "@/app/franchize/server-actions/rental-activation";
import { completeRentalVerificationTodo } from "@/app/franchize/server-actions/rental-verification-todos";
import { verifyCrewAccess } from "@/app/api/franchize/_auth";

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
  verifiedBy?: string; // operator ID for audit
}

interface VerifyChecklistResponse {
  success: boolean;
  checklist?: Record<string, any>;
  allCompleted?: boolean;
  error?: string;
}

interface VerificationLogEntry {
  type: string;
  timestamp: string;
  verified_by?: string;
  photos_deleted: string[];
}

/**
 * Delete photos from Supabase Storage (fire-and-forget, non-blocking)
 */
async function deletePhotosFromStorage(paths: string[], rentalId: string): Promise<string[]> {
  const deletedPaths: string[] = [];
  
  for (const path of paths) {
    if (!path) continue;
    
    try {
      const { error } = await supabaseAdmin.storage.from("docpix").remove([path]);
      
      if (error) {
        console.warn(`[verify-rental-checklist] Failed to delete ${path} for rental #${rentalId}:`, error.message);
      } else {
        console.log(`[verify-rental-checklist] Deleted ${path} for rental #${rentalId}`);
        deletedPaths.push(path);
      }
    } catch (err) {
      console.warn(`[verify-rental-checklist] Exception deleting ${path} for rental #${rentalId}:`, err);
    }
  }
  
  return deletedPaths;
}

export async function POST(request: NextRequest): Promise<NextResponse<VerifyChecklistResponse>> {
  try {
    // Auth check: only crew members can verify rental checklists
    const auth = await verifyCrewAccess(request);
    if (auth.ok === false) return auth.response;

    const body = (await request.json()) as VerifyChecklistRequest;
    const { rentalId, updates, verifiedBy } = body;

    if (!rentalId || !updates) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: rentalId, updates" },
        { status: 400 }
      );
    }

    // 1. Fetch current rental
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from("rentals")
      .select("metadata, passport_mainpage_photo, passport_registration_photo, drivers_licence_frontal_photo")
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

    // 5. Verification log for audit (152-ФЗ compliance)
    const verificationLog: VerificationLogEntry[] = metadata.verification_log || [];
    const timestamp = new Date().toISOString();

    // 6. Cleanup: delete photos from Storage and remove references after verification
    if (updates.passport_verified) {
      const passportPhotosToDelete: string[] = [];
      
      if (rental.passport_mainpage_photo) {
        passportPhotosToDelete.push(rental.passport_mainpage_photo);
        updatePayload.passport_mainpage_photo = null;
      }
      if (rental.passport_registration_photo) {
        passportPhotosToDelete.push(rental.passport_registration_photo);
        updatePayload.passport_registration_photo = null;
      }

      // Delete from Storage (fire-and-forget, non-blocking)
      if (passportPhotosToDelete.length > 0) {
        const deletedPaths = await deletePhotosFromStorage(passportPhotosToDelete, rentalId);
        
        // Add audit log entry
        verificationLog.push({
          type: "passport_verified",
          timestamp,
          verified_by: verifiedBy,
          photos_deleted: deletedPaths,
        });
      }
    }

    if (updates.license_verified) {
      const licensePhotosToDelete: string[] = [];
      
      if (rental.drivers_licence_frontal_photo) {
        licensePhotosToDelete.push(rental.drivers_licence_frontal_photo);
        updatePayload.drivers_licence_frontal_photo = null;
      }

      // Delete from Storage (fire-and-forget, non-blocking)
      if (licensePhotosToDelete.length > 0) {
        const deletedPaths = await deletePhotosFromStorage(licensePhotosToDelete, rentalId);
        
        // Add audit log entry
        verificationLog.push({
          type: "license_verified",
          timestamp,
          verified_by: verifiedBy,
          photos_deleted: deletedPaths,
        });
      }
    }

    // 7. Update metadata with verification log
    if (verificationLog.length > 0) {
      updatePayload.metadata.verification_log = verificationLog;
    }

    // 8. Update rental
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

    // 7. Auto-complete verification todos based on checklist updates
    // This integrates with the rental verification todos system
    try {
      if (updates.passport_verified) {
        // Passport mainpage and registration are verified together
        await completeRentalVerificationTodo(rentalId, "passport_mainpage");
        await completeRentalVerificationTodo(rentalId, "passport_registration");
        console.log(`[verify-rental-checklist] Auto-completed passport todos for rental ${rentalId}`);
      }

      if (updates.license_verified) {
        await completeRentalVerificationTodo(rentalId, "drivers_license");
        console.log(`[verify-rental-checklist] Auto-completed license todo for rental ${rentalId}`);
      }

      if (updates.odometer_before !== undefined && updates.odometer_before !== null) {
        await completeRentalVerificationTodo(rentalId, "odometer");
        console.log(`[verify-rental-checklist] Auto-completed odometer todo for rental ${rentalId}`);
      }

      if (updates.dates_confirmed) {
        await completeRentalVerificationTodo(rentalId, "dates");
        console.log(`[verify-rental-checklist] Auto-completed dates todo for rental ${rentalId}`);
      }
    } catch (todoErr) {
      // Non-fatal: log but don't fail the verification
      console.error("[verify-rental-checklist] Failed to auto-complete todos:", todoErr);
    }

    // 8. Fire-and-forget: try to activate rental if all verification todos are done
    // This doesn't block the response - activation happens asynchronously
    setImmediate(async () => {
      try {
        const result = await activateRentalIfReady(rentalId);
        if (result.activated) {
          console.log(`[verify-rental-checklist] Rental auto-activated: ${rentalId}`);
        } else if (result.message) {
          console.log(`[verify-rental-checklist] Activation check: ${result.message}`);
        }
      } catch (err) {
        // Fire-and-forget: log error but don't affect the response
        console.error(`[verify-rental-checklist] Activation failed for ${rentalId}:`, err);
      }
    });

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
