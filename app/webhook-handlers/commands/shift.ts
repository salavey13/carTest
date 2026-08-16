"use server";

import { logger } from "@/lib/logger";
import { supabaseAnon } from "@/hooks/supabase";
import { sendComplexMessage } from "../actions/sendComplexMessage";

function escapeTelegramMarkdown(text: string): string {
    if (!text) return "";
    const charsToEscape = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
    return text.replace(new RegExp(`([${charsToEscape.join('\\')}])`, 'g'), '\\$1');
}

export async function shiftCommand(chatId: number, userId: string, username?: string, action?: string) {
    logger.info(`[Shift Command EXEC] User ${userId}, Action: ${action || 'request_keyboard'}`);
    
    try {
        // Use .limit(1) instead of .single() — users can be active members of multiple crews.
        // .single() throws PGRST116 when 2+ rows match, falsely rejecting valid members.
        const { data: crewMembers, error: crewError } = await supabaseAnon
            .from("crew_members")
            .select("crew_id, live_status, crews(owner_id, name)")
            .eq("user_id", userId)
            .eq("membership_status", "active")
            .order("joined_at", { ascending: false })
            .limit(1);
        const crewMember = crewMembers?.[0] ?? null;

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
                    // FIX: Changed start_time to clock_in_time to match schema
                    shiftLogAction = () => supabaseAnon.from('crew_member_shifts').insert({
                        member_id: userId,
                        crew_id: crew_id,
                        clock_in_time: new Date().toISOString()
                    });
                }
                break;
            case 'clock_out':
                // Always try to close the shift, regardless of live_status
                // Handles case where status is already 'offline' but shift wasn't closed
                shiftLogAction = async () => {
                    const { data: latestShift } = await supabaseAnon.from('crew_member_shifts')
                        .select('id')
                        .eq('member_id', userId)
                        .eq('crew_id', crew_id)
                        .is('clock_out_time', null)
                        .order('clock_in_time', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    if (latestShift) {
                        return supabaseAnon.from('crew_member_shifts').update({ clock_out_time: new Date().toISOString() }).eq('id', latestShift.id);
                    }
                };
                // Update status to offline only if currently online/riding
                if (live_status !== 'offline') {
                    updateData = { live_status: 'offline', last_location: null };
                    userMessage = `✅ *Смена завершена\\.*\nХорошего отдыха\\!`;
                    ownerMessage = `🔴 @${safeUsername} завершил смену в экипаже *'${safeCrewName}'*\\.`;
                } else {
                    // Status already offline, just closing the zombie shift
                    userMessage = `✅ *Остаточная смена закрыта\\.*\nСмена в базе данных была завершена\\.`;
                    ownerMessage = `🔧 @${safeUsername}: закрыл остаточную смену в *'${safeCrewName}'*\\.`;
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
            // Scope update by crew_id to avoid cross-crew contamination when user is in multiple crews
            await supabaseAnon.from("crew_members").update(updateData).eq("user_id", userId).eq("crew_id", crew_id).eq("membership_status", "active");
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