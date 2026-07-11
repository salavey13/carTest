// /app/webhook-handlers/commands/command-handler.ts
import { logger } from "@/lib/logger";
import { startCommand } from "./start";
import { rageCommand } from "./rage";
import { leadsCommand } from "./leads";
import { sauceCommand } from "./sauce";
import { fileCommand } from "./file";
import { offerCommand } from "./offer";
import { howtoCommand } from "./howto";
import { ctxCommand, handleCtxSelection } from "./ctx";
import { profileCommand } from "./profile";
import { helpCommand } from "./help";
import { rageSettingsCommand } from "./rageSettings";
import { sendComplexMessage } from "../actions/sendComplexMessage";
import { supabaseAnon, supabaseAdmin } from "@/hooks/supabase";
import { simCommand } from "./sim";
import { simGoCommand } from "./sim_go";
import { seedMarketCommand } from "./seed_market";
import { simGodCommand } from "./sim_god";
import { leaderboardCommand } from "./leaderboard";
import { sosCommand, handleSosPaymentChoice } from "./sos";
import { actionsCommand, handleActionChoice } from "./actions";
import { shiftCommand } from "./shift";
import { wbCommand } from "./wb";
import { codexCommand } from "./codex";
import { docCommand, handleDocText, handleDocCallback } from "./doc-manual";
import { handleSubrentManualCommand } from "./subrent-manual";
import { analyticsPassCommand } from "./analytics-pass";
import { testDriveCommand, handleTestDriveText, handleTestDriveCallback } from "./testdrive-manual";
import { sampleCommand } from "./sample";

import { escapeTelegramMarkdown } from "@/lib/utils"; // Helper для Markdown escape

