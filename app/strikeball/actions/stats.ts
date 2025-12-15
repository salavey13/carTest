"use server";

import { supabaseAdmin } from "@/hooks/supabase";

export async function getUserCombatStats(userId: string) {
    if (!userId) return { success: false };

    try {
        // 1. Fetch completed lobbies user was in
        // NOTE: We need to query lobby_members joined with lobbies where status = finished
        const { data: history, error } = await supabaseAdmin
            .from("lobby_members")
            .select("team, status, lobbies(winner)")
            .eq("user_id", userId)
            .not("lobbies", "is", null);

        if (error) throw error;

        // 2. Calculate
        const matches = history?.length || 0;
        const wins = history?.filter((h: any) => h.lobbies?.winner === h.team).length || 0;
        
        // Mock data for now until we track kills per player
        const kd = (Math.random() * 2 + 0.5).toFixed(2); 

        return {
            success: true,
            data: {
                matches,
                wins,
                kd,
                accuracy: "64%" // Mock
            }
        };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}