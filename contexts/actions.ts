"use server";

import { supabaseAdmin, fetchUserData } from "@/hooks/supabase";
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
    const { data, error } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          user_id: payload.userId,
          username: payload.username || null,
          full_name: payload.fullName || null,
          avatar_url: payload.avatarUrl || null,
          language_code: payload.languageCode || null,
          updated_at: new Date().toISOString(),
          role: "user",
          status: "active",
        },
        { onConflict: "user_id" },
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

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
      // Handle array vs object return type from join
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

// --- LOGIC FIX HERE: Manually merge metadata before update ---
export async function saveUserFranchizeCartAction(
  userId: string,
  slug: string,
  cartState: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  if (!userId || !slug) {
    return { ok: false, error: "Missing userId or slug" };
  }

  try {
    // 1. Fetch current metadata manually
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

    // 2. Perform Deep Merge in JS
    const nextMetadata = {
      ...currentMeta,
      settings: {
        ...currentSettings,
        franchizeCart: {
          ...currentCarts,
          [slug]: cartState, // Update only this slug's cart
        },
      },
    };

    // 3. Write back the full metadata object
    const { error: updateError, count } = await supabaseAdmin
      .from("users")
      .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .select('user_id', { count: 'exact' });

    if (updateError) {
      throw updateError;
    }
    
    if (count === 0) {
        logger.warn(`[saveUserFranchizeCartAction] Update touched 0 rows for ${userId}. User might be deleted.`);
        return { ok: false, error: "User not found during update" };
    }

    return { ok: true };
  } catch (error) {
    logger.error(`[saveUserFranchizeCartAction] Failed for user ${userId}, slug ${slug}:`, error);
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}