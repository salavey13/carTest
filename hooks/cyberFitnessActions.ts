"use server";

import { fetchUserData, supabaseAdmin, updateUserMetadata } from "@/lib/supabase-server";
import type { Database } from "@/types/database.types";

type UserMetadata = Database["public"]["Tables"]["users"]["Row"]["metadata"];

export async function fetchCyberFitnessUserDataAction(userId: string) {
  if (!userId) return null;
  return fetchUserData(userId);
}

export async function updateCyberFitnessUserMetadataAction(userId: string, metadata: UserMetadata | null) {
  if (!userId) {
    return { success: false, error: "User ID is required." } as const;
  }
  return updateUserMetadata(userId, metadata as Record<string, any> | null);
}

export async function updateUserCyberStatsRpcAction(params: {
  userId: string;
  kvDelta: number;
  featureKey: string | null;
  featureVal: string | number | boolean | null;
}) {
  const { userId, kvDelta, featureKey, featureVal } = params;
  const { data, error } = await supabaseAdmin.rpc("update_user_cyber_stats", {
    p_user_id: userId,
    p_kv_delta: kvDelta,
    p_gv_delta: 0,
    p_new_achievement: null,
    p_feature_key: featureKey,
    p_feature_val: featureVal,
  });

  return { data, error: error?.message ?? null };
}

export async function adjustKiloVibesRpcAction(params: { userId: string; adjustment: number }) {
  const { data, error } = await supabaseAdmin.rpc("adjust_kilovibes", {
    p_user_id: params.userId,
    p_kv_adjustment: params.adjustment,
  });

  return { data, error: error?.message ?? null };
}

