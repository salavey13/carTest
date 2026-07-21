// /app/franchize/server-actions/rental-secrets-claim.ts
"use server";

import { claimRentalSecretsByDocSha, type ClaimResult, type UserRentalSecret } from "@/app/lib/user-rental-secrets";
import { supabaseAdmin } from "@/lib/supabase-server";
import { resolveCrewOwnerChatId } from "@/lib/rental-date-utils";
import {
  parseISODate,
  isoDateTimeFromParts,
  addDaysISO,
} from "@/app/franchize/lib/date-utils";

/**
 * Link a rental to the claiming renter when they scan a QR deep-link.
 *
 * Two scenarios:
 *   A) Rental already exists (created by /doc-manual with operator's user_id)
 *      → UPDATE user_id from operator → renter
 *   B) Rental doesn't exist (createRentalFromDocContract failed or wasn't called)
 *      → CREATE new rental with renter's user_id
 *
 * @param secret - The claimed rental secret with renter data
 * @param renterChatId - The renter's Telegram chat_id
 * @returns The rental_id (existing or created), or null if failed
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

    // Get artifact by doc_sha256
    const { data: artifact, error: artifactError } = await (supabaseAdmin as any)
      .schema('private')
      .from('rental_contract_artifacts')
      .select('resolved_bike_id, rental_id, daily_price, rent_start_date, rent_end_date, telegram_chat_id')
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

    // ── Scenario A: Rental already exists (created by /doc-manual) ──
    // Use consolidated RPC for atomic 6-table propagation (rentals, artifacts,
    // secrets, intents, todos, lead_notes). Handles race conditions and
    // idempotent re-propagation for already-claimed-by-this-user cases.
    if (artifact.rental_id) {
      console.log('[rental-secrets-claim] Rental exists, calling claim_rental_by_qr RPC:', artifact.rental_id);

      const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
        'claim_rental_by_qr',
        {
          p_doc_sha256: secret.doc_sha256,
          p_renter_chat_id: renterChatId,
        }
      );

      if (rpcError) {
        console.error('[rental-secrets-claim] RPC failed:', rpcError);
        return null;
      }

      const result = rpcResult as {
        success: boolean;
        rental_id: string | null;
        error: string | null;
        claimed_now: boolean;
      };

      if (!result.success) {
        console.error('[rental-secrets-claim] RPC returned error:', result.error);
        // ALREADY_CLAIMED_BY_OTHER is non-fatal — the rental exists, just not ours
        if (result.error === 'ALREADY_CLAIMED_BY_OTHER') {
          console.log('[rental-secrets-claim] Rental already claimed by another user');
          return artifact.rental_id;
        }
        return null;
      }

      console.log('[rental-secrets-claim] RPC succeeded:', {
        rentalId: result.rental_id,
        claimedNow: result.claimed_now,
      });

      return artifact.rental_id;
    }

    // ── Scenario B: Rental doesn't exist — create it ──
    console.log('[rental-secrets-claim] No rental exists, creating new one for renter');

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

    // FIX: Use strict ISO date parsing. Previously we did
    //   new Date(artifact.rent_start_date)
    // which silently accepted ambiguous DD.MM.YYYY strings (like
    // "09.07.2026") and resolved them to September 7 instead of July 9
    // in some V8 builds — that bug made the catalog show "busy till
    // 07.09.2026" for a 8-9 July rental. `parseISODate` only accepts
    // exact YYYY-MM-DD and returns null for anything else.
    //
    // We also compose an explicit time (10:00 → 10:00 defaults) so the
    // stored ISO timestamp lands on local-noon instead of UTC-midnight,
    // which dodges the MSK-off-by-one display bug.
    const artifactStartISO = parseISODate(artifact.rent_start_date);
    const artifactEndISO = parseISODate(artifact.rent_end_date);

    const startDate = artifactStartISO
      ? new Date(
          // 10:00 local — converts to a clean UTC timestamp that displays
          // as the same calendar date in every reasonable timezone.
          (() => {
            const iso = isoDateTimeFromParts(artifact.rent_start_date!, "10:00");
            return iso ? new Date(iso) : new Date(artifact.rent_start_date + "T10:00:00Z");
          })(),
        )
      : new Date();
    const endDate = artifactEndISO
      ? new Date(
          (() => {
            const iso = isoDateTimeFromParts(artifact.rent_end_date!, "10:00");
            return iso ? new Date(iso) : new Date(artifact.rent_end_date + "T10:00:00Z");
          })(),
        )
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const hours = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60) * 10) / 10;
    const days = Math.max(1, Math.ceil(hours / 24));
    const totalCost = dailyPrice * days;
    // Suppress unused-import warnings for the strict-parse helpers we
    // reference by side-effect above (and the addDaysISO helper used by
    // callers that may extend this file).
    void parseISODate;
    void addDaysISO;

    // Create rental with renter as user_id
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

  // Always try to create/link the rental via the RPC.
  // The RPC (claim_rental_by_qr) is idempotent — safe to call for already-claimed
  // rentals. It atomically updates the secret, rentals, artifacts, todos, intents,
  // and lead_notes. This also re-propagates for any previously half-claimed rentals
  // (see §13.7 #2 fix).
  //
  // createRentalFromClaimedSecret handles two scenarios:
  //   A) Rental exists (artifact.rental_id set) → calls RPC for propagation
  //   B) Rental doesn't exist → creates new rental + links artifact
  let rentalId: string | undefined;
  const createdRentalId = await createRentalFromClaimedSecret(result.secret, chatId);
  if (createdRentalId) {
    rentalId = createdRentalId;
  } else {
    // Fallback: try source_rental_id from secret (pre-claim state, should not happen
    // if RPC succeeded, but keeps backward compat for edge cases)
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