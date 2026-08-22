"use server";

import { supabaseAdmin } from "@/lib/supabase-server";

export async function getUserMetadataAction(userId: string) {
  if (!userId) {
    return { success: false, error: "userId is required", metadata: {} as Record<string, unknown> };
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("metadata")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    return { success: false, error: error.message, metadata: {} as Record<string, unknown> };
  }

  return { success: true, metadata: (data?.metadata as Record<string, unknown>) || {} };
}

export async function mergeUserMetadataAction(userId: string, patch: Record<string, unknown>) {
  if (!userId) {
    return { success: false, error: "userId is required" };
  }

  const { data: existingData, error: fetchError } = await supabaseAdmin
    .from("users")
    .select("metadata")
    .eq("user_id", userId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    return { success: false, error: fetchError.message };
  }

  const currentMetadata = (existingData?.metadata as Record<string, unknown> | null) || {};
  const nextMetadata = { ...currentMetadata, ...patch };

  const { error: upsertError } = await supabaseAdmin
    .from("users")
    .upsert({ user_id: userId, metadata: nextMetadata }, { onConflict: "user_id" });

  if (upsertError) {
    return { success: false, error: upsertError.message };
  }

  return { success: true };
}
