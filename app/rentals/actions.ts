"use server";

import { supabaseAdmin, createInvoice } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from 'next/cache';
import { sendComplexMessage } from "../webhook-handlers/actions/sendComplexMessage";
import { getBaseUrl } from "@/lib/utils";
import { v4 as uuidv4 } from 'uuid';
import { Database } from "@/types/database.types";
import { sendTelegramInvoice } from "@/app/actions";
import { CrewWithCounts, CrewDetails, CommandDeckData, MapPreset, VehicleWithStatus, VehicleCalendar, RentalDetails, UserRentalDashboard, TopFleet, TopCrew } from '@/lib/types';

// ... (весь код до createBooking без изменений) ...

/**
 * Получает список всех публичных команд с подсчетом участников и техники.
 */
export async function getAllPublicCrews(): Promise<{ 
    success: boolean; 
    data?: CrewWithCounts[];
    error?: string; 
}> {
    noStore();
    try {
        const { data, error } = await supabaseAdmin.rpc('get_public_crews');
        if (error) {
            logger.error("Error calling get_public_crews RPC:", error);
            throw new Error(`Supabase RPC Error: ${error.message}`);
        }
        return { success: true, data: data || [] };
    } catch (error) {
        logger.error("Critical failure in getAllPublicCrews action:", error);
        return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred fetching crews." };
    }
}

/**
 * Получает ПОЛНУЮ И АКТУАЛЬНУЮ информацию об одной команде, включая живые статусы участников.
 */
export async function getCrewLiveDetails(slug: string): Promise<{
    success: boolean;
    data?: CrewDetails;
    error?: string;
}> {
    noStore();
    if (!slug) {
        logger.warn("getCrewLiveDetails called without a slug.");
        return { success: false, error: "No slug provided." };
    }

    try {
        const { data, error } = await supabaseAdmin
            .rpc('get_crew_live_details', { p_slug: slug })
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                logger.warn(`[Data Core] Crew with slug '${slug}' not found in DB.`);
                return { success: false, error: "Экипаж не найден." };
            }
            logger.error(`[Data Core] Error calling get_crew_live_details RPC for slug: ${slug}`, error);
            throw new Error(`Supabase RPC Error: ${error.message}`);
        }

        if (!data) {
             logger.warn(`[Data Core] No data returned for crew slug '${slug}', though no error was thrown.`);
             return { success: false, error: "Экипаж не найден (нет данных)." };
        }

        return { success: true, data: data as CrewDetails };

    } catch (error) {
        logger.error(`[Data Core] CRITICAL failure in getCrewLiveDetails for slug: ${slug}`, error);
        return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred fetching crew details." };
    }
}

type MapBounds = { top: number; bottom: number; left: number; right: number; };
type PointOfInterest = { id: string; name: string; type: 'point' | 'path' | 'loop'; icon: string; color: string; coords: [number, number][]; };

export async function getUserCrewCommandDeck(userId: string): Promise<{ success: boolean; data?: CommandDeckData | null; error?: string; }> {
    noStore();
    if (!userId) return { success: false, error: "User ID is required." };
    try {
        const { data, error } = await supabaseAdmin.rpc('get_user_crew_command_deck', { p_user_id: userId });
        if (error) throw error;
        const commandDeckData = data && data.length > 0 ? data[0] : null;
        return { success: true, data: commandDeckData };
    } catch (error) {
        logger.error(`[getUserCrewCommandDeck] Error:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getVehiclesWithStatus(): Promise<{ success: boolean; data?: VehicleWithStatus[]; error?: string }> {
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

export async function getVehicleCalendar(vehicleId: string): Promise<{ success: boolean; data?: VehicleCalendar[]; error?: string }> {
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

export async function createBooking(userId: string, vehicleId: string, startDate: Date, endDate: Date, totalPrice: number) {
    noStore();
    try {
        const { data: vehicle, error: vehicleError } = await supabaseAdmin.from('cars').select('owner_id, make, model, image_url').eq('id', vehicleId).single();
        if(vehicleError || !vehicle) throw new Error("Vehicle not found or error fetching owner.");

        const { data, error } = await supabaseAdmin.from('rentals').insert({
            user_id: userId, vehicle_id: vehicleId, owner_id: vehicle.owner_id, status: 'pending_confirmation',
            payment_status: 'pending', requested_start_date: startDate.toISOString(), requested_end_date: endDate.toISOString(),
            total_cost: totalPrice, interest_amount: Math.ceil(totalPrice * 0.1)
        }).select('rental_id, interest_amount').single();
        
        if (error) throw error;
        if (!data) throw new Error("Booking creation failed to return data.");
        
        const interestAmount = data.interest_amount || 1000;
        const invoiceId = `rental_interest_${data.rental_id}`;
        
        await createInvoice("car_rental", invoiceId, userId, interestAmount, null, {
            rental_id: data.rental_id,
            car_id: vehicleId,
            booking: true,
            car_make: vehicle.make,
            car_model: vehicle.model,
            image_url: vehicle.image_url,
        });

        const description = `Бронь: ${vehicle.make} ${vehicle.model}\nДаты: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\nСумма залога: ${interestAmount} ₽`;
        
        await sendTelegramInvoice(userId, "Подтверждение бронирования", description, invoiceId, interestAmount / 100, undefined, vehicle.image_url);
        
        await sendComplexMessage(vehicle.owner_id!, `Новый запрос на бронирование для вашего транспорта (ID: ${vehicleId}) с ${startDate.toLocaleDateString()} по ${endDate.toLocaleDateString()}. Ожидается оплата залога от арендатора.`);

        return { success: true, data };
    } catch (error) {
        logger.error(`Error creating booking for vehicle ${vehicleId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to create booking." };
    }
}

// ... (остальные функции файла) ...