"use server";

import { updateUserMetadata } from "@/hooks/supabase";

export async function updateUserPreferences(userId: string, partialPrefs: Record<string, any>) {
  return await updateUserMetadata(userId, partialPrefs);
}