// /app/lib/user-rental-secrets-columns.ts
//
// Shared helpers for writing to private.user_rental_secrets defensively.
//
// The repo migration 20260708000000_add_license_fields_to_rental_secrets.sql
// adds `license_categories` + `license_expiry_date`, but the LIVE database may
// not have it applied yet (the user applies migrations in the Supabase SQL
// editor). Writing those columns against a schema without them fails with
// PGRST204 ("Could not find the column … in the schema cache") — which is
// exactly why saveRentalDocsPrefillAction silently failed for every
// profile-page save before this fallback existed.
//
// Strategy: write WITH the columns first; on a schema-cache miss retry once
// without them (data lands, minus the two optional fields, until the migration
// is applied).

/** Plain lib — NO "use server" (sync helpers can't live in server-action files). */

export const OPTIONAL_LICENSE_COLUMNS = ["license_categories", "license_expiry_date"] as const;

export function stripOptionalLicenseColumns<T extends Record<string, unknown>>(payload: T): T {
  const stripped = { ...payload };
  for (const col of OPTIONAL_LICENSE_COLUMNS) delete stripped[col];
  return stripped;
}

export function isSchemaCacheMiss(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "PGRST204" || /schema cache/i.test(error.message ?? "");
}
