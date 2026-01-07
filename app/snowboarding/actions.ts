"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";

export async function getSnowboardInstructors() {
    try {
        const { data: providers, error } = await supabaseAdmin
            .from('crews')
            .select('*')
            .eq('metadata->>is_provider', 'true');
            
        if (error) throw error;
        
        // Filter providers that offer snowboard instruction
        const snowboardInstructors = providers
            .filter(p => 
                p.metadata.services?.some((s: any) => s.id === 'snowboard_instructor')
            )
            .map(p => {
                const snowboardService = p.metadata.services?.find((s: any) => s.id === 'snowboard_instructor');
                const minPrice = Math.min(...(snowboardService?.packages?.map((pkg: any) => pkg.price) || [0]));
                
                return {
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
                    logo_url: p.logo_url,
                    rating: p.metadata.rating || 0,
                    reviews: p.metadata.reviews || 0,
                    description: snowboardService?.description || '',
                    location: snowboardService?.location_details?.address || p.hq_location || 'Не указано',
                    working_hours: p.metadata.contacts?.working_hours || 'Не указано',
                    contacts: p.metadata.contacts || {},
                    min_price: minPrice,
                    experience: p.metadata.experience || 'Не указано',
                    packages: snowboardService?.packages || [],
                    owner_id: p.owner_id, // Crucial for sending notifications
                    telegram_handle: snowboardService?.how_to_book?.telegram // Optional override
                };
            });
            
        return { success: true, data: snowboardInstructors };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function bookSnowboardLesson(providerId: string, packageId: string, clientUserId: string) {
    try {
        // 1. Fetch Provider Details
        const { data: provider, error: providerError } = await supabaseAdmin
            .from('crews')
            .select('name, slug, logo_url, owner_id, metadata')
            .eq('id', providerId)
            .single();

        if (providerError || !provider) throw new Error("Provider not found");

        // 2. Locate the specific service and package
        const service = provider.metadata.services?.find((s: any) => s.id === 'snowboard_instructor');
        if (!service) throw new Error("Snowboarding service not found for this provider");

        const selectedPackage = service.packages?.find((pkg: any) => pkg.id === packageId);
        if (!selectedPackage) throw new Error("Package not found");

        // 3. Fetch Client Name for notification
        const { data: clientUser } = await supabaseAdmin
            .from('users')
            .select('username, full_name')
            .eq('user_id', clientUserId)
            .single();

        const clientName = clientUser?.full_name || clientUser?.username || "Rider";

        // 4. Prepare Notification
        // Link to the Web App general lobby入口
        const webAppUrl = "https://t.me/oneSitePlsBot/app";
        
        const messageText = `
🏂 <b>NEW BOOKING REQUEST</b>
📦 <b>Package:</b> ${selectedPackage.name}
💰 <b>Price:</b> ${selectedPackage.price} RUB
👤 <b>Client:</b> ${clientName}

⚠️ <b>Next Step:</b>
Please follow the link below to create a lobby and coordinate dates/times directly with the client.
🔗 <a href="${webAppUrl}">OPEN LOBBY IN APP</a>
        `;

        const chatId = provider.telegram_handle && provider.telegram_handle.startsWith('@') 
            ? provider.telegram_handle 
            : provider.owner_id;

        // Send to Provider (Owner or specific handle)
        await sendComplexMessage(chatId, messageText, [], {
            parseMode: 'HTML',
            imageQuery: 'snowboard slope' // Adds a random cool image
        });

        return { success: true, message: "Request sent to instructor!" };

    } catch (e: any) {
        return { success: false, error: e.message };
    }
}