export async function handleCommand(update: any) {
    if (update.message?.text || update.message?.caption || update.callback_query) {
        const text: string = update.message?.text || update.message?.caption || update.callback_query?.data;
        const chatId: number = update.message?.chat.id || update.callback_query?.message.chat.id;
        const userId: number = update.message?.from.id || update.callback_query?.from.id;
        const userIdStr = String(userId);
        const username: string | undefined = update.message?.from.username || update.callback_query?.from.username;
        const parts = text.split(' ');
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        logger.info(`[Command Handler] Received: '${text}' from User: ${userIdStr}`);

        // ── State-aware callback routing ──────────────────────────────────────
        // Check user's active flow state FIRST to resolve routing conflicts
        // between /subrent and /doc (shared prefixes: cancel, ok, s_*, p_*).
        // Uses supabaseAdmin (bypasses RLS — user_states may not be readable by anon).
        let userFlowState: string | null = null;
        if (update.callback_query) {
            const { data: flowCheck } = await supabaseAdmin
                .from("user_states")
                .select("state")
                .eq("user_id", userIdStr)
                .maybeSingle();
            userFlowState = flowCheck?.state || null;
            logger.info(`[Command Handler] User ${userIdStr} flow state: ${userFlowState || 'none'}`);
        }

        // Handle callback queries for /subrent flow
        // Includes subrent-specific prefixes AND shared prefixes (cancel, ok, s_, p_)
        // when user is confirmed to be in subrent state.
        if (update.callback_query && (
            text.startsWith("bike_") ||
            text.startsWith("pct_") ||
            text.startsWith("price_") ||
            text.startsWith("hourly_") ||
            text.startsWith("seasonal_") ||
            text.startsWith("dur_") ||
            text.startsWith("edit_") ||
            text === "yes" || text === "no" ||
            // State-aware: route shared prefixes to subrent when in subrent flow
            (userFlowState?.startsWith("subrent_") && (
                text === "cancel" || text === "ok" ||
                text.startsWith("s_") || text.startsWith("p_")
            ))
        )) {
            await handleSubrentManualCommand({ userId: userIdStr, userName: username, text: undefined, callbackData: text, messageId: update.callback_query.message.message_id, crewId: undefined });
            return;
        }

        // Handle callback queries for /doc flow
        // Skip if user is in subrent state (shared prefixes already routed above)
        if (update.callback_query && !userFlowState?.startsWith("subrent_") && (
            text.startsWith("doc_") ||
            text.startsWith("cat_") ||
            text.startsWith("d_") ||
            text.startsWith("c_") ||
            text.startsWith("hl_") ||   // "has license?" Yes/No callbacks
            text.startsWith("e_") ||     // end date callbacks
            text.startsWith("p_") ||
            text.startsWith("s_") ||
            text.startsWith("eq_") ||    // <<< FIX: equipment callbacks (eq_helmets, eq_done, etc)
            text.startsWith("pay_") ||   // <<< FIX: payment split callbacks (pay_cash, pay_all_cash, etc)
            text.startsWith("dep_") ||   // deposit choice callbacks
            text.startsWith("sr_") ||    // СТС owner-relation callbacks
            text.startsWith("salecol_") || // sale flow color callbacks
            text.startsWith("salevin_") || // sale flow VIN callbacks
            text === "cdone" ||
            text === "cancel" ||
            text === "ok" ||
            text === "restart" ||
            text === "sts_skip" ||
            text === "ph_skip"           // <<< FIX: phone skip callback
        )) {
            const handled = await handleDocCallback(userIdStr, chatId, text, update.callback_query.id);
            if (handled) return;
        }

        // Handle callback queries for /testdrive flow
        if (update.callback_query && text.startsWith("td_")) {
            const handled = await handleTestDriveCallback(userIdStr, chatId, text, update.callback_query.id);
            if (handled) return;
        }

        // Новые handlers для rules
        if (command.startsWith('/approve_')) {
            const id = command.split('_')[1];
            await handleApprove(id, chatId, userIdStr);
            return;
        }
        if (command.startsWith('/decline_')) {
            const id = command.split('_')[1];
            await handleDecline(id, chatId, userIdStr);
            return;
        }
        if (command.startsWith('/accept_')) {
            const id = command.split('_')[1];
            await handleAccept(id, chatId, userIdStr);
            return;
        }
        if (command.startsWith('/decline_rigger_')) { // Для rigger decline
            const id = command.split('_')[2];
            await handleRiggerDecline(id, chatId, userIdStr);
            return;
        }

        // Fix для sauna: аналогичные handlers
        if (command.startsWith('/approve_sauna_')) {
            const id = command.split('_')[2];
            await handleApprove(id, chatId, userIdStr, 'sauna');
            return;
        }
        if (command.startsWith('/decline_sauna_')) {
            const id = command.split('_')[2];
            await handleDecline(id, chatId, userIdStr, 'sauna');
            return;
        }

        const commandMap: { [key: string]: Function } = {
            "/start": () => startCommand(chatId, userId, update.message?.from || update.callback_query?.from, text),
            "/help": () => helpCommand(chatId, userId),
            "/shift": () => shiftCommand(chatId, userIdStr, username),
            "/actions": () => actionsCommand(chatId, userIdStr),
            "/sos": () => sosCommand(chatId, userIdStr),
            "/rage": () => rageCommand(chatId, userId),
            "/settings": () => rageSettingsCommand(chatId, userId, text),
            "/sim": () => simCommand(chatId, userIdStr, args),
            "/sim_god": () => simGodCommand(chatId, userIdStr, args),
            "/god": () => simGodCommand(chatId, userIdStr, args),
            "/sim_go": () => simGoCommand(chatId, userIdStr, args),
            "/seed_market": () => seedMarketCommand(chatId, userIdStr),
            "/leaderboard": () => leaderboardCommand(chatId, userIdStr),
            "/board": () => leaderboardCommand(chatId, userIdStr),
            "/wb": () => wbCommand(chatId, userIdStr),
            "/leads": () => leadsCommand(chatId, userId),
            "/sauce": () => sauceCommand(chatId, userId),
            "/file": () => fileCommand(chatId, userId, args),
            "/offer": () => offerCommand(chatId, userId),
            "/howto": () => howtoCommand(chatId, userId),
            "/ctx": () => ctxCommand(chatId, userId),
            "/profile": () => profileCommand(chatId, userId, username),
            "/analytics-pass": () => analyticsPassCommand(chatId, userId, username),
            "/sample": () => sampleCommand(chatId, userId, username),
            "/testdrive": () => testDriveCommand(chatId, userId, username, text),
            "/doc": () => {
                const bestPhotoVariant = update.message?.photo?.length
                    ? [update.message.photo[update.message.photo.length - 1]]
                    : [];
                const documentFiles = update.message?.document ? [update.message.document] : [];
                return docCommand(chatId, userId, username, text, bestPhotoVariant, documentFiles);
            },
            "/codex": () => {
                const bestPhotoVariant = update.message?.photo?.length
                    ? [update.message.photo[update.message.photo.length - 1]]
                    : [];
                const documentFiles = update.message?.document ? [update.message.document] : [];
                return codexCommand(chatId, userIdStr, username, text, bestPhotoVariant, documentFiles);
            },
            "/subrent": () => {
                const bestPhotoVariant = update.message?.photo?.length
                    ? [update.message.photo[update.message.photo.length - 1]]
                    : [];
                const documentFiles = update.message?.document ? [update.message.document] : [];
                return handleSubrentManualCommand({ userId: userIdStr, userName: username, text, callbackData: undefined, crewId: undefined });
            },
        };

        const commandFunction = commandMap[command]
            || (command.startsWith("/codex@") ? commandMap["/codex"] : undefined)
            || (command.startsWith("/doc@") ? commandMap["/doc"] : undefined)
            || (command.startsWith("/subrent@") ? commandMap["/subrent"] : undefined)
            || (command.startsWith("/testdrive@") ? commandMap["/testdrive"] : undefined);

        if (commandFunction) {
            logger.info(`[Command Handler] Executing command: ${command}`);
            try {
                await commandFunction();
            } catch (cmdError) {
                logger.error(`[Command Handler] Error executing command ${command}:`, cmdError);
            }
        } else {
            // Check if user is in /doc flow (awaiting bike selection or schedule)
            const docHandled = await handleDocText(userIdStr, chatId, text);
            if (docHandled) return;

            // Check if user is in /testdrive flow
            // NOTE: no supabaseAnon pre-check — handleTestDriveText reads state internally
            // via supabaseAdmin (which bypasses RLS). Safe to call unconditionally.
            const tdHandled = await handleTestDriveText(userIdStr, chatId, text);
            if (tdHandled) return;

            // Check if user is in /subrent flow
            // FIX: Use supabaseAdmin instead of supabaseAnon — user_states may have
            // RLS that blocks anon reads. State is saved with supabaseAdmin (service role),
            // so we must also read with supabaseAdmin to find it reliably.
            const { data: subrentState } = await supabaseAdmin.from("user_states")
                .select("state")
                .eq("user_id", userIdStr)
                .like("state", "subrent_%")
                .maybeSingle();
            if (subrentState) {
                await handleSubrentManualCommand({ userId: userIdStr, userName: username, text, callbackData: undefined, crewId: undefined });
                return;
            }

            const shiftActionMap: { [key: string]: string } = {
                "✅ Начать Смену": "clock_in", "❌ Завершить Смену": "clock_out",
                "🏍️ На Байке": "toggle_ride", "🏢 В Боксе": "toggle_ride",
            };
            if (shiftActionMap[text]) {
                await shiftCommand(chatId, userIdStr, username, shiftActionMap[text]);
                return;
            }

            if (text.startsWith('⛽️') || text.startsWith('🛠️') || text.startsWith('🙏')) {
                await handleSosPaymentChoice(chatId, userIdStr, text); return;
            }
            if (text.startsWith('📸') || text.startsWith('✅') || text.startsWith('🆘') || text.startsWith('棄') || text === '❌ Закрыть') {
                await handleActionChoice(chatId, userIdStr, text); return;
            }
            if (text.startsWith('Set Spread') || text.startsWith('Toggle') || text === 'Done') {
                await rageSettingsCommand(chatId, userId, text); return;
            }
            const ctxKeys = Object.keys(require("./content/subcontexts").subcontexts);
            if (ctxKeys.includes(text)) {
                await handleCtxSelection(chatId, userId, text); return;
            }

            const { data: activeSurvey } = await supabaseAnon.from("user_survey_state").select('user_id').eq('user_id', String(userId)).maybeSingle();
            if (activeSurvey && update.message?.from) {
                await startCommand(chatId, userId, update.message.from, text);
            } else {
                logger.warn(`[Command Handler] Unknown command for user ${userId}. Text: '${text}'`);
                await sendComplexMessage(chatId, "Неизвестная команда. Используй /help.", []);
            }
        }
        return;
    }
    logger.warn("[Command Handler] Received unhandled update type.", { update_id: update.update_id });
}

