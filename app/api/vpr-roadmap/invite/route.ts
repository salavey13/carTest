import { NextRequest, NextResponse } from "next/server";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { VPR_TG_DEEPLINK } from "@/lib/vprRoadmap";
import { logger } from "@/lib/logger";

// task213: отправка инвайт-уведомления в Матрицу ВПР через форвардинг-API.
// Юзер (родитель/организатор) получает сообщение у себя в TG и форвардит
// его геймеру. GET/POST с ?chat_id= (по умолчанию ADMIN_CHAT_ID).

const INVITE_TEXT =
  `🎮 *МАТРИЦА 8 КЛАССА — тренировочная программа*\n\n` +
  `Контрольные за полугодие не сдаются зубрёжкой — они дешифруются.\n\n` +
  `Что внутри:\n` +
  `🔓 6 уровней-предметов: Алгебра → Геометрия → Вероятность → Русский → История → Литература\n` +
  `📖 Шпаргалки-загрузки: мини-игры, пошаговые разборы, квизы\n` +
  `⚔️ Тесты-бои: реальные ВПР-варианты с разбором каждого удара\n` +
  `🔓 Замки: следующий предмет открывается только после сдачи предыдущего (≥70%)\n\n` +
  `Протокол прокачки: _Feed → Fight → Fail → Repeat → Upgrade_\n` +
  `Провалился — не страшно: это просто итерация. Второй заход всегда точнее.\n\n` +
  `Прогресс сохраняется, бот присылает уведомления об открытых уровнях 🏆\n\n` +
  `Wake up, восьмиклассник… 💊`;

export async function GET(req: NextRequest) {
  return handleInvite(req);
}

export async function POST(req: NextRequest) {
  return handleInvite(req);
}

async function handleInvite(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const chatId = url.searchParams.get("chat_id") || process.env.ADMIN_CHAT_ID || "413553377";

    const buttons = [
      [{ text: "🔴 Начать тренировку", url: VPR_TG_DEEPLINK }],
      [{ text: "🌐 Открыть в браузере", url: "https://v0-car-test.vercel.app/vpr-matrix" }],
    ];

    const result = await sendComplexMessage(chatId, INVITE_TEXT, buttons, {
      parseMode: "Markdown",
    });

    if (!result.success) {
      logger.error(`[VprInvite] failed for ${chatId}: ${result.error}`);
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    logger.info(`[VprInvite] sent to ${chatId}`);
    return NextResponse.json({ success: true, chatId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invite failed";
    logger.error(`[VprInvite] error: ${msg}`);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
