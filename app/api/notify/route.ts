import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { getBaseUrl } from "@/lib/utils";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
    // 1. Authenticate the request from our own database trigger
    const authorization = request.headers.get('Authorization');
    if (authorization !== `Bearer ${CRON_SECRET}`) {
        logger.warn('Unauthorized attempt to access internal notify API.');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const eventData = await request.json();
        logger.info("[Notify API] Received event from DB trigger:", eventData);
        
        const { rental_id, event_type, created_by, payload } = eventData;
        
        // 2. Fetch all necessary context for the notification
        const { data: rentalContext, error } = await supabaseAdmin
            .from('rentals')
            .select(`
                user_id,
                owner_id,
                vehicle:cars (make, model, crew_id),
                renter:users (username),
                owner:users (username)
            `)
            .eq('rental_id', rental_id)
            .single();
        
        if (error || !rentalContext) {
            throw new Error(`Failed to fetch rental context for rental_id ${rental_id}: ${error?.message}`);
        }

        const { vehicle, renter, owner, owner_id } = rentalContext;
        const deep_link_url = `${getBaseUrl()}/app?startapp=rental_view_${rental_id}`;
        let notification_text = '';
        let recipient_ids: string[] = [];
        
        // 3. Craft message and determine recipients based on event type
        switch(event_type) {
            case 'sos_fuel':
                notification_text = `⛽️ *SOS: Запрос Топлива* ⛽️\n\nАрендатор @${renter?.username || created_by} запрашивает дозаправку для ${vehicle?.make} ${vehicle?.model}.\n\nНаграда: *${payload?.xtr_amount || 'N/A'} XTR*`;
                recipient_ids.push(owner_id);
                // TODO: Fetch and add crew members
                break;
            case 'sos_evac':
                 notification_text = `🛠️ *SOS: Запрос Эвакуации* 🛠️\n\nУ арендатора @${renter?.username || created_by} возникла проблема с ${vehicle?.make} ${vehicle?.model}.\n\nНаграда: *${payload?.xtr_amount || 'N/A'} XTR*`;
                 recipient_ids.push(owner_id);
                 // TODO: Fetch and add crew members
                break;
            // Add more cases for other event types like 'photo_uploaded', 'pickup_confirmed' etc.
            default:
                logger.warn(`[Notify API] No handler for event type: ${event_type}`);
                return NextResponse.json({ ok: true, message: "No handler for event type" });
        }

        // 4. Dispatch notifications
        for (const recipientId of recipient_ids) {
            await sendComplexMessage(
                recipientId,
                notification_text,
                [[{ text: '🚨 К Событию', url: deep_link_url }]]
            );
        }

        return NextResponse.json({ ok: true, message: "Notifications dispatched." });

    } catch (error) {
        logger.error("!!! CRITICAL ERROR IN NOTIFY API !!!", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}