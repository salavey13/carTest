// app/api/franchize/lead-avito-reply/route.ts
//
// ОТПРАВКА ОТВЕТА В ЧАТ АВИТО из страницы лидов (operator → buyer).
//
// Обратный путь к входящему webhook'у: оператор пишет ответ в шторке лида
// («Готовый ответ» → композер «Отправить в Авито»), текст улетает в
// реальный чат Avito через Messenger API v3 (см. lib/avito-messenger.ts).
// Успешная отправка:
//   1) дописывает реплику в metadata.messages (from: "seller") — лог чата
//      в карточке клиента пополняется БЕЗ ожидания эха от webhook'а Авито.
//      Дедуп: если webhook-эхо позже принесёт ту же реплику, на нашем входе
//      она уже есть — повторная seller-реплика с тем же текстом вырезается,
//      чтобы пузырь не задвоился;
//   2) ставит metadata.avitoLastReplyAt — «мы отвечали N минут назад»;
//   3) пишет событие avito_reply в журнал lead_events (Lead Game, +2 очка).
//
// last_seen_at / lastMessage НЕ трогаем: они описывают ПОСЛЕДНЕЕ СООБЩЕНИЕ
// ПОКУПАТЕЛЯ и кормят SLA-очередь «ждут ответа» — наш ответ не должен
// обнулять ожидание.
//
// POST body:
//   { crewId, slug, chatId, text, leadId? }
//     chatId — metadata.avitoChatId (реальный чат Авито; синтетика fwd-*
//     отвергается — у форвардов нет чата, отвечать надо вручную).
//     leadId — ключ лида для журнала (avito:<chatId> / телефон); если не
//     передан, выводим из chatId.
//
// Поиск лида — по metadata->>avitoChatId (как в webhook'е), а НЕ по leadId:
// ключ лида алиас-мерджится (avito:<id> → телефон → opdoc:<id>), chat_id —
// единственный стабильный идентификатор реального чата.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { verifyCrewAccess } from "../_auth";
import { recordLeadEvent } from "@/app/franchize/lib/lead-events";
import {
  AVITO_MESSAGE_MAX_LENGTH,
  avitoReplyConfigError,
  sendAvitoChatMessage,
} from "@/app/franchize/lib/avito-messenger";

const CREW_SLUG = "vip-bike";
// Держим синхронно с MAX_MESSAGE_LOG в lead-client-facts.ts.
const MAX_MESSAGE_LOG = 12;

function isSyntheticChatId(chatId: string): boolean {
  // fwd-* — синтетические ключи bot_forward-лидов, реального чата нет.
  return chatId.startsWith("fwd-");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { crewId, slug, chatId, text, leadId } = body as {
      crewId?: string;
      slug?: string;
      chatId?: string;
      text?: string;
      leadId?: string;
    };

    if (!crewId || !chatId || !text) {
      return NextResponse.json(
        { success: false, error: "Missing crewId / chatId / text" },
        { status: 400 },
      );
    }

    const auth = await verifyCrewAccess(request, crewId);
    if (auth.ok === false) return auth.response;

    const trimmed = String(text).trim();
    if (!trimmed) {
      return NextResponse.json(
        { success: false, error: "Пустой текст сообщения" },
        { status: 400 },
      );
    }
    if (trimmed.length > AVITO_MESSAGE_MAX_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Сообщение длиннее ${AVITO_MESSAGE_MAX_LENGTH} символов` },
        { status: 400 },
      );
    }
    if (isSyntheticChatId(chatId)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Этот лид из ручного форварда — реального чата Авито нет. Ответьте вручную через avito.ru",
        },
        { status: 422 },
      );
    }

    // Лид должен существовать, быть авито-лидом этого экипажа и этого чата.
    // АККАУНТ: metadata.avitoAccount определяет, ЧЬИ креды отправят ответ
    // (несколько кабинетов Авито: аренда/продажа, см. avito-messenger.ts).
    const { data: intent, error: lookupError } = await supabaseAdmin
      .from("franchize_intents")
      .select("id, slug, contact_channel, metadata")
      .eq("slug", slug || CREW_SLUG)
      .eq("contact_channel", "avito")
      .filter("metadata->>avitoChatId", "eq", chatId)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      logger.error("[lead-avito-reply] lookup failed", lookupError);
      return NextResponse.json(
        { success: false, error: "Не удалось найти лид" },
        { status: 500 },
      );
    }
    if (!intent?.id) {
      return NextResponse.json(
        { success: false, error: "Лид для этого чата Авито не найден" },
        { status: 404 },
      );
    }

    // Конфиг (с учётом аккаунта лида) проверяем перед отправкой: не настроено —
    // честная 503 с подсказкой, каких именно env не хватает.
    const prevMeta =
      intent.metadata && typeof intent.metadata === "object"
        ? (intent.metadata as Record<string, unknown>)
        : {};
    const accountKey =
      typeof prevMeta.avitoAccount === "string" && prevMeta.avitoAccount.trim()
        ? prevMeta.avitoAccount.trim()
        : null;
    const configError = avitoReplyConfigError(accountKey);
    if (configError) {
      return NextResponse.json({ success: false, error: configError }, { status: 503 });
    }

    const sent = await sendAvitoChatMessage(chatId, trimmed, accountKey);
    if (!sent.ok) {
      logger.warn("[lead-avito-reply] avito send failed", { chatId, error: sent.error });
      return NextResponse.json({ success: false, error: sent.error }, { status: 502 });
    }

    // ── Лог чата + метка последнего ответа ────────────────────────────────
    const nowIso = new Date().toISOString();
    const prevMessages = Array.isArray(prevMeta.messages) ? prevMeta.messages : [];
    // Дедуп: режем ПРОШЛЫЕ seller-реплики с тем же текстом (webhook-эхо могло
    // уже дописать её между отправкой и нашим апдейтом) и аппендим свежую.
    const deduped = prevMessages.filter(
      (m: { from?: string; text?: string }) =>
        !(m?.from === "seller" && (m?.text || "").trim() === trimmed),
    );
    const nextMessages = [...deduped, { at: nowIso, from: "seller", text: trimmed }].slice(
      -MAX_MESSAGE_LOG,
    );

    const { error: updateError } = await supabaseAdmin
      .from("franchize_intents")
      .update({
        metadata: {
          ...prevMeta,
          messages: nextMessages,
          avitoLastReplyAt: nowIso,
        },
      })
      .eq("id", intent.id);

    if (updateError) {
      // Сообщение В Авито уже ушло — падать нельзя, но и молчать: логируем.
      // Клиент просто не увидит реплику в логе до следующего fetch.
      logger.error("[lead-avito-reply] messages log update failed", updateError);
    }

    // Журнал (Lead Game): +2 очка оператору за активный контакт.
    await recordLeadEvent({
      crewSlug: slug || CREW_SLUG,
      leadId: String(leadId || `avito:${chatId}`),
      type: "avito_reply",
      actor: auth.userId,
      label: "Ответ отправлен в чат Авито",
      detail: trimmed.slice(0, 200),
    });

    return NextResponse.json({
      success: true,
      sentAt: nowIso,
      message: { at: nowIso, from: "seller", text: trimmed },
    });
  } catch (error) {
    logger.error("[lead-avito-reply] exception", error);
    return NextResponse.json(
      { success: false, error: "Внутренняя ошибка при отправке в Авито" },
      { status: 500 },
    );
  }
}
