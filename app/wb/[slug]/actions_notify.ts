"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";

async function resolveCrewBySlug(slug: string) {
  const { data, error } = await supabaseAdmin
    .from("crews")
    .select("id, name, slug, owner_id")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Crew '${slug}' not found`);
  return data as any;
}

export async function notifyCrewOwner(slug: string, message: string, userId?: string) {
  try {
    const crew = await resolveCrewBySlug(slug);
    const ownerChatId = crew.owner_id;
    if (!ownerChatId) throw new Error("Crew owner chat not configured");

    const fullMessage = `Warehouse update for crew ${crew.name} (${slug})\nFrom: ${userId || "system"}\n\n${message}`;
    const res = await sendComplexMessage(ownerChatId, fullMessage);
    if (!res.success) throw new Error(res.error || "Failed to notify owner");
    return { success: true };
  } catch (e: any) {
    console.error("[wb/actions_notify] error", e);
    return { success: false, error: e?.message || "Notification failed" };
  }
}