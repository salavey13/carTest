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

// ─── Helper: safe update with optional qr_claimed_at ────────────────────────

/**
 * Attempt an update on user_rental_secrets, including qr_claimed_at column.
 * If the column does not exist in the schema cache (PGRST204), retry without it.
 * This handles the case where the migration 20260625000000_add_qr_status_tracking.sql
 * has not been applied on the production Supabase project.
 *
 * @param updateFields - Fields to update (will have updated_at + optionally qr_claimed_at added)
 * @param eqConditions - Array of { column, value } for .eq() filters
 * @param isNullCondition - Optional { column } for .is(column, null) filter
 */
async function updateRentalSecretWithQrTracking(
  updateFields: Record<string, unknown>,
  eqConditions: { column: string; value: string | number | boolean | null }[],
  isNullCondition?: { column: string },
): Promise<{ data: unknown; error: unknown }> {
  // Build update payload with qr_claimed_at
  const payloadWithQr = {
    ...updateFields,
    qr_claimed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let query = privateSchema()
    .from("user_rental_secrets")
    .update(payloadWithQr);

  for (const eq of eqConditions) {
    query = query.eq(eq.column, eq.value);
  }

  if (isNullCondition) {
    query = query.is(isNullCondition.column, null);
  }

  let result = await query.select("*").maybeSingle();
  const supabaseError = result.error as { code?: string } | null;

  // If column doesn't exist (PGRST204), retry without qr_claimed_at
  if (supabaseError?.code === "PGRST204") {
    console.log("[user-rental-secrets] qr_claimed_at column not found, retrying without it. Run migration 20260625000000_add_qr_status_tracking.sql");

    const fallbackPayload = {
      ...updateFields,
      updated_at: new Date().toISOString(),
    };

    let fallbackQuery = privateSchema()
      .from("user_rental_secrets")
      .update(fallbackPayload);

    for (const eq of eqConditions) {
      fallbackQuery = fallbackQuery.eq(eq.column, eq.value);
    }

    if (isNullCondition) {
      fallbackQuery = fallbackQuery.is(isNullCondition.column, null);
    }

    result = await fallbackQuery.select("*").maybeSingle();
  }

  return { data: result.data, error: result.error };
}

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
 * Claim rental secrets by doc_sha256 — the core of the 1-click next rent flow.
 *
 * Called when a renter scans their QR code and opens the Telegram WebApp.
 * Atomically links this secret row to the claiming user's chat_id.
 *
 * Flow:
 *   1. Look up by doc_sha256 + verification_status='verified'
 *   2. If chat_id IS NULL → claim it (SET chat_id = caller's chatId) → return secret
 *   3. If chat_id = caller's chatId → already claimed by same user → return secret
 *   4. If chat_id ≠ NULL AND ≠ caller:
 *      a. If current chat_id is a crew member (operator) → ALLOW overwrite (renter claiming)
 *      b. Otherwise → DENY (another renter already claimed)
 *   5. If not found or revoked → return appropriate error
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
      // If yes, allow the renter to claim (overwrite operator's chat_id)
      const currentChatIdIsCrewMember = await isCrewMember(secret.chat_id, secret.crew_slug);
      
      if (!currentChatIdIsCrewMember) {
        // Current chat_id is NOT a crew member — another renter already claimed
        console.log(`[user-rental-secrets] claimRentalSecretsByDocSha: denied — chat_id=${secret.chat_id} is not a crew member`);
        return { ok: false, reason: "already_claimed_by_other" };
      }

      // Step 4b: Current chat_id IS a crew member (operator) — allow renter to claim
      console.log(`[user-rental-secrets] claimRentalSecretsByDocSha: operator ${secret.chat_id} → renter ${normalizedChatId} (overwrite allowed)`);
      
      const { data: claimed, error: claimError } = await updateRentalSecretWithQrTracking(
        { chat_id: normalizedChatId },
        [
          { column: "doc_sha256", value: normalizedDocSha256 },
          { column: "chat_id", value: secret.chat_id },
        ],
      );

      if (claimError) {
        logUserRentalSecretsError("claimRentalSecretsByDocSha.overwrite", claimError);
        return { ok: false, reason: "error", error: claimError.message || String(claimError) };
      }

      if (!claimed) {
        // Race condition: someone else updated it between our find and update
        const { data: rechecked } = await privateSchema()
          .from("user_rental_secrets")
          .select("chat_id")
          .eq("doc_sha256", normalizedDocSha256)
          .limit(1)
          .maybeSingle();

        if (rechecked?.chat_id === normalizedChatId) {
          const { data: fullSecret } = await privateSchema()
            .from("user_rental_secrets")
            .select("*")
            .eq("doc_sha256", normalizedDocSha256)
            .limit(1)
            .maybeSingle();
          return { ok: true, secret: fullSecret as UserRentalSecret, claimedNow: false };
        }

        return { ok: false, reason: "already_claimed_by_other" };
      }

      return { ok: true, secret: claimed as UserRentalSecret, claimedNow: true };
    }

    // Step 5: chat_id IS NULL — claim it atomically
    // Use UPDATE ... WHERE chat_id IS NULL to prevent race conditions
    const { data: claimed, error: claimError } = await updateRentalSecretWithQrTracking(
      { chat_id: normalizedChatId },
      [{ column: "doc_sha256", value: normalizedDocSha256 }],
      { column: "chat_id" },  // IS NULL condition (atomic: only if still unclaimed)
    );

    if (claimError) {
      logUserRentalSecretsError("claimRentalSecretsByDocSha.claim", claimError);
      return { ok: false, reason: "error", error: claimError.message || String(claimError) };
    }

    // Race condition: another request claimed it between our find and update
    if (!claimed) {
      // Re-fetch to determine who claimed it
      const { data: rechecked } = await privateSchema()
        .from("user_rental_secrets")
        .select("chat_id")
        .eq("doc_sha256", normalizedDocSha256)
        .limit(1)
        .maybeSingle();

      if (rechecked?.chat_id === normalizedChatId) {
        // We actually got it (unlikely timing, but handle gracefully)
        const { data: fullSecret } = await privateSchema()
          .from("user_rental_secrets")
          .select("*")
          .eq("doc_sha256", normalizedDocSha256)
          .limit(1)
          .maybeSingle();
        return { ok: true, secret: fullSecret as UserRentalSecret, claimedNow: false };
      }

      return { ok: false, reason: "already_claimed_by_other" };
    }

    return { ok: true, secret: claimed as UserRentalSecret, claimedNow: true };
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
