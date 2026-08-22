// /app/lib/user-rental-secrets.ts
"use server";

import "server-only";

import { supabaseAdmin } from "@/lib/supabase-server";

export interface UserRentalSecret {
  id: string;
  chat_id: string | null;           // NULL until renter scans QR & claims; then set to their telegram user_id
  crew_slug: string;
  doc_sha256: string;
  renter_full_name: string | null;
  renter_passport: string | null;
  renter_passport_issue_date: string | null;
  renter_passport_issued_by: string | null;   // кем выдан (issuing authority)
  renter_registration: string | null;
  renter_driver_license: string | null;
  license_categories: string | null;       // Водительские категории (A, B, etc.)
  license_expiry_date: string | null;      // Срок действия ВУ
  renter_birth_date: string | null;
  renter_phone: string | null;
  renter_email: string | null;
  renter_address: string | null;
  source_doc_key: string | null;
  source_rental_id: string | null;
  verification_status: "verified" | "pending" | "revoked";
  template_version: number | null;
  created_at: string;
  updated_at: string;
}

type SupabaseSchemaClient = {
  schema: (schema: string) => {
    from: (table: string) => any;
  };
};

function privateSchema() {
  return (supabaseAdmin as unknown as SupabaseSchemaClient).schema("private");
}

function normalizeRequiredId(value: unknown, fieldName: string): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    console.error(`[user-rental-secrets] ${fieldName} is required`);
    return null;
  }

  return normalized;
}

function logUserRentalSecretsError(operation: string, error: unknown) {
  const supabaseError = error as { code?: unknown; status?: unknown; message?: unknown };
  console.error(`[user-rental-secrets] ${operation} failed`, {
    errorCode: typeof supabaseError.code === "string" ? supabaseError.code : undefined,
    errorStatus:
      typeof supabaseError.status === "number" || typeof supabaseError.status === "string"
        ? supabaseError.status
        : undefined,
    errorMessage:
      error instanceof Error
        ? error.message
        : typeof supabaseError.message === "string"
          ? supabaseError.message
          : String(error),
  });
}

// ─── Result type for claimRentalSecretsByDocSha ──────────────────────────────

export type ClaimResult =
  | { ok: true; secret: UserRentalSecret; claimedNow: boolean }
  | { ok: false; reason: "already_claimed_by_other" | "revoked" | "not_found" | "error"; error?: string };

// ─── Helper: check if chat_id is a crew member ──────────────────────────────

/**
 * Check if a chat_id belongs to a crew member OR owner for the given crew_slug.
 * Used to allow operators (crew members) to create secrets that renters can later claim,
 * and to prevent crew members/owners from loading renter data as their own.
 */
export async function isCrewMember(chatId: string, crewSlug: string): Promise<boolean> {
  try {
    // First, find crew by slug
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", crewSlug)
      .maybeSingle();

    if (crewError || !crew) {
      console.log(`[user-rental-secrets] isCrewMember: crew not found for slug=${crewSlug}`);
      return false;
    }

    // Owner is always treated as crew
    if (crew.owner_id === chatId) {
      return true;
    }

    // Then check if chat_id is a member of this crew
    const { data: member, error: memberError } = await supabaseAdmin
      .from("crew_members")
      .select("user_id")
      .eq("crew_id", crew.id)
      .eq("user_id", chatId)
      .maybeSingle();

    if (memberError) {
      console.log(`[user-rental-secrets] isCrewMember: query error`, memberError);
      return false;
    }

    return !!member;
  } catch (error) {
    console.error(`[user-rental-secrets] isCrewMember exception:`, error);
    return false;
  }
}

// ─── Read operations ─────────────────────────────────────────────────────────

// Get most recent verified rental data for a user in a crew.
export async function getUserRentalSecrets(
  chatId: string,
  crewSlug: string,
): Promise<UserRentalSecret | null> {
  const normalizedChatId = normalizeRequiredId(chatId, "chatId");
  const normalizedCrewSlug = normalizeRequiredId(crewSlug, "crewSlug");
  if (!normalizedChatId || !normalizedCrewSlug) return null;

  try {
    let query = privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("chat_id", normalizedChatId)
      .eq("crew_slug", normalizedCrewSlug)
      .eq("verification_status", "verified")
      .order("created_at", { ascending: false })
      .limit(1);

    // SECURITY: crew members must not load renter data keyed under their chat_id.
    // Operators create contracts for renters; those secrets are either unclaimed
    // (chat_id=NULL) or (historically) keyed under the operator. Crew members'
    // own saved data is always source_doc_key='profile_prefill'.
    const crewMember = await isCrewMember(normalizedChatId, normalizedCrewSlug);
    if (crewMember) {
      query = query.eq("source_doc_key", "profile_prefill");
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      logUserRentalSecretsError("getUserRentalSecrets", error);
      return null;
    }

    return (data as UserRentalSecret | null) ?? null;
  } catch (error) {
    logUserRentalSecretsError("getUserRentalSecrets", error);
    return null;
  }
}

