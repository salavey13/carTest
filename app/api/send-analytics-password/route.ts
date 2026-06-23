/**
 * API endpoint to send analytics password via email
 * POST /api/send-analytics-password
 * Body: { crewId: string, email?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { crewId, email } = body;

    if (!crewId) {
      return NextResponse.json(
        { success: false, error: "crewId is required" },
        { status: 400 }
      );
    }

    // Get crew details
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, slug, name, owner_id")
      .eq("id", crewId)
      .single();

    if (crewError || !crew) {
      return NextResponse.json(
        { success: false, error: "Crew not found" },
        { status: 404 }
      );
    }

    // Get crew email from crew_secrets
    let recipientEmail = email;
    if (!recipientEmail) {
      const { data: crewSecrets } = await supabaseAdmin
        .from("crew_secrets")
        .select("email")
        .eq("crew_id", crewId)
        .maybeSingle();

      if (crewSecrets?.email) {
        recipientEmail = crewSecrets.email;
      }
    }

    // Fallback: try owner's user email
    if (!recipientEmail && crew.owner_id) {
      const { data: owner } = await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("user_id", crew.owner_id)
        .single();

      if (owner?.metadata) {
        const metadata = owner.metadata as Record<string, unknown>;
        recipientEmail = metadata.email as string | undefined;
      }
    }

    if (!recipientEmail) {
      return NextResponse.json(
        { success: false, error: "No email provided and owner has no email on file" },
        { status: 400 }
      );
    }

    // Generate new password using Supabase RPC
    const { data: passwordResult, error: passwordError } = await supabaseAdmin
      .rpc("generate_analytics_password", {
        p_crew_id: crewId,
        p_created_by: crew.owner_id || "system",
        p_slug: crew.slug,
      });

    if (passwordError || !passwordResult || passwordResult.length === 0) {
      console.error("[send-analytics-password] Error generating password:", passwordError);
      return NextResponse.json(
        { success: false, error: "Failed to generate password" },
        { status: 500 }
      );
    }

    const passwordData = passwordResult[0];
    const expiresAt = new Date(passwordData.expires_at);
    const hoursLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)));

    // Get site URL for link
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://your-app.vercel.app";
    const analyticsUrl = `${siteUrl}/franchize/${crew.slug}/rentals-analytics`;

    // Configure SMTP (Yandex first, fallback to Gmail)
    const SMTP_HOST = process.env.SMTP_YANDEX_HOST || process.env.SMTP_GMAIL_HOST || "smtp.yandex.ru";
    const SMTP_PORT = Number(process.env.SMTP_YANDEX_PORT || process.env.SMTP_GMAIL_PORT) || 465;
    const SMTP_USER = process.env.SMTP_YANDEX_USER || process.env.SMTP_GMAIL_USER;
    const SMTP_PASS = process.env.SMTP_YANDEX_PASS || process.env.SMTP_GMAIL_PASS;
    const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
      console.error("[send-analytics-password] SMTP configuration missing");
      return NextResponse.json(
        { success: false, error: "Email service not configured" },
        { status: 500 }
      );
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    // Verify connection
    try {
      await transporter.verify();
    } catch (verifyErr) {
      console.error("[send-analytics-password] SMTP verification failed:", verifyErr);
      return NextResponse.json(
        { success: false, error: "Email authentication failed" },
        { status: 500 }
      );
    }

    // Send email
    const mailOptions = {
      from: `${crew.name} <${EMAIL_FROM}>`,
      to: recipientEmail,
      subject: `Пароль для аналитики — ${crew.name}`,
      text: `Здравствуйте!

Ваш одноразовый пароль для доступа к аналитике аренд:

${passwordData.password}

Ссылка для входа: ${analyticsUrl}

⏰ Пароль действителен ${hoursLeft} час(ов).

Если вы не запрашивали этот пароль, проигнорируйте это письмо.

---
С уважением,
${crew.name}`,
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .password { background: white; border: 2px dashed #667eea; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; border-radius: 8px; margin: 20px 0; }
    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
    .expires { background: #fff3cd; padding: 10px; border-radius: 4px; text-align: center; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Пароль для аналитики</h1>
    </div>
    <div class="content">
      <p>Здравствуйте!</p>
      <p>Ваш одноразовый пароль для доступа к аналитике аренд:</p>

      <div class="password">${passwordData.password}</div>

      <p style="text-align: center;">
        <a href="${analyticsUrl}" class="button">Открыть аналитику</a>
      </p>

      <div class="expires">
        ⏰ Пароль действителен <strong>${hoursLeft} час(ов)</strong>
      </div>

      <p style="margin-top: 20px; font-size: 14px; color: #666;">
        Если вы не запрашивали этот пароль, проигнорируйте это письмо.
      </p>
    </div>
    <div class="footer">
      <p>С уважением,<br>${crew.name}</p>
    </div>
  </div>
</body>
</html>`,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("[send-analytics-password] Email sent:", info.messageId);

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      to: recipientEmail,
      expiresAt: passwordData.expires_at,
      hoursLeft,
    });

  } catch (error) {
    console.error("[send-analytics-password] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to send email" },
      { status: 500 }
    );
  }
}
