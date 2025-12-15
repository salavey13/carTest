"use server";

import { supabaseAdmin } from "@/hooks/supabase";

export async function getUserCombatStats(userId: string) {
    if (!userId) return { success: false };

    try {
        // 1. Fetch completed lobbies user was in
        // Join lobbies where status is 'finished'
        const { data: history, error } = await supabaseAdmin
            .from("lobby_members")
            .select(`
                team, 
                status, 
                lobby:lobbies!inner(status, winner, created_at)
            `)
            .eq("user_id", userId)
            .eq("lobby.status", "finished"); // Filter deeply on joined resource

        if (error) throw error;

        // 2. Calculate
        const matches = history?.length || 0;
        
        const wins = history?.filter((h: any) => {
            const myTeam = h.team?.toLowerCase();
            const winningTeam = h.lobby?.winner?.toLowerCase();
            return myTeam && winningTeam && myTeam === winningTeam;
        }).length || 0;
        
        // Mock K/D and Accuracy for now as we don't track kills per player yet
        // In a real implementation, you'd sum up a 'kills' column from lobby_members
        const kd = (Math.random() * 2 + 0.5).toFixed(2); 

        return {
            success: true,
            data: {
                matches,
                wins,
                kd,
                accuracy: "64%" 
            }
        };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}