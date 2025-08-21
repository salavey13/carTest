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
import { supabaseAdmin } from "@/hooks/supabase";
import { simCommand } from "./sim";
import { simGoCommand } from "./sim_go";
import { seedMarketCommand } from "./seed_market";
import { simGodCommand } from "./sim_god";
import { leaderboardCommand } from "./leaderboard";
import { sosCommand, handleSosPaymentChoice } from "./sos";
import { actionsCommand, handleActionChoice } from "./actions";
import { shiftCommand } from "./shift"; 
import { escapeTelegramMarkdown } from "@/lib/utils"; // Helper для Markdown escape

export async function handleCommand(update: any) {
    if (update.message?.text || update.callback_query) {
        const text: string = update.message?.text || update.callback_query?.data;
        const chatId: number = update.message?.chat.id || update.callback_query?.message.chat.id;
        const userId: number = update.message?.from.id || update.callback_query?.from.id;
        const userIdStr = String(userId);
        const username: string | undefined = update.message?.from.username || update.callback_query?.from.username;
        const parts = text.split(' ');
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        logger.info(`[Command Handler] Received: '${text}' from User: ${userIdStr}`);

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
            await handleApprove(id, chatId, userIdStr, 'sauna'); // Передаём type для адаптации
            return;
        }
        if (command.startsWith('/decline_sauna_')) {
            const id = command.split('_')[2];
            await handleDecline(id, chatId, userIdStr, 'sauna');
            return;
        }
        // Аналогично для accept/decline в sauna, если нужно

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
            "/leads": () => leadsCommand(chatId, userId),
            "/sauce": () => sauceCommand(chatId, userId),
            "/file": () => fileCommand(chatId, userId, args),
            "/offer": () => offerCommand(chatId, userId),
            "/howto": () => howtoCommand(chatId, userId),
            "/ctx": () => ctxCommand(chatId, userId),
            "/profile": () => profileCommand(chatId, userId, username),
        };

        const commandFunction = commandMap[command];

        if (commandFunction) {
            await commandFunction();
        } else {
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

            const { data: activeSurvey } = await supabaseAdmin.from("user_survey_state").select('user_id').eq('user_id', String(userId)).maybeSingle();
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
  const { data: isAdmin } = await supabaseAdmin.from('users').select('role').eq('user_id', userId).single();
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
    const { data: rental } = await supabaseAdmin.from('rentals').select('*').eq('rental_id', id).single();
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
  const { data: isAdmin } = await supabaseAdmin.from('users').select('role').eq('user_id', userId).single();
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
    const { data: rental } = await supabaseAdmin.from('rentals').select('*').eq('rental_id', id).single();
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
  const { data: rental } = await supabaseAdmin.from('rentals').select('metadata->>rigger_id').eq('rental_id', id).single();
  if (rental.metadata.rigger_id !== userId) {
    await sendComplexMessage(chatId, 'Access denied.', []);
    return;
  }

  const { error } = await supabaseAdmin.from('rentals').update({
    metadata: { ...rental.metadata, rigger_confirmed: true }
  }).eq('rental_id', id);

  if (!error) {
    const summaryMd = escapeTelegramMarkdown(`You accepted the booking!`);
    await sendComplexMessage(chatId, summaryMd, [], { parseMode: 'MarkdownV2' });
    // Notify admin/user
    await sendComplexMessage(process.env.ADMIN_CHAT_ID, `Rigger accepted ${id}.`, []);
  } else {
    await sendComplexMessage(chatId, 'Error accepting.', []);
  }
}

async function handleRiggerDecline(id: string, chatId: number, userId: string) {
  // Аналогично accept, но decline: notify admin to reassign
  const { data: rental } = await supabaseAdmin.from('rentals').select('metadata->>rigger_id').eq('rental_id', id).single();
  if (rental.metadata.rigger_id !== userId) {
    await sendComplexMessage(chatId, 'Access denied.', []);
    return;
  }

  const { error } = await supabaseAdmin.from('rentals').update({
    status: 'pending_reassign', // Или cancelled, по логике
    metadata: { ...rental.metadata, rigger_confirmed: false }
  }).eq('rental_id', id);

  if (!error) {
    await sendComplexMessage(chatId, 'Declined.', []);
    // Notify admin
    await sendComplexMessage(process.env.ADMIN_CHAT_ID, `Rigger declined ${id}. Reassign?`, [[{ text: '/reassign_' + id }]]);
    // Notify user
    const summaryMd = escapeTelegramMarkdown(`Rigger declined. Admin will reassign.`);
    await sendComplexMessage(rental.user_id, summaryMd, [], { parseMode: 'MarkdownV2' });
  } else {
    await sendComplexMessage(chatId, 'Error declining.', []);
  }
}