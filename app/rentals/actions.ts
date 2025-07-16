"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from 'next/cache';
import { headers } from 'next/headers';

export async function getRentalDetails(rentalId: string) {
    noStore();
    const userId = headers().get('x-user-id'); // Simplified auth for Server Components

    if (!rentalId) {
        logger.error("[getRentalDetails] Rental ID is required.");
        return { success: false, error: "Missing rental ID." };
    }
     if (!userId) {
        logger.error("[getRentalDetails] User ID missing from headers.");
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

export async function updateRentalStatus(rentalId: string, newStatus: string) {
    noStore();
    const userId = headers().get('x-user-id');

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

export async function getAllPublicCrews() {
    noStore();
    try {
        const { data, error } = await supabaseAdmin
            .from('crews')
            .select(`
                id,
                name,
                description,
                logo_url,
                owner:users (username),
                members:crew_members(count),
                vehicles:cars(count)
            `)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        logger.error("Error fetching all crews:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getPublicCrewInfo(crewId: string) {
    noStore();
    if (!crewId) return { success: false, error: "Crew ID is required" };

    try {
        const { data, error } = await supabaseAdmin
            .from('crews')
            .select(`
                *,
                owner:users(username, user_id),
                members:crew_members(user:users(user_id, username, avatar_url)),
                vehicles:cars(id, make, model, image_url)
            `)
            .eq('id', crewId)
            .single();

        if (error) throw error;
        return { success: true, data };

    } catch (error) {
        logger.error(`Error fetching crew info for ${crewId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}