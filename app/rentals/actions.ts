"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from 'next/cache';
import { sendComplexMessage } from "../webhook-handlers/actions/sendComplexMessage";
import { getBaseUrl } from "@/lib/utils";

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

export async function updateRentalStatus(rentalId: string, newStatus: string, userId: string) {
    noStore();

    if (!rentalId || !newStatus || !userId) {
         return { success: false, error: "Missing required parameters." };
    }
    
    try {
        const { data: rental, error: fetchError } = await supabaseAdmin
            .from('rentals')
            .select('owner_id, user_id')
            .eq('rental_id', rentalId)
            .single();
        
        if (fetchError || !rental) {
            return { success: false, error: "Rental not found." };
        }

        if (rental.owner_id !== userId && rental.user_id !== userId) {
            return { success: false, error: "Unauthorized to update this rental." };
        }

        const { data, error } = await supabaseAdmin
            .from('rentals')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('rental_id', rentalId)
            .select()
            .single();
        
        if (error) throw error;

        return { success: true, data };
    } catch(error) {
        logger.error(`Error updating rental ${rentalId} status:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function addRentalPhoto(rentalId: string, userId: string, photoUrl: string, photoType: 'start' | 'end') {
    noStore();
    try {
        const { data: rental, error: fetchError } = await supabaseAdmin
            .from('rentals').select('user_id, owner_id, vehicle:cars(make, model)').eq('rental_id', rentalId).single();
        if (fetchError || !rental) return { success: false, error: "Rental not found." };
        if (rental.user_id !== userId) return { success: false, error: "Only the renter can add photos." };

        const updateData = photoType === 'start' ? { start_photo_url: photoUrl } : { end_photo_url: photoUrl };
        const { data: updatedRental, error } = await supabaseAdmin.from('rentals').update(updateData).eq('rental_id', rentalId).select().single();
        if (error) throw error;

        // Notify owner
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
            .from('rentals').select('user_id, owner_id, vehicle:cars(make, model)').eq('rental_id', rentalId).single();
        if (fetchError || !rental) return { success: false, error: "Rental not found." };
        if (rental.owner_id !== userId) return { success: false, error: "Only the owner can confirm pickup." };

        const { data: updatedRental, error } = await supabaseAdmin.from('rentals')
            .update({ pickup_confirmed_at: new Date().toISOString(), status: 'active' }).eq('rental_id', rentalId).select().single();
        if (error) throw error;
        
        // Notify renter
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
            .from('rentals').select('user_id, owner_id, vehicle:cars(make, model)').eq('rental_id', rentalId).single();
        if (fetchError || !rental) return { success: false, error: "Rental not found." };
        if (rental.owner_id !== userId) return { success: false, error: "Only the owner can confirm return." };

        const { data: updatedRental, error } = await supabaseAdmin.from('rentals')
            .update({ return_confirmed_at: new Date().toISOString(), status: 'completed' }).eq('rental_id', rentalId).select().single();
        if (error) throw error;

        // Notify renter
        const carInfo = rental.vehicle ? `${rental.vehicle.make} ${rental.vehicle.model}` : 'Транспорт';
        const messageText = `🏁 Владелец подтвердил возврат ${carInfo}. Аренда *завершена*. Спасибо за использование сервиса!`;
        await sendComplexMessage(rental.user_id, messageText, [[{ text: "Оставить отзыв", url: `${getBaseUrl()}/rent-bike` }]]);

        return { success: true, data: updatedRental };
    } catch (e: any) {
        logger.error(`[confirmVehicleReturn] Error:`, e);
        return { success: false, error: e.message };
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

export async function getTopFleets() {
    noStore();
    if (!supabaseAdmin) {
        return { success: false, error: "Admin client is not available." };
    }
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
    if (!supabaseAdmin) {
        return { success: false, error: "Admin client is not available." };
    }
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