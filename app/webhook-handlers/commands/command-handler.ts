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
import { supabaseAnon } from "@/hooks/supabase";
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

        // Handle callback queries for /doc flow
        if (update.callback_query && (
            text.startsWith("doc_") ||
            text.startsWith("cat_") ||
            text.startsWith("d_") ||
            text.startsWith("c_") ||
            text.startsWith("hl_") ||   // <<< FIX: "has license?" Yes/No callbacks (hl_yes, hl_no)
            text.startsWith("e_") ||     // <<< FIX: end date callbacks (e_tomorrow_10, e_2days_10, e_custom)
            text.startsWith("p_") ||
            text.startsWith("s_") ||
            text === "cdone" ||
            text === "cancel" ||
            text === "ok" ||
            text === "restart"
        )) {
            const handled = await handleDocCallback(userIdStr, chatId, text, update.callback_query.id);
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
            "/seed_market": () => seedMarketCommand(chatId, userIdStr, args),
            "/leaderboard": () => leaderboardCommand(chatId, userId),
            "/wb": () => wbCommand(chatId, userIdStr, args),
            "/codex": () => codexCommand(chatId, userIdStr, args),
            "/doc": () => docCommand(chatId, userId, username, text),
        };

        if (commandMap[command]) {
            commandMap[command]();
            return;
        }

        // /rage and /shift with args
        if (command === '/rage' && args.length > 0) {
            await rageCommand(chatId, userId, text);
            return;
        }

        // Handle SOS
        if (command === '/sos' || text === 'sos' || text === 'сос') {
            await sosCommand(chatId, userIdStr);
            return;
        }

        // Handle /actions
        if (text.startsWith('/actions') || text === 'actions') {
            await actionsCommand(chatId, userIdStr);
            return;
        }

        // Handle doc text flow (user typing in response to /doc prompts)
        {
            const docHandled = await handleDocText(userIdStr, chatId, text);
            if (docHandled) return;
        }

        const shiftActionMap: { [key: string]: string } = {
            'open': 'open',
            'close': 'close',
            'открыть': 'open',
            'закрыть': 'close',
        };

        if (shiftActionMap[text.toLowerCase()]) {
            await shiftCommand(chatId, userIdStr, username);
            return;
        }

        // Handle SOS payment choice
        if (text === '1' || text === '2' || text === '3') {
            const handled = await handleSosPaymentChoice(chatId, userIdStr, text);
            if (handled) return;
        }

        // Handle /actions choice
        if (text === '1' || text === '2' || text === '3' || text === '4') {
            const handled = await handleActionChoice(chatId, userIdStr, text);
            if (handled) return;
        }

        // Handle ctx selection
        if (text.startsWith('ctx_') || text.startsWith('context_')) {
            await handleCtxSelection(chatId, userIdStr, text);
            return;
        }

        logger.info(`[Command Handler] Unhandled text: '${text}' from User: ${userIdStr}`);
    }
}