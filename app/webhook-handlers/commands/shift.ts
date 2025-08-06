"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage } from "../actions/sendComplexMessage";

function escapeTelegramMarkdown(text: string): string {
    if (!text) return "";
    const charsToEscape = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
    return text.replace(new RegExp(`([${charsToEscape.join('\\')}])`, 'g'), '\\$1');
}

export async function shiftCommand(chatId: number, userId: string, username?: string, action?: string) {
    logger.info(`[Shift Command EXEC] User ${userId}, Action: ${action || 'request_keyboard'}`);
    
    try {
        const { data: crewMember, error: crewError } = await supabaseAdmin
            .from("crew_members")
            .select("crew_id, live_status, crews(owner_id, name)")
            .eq("user_id", userId)
            .eq("membership_status", "active")
            .single();

        if (crewError || !crewMember) {
            await sendComplexMessage(chatId, "Вы не являетесь активным участником экипажа.");
            return;
        }

        const { crew_id, crews: crew, live_status } = crewMember;
        if (!crew) throw new Error(`Критическая ошибка: отсутствуют данные экипажа для участника ${userId}`);
        
        const { owner_id: ownerId, name: crewName } = crew;

        if (!action) {
            let buttons;
            if (live_status === 'offline') {
                buttons = [[{ text: "✅ Начать Смену" }]];
            } else if (live_status === 'online') {
                buttons = [[{ text: "🏍️ На Байке" }], [{ text: "❌ Завершить Смену" }]];
            } else { // riding
                buttons = [[{ text: "🏢 В Боксе" }], [{ text: "❌ Завершить Смену" }]];
            }
            await sendComplexMessage(chatId, "Выберите действие:", buttons, { keyboardType: 'reply' });
            return;
        }

        let updateData: any = {};
        let userMessage = "";
        let ownerMessage = "";
        
        const safeUsername = escapeTelegramMarkdown(username || 'user');
        const safeCrewName = escapeTelegramMarkdown(crewName);
        let shiftLogAction: (() => Promise<any>) | null = null;

        switch (action) {
            case 'clock_in':
                if (live_status === 'offline') {
                    updateData = { live_status: 'online' };
                    userMessage = "✅ *Смена начата\\.* Время пошло\\.";
                    ownerMessage = `🟢 @${safeUsername} начал смену в экипаже *'${safeCrewName}'*\\.`;
                    shiftLogAction = () => supabaseAdmin.from('crew_member_shifts').insert({
                        member_id: userId, // Assuming member_id is the user_id
                        crew_id: crew_id,
                        start_time: new Date().toISOString()
                    });
                }
                break;
            case 'clock_out':
                 if (live_status !== 'offline') {
                    updateData = { live_status: 'offline', last_location: null };
                    userMessage = `✅ *Смена завершена\\.*\nХорошего отдыха\\!`;
                    ownerMessage = `🔴 @${safeUsername} завершил смену в экипаже *'${safeCrewName}'*\\.`;
                    shiftLogAction = async () => {
                        const { data: latestShift } = await supabaseAdmin.from('crew_member_shifts')
                            .select('id')
                            .eq('member_id', userId)
                            .is('end_time', null)
                            .order('start_time', { ascending: false })
                            .limit(1)
                            .single();
                        if (latestShift) {
                            return supabaseAdmin.from('crew_member_shifts').update({ end_time: new Date().toISOString() }).eq('id', latestShift.id);
                        }
                    };
                }
                break;
            case 'toggle_ride':
                if (live_status !== 'offline') {
                    const newStatus = live_status === 'online' ? 'riding' : 'online';
                    updateData = { live_status: newStatus };
                    if (newStatus === 'riding') {
                        userMessage = "🏍️ Статус: *На Байке*\\. Теперь отправьте свою геолокацию, чтобы появиться на карте экипажа\\.";
                    } else {
                        updateData.last_location = null;
                        userMessage = "🏢 Статус: *Онлайн*\\. Снова в боксе, с карты убраны\\.";
                    }
                    ownerMessage = `⚙️ Статус @${safeUsername} в *'${safeCrewName}'*: ${newStatus === 'riding' ? "На Байке" : "Онлайн"}`;
                }
                break;
        }
        
        if (Object.keys(updateData).length > 0) {
            await supabaseAdmin.from("crew_members").update(updateData).eq("user_id", userId).eq("membership_status", "active");
            if (shiftLogAction) await shiftLogAction();
            
            await sendComplexMessage(chatId, userMessage, [], { removeKeyboard: true, parseMode: 'MarkdownV2' });

            if (ownerId && ownerId !== userId) {
                await sendComplexMessage(ownerId, ownerMessage, [], { parseMode: 'MarkdownV2' });
            }
        } else {
            await sendComplexMessage(chatId, "Действие не выполнено (статус уже актуален).", [], { removeKeyboard: true });
        }

    } catch (e: any) {
        logger.error(`[Shift Command FATAL] for user ${userId}:`, e);
        await sendComplexMessage(chatId, `🚨 Критическая ошибка в системе смен: ${escapeTelegramMarkdown(e.message)}`);
    }
}