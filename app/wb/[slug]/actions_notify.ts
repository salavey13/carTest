// /app/wb/[slug]/actions_notify.ts
"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { sendComplexMessage, KeyboardButton } from "@/app/webhook-handlers/actions/sendComplexMessage";

/**
 * actions_notify.ts
 * small helpers to notify crew owner or admin via Telegram sendComplexMessage
 */

// Cached resolver: Per-request cache to avoid multi-call dups
const crewCache = new Map<string, any>();
async function resolveCrewBySlug(slug: string) {
  if (crewCache.has(slug)) {
    console.log(`[resolveCrewBySlug] Cache hit for ${slug}`);
    return crewCache.get(slug);
  }
  const { data, error } = await supabaseAdmin
    .from("crews")
    .select("id, name, slug, owner_id")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Экипаж '${slug}' не найден`);
  crewCache.set(slug, data);
  return data as any;
}

/**
 * Notify crew owner (uses crew.owner_id as chat id)
 * Enriched: Supports reply buttons (text-based), imageQuery, attachment; auto-escalates errors
 */
export async function notifyCrewOwner(
  slug: string,
  message: string,
  userId?: string,
  options: {
    buttons?: KeyboardButton[][]; // Reply kb texts (e.g., [{text: 'Ack'}])
    imageQuery?: string;
    attachment?: { type: 'document'; content: string; filename: string };
    keyboardType?: 'reply'; // Fixed to reply (no callbacks)
    parseMode?: 'MarkdownV2' | 'HTML' | 'Markdown';
    onFailEscalate?: boolean; // Notify admin on fail
  } = {}
) {
  try {
    const crew = await resolveCrewBySlug(slug);
    const ownerChatId = crew.owner_id;
    if (!ownerChatId) throw new Error("Владелец экипажа не указан");
    const fullMessage = `*Экипаж ${crew.name} (${slug}):*\n${message}\n*От:* ${userId || "система"}`; // Bold via Markdown
    const res = await sendComplexMessage(ownerChatId, fullMessage, options.buttons || [], {
      ...options,
      keyboardType: 'reply', // Enforce reply
      parseMode: options.parseMode || 'Markdown',
    });
    if (!res.success) throw new Error(res.error || "Не удалось отправить уведомление владельцу");

    // Notify car monitors for car-related messages
    if (message.includes("Запрос машины")) {
      await notifyCarMonitors(slug, message, options);
    }
    return { success: true };
  } catch (e: any) {
    console.error("[wb/actions_notify] notifyCrewOwner error", e);
    // Escalate to admin if opted
    if (options.onFailEscalate) {
      try {
        await notifyAdmin(`🚨 Уведомление владельцу ${slug} провалилось: ${e.message}`);
      } catch (escalateErr) {
        console.error("[notifyCrewOwner] Escalation failed:", escalateErr);
      }
    }
    return { success: false, error: e?.message || "Ошибка отправки уведомления" };
  }
}

/**
 * Notify car monitors (users with role 'car_monitor' in crew_members)
 * Enriched: Parallel with options passthrough; enriched msg
 */
async function notifyCarMonitors(
  slug: string,
  message: string,
  options: any = {}
) {
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
    const enrichedMsg = `*🚗 ${crew.name} (${slug}):*\n${message}`; // Car emoji + bold
    const promises = members.map((member: any) =>
      sendComplexMessage(member.user_id, enrichedMsg, options.buttons || [], {
        ...options,
        keyboardType: 'reply', // Enforce reply
        parseMode: options.parseMode || 'Markdown',
      })
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
 * Enriched: Supports options; auto-retry once on fail
 */
export async function notifyAdmin(
  message: string,
  options: {
    buttons?: KeyboardButton[][]; // Reply kb
    imageQuery?: string;
    attachment?: { type: 'document'; content: string; filename: string };
    parseMode?: 'MarkdownV2' | 'HTML' | 'Markdown';
    retry?: boolean;
  } = {}
) {
  try {
    const adminChat = process.env.ADMIN_CHAT_ID;
    if (!adminChat) throw new Error("ADMIN_CHAT_ID не настроен");
    const enrichedMsg = `*🚨 АДМИН АЛЕРТ:*\n${message}`; // Bold + emoji
    let res = await sendComplexMessage(adminChat, enrichedMsg, options.buttons || [], {
      ...options,
      keyboardType: 'reply', // Enforce reply
      parseMode: options.parseMode || 'Markdown',
    });
    // Auto-retry once on soft fail
    if (!res.success && options.retry !== false) {
      console.warn("[notifyAdmin] Retrying once...");
      res = await sendComplexMessage(adminChat, enrichedMsg, options.buttons || [], {
        ...options,
        keyboardType: 'reply',
        parseMode: options.parseMode || 'Markdown',
      });
    }
    if (!res.success) throw new Error(res.error || "Не удалось отправить уведомление админу");
    return { success: true };
  } catch (e: any) {
    console.error("[wb/actions_notify] notifyAdmin error", e);
    return { success: false, error: e?.message || "Ошибка отправки уведомления" };
  }
}