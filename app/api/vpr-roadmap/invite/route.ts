import { NextRequest, NextResponse } from "next/server";
import { telegramDeliver } from "@/lib/telegram-transport";
import { VPR_TG_DEEPLINK, VPR_HERO_IMAGES } from "@/lib/vprRoadmap";
import { logger } from "@/lib/logger";

// task213/214: отправка инвайт-уведомления в Матрицу ВПР через форвардинг-API.
// Юзер (родитель/организатор) получает сообщение у себя в TG и форвардит
// его геймеру. task214: hero-фото алгебры + inline URL-кнопки — они
// переживают пересылку, в отличие от reply-клавиатуры.
// task221: v2 — СУПЕРТЕСТ-режим (?mode=super): персональные приглашения
// «протестируй себя» геймеру и боссу (me), разные тексты + CC-копия.

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

// task221: приглашение на СУПЕРТЕСТ геймеру (w3onax)
const SUPER_INVITE_GAMER =
  `⚡ *СУПЕРТЕСТ: проверь себя за 12 минут*\n\n` +
  `Один прогон — все 7 предметов 8 класса вперемешку: алгебра, геометрия, ` +
  `вероятность, русский, всеобщая, литература и история России.\n\n` +
  `Зачем:\n` +
  `🎯 За 12 минут система найдёт твои дыры — без оценки и наказаний\n` +
  `🧠 Матрица перестроится под тебя: слабейшие предметы станут первыми уровнями\n` +
  `📊 Тебе покажут карту: где ты силён, а где — раскол\n\n` +
  `Три режима: Quick\_Scan (12 вопросов), Full\_Scan (21), Deep\_Scan (35).\n` +
  `Провалишь вопрос — увидишь разбор сразу. Это не контрольная, это диагностика.\n\n` +
  `Супертест встроен прямо в Матрицу — жми кнопку и погнали.

Wake up, восьмиклассник. Посмотрим, что ты на самом деле знаешь 💊`;

// task221: приглашение боссу (me) — «протестируй себя»
const SUPER_INVITE_BOSS =
  `🧪 *СУПЕРТЕСТ готов — проверь себя первым*\n\n` +
  `Новый диагностический режим Матрицы 8 класса:\n` +
  `• случайные вопросы из всех 7 предметов за один прогон\n` +
  `• карта дыр по каждому предмету с порогом 70%\n` +
  `• персональный порядок разблокировки: слабейшие предметы — первыми уровнями\n` +
  `• quick stats в хабе: средний %, лучший предмет, повторы\n\n` +
  `Режимы: Quick\_Scan 12 вопросов / Full\_Scan 21 / Deep\_Scan 35.\n` +
  `Геймеру (w3onax) приглашение отправлено отдельным сообщением ниже ⬇️\n\n` +
  `Встроен в Матрицу (кнопка на главной), авторизация через Telegram — порядок пишется в профиль.

Прогони сам — увидишь, что увидит он 😉`;

// task215b: экранирование пользовательских вставок (ключ доступа) в Markdown
const escapeMd = (s: string) => s.replace(/([_*`\[\]])/g, "\\$1");

async function sendTo(
  chatId: string,
  text: string,
  opts?: { photo?: string; buttons?: { text: string; url: string }[][] }
): Promise<{ ok: boolean; error?: string }> {
  const buttons = opts?.buttons ?? [
    [{ text: "🔴 Начать тренировку", url: VPR_TG_DEEPLINK }],
    [{ text: "🌐 Открыть в браузере", url: "https://v0-car-test.vercel.app/vpr-matrix" }],
  ];
  const photo = opts?.photo ?? VPR_HERO_IMAGES.algebra;
  const payload = {
    photo,
    caption: text,
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: buttons },
  };
  let result = await telegramDeliver("sendPhoto", chatId, payload);
  if (!result.ok) {
    // task221: битый Markdown (непарные _ * у пользовательских вставок или
    // имён режимов) валяет всю отправку — ретрай без форматирования лучше,
    // чем потерянное приглашение (паттерн из vprRoadmapActions).
    logger.warn(`[VprInvite] Markdown failed (${result.error}), retrying plain for ${chatId}`);
    const plain: Record<string, unknown> = {
      photo,
      caption: text.replace(/[*_`]/g, ""),
      reply_markup: payload.reply_markup,
    };
    result = await telegramDeliver("sendPhoto", chatId, plain);
  }
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
    // task221: режим супертеста + отдельный адрес босса
    const mode = url.searchParams.get("mode");
    const bossId = url.searchParams.get("boss_id") || process.env.ADMIN_CHAT_ID || "413553377";

    // ── task221: СУПЕРТЕСТ-приглашения ──
    if (mode === "super") {
      // task222: главная кнопка — TG WebApp (там супертест встроен в Матрицу
      // и юзер авторизован: персональный порядок пишется в профиль).
      // Прямой браузерный URL оставлен второй кнопкой — гость-фолбэк
      // (диагностика работает и без авторизации, порядок — в localStorage).
      const superButtons = [
        [{ text: "⚡ Пройти СУПЕРТЕСТ", url: VPR_TG_DEEPLINK }],
        [{ text: "🌐 Открыть в браузере", url: "https://v0-car-test.vercel.app/vpr-super" }],
      ];
      // 1) геймеру — игровой текст
      const gamerText = code
        ? `${SUPER_INVITE_GAMER}\n🔑 Твой ключ доступа: \`${escapeMd(code)}\`\n`
        : SUPER_INVITE_GAMER;
      const gamerResult = await sendTo(chatId, gamerText, {
        photo: VPR_HERO_IMAGES.probability, // неоновая probability-8 — символ «всё вперемешку»
        buttons: superButtons,
      });
      if (!gamerResult.ok) {
        return NextResponse.json({ success: false, error: gamerResult.error, target: "gamer" }, { status: 500 });
      }
      // 2) боссу (me) — свой текст, всегда
      const bossResult = bossId && bossId !== chatId
        ? await sendTo(bossId, SUPER_INVITE_BOSS, {
            photo: VPR_HERO_IMAGES.algebra,
            buttons: superButtons,
          })
        : null;
      return NextResponse.json({
        success: true,
        mode: "super",
        gamer: { chatId, ok: true },
        boss: bossResult ? { chatId: bossId, ok: bossResult.ok } : "skipped",
      });
    }

    // ── обычный инвайт (task213/214/215b) ──
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
