"use server";

import { supabaseAdmin } from "@/hooks/supabase";
// If you have local types, uncomment/adjust this import:
// import type { BookingInput, BookingResult } from "./types";

// Import your existing createBooking flow — this file expects the createBooking
// function to be available from app/rentals/actions and to accept positional args:
// createBooking(userId, vehicleId, startDate, endDate, price)
import { createBooking } from "@/app/rentals/actions";

type SaunaPayload = {
  saunaVehicleId: string; // e.g. 'sauna-001'
  startIso: string;
  endIso: string;
  price: number;
  extras?: string[];
  starsUsed?: number;
  userId?: string; // optional — but we require it here by default
  notes?: string;
};

export async function createSaunaBooking(payload: SaunaPayload) {
  const ownerId = process.env.SAUNA_ADMIN_CHAT_ID || process.env.ADMIN_CHAT_ID || "413553377";
  const vehicleId = payload.saunaVehicleId || "sauna-001";

  try {
    if (!payload.userId) {
      // If you want to allow anonymous bookings, remove this check and adapt createBooking call
      throw new Error("User ID required for booking.");
    }

    const startDate = new Date(payload.startIso);
    const endDate = new Date(payload.endIso);

    // === CALL YOUR EXISTING createBooking FLOW ===
    // This is the positional style you used in your example:
    const res = await createBooking(payload.userId, vehicleId, startDate, endDate, payload.price);

    // If your createBooking expects a BookingInput object instead, replace above with:
    // const res = await createBooking({ user_id: payload.userId, vehicle_id: vehicleId, start_iso: payload.startIso, end_iso: payload.endIso, price: payload.price, metadata: {...} })

    if (!res || !res.success) {
      return res;
    }

    // Expect res.data.rental_id from createBooking
    const rentalId = res?.data?.rental_id;
    if (!rentalId) {
      return { success: false, error: "No rental_id returned from createBooking." };
    }

    // --- Update rentals.metadata to include sauna-specific info ---
    try {
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
        notes: payload.notes || null,
      };

      const { error: rUpdateErr } = await supabaseAdmin
        .from("rentals")
        .update({ metadata: newMetadata, updated_at: new Date().toISOString() })
        .eq("rental_id", rentalId);

      if (rUpdateErr) {
        console.warn("[createSaunaBooking] Failed to update rental metadata:", rUpdateErr);
        // don't fail the whole flow — booking exists already
      }
    } catch (e) {
      console.warn("[createSaunaBooking] rental metadata patch error:", e);
    }

    // --- Also patch invoice metadata if invoice was created with naming scheme used in createBooking ---
    try {
      const invoiceId = `rental_interest_${rentalId}`; // adapt if your invoice naming differs
      const { data: invRow, error: invFetchErr } = await supabaseAdmin
        .from("invoices")
        .select("metadata")
        .eq("id", invoiceId)
        .single();

      if (!invFetchErr && invRow) {
        const existingInvMeta = (invRow?.metadata as Record<string, any>) || {};
        const newInvMeta = { ...existingInvMeta, type: "sauna", sauna_id: vehicleId };

        const { error: invUpdateErr } = await supabaseAdmin
          .from("invoices")
          .update({ metadata: newInvMeta, updated_at: new Date().toISOString() })
          .eq("id", invoiceId);

        if (invUpdateErr) {
          console.warn("[createSaunaBooking] Failed to update invoice metadata:", invUpdateErr);
        }
      }
      // If invoice not present — fine, not fatal
    } catch (e) {
      console.warn("[createSaunaBooking] invoice patch error:", e);
    }

    // Optionally notify sauna owner via a Telegram helper function (if available)
    // e.g. await notifyOwnerSaunaBooking(ownerId, rentalId, payload);

    return res;
  } catch (e: any) {
    console.error("[createSaunaBooking] Fatal:", e);
    return { success: false, error: e?.message || "Failed to create sauna booking" };
  }
}