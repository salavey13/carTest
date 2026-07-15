// /app/api/franchize/callback-lead/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { normalizePhone } from "@/app/franchize/lib/phone-utils";

/**
 * Register a callback lead from the web site.
 *
 * Creates/updates a user in public.users with phone number as user_id.
 * This makes the lead visible in all user queries, the leads page,
 * and linkable when an operator enters the same phone in /doc.
 *
 * Also fires the forward-telegram notification (best-effort).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, bikeId, bikeTitle, name, phone } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { success: false, error: "Name and phone are required" },
        { status: 400 },
      );
    }

    // Normalize phone using centralized helper (handles 8→+7 conversion)
    const normalizedPhone = normalizePhone(phone) || phone.replace(/[^\d+]/g, "");
    // Use phone as user_id (this is the key insight — phone = user_id for leads)
    const userId = normalizedPhone;

    // 1. Upsert user
    const { error: upsertError } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          user_id: userId,
          full_name: name,
          metadata: {
            source: "web_callback",
            phone: normalizedPhone,
            bikeId: bikeId || null,
            bikeTitle: bikeTitle || null,
            slug: slug || null,
            createdAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (upsertError) {
      logger.error("[callback-lead] upsert failed", upsertError);
      // Don't fail the whole request — still try to notify owner
    }

    // 2. Record franchize intent for analytics
    await supabaseAdmin.from("franchize_intents").upsert({
      slug: slug || "vip-bike",
      bike_id: bikeId || null,
      intent_type: "callback_request",
      stage: "lead_captured",
      source_route: "/franchize/web",
      contact_channel: "web_callback",
      urgency_score: 60,
      telegram_user_id: userId,
      metadata: { name, phone: normalizedPhone, bikeTitle },
    }).then(({ error }) => {
      if (error) logger.warn("[callback-lead] intent insert failed", error);
    });

    // 3. Notify owner via forward-telegram (best-effort)
    const message =
      `📞 *Новая заявка на звонок*\n\n` +
      `🏍 ${bikeTitle || "Байк"}\n` +
      `👤 ${name}\n` +
      `📱 ${normalizedPhone}\n` +
      `🌐 Источник: веб-сайт\n` +
      `⏰ ${new Date().toLocaleString("ru-RU")}`;

    try {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/forward-telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: "356282674", // Илья (owner)
          text: message,
          parseMode: "Markdown",
        }),
      });
    } catch {
      // Forward-telegram failure is OK — user is already saved
    }

    return NextResponse.json({ success: true, userId });
  } catch (error) {
    logger.error("[callback-lead] exception", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
