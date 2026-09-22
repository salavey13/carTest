// /app/franchize/server-actions/update-crew-member-role.ts
"use server";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { resolveCrewBotUsername, crewBotAppLink } from "@/app/franchize/lib/crew-bot";
import {
  ASSIGNABLE_ROLES,
  assignableRolesFor,
  canManageRole,
  effectiveActorRole,
  roleLabel,
  type AssignableRole,
} from "@/app/franchize/lib/crew-roles";

// Re-export so client UIs can import the role type next to the actions
// (CrewMembersClient does exactly that).
export type { AssignableRole } from "@/app/franchize/lib/crew-roles";

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

// ─────────────────────────────────────────────────────────────────────────────
// Admin invite & owner promotion (dummy-crew onboarding, 2026-09-21)
//
// Flow: platform admin sends the invite deeplink (join_<slug>, built by
// crewJoinStartParam) to a future crew owner → the person opens it in
// Telegram, auto-joins the (dummy) crew as a MEMBER (JoinCrewBanner) →
// later the admin opens the crew members page and promotes them to owner
// with promoteCrewMemberToOwnerAction. Both actions are PLATFORM-ADMIN-only
// (users.role ∈ admin|vpradmin) — crew owners must NOT mint owners.
// ─────────────────────────────────────────────────────────────────────────────

export type PromoteOwnerInput = {
  crewSlug: string;
  targetUserId: string;
  actorTelegramUserId: string;
};

export type PromoteOwnerResult =
  | { success: true; previousOwnerId: string | null }
  | { success: false; error: string };

async function assertPlatformAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("role, status")
    .eq("user_id", userId)
    .maybeSingle();
  const u = (data ?? null) as { role?: string | null; status?: string | null } | null;
  const role = String(u?.role ?? "").toLowerCase();
  const status = String(u?.status ?? "").toLowerCase();
  return role === "admin" || role === "vpradmin" || status === "admin";
}

export async function promoteCrewMemberToOwnerAction(
  input: PromoteOwnerInput,
): Promise<PromoteOwnerResult> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    if (!input.targetUserId || input.targetUserId === input.actorTelegramUserId) {
      return { success: false, error: "Некорректный участник" };
    }
    if (!(await assertPlatformAdmin(supabase, input.actorTelegramUserId))) {
      return { success: false, error: "Только платформенный админ может назначать владельцев" };
    }

    const { data: crew } = await supabase
      .from("crews")
      .select("id, name, owner_id")
      .eq("slug", input.crewSlug)
      .maybeSingle();
    const crewRow = (crew ?? null) as { id: string; name: string; owner_id: string | null } | null;
    if (!crewRow) return { success: false, error: "Экипаж не найден" };

    // The target must already be a member (the invite flow adds them as one).
    const { data: member } = await supabase
      .from("crew_members")
      .select("user_id, role")
      .eq("user_id", input.targetUserId)
      .eq("crew_id", crewRow.id)
      .maybeSingle();
    const memberRow = (member ?? null) as { user_id: string; role: string } | null;
    if (!memberRow) {
      return { success: false, error: "Пользователь ещё не участник экипажа — сначала отправь приглашение" };
    }
    if (crewRow.owner_id === input.targetUserId) {
      return { success: false, error: "Пользователь уже владелец этого экипажа" };
    }

    // 1. crews.owner_id — the effective ownership source (effectiveActorRole
    //    treats it as rank 4), so membership alone is not enough.
    const { error: crewUpdateError } = await supabase
      .from("crews")
      .update({ owner_id: input.targetUserId })
      .eq("id", crewRow.id);
    if (crewUpdateError) {
      logger.error("[promoteOwner] crews.owner_id update failed", crewUpdateError);
      return { success: false, error: "Ошибка при передаче владения экипажем" };
    }

    // 2. Membership rows: target → owner; previous owner (if any, and if
    //    they had a row) → co_owner so they keep seniority without ownership.
    const { error: targetRoleError } = await supabase
      .from("crew_members")
      .update({ role: "owner" })
      .eq("user_id", input.targetUserId)
      .eq("crew_id", crewRow.id);
    if (targetRoleError) logger.warn("[promoteOwner] target role update failed", targetRoleError);

    const previousOwnerId =
      crewRow.owner_id && crewRow.owner_id !== input.targetUserId ? crewRow.owner_id : null;
    if (previousOwnerId) {
      await supabase
        .from("crew_members")
        .update({ role: "co_owner" })
        .eq("user_id", previousOwnerId)
        .eq("crew_id", crewRow.id);
    }

    // Best-effort Telegram heads-up for the new owner (never blocks).
    // 2026-09-22: с inline-кнопкой на страницу экипажа (deep link через бота;
    // crewBotAppLink санитизирует startapp, резолвер с платформенным фолбэком —
    // ссылка есть даже у dummy-экипажей). HTML + экранирование имени — legacy
    // Markdown падает 400 на */_[ в названии экипажа (codereview 42-b).
    try {
      const botUsername = await resolveCrewBotUsername(input.crewSlug);
      const crewAppUrl = crewBotAppLink(botUsername, `crew_${input.crewSlug}`);
      const buttons: Array<{ text: string; url: string }>[] = crewAppUrl
        ? [[{ text: "🏍 Открыть экипаж", url: crewAppUrl }]]
        : [];
      const escTgHtml = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      await sendComplexMessage(
        input.targetUserId,
        `👑 Ты назначен владельцем экипажа <b>«${escTgHtml(crewRow.name)}»</b>. Добро пожаловать на капитанский мостик!`,
        buttons,
        { keyboardType: "inline", parseMode: "HTML" },
      );
    } catch (notifyError) {
      logger.warn("[promoteOwner] notification failed", notifyError);
    }

    return { success: true, previousOwnerId };
  } catch (error) {
    logger.error("promoteCrewMemberToOwnerAction error", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Внутренняя ошибка сервера",
    };
  }
}

