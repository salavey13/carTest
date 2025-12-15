"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";

export async function getUserCombatStats(userId: string) {
    if (!userId) return { success: false };

    try {
        // Fetch ALL history first, then filter in code to be 100% sure of data shape
        const { data: history, error } = await supabaseAdmin
            .from("lobby_members")
            .select(`
                team, 
                status,
                lobby:lobbies(status, winner)
            `)
            .eq("user_id", userId);

        if (error) throw error;

        // Filter for finished games only
        const finishedGames = history?.filter((h: any) => h.lobby?.status === 'finished') || [];
        
        const matches = finishedGames.length;
        
        // Count wins
        const wins = finishedGames.filter((h: any) => {
            const lobbyWinner = h.lobby?.winner;
            // Ensure both are defined and match
            return lobbyWinner && h.team && lobbyWinner.toLowerCase() === h.team.toLowerCase();
        }).length;
        
        // Mock K/D for now (random but consistent for demo)
        const kd = (matches > 0 ? (wins / matches * 1.5 + 0.5) : 0.0).toFixed(2); 

        return {
            success: true,
            data: {
                matches,
                wins,
                kd,
                accuracy: matches > 0 ? "64%" : "N/A"
            }
        };

    } catch (e: any) {
        logger.error("getUserCombatStats failed", e);
        return { success: false, error: e.message };
    }
}