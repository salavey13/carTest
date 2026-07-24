"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { z } from "zod";

// ─── Types & Constants ───────────────────────────────────────────────────────
// Types (MessageTemplate, TemplateVariable) and the TEMPLATE_VARIABLES constant
// are imported from ./message-templates-constants to avoid "use server" export
// restrictions (a "use server" file can only export async functions).
import {
  type MessageTemplate,
  type TemplateVariable,
  TEMPLATE_VARIABLES,
} from "./message-templates-constants";

// Re-export TYPES only (types are erased at compile time — no runtime export).
// TEMPLATE_VARIABLES is NOT re-exported because re-exporting a const from a
// "use server" file is also invalid. Callers that need TEMPLATE_VARIABLES
// must import directly from "./message-templates-constants".
export type { MessageTemplate, TemplateVariable };

// ─── Server Actions ─────────────────────────────────────────────────────────────

/**
 * Get all message templates for a crew (includes default templates)
 */
export async function getMessageTemplates(input: {
  slug: string;
  actorUserId: string;
  channel?: "telegram" | "email" | "sms";
}): Promise<{ success: boolean; data?: MessageTemplate[]; error?: string }> {
  try {
    const parsed = z.object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      channel: z.enum(["telegram", "email", "sms"]).optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { slug, actorUserId, channel } = parsed.data;

    // Get crew and verify access
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (crewError || !crew) {
      return { success: false, error: "Экипаж не найден." };
    }

    // Check if user is owner or member
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata, username")
      .eq("user_id", actorUserId)
      .maybeSingle();

    const userMetadata = user?.metadata as Record<string, unknown> | null;
    const userUsername = user?.username as string | null;
    const isAdmin = userMetadata?.role === "admin";
    const isOwner = crew.owner_id === actorUserId;
    const isOrudjov = userUsername?.toLowerCase().includes("orud");

    const { data: crewMember } = await supabaseAdmin
      .from("crew_members")
      .select("user_id")
      .eq("crew_id", crew.id)
      .eq("user_id", actorUserId)
      .maybeSingle();

    const isCrewMember = !!crewMember;

    if (!isOwner && !isAdmin && !isOrudjov && !isCrewMember) {
      return { success: false, error: "Недостаточно прав для просмотра шаблонов." };
    }

    // Get crew templates + default templates
    const { data: templates, error: templatesError } = await supabaseAdmin
      .from("message_templates")
      .select("*")
      .or(`crew_id.eq.${crew.id},crew_id.is.null`)
      .eq("is_active", true)
      .order("crew_id", { ascending: false, nullsFirst: false }); // Crew templates first

    if (templatesError) {
      console.error("[get-message-templates] Error:", templatesError);
      return { success: false, error: templatesError.message };
    }

    // Filter by channel if specified
    let filtered = templates || [];
    if (channel) {
      filtered = filtered.filter(t => t.channel === channel);
    }

    // Deduplicate: if crew has a template for a key, hide the default one
    const seenKeys = new Set<string>();
    const deduplicated: MessageTemplate[] = [];
    for (const template of filtered as MessageTemplate[]) {
      const key = `${template.template_key}:${template.channel}:${template.language}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        deduplicated.push(template);
      }
    }

    return { success: true, data: deduplicated };
  } catch (error) {
    console.error("[get-message-templates] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send a template message to a rental customer via Telegram
 */
export async function sendTemplateMessage(input: {
  slug: string;
  actorUserId: string;
  rentalId: string;
  templateKey: string;
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; data?: { sent: boolean; linked?: boolean }; error?: string }> {
  try {
    const parsed = z.object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      rentalId: z.string().uuid(),
      templateKey: z.string().trim().min(1),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { slug, actorUserId, rentalId, templateKey, isPasswordAuth = false } = parsed.data;

    // Get crew
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id, slug, name, metadata")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (crewError || !crew) {
      return { success: false, error: "Экипаж не найден." };
    }

    // Auth check
    if (!isPasswordAuth) {
      const userMetadata = (await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("user_id", actorUserId)
        .maybeSingle()
      ).data?.metadata as Record<string, unknown> | null;

      const userUsername = (await supabaseAdmin
        .from("users")
        .select("username")
        .eq("user_id", actorUserId)
        .maybeSingle()
      ).data?.username as string | null;

      const isAdmin = userMetadata?.role === "admin";
      const isOwner = crew.owner_id === actorUserId;
      const isOrudjov = userUsername?.toLowerCase().includes("orud");

      const { data: crewMember } = await supabaseAdmin
        .from("crew_members")
        .select("user_id")
        .eq("crew_id", crew.id)
        .eq("user_id", actorUserId)
        .maybeSingle();

      if (!isOwner && !isAdmin && !isOrudjov && !crewMember) {
        return { success: false, error: "Недостаточно прав для отправки." };
      }
    }

    // Get rental details
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from("rentals")
      .select(`
        rental_id,
        agreed_start_date,
        agreed_end_date,
        total_cost,
        vehicle:cars!inner(id, make, model, specs, type, crew_id),
        user:users!rentals_user_id_fkey(user_id, full_name, username, metadata)
      `)
      .eq("rental_id", rentalId)
      .maybeSingle();

    if (rentalError || !rental) {
      return { success: false, error: "Аренда не найдена." };
    }

    // Get document secret to check if user is linked (has scanned QR)
    const privateSchema = () => (supabaseAdmin as any).schema("private");
    const { data: secret } = await privateSchema()
      .from("user_rental_secrets")
      .select("chat_id, renter_phone, qr_claimed_at")
      .eq("source_rental_id", rentalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!secret) {
      return { success: false, error: "Документ не найден." };
    }

    // Check if user is linked (has claimed QR or has chat_id from owner)
    const userChatId = secret.chat_id;
    const isLinked = !!userChatId && !!secret.qr_claimed_at;

    if (!isLinked) {
      return {
        success: true,
        data: { sent: false, linked: false },
      };
    }

    // Get template (crew-specific or default)
    const { data: template, error: templateError } = await supabaseAdmin
      .from("message_templates")
      .select("*")
      .or(`crew_id.eq.${crew.id},crew_id.is.null`)
      .eq("template_key", templateKey)
      .eq("channel", "telegram")
      .eq("is_active", true)
      .order("crew_id", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (templateError || !template) {
      return { success: false, error: "Шаблон не найден." };
    }

    // Prepare variables
    const vehicle = rental.vehicle as any;
    const renter = rental.user as any;
    const crewMetadata = crew.metadata as Record<string, unknown> | null;

    const now = new Date();
    const startDate = new Date(rental.agreed_start_date || now);
    const endDate = new Date(rental.agreed_end_date || now);

    const variables: Record<string, string> = {
      customer_name: renter?.full_name || renter?.username || "Клиент",
      customer_phone: secret.renter_phone || "",
      bike: `${vehicle.make} ${vehicle.model}`.trim(),
      start_date: startDate.toLocaleDateString("ru-RU"),
      start_time: startDate.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      return_date: endDate.toLocaleDateString("ru-RU"),
      return_time: endDate.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      pickup_location: crewMetadata?.location?.address || "Место выдачи",
      return_location: crewMetadata?.location?.address || "Место возврата",
      total_price: String(rental.total_cost || "0"),
      deposit_amount: String(vehicle.specs?.deposit_rub || "0"),
      payment_method: "Карта",
      contact_phone: crewMetadata?.contacts?.phone as string | undefined || "",
    };

    // Render template
    const rendered = template.body.replace(/\{(\w+)\}/g, (_, key) => variables[key] || `{${key}}`);

    // Send via Telegram
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return { success: false, error: "Telegram bot not configured." };
    }

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: userChatId,
        text: rendered,
        parse_mode: "HTML",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[send-template-message] Telegram error:", errorText);
      return { success: false, error: "Failed to send message." };
    }

    console.log("[send-template-message] Sent to:", userChatId, "template:", templateKey);

    return {
      success: true,
      data: { sent: true, linked: true },
    };
  } catch (error) {
    console.error("[send-template-message] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Save or update a custom message template for a crew
 */
export async function upsertMessageTemplate(input: {
  slug: string;
  actorUserId: string;
  template: {
    template_key: string;
    name: string;
    body: string;
    channel: "telegram" | "email" | "sms";
    language?: string;
  };
}): Promise<{ success: boolean; data?: MessageTemplate; error?: string }> {
  try {
    const parsed = z.object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      template: z.object({
        template_key: z.string().trim().min(1),
        name: z.string().trim().min(1),
        body: z.string().trim().min(1),
        channel: z.enum(["telegram", "email", "sms"]),
        language: z.string().default("ru"),
      }),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { slug, actorUserId, template } = parsed.data;

    // Get crew
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (crewError || !crew) {
      return { success: false, error: "Экипаж не найден." };
    }

    // Auth check - only owners can manage templates
    const userMetadata = (await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", actorUserId)
      .maybeSingle()
    ).data?.metadata as Record<string, unknown> | null;

    const isAdmin = userMetadata?.role === "admin";
    const isOwner = crew.owner_id === actorUserId;

    if (!isOwner && !isAdmin) {
      return { success: false, error: "Только владельцы могут управлять шаблонами." };
    }

    // Upsert template
    const { data: upserted, error: upsertError } = await supabaseAdmin
      .from("message_templates")
      .upsert({
        crew_id: crew.id,
        template_key: template.template_key,
        name: template.name,
        body: template.body,
        channel: template.channel,
        language: template.language || "ru",
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "crew_id,template_key,channel,language",
      })
      .select("*")
      .single();

    if (upsertError) {
      console.error("[upsert-template] Error:", upsertError);
      return { success: false, error: upsertError.message };
    }

    return { success: true, data: upserted as MessageTemplate };
  } catch (error) {
    console.error("[upsert-template] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
