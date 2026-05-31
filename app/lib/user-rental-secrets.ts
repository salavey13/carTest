"use server";

import "server-only";

import { supabaseAdmin } from "@/lib/supabase-server";

export interface UserRentalSecret {
  id: string;
  chat_id: string;
  crew_slug: string;
  doc_sha256: string;
  renter_full_name: string | null;
  renter_passport: string | null;
  renter_driver_license: string | null;
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

// Get most recent verified rental data for a user in a crew.
export async function getUserRentalSecrets(
  chatId: string,
  crewSlug: string,
): Promise<UserRentalSecret | null> {
  const normalizedChatId = normalizeRequiredId(chatId, "chatId");
  const normalizedCrewSlug = normalizeRequiredId(crewSlug, "crewSlug");
  if (!normalizedChatId || !normalizedCrewSlug) return null;

  try {
    const { data, error } = await privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("chat_id", normalizedChatId)
      .eq("crew_slug", normalizedCrewSlug)
      .eq("verification_status", "verified")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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

// Get rental secret by doc hash (for QR verification).
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

// Save new rental secret (after contract generation).
export async function saveUserRentalSecrets(
  data: Omit<UserRentalSecret, "id" | "created_at" | "updated_at">,
): Promise<UserRentalSecret | null> {
  const normalizedChatId = normalizeRequiredId(data.chat_id, "chatId");
  const normalizedCrewSlug = normalizeRequiredId(data.crew_slug, "crewSlug");
  const normalizedDocSha256 = normalizeRequiredId(data.doc_sha256, "docSha256");
  if (!normalizedChatId || !normalizedCrewSlug || !normalizedDocSha256) return null;

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
