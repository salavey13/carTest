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

async function verifyRecaptcha(token: string) {
  // Placeholder: Implement verification if needed
  return true;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = (body.name || "").trim();
    const phoneRaw = (body.phone || "").trim();
    const email = (body.email || "").trim();
    const message = (body.message || "").trim();

    if (!name) return NextResponse.json({ success: false, error: "Имя обязательно" }, { status: 400 });

    // Нормализуем телефон: удаляем все не-цифры, затем валидируем длину
    const phoneDigits = phoneRaw.replace(/\D/g, "");
    if (!phoneDigits && !email) return NextResponse.json({ success: false, error: "Укажите телефон или email" }, { status: 400 });
    if (phoneDigits && !/^\d{10,15}$/.test(phoneDigits)) return NextResponse.json({ success: false, error: "Неверный формат телефона" }, { status: 400 });

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ success: false, error: "Неверный формат email" }, { status: 400 });
    if (message.length < 10) return NextResponse.json({ success: false, error: "Сообщение слишком короткое" }, { status: 400 });

    if (body.recaptchaToken) {
      const valid = await verifyRecaptcha(body.recaptchaToken);
      if (!valid) return NextResponse.json({ success: false, error: "reCAPTCHA failed" }, { status: 400 });
    }

    const chatId = process.env.TELEGRAM_MANAGER_CHAT_ID || process.env.CONTACT_RECEIVER_CHAT_ID || process.env.ADMIN_CHAT_ID;
    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || process.env.ADMIN_URL || null;

    // Prepare insert payload
    let leadId: string | null = null;
    let leadSaved = false;
    if (supabaseAdmin) {
      try {
        // generate id properly
        const id = (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function")
          ? (crypto as any).randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const insertPayload: any = {
          id,
          name: name || null,
          phone: phoneDigits ? `+${phoneDigits}` : null,
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

        if (leadError) throw leadError;
        leadId = leadData.id;
        leadSaved = true;
        logger.info(`/api/send-contact: lead saved (id: ${leadId})`);
      } catch (err) {
        logger.error("/api/send-contact: Supabase insert failed", err);
      }
    } else {
      logger.warn("/api/send-contact: supabaseAdmin not available — skipping DB save");
    }

    const html = buildHtmlMessage({ ...body, phone: phoneDigits ? `+${phoneDigits}` : phoneRaw, ts: body.ts || new Date().toISOString() });

    // Buttons
    const buttons: any[] = [];
    const row: any[] = [];
    if (adminUrl && leadId) row.push({ text: "Открыть в админке", url: `${adminUrl.replace(/\/$/, "")}/?leadId=${leadId}` });
    if (phoneDigits) row.push({ text: "Позвонить", url: `tel:+${phoneDigits}` });
    if (email) row.push({ text: "Написать на почту", url: `mailto:${email}` });
    if (row.length) buttons.push(row);

    const sendResult = await sendComplexMessage(String(chatId || ""), html, buttons, {
      imageQuery: body.imageQuery || "industrial pipes installation",
      parseMode: "HTML",
    });

    if (!sendResult.success) {
      logger.error("/api/send-contact: Telegram send failed", sendResult.error);
      if (leadSaved) {
        try {
          await supabaseAdmin?.from("leads_optima").update({ notified: false, updated_at: new Date().toISOString() }).eq("id", leadId);
        } catch (e) {
          logger.error("/api/send-contact: failed updating lead notified flag", e);
        }
        return NextResponse.json({ success: true, info: "Lead saved but notification failed", leadId, error: sendResult.error }, { status: 202 });
      }
      return NextResponse.json({ success: false, error: "Telegram send failed" }, { status: 500 });
    }

    if (leadSaved) {
      try {
        await supabaseAdmin?.from("leads_optima").update({ notified: true, updated_at: new Date().toISOString() }).eq("id", leadId);
      } catch (e) {
        logger.error("/api/send-contact: failed updating lead notified=true", e);
      }
    }

    return NextResponse.json({ success: true, leadId });
  } catch (error: any) {
    logger.error("/api/send-contact: Error", error);
    return NextResponse.json({ success: false, error: error.message || "Internal error" }, { status: 500 });
  }
}