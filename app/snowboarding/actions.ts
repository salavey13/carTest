"use server";

import { supabaseAdmin } from "@/hooks/supabase";

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
                    packages: snowboardService?.packages || []
                };
            });
            
        return { success: true, data: snowboardInstructors };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}