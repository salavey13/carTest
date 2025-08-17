import { NextResponse } from "next/server";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";

function escapeHtml(input: string | undefined | null) {
  if (!input) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtmlMessage(payload: any) {
  const name = escapeHtml(payload.name);
  const phone = escapeHtml(payload.phone);
  const email = escapeHtml(payload.email);
  const message = escapeHtml(payload.message);
  const ts = escapeHtml(payload.ts);
  const fromTelegram = payload.fromTelegram
    ? `<i>Отправлено из Telegram WebApp (id: ${escapeHtml(String(payload.telegramUser?.id || "—"))})</i>`
    : "";

  return `
<b>Новая заявка — Optimapipe</b>
${fromTelegram}

<b>Имя:</b> ${name || "—"}
<b>Телефон:</b> ${phone || "—"}
<b>Email:</b> ${email || "—"}
<b>Сообщение:</b>
<pre>${message || "—"}</pre>

<small>Время заявки: ${ts}</small>
`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Basic validation
    const name = (body.name || "").trim();
    const phone = (body.phone || "").trim();
    const email = (body.email || "").trim();
    const message = (body.message || "").trim();

    if (!name) return NextResponse.json({ success: false, error: "Missing name" }, { status: 400 });
    if (!phone && !email) return NextResponse.json({ success: false, error: "Provide phone or email" }, { status: 400 });
    if (message.length < 3) return NextResponse.json({ success: false, error: "Message too short" }, { status: 400 });

    const chatId = process.env.TELEGRAM_MANAGER_CHAT_ID || process.env.CONTACT_RECEIVER_CHAT_ID;
    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || process.env.ADMIN_URL || null;

    // Try to persist lead into Supabase (if configured)
    let leadId: string | null = null;
    let leadSaved = false;
    if (supabaseAdmin) {
      try {
        const id =
          typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function"
            ? (crypto as any).randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const insertPayload = {
          id,
          name: name || null,
          phone: phone || null,
          email: email || null,
          message: message || null,
          source: body.fromTelegram ? "telegram" : "website",
          telegram_user_id: body.telegramUser?.id ? String(body.telegramUser.id) : null,
          metadata: { imageQuery: body.imageQuery || null, utm: body.utm || null },
          status: "new",
          notified: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: leadData, error: leadError } = await supabaseAdmin
          .from("leads_optima")
          .insert(insertPayload)
          .select("*")
          .single();

        if (leadError) {
          logger.error("/api/send-contact: failed to insert lead in Supabase", leadError);
        } else if (leadData) {
          leadId = leadData.id;
          leadSaved = true;
          logger.info(`/api/send-contact: lead saved to Supabase (id: ${leadId})`);
        }
      } catch (err) {
        logger.error("/api/send-contact: unexpected error when saving lead to Supabase", err);
      }
    } else {
      logger.warn("/api/send-contact: supabaseAdmin client not available — skipping DB save.");
    }

    const html = buildHtmlMessage({ ...body, ts: body.ts || new Date().toISOString() });

    // Buttons for manager: open admin / call / reply — include lead link if we have leadId
    const buttons: any[] = [];
    const row: any[] = [];
    if (adminUrl) {
      const urlWithLead = leadId ? `${adminUrl.replace(/\/$/, "")}/?leadId=${encodeURIComponent(leadId)}` : adminUrl;
      row.push({ text: "Открыть в админке", url: urlWithLead });
    }
    if (phone) row.push({ text: "Позвонить", url: `tel:${phone}` });
    if (email) row.push({ text: "Написать на почту", url: `mailto:${email}` });
    if (row.length) buttons.push(row);

    // Send to Telegram (uses your existing sendComplexMessage with Unsplash fallback)
    const sendResult = await sendComplexMessage(String(chatId || ""), html, buttons, {
      imageQuery: body.imageQuery || "industrial pipes installation",
      parseMode: "HTML",
    });

    if (!sendResult.success) {
      logger.error("/api/send-contact: sendComplexMessage failed:", sendResult.error);
      // If lead saved but telegram notify failed, return 202 so UI knows lead exists
      if (leadSaved) {
        // Optionally update lead with last_notify_error / attempts (we can add fields later)
        try {
          await supabaseAdmin?.from("leads_optima").update({ notified: false, updated_at: new Date().toISOString() }).eq("id", leadId);
        } catch (e) {
          logger.error("/api/send-contact: failed to update lead.notify state after telegram error", e);
        }
        return NextResponse.json({ success: true, info: "Lead saved, but failed to notify Telegram", leadId, error: sendResult.error }, { status: 202 });
      }
      return NextResponse.json({ success: false, error: sendResult.error || "Telegram send failed" }, { status: 500 });
    }

    // Mark notified=true if lead saved
    if (leadSaved) {
      try {
        await supabaseAdmin?.from("leads_optima").update({ notified: true, updated_at: new Date().toISOString() }).eq("id", leadId);
      } catch (e) {
        logger.error("/api/send-contact: failed to mark lead as notified", e);
      }
    }

    return NextResponse.json({ success: true, data: sendResult.data, leadId: leadSaved ? leadId : null });
  } catch (error: any) {
    logger.error("/api/send-contact: unexpected error:", error);
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
}