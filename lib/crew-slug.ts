/**
 * Crew slug normalization + membership matching helpers.
 *
 * Task 97 (boss 2026-10-16): the «Аналитика аренд» entry in the crewHeader
 * profile dropdown was reported to stay hidden FOREVER for some crew members
 * (djorudjov / vip-bike). The DB row was fine — the fragility was in the
 * client chain: a transient Supabase REST error produced a silent `[]` that
 * every consumer treated as ground truth, with no retry and no revalidation.
 *
 * These helpers centralize slug comparison so every gate in the app matches
 * slugs the same way (trim + lowercase, null-safe). DB slugs are lowercase
 * today, but a future "VIP-Bike" slug must not permanently hide crew links
 * for a whole crew.
 */

/** Normalize a crew slug for comparison: trim + lowercase, null-safe → "". */
export function crewSlugKey(slug: string | null | undefined): string {
  return (slug || "").trim().toLowerCase();
}

/**
 * True when `memberships` contains ANY entry for the given slug.
 * "Any entry" is deliberate: the crew links block (Дашборд / Клиенты /
 * Аналитика аренд) is visible to every active member, not just admins.
 */
export function hasCrewMembership(
  memberships: ReadonlyArray<{ slug: string | null | undefined }>,
  slug: string | null | undefined,
): boolean {
  const key = crewSlugKey(slug);
  if (!key) return false;
  return memberships.some((m) => crewSlugKey(m?.slug) === key);
}

/** True when a membership entry for `slug` carries one of the given roles. */
export function hasCrewRole(
  memberships: ReadonlyArray<{ slug: string | null | undefined; role?: string | null }>,
  slug: string | null | undefined,
  roles: readonly string[],
): boolean {
  const key = crewSlugKey(slug);
  if (!key) return false;
  const wanted = new Set(roles.map((r) => r.toLowerCase()));
  return memberships.some(
    (m) => crewSlugKey(m?.slug) === key && wanted.has(String(m?.role || "").toLowerCase()),
  );
}
