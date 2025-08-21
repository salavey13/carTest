import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendComplexMessage } from '@/app/webhook-handlers/actions/sendComplexMessage';
import { escapeTelegramMarkdown } from '@/lib/utils';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const body = await request.json();
  const { status, action } = body; // action from command: approve/decline/accept/decline

  try {
    const { data: rental } = await supabase.from('rentals').select('*').eq('rental_id', params.id).single();
    if (!rental) throw new Error('Rental not found');

    await supabase.from('rentals').update({ status }).eq('rental_id', params.id);

    const summaryMd = escapeTelegramMarkdown(`**Update:** ${status}\n**Booking:** ${rental.metadata.session_type}\n**Time:** ${rental.requested_start_date} - ${rental.requested_end_date}`);

    if (['approved', 'confirmed'].includes(status)) {
      await sendComplexMessage(rental.user_id, `${summaryMd}\nApproved!`, [], { imageQuery: 'rule-confirmed', parseMode: 'MarkdownV2' });
      if (rental.metadata.rigger_id) await sendComplexMessage(rental.metadata.rigger_id, summaryMd, [], { parseMode: 'MarkdownV2' });
    } else if (status === 'cancelled' || action === 'decline') {
      // Refund
      await supabase.rpc('update_invoice_status', { p_id: `rule_${params.id}`, p_status: 'refunded' });
      await sendComplexMessage(rental.user_id, `${summaryMd}\nRefund initiated.`, [], { parseMode: 'MarkdownV2' });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PATCH /api/rentals/[id]]', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}