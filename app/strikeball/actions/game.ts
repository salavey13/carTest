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

/**
 * Handles "I'M HIT" logic:
 * 1. Mark player as 'dead'.
 * 2. Increment opposing team's score.
 */
export async function playerHit(lobbyId: string, memberId: string) {
    try {
        // 1. Get Member Info
        const { data: member } = await supabaseAdmin
            .from("lobby_members")
            .select("team, status")
            .eq("id", memberId)
            .single();

        if (!member || member.status === 'dead') return { success: false, error: "Invalid state" };

        // 2. Mark Dead
        await supabaseAdmin
            .from("lobby_members")
            .update({ status: 'dead', death_time: new Date().toISOString() })
            .eq("id", memberId);

        // 3. Update Score (Opposing team gets point)
        const { data: lobby } = await supabaseAdmin.from("lobbies").select("metadata").eq("id", lobbyId).single();
        const currentScore = lobby?.metadata?.score || { red: 0, blue: 0 };
        const enemyTeam = member.team === 'blue' ? 'red' : 'blue';
        
        const newScore = {
            ...currentScore,
            [enemyTeam]: (currentScore[enemyTeam] || 0) + 1
        };

        await supabaseAdmin
            .from("lobbies")
            .update({ metadata: { ...lobby.metadata, score: newScore } })
            .eq("id", lobbyId);

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Revive Player (via QR Scan)
 */
export async function playerRespawn(lobbyId: string, memberId: string) {
    try {
        await supabaseAdmin
            .from("lobby_members")
            .update({ status: 'alive' })
            .eq("id", memberId);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}