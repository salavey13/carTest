import { NextRequest, NextResponse } from "next/server";
import { telegramDeliver } from "@/lib/telegram-transport";
import { VPR_TG_DEEPLINK, VPR_HERO_IMAGES } from "@/lib/vprRoadmap";
import { logger } from "@/lib/logger";

// task213/214: отправка инвайт-уведомления в Матрицу ВПР через форвардинг-API.
// Юзер (родитель/организатор) получает сообщение у себя в TG и форвардит
// его геймеру. task214: hero-фото алгебры + inline URL-кнопки — они
// переживают пересылку, в отличие от reply-клавиатуры.
// GET/POST с ?chat_id= (по умолчанию ADMIN_CHAT_ID).

const INVITE_TEXT =
  `🎮 *МАТРИЦА 8 КЛАССА — тренировочная программа*\n\n` +
  `Контрольные за полугодие не сдаются зубрёжкой — они дешифруются.\n\n` +
  `Что внутри:\n` +
  `🔓 6 уровней-предметов: Алгебра → Геометрия → Вероятность → Русский → История → Литература\n` +
  `📖 Шпаргалки-загрузки: мини-игры, пошаговые разборы, квизы\n` +
  `⚔️ Тесты-бои: реальные ВПР-варианты с разбором каждого удара\n` +
  `🏅 Ачивки: First Blood, Flawless Victory, Iron Will, The One\n` +
  `🔒 Замки: следующий предмет открывается только после сдачи предыдущего (≥70%)\n\n` +
  `Протокол прокачки: _Feed → Fight → Fail → Repeat → Upgrade_\n` +
  `Провалился — не страшно: это просто итерация. Второй заход всегда точнее.\n\n` +
  `Прогресс сохраняется, бот присылает уведомления об открытых уровнях и ачивках 🏆\n\n` +
  `Wake up, восьмиклассник… 💊`;

// task215b: экранирование пользовательских вставок (ключ доступа) в Markdown
const escapeMd = (s: string) => s.replace(/([_*`\[\]])/g, "\\$1");

async function sendTo(chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const buttons = [
    [{ text: "🔴 Начать тренировку", url: VPR_TG_DEEPLINK }],
    [{ text: "🌐 Открыть в браузере", url: "https://v0-car-test.vercel.app/vpr-matrix" }],
  ];
  const result = await telegramDeliver("sendPhoto", chatId, {
    photo: VPR_HERO_IMAGES.algebra,
    caption: text,
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: buttons },
  });
  if (!result.ok) logger.error(`[VprInvite] failed for ${chatId}: ${result.error}`);
  else logger.info(`[VprInvite] sent to ${chatId}`);
  return result;
}

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
    // task215b: личный ключ доступа (append к инвайту) + копия админу
    const code = (url.searchParams.get("code") || "").trim().slice(0, 64);
    const cc = url.searchParams.get("cc") === "admin";

    const text = code
      ? `${INVITE_TEXT}\n🔑 Твой ключ доступа: \`${code}\`\n`
      : INVITE_TEXT;

    const result = await sendTo(chatId, text);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    // CC: копия в админ-чат с пометкой, кому ушёл инвайт (босс «me in CC»)
    let ccResult: { ok: boolean; error?: string } | null = null;
    if (cc) {
      const adminId = process.env.ADMIN_CHAT_ID || "413553377";
      if (adminId && adminId !== chatId) {
        const ccText =
          `📋 *CC: инвайт отправлен* \`${chatId}\`${code ? ` (ключ: \`${code}\`)` : ""}\n\n` +
          INVITE_TEXT +
          (code ? `\n🔑 Ключ доступа получателя: \`${code}\`\n` : "");
        ccResult = await sendTo(adminId, ccText);
      }
    }

    return NextResponse.json({ success: true, chatId, cc: ccResult ? (ccResult.ok ? "sent" : "failed") : "skipped" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invite failed";
    logger.error(`[VprInvite] error: ${msg}`);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
