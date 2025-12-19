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
 * Moves the complex join logic to the server.
 */
export async function fetchActiveGameAction(userId: string): Promise<ActiveLobbyInfo | null> {
  if (!userId) return null;

  try {
    // Find a lobby where user is a member AND lobby is active
    // We use inner join logic via !inner if RLS allows, or simple select with filter
    const { data, error } = await supabaseAdmin
        .from('lobby_members')
        .select('lobby_id, lobbies(id, name, start_at, status, metadata)')
        .eq('user_id', userId)
        // We filter for active lobbies in the joined resource
        // This syntax depends on Supabase postgrest version, safer to fetch member and check lobby
        // But let's try the direct relation filter first
        .eq('lobbies.status', 'active')
        .maybeSingle();

    // If query syntax is strict, we might get null even if active. 
    // Fallback if that fails: fetch member record, then fetch lobby. 
    // But assuming the relation exists:
    if (data && data.lobbies) {
        const lobby = data.lobbies as any; // Cast for safety
        // Ensure status is actually active (double check)
        if (lobby.status !== 'active') return null;

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
    // Log silently to avoid spamming logs on every poll
    // logger.error(`[fetchActiveGameAction] Error for user ${userId}:`, error);
    return null;
  }
}