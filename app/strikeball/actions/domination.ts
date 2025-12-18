"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";

/**
 * Admin: Create a Checkpoint (e.g. "Alpha")
 */
export async function createCheckpoint(lobbyId: string, name: string) {
    try {
        const { data, error } = await supabaseAdmin
            .from("lobby_checkpoints")
            .insert({ lobby_id: lobbyId, name })
            .select()
            .single();
        
        if (error) throw error;
        return { success: true, data };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Player: Capture a Point (Called when scanning QR)
 */
export async function captureCheckpoint(userId: string, checkpointId: string) {
    try {
        // 1. Identify User Team
        const { data: member } = await supabaseAdmin
            .from("lobby_members")
            .select("team, lobby_id, status")
            .eq("user_id", userId)
            .single(); // We assume member is in the correct lobby via context of QR, or we lookup
        
        // Wait, if QR is just ID, we need to find which lobby this checkpoint belongs to first?
        // Actually, let's fetch checkpoint first to get lobby_id.
        
        const { data: point } = await supabaseAdmin
            .from("lobby_checkpoints")
            .select("*, lobby:lobbies(owner_id)")
            .eq("id", checkpointId)
            .single();

        if (!point) return { success: false, error: "Target not found" };

        // 2. Validate Membership & Life Status
        // If we didn't fetch member earlier using lobby_id, do it now
        const { data: activeMember } = await supabaseAdmin
            .from("lobby_members")
            .select("team, status")
            .eq("lobby_id", point.lobby_id)
            .eq("user_id", userId)
            .single();

        if (!activeMember) return { success: false, error: "Not deployed in this operation" };
        if (activeMember.status === 'dead') return { success: false, error: "Dead men can't capture!" };
        if (point.owner_team === activeMember.team) return { success: false, error: "Already under control" };

        // 3. CAPTURE!
        await supabaseAdmin
            .from("lobby_checkpoints")
            .update({ 
                owner_team: activeMember.team, 
                captured_at: new Date().toISOString(),
                captured_by: userId
            })
            .eq("id", checkpointId);

        // 4. Notify Lobby Owner (The Commander)
        // (Optional: can be noisy, maybe rely on Realtime HUD instead)
        // await sendComplexMessage(point.lobby.owner_id, `🚩 **POINT ${point.name} LOST!**\nCaptured by ${activeMember.team.toUpperCase()}`);

        return { success: true, message: `Captured ${point.name} for ${activeMember.team.toUpperCase()}!` };

    } catch (e: any) {
        logger.error("Capture Failed", e);
        return { success: false, error: "Capture failed" };
    }
}

/**
 * Get all points for a lobby
 */
export async function getLobbyCheckpoints(lobbyId: string) {
    const { data } = await supabaseAdmin.from("lobby_checkpoints").select("*").eq("lobby_id", lobbyId).order('name');
    return { success: true, data: data || [] };
}