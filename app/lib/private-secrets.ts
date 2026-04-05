"use server";

import { supabaseAdmin } from "@/lib/supabase-server";

function parseJsonRecord(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function getUserSensitiveData(userId: string) {
  const { data } = await supabaseAdmin
    .schema("private")
    .from("user_secrets")
    .select("driver_license, passport")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    driverLicense: data?.driver_license ?? "",
    passport: data?.passport ?? "",
  };
}

export async function saveUserSensitiveData(userId: string, data: {
  driverLicense?: string;
  passport?: string;
}) {
  await supabaseAdmin.schema("private").from("user_secrets").upsert({
    user_id: userId,
    driver_license: data.driverLicense,
    passport: data.passport,
    updated_at: new Date().toISOString(),
  });
}

// ──────────────────────────────────────────────────────────────
// CREW / FRANCHIZE SECRETS (Stage 2 — ready for future use)
// ──────────────────────────────────────────────────────────────
export async function getCrewSensitiveData(crewSlug: string) {
  const { data } = await supabaseAdmin
    .schema("private")
    .from("crew_secrets")
    .select("contract_defaults, doc_templates")
    .eq("crew_slug", crewSlug)
    .maybeSingle();

  return {
    contractDefaults: parseJsonRecord(data?.contract_defaults),
    docTemplates: parseJsonRecord(data?.doc_templates),
  };
}

export async function saveCrewSensitiveData(crewSlug: string, data: {
  contractDefaults?: Record<string, unknown>;
  docTemplates?: Record<string, unknown>;
  // priceLists?: Record<string, any>;       // ← future
}) {
  await supabaseAdmin.schema("private").from("crew_secrets").upsert({
    crew_slug: crewSlug,
    contract_defaults: data.contractDefaults ? JSON.stringify(data.contractDefaults) : undefined,
    doc_templates: data.docTemplates ? JSON.stringify(data.docTemplates) : undefined,
    updated_at: new Date().toISOString(),
  });
}
