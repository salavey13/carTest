"use server";

import { supabaseAdmin } from "@/lib/supabase-server";

export async function awardWarehouseActionStats(
  userId: string,
  actionType: "onload" | "offload",
  qty: number,
) {
  if (!userId || qty <= 0) {
    return { success: false, error: "Invalid stats payload" };
  }

  const gvEarned = qty * (actionType === "offload" ? 7 : 3);
  const kvEarned = qty * 0.5;

  const { error } = await supabaseAdmin.rpc("update_user_cyber_stats", {
    p_user_id: userId,
    p_gv_delta: gvEarned,
    p_kv_delta: kvEarned,
    p_feature_key: "last_wh_action",
    p_feature_val: { type: actionType, qty, ts: new Date().toISOString() },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
