"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-server";
import { sendComplexMessage } from "../actions/sendComplexMessage";

export async function shiftCommand(chatId: number, userId: string, username?: string, action?: string) {
    logger.info(`[Shift Command EXEC] User ${userId}, Action: ${action || 'request_keyboard'}`);
    
    try {
        // Use supabaseAdmin (service role) — this is a server-side webhook handler.
        // supabaseAnon was used before, but RLS blocks anon writes to crew_members
        // and crew_member_shifts, causing silent failures (shift not created, live_status not updated).
        // Use .limit(1) instead of .single() — users can be active members of multiple crews.
        const { data: crewMembers, error: crewError } = await supabaseAdmin
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
        const displayName = username || 'user';

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
        let shiftLogAction: (() => Promise<any>) | null = null;

        switch (action) {
            case 'clock_in':
                if (live_status === 'offline') {
                    updateData = { live_status: 'online' };
                    userMessage = "✅ Смена начата. Время пошло.";
                    ownerMessage = `🟢 @${displayName} начал смену в экипаже «${crewName}».`;
                    shiftLogAction = () => supabaseAdmin.from('crew_member_shifts').insert({
                        member_id: userId,
                        crew_id: crew_id,
                        clock_in_time: new Date().toISOString(),
                        hourly_rate: 169,
                    });
                }
                break;
            case 'clock_out':
                // Always try to close the shift, regardless of live_status
                shiftLogAction = async () => {
                    const { data: latestShift } = await supabaseAdmin.from('crew_member_shifts')
                        .select('id')
                        .eq('member_id', userId)
                        .eq('crew_id', crew_id)
                        .is('clock_out_time', null)
                        .order('clock_in_time', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    if (latestShift) {
                        // Calculate duration and salary
                        const { data: shiftData } = await supabaseAdmin.from('crew_member_shifts')
                            .select('clock_in_time, hourly_rate')
                            .eq('id', latestShift.id)
                            .single();
                        if (shiftData) {
                            const clockIn = new Date(shiftData.clock_in_time).getTime();
                            const clockOut = Date.now();
                            const durationMinutes = Math.round((clockOut - clockIn) / 60000);
                            const rate = shiftData.hourly_rate || 169;
                            const salaryAmount = (durationMinutes / 60) * rate;
                            return supabaseAdmin.from('crew_member_shifts').update({
                                clock_out_time: new Date().toISOString(),
                                duration_minutes: durationMinutes,
                                salary_amount: Math.round(salaryAmount * 100) / 100,
                            }).eq('id', latestShift.id);
                        }
                        return supabaseAdmin.from('crew_member_shifts').update({ clock_out_time: new Date().toISOString() }).eq('id', latestShift.id);
                    }
                };
                if (live_status !== 'offline') {
                    updateData = { live_status: 'offline', last_location: null };
                    userMessage = "✅ Смена завершена.\nХорошего отдыха!";
                    ownerMessage = `🔴 @${displayName} завершил смену в экипаже «${crewName}».`;
                } else {
                    userMessage = "✅ Остаточная смена закрыта.\nСмена в базе данных была завершена.";
                    ownerMessage = `🔧 @${displayName}: закрыл остаточную смену в «${crewName}».`;
                }
                break;
            case 'toggle_ride':
                if (live_status !== 'offline') {
                    const newStatus = live_status === 'online' ? 'riding' : 'online';
                    updateData = { live_status: newStatus };
                    if (newStatus === 'riding') {
                        userMessage = "🏍️ Статус: На Байке. Теперь отправьте свою геолокацию, чтобы появиться на карте экипажа.";
                    } else {
                        updateData.last_location = null;
                        userMessage = "🏢 Статус: Онлайн. Снова в боксе, с карты убраны.";
                    }
                    ownerMessage = `⚙️ Статус @${displayName} в «${crewName}»: ${newStatus === 'riding' ? "На Байке" : "Онлайн"}`;
                }
                break;
        }
        
        if (Object.keys(updateData).length > 0 || shiftLogAction) {
            // Use supabaseAdmin for writes — RLS blocks anon writes
            if (Object.keys(updateData).length > 0) {
                await supabaseAdmin.from("crew_members").update(updateData).eq("user_id", userId).eq("crew_id", crew_id).eq("membership_status", "active");
            }
            if (shiftLogAction) await shiftLogAction();
            
            // Send messages as plain text (no MarkdownV2 — avoids escaping bugs)
            if (userMessage) {
                await sendComplexMessage(chatId, userMessage, [], { removeKeyboard: true });
            }

            if (ownerId && ownerId !== userId && ownerMessage) {
                await sendComplexMessage(ownerId, ownerMessage, []);
            }
        } else {
            await sendComplexMessage(chatId, "Действие не выполнено (статус уже актуален).", [], { removeKeyboard: true });
        }

    } catch (e: any) {
        logger.error(`[Shift Command FATAL] for user ${userId}:`, e);
        await sendComplexMessage(chatId, `🚨 Критическая ошибка в системе смен: ${e.message}`);
    }
}
