"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

/**
 * Starts the match. 
 * Sets status to 'active', records actual start time in metadata.
 */
export async function startGame(lobbyId: string, userId: string) {
  try {
    // Auth check: Is this the owner?
    const { data: lobby } = await supabaseAdmin.from("lobbies").select("owner_id, metadata").eq("id", lobbyId).single();
    if (!lobby || lobby.owner_id !== userId) throw new Error("ACCESS DENIED");

    const newMeta = {
      ...lobby.metadata,
      actual_start_at: new Date().toISOString(),
      score: { red: 0, blue: 0 } // Initialize score
    };

    const { error } = await supabaseAdmin
      .from("lobbies")
      .update({ status: 'active', metadata: newMeta })
      .eq("id", lobbyId);

    if (error) throw error;
    
    // Broadcast notification logic could go here
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Ends the match.
 * Sets status to 'finished', records end time.
 */
export async function endGame(lobbyId: string, userId: string, winner: 'red' | 'blue' | 'draw') {
  try {
    const { data: lobby } = await supabaseAdmin.from("lobbies").select("owner_id, metadata").eq("id", lobbyId).single();
    if (!lobby || lobby.owner_id !== userId) throw new Error("ACCESS DENIED");

    const newMeta = {
      ...lobby.metadata,
      actual_end_at: new Date().toISOString(),
      winner: winner
    };

    const { error } = await supabaseAdmin
      .from("lobbies")
      .update({ status: 'finished', metadata: newMeta })
      .eq("id", lobbyId);

    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Updates the score live.
 */
export async function updateScore(lobbyId: string, userId: string, team: 'red' | 'blue', delta: number) {
  try {
    const { data: lobby } = await supabaseAdmin.from("lobbies").select("owner_id, metadata").eq("id", lobbyId).single();
    // Allow owner AND maybe trusted refs (future) to update score. For now, owner only.
    if (!lobby || lobby.owner_id !== userId) throw new Error("ACCESS DENIED");

    const currentScore = lobby.metadata?.score || { red: 0, blue: 0 };
    const newScoreVal = Math.max(0, (currentScore[team] || 0) + delta);
    
    const newMeta = {
      ...lobby.metadata,
      score: { ...currentScore, [team]: newScoreVal }
    };

    const { error } = await supabaseAdmin
      .from("lobbies")
      .update({ metadata: newMeta })
      .eq("id", lobbyId);

    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}