async function handleApprove(id: string, chatId: number, userId: string, type: string = 'rule') {
  // Простая проверка на admin (расширить по appContext)
  const { data: isAdmin } = await supabaseAnon.from('users').select('role').eq('user_id', userId).single();
  if (isAdmin?.role !== 'admin') {
    await sendComplexMessage(chatId, 'Access denied.', []);
    return;
  }

  const response = await fetch(`/api/rentals/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'confirmed', action: 'approve' }),
  });

  if (response.ok) {
    const { data: rental } = await supabaseAnon.from('rentals').select('*').eq('rental_id', id).single();
    const summaryMd = escapeTelegramMarkdown(`Booking approved! \n**Type:** ${rental.metadata.session_type || type} \n**Time:** ${rental.requested_start_date} - ${rental.requested_end_date}`);
    await sendComplexMessage(rental.user_id, summaryMd, [], { imageQuery: `${type}-confirmed`, parseMode: 'MarkdownV2' });
    if (rental.metadata.rigger_id) await sendComplexMessage(rental.metadata.rigger_id, summaryMd, [], { parseMode: 'MarkdownV2' });
    await sendComplexMessage(chatId, 'Approved.', []);
  } else {
    await sendComplexMessage(chatId, 'Error approving.', []);
  }
}

async function handleDecline(id: string, chatId: number, userId: string, type: string = 'rule') {
  // Admin check аналогично
  const { data: isAdmin } = await supabaseAnon.from('users').select('role').eq('user_id', userId).single();
  if (isAdmin?.role !== 'admin') {
    await sendComplexMessage(chatId, 'Access denied.', []);
    return;
  }

  const response = await fetch(`/api/rentals/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'cancelled', action: 'decline' }),
  });

  if (response.ok) {
    const { data: rental } = await supabaseAnon.from('rentals').select('*').eq('rental_id', id).single();
    const summaryMd = escapeTelegramMarkdown(`Booking declined. \n**Type:** ${rental.metadata.session_type || type} \nRefund initiated.`);
    await sendComplexMessage(rental.user_id, summaryMd, [], { parseMode: 'MarkdownV2' });
    if (rental.metadata.rigger_id) await sendComplexMessage(rental.metadata.rigger_id, summaryMd, [], { parseMode: 'MarkdownV2' });
    await sendComplexMessage(chatId, 'Declined and refunded.', []);
  } else {
    await sendComplexMessage(chatId, 'Error declining.', []);
  }
}

