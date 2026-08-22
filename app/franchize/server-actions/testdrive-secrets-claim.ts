// /app/franchize/server-actions/testdrive-secrets-claim.ts
"use server";

import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * Server action wrapper for the testdrive QR deep-link claim flow.
 *
 * Called from the client-side useStartParamRouter when a user opens
 * a QR deep-link like: testdrive_{bikeId}_{docSha256}
 *
 * This is the client-callable entry point for claiming testdrive secrets.
 * The underlying claim_testdrive_by_qr RPC uses SECURITY DEFINER + service_role
 * to access the private schema — client code never touches private data directly.
 *
 * The RPC atomically updates 3 tables:
 *   1. private.testdrive_contract_artifacts.telegram_chat_id → renter's chat_id
 *   2. private.user_rental_secrets.chat_id → renter's chat_id
 *   3. public.franchize_intents.telegram_user_id → renter's chat_id
 *
 * Returns a sanitized result without exposing the full secret data to the client.
 */
export async function claimTestdriveSecretsAction(
  renterChatId: string,
  docSha256: string,
): Promise<{
  ok: boolean;
  status?: string;
  crewSlug?: string;
  customerName?: string;
  customerPhone?: string;
  error?: string;
}> {
  if (!renterChatId || !docSha256) {
    return { ok: false, error: "renterChatId and docSha256 are required" };
  }

  try {
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      "claim_testdrive_by_qr",
      {
        p_doc_sha256: docSha256,
        p_renter_chat_id: renterChatId,
      }
    );

    if (rpcError) {
      console.error("[testdrive-secrets-claim] RPC failed:", rpcError);
      return { ok: false, error: rpcError.message };
    }

    const result = rpcResult as {
      status: string;
      artifact_id?: string;
      secrets_updated?: number;
      customer_full_name?: string;
      customer_phone?: string;
      crew_slug?: string;
    };

    if (result.status === "not_found") {
      console.log("[testdrive-secrets-claim] No testdrive artifact found for doc", docSha256.slice(0, 12));
      return { ok: false, status: "not_found" };
    }

    if (result.status === "already_claimed_by_other") {
      console.log("[testdrive-secrets-claim] Already claimed by another user:", docSha256.slice(0, 12));
      return { ok: false, status: "already_claimed_by_other" };
    }

    if (result.status === "ok") {
      console.log("[testdrive-secrets-claim] Claim succeeded:", {
        artifactId: result.artifact_id,
        secretsUpdated: result.secrets_updated,
        customerName: result.customer_full_name,
      });
      return {
        ok: true,
        status: "ok",
        crewSlug: result.crew_slug,
        customerName: result.customer_full_name,
        customerPhone: result.customer_phone,
      };
    }

    return { ok: false, status: result.status, error: `Unexpected RPC status: ${result.status}` };
  } catch (error) {
    console.error("[testdrive-secrets-claim] Exception:", error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
