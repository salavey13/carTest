// /app/franchize/server-actions/rental-ownership-check.ts
"use server";

import { createClient } from '@supabase/supabase-js';

interface RentalOwnershipInput {
  bikeId: string;
  docSha256: string;
  actorTelegramUserId: string;
}

interface RentalOwnershipResult {
  success: true;
  isOwner: boolean;
  rentalId?: string;
  crewSlug?: string;
}

interface RentalOwnershipError {
  success: false;
  error: string;
}

/**
 * Check if the current user is the crew owner for a bike and find the associated rental.
 *
 * This is used when a QR code (rent_{bikeId}_{docSha256}) is scanned:
 * - If the user is the crew owner, route them to the contract-draft page
 * - Otherwise, route them to the regular bike checkout page
 */
export async function checkRentalOwnershipForQr(
  input: RentalOwnershipInput
): Promise<RentalOwnershipResult | RentalOwnershipError> {
  const { bikeId, docSha256, actorTelegramUserId } = input;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Step 1: Find crew that owns this bike
    const { data: bike } = await supabase
      .from('cars')
      .select('crew_id')
      .eq('id', bikeId)
      .single();

    if (!bike) {
      return { success: true, isOwner: false };
    }

    // Step 2: Check if user is owner of this crew
    const { data: crewMember } = await supabase
      .from('crew_members')
      .select('user_id, role, crew_id')
      .eq('user_id', actorTelegramUserId)
      .eq('crew_id', bike.crew_id)
      .maybeSingle();

    const isOwner = crewMember?.role === 'owner';

    if (!isOwner) {
      return { success: true, isOwner: false };
    }

    // Get crew slug for routing
    const { data: crew } = await supabase
      .from('crews')
      .select('slug')
      .eq('id', bike.crew_id)
      .single();

    if (!crew) {
      return { success: true, isOwner: false };
    }

    // Step 3: Find rental by contract_key (derived from docSha256)
    // The contract_key is stored in rental.metadata.contract_key
    const { data: rental } = await supabase
      .from('rentals')
      .select('rental_id')
      .eq('metadata->>contract_key', docSha256)
      .maybeSingle();

    if (!rental) {
      // Owner but no rental found yet (draft not submitted)
      return { success: true, isOwner: true, crewSlug: crew.slug };
    }

    return {
      success: true,
      isOwner: true,
      rentalId: rental.rental_id,
      crewSlug: crew.slug,
    };
  } catch (error) {
    console.error('[checkRentalOwnershipForQr] Error:', error);
    return { success: false, error: 'Failed to check ownership' };
  }
}
