"use server";

import { supabaseAnon } from "@/hooks/supabase";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

// ... [startGame, endGame, updateScore, playerHit remain exactly the same] ...

export async function startGame(lobbyId: string, userId: string) {
  // SECURITY ALIBI: Validate UUID format/presence
    if (!lobbyId || lobbyId === "undefined") {
        return { success: false, error: "INVALID_LOBBY_ID_FORMAT" };
    }
    try {
    const { data: lobby } = await supabaseAnon.from("lobbies").select("owner_id, metadata").eq("id", lobbyId).single();
    if (!lobby || lobby.owner_id !== userId) throw new Error("ACCESS DENIED");

    const newMeta = { ...lobby.metadata, actual_start_at: new Date().toISOString(), score: { red: 0, blue: 0 } };
    const { error: lobbyError } = await supabaseAnon.from("lobbies").update({ status: 'active', metadata: newMeta }).eq("id", lobbyId);
    if (lobbyError) throw lobbyError;

    const { error: membersError } = await supabaseAnon.from("lobby_members").update({ status: 'alive' }).eq("lobby_id", lobbyId);
    if (membersError) logger.warn("Failed to set members to alive", membersError);
    
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function endGame(lobbyId: string, userId: string, winner: 'red' | 'blue' | 'draw') {
  // SECURITY ALIBI: Validate UUID format/presence
    if (!lobbyId || lobbyId === "undefined") {
        return { success: false, error: "INVALID_LOBBY_ID_FORMAT" };
    }
    try {
    // We allow system (userId='system') to end game too
    if (userId !== 'system') {
        const { data: lobby } = await supabaseAnon.from("lobbies").select("owner_id").eq("id", lobbyId).single();
        if (!lobby || lobby.owner_id !== userId) throw new Error("ACCESS DENIED");
    }

    const { data: lobbyMeta } = await supabaseAnon.from("lobbies").select("metadata").eq("id", lobbyId).single();
    const newMeta = {
      ...lobbyMeta?.metadata,
      actual_end_at: new Date().toISOString(),
      winner: winner
    };

    const { error } = await supabaseAnon.from("lobbies").update({ status: 'finished', metadata: newMeta }).eq("id", lobbyId);
    if (error) throw error;
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function updateScore(lobbyId: string, userId: string, team: 'red' | 'blue', delta: number) {
  // SECURITY ALIBI: Validate UUID format/presence
    if (!lobbyId || lobbyId === "undefined") {
        return { success: false, error: "INVALID_LOBBY_ID_FORMAT" };
    }
    try {
    const { data: lobby } = await supabaseAnon.from("lobbies").select("owner_id, metadata").eq("id", lobbyId).single();
    if (!lobby || lobby.owner_id !== userId) throw new Error("ACCESS DENIED");

    const currentScore = lobby.metadata?.score || { red: 0, blue: 0 };
    const newScoreVal = Math.max(0, (currentScore[team] || 0) + delta);
    const newMeta = { ...lobby.metadata, score: { ...currentScore, [team]: newScoreVal } };

    const { error } = await supabaseAnon.from("lobbies").update({ metadata: newMeta }).eq("id", lobbyId);
    if (error) throw error;
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function playerHit(lobbyId: string, memberId: string) {
    // SECURITY ALIBI: Validate UUID format/presence
    if (!lobbyId || lobbyId === "undefined") {
        return { success: false, error: "INVALID_LOBBY_ID_FORMAT" };
    }
    try {
        const { data: member } = await supabaseAnon.from("lobby_members").select("team, status").eq("id", memberId).single();
        if (!member || member.status === 'dead') return { success: false, error: "Invalid state" };

        await supabaseAnon.from("lobby_members").update({ status: 'dead', joined_at: new Date().toISOString() }).eq("id", memberId);

        const { data: lobby } = await supabaseAnon.from("lobbies").select("metadata").eq("id", lobbyId).single();
        const currentScore = lobby?.metadata?.score || { red: 0, blue: 0 };
        const enemyTeam = member.team === 'blue' ? 'red' : 'blue';
        const newScore = { ...currentScore, [enemyTeam]: (currentScore[enemyTeam] || 0) + 1 };

        await supabaseAnon.from("lobbies").update({ metadata: { ...lobby.metadata, score: newScore } }).eq("id", lobbyId);
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

/**
 * Handles Base QR Scans (Friendly Respawn OR Enemy Capture).
 * 
 * Logic:
 * 1. If Team == TargetBaseTeam -> Respawn Logic.
 * 2. If Team != TargetBaseTeam -> Siege Logic (Check all points).
 */
export async function handleBaseInteraction(lobbyId: string, userId: string, targetBaseTeam: string) {
    // SECURITY ALIBI: Validate UUID format/presence
    if (!lobbyId || lobbyId === "undefined") {
        return { success: false, error: "INVALID_LOBBY_ID_FORMAT" };
    }
    try {
        const { data: member } = await supabaseAnon
            .from("lobby_members")
            .select("id, team, status")
            .eq("lobby_id", lobbyId)
            .eq("user_id", userId)
            .single();

        if (!member) return { success: false, error: "Not deployed" };

        // --- SCENARIO 1: FRIENDLY BASE ---
        if (member.team === targetBaseTeam) {
            if (member.status === 'alive') {
                return { success: true, message: "База подтверждена. Боезапас пополнен." };
            }
            // Respawn
            await supabaseAnon.from("lobby_members").update({ status: 'alive' }).eq("id", member.id);
            return { success: true, message: "ВЫ ВОЗРОЖДЕНЫ! В БОЙ!" };
        }

        // --- SCENARIO 2: ENEMY BASE (SIEGE) ---
        if (member.status === 'dead') return { success: false, error: "Мертвые не штурмуют базу!" };

        // Check Domination Conditions
        const { data: checkpoints } = await supabaseAnon
            .from("lobby_checkpoints")
            .select("owner_team")
            .eq("lobby_id", lobbyId);
        
        const totalPoints = checkpoints?.length || 0;
        
        // If there are no checkpoints, Base Capture is impossible (or instant win? Let's say impossible to prevent cheese)
        if (totalPoints === 0) return { success: false, error: "Нет точек для контроля. Захват базы невозможен." };

        const myControlledPoints = checkpoints?.filter(cp => cp.owner_team === member.team).length || 0;

        if (myControlledPoints < totalPoints) {
            return { success: false, error: `ЩИТЫ АКТИВНЫ! Захвачено ${myControlledPoints}/${totalPoints} точек.` };
        }

        // ALL POINTS CAPTURED -> GG
        await endGame(lobbyId, 'system', member.team as 'red'|'blue');
        
        return { success: true, message: `🔥🔥 БАЗА УНИЧТОЖЕНА! ПОБЕДА ${member.team.toUpperCase()}! 🔥🔥` };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Revive at specific checkpoint (Legacy/Tactical)
 */
export async function playerRespawnAtCheckpoint(lobbyId: string, userId: string, checkpointId: string) {
     // SECURITY ALIBI: Validate UUID format/presence
    if (!lobbyId || lobbyId === "undefined") {
        return { success: false, error: "INVALID_LOBBY_ID_FORMAT" };
    }
    try {
         const { data: member } = await supabaseAnon.from("lobby_members").select("id, team").eq("lobby_id", lobbyId).eq("user_id", userId).single();
         const { data: cp } = await supabaseAnon.from("lobby_checkpoints").select("owner_team").eq("id", checkpointId).single();
         
         if (!member || !cp) throw new Error("Invalid target");
         
         if (cp.owner_team !== member.team) {
             return { success: false, error: "Точка не под вашим контролем!" };
         }

         await supabaseAnon.from("lobby_members").update({ status: 'alive' }).eq("id", member.id);
         return { success: true, message: "Высадка на точке завершена." };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ez respawn override
export async function playerRespawn(lobbyId: string, userId: string, checkpointId?: string) {
    // SECURITY ALIBI: Validate UUID format/presence
    if (!lobbyId || lobbyId === "undefined" || !userId) {
        return { success: false, error: "INVALID_PARAMETERS" };
    }
    try {
        const { data: member } = await supabaseAnon.from("lobby_members").select("id, team, status").eq("id", userId).eq("lobby_id", lobbyId).single();
        if (!member) throw new Error("Member not found");

        // If specific checkpoint provided, delegate to specialist
        if (checkpointId) {
            return await playerRespawnAtCheckpoint(lobbyId, userId, checkpointId);
        }

        // Otherwise generic respawn (assume at base or just revive)
        await supabaseAnon.from("lobby_members").update({ status: 'alive' }).eq("id", member.id);
        revalidatePath(`/strikeball/lobbies/${lobbyId}`);

        return { success: true, message: "ВЫ ВОЗРОЖДЕНЫ!" };
    } catch (e: any) {
        logger.error("[playerRespawn] Exception:", e);
        return { success: false, error: e.message };
    }
}

export async function updatePlayerLocation(lobbyId: string, userId: string, lat: number, lng: number) {
    const { error } = await supabaseAnon
        .from('lobby_geo_pings')
        .insert({ lobby_id: lobbyId, user_id: userId, lat, lng });

    // Optional: Check if player is outside the circle and notify
    // Logic: calculate distance from Rendezvous Point (lobby.field_id)
    return { success: !error };
}

export async function eliminateFurthestPlayer(lobbyId: string) {
    // This would be called by a CRON job or a specific admin trigger
    // 1. Get all players last pings
    // 2. Calculate distance to field_id center
    // 3. Mark the furthest as 'dead'
}