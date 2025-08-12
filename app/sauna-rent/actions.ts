"use server";

import { createBooking } from "@/app/rentals/actions"; // existing server action
import { supabaseAdmin } from "@/hooks/supabase";
import type { BookingInput, BookingResult } from "./types"; // adjust to your types file if present

// Client -> server payload shape
type SaunaPayload = {
  saunaVehicleId: string; // e.g. 'sauna-001'
  startIso: string;
  endIso: string;
  price: number;
  extras?: string[];
  starsUsed?: number;
  userId?: string; // optional — pass dbUser.user_id from client if present
  notes?: string;
};

export async function createSaunaBooking(payload: SaunaPayload) {
  // use the same owner fallback logic (server env)
  const ownerId = process.env.SAUNA_ADMIN_CHAT_ID || process.env.ADMIN_CHAT_ID || "413553377";
  const vehicleId = payload.saunaVehicleId || "sauna-001";
  try {
    // Call your existing createBooking function (signature: createBooking(userId, vehicleId, startDate, endDate, totalPrice))
    if (!payload.userId) {
      // You can allow anonymous but best to require userId; adjust as needed.
      throw new Error("User ID required for booking.");
    }

    const startDate = new Date(payload.startIso);
    const endDate = new Date(payload.endIso);

    const res = await createBooking(payload.userId, vehicleId, startDate, endDate, payload.price);
    if (!res || !res.success) {
      return res;
    }

    // Expect res.data.rental_id from createBooking
    const rentalId = res?.data?.rental_id;
    if (!rentalId) {
      return { success: false, error: "No rental_id returned from createBooking." };
    }

    // --- Update rentals.metadata to include sauna-specific info ---
    // Get current metadata
    const { data: existingRental, error: rFetchErr } = await supabaseAdmin
      .from("rentals")
      .select("metadata")
      .eq("rental_id", rentalId)
      .single();

    let existingMetadata = (existingRental?.metadata as Record<string, any>) || {};
    const newMetadata = {
      ...existingMetadata,
      type: "sauna",
      sauna_id: vehicleId,
      extras: payload.extras || [],
      stars_used: payload.starsUsed || 0,
      notes: payload.notes || null
    };

    const { error: rUpdateErr } = await supabaseAdmin
      .from("rentals")
      .update({ metadata: newMetadata, updated_at: new Date().toISOString() })
      .eq("rental_id", rentalId);

    if (rUpdateErr) {
      console.warn("[createSaunaBooking] Failed to update rental metadata:", rUpdateErr);
      // don't fail the whole flow — booking exists already
    }

    // --- Also patch invoice metadata if invoice was created with naming scheme used in createBooking ---
    const invoiceId = `rental_interest_${rentalId}`;
    try {
      const { data: invRow, error: invFetchErr } = await supabaseAdmin
        .from("invoices")
        .select("metadata")
        .eq("id", invoiceId)
        .single();

      const existingInvMeta = (invRow?.metadata as Record<string, any>) || {};
      const newInvMeta = { ...existingInvMeta, type: "sauna", sauna_id: vehicleId };

      if (invFetchErr) {
        // invoice row might not exist — that's fine
      } else {
        const { error: invUpdateErr } = await supabaseAdmin
          .from("invoices")
          .update({ metadata: newInvMeta, updated_at: new Date().toISOString() })
          .eq("id", invoiceId);

        if (invUpdateErr) {
          console.warn("[createSaunaBooking] Failed to update invoice metadata:", invUpdateErr);
        }
      }
    } catch (e) {
      console.warn("[createSaunaBooking] invoice patch error:", e);
    }

    // Optionally notify sauna owner via Telegram using existing sendComplexMessage function
    // (If you have a server helper for that, call it here. I skip it to avoid coupling.)

    return res;
  } catch (e: any) {
    console.error("[createSaunaBooking] Fatal:", e);
    return { success: false, error: e?.message || "Failed to create sauna booking" };
  }
}