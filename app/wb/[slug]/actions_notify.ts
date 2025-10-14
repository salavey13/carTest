"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";

/**
 * actions_notify.ts
 * small helpers to notify crew owner or admin via Telegram sendComplexMessage
 */

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

/**
 * Notify crew owner (uses crew.owner_id as chat id)
 */
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
    console.error("[wb/actions_notify] notifyCrewOwner error", e);
    return { success: false, error: e?.message || "Notification failed" };
  }
}

/**
 * Notify global admin (ADMIN_CHAT_ID) — used for operational alerts
 */
export async function notifyAdmin(message: string) {
  try {
    const adminChat = process.env.ADMIN_CHAT_ID;
    if (!adminChat) throw new Error("ADMIN_CHAT_ID not configured");
    const res = await sendComplexMessage(adminChat, message);
    if (!res.success) throw new Error(res.error || "Failed to notify admin");
    return { success: true };
  } catch (e: any) {
    console.error("[wb/actions_notify] notifyAdmin error", e);
    return { success: false, error: e?.message || "Notification failed" };
  }
}