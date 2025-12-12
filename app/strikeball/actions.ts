"use server";

import type { Database } from "@/types/database.types";
import { supabaseAdmin, fetchUserData as dbFetchUserData, updateUserMetadata as dbUpdateUserMetadata } from "@/hooks/supabase";
import { logger } from "@/lib/logger";

type LobbyRow = Database["public"]["Tables"]["lobbies"]["Row"];
type LobbyInsert = Database["public"]["Tables"]["lobbies"]["Insert"];

/**
 * Create a lightweight lobby record and attach owner as first member.
 * Also writes last_created_lobby to user's metadata (jsonb).
 */
export async function createLobby(
  ownerUserId: string,
  payload: {
    name: string;
    mode?: string;
    max_players?: number;
    field_id?: string | null;
    start_at?: string | null; // ISO datetime or null
    is_public?: boolean;
  }
): Promise<{ success: boolean; lobby?: LobbyRow; error?: string }> {
  if (!ownerUserId) return { success: false, error: "ownerUserId required" };
  const { name, mode = "tdm", max_players = 10, field_id = null, start_at = null, is_public = true } = payload;
  if (!name || name.trim().length < 3) return { success: false, error: "Название слишком короткое" };

  if (!supabaseAdmin) return { success: false, error: "DB admin client missing" };

  try {
    // Insert lobby
    const insert: LobbyInsert = {
      name: name.trim(),
      owner_id: ownerUserId,
      mode,
      max_players,
      field_id,
      start_at,
      is_public,
      status: "open", // convention
      created_at: new Date().toISOString(),
    } as any;

    const { data: lobby, error: insertErr } = await supabaseAdmin
      .from("lobbies")
      .insert(insert)
      .select()
      .single();

    if (insertErr || !lobby) {
      throw insertErr || new Error("Lobby insert failed");
    }

    // add owner as member
    const { error: memberErr } = await supabaseAdmin.from("lobby_members").insert({
      lobby_id: lobby.id,
      user_id: ownerUserId,
      role: "owner",
      joined_at: new Date().toISOString(),
    });

    if (memberErr) {
      logger.error("[createLobby] Failed to add owner as member, continuing:", memberErr);
      // non-fatal: lobby exists, but warn
    }

    // Update user's metadata: last_created_lobby
    const dbUser = await dbFetchUserData(ownerUserId);
    const currentMeta = (dbUser && dbUser.metadata) ? dbUser.metadata : {};
    const newMeta = {
      ...currentMeta,
      last_created_lobby: { id: lobby.id, name: lobby.name, created_at: lobby.created_at },
    };

    const updateResult = await dbUpdateUserMetadata(ownerUserId, newMeta);
    if (!updateResult.success) {
      logger.warn(`[createLobby] Warning: failed to update user metadata for ${ownerUserId}: ${updateResult.error}`);
    }

    return { success: true, lobby };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    logger.error("[createLobby] Error:", e);
    return { success: false, error: msg };
  }
}

/**
 * Join a lobby (adds record to lobby_members).
 */
export async function joinLobby(userId: string, lobbyId: string): Promise<{ success: boolean; error?: string }> {
  if (!userId || !lobbyId) return { success: false, error: "userId and lobbyId required" };
  if (!supabaseAdmin) return { success: false, error: "DB admin client missing" };

  try {
    // Check membership exists
    const { data: existing, error: existErr } = await supabaseAdmin
      .from("lobby_members")
      .select("id")
      .eq("lobby_id", lobbyId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existErr) throw existErr;
    if (existing) return { success: true }; // already member

    const { error } = await supabaseAdmin.from("lobby_members").insert({
      lobby_id: lobbyId,
      user_id: userId,
      role: "member",
      joined_at: new Date().toISOString(),
    });

    if (error) throw error;

    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    logger.error("[joinLobby] Error:", e);
    return { success: false, error: msg };
  }
}

/**
 * Read open lobbies (for the client to show).
 */
export async function getOpenLobbies(): Promise<{ success: boolean; data?: LobbyRow[]; error?: string }> {
  if (!supabaseAdmin) return { success: false, error: "DB admin client missing" };
  try {
    const { data, error } = await supabaseAdmin
      .from("lobbies")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    logger.error("[getOpenLobbies] Error:", e);
    return { success: false, error: msg };
  }
}

/**
 * Save arbitrary user preferences into users.metadata (merges client partials).
 * Use this to store preferences like preferred_game_mode, notify_on_invite, preferred_field_id etc.
 */
export async function updateUserPreferences(userId: string, partialPrefs: Record<string, any>): Promise<{ success: boolean; error?: string }> {
  if (!userId) return { success: false, error: "userId required" };
  try {
    const dbUser = await dbFetchUserData(userId);
    if (!dbUser) return { success: false, error: "User not found" };
    const currentMetadata = dbUser.metadata || {};
    const merged = { ...currentMetadata, ...partialPrefs };
    const res = await dbUpdateUserMetadata(userId, merged);
    if (!res.success) return { success: false, error: res.error };
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    logger.error("[updateUserPreferences] Error:", e);
    return { success: false, error: msg };
  }
}