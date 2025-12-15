"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";

export async function getUserCombatStats(userId: string) {
    if (!userId) return { success: false };

    try {
        // 1. Get all lobbies the user has joined
        const { data: memberships, error: memberError } = await supabaseAdmin
            .from("lobby_members")
            .select("lobby_id, team")
            .eq("user_id", userId);

        if (memberError) throw memberError;
        if (!memberships || memberships.length === 0) {
            return { success: true, data: { matches: 0, wins: 0, kd: "0.0", accuracy: "N/A" } };
        }

        const lobbyIds = memberships.map(m => m.lobby_id);

        // 2. Fetch details for these lobbies (only finished ones)
        const { data: lobbies, error: lobbyError } = await supabaseAdmin
            .from("lobbies")
            .select("id, status, metadata")
            .in("id", lobbyIds)
            .eq("status", "finished");

        if (lobbyError) throw lobbyError;

        // 3. Calculate Stats in JavaScript (More reliable than complex SQL for JSONB)
        let wins = 0;
        const matches = lobbies?.length || 0;

        lobbies?.forEach(lobby => {
            // Find which team the user was on for this specific lobby
            const userMembership = memberships.find(m => m.lobby_id === lobby.id);
            if (!userMembership) return;

            const userTeam = userMembership.team?.toLowerCase();
            const winner = lobby.metadata?.winner?.toLowerCase();

            // Check if user's team matches the winner
            if (userTeam && winner && userTeam === winner) {
                wins++;
            }
        });

        // Mock K/D and Accuracy (until we track individual kills)
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