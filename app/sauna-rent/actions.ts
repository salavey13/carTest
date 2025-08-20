// /app/sauna-rent/actions.ts
"use server";

import { createBooking } from "@/app/rentals/actions"; // existing server action in your repo
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";

type SaunaPayload = {
  saunaVehicleId: string; // 'sauna-001'
  startIso: string;
  endIso: string;
  price: number;
  extras?: string[];
  starsUsed?: number;
  userId?: string;
  notes?: string | null;
  massageType?: string;
  masterId?: string;
};

export async function createSaunaBooking(payload: SaunaPayload) {
  const ownerId = process.env.SAUNA_ADMIN_CHAT_ID || process.env.ADMIN_CHAT_ID || "413553377";
  const vehicleId = payload.saunaVehicleId || "sauna-001";

  try {
    if (!payload.userId) {
      throw new Error("User ID required for sauna booking.");
    }

    const startDate = new Date(payload.startIso);
    const endDate = new Date(payload.endIso);

    // Check availability for sauna and master
    const { data: overlappingSauna, error: saunaError } = await supabaseAdmin
      .from("rentals")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .or(`start_at.lt.${payload.endIso},end_at.gt.${payload.startIso}`);

    if (saunaError || overlappingSauna.length > 0) {
      return { success: false, error: "Sauna slot overlapping or error checking." };
    }

    if (payload.masterId) {
      const { data: overlappingMaster, error: masterError } = await supabaseAdmin
        .from("rentals")
        .select("*")
        .eq("metadata.master_id", payload.masterId)
        .or(`start_at.lt.${payload.endIso},end_at.gt.${payload.startIso}`);

      if (masterError || overlappingMaster.length > 0) {
        return { success: false, error: "Massagist unavailable in selected slot." };
      }
    }

    // Call shared booking flow
    const res = await createBooking(payload.userId, vehicleId, startDate, endDate, payload.price);
    if (!res || !res.success) {
      return res;
    }

    const rentalId = res?.data?.rental_id;
    if (!rentalId) {
      return { success: false, error: "No rental_id returned from createBooking." };
    }

    // Update rentals.metadata
    const { data: existingRental } = await supabaseAdmin
      .from("rentals")
      .select("metadata")
      .eq("rental_id", rentalId)
      .single();

    const existingMetadata = (existingRental?.metadata as Record<string, any>) || {};
    const newMetadata = {
      ...existingMetadata,
      type: "sauna",
      sauna_id: vehicleId,
      extras: payload.extras || [],
      stars_used: payload.starsUsed || 0,
      notes: payload.notes || null,
      massage_type: payload.massageType || null,
      master_id: payload.masterId || null,
    };

    const { error: rUpdateErr } = await supabaseAdmin
      .from("rentals")
      .update({ metadata: newMetadata, updated_at: new Date().toISOString() })
      .eq("rental_id", rentalId);

    if (rUpdateErr) console.warn("[createSaunaBooking] rental metadata update error:", rUpdateErr);

    // Notifications
    // User confirmation
    await sendComplexMessage(payload.userId, `Your Forest SPA booking is created! Date: ${payload.date}, Time: ${formatHour(payload.startHour)} for ${payload.durationHours} hours. Total: ${payload.price} ₽. Massage: ${payload.massageType || 'None'}. Master: ${payload.masterId || 'None'}.`, [], { parseMode: 'MarkdownV2' });

    // Admin alert
    await sendComplexMessage(ownerId, `New booking: User ${payload.userId}, Rental ${rentalId}. Approve?`, [[{ text: "Approve", callback_data: `approve_${rentalId}` }, { text: "Decline", callback_data: `decline_${rentalId}` }]], { keyboardType: 'inline' });

    // Massagist assignment if applicable
    if (payload.masterId) {
      const masterChatId = "MASTER_CHAT_ID"; // Assume stored in DB or env
      await sendComplexMessage(masterChatId, `New assignment for rental ${rentalId}. Accept?`, [[{ text: "Accept", callback_data: `accept_${rentalId}` }, { text: "Decline", callback_data: `decline_master_${rentalId}` }]], { keyboardType: 'inline' });
    }

    return res;
  } catch (e: any) {
    console.error("[createSaunaBooking] Fatal:", e);
    return { success: false, error: e?.message || "Failed to create sauna booking" };
  }
}