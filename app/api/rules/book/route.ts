import { supabaseAdmin } from '@/hooks/supabase'; // Admin for write
import { NextResponse } from 'next/server';
import { sendComplexMessage } from '@/app/webhook-handlers/actions/sendComplexMessage';
import { escapeTelegramMarkdown } from '@/lib/utils';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    logger.error('[POST /api/rules/book] Supabase admin client unavailable.');
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }

  const body = await request.json();
  const { startIso, endIso, price, extras, sessionType, riggerId = null, notes, userId } = body;

  try {
    // Check overlap для rig и rigger (если есть)
    let overlapQuery = supabaseAdmin.from('rentals').select('*').eq('vehicle_id', 'rule-cube-basic');
    if (riggerId) overlapQuery = overlapQuery.eq('metadata->>rigger_id', riggerId);
    overlapQuery = overlapQuery.lt('requested_start_date', endIso).gt('requested_end_date', startIso);

    const { data: overlaps } = await overlapQuery;
    if (overlaps?.length) throw new Error('Overlap detected');

    // Create booking
    const { data: rental } = await supabaseAdmin.rpc('createBooking', {
      p_user_id: userId,
      p_vehicle_id: 'rule-cube-basic',
      p_start_date: startIso,
      p_end_date: endIso,
      p_price: price,
    });

    const rentalId = rental.rental_id;

    // Update metadata
    await supabaseAdmin.from('rentals').update({
      metadata: {
        type: 'rule',
        rule_id: 'rule-cube-basic',
        extras,
        session_type: sessionType,
        rigger_id: riggerId,
        notes,
      },
    }).eq('rental_id', rentalId);

    // 1% XTR invoice
    const amount = Math.round(price * 0.01 * 100);
    const { data: invoice } = await supabaseAdmin.rpc('create_invoice', {
      p_type: 'rule_booking',
      p_id: `rule_${rentalId}`,
      p_user_id: userId,
      p_amount: amount,
      p_subscription_id: rentalId,
      p_metadata: { sessionType, price, deposit: amount / 100 },
    });

    // Send invoice to user
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendInvoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: userId,
        title: 'Rule Deposit',
        description: `1% for ${price} RUB session`,
        payload: rentalId,
        provider_token: process.env.TELEGRAM_PROVIDER_TOKEN,
        currency: 'XTR',
        prices: [{ label: 'Deposit', amount }],
      }),
    });

    // Rich notifs
    const summaryMd = escapeTelegramMarkdown(`**Booking:** ${sessionType}\n**Time:** ${startIso} - ${endIso}\n**Rigger:** ${riggerId || 'None'}\n**Price:** ${price} RUB\n**Deposit:** ${amount / 100} XTR`);

    // User notif
    await sendComplexMessage(userId, `${summaryMd}\nPay deposit below.`, [], { parseMode: 'MarkdownV2' });

    // Admin notif
    await sendComplexMessage(process.env.ADMIN_CHAT_ID, `${summaryMd}\nApprove?`, [[{ text: '/approve_' + rentalId }, { text: '/decline_' + rentalId }]], { keyboardType: 'reply' });

    // Rigger notif if set
    if (riggerId) {
      const { data: rigger } = await supabaseAdmin.from('users').select('user_id').eq('metadata->>rigger_id', riggerId).single();
      if (rigger) await sendComplexMessage(rigger.user_id, `${summaryMd}\nAccept?`, [[{ text: '/accept_' + rentalId }, { text: '/decline_' + rentalId }]], { keyboardType: 'reply' });
    }

    return NextResponse.json({ success: true, rentalId });
  } catch (error) {
    logger.error('[POST /api/rules/book]', error);
    return NextResponse.json({ error: 'Booking failed' }, { status: 500 });
  }
}