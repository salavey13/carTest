"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { createStrikeballLobby } from "./lobby";
import { logger } from "@/lib/logger";

// Helper to create a match node
async function createMatchNode(
    tourneyId: string, 
    round: number, 
    order: number, 
    c1: string | null, 
    c2: string | null, 
    nextId: string | null, 
    nextSlot: number | null, // 1 or 2
    userId: string
) {
    // Create Lobby
    const { lobbyId } = await createStrikeballLobby(userId, {
        name: `T-Match R${round}-${order}`,
        mode: 'competetive',
        max_players: 10
    }) as any;

    const { data, error } = await supabaseAdmin.from("tournament_matches").insert({
        tournament_id: tourneyId,
        round: round,
        match_order: order,
        next_match_id: nextId,
        next_match_slot: nextSlot, // Save the slot info
        crew1_id: c1,
        crew2_id: c2,
        lobby_id: lobbyId,
        status: 'pending'
    }).select().single();
    
    if (error) throw error;
    return data;
}

export async function createTournament(userId: string, name: string, crewIds: string[]) {
    try {
        if (crewIds.length !== 4) throw new Error("MVP supports exactly 4 crews for now.");
        
        // 1. Create Tournament
        const { data: tourney, error: tErr } = await supabaseAdmin
            .from("tournaments")
            .insert({ name, created_by: userId, status: 'active' })
            .select()
            .single();

        if (tErr) throw tErr;

        // 2. Create Final (Round 2) - No next match
        const finalMatch = await createMatchNode(tourney.id, 2, 0, null, null, null, null, userId);

        // 3. Create Semis (Round 1) - Feed into Final
        // Semi 1 -> Final Slot 1
        await createMatchNode(tourney.id, 1, 0, crewIds[0], crewIds[1], finalMatch.id, 1, userId);
        // Semi 2 -> Final Slot 2
        await createMatchNode(tourney.id, 1, 1, crewIds[2], crewIds[3], finalMatch.id, 2, userId);

        return { success: true, id: tourney.id };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function fetchTournament(id: string) {
    const { data: tourney } = await supabaseAdmin.from("tournaments").select("*").eq("id", id).single();
    const { data: matches } = await supabaseAdmin
        .from("tournament_matches")
        .select(`
            *,
            crew1:crews!crew1_id(name, logo_url),
            crew2:crews!crew2_id(name, logo_url),
            winner_crew:crews!winner_crew_id(name),
            lobby:lobbies(status, winner)
        `)
        .eq("tournament_id", id)
        .order('round', { ascending: true })
        .order('match_order', { ascending: true });
        
    return { tourney, matches };
}

/**
 * ADMIN: Declare a winner and advance them to the next match.
 */
export async function advanceMatch(matchId: string, winnerCrewId: string) {
    try {
        // 1. Get current match details
        const { data: match } = await supabaseAdmin.from("tournament_matches").select("*").eq("id", matchId).single();
        if (!match) throw new Error("Match not found");

        // 2. Update current match
        await supabaseAdmin.from("tournament_matches").update({
            winner_crew_id: winnerCrewId,
            status: 'completed'
        }).eq("id", matchId);

        // 3. Propagate to Next Match (if exists)
        if (match.next_match_id && match.next_match_slot) {
            const updateField = match.next_match_slot === 1 ? 'crew1_id' : 'crew2_id';
            
            await supabaseAdmin.from("tournament_matches")
                .update({ [updateField]: winnerCrewId })
                .eq("id", match.next_match_id);
        }

        return { success: true, message: "Winner advanced!" };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}