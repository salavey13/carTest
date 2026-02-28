"use server";

import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";
import type { UserCrewInfo, ActiveLobbyInfo } from "./AppContext";

// --- ISOLATED ADMIN CLIENT GENERATOR ---
// We do NOT import supabaseAdmin from hooks/supabase to avoid
// any "client-side module initialization" poisoning.
// We create a fresh instance guaranteed to have the server env vars.
function getSafeServerAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase URL or Service Role Key in Server Action context.");
  }

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function fetchDbUserAction(userId: string): Promise<Database["public"]["Tables"]["users"]["Row"] | null> {
  if (!userId) return null;
  
  try {
    const admin = getSafeServerAdmin();
    const { data, error } = await admin
      .from("users")
      .select("*, metadata") // Explicitly select metadata to be sure
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      logger.error(`[fetchDbUserAction] Supabase error for ${userId}:`, error);
      return null;
    }
    return data;
  } catch (error) {
    logger.error(`[fetchDbUserAction] Unexpected failure for user ${userId}:`, error);
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
    const admin = getSafeServerAdmin();
    const { data, error } = await admin
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

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error(`[upsertTelegramUserAction] Failed for user ${payload.userId}:`, error);
    return null;
  }
}

export async function refreshDbUserAction(userId: string): Promise<Database["public"]["Tables"]["users"]["Row"] | null> {
  // Alias to fetchDbUserAction for clarity
  return await fetchDbUserAction(userId);
}

export async function fetchUserCrewInfoAction(userId: string): Promise<UserCrewInfo | null> {
  if (!userId) return null;

  try {
    const admin = getSafeServerAdmin();
    
    // Check ownership
    const { data: ownedCrew } = await admin
      .from('crews')
      .select('id, slug, name, logo_url')
      .eq('owner_id', userId)
      .maybeSingle();

    if (ownedCrew) {
      return { ...ownedCrew, is_owner: true };
    }

    // Check membership
    const { data: memberData } = await admin
      .from('crew_members')
      .select('crews(id, slug, name, logo_url)')
      .eq('user_id', userId)
      .eq('membership_status', 'active')
      .maybeSingle();
      
    if (memberData && memberData.crews) {
      // Supabase types sometimes return array or object depending on query, handle safely
      const crewData = Array.isArray(memberData.crews) ? memberData.crews[0] : memberData.crews;
      if (crewData) {
          return { 
              id: crewData.id, 
              slug: crewData.slug || '', // Ensure string
              name: crewData.name, 
              logo_url: crewData.logo_url || '', 
              is_owner: false 
          };
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
    const admin = getSafeServerAdmin();
    const { data, error } = await admin
        .from('lobby_members')
        .select('lobby_id, lobbies!inner(id, name, start_at, status, metadata)')
        .eq('user_id', userId)
        .eq('lobbies.status', 'active') 
        .maybeSingle();

    if (error) throw error;

    if (data && data.lobbies) {
        const lobby = Array.isArray(data.lobbies) ? data.lobbies[0] : data.lobbies;
        // Safe access to metadata properties
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

// --- THE FIX FOR CART SAVING ---
export async function saveUserFranchizeCartAction(
  userId: string,
  slug: string,
  cartState: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  if (!userId || !slug) {
    return { ok: false, error: "Missing userId or slug" };
  }

  try {
    const admin = getSafeServerAdmin();
    
    // 1. Fetch current metadata explicitly
    const { data: user, error: fetchError } = await admin
        .from("users")
        .select("metadata")
        .eq("user_id", userId)
        .single();

    if (fetchError || !user) {
      logger.error(`[saveUserFranchizeCartAction] Could not fetch user ${userId} to update cart.`, fetchError);
      return { ok: false, error: "User not found or database error" };
    }

    // 2. Safe Deep Merge
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

    // 3. Perform Update
    const { error: updateError, count } = await admin
      .from("users")
      .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .select('user_id', { count: 'exact' }); // Select ID to verify row was touched

    if (updateError) {
      throw updateError;
    }
    
    // Paranoid check: did we actually update a row?
    if (count === 0) {
        logger.warn(`[saveUserFranchizeCartAction] Update returned 0 rows for user ${userId}. User might have been deleted.`);
        return { ok: false, error: "User not found during update" };
    }

    return { ok: true };
  } catch (error) {
    logger.error(`[saveUserFranchizeCartAction] Failed for user ${userId}, slug ${slug}:`, error);
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}