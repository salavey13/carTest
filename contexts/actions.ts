"use server";

// ИЗМЕНЕНИЕ: импортируем безопасный createOrUpdateUser вместо upsertTelegramUser
import { supabaseAdmin, fetchUserData, createOrUpdateUser } from "@/lib/supabase-server"; 
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";
import type { UserCrewInfo, ActiveLobbyInfo } from "./AppContext";

export async function fetchDbUserAction(userId: string): Promise<Database["public"]["Tables"]["users"]["Row"] | null> {
  if (!userId) return null;
  try {
    return await fetchUserData(userId);
  } catch (error) {
    logger.error(`[fetchDbUserAction] Failed for user ${userId}:`, error);
    return null;
  }
}

export async function upsertTelegramUserAction(payload: {
  userId: string;
  username?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  languageCode?: string | null;
}): Promise<Database["public"]["Tables"]["users"]["Row"] | null> {
  if (!payload.userId) return null;

  try {
    // ИЗМЕНЕНИЕ: Формируем объект для функции createOrUpdateUser. 
    // Заметьте, role и status здесь нет, поэтому функция в lib/supabase-server.ts 
    // их проигнорирует и не перезапишет у существующих юзеров.
    const userInfo = {
        username: payload.username || undefined,
        first_name: payload.fullName || undefined,
        last_name: "", // Игнорируется, так как мы уже склеили полное имя
        photo_url: payload.avatarUrl || undefined,
        language_code: payload.languageCode || undefined
    };

    const data = await createOrUpdateUser(payload.userId, userInfo);
    return data;
  } catch (error) {
    logger.error(`[upsertTelegramUserAction] Failed for user ${payload.userId}:`, error);
    return null;
  }
}

export async function refreshDbUserAction(userId: string): Promise<Database["public"]["Tables"]["users"]["Row"] | null> {
  return await fetchDbUserAction(userId);
}

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
      const crewData = Array.isArray(memberData.crews) ? memberData.crews[0] : memberData.crews;
      if (crewData) {
          return { ...crewData, is_owner: false };
      }
    }
    return null;
  } catch (error) {
    logger.error(`[fetchUserCrewInfoAction] Failed for user ${userId}:`, error);
    return null;
  }
}

export async function fetchActiveGameAction(userId: string): Promise<ActiveLobbyInfo | null> {
  if (!userId) return null;
  try {
    const { data, error } = await supabaseAdmin
        .from('lobby_members')
        .select('lobby_id, lobbies!inner(id, name, start_at, status, metadata)')
        .eq('user_id', userId)
        .eq('lobbies.status', 'active') 
        .maybeSingle();

    if (error) throw error;

    if (data && data.lobbies) {
        const lobby = Array.isArray(data.lobbies) ? data.lobbies[0] : data.lobbies;
        const meta = typeof lobby.metadata === 'object' && lobby.metadata ? lobby.metadata as any : {};
        const actualStart = meta.actual_start_at || lobby.start_at; 
        
        return {
            id: lobby.id,
            name: lobby.name,
            start_at: lobby.start_at,
            actual_start_at: actualStart,
            status: lobby.status
        };
    }
    return null;
  } catch (error) {
    return null;
  }
}

export async function fetchUserRuntimeSnapshotAction(userId: string): Promise<{
  crewInfo: UserCrewInfo | null;
  activeLobby: ActiveLobbyInfo | null;
  metadataSlices: {
    cyberFitness: Record<string, unknown> | null;
    strikeball: Record<string, unknown> | null;
    franchizeProfiles: Record<string, unknown> | null;
  };
}> {
  if (!userId) {
    return {
      crewInfo: null,
      activeLobby: null,
      metadataSlices: { cyberFitness: null, strikeball: null, franchizeProfiles: null },
    };
  }

  const [crewInfo, activeLobby, userRow] = await Promise.all([
    fetchUserCrewInfoAction(userId),
    fetchActiveGameAction(userId),
    supabaseAdmin.from("users").select("metadata").eq("user_id", userId).maybeSingle(),
  ]);

  const metadata = (userRow.data?.metadata || {}) as Record<string, unknown>;

  return {
    crewInfo,
    activeLobby,
    metadataSlices: {
      cyberFitness: (metadata.cyberFitness as Record<string, unknown>) || null,
      strikeball: (metadata.strikeball as Record<string, unknown>) || null,
      franchizeProfiles: (metadata.franchizeProfiles as Record<string, unknown>) || null,
    },
  };
}

export async function saveUserFranchizeCartAction(
  userId: string,
  slug: string,
  cartState: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  if (!userId || !slug) {
    return { ok: false, error: "Missing userId or slug" };
  }

  try {
    const { data: user, error: fetchError } = await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("user_id", userId)
        .single();

    if (fetchError || !user) {
      logger.error(`[saveUserFranchizeCartAction] Could not fetch user ${userId}.`, fetchError);
      return { ok: false, error: "User not found" };
    }

    const currentMeta = (user.metadata as Record<string, any>) || {};
    const currentSettings = (currentMeta.settings as Record<string, any>) || {};
    const currentCarts = (currentSettings.franchizeCart as Record<string, any>) || {};

    const nextMetadata = {
      ...currentMeta,
      settings: {
        ...currentSettings,
        franchizeCart: {
          ...currentCarts,
          [slug]: cartState,
        },
      },
    };

    const { error: updateError, count } = await supabaseAdmin
      .from("users")
      .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .select('user_id', { count: 'exact' });

    if (updateError) throw updateError;
    if (count === 0) return { ok: false, error: "User not found during update" };

    return { ok: true };
  } catch (error) {
    logger.error(`[saveUserFranchizeCartAction] Failed for user ${userId}, slug ${slug}:`, error);
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
