"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from 'next/cache';

export async function getRentalDetails(rentalId: string, userId: string) {
    noStore();
    if (!rentalId || !userId) {
        logger.error("[getRentalDetails] Rental ID and User ID are required.");
        return { success: false, error: "Missing required parameters." };
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
        
        // Basic authorization check
        if (data.user_id !== userId && data.owner_id !== userId) {
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
        // Fetch to verify ownership/rentership before update
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
                *,
                owner:users (*),
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
                owner:users(*),
                members:crew_members(user:users(*)),
                vehicles:cars(*)
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