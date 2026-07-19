// /app/franchize/server-actions/update-crew-member-role.ts
"use server";

import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export type UpdateRoleInput = {
  crewSlug: string;
  targetUserId: string;
  newRole: "admin" | "co_owner";
  actorTelegramUserId: string;
};

export type UpdateRoleResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Promote a crew member to admin or co_owner.
 *
 * Permission matrix:
 *  - owner  → can promote to co_owner or admin
 *  - co_owner → can promote member → admin
 *  - admin  → cannot promote
 */
export async function updateCrewMemberRole(
  input: UpdateRoleInput
): Promise<UpdateRoleResult> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1. Resolve crew id
    const { data: crew } = await supabase
      .from("crews")
      .select("id, owner_id")
      .eq("slug", input.crewSlug)
      .single();

    if (!crew) {
      return { success: false, error: "Экипаж не найден" };
    }

    // 2. Get actor's membership
    const { data: actor } = await supabase
      .from("crew_members")
      .select("user_id, role")
      .eq("user_id", input.actorTelegramUserId)
      .eq("crew_id", crew.id)
      .maybeSingle();

    if (!actor) {
      return { success: false, error: "Вы не участник экипажа" };
    }

    // 3. Get target's membership
    const { data: target } = await supabase
      .from("crew_members")
      .select("user_id, role")
      .eq("user_id", input.targetUserId)
      .eq("crew_id", crew.id)
      .maybeSingle();

    if (!target) {
      return { success: false, error: "Целевой участник не найден в экипаже" };
    }

    // 4. Permission check
    const isCrewOwner = input.actorTelegramUserId === crew.owner_id;

    if (input.newRole === "co_owner") {
      // Only crew owner can promote to co_owner
      if (!isCrewOwner) {
        return {
          success: false,
          error: "Только владелец экипажа может назначить совладельца",
        };
      }
      // Target must currently be admin (or lower)
      if (target.role === "co_owner" || target.role === "owner") {
        return { success: false, error: "Участник уже имеет эту роль" };
      }
    } else if (input.newRole === "admin") {
      // Owner or co_owner can promote to admin
      if (!isCrewOwner && actor.role !== "co_owner") {
        return {
          success: false,
          error: "Только владелец или совладелец может назначить администратора",
        };
      }
      if (target.role === "admin" || target.role === "co_owner" || target.role === "owner") {
        return { success: false, error: "Участник уже имеет эту или выше роль" };
      }
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

    return { success: true };
  } catch (error) {
    logger.error("updateCrewMemberRole error", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Внутренняя ошибка сервера",
    };
  }
}
