// /app/franchize/server-actions/submit-contract-draft.ts
"use server";

import { createClient } from '@supabase/supabase-js';
import type {
  SubmitContractDraftInput,
  SubmitContractDraftResult,
  ContractDraftData,
} from '../lib/rental-contract-types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Submit contract draft for crew owner approval
 *
 * 1. Validate user is the renter
 * 2. Save draft to rental.metadata
 * 3. Send Telegram message to crew owner with approve/decline buttons
 */
export async function submitContractDraft(
  input: SubmitContractDraftInput
): Promise<SubmitContractDraftResult> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
  const draftId = `draft-${input.rentalId}-${Date.now()}`;

  try {
    // 1. Fetch rental and verify user is the renter
    const { data: rental } = await supabase
      .from('rentals')
      .select('*, crew:crews(id, owner_id, slug)')
      .eq('rental_id', input.rentalId)
      .single();

    if (!rental) {
      return { success: false, error: `Rental not found: ${input.rentalId}` };
    }

    if (rental.user_id !== input.actorTelegramUserId) {
      return { success: false, error: 'Only the renter can submit contract drafts' };
    }

    // 2. Save draft to rental.metadata
    const contractDraft: ContractDraftData = {
      status: 'pending',
      submitted_at: new Date().toISOString(),
      submitted_by: input.actorTelegramUserId,
      renterData: input.renterData,
      equipmentData: input.equipmentData,
      pickupData: input.pickupData,
    };

    const { error: updateError } = await supabase
      .from('rentals')
      .update({
        metadata: {
          ...(rental.metadata || {}),
          contract_draft: contractDraft,
        },
      })
      .eq('rental_id', input.rentalId);

    if (updateError) {
      return { success: false, error: `Failed to save draft: ${updateError.message}` };
    }

    // 3. Send Telegram approval request to crew owner
    const crewOwnerChatId = rental.crew.owner_id;

    if (crewOwnerChatId) {
      // Draft details link for web UI review
      const draftDetailsUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/franchize/${input.crewSlug}/contract-draft/${input.rentalId}`;

      const message = `
📄 <b>Запрос на утверждение договора аренды</b>

<b>Арендатор:</b> ${input.renterData.full_name}
<b>Паспорт:</b> ${input.renterData.passport}
<b>Дата начала:</b> ${rental.requested_start_date || rental.agreed_start_date}
<b>Дата окончания:</b> ${rental.requested_end_date || rental.agreed_end_date}

<b>Оборудование:</b>
• Ключи: ${input.equipmentData.keys_count} шт.
• Шлемы: ${input.equipmentData.helmets_count} шт.
${input.equipmentData.charger ? '• Зарядка\n' : ''}${input.equipmentData.lock ? '• Замок\n' : ''}

<b>Примечания при выдаче:</b>
${input.pickupData.damage_notes_at_delivery}

—
Откройте в браузере для подробностей:
${draftDetailsUrl}
`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '📄 Открыть в браузере', url: draftDetailsUrl },
          ],
          [
            { text: '✓ Утвердить', callback_data: `approve_contract:${input.rentalId}:${draftId}` },
            { text: '✗ Отклонить', callback_data: `decline_contract:${input.rentalId}:${draftId}` },
          ],
        ],
      };

      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: crewOwnerChatId,
          text: message,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        }),
      });

      if (!response.ok) {
        console.error('[submitContractDraft] Failed to send Telegram message');
      }
    }

    return {
      success: true,
      draftId,
      approvalRequestSent: Boolean(crewOwnerChatId),
    };

  } catch (error) {
    console.error('[submitContractDraft] Error:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
