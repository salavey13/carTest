// /app/franchize/server-actions/approve-contract.ts
"use server";

import { createClient } from '@supabase/supabase-js';
import type {
  ApproveContractInput,
  ApproveContractResult,
} from '../lib/rental-contract-types';
import { buildTemplateVars } from '../lib/rental-contract-vars';
import {
  renderTemplateToDocx,
  uploadDocxToStorage,
  sendDocxViaTelegram,
} from '../lib/docx-capability';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Approve contract draft and generate DOCX
 *
 * 1. Verify actor is crew owner
 * 2. Fetch draft from rental.metadata
 * 3. Fetch crew secrets, bike specs
 * 4. Build template vars, render to DOCX
 * 5. Upload to storage (with crew owner's permissions)
 * 6. Save to rental_contract_artifacts
 * 7. Send to both parties via Telegram
 * 8. Update draft status
 */
export async function approveContract(
  input: ApproveContractInput
): Promise<ApproveContractResult> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
  const contractKey = `rental-${input.bikeId || input.rentalId}-${Date.now()}`;

  try {
    // First get crew id from slug
    const { data: crew } = await supabase
      .from('crews')
      .select('id')
      .eq('slug', input.crewSlug)
      .single();

    if (!crew) {
      return { success: false, error: `Crew not found: ${input.crewSlug}` };
    }

    // 1. Verify actor is crew owner
    const { data: crewMember } = await supabase
      .from('crew_members')
      .select('user_id, role, crew_id')
      .eq('user_id', input.actorTelegramUserId)
      .eq('crew_id', crew.id)
      .maybeSingle();

    if (!crewMember || crewMember.role !== 'owner') {
      return { success: false, error: 'Only crew owner can approve contracts' };
    }

    // 2. Fetch rental with draft
    const { data: rental } = await supabase
      .from('rentals')
      .select('*, vehicle:cars(*), crew:crews(*)')
      .eq('rental_id', input.rentalId)
      .single();

    if (!rental) {
      return { success: false, error: `Rental not found: ${input.rentalId}` };
    }

    const draft = rental.metadata?.contract_draft;
    if (!draft || draft.status !== 'pending') {
      return { success: false, error: 'No pending contract draft found' };
    }

    // 3. Fetch crew secrets
    const { data: crewSecrets } = await supabase
      .schema('private')
      .from('crew_secrets')
      .select('contract_defaults')
      .eq('crew_slug', input.crewSlug)
      .maybeSingle();

    const orgSecrets = crewSecrets?.contract_defaults
      ? (typeof crewSecrets.contract_defaults === 'string'
          ? JSON.parse(crewSecrets.contract_defaults)
          : crewSecrets.contract_defaults)
      : {};

    const bike = rental.vehicle;

    // 4. Build template vars
    const dates = {
      start: formatDateRu(new Date(rental.agreed_start_date || rental.requested_start_date)),
      startTime: formatTimeRu(new Date(rental.agreed_start_date || rental.requested_start_date)),
      end: formatDateRu(new Date(rental.agreed_end_date || rental.requested_end_date)),
      endTime: formatTimeRu(new Date(rental.agreed_end_date || rental.requested_end_date)),
    };

    const contractDefaults = {
      includedMileage: 200,
      overageRate: 35,
      lateReturnPenaltyRub: 10000,
    };

    const templateVars = await buildTemplateVars({
      crewSlug: input.crewSlug,
      bike: {
        id: bike.id,
        make: bike.make,
        model: bike.model,
        specs: bike.specs || {},
        type: bike.type,
      },
      crewSecrets: orgSecrets,
      contractDefaults,
      dates,
      renterData: draft.renterData,
      equipmentData: draft.equipmentData,
      pickupData: draft.pickupData,
    });

    // 5. Render to DOCX
    const { buffer, sha256 } = await renderTemplateToDocx(
      templateVars as unknown as Record<string, string>
    );

    // 6. Upload to storage
    const { storagePath, downloadUrl } = await uploadDocxToStorage({
      crewSlug: input.crewSlug,
      contractKey,
      buffer,
      metadata: { crew_id: crewMember.crew_id },
    });

    // 7. Save to rental_contract_artifacts
    const { error: artifactError } = await supabase
      .from('rental_contract_artifacts')
      .insert({
        contract_key: contractKey,
        requested_bike_id: rental.vehicle_id,
        resolved_bike_id: bike.id,
        telegram_chat_id: draft.submitted_by,
        renter_full_name: draft.renterData.full_name,
        rent_start_date: dates.start,
        rent_end_date: dates.end,
        original_sha256: sha256,
        rental_id: input.rentalId,
        storage_path: storagePath,
        crew_id: crewMember.crew_id,
      });

    if (artifactError) {
      console.error('[approveContract] Failed to save artifact:', artifactError);
    }

    // 8. Send to Telegram (renter + crew owner)
    const filename = `rental-contract-${bike.make}-${bike.model}-${dates.start}.docx`;
    const caption = `✅ <b>Договор аренды утвержден</b>\n${bike.make} ${bike.model}\n${dates.start} — ${dates.end}\n\nСкачать: ${downloadUrl}`;

    await sendDocxViaTelegram({
      buffer,
      filename,
      chatIds: [draft.submitted_by, input.actorTelegramUserId],
      caption,
    });

    // 9. Update draft status
    const { error: updateError } = await supabase
      .from('rentals')
      .update({
        metadata: {
          ...rental.metadata,
          contract_draft: { ...draft, status: 'approved' as const },
          contract_key: contractKey,
          contract_sha256: sha256,
        },
      })
      .eq('rental_id', input.rentalId);

    if (updateError) {
      console.error('[approveContract] Failed to update rental metadata:', updateError);
    }

    return {
      success: true,
      downloadUrl,
      storagePath,
      contractKey,
      sha256,
    };

  } catch (error) {
    console.error('[approveContract] Error:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

function formatDateRu(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

function formatTimeRu(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
