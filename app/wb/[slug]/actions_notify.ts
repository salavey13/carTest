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
  if (!data) throw new Error(`Экипаж '${slug}' не найден`);
  return data as any;
}

/**
 * Notify crew owner (uses crew.owner_id as chat id)
 */
export async function notifyCrewOwner(slug: string, message: string, userId?: string) {
  try {
    const crew = await resolveCrewBySlug(slug);
    const ownerChatId = crew.owner_id;
    if (!ownerChatId) throw new Error("Владелец экипажа не указан");
    const fullMessage = `Экипаж ${crew.name} (${slug}): ${message}\nОт: ${userId || "система"}`;
    const res = await sendComplexMessage(ownerChatId, fullMessage);
    if (!res.success) throw new Error(res.error || "Не удалось отправить уведомление владельцу");
    // Notify car monitors for car-related messages
    if (message.includes("Запрос машины")) {
      await notifyCarMonitors(slug, message);
    }
    return { success: true };
  } catch (e: any) {
    console.error("[wb/actions_notify] notifyCrewOwner error", e);
    return { success: false, error: e?.message || "Ошибка отправки уведомления" };
  }
}

/**
 * Notify car monitors (users with role 'car_monitor' in crew_members)
 */
async function notifyCarMonitors(slug: string, message: string) {
  try {
    const crew = await resolveCrewBySlug(slug);
    const { data: members, error } = await supabaseAdmin
      .from("crew_members")
      .select("user_id")
      .eq("crew_id", crew.id)
      .eq("role", "car_monitor")
      .eq("membership_status", "active");
    if (error) throw error;
    if (!members || members.length === 0) return { success: true }; // No car monitors
    const promises = members.map((member: any) =>
      sendComplexMessage(member.user_id, `Экипаж ${crew.name} (${slug}): ${message}`)
    );
    const results = await Promise.all(promises);
    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) throw new Error(`Не удалось уведомить ${failed.length} наблюдателей машин`);
    return { success: true };
  } catch (e: any) {
    console.error("[wb/actions_notify] notifyCarMonitors error", e);
    return { success: false, error: e?.message || "Ошибка уведомления наблюдателей машин" };
  }
}

/**
 * Notify global admin (ADMIN_CHAT_ID) — used for operational alerts
 */
export async function notifyAdmin(message: string) {
  try {
    const adminChat = process.env.ADMIN_CHAT_ID;
    if (!adminChat) throw new Error("ADMIN_CHAT_ID не настроен");
    const res = await sendComplexMessage(adminChat, message);
    if (!res.success) throw new Error(res.error || "Не удалось отправить уведомление админу");
    return { success: true };
  } catch (e: any) {
    console.error("[wb/actions_notify] notifyAdmin error", e);
    return { success: false, error: e?.message || "Ошибка отправки уведомления" };
  }
}