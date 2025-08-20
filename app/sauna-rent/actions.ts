// /app/sauna-rent/actions.ts (renamed to massage for pivot)
"use server";

import { createBooking } from "@/app/rentals/actions";
import { supabaseAdmin } from "@/hooks/supabase";

type MassagePayload = {
  masterId: string;
  startIso: string;
  endIso: string;
  price: number;
  extras?: string[];
  starsUsed?: number;
  userId?: string;
  notes?: string | null;
  type: string;
};

export async function createMassageBooking(payload: MassagePayload) {
  const ownerId = process.env.ADMIN_CHAT_ID || "413553377";
  const vehicleId = payload.masterId; // Use master as 'vehicle'

  try {
    if (!payload.userId) throw new Error("User ID required.");

    const startDate = new Date(payload.startIso);
    const endDate = new Date(payload.endIso);

    const res = await createBooking(payload.userId, vehicleId, startDate, endDate, payload.price);
    if (!res || !res.success) return res;

    const rentalId = res?.data?.rental_id;

    // Update metadata for massage
    const { data: existingRental } = await supabaseAdmin
      .from("rentals")
      .select("metadata")
      .eq("rental_id", rentalId)
      .single();

    const newMetadata = {
      ...existingRental?.metadata || {},
      type: "massage",
      massage_type: payload.type,
      master_id: payload.masterId,
      extras: payload.extras || [],
      stars_used: payload.starsUsed || 0,
      notes: payload.notes || null,
    };

    await supabaseAdmin
      .from("rentals")
      .update({ metadata: newMetadata, updated_at: new Date().toISOString() })
      .eq("rental_id", rentalId);

    return res;
  } catch (e: any) {
    return { success: false, error: e?.message || "Failed to create massage booking" };
  }
}