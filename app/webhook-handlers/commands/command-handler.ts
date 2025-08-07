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

// --- УДАЛЕНО: Вся эта функция больше не нужна. Логика перенесена в /app/api/telegramWebhook/route.ts ---
/*
async function handleLocationUpdate(userId: string, location: { latitude: number; longitude: number; }) {
    try {
        const { data: member } = await supabaseAdmin
            .from('crew_members')
            .select('live_status')
            .eq('user_id', userId)
            .eq('membership_status', 'active')
            .single();
        
        // Обновляем локацию, только если он сейчас "На Байке"
        if (member && member.live_status === 'riding') {
            const { error } = await supabaseAdmin
                .from('crew_members')
                .update({ last_location: `POINT(${location.longitude} ${location.latitude})` })
                .eq('user_id', userId);
            
            if (error) throw error;
            logger.info(`[Location Update] Updated location for riding user ${userId}`);
        }
    } catch (error) {
        logger.error(`[Location Update] Failed for user ${userId}`, error);
    }
}
*/

export async function handleCommand(update: any) {
    // --- УДАЛЕНО: Этот блок `if` теперь обрабатывается в /app/api/telegramWebhook/route.ts ---
    /*
    if (update.message?.location) {
        const userId: string = String(update.message.from.id);
        const location = update.message.location;
        await handleLocationUpdate(userId, location);
        return;
    }
    */

    // --- ИЗМЕНЕНО: условие теперь проверяет только текстовые сообщения и колбэки ---
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