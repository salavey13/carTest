"use server";

import { fetchUserData, supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";
import type { UserCrewInfo } from "./AppContext";

/**
 * БЕЗОПАСНО перезагружает данные пользователя с сервера.
 * Эта функция вызывается из AppContext.
 */
export async function refreshDbUserAction(userId: string): Promise<Database["public"]["Tables"]["users"]["Row"] | null> {
  try {
    const freshDbUser = await fetchUserData(userId);
    return freshDbUser;
  } catch (e) {
    logger.error(`[refreshDbUserAction] Error refreshing dbUser for ${userId}:`, e);
    return null;
  }
}

/**
 * БЕЗОПАСНО получает информацию об экипаже пользователя на сервере.
 * Эта функция вызывается из AppContext.
 */
export async function fetchUserCrewInfoAction(userId: string): Promise<UserCrewInfo | null> {
  if (!userId) return null;

  try {
    const { data: ownedCrew } = await supabaseAdmin
      .from('crews')
      .select('id, slug, name, logo_url')
      .eq('owner_id', userId)
      .maybeSingle();

    if (ownedCrew) {
      return { ...ownedCrew, is_owner: true };
    }

    const { data: memberData } = await supabaseAdmin
      .from('crew_members')
      .select('crews(id, slug, name, logo_url)')
      .eq('user_id', userId)
      .eq('membership_status', 'active')
      .maybeSingle();
      
    if (memberData && memberData.crews) {
      const crewData = memberData.crews as { id: string; slug: string; name: string; logo_url: string; };
      return { ...crewData, is_owner: false };
    }

    return null;
  } catch (error) {
    logger.error(`[fetchUserCrewInfoAction] Failed for user ${userId}:`, error);
    return null;
  }
}