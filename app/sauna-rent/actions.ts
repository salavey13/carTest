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

// Helper function, as it's not available on the server side otherwise
function formatHour(h: number) {
  const s = (h % 24).toString().padStart(2, "0");
  return `${s}:00`;
}

export async function getMassageMasters() {
  try {
    const { data, error } = await supabaseAdmin
      .from('cars')
      .select('*')
      .eq('type', 'massage_master');

    if (error) {
      throw new Error(error.message);
    }

    const masters = data?.map(d => ({
      id: d.id,
      name: d.make,
      specialty: d.model,
      bio: d.description,
      imageUrl: d.image_url,
      rating: d.daily_price || 5
    })) || [];
    
    return { success: true, data: masters };

  } catch (e: any) {
    console.error("[getMassageMasters] Fatal:", e);
    return { success: false, error: e?.message || "Failed to fetch masters" };
  }
}

export async function createSaunaBooking(payload: SaunaPayload) {
  const ownerId = process.env.SAUNA_ADMIN_CHAT_ID || process.env.ADMIN_CHAT_ID || "413553377";
  const vehicleId = payload.saunaVehicleId || "sauna-001";

  try {
    if (!payload.userId) {
      throw new Error("User ID required for sauna booking.");
    }

    const startDate = new Date(payload.startIso);
    const endDate = new Date(payload.endIso);
    const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

    // Check availability for sauna and master
    const { data: overlappingSauna, error: saunaError } = await supabaseAdmin
      .from("rentals")
      .select("rental_id")
      .eq("vehicle_id", vehicleId)
      .filter("start_at", "lt", payload.endIso)
      .filter("end_at", "gt", payload.startIso);

    if (saunaError) throw new Error(`Sauna availability check failed: ${saunaError.message}`);
    if (overlappingSauna && overlappingSauna.length > 0) {
      return { success: false, error: "Sauna slot is already booked in this time." };
    }

    if (payload.masterId) {
      const { data: overlappingMaster, error: masterError } = await supabaseAdmin
        .from("rentals")
        .select("rental_id")
        .eq("metadata->>master_id", payload.masterId)
        .filter("start_at", "lt", payload.endIso)
        .filter("end_at", "gt", payload.startIso);
      
      if (masterError) throw new Error(`Master availability check failed: ${masterError.message}`);
      if (overlappingMaster && overlappingMaster.length > 0) {
        return { success: false, error: "Massagist is unavailable in the selected slot." };
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
    const readableDate = startDate.toLocaleDateString('ru-RU');
    const readableTime = formatHour(startDate.getHours());

    await sendComplexMessage(payload.userId, `Ваша бронь в Forest SPA создана! Дата: ${readableDate}, Время: ${readableTime} на ${durationHours} ч. Итог: ${payload.price} ₽. Массаж: ${payload.massageType || 'Нет'}. Мастер: ${payload.masterId || 'Нет'}.`, [], { parseMode: 'Markdown' });

    // Admin alert
    await sendComplexMessage(ownerId, `Новая бронь: User ${payload.userId}, Rental ${rentalId}. Сумма ${payload.price} ₽. Подтвердить?`, [[{ text: "Подтвердить", callback_data: `approve_${rentalId}` }, { text: "Отклонить", callback_data: `decline_${rentalId}` }]], { keyboardType: 'inline' });

    // Massagist assignment if applicable
    if (payload.masterId) {
      // FIXME: This should be fetched from the master's profile
      const masterChatId = "MASTER_CHAT_ID_PLACEHOLDER"; 
      await sendComplexMessage(masterChatId, `Новая запись на ${readableDate} в ${readableTime}. Rental ID: ${rentalId}. Принять?`, [[{ text: "Принять", callback_data: `accept_master_${rentalId}` }, { text: "Отклонить", callback_data: `decline_master_${rentalId}` }]], { keyboardType: 'inline' });
    }

    return res;
  } catch (e: any) {
    console.error("[createSaunaBooking] Fatal:", e);
    return { success: false, error: e?.message || "Failed to create sauna booking" };
  }
}