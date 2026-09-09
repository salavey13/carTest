// /app/franchize/server-actions/update-crew-member-role.ts
"use server";

import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { sendTelegramMessage } from "@/lib/telegram";
import {
  ASSIGNABLE_ROLES,
  assignableRolesFor,
  canManageRole,
  effectiveActorRole,
  roleLabel,
  type AssignableRole,
} from "@/app/franchize/lib/crew-roles";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export type UpdateRoleInput = {
  crewSlug: string;
  targetUserId: string;
  newRole: AssignableRole;
  actorTelegramUserId: string;
};

export type UpdateRoleResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Update a crew member's role.
 *
 * Permission matrix (strict hierarchy — you manage only ranks below you):
 *  - owner    → manages co_owner / admin / mechanic / member, assigns co_owner..member
 *  - co_owner → manages admin / mechanic / member, assigns admin..member
 *  - admin    → manages mechanic / member, assigns mechanic | member
 *  - owners (crews.owner_id and role='owner') are protected from UI changes;
 *  - self-role changes are blocked.
 * Pure helpers live in @/app/franchize/lib/crew-roles (unit-tested there).
 */
export async function updateCrewMemberRole(
  input: UpdateRoleInput
): Promise<UpdateRoleResult> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    if (!ASSIGNABLE_ROLES.includes(input.newRole)) {
      return { success: false, error: "Недопустимая роль" };
    }

    // 1. Resolve crew id
    const { data: crew } = await supabase
      .from("crews")
      .select("id, name, owner_id")
      .eq("slug", input.crewSlug)
      .single();

    if (!crew) {
      return { success: false, error: "Экипаж не найден" };
    }

    // 2. Actor's own membership
    const { data: actor } = await supabase
      .from("crew_members")
      .select("user_id, role")
      .eq("user_id", input.actorTelegramUserId)
      .eq("crew_id", crew.id)
      .maybeSingle();

    // 3. Target's membership
    const { data: target } = await supabase
      .from("crew_members")
      .select("user_id, role")
      .eq("user_id", input.targetUserId)
      .eq("crew_id", crew.id)
      .maybeSingle();

    if (!target) {
      return { success: false, error: "Участник не найден в экипаже" };
    }

    // 4. Permission check (pure helpers, unit-tested)
    const actorRole = effectiveActorRole({
      isCrewOwner: input.actorTelegramUserId === crew.owner_id,
      membershipRole: actor?.role ?? null,
    });

    if (!actorRole) {
      return { success: false, error: "Вы не участник экипажа" };
    }

    if (input.targetUserId === input.actorTelegramUserId) {
      return { success: false, error: "Нельзя менять собственную роль" };
    }

    if (!canManageRole(actorRole, target.role)) {
      return {
        success: false,
        error: `Недостаточно прав: роль «${roleLabel(target.role)}» не ниже вашей`,
      };
    }

    if (!assignableRolesFor(actorRole).includes(input.newRole)) {
      return {
        success: false,
        error: "Вам недоступно назначение этой роли",
      };
    }

    if (target.role === input.newRole) {
      return { success: false, error: "Участник уже имеет эту роль" };
    }

    // 5. Update role
    const { error: updateError } = await supabase
      .from("crew_members")
      .update({ role: input.newRole })
      .eq("user_id", input.targetUserId)
      .eq("crew_id", crew.id);

    if (updateError) {
      logger.error("Failed to update crew member role", updateError);
      return { success: false, error: "Ошибка при обновлении роли" };
    }

    // 6. Best-effort Telegram heads-up for the affected member (never blocks)
    try {
      await sendTelegramMessage(
        input.targetUserId,
        `⚙️ В экипаже «${crew.name}» обновлена роль: ${roleLabel(input.newRole)}`,
      );
    } catch (notifyError) {
      logger.warn("Role-change notification failed", notifyError);
    }

    return { success: true };
  } catch (error) {
    logger.error("updateCrewMemberRole error", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Внутренняя ошибка сервера",
    };
  }
}
