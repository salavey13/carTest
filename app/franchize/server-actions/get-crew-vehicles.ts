// /app/franchize/server-actions/get-crew-vehicles.ts
"use server";

import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Fetch all vehicles belonging to a crew by its slug.
 * Used by the admin page to show the correct fleet per crew.
 */
export async function getCrewVehicles(
  crewSlug: string
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Resolve crew id from slug
    const { data: crew } = await supabase
      .from("crews")
      .select("id")
      .eq("slug", crewSlug)
      .single();

    if (!crew) {
      return { success: false, error: "Экипаж не найден" };
    }

    const { data, error } = await supabase
      .from("cars")
      .select("*")
      .eq("crew_id", crew.id);

    if (error) {
      logger.error("Error fetching crew vehicles:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    logger.error("getCrewVehicles error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Внутренняя ошибка",
    };
  }
}
