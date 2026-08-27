// public-specs.ts
// ──────────────────────────────────────────────────────────────────────────
// Strips INTERNAL spec keys before raw specs reach a PUBLIC client payload.
// Catalog pages ship items (rawSpecs) to every visitor — the raw JSONB used
// to leak subrenter_chat_id, VIN, plate, insurance, odometer and salary-tier
// data. Kept in a plain lib (NOT inside a "use server" file — those require
// every export to be an async function).

/** Exact internal keys that must never reach a public client. */
export const PUBLIC_SPEC_INTERNAL_KEYS: ReadonlySet<string> = new Set([
  "subrenter_chat_id",
  "subrenter_username",
  "subrenter",
  "last_known_odometer",
  "odometer",
  "odometer_before_hint",
  "purchase_price",
  "supplier_price",
  "registration_cert",
  "insurance_policy",
]);

/** Prefixes catching current and future internal key families. */
export const PUBLIC_SPEC_INTERNAL_PREFIXES = [
  "subrenter_",
  "salary",
  "owner_",
  "sts_",
  "vin",
  "plate",
  "passport",
  "insurance",
] as const;

export function sanitizePublicRawSpecs(
  specs: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!specs || typeof specs !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(specs)) {
    if (PUBLIC_SPEC_INTERNAL_KEYS.has(key)) continue;
    if (PUBLIC_SPEC_INTERNAL_PREFIXES.some((p) => key.startsWith(p))) continue;
    out[key] = value;
  }
  return out;
}