// Get rental secret by doc hash (for QR verification / claim flow).
export async function getUserRentalSecretsByDocSha(
  docSha256: string,
): Promise<UserRentalSecret | null> {
  const normalizedDocSha256 = normalizeRequiredId(docSha256, "docSha256");
  if (!normalizedDocSha256) return null;

  try {
    const { data, error } = await privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("doc_sha256", normalizedDocSha256)
      .eq("verification_status", "verified")
      .limit(1)
      .maybeSingle();

    if (error) {
      logUserRentalSecretsError("getUserRentalSecretsByDocSha", error);
      return null;
    }

    return (data as UserRentalSecret | null) ?? null;
  } catch (error) {
    logUserRentalSecretsError("getUserRentalSecretsByDocSha", error);
    return null;
  }
}

/**
 * Get ALL verified rental secrets for a user+crew (for profile/data picker UI).
 * Returns records ordered by most recent first.
 * Used by Task F: Previous rental data picker UI.
 */
export async function getAllVerifiedRentalSecrets(
  chatId: string,
  crewSlug: string,
): Promise<UserRentalSecret[]> {
  const normalizedChatId = normalizeRequiredId(chatId, "chatId");
  const normalizedCrewSlug = normalizeRequiredId(crewSlug, "crewSlug");
  if (!normalizedChatId || !normalizedCrewSlug) return [];

  try {
    let query = privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("chat_id", normalizedChatId)
      .eq("crew_slug", normalizedCrewSlug)
      .eq("verification_status", "verified")
      .order("created_at", { ascending: false });

    // SECURITY: crew members only see their own profile_prefill rows.
    const crewMember = await isCrewMember(normalizedChatId, normalizedCrewSlug);
    if (crewMember) {
      query = query.eq("source_doc_key", "profile_prefill");
    }

    const { data, error } = await query;

    if (error) {
      logUserRentalSecretsError("getAllVerifiedRentalSecrets", error);
      return [];
    }

    return (data as UserRentalSecret[]) ?? [];
  } catch (error) {
    logUserRentalSecretsError("getAllVerifiedRentalSecrets", error);
    return [];
  }
}

// ─── Write operations ────────────────────────────────────────────────────────

/**
 * Save new rental secret (after contract generation).
 *
 * chat_id is OPTIONAL — the skill script creates secrets without Telegram auth context.
 * When chat_id is null, the secret waits to be claimed via QR deep-link
 * (see claimRentalSecretsByDocSha).
 */
