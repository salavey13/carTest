// /app/franchize/server-actions/rental-secrets-claim.ts
"use server";

import { claimRentalSecretsByDocSha, type ClaimResult } from "@/app/lib/user-rental-secrets";

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
  error?: string;
}> {
  if (!chatId || !docSha256) {
    return { ok: false, reason: "error", error: "chatId and docSha256 are required" };
  }

  const result = await claimRentalSecretsByDocSha(chatId, docSha256);

  if (!result.ok) {
    return { ok: false, reason: result.reason, error: result.error };
  }

  // Return only the crew_slug (needed for routing) — NOT the sensitive data
  return {
    ok: true,
    crewSlug: result.secret.crew_slug,
    claimedNow: result.claimedNow,
  };
}