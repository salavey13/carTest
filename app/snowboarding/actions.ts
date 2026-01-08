"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { logger } from "@/lib/logger";

const BOT_APP_URL = "https://t.me/oneSitePlsBot/app";

/**
 * Fetches instructors/coaches based on a specific service ID (e.g. 'snowboard_instructor', 'dota2_coach')
 */
export async function getInstructorsByService(serviceId: string) {
    try {
        const { data: providers, error } = await supabaseAdmin
            .from('crews')
            .select('*')
            .eq('metadata->>is_provider', 'true');
            
        if (error) throw error;
        
        const filtered = providers
            .filter(p => p.metadata.services?.some((s: any) => s.id === serviceId))
            .map(p => {
                const service = p.metadata.services?.find((s: any) => s.id === serviceId);
                const minPrice = Math.min(...(service?.packages?.map((pkg: any) => pkg.price) || [0]));
                
                return {
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
                    logo_url: p.logo_url,
                    rating: p.metadata.rating || 5.0,
                    reviews: p.metadata.reviews || Math.floor(Math.random() * 20),
                    description: service?.description || '',
                    location: service?.location_details?.address || p.hq_location || 'Remote/Online',
                    working_hours: p.metadata.contacts?.working_hours || '10:00 - 22:00',
                    min_price: minPrice,
                    packages: service?.packages || [],
                    owner_id: p.owner_id,
                    benefits: service?.benefits || []
                };
            });
            
        return { success: true, data: filtered };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * 1-CLICK LOBBY CREATION (GENERIC)
 * Works for Snowboarding, Skiing, or Dota 2 Training.
 */
export async function createInstructorLobby(
  clientUserId: string, 
  providerId: string, 
  packageId: string,
  serviceId: string
) {
  try {
    const { data: provider } = await supabaseAdmin.from('crews').select('*').eq('id', providerId).single();
    if (!provider) throw new Error("Operator not found");

    const service = provider.metadata.services?.find((s: any) => s.id === serviceId);
    const selectedPackage = service?.packages?.find((pkg: any) => pkg.id === packageId);
    if (!selectedPackage) throw new Error("Protocol (Package) not found");

    // Mapping service to Lobby Modes
    const modeMapping: Record<string, string> = {
        'snowboard_instructor': 'SNOWBOARD',
        'ski_instructor': 'SKI',
        'dota2_coach': 'LAN PARTY',
        'strikeball_instructor': 'STRIKEBALL'
    };

    const lobbyMode = modeMapping[serviceId] || 'CUSTOM';
    const lobbyName = `${service.name} @ ${provider.name}`;
    
    // Create the Lobby
    const { data: lobby, error: lobbyError } = await supabaseAdmin
      .from("lobbies")
      .insert({
        name: lobbyName,
        owner_id: clientUserId,
        mode: lobbyMode,
        status: "open",
        start_at: new Date().toISOString(),
        max_players: 5,
        crew_id: providerId,
        field_id: service.location_details?.address || 'Online',
        metadata: {
            selected_offer: { serviceName: selectedPackage.name, price: selectedPackage.price, serviceId: service.id },
            description: `Тренировка: ${selectedPackage.name}\nСостав: ${selectedPackage.includes}`
        }
      })
      .select().single();

    if (lobbyError) throw lobbyError;

    // Join Client as Leader
    await supabaseAdmin.from("lobby_members").insert({
      lobby_id: lobby.id,
      user_id: clientUserId,
      role: 'owner',
      team: "blue",
      status: "ready"
    });

    const lobbyLink = `${BOT_APP_URL}?startapp=lobby_${lobby.id}`;

    // NOTIFY PROVIDER
    await sendComplexMessage(provider.owner_id, `
🎯 <b>НОВЫЙ КОНТРАКТ</b>
👤 Клиент забронировал: <b>${selectedPackage.name}</b>
💰 Сумма: ${selectedPackage.price} RUB

Подтвердите готовность в Лобби.
👉 <a href="${lobbyLink}">ОТКРЫТЬ УПРАВЛЕНИЕ</a>
    `, [], { parseMode: 'HTML', imageQuery: 'tactical gear' });

    return { success: true, lobbyId: lobby.id };
  } catch (e: any) {
    logger.error("[createInstructorLobby] Failed:", e);
    return { success: false, error: e.message };
  }
}