export async function saveUserRentalSecrets(
  data: Omit<UserRentalSecret, "id" | "created_at" | "updated_at">,
): Promise<UserRentalSecret | null> {
  // chat_id is optional (NULL = unclaimed secret from skill script)
  const normalizedChatId = typeof data.chat_id === "string" && data.chat_id.trim()
    ? data.chat_id.trim()
    : null;
  const normalizedCrewSlug = normalizeRequiredId(data.crew_slug, "crewSlug");
  const normalizedDocSha256 = normalizeRequiredId(data.doc_sha256, "docSha256");
  if (!normalizedCrewSlug || !normalizedDocSha256) return null;

  try {
    const { data: inserted, error } = await privateSchema()
      .from("user_rental_secrets")
      .insert({
        ...data,
        chat_id: normalizedChatId,
        crew_slug: normalizedCrewSlug,
        doc_sha256: normalizedDocSha256,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      logUserRentalSecretsError("saveUserRentalSecrets", error);
      return null;
    }

    return (inserted as UserRentalSecret | null) ?? null;
  } catch (error) {
    logUserRentalSecretsError("saveUserRentalSecrets", error);
    return null;
  }
}

/**
 * Validate & return a rental secret for the 1-click next rent flow.
 *
 * Called when a renter scans their QR code and opens the Telegram WebApp.
 * This function DOES NOT update the secret — it only validates eligibility
 * and returns the secret data. The actual claim (setting chat_id, propagating
 * to rentals/artifacts/todos/intents) is done by the `claim_rental_by_qr` RPC,
 * which is called by the caller (rental-secrets-claim.ts).
 *
 * This eliminates the partial-failure risk where the TS function updated the
 * secret but the RPC failed, leaving the system in a half-claimed state.
 * See §13.7 #2 in the audit.
 *
 * Flow:
 *   1. Look up by doc_sha256
 *   2. If revoked or not found → return error
 *   3. If chat_id = caller's chatId → already claimed by same user → return secret
 *   4. If chat_id ≠ NULL AND ≠ caller:
 *      a. If current chat_id is a crew member (operator) → ALLOW overwrite (renter claiming)
 *         → return secret, RPC will overwrite chat_id
 *      b. Otherwise → DENY (another renter already claimed)
 *   5. If chat_id IS NULL → return secret (RPC will claim it atomically)
 */
export async function claimRentalSecretsByDocSha(
  chatId: string,
  docSha256: string,
): Promise<ClaimResult> {
  const normalizedChatId = normalizeRequiredId(chatId, "chatId");
  const normalizedDocSha256 = normalizeRequiredId(docSha256, "docSha256");
  if (!normalizedChatId || !normalizedDocSha256) {
    return { ok: false, reason: "error", error: "chatId and docSha256 are required" };
  }

  try {
    // Step 1: Find the secret by doc_sha256
    const { data: existing, error: findError } = await privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("doc_sha256", normalizedDocSha256)
      .limit(1)
      .maybeSingle();

    if (findError) {
      logUserRentalSecretsError("claimRentalSecretsByDocSha.find", findError);
      return { ok: false, reason: "error", error: findError.message || String(findError) };
    }

    if (!existing) {
      return { ok: false, reason: "not_found" };
    }

    const secret = existing as UserRentalSecret;

    // Step 2: Check verification status
    if (secret.verification_status === "revoked") {
      return { ok: false, reason: "revoked" };
    }

    // Step 3: Already claimed by this same user — return existing data
    if (secret.chat_id === normalizedChatId) {
      return { ok: true, secret, claimedNow: false };
    }

    // Step 4: chat_id is set to a different user
    if (secret.chat_id !== null) {
      // Step 4a: Check if current chat_id belongs to a crew member (operator)
      // If yes, allow the renter to claim (RPC will overwrite operator's chat_id)
      const currentChatIdIsCrewMember = await isCrewMember(secret.chat_id, secret.crew_slug);
      
      if (!currentChatIdIsCrewMember) {
        // Current chat_id is NOT a crew member — another renter already claimed
        console.log(`[user-rental-secrets] claimRentalSecretsByDocSha: denied — chat_id=${secret.chat_id} is not a crew member`);
        return { ok: false, reason: "already_claimed_by_other" };
      }

      // Step 4b: Current chat_id IS a crew member (operator) — allow renter to claim
      // NOTE: we do NOT update the secret here. The caller (rental-secrets-claim.ts)
      // will call the claim_rental_by_qr RPC which atomically updates the secret
      // alongside rentals, artifacts, todos, and intents.
      console.log(`[user-rental-secrets] claimRentalSecretsByDocSha: operator ${secret.chat_id} → renter ${normalizedChatId} (RPC will overwrite)`);
      return { ok: true, secret, claimedNow: true };
    }

    // Step 5: chat_id IS NULL — return secret for the RPC to claim atomically.
    // The RPC uses UPDATE ... WHERE chat_id IS NULL to prevent race conditions.
    console.log(`[user-rental-secrets] claimRentalSecretsByDocSha: unclaimed secret ${normalizedDocSha256.slice(0, 12)} for renter ${normalizedChatId} (RPC will claim)`);
    return { ok: true, secret, claimedNow: true };
  } catch (error) {
    logUserRentalSecretsError("claimRentalSecretsByDocSha", error);
    return { ok: false, reason: "error", error: error instanceof Error ? error.message : String(error) };
  }
}

// Revoke a rental secret (doc invalidated).
export async function revokeUserRentalSecrets(docSha256: string): Promise<boolean> {
  const normalizedDocSha256 = normalizeRequiredId(docSha256, "docSha256");
  if (!normalizedDocSha256) return false;

  try {
    const { error } = await privateSchema()
      .from("user_rental_secrets")
      .update({
        verification_status: "revoked",
        updated_at: new Date().toISOString(),
      })
      .eq("doc_sha256", normalizedDocSha256);

    if (error) {
      logUserRentalSecretsError("revokeUserRentalSecrets", error);
      return false;
    }

    return true;
  } catch (error) {
    logUserRentalSecretsError("revokeUserRentalSecrets", error);
    return false;
  }
}
