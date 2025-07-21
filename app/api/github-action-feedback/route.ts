import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";

const GITHUB_ACTION_SECRET = process.env.GITHUB_ACTION_SECRET;
const ADMIN_TELEGRAM_USER_ID = process.env.ADMIN_CHAT_ID;

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("Authorization");

  // 1. Проверяем секретный токен
  if (!GITHUB_ACTION_SECRET || authorization !== `Bearer ${GITHUB_ACTION_SECRET}`) {
    logger.warn("[GitHub Feedback] Unauthorized request received.");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const payload = await request.json();
    const { pr_number, pr_title } = payload;

    if (!pr_number || !pr_title) {
        logger.error("[GitHub Feedback] Invalid payload received.", payload);
        return NextResponse.json({ error: "Invalid payload: pr_number and pr_title are required." }, { status: 400 });
    }
    
    // 2. Отправляем уведомление в Telegram админу (тебе)
    if (ADMIN_TELEGRAM_USER_ID) {
      const message = `✅ *PR слит!*\n\n` +
                      `*#${pr_number}*: \`${pr_title}\`\n\n` +
                      `Ветка удалена. Корабль летит дальше.`;
      
      await sendComplexMessage(ADMIN_TELEGRAM_USER_ID, message);
      logger.info(`[GitHub Feedback] Sent successful merge notification for PR #${pr_number} to admin.`);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    logger.error("[GitHub Feedback] Error processing feedback webhook:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}