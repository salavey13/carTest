"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from 'next/cache';
import { sendComplexMessage } from "../webhook-handlers/actions/sendComplexMessage";
import { getBaseUrl } from "@/lib/utils";
import { v4 as uuidv4 } from 'uuid';
import { Database } from "@/types/database.types";
import { createInvoice, sendTelegramInvoice } from "@/app/actions";

type MapBounds = { top: number; bottom: number; left: number; right: number; };
type PointOfInterest = { id: string; name: string; type: 'point' | 'path' | 'loop'; icon: string; color: string; coords: [number, number][]; };

export async function getUserCrewCommandDeck(userId: string) {
    noStore();
    if (!userId) return { success: false, error: "User ID is required." };
    try {
        const { data, error } = await supabaseAdmin.rpc('get_user_crew_command_deck', { p_user_id: userId });
        if (error) throw error;
        // The RPC will return an array, but it should only ever have one item or be empty.
        const commandDeckData = data && data.length > 0 ? data[0] : null;
        return { success: true, data: commandDeckData };
    } catch (error) {
        logger.error(`[getUserCrewCommandDeck] Error:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getVehiclesWithStatus() {
    noStore();
    try {
        const { data, error } = await supabaseAdmin.rpc('get_vehicles_with_status');
        if (error) {
            logger.error('Error calling get_vehicles_with_status RPC:', error);
            throw error;
        }
        return { success: true, data };
    } catch (error) {
        logger.error("Exception in getVehiclesWithStatus action:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getVehicleCalendar(vehicleId: string) {
    noStore();
    if (!vehicleId) return { success: false, error: "Vehicle ID is required." };
    try {
        const { data, error } = await supabaseAdmin.rpc('get_vehicle_calendar', { p_vehicle_id: vehicleId });
        if (error) {
            logger.error(`Error calling get_vehicle_calendar RPC for ${vehicleId}:`, error);
            throw error;
        }
        return { success: true, data };
    } catch (error) {
        logger.error(`Exception in getVehicleCalendar for ${vehicleId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function createBooking(
    userId: string,
    vehicleId: string,
    startDate: Date,
    endDate: Date,
    totalPrice: number
) {
    noStore();
    try {
        const { data: vehicle, error: vehicleError } = await supabaseAdmin.from('cars').select('owner_id, make, model, image_url').eq('id', vehicleId).single();
        if(vehicleError || !vehicle) throw new Error("Vehicle not found or error fetching owner.");

        const { data, error } = await supabaseAdmin.from('rentals').insert({
            user_id: userId,
            vehicle_id: vehicleId,
            owner_id: vehicle.owner_id,
            status: 'pending_confirmation',
            payment_status: 'pending',
            requested_start_date: startDate.toISOString(),
            requested_end_date: endDate.toISOString(),
            // agreed_start_date and agreed_end_date are intentionally omitted.
            // They should be set upon confirmation, not upon request.
            total_cost: totalPrice,
            interest_amount: Math.ceil(totalPrice * 0.1) // Example: 10% interest
        }).select('rental_id, interest_amount').single();
        
        if (error) throw error;
        if (!data) throw new Error("Booking creation failed to return data.");
        
        const interestAmount = data.interest_amount || 1000;
        const invoiceId = `rental_interest_${data.rental_id}`;
        
        await createInvoice("car_rental", invoiceId, userId, interestAmount, data.rental_id, {
            rental_id: data.rental_id,
            booking: true,
            car_make: vehicle.make,
            car_model: vehicle.model,
            image_url: vehicle.image_url,
        });

        const description = `Бронь: ${vehicle.make} ${vehicle.model}\nДаты: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\nСумма залога: ${interestAmount} ₽`;
        
        await sendTelegramInvoice(
            userId, "Подтверждение бронирования", description,
            invoiceId, interestAmount * 100,
            undefined, vehicle.image_url
        );
        
        await sendComplexMessage(vehicle.owner_id, `Новый запрос на бронирование для вашего транспорта (ID: ${vehicleId}) с ${startDate.toLocaleDateString()} по ${endDate.toLocaleDateString()}. Ожидается оплата залога от арендатора.`);

        return { success: true, data };
    } catch (error) {
        logger.error(`Error creating booking for vehicle ${vehicleId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to create booking." };
    }
}

export async function getRentalDetails(rentalId: string, userId: string) {
    noStore();
    if (!rentalId) return { success: false, error: "Missing rental ID." };
    if (!userId) return { success: false, error: "Unauthorized." };
    try {
        const { data, error } = await supabaseAdmin.from('rentals').select(`*, vehicle:cars(*), renter:users!rentals_user_id_fkey(*), owner:users!rentals_owner_id_fkey(*)`).eq('rental_id', rentalId).single();
        if (error) throw error;
        if (data.user_id !== userId && data.owner_id !== userId) return { success: false, error: "Unauthorized access to rental details." };
        return { success: true, data };
    } catch (error) {
        logger.error(`Error fetching rental details for ${rentalId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function addRentalPhoto(rentalId: string, userId: string, photoUrl: string, photoType: 'start' | 'end') {
    noStore();
    try {
        const { data: rental, error: fetchError } = await supabaseAdmin.from('rentals').select('user_id, owner_id, vehicle:cars(make, model)').eq('rental_id', rentalId).single();
        if (fetchError || !rental) return { success: false, error: "Rental not found." };
        if (rental.user_id !== userId) return { success: false, error: "Only the renter can add photos." };
        const { error: eventError } = await supabaseAdmin.from('events').insert({ rental_id: rentalId, type: `photo_${photoType}`, created_by: userId, payload: { photo_url: photoUrl } });
        if(eventError) throw eventError;
        return { success: true, data: 'OK' };
    } catch (e: any) {
        logger.error(`[addRentalPhoto] Error:`, e);
        return { success: false, error: e.message };
    }
}

export async function confirmVehiclePickup(rentalId: string, userId: string) {
    noStore();
    try {
        const { data: rental, error: fetchError } = await supabaseAdmin.from('rentals').select('user_id, owner_id, vehicle:cars(make, model)').eq('rental_id', rentalId).single();
        if (fetchError || !rental) return { success: false, error: "Rental not found." };
        if (rental.owner_id !== userId) return { success: false, error: "Only the owner can confirm pickup." };
        const { error: eventError } = await supabaseAdmin.from('events').insert({ rental_id: rentalId, type: 'pickup_confirmed', created_by: userId });
        if(eventError) throw eventError;
        return { success: true, data: 'OK' };
    } catch (e: any) {
        logger.error(`[confirmVehiclePickup] Error:`, e);
        return { success: false, error: e.message };
    }
}

export async function confirmVehicleReturn(rentalId: string, userId: string) {
    noStore();
    try {
        const { data: rental, error: fetchError } = await supabaseAdmin.from('rentals').select('user_id, owner_id, vehicle:cars(make, model)').eq('rental_id', rentalId).single();
        if (fetchError || !rental) return { success: false, error: "Rental not found." };
        if (rental.owner_id !== userId) return { success: false, error: "Only the owner can confirm return." };
        const { error: eventError } = await supabaseAdmin.from('events').insert({ rental_id: rentalId, type: 'return_confirmed', created_by: userId });
        if(eventError) throw eventError;
        return { success: true, data: 'OK' };
    } catch (e: any) {
        logger.error(`[confirmVehicleReturn] Error:`, e);
        return { success: false, error: e.message };
    }
}

export async function uploadSingleImage(formData: FormData): Promise<{ success: boolean; url?: string; error?: string; }> {
    const file = formData.get("file") as File;
    const bucketName = formData.get("bucketName") as string;
    if (!file || !bucketName) return { success: false, error: "File and bucket name are required." };
    try {
        const fileExt = file.name.split('.').pop();
        const filePath = `${uuidv4()}.${fileExt}`;
        const { error: uploadError } = await supabaseAdmin.storage.from(bucketName).upload(filePath, file, { cacheControl: '604800', upsert: false });
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
    if (!userId) return { success: false, error: "User ID is required." };
    try {
        const { data: ownedCrews, error: crewError } = await supabaseAdmin.from('crews').select('id').eq('owner_id', userId);
        if (crewError) throw crewError;
        const ownedCrewIds = ownedCrews?.map(c => c.id) || [];
        const { data, error } = await supabaseAdmin.rpc('get_user_rentals_dashboard', { p_user_id: userId, p_owned_crew_ids: ownedCrewIds.length > 0 ? ownedCrewIds : null });
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
        if (error) throw error;
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

export async function saveMapPreset(userId: string, name: string, map_image_url: string, bounds: MapBounds, is_default: boolean = false): Promise<{ success: boolean; data?: Database['public']['Tables']['maps']['Row']; error?: string; }> {
    try {
        const { data: user, error: userError } = await supabaseAdmin.from('users').select('role').eq('user_id', userId).single();
        if (userError || !['admin'].includes(user?.role || '')) throw new Error("Unauthorized: Only admins can save map presets.");
        if (is_default) {
            const { error: updateError } = await supabaseAdmin.from('maps').update({ is_default: false }).eq('is_default', true);
            if (updateError) throw new Error(`Failed to unset other default maps: ${updateError.message}`);
        }
        const { data, error } = await supabaseAdmin.from('maps').insert({ name, map_image_url, bounds: bounds as any, is_default, owner_id: userId }).select().single();
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("[saveMapPreset Action] Error:", errorMessage);
        return { success: false, error: errorMessage };
    }
}

export async function updateMapPois(userId: string, mapId: string, newPois: PointOfInterest[]): Promise<{ success: boolean; data?: Database['public']['Tables']['maps']['Row']; error?: string; }> {
     try {
        const { data: user, error: userError } = await supabaseAdmin.from('users').select('role').eq('user_id', userId).single();
        if (userError || !['admin', 'vprAdmin'].includes(user?.role || '')) throw new Error("Unauthorized: Only admins can edit maps.");
        const { data, error } = await supabaseAdmin.from('maps').update({ points_of_interest: newPois as any }).eq('id', mapId).select().single();
        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("[updateMapPois Action] Error:", errorMessage);
        return { success: false, error: errorMessage };
    }
}