"use server";

import { supabaseAdmin } from "@/hooks/supabase";

export async function getUserCombatStats(userId: string) {
    if (!userId) return { success: false };

    try {
        // 1. Fetch member history
        // We use !inner to enforce that the lobby exists and matches filters
        const { data: history, error } = await supabaseAdmin
            .from("lobby_members")
            .select(`
                team, 
                status,
                lobbies!inner(status, winner)
            `)
            .eq("user_id", userId)
            .eq("lobbies.status", "finished");

        if (error) throw error;

        // 2. Calculate Stats
        const matches = history?.length || 0;
        
        let wins = 0;
        if (history) {
            wins = history.filter((h: any) => {
                const lobbyWinner = h.lobbies?.winner;
                return lobbyWinner && lobbyWinner === h.team;
            }).length;
        }
        
        // Mock data for K/D until we track individual kills
        // You could store 'kills' in lobby_members metadata later
        const kd = (Math.random() * 2 + 0.5).toFixed(2); 

        return {
            success: true,
            data: {
                matches,
                wins,
                kd,
                accuracy: "N/A" 
            }
        };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}