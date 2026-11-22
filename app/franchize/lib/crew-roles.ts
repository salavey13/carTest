// /app/franchize/lib/crew-roles.ts
// Pure crew-role hierarchy helpers shared by the server action
// (update-crew-member-role.ts) and the crew members UI.
// Kept free of "use server" so it may export constants and sync functions.

export const ASSIGNABLE_ROLES = ["co_owner", "admin", "mechanic", "member"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export type CrewRole = "owner" | AssignableRole;

const ROLE_RANK: Record<CrewRole, number> = {
  owner: 4,
  co_owner: 3,
  admin: 2,
  mechanic: 1,
  member: 0,
};

const ROLE_LABEL: Record<CrewRole, string> = {
  owner: "Владелец",
  co_owner: "Совладелец",
  admin: "Администратор",
  mechanic: "Механик",
  member: "Участник",
};

export function roleRank(role: string): number {
  return ROLE_RANK[role as CrewRole] ?? 0;
}

export function roleLabel(role: string): string {
  return ROLE_LABEL[role as CrewRole] ?? role;
}

/**
 * Effective actor role: crews.owner_id wins, otherwise the crew_members row.
 * Returns null when the actor has no standing in the crew at all.
 */
export function effectiveActorRole(input: {
  isCrewOwner: boolean;
  membershipRole: string | null;
}): CrewRole | null {
  if (input.isCrewOwner) return "owner";
  const role = input.membershipRole;
  if (role && role in ROLE_RANK) return role as CrewRole;
  return null;
}

/** An actor can only manage members strictly below their own rank. */
export function canManageRole(actorRole: CrewRole, targetRole: string): boolean {
  return roleRank(targetRole) < roleRank(actorRole);
}

/** Roles the actor may assign: everything strictly below their own rank. */
export function assignableRolesFor(actorRole: CrewRole): AssignableRole[] {
  return ASSIGNABLE_ROLES.filter((r) => roleRank(r) < roleRank(actorRole));
}
