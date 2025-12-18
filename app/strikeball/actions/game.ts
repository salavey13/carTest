"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

export async function startGame(lobbyId: string, userId: string) {
  try {
    const { data: lobby } = await supabaseAdmin.from("lobbies").select("owner_id, metadata").eq("id", lobbyId).single();
    if (!lobby || lobby.owner_id !== userId) throw new Error("ACCESS DENIED");

    const newMeta = { ...lobby.metadata, actual_start_at: new Date().toISOString(), score: { red: 0, blue: 0 } };
    const { error: lobbyError } = await supabaseAdmin.from("lobbies").update({ status: 'active', metadata: newMeta }).eq("id", lobbyId);
    if (lobbyError) throw lobbyError;

    const { error: membersError } = await supabaseAdmin.from("lobby_members").update({ status: 'alive' }).eq("lobby_id", lobbyId);
    if (membersError) logger.warn("Failed to set members to alive", membersError);
    
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function endGame(lobbyId: string, userId: string, winner: 'red' | 'blue' | 'draw') {
  try {
    const { data: lobby } = await supabaseAdmin.from("lobbies").select("owner_id, metadata").eq("id", lobbyId).single();
    if (!lobby || lobby.owner_id !== userId) throw new Error("ACCESS DENIED");

    const newMeta = { ...lobby.metadata, actual_end_at: new Date().toISOString(), winner: winner };
    const { error } = await supabaseAdmin.from("lobbies").update({ status: 'finished', metadata: newMeta }).eq("id", lobbyId);
    if (error) throw error;
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function updateScore(lobbyId: string, userId: string, team: 'red' | 'blue', delta: number) {
  try {
    const { data: lobby } = await supabaseAdmin.from("lobbies").select("owner_id, metadata").eq("id", lobbyId).single();
    if (!lobby || lobby.owner_id !== userId) throw new Error("ACCESS DENIED");

    const currentScore = lobby.metadata?.score || { red: 0, blue: 0 };
    const newScoreVal = Math.max(0, (currentScore[team] || 0) + delta);
    const newMeta = { ...lobby.metadata, score: { ...currentScore, [team]: newScoreVal } };

    const { error } = await supabaseAdmin.from("lobbies").update({ metadata: newMeta }).eq("id", lobbyId);
    if (error) throw error;
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function playerHit(lobbyId: string, memberId: string) {
    try {
        const { data: member } = await supabaseAdmin.from("lobby_members").select("team, status").eq("id", memberId).single();
        if (!member || member.status === 'dead') return { success: false, error: "Invalid state" };

        await supabaseAdmin.from("lobby_members").update({ status: 'dead', joined_at: new Date().toISOString() }).eq("id", memberId);

        const { data: lobby } = await supabaseAdmin.from("lobbies").select("metadata").eq("id", lobbyId).single();
        const currentScore = lobby?.metadata?.score || { red: 0, blue: 0 };
        const enemyTeam = member.team === 'blue' ? 'red' : 'blue';
        const newScore = { ...currentScore, [enemyTeam]: (currentScore[enemyTeam] || 0) + 1 };

        await supabaseAdmin.from("lobbies").update({ metadata: { ...lobby.metadata, score: newScore } }).eq("id", lobbyId);

        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

/**
 * Revive Player. 
 * Supports respawning at a specific checkpoint.
 */
export async function playerRespawn(lobbyId: string, memberId: string, checkpointId?: string) {
    try {
        // 1. Verify Checkpoint Ownership (if provided)
        if (checkpointId) {
             const { data: member } = await supabaseAdmin.from("lobby_members").select("team").eq("id", memberId).single();
             const { data: cp } = await supabaseAdmin.from("lobby_checkpoints").select("owner_team").eq("id", checkpointId).single();
             
             if (!member || !cp) throw new Error("Invalid respawn target");
             
             // Rule: Can only respawn if your team owns it.
             if (cp.owner_team !== member.team) {
                 return { success: false, error: "Cannot respawn at enemy point!" };
             }
        }

        await supabaseAdmin
            .from("lobby_members")
            .update({ status: 'alive' })
            .eq("id", memberId);
            
        return { success: true, message: checkpointId ? "Deployed at Checkpoint" : "Respawned at Base" };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}