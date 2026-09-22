// app/franchize/server-actions/crew-join-achievements.ts
//
// Crew-join gamification (2026-09-22, «improve related notifications and
// achievements»): когда кто-то вступает в экипаж по приглашению
// (autoJoinCrew → ?join_crew=true flow), обе стороны получают достижения:
//
//   · joiner   → crew_first_join        «Командный дух»   (первое вступление)
//   · owner    → crew_recruiter_first   «Первый рекрут»   (1 участник по инвайту)
//              → crew_recruiter_5       «Вербовщик»       (5 участников)
//              → crew_recruiter_15      «Кадровый магнат» (15 участников)
//
// Порог владельца считается по ФАКТУ (COUNT активных crew_members), а не по
// счётчику metadata — grantFranchizeAchievementAction инкрементит counters на
// КАЖДЫЙ вызов (даже по alreadyUnlocked), поэтому один джойн с несколькими
// бейджами разъезжался бы с реальностью. COUNT даёт идемпотентность даром.
//
// Все вызовы best-effort: джойн не должен падать из-за геймификации.
// Ошибки логируются и глотаются. Достижения кладутся в профили СВОЕГО slug
// (metadata.franchizeProfiles[<crewSlug>]) — тот же скоуп, что у rental/shift
// бейджей, и тот же каталог (profile-actions.ts getCatalogBySlug).

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { grantFranchizeAchievementAction } from "@/app/franchize/profile-actions";

const OWNER_RECRUIT_THRESHOLDS: Array<{ count: number; achievementId: string }> = [
  { count: 1, achievementId: "crew_recruiter_first" },
  { count: 5, achievementId: "crew_recruiter_5" },
  { count: 15, achievementId: "crew_recruiter_15" },
];

/** Активные участники экипажа (membership_status = active). */
async function countActiveMembers(crewId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("crew_members")
    .select("user_id", { count: "exact", head: true })
    .eq("crew_id", crewId)
    .eq("membership_status", "active");
  if (error) {
    logger.warn("[crew-join-achievements] countActiveMembers failed", error);
    return 0;
  }
  return count ?? 0;
}

export interface CrewJoinAchievementsInput {
  crewId: string;
  crewSlug: string;
  /** TG id вступившего (users.user_id, цифры). */
  joinerId: string;
  /** TG id владельца экипажа (crews.owner_id) — получает рекрутерские бейджи. */
  ownerId: string | null;
}

/**
 * Выдать достижения по факту вступления. Никогда не бросает; вызывающий код
 * (autoJoinCrew) может await-ить смело — гонок нет, каждый бейдж идемпотентен.
 */
export async function grantCrewJoinAchievements(
  input: CrewJoinAchievementsInput,
): Promise<void> {
  try {
    const slug = String(input.crewSlug || "").trim().slice(0, 64);
    const joinerId = String(input.joinerId || "").trim();
    const ownerId = String(input.ownerId || "").trim();
    if (!slug || !joinerId) return;

    const granted: string[] = [];
    const failed: string[] = [];

    // 1. Joiner: первое вступление в экипаж.
    try {
      const res = await grantFranchizeAchievementAction({
        slug,
        userId: joinerId,
        achievementId: "crew_first_join",
        source: "crew:auto_join",
        context: { crewId: input.crewId },
      });
      if (res.success && !res.alreadyUnlocked) granted.push("crew_first_join");
      if (!res.success) failed.push(`crew_first_join: ${res.error || "grant failed"}`);
    } catch (e) {
      failed.push(`crew_first_join: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 2. Owner: рекрутерские пороги по факту состава. Самовступление
    //    (joiner === owner) рекрутом не считается.
    if (ownerId && ownerId !== joinerId) {
      const members = await countActiveMembers(input.crewId);
      for (const { count, achievementId } of OWNER_RECRUIT_THRESHOLDS) {
        if (members < count) continue;
        try {
          const res = await grantFranchizeAchievementAction({
            slug,
            userId: ownerId,
            achievementId,
            source: "crew:auto_join",
            context: { crewId: input.crewId, members },
          });
          if (res.success && !res.alreadyUnlocked) granted.push(achievementId);
          if (!res.success) failed.push(`${achievementId}: ${res.error || "grant failed"}`);
        } catch (e) {
          failed.push(`${achievementId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    logger.info("[crew-join-achievements] done", {
      crewSlug: slug,
      joinerId,
      ownerId: ownerId || null,
      granted,
      failed,
    });
  } catch (e) {
    // Геймификация никогда не ломает джойн.
    logger.warn("[crew-join-achievements] unexpected error", e);
  }
}
