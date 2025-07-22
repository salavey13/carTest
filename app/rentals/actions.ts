// /app/rentals/actions.ts
"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from 'next/cache';
import { sendComplexMessage } from "../webhook-handlers/actions/sendComplexMessage";
import { getBaseUrl } from "@/lib/utils";
import { v4 as uuidv4 } from 'uuid';

export async function getRentalDetails(rentalId: string, userId: string) {
    noStore();

    if (!rentalId) {
        logger.error("[getRentalDetails] Rental ID is required.");
        return { success: false, error: "Missing rental ID." };
    }
     if (!userId) {
        logger.error("[getRentalDetails] User ID was not provided to the action.");
        return { success: false, error: "Unauthorized." };
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('rentals')
            .select(`
                *,
                vehicle:cars(*),
                renter:users!rentals_user_id_fkey(*),
                owner:users!rentals_owner_id_fkey(*)
            `)
            .eq('rental_id', rentalId)
            .single();

        if (error) throw error;
        
        if (data.user_id !== userId && data.owner_id !== userId) {
            logger.warn(`[getRentalDetails] Unauthorized attempt to access rental ${rentalId} by user ${userId}.`);
            return { success: false, error: "Unauthorized access to rental details." };
        }

        return { success: true, data };

    } catch (error) {
        logger.error(`Error fetching rental details for ${rentalId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

async function appendToEventLog(rentalId: string, event: Record<string, any>) {
    const { data: currentRental, error } = await supabaseAdmin
        .from('rentals')
        .select('metadata')
        .eq('rental_id', rentalId)
        .single();

    if (error) throw new Error(`Failed to fetch rental for logging: ${error.message}`);

    const existingLog = (currentRental.metadata as any)?.eventLog || [];
    const newMetadata = {
        ...currentRental.metadata,
        eventLog: [...existingLog, event]
    };
    return newMetadata;
}

export async function addRentalPhoto(rentalId: string, userId: string, photoUrl: string, photoType: 'start' | 'end') {
    noStore();
    try {
        const { data: rental, error: fetchError } = await supabaseAdmin
            .from('rentals').select('user_id, owner_id, metadata, vehicle:cars(make, model)').eq('rental_id', rentalId).single();
        if (fetchError || !rental) return { success: false, error: "Rental not found." };
        if (rental.user_id !== userId) return { success: false, error: "Only the renter can add photos." };

        const newMetadata = await appendToEventLog(rentalId, {
            timestamp: new Date().toISOString(),
            actor: userId,
            event: 'photo_uploaded',
            details: { type: photoType, url: photoUrl }
        });

        const updateData = photoType === 'start' ? { start_photo_url: photoUrl, metadata: newMetadata } : { end_photo_url: photoUrl, metadata: newMetadata };
        const { data: updatedRental, error } = await supabaseAdmin.from('rentals').update(updateData).eq('rental_id', rentalId).select().single();
        if (error) throw error;

        const carInfo = rental.vehicle ? `${rental.vehicle.make} ${rental.vehicle.model}` : 'транспорта';
        const messageText = `📸 Арендатор добавил фото **"${photoType === 'start' ? 'ДО' : 'ПОСЛЕ'}"** для ${carInfo}. Пожалуйста, проверьте и подтвердите следующий шаг.`;
        await sendComplexMessage(rental.owner_id, messageText, [[{ text: "К Управлению Арендой", url: `${getBaseUrl()}/app?startapp=rental_${rentalId}` }]]);

        return { success: true, data: updatedRental };
    } catch (e: any) {
        logger.error(`[addRentalPhoto] Error:`, e);
        return { success: false, error: e.message };
    }
}

export async function confirmVehiclePickup(rentalId: string, userId: string) {
    noStore();
    try {
        const { data: rental, error: fetchError } = await supabaseAdmin
            .from('rentals').select('user_id, owner_id, metadata, vehicle:cars(make, model)').eq('rental_id', rentalId).single();
        if (fetchError || !rental) return { success: false, error: "Rental not found." };
        if (rental.owner_id !== userId) return { success: false, error: "Only the owner can confirm pickup." };

        const newMetadata = await appendToEventLog(rentalId, {
            timestamp: new Date().toISOString(),
            actor: userId,
            event: 'pickup_confirmed'
        });

        const { data: updatedRental, error } = await supabaseAdmin.from('rentals')
            .update({ pickup_confirmed_at: new Date().toISOString(), status: 'active', metadata: newMetadata }).eq('rental_id', rentalId).select().single();
        if (error) throw error;
        
        const carInfo = rental.vehicle ? `${rental.vehicle.make} ${rental.vehicle.model}` : 'Транспорт';
        const messageText = `✅ Владелец подтвердил получение ${carInfo}. Аренда официально *началась*. Приятной поездки!`;
        await sendComplexMessage(rental.user_id, messageText, [[{ text: "К Управлению Арендой", url: `${getBaseUrl()}/app?startapp=rental_${rentalId}` }]]);

        return { success: true, data: updatedRental };
    } catch (e: any) {
        logger.error(`[confirmVehiclePickup] Error:`, e);
        return { success: false, error: e.message };
    }
}

export async function confirmVehicleReturn(rentalId: string, userId: string) {
    noStore();
    try {
        const { data: rental, error: fetchError } = await supabaseAdmin
            .from('rentals').select('user_id, owner_id, metadata, vehicle:cars(make, model)').eq('rental_id', rentalId).single();
        if (fetchError || !rental) return { success: false, error: "Rental not found." };
        if (rental.owner_id !== userId) return { success: false, error: "Only the owner can confirm return." };
        
        const newMetadata = await appendToEventLog(rentalId, {
            timestamp: new Date().toISOString(),
            actor: userId,
            event: 'return_confirmed'
        });

        const { data: updatedRental, error } = await supabaseAdmin.from('rentals')
            .update({ return_confirmed_at: new Date().toISOString(), status: 'completed', metadata: newMetadata }).eq('rental_id', rentalId).select().single();
        if (error) throw error;

        const carInfo = rental.vehicle ? `${rental.vehicle.make} ${rental.vehicle.model}` : 'Транспорт';
        const messageText = `🏁 Владелец подтвердил возврат ${carInfo}. Аренда *завершена*. Спасибо за использование сервиса!`;
        await sendComplexMessage(rental.user_id, messageText, [[{ text: "Оставить отзыв", url: `${getBaseUrl()}/rent-bike` }]]);

        return { success: true, data: updatedRental };
    } catch (e: any) {
        logger.error(`[confirmVehicleReturn] Error:`, e);
        return { success: false, error: e.message };
    }
}

export async function uploadSingleImage(formData: FormData): Promise<{ success: boolean; url?: string; error?: string; }> {
    const file = formData.get("file") as File;
    const bucketName = formData.get("bucketName") as string;
    
    if (!file || !bucketName) {
        return { success: false, error: "File and bucket name are required." };
    }

    try {
        const fileExt = file.name.split('.').pop();
        const filePath = `${uuidv4()}.${fileExt}`;
        
        const { error: uploadError } = await supabaseAdmin.storage
            .from(bucketName)
            .upload(filePath, file, {
                cacheControl: '604800', // 7 days
                upsert: false
            });

        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabaseAdmin.storage.from(bucketName).getPublicUrl(filePath);
        if (!urlData?.publicUrl) throw new Error("Could not get public URL after upload.");

        return { success: true, url: urlData.publicUrl };

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown upload error";
        logger.error(`Failed to upload single file to ${bucketName}:`, errorMsg);
        return { success: false, error: errorMsg };
    }
}

export async function getUserRentals(userId: string) {
    noStore();
    if (!userId) {
        return { success: false, error: "User ID is required." };
    }
    try {
        const { data: ownedCrews, error: crewError } = await supabaseAdmin.from('crews').select('id').eq('owner_id', userId);
        if (crewError) throw crewError;
        const ownedCrewIds = ownedCrews?.map(c => c.id) || [];

        // This RPC needs to be created in Supabase
        const { data, error } = await supabaseAdmin.rpc('get_user_rentals_dashboard', {
            p_user_id: userId,
            p_owned_crew_ids: ownedCrewIds.length > 0 ? ownedCrewIds : null
        });

        if (error) throw error;
        
        return { success: true, data };
    } catch (error) {
        logger.error(`[getUserRentals] Error:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getTopFleets() {
    noStore();
    try {
        const { data, error } = await supabaseAdmin.rpc('get_top_fleets');
        if (error) throw error;
        return { success: true, data };
    } catch(error) {
        logger.error("Error getting top fleets:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getTopCrews() {
    noStore();
    try {
        const { data, error } = await supabaseAdmin.rpc('get_top_crews');
        if (error) {
            logger.error('Error fetching top crews via RPC:', error);
            throw error;
        }
        return { success: true, data: data || [] };
    } catch(error) {
        logger.error("Exception in getTopCrews action:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getAllPublicCrews() {
    noStore();
    try {
        const { data, error } = await supabaseAdmin.rpc('get_public_crews');
        
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        logger.error("Error fetching all crews via RPC:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getPublicCrewInfo(slug: string) {
    noStore();
    if (!slug) return { success: false, error: "Crew slug is required" };

    try {
        const { data, error } = await supabaseAdmin.rpc('get_public_crew_details', { p_slug: slug });

        if (error) throw error;
        if (!data) return { success: false, error: "Crew not found" };

        return { success: true, data };

    } catch (error) {
        logger.error(`Error fetching crew info for slug ${slug} via RPC:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getMapPresets(): Promise<{ success: boolean; data?: Database['public']['Tables']['maps']['Row'][]; error?: string; }> {
    try {
        const { data, error } = await supabaseAdmin.from('maps').select('*');
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("[getMapPresets Action] Error:", errorMessage);
        return { success: false, error: errorMessage };
    }
}



export async function saveMapPreset(
    userId: string,
    name: string,
    map_image_url: string,
    bounds: MapBounds,
    is_default: boolean = false
): Promise<{ success: boolean; data?: Database['public']['Tables']['maps']['Row']; error?: string; }> {
    try {
        // Simple admin check
        const { data: user, error: userError } = await supabaseAdmin.from('users').select('role').eq('user_id', userId).single();
        if (userError || !['admin'].includes(user?.role || '')) {
            throw new Error("Unauthorized: Only admins can save map presets.");
        }
        
        // If setting this as default, unset other defaults first
        if (is_default) {
            const { error: updateError } = await supabaseAdmin.from('maps').update({ is_default: false }).eq('is_default', true);
            if (updateError) throw new Error(`Failed to unset other default maps: ${updateError.message}`);
        }

        const { data, error } = await supabaseAdmin
            .from('maps')
            .insert({
                name,
                map_image_url,
                bounds: bounds as any, // Cast to any to satisfy Supabase type
                is_default,
                owner_id: userId
            })
            .select()
            .single();

        if (error) throw error;

        return { success: true, data };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("[saveMapPreset Action] Error:", errorMessage);
        return { success: false, error: errorMessage };
    }
}