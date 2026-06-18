// /app/franchize/server-actions/decline-contract.ts
"use server";

import { createClient } from '@supabase/supabase-js';
import type {
  DeclineContractInput,
  DeclineContractResult,
} from '../lib/rental-contract-types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Decline contract draft
 *
 * 1. Verify actor is crew owner
 * 2. Update draft status to declined
 * 3. Notify renter via Telegram
 */
export async function declineContract(
  input: DeclineContractInput
): Promise<DeclineContractResult> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

  try {
    // 1. Verify actor is crew owner
    const { data: crewMember } = await supabase
      .from('crew_members')
      .select('user_id, role, crew_id')
      .eq('user_id', input.actorTelegramUserId)
      .eq('role', 'owner')
      .maybeSingle();

    if (!crewMember) {
      return { success: false, error: 'Only crew owner can decline contracts' };
    }

    // 2. Fetch rental with draft and crew_id
    const { data: rental } = await supabase
      .from('rentals')
      .select('metadata, user_id, crew_id')
      .eq('rental_id', input.rentalId)
      .single();

    if (!rental) {
      return { success: false, error: `Rental not found: ${input.rentalId}` };
    }

    const draft = rental.metadata?.contract_draft;
    if (!draft || draft.status !== 'pending') {
      return { success: false, error: 'No pending contract draft found' };
    }

    // Verify the rental belongs to the owner's crew
    if (rental.crew_id && rental.crew_id !== crewMember.crew_id) {
      return { success: false, error: 'Rental does not belong to your crew' };
    }

    // 3. Update draft status
    const { error: updateError } = await supabase
      .from('rentals')
      .update({
        metadata: {
          ...rental.metadata,
          contract_draft: { ...draft, status: 'declined' as const },
        },
      })
      .eq('rental_id', input.rentalId);

    if (updateError) {
      return { success: false, error: `Failed to update draft: ${updateError.message}` };
    }

    // 4. Notify renter
    const message = `
❌ <b>Запрос на договор отклонен</b>

${input.reason ? `<b>Причина:</b> ${input.reason}` : ''}

Пожалуйста, свяжитесь с владельцем техники для уточнения деталей.
`.trim();

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: rental.user_id,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      console.error('[declineContract] Failed to send Telegram message');
    }

    return { success: true };

  } catch (error) {
    console.error('[declineContract] Error:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
