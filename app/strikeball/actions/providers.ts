"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { revalidatePath } from "next/cache";


export async function getProviderOffers(playerCount: number, activityId?: string) {
    const { data: providers, error } = await supabaseAdmin
        .from('crews')
        .select('*')
        .eq('metadata->>is_provider', 'true');

    if (error) return { success: false, error: error.message };

    const comparisons = providers.map(p => {
        const services = p.metadata.services || [];
        
        // Map through services and calculate price for the specific playerCount
        const validOffers = services
            .filter((s: any) => !activityId || s.id === activityId)
            .filter((s: any) => playerCount >= (s.min_players || 0))
            .map((s: any) => ({
                serviceName: s.name,
                serviceId: s.id,
                bestPackage: s.packages[0], // Assuming first is standard
                totalPrice: s.packages[0].price * playerCount,
                perPerson: s.packages[0].price
            }));

        return {
            providerName: p.name,
            providerSlug: p.slug,
            logo: p.logo_url,
            location: p.hq_location,
            offers: validOffers
        };
    }).filter(p => p.offers.length > 0);

    return { success: true, data: comparisons };
}

export async function selectProviderForLobby(lobbyId: string, providerId: string, offer: any) {
    try {
        // 1. Get current lobby metadata
        const { data: lobby } = await supabaseAdmin.from('lobbies').select('metadata').eq('id', lobbyId).single();
        
        const newMetadata = {
            ...lobby?.metadata,
            selected_offer: offer,
            approval_status: 'proposed' // Moves lobby to "Pending Provider Approval"
        };

        const { error } = await supabaseAdmin
            .from('lobbies')
            .update({ 
                provider_id: providerId,
                metadata: newMetadata 
            })
            .eq('id', lobbyId);

        if (error) throw error;
        
        revalidatePath(`/strikeball/lobbies/${lobbyId}`);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}