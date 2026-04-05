"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

export async function listMapsWithRoutesAction() {
  try {
    const { data, error } = await supabaseAdmin
      .from("maps")
      .select("id,name,is_default,points_of_interest,metadata,created_at")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("[listMapsWithRoutesAction] Error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}
