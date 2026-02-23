"use server";

import { fetchUserData, supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";
import type { UserCrewInfo, ActiveLobbyInfo } from "./AppContext";

/**
 * Safely reloads user data from server.
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
 * Fetches crew info for the user.
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

/**
 * Checks if the user is in an Active Lobby.
 * FIX: Uses !inner to force filtering only for ACTIVE lobbies, ignoring finished/open ones.
 */
export async function fetchActiveGameAction(userId: string): Promise<ActiveLobbyInfo | null> {
  if (!userId) return null;

  try {
    const { data, error } = await supabaseAdmin
        .from('lobby_members')
        // The !inner here is CRITICAL. It forces the query to only return rows 
        // where the joined 'lobbies' record actually matches the filter.
        .select('lobby_id, lobbies!inner(id, name, start_at, status, metadata)')
        .eq('user_id', userId)
        .eq('lobbies.status', 'active') 
        .maybeSingle();

    if (error) throw error;

    if (data && data.lobbies) {
        const lobby = data.lobbies as any;
        const actualStart = lobby.metadata?.actual_start_at || lobby.start_at; 
        
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
    // logger.error(`[fetchActiveGameAction] Error for user ${userId}:`, error);
    return null;
  }
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
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    const existingMetadata = (existingUser?.metadata && typeof existingUser.metadata === "object")
      ? (existingUser.metadata as Record<string, unknown>)
      : {};
    const existingSettings = (existingMetadata.settings && typeof existingMetadata.settings === "object")
      ? (existingMetadata.settings as Record<string, unknown>)
      : {};
    const existingFranchizeCart = (existingSettings.franchizeCart && typeof existingSettings.franchizeCart === "object")
      ? (existingSettings.franchizeCart as Record<string, unknown>)
      : {};

    const nextMetadata: Record<string, unknown> = {
      ...existingMetadata,
      settings: {
        ...existingSettings,
        franchizeCart: {
          ...existingFranchizeCart,
          [slug]: cartState,
        },
      },
    };

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (updateError) {
      throw updateError;
    }

    return { ok: true };
  } catch (error) {
    logger.error(`[saveUserFranchizeCartAction] Failed for user ${userId}, slug ${slug}:`, error);
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
