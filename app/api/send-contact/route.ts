import { NextResponse } from "next/server";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { logger } from "@/lib/logger";

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
  const fromTelegram = payload.fromTelegram ? `<i>Отправлено из Telegram WebApp (id: ${escapeHtml(String(payload.telegramUser?.id || '—'))})</i>` : "";

  return `
<b>Новая заявка — Optimapipe</b>
${fromTelegram}

<b>Имя:</b> ${name || '—'}
<b>Телефон:</b> ${phone || '—'}
<b>Email:</b> ${email || '—'}
<b>Сообщение:</b>
<pre>${message || '—'}</pre>

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
    if (!chatId) {
      logger.warn("/api/send-contact: TELEGRAM_MANAGER_CHAT_ID not configured — logging the request and returning success for dev.");
      logger.info("Incoming contact payload:", { name, phone, email, message, raw: body });
      return NextResponse.json({ success: true, info: "No chat configured. Logged the request on server." });
    }

    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || process.env.ADMIN_URL || null;

    const html = buildHtmlMessage({ ...body, ts: body.ts || new Date().toISOString() });

    // Buttons for manager: open admin / call / reply
    const buttons: any[] = [];
    const row: any[] = [];
    if (adminUrl) {
      row.push({ text: "Открыть в админке", url: `${adminUrl}` });
    }
    if (phone) row.push({ text: "Позвонить", url: `tel:${phone}` });
    if (email) row.push({ text: "Написать на почту", url: `mailto:${email}` });
    if (row.length) buttons.push(row);

    const sendResult = await sendComplexMessage(String(chatId), html, buttons, {
      imageQuery: body.imageQuery || "industrial pipes installation",
      parseMode: 'HTML',
    });

    if (!sendResult.success) {
      logger.error("/api/send-contact: sendComplexMessage failed:", sendResult.error);
      return NextResponse.json({ success: false, error: sendResult.error || 'Telegram send failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: sendResult.data });
  } catch (error: any) {
    logger.error("/api/send-contact: unexpected error:", error);
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
}