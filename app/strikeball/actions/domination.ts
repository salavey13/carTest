"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";

export async function createCheckpoint(lobbyId: string, name: string) {
    try {
        const { data, error } = await supabaseAdmin.from("lobby_checkpoints").insert({ lobby_id: lobbyId, name }).select().single();
        if (error) throw error;
        return { success: true, data };
    } catch (e: any) { return { success: false, error: e.message }; }
}

/**
 * Player: Capture a Point (Called when scanning QR)
 * UPDATE: If player is DEAD and scans a point OWNED BY THEIR TEAM, respawn them.
 */
export async function captureCheckpoint(userId: string, checkpointId: string) {
    try {
        // 1. Get Point Info
        const { data: point } = await supabaseAdmin.from("lobby_checkpoints").select("*").eq("id", checkpointId).single();
        if (!point) return { success: false, error: "Target not found" };

        // 2. Get Member Info
        const { data: activeMember } = await supabaseAdmin.from("lobby_members").select("id, team, status").eq("lobby_id", point.lobby_id).eq("user_id", userId).single();
        if (!activeMember) return { success: false, error: "Not deployed" };

        // --- NEW: RESPAWN LOGIC ---
        if (activeMember.status === 'dead') {
             if (point.owner_team === activeMember.team) {
                 // Respawn!
                 await supabaseAdmin.from("lobby_members").update({ status: 'alive' }).eq("id", activeMember.id);
                 return { success: true, message: "ВЫ ВОЗРОЖДЕНЫ НА ТОЧКЕ!" };
             } else {
                 return { success: false, error: "Нельзя возродиться на вражеской точке!" };
             }
        }

        // 3. CAPTURE LOGIC
        if (point.owner_team === activeMember.team) return { success: false, error: "Точка уже ваша" };

        await supabaseAdmin.from("lobby_checkpoints").update({ 
            owner_team: activeMember.team, 
            captured_at: new Date().toISOString(),
            captured_by: userId
        }).eq("id", checkpointId);

        return { success: true, message: `Точка ${point.name} захвачена!` };

    } catch (e: any) {
        logger.error("Capture Failed", e);
        return { success: false, error: "Capture failed" };
    }
}

export async function getLobbyCheckpoints(lobbyId: string) {
    const { data } = await supabaseAdmin.from("lobby_checkpoints").select("*").eq("lobby_id", lobbyId).order('name');
    return { success: true, data: data || [] };
}