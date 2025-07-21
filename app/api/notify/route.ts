import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { getBaseUrl } from "@/lib/utils";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
    const authorization = request.headers.get('Authorization');
    if (authorization !== `Bearer ${CRON_SECRET}`) {
        logger.warn('Unauthorized attempt to access internal notify API.');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const eventData = await request.json();
        logger.info("[Notify API] Received event from DB trigger:", eventData);
        
        const { rental_id, event_type, created_by, payload } = eventData;
        
        const { data: rentalContext, error } = await supabaseAdmin
            .from('rentals')
            .select(`
                user_id,
                owner_id,
                vehicle:cars (make, model, crew_id),
                renter:rentals_user_id_fkey (username),
                owner:rentals_owner_id_fkey (username)
            `)
            .eq('rental_id', rental_id)
            .single();
        
        if (error || !rentalContext) {
            throw new Error(`Failed to fetch rental context for rental_id ${rental_id}: ${error?.message}`);
        }

        const { vehicle, renter, owner, owner_id } = rentalContext;
        let notification_text = '';
        const recipient_ids = new Set<string>();
        let action_link_slug = 'view';
        let action_button_text = '🚨 К Событию';
        let doNotNotifyCreator = true;

        switch(event_type) {
            case 'sos_fuel':
            case 'sos_evac':
            case 'hustle_pickup':
                const isFuel = event_type === 'sos_fuel';
                const title = isFuel ? '⛽️ *SOS: Запрос Топлива* ⛽️' : event_type === 'sos_evac' ? '🛠️ *SOS: Запрос Эвакуации* 🛠️' : '棄 *Hustle: Перехват* 棄';
                const verb = isFuel ? 'запрашивает дозаправку' : event_type === 'sos_evac' ? 'возникла проблема с' : 'оставил';
                notification_text = `${title}\n\nАрендатор @${renter?.username || created_by} ${verb} ${vehicle?.make} ${vehicle?.model}.\n\nНаграда: *${payload?.xtr_amount || 'N/A'} XTR*`;
                recipient_ids.add(owner_id);

                if (vehicle?.crew_id) {
                    const { data: members, error: memberError } = await supabaseAdmin
                        .from('crew_members')
                        .select('user_id')
                        .eq('crew_id', vehicle.crew_id);
                    if (memberError) logger.error(`[Notify API] Failed to fetch crew members for crew ${vehicle.crew_id}`, memberError);
                    else members?.forEach(m => recipient_ids.add(m.user_id));
                }
                action_link_slug = 'accept-hustle';
                action_button_text = '💰 Принять Вызов';
                break;
            
            case 'photo_start':
                 notification_text = `📸 Арендатор @${renter?.username || created_by} добавил фото "ДО" для ${vehicle?.make} ${vehicle?.model}. Необходимо ваше подтверждение.`;
                 recipient_ids.add(owner_id);
                 action_link_slug = 'confirm-pickup';
                 action_button_text = "✅ Подтвердить получение";
                break;
            
            case 'pickup_confirmed':
                notification_text = `✅ Владелец @${owner?.username || owner_id} подтвердил получение ${vehicle?.make} ${vehicle?.model}. Ваша аренда *активна*. Приятной поездки!`;
                recipient_ids.add(rentalContext.user_id);
                action_link_slug = 'view';
                action_button_text = 'К Управлению Арендой';
                break;

            // Add more cases for other event types like 'photo_end', 'pickup_confirmed' etc.
            default:
                logger.warn(`[Notify API] No handler for event type: ${event_type}`);
                return NextResponse.json({ ok: true, message: "No handler for event type" });
        }
        
        const deep_link_url = `${getBaseUrl()}/app?startapp=rental_${action_link_slug}_${rental_id}`;

        for (const recipientId of Array.from(recipient_ids)) {
             if (doNotNotifyCreator && recipientId === created_by) continue; // Don't notify the person who created the event
            await sendComplexMessage(
                recipientId,
                notification_text,
                [[{ text: action_button_text, url: deep_link_url }]]
            );
        }

        return NextResponse.json({ ok: true, message: "Notifications dispatched." });

    } catch (error) {
        logger.error("!!! CRITICAL ERROR IN NOTIFY API !!!", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}