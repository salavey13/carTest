// /app/franchize/lib/network-role-operators.ts
// Pure helpers for the network-tab role manager (boss 2026-10-14).
//
// Prefabricated/demo crews are created with I_O_S_NN as the DEFAULT owner and
// no other admins, so every crew needs a human owner/admin assigned before it
// can run itself. Until crew self-management lands, TWO platform operators get
// HARDCODED rights to assign owner / co_owner / admin on ANY crew straight
// from the «Сеть» tab of map-riders — no SQL, no Table Editor.
//
// Pure module (no "use server", no imports) so both the server action and the
// client UI can share it, and vitest can pin it.

/** Hardcoded network role operators — the two platform owners. */
export const NETWORK_ROLE_OPERATOR_IDS: ReadonlySet<string> = new Set([
  "356282674", // I_O_S_NN — default owner of every prefabricated crew
  "413553377", // salavey13 — platform owner
]);

/** Roles the network manager can assign. */
export const NETWORK_ASSIGNABLE_ROLES = ["owner", "co_owner", "admin"] as const;
export type NetworkAssignableRole = (typeof NETWORK_ASSIGNABLE_ROLES)[number];

const NETWORK_ROLE_LABEL: Record<NetworkAssignableRole, string> = {
  owner: "Владелец",
  co_owner: "Совладелец",
  admin: "Админ",
};

export function networkRoleLabel(role: string): string {
  return NETWORK_ROLE_LABEL[role as NetworkAssignableRole] ?? role;
}

/** Hardcoded-operator check — belt&suspenders on top of users.role/status. */
export function isNetworkRoleOperator(userId: string | number | null | undefined): boolean {
  const id = String(userId ?? "").trim();
  return id.length > 0 && NETWORK_ROLE_OPERATOR_IDS.has(id);
}

export function isNetworkAssignableRole(role: string): role is NetworkAssignableRole {
  return (NETWORK_ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

/** Accepts «123456789», «@username», «username» — null when neither. */
export function parseNetworkTargetQuery(query: string): { kind: "id" | "username"; value: string } | null {
  const raw = String(query ?? "").trim();
  if (!raw) return null;
  const untagged = raw.replace(/^@/, "").trim();
  if (!untagged) return null;
  if (/^\d{3,20}$/.test(untagged)) return { kind: "id", value: untagged };
  if (/^[A-Za-z0-9_]{3,32}$/.test(untagged)) return { kind: "username", value: untagged };
  return null;
}
