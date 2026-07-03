// /app/franchize/server-actions/rental-secrets-claim.ts
"use server";

import { claimRentalSecretsByDocSha, type ClaimResult, type UserRentalSecret } from "@/app/lib/user-rental-secrets";
import { supabaseAdmin } from "@/lib/supabase-server";
import { resolveCrewOwnerChatId } from "@/lib/rental-date-utils";

/**
 * Create a rental in public.rentals when a renter claims a QR deep-link.
 * This links the renter to the bike and creates a trackable rental record.
 *
 * @param secret - The claimed rental secret with renter data
 * @param renterChatId - The renter's Telegram chat_id
 * @returns The created rental_id, or null if failed
 */
async function createRentalFromClaimedSecret(
  secret: UserRentalSecret,
  renterChatId: string
): Promise<string | null> {
  try {
    console.log('[rental-secrets-claim] createRentalFromClaimedSecret: starting', {
      docSha256: secret.doc_sha256.slice(0, 12),
      renterChatId,
      crewSlug: secret.crew_slug,
    });

    // Get bike_id from rental_contract_artifacts
    const { data: artifact, error: artifactError } = await (supabaseAdmin as any)
      .schema('private')
      .from('rental_contract_artifacts')
      .select('resolved_bike_id, rental_id, daily_price, rent_start_date, rent_end_date')
      .eq('original_sha256', secret.doc_sha256)
      .maybeSingle();

    if (artifactError) {
      console.error('[rental-secrets-claim] Failed to fetch artifact:', artifactError);
      return null;
    }

    if (!artifact?.resolved_bike_id) {
      console.error('[rental-secrets-claim] No bike_id in artifact');
      return null;
    }

    // If rental already exists, return it
    if (artifact.rental_id) {
      console.log('[rental-secrets-claim] Rental already exists:', artifact.rental_id);
      return artifact.rental_id;
    }

    // Get crew_id from bike
    const { data: bike, error: bikeError } = await supabaseAdmin
      .from('cars')
      .select('crew_id, specs')
      .eq('id', artifact.resolved_bike_id)
      .maybeSingle();

    if (bikeError || !bike) {
      console.error('[rental-secrets-claim] Failed to fetch bike:', bikeError);
      return null;
    }

    // Get crew owner for owner_id
    const crewOwnerChatId = await resolveCrewOwnerChatId(supabaseAdmin, bike.crew_id);
    if (!crewOwnerChatId) {
      console.error('[rental-secrets-claim] No crew owner found for crew_id:', bike.crew_id);
      return null;
    }

    // Calculate dates and pricing
    const dailyPrice = Number(artifact.daily_price || bike.specs?.dailyPrice || bike.specs?.rent_weekday || '10000');
    
    // Use dates from artifact if available, otherwise use current date + 1 day
    const startDate = artifact.rent_start_date 
      ? new Date(artifact.rent_start_date)
      : new Date();
    const endDate = artifact.rent_end_date
      ? new Date(artifact.rent_end_date)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const hours = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60) * 10) / 10;
    const days = Math.max(1, Math.ceil(hours / 24));
    const totalCost = dailyPrice * days;

    // Create rental
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from('rentals')
      .insert({
        user_id: renterChatId,
        owner_id: crewOwnerChatId,
        vehicle_id: artifact.resolved_bike_id,
        requested_start_date: startDate.toISOString(),
        requested_end_date: endDate.toISOString(),
        agreed_start_date: startDate.toISOString(),
        agreed_end_date: endDate.toISOString(),
        status: 'active',
        payment_status: 'fully_paid',
        total_cost: Math.round(totalCost),
        metadata: {
          source: 'qr_claim',
          daily_price: dailyPrice,
          doc_sha256: secret.doc_sha256,
          claimed_at: new Date().toISOString(),
        },
      })
      .select('rental_id')
      .maybeSingle();

    if (rentalError) {
      console.error('[rental-secrets-claim] Failed to create rental:', rentalError);
      return null;
    }

    if (!rental?.rental_id) {
      console.error('[rental-secrets-claim] No rental_id returned');
      return null;
    }

    console.log('[rental-secrets-claim] Created rental:', rental.rental_id);

    // Update rental_contract_artifacts with rental_id
    await (supabaseAdmin as any)
      .schema('private')
      .from('rental_contract_artifacts')
      .update({ rental_id: rental.rental_id })
      .eq('original_sha256', secret.doc_sha256);

    // Update user_rental_secrets with source_rental_id
    await (supabaseAdmin as any)
      .schema('private')
      .from('user_rental_secrets')
      .update({ source_rental_id: rental.rental_id })
      .eq('doc_sha256', secret.doc_sha256);

    return rental.rental_id;
  } catch (error) {
    console.error('[rental-secrets-claim] createRentalFromClaimedSecret exception:', error);
    return null;
  }
}

/**
 * Server action wrapper for the QR deep-link claim flow.
 *
 * Called from the client-side useStartParamRouter when a user opens
 * a QR deep-link like: rent_{bikeId}_{docSha256}
 *
 * This is the ONLY client-callable entry point for claiming rental secrets.
 * The underlying claimRentalSecretsByDocSha uses supabaseAdmin (service_role)
 * to access the private schema — client code never touches private data directly.
 *
 * Returns a sanitized result without exposing the full secret data to the client.
 * The actual secret fields (passport, license, etc.) are stored in AppContext
 * server-side and used to pre-fill the checkout form via a separate action.
 */
export async function claimRentalSecretsAction(
  chatId: string,
  docSha256: string,
): Promise<{
  ok: boolean;
  reason?: ClaimResult["reason"];
  /** Crew slug from the claimed secret (needed for routing) */
  crewSlug?: string;
  /** Whether this was a fresh claim (first time linking) */
  claimedNow?: boolean;
  /** Rental ID created or linked during claim */
  rentalId?: string;
  error?: string;
}> {
  if (!chatId || !docSha256) {
    return { ok: false, reason: "error", error: "chatId and docSha256 are required" };
  }

  const result = await claimRentalSecretsByDocSha(chatId, docSha256);

  if (!result.ok) {
    return { ok: false, reason: result.reason, error: result.error };
  }

  // If this was a fresh claim, create rental in public.rentals
  let rentalId: string | undefined;
  if (result.claimedNow) {
    const createdRentalId = await createRentalFromClaimedSecret(result.secret, chatId);
    if (createdRentalId) {
      rentalId = createdRentalId;
    }
  } else {
    // Already claimed — try to get existing rental_id from secret
    rentalId = result.secret.source_rental_id || undefined;
  }

  // Return only the crew_slug (needed for routing) — NOT the sensitive data
  return {
    ok: true,
    crewSlug: result.secret.crew_slug,
    claimedNow: result.claimedNow,
    rentalId,
  };
}