async function handleAccept(id: string, chatId: number, userId: string) {
  // Rigger check: убедиться, что userId == rigger_id
  // Select the full metadata object (not metadata->>rigger_id which
  // returns only { rigger_id: string } and makes rental.metadata undefined).
  const { data: rental } = await supabaseAnon.from('rentals').select('metadata, user_id').eq('rental_id', id).maybeSingle();
  if (!rental) {
    await sendComplexMessage(chatId, 'Аренда не найдена.', []);
    return;
  }
  const metadata = (rental.metadata || {}) as Record<string, any>;
  if (metadata.rigger_id !== userId) {
    await sendComplexMessage(chatId, 'Access denied.', []);
    return;
  }

  const { error } = await supabaseAnon.from('rentals').update({
    metadata: { ...metadata, rigger_confirmed: true }
  }).eq('rental_id', id);

  if (!error) {
    const summaryMd = escapeTelegramMarkdown(`You accepted the booking!`);
    await sendComplexMessage(chatId, summaryMd, [], { parseMode: 'MarkdownV2' });
    // Notify admin/user
    const adminChatId = process.env.ADMIN_CHAT_ID;
    if (adminChatId) {
      await sendComplexMessage(adminChatId, `Rigger accepted ${id}.`, []);
    }
  } else {
    await sendComplexMessage(chatId, 'Error accepting.', []);
  }
}

async function handleRiggerDecline(id: string, chatId: number, userId: string) {
  // Аналогично accept, но decline: notify admin to reassign
  const { data: rental } = await supabaseAnon.from('rentals').select('metadata, user_id').eq('rental_id', id).maybeSingle();
  if (!rental) {
    await sendComplexMessage(chatId, 'Аренда не найдена.', []);
    return;
  }
  const metadata = (rental.metadata || {}) as Record<string, any>;
  if (metadata.rigger_id !== userId) {
    await sendComplexMessage(chatId, 'Access denied.', []);
    return;
  }

  const { error } = await supabaseAnon.from('rentals').update({
    status: 'pending_reassign', // Или cancelled, по логике
    metadata: { ...metadata, rigger_confirmed: false }
  }).eq('rental_id', id);

  if (!error) {
    await sendComplexMessage(chatId, 'Declined.', []);
    // Notify admin
    const adminChatId = process.env.ADMIN_CHAT_ID;
    if (adminChatId) {
      await sendComplexMessage(adminChatId, `Rigger declined ${id}. Reassign?`, [[{ text: '/reassign_' + id }]]);
    }
    // Notify user
    const summaryMd = escapeTelegramMarkdown(`Rigger declined. Admin will reassign.`);
    const renterChatId = rental.user_id;
    if (renterChatId) {
      await sendComplexMessage(renterChatId, summaryMd, [], { parseMode: 'MarkdownV2' });
    }
  } else {
    await sendComplexMessage(chatId, 'Error declining.', []);
  }
}
