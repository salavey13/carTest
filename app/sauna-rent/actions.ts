"use server";

import { createBooking } from "@/app/rentals/actions"; // existing server action in your repo
import { supabaseAdmin } from "@/hooks/supabase";

type SaunaPayload = {
  saunaVehicleId: string; // 'sauna-001'
  startIso: string;
  endIso: string;
  price: number;
  extras?: string[];
  starsUsed?: number;
  userId?: string;
  notes?: string | null;
};

export async function createSaunaBooking(payload: SaunaPayload) {
  const ownerId = process.env.SAUNA_ADMIN_CHAT_ID || process.env.ADMIN_CHAT_ID || "413553377";
  const vehicleId = payload.saunaVehicleId || "sauna-001";

  try {
    if (!payload.userId) {
      // You may want to allow anonymous bookings, but currently require userId
      throw new Error("User ID required for sauna booking.");
    }

    const startDate = new Date(payload.startIso);
    const endDate = new Date(payload.endIso);

    // Call shared booking flow — adjust signature call if necessary for your codebase
    const res = await createBooking(payload.userId, vehicleId, startDate, endDate, payload.price);
    if (!res || !res.success) {
      return res;
    }

    const rentalId = res?.data?.rental_id;
    if (!rentalId) {
      return { success: false, error: "No rental_id returned from createBooking." };
    }

    // Update rentals.metadata to include sauna info
    try {
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
      };

      const { error: rUpdateErr } = await supabaseAdmin
        .from("rentals")
        .update({ metadata: newMetadata, updated_at: new Date().toISOString() })
        .eq("rental_id", rentalId);

      if (rUpdateErr) console.warn("[createSaunaBooking] rental metadata update error:", rUpdateErr);
    } catch (err) {
      console.warn("[createSaunaBooking] rental metadata patch error:", err);
    }

    // Try to patch invoice metadata if exists (non-fatal)
    try {
      const invoiceId = `rental_interest_${rentalId}`;
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

        if (invUpdateErr) console.warn("[createSaunaBooking] invoice update error:", invUpdateErr);
      }
    } catch (err) {
      console.warn("[createSaunaBooking] invoice patch error:", err);
    }

    // Optionally: send Telegram notification to ownerId (left to your existing infra)

    return res;
  } catch (e: any) {
    console.error("[createSaunaBooking] Fatal:", e);
    return { success: false, error: e?.message || "Failed to create sauna booking" };
  }
}