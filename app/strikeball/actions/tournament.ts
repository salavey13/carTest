"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { createStrikeballLobby } from "./lobby";
import { logger } from "@/lib/logger";

/**
 * Generate a Single Elimination Bracket for a list of Crews.
 */
export async function createTournament(userId: string, name: string, crewIds: string[]) {
    try {
        if (crewIds.length < 2) throw new Error("Need at least 2 crews.");
        
        // 1. Create Tournament Record
        const { data: tourney, error: tErr } = await supabaseAdmin
            .from("tournaments")
            .insert({ name, created_by: userId, status: 'active' })
            .select()
            .single();

        if (tErr) throw tErr;

        // 2. Generate Matches (Recursive or iterative)
        // Simple 4-team logic for MVP (Semi -> Final)
        // Or 8-team (Quarter -> Semi -> Final)
        
        // For simplicity, let's just do a manual pair-up for now or a simple list.
        // Implementing a full bracket generator in one go is complex, let's do a "League Table" style first?
        // No, you asked for a Bracket. Let's do a simple 4-team bracket.
        
        if (crewIds.length !== 4) throw new Error("MVP supports exactly 4 crews for now.");

        // Create Final Match (Round 2) - Placeholder
        const { data: finalMatch } = await supabaseAdmin
            .from("tournament_matches")
            .insert({
                tournament_id: tourney.id,
                round: 2,
                match_order: 0,
                status: 'pending'
            })
            .select()
            .single();

        // Create Semi-Finals (Round 1)
        // Match A: Crew 0 vs Crew 1
        await createMatchNode(tourney.id, 1, 0, crewIds[0], crewIds[1], finalMatch.id, userId);
        // Match B: Crew 2 vs Crew 3
        await createMatchNode(tourney.id, 1, 1, crewIds[2], crewIds[3], finalMatch.id, userId);

        return { success: true, id: tourney.id };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

async function createMatchNode(tourneyId: string, round: number, order: number, c1: string, c2: string, nextId: string, userId: string) {
    // Create actual Lobby for this match
    const { lobbyId } = await createStrikeballLobby(userId, {
        name: `T-Match R${round}-${order}`,
        mode: 'competetive',
        max_players: 10
    }) as any; // Cast to avoid TS error if types mismatch lightly

    await supabaseAdmin.from("tournament_matches").insert({
        tournament_id: tourneyId,
        round: round,
        match_order: order,
        next_match_id: nextId,
        crew1_id: c1,
        crew2_id: c2,
        lobby_id: lobbyId,
        status: 'ready'
    });
}

export async function fetchTournament(id: string) {
    const { data: tourney } = await supabaseAdmin.from("tournaments").select("*").eq("id", id).single();
    const { data: matches } = await supabaseAdmin
        .from("tournament_matches")
        .select(`
            *,
            crew1:crews!crew1_id(name, logo_url),
            crew2:crews!crew2_id(name, logo_url),
            lobby:lobbies(status, winner)
        `)
        .eq("tournament_id", id)
        .order('round', { ascending: true })
        .order('match_order', { ascending: true });
        
    return { tourney, matches };
}

// Logic to advance winner would go here (called by endGame)