export type CrewInviteInfo =
  | { success: true; botUsername: string | null; startParam: string; webFallbackUrl: string }
  | { success: false; error: string };

/**
 * Everything the invite UI needs: the bot username resolved from crew
 * metadata (never hardcoded), the join_<slug> start param and a plain web
 * fallback for crews without a bot.
 *
 * Who may invite: PLATFORM ADMIN always; otherwise a senior member of THIS
 * crew (owner / co_owner / admin). Join links only ever add a MEMBER — they
 * grant no rights — so sharing them is benign (and the old UI already did).
 * Promoting to owner is a separate platform-admin-only action below.
 */
export async function getCrewInviteInfoAction(input: {
  slug: string;
  actorTelegramUserId: string;
}): Promise<CrewInviteInfo> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const slug = String(input.slug ?? "").trim().slice(0, 64);
    if (!slug) return { success: false, error: "Экипаж не найден" };

    const isPlatformAdmin = await assertPlatformAdmin(supabase, input.actorTelegramUserId);
    if (!isPlatformAdmin) {
      const { data: crew } = await supabase
        .from("crews")
        .select("id, owner_id")
        .eq("slug", slug)
        .maybeSingle();
      const crewRow = (crew ?? null) as { id: string; owner_id: string | null } | null;
      if (!crewRow) return { success: false, error: "Экипаж не найден" };
      const isOwner = crewRow.owner_id === input.actorTelegramUserId;
      let membershipRole: string | null = null;
      if (!isOwner) {
        const { data: membership } = await supabase
          .from("crew_members")
          .select("role")
          .eq("user_id", input.actorTelegramUserId)
          .eq("crew_id", crewRow.id)
          .maybeSingle();
        membershipRole = ((membership ?? null) as { role?: string | null } | null)?.role ?? null;
      }
      const senior = isOwner || ["owner", "co_owner", "admin"].includes(String(membershipRole));
      if (!senior) return { success: false, error: "Инвайты доступны старшему составу экипажа" };
    }

    const { resolveCrewBotUsername } = await import("@/app/franchize/lib/crew-bot");
    const { crewJoinStartParam } = await import("@/lib/wall-deeplink");
    const botUsername = await resolveCrewBotUsername(slug);
    const startParam = crewJoinStartParam(slug);
    const webFallbackUrl = `/franchize/${slug}?join_crew=true`;
    return { success: true, botUsername, startParam, webFallbackUrl };
  } catch (error) {
    logger.error("getCrewInviteInfoAction error", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Внутренняя ошибка сервера",
    };
  }
}
