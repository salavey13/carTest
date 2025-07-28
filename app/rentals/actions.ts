"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Helper to get the current user's chat_id
async function getUserChatId() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.user_metadata?.chat_id;
}

// 1. UPDATED getVehiclesWithStatus
export async function getVehiclesWithStatus() {
    const supabase = createClient();
    try {
        // Fetch all vehicles and join with active rentals to get booking dates
        const { data, error } = await supabase
            .from('cars')
            .select(`
                *,
                owner:users(user_id, metadata),
                crew:crews(id, name, logo_url),
                rentals(
                    agreed_start_date,
                    agreed_end_date,
                    status
                )
            `)
            .eq('rentals.status', 'active'); // only join on active rentals

        if (error) throw error;

        // Process the data to determine availability and booking dates
        const processedData = data.map(vehicle => {
            const activeRental = (vehicle.rentals as any[])?.find(r => r.status === 'active');
            
            let availability = vehicle.availability_status;
            let active_booking_start = null;
            let active_booking_end = null;

            if (activeRental) {
                availability = 'taken';
                active_booking_start = activeRental.agreed_start_date;
                active_booking_end = activeRental.agreed_end_date;
            }

            return {
                id: vehicle.id,
                make: vehicle.make,
                model: vehicle.model,
                image_url: vehicle.image_url,
                daily_price: vehicle.daily_price,
                availability: availability,
                type: vehicle.type,
                specs: vehicle.specs,
                owner_id: vehicle.owner_id,
                crew_name: vehicle.crew?.name || null,
                crew_logo_url: vehicle.crew?.logo_url || null,
                active_booking_start,
                active_booking_end
            };
        });

        return { success: true, data: processedData };
    } catch (error: any) {
        console.error("Error fetching vehicles with status:", error);
        return { success: false, error: error.message };
    }
}

// 2. UPDATED getVehicleCalendar
export async function getVehicleCalendar(vehicleId: string) {
    const supabase = createClient();
    try {
        const { data, error } = await supabase
            .from('rentals')
            .select('agreed_start_date, agreed_end_date, requested_start_date, requested_end_date, status')
            .eq('vehicle_id', vehicleId)
            .in('status', ['confirmed', 'active', 'pending_confirmation']); // Look for all non-available slots

        if (error) throw error;

        const bookedPeriods = data.map(booking => {
            // A confirmed booking uses the 'agreed' dates, a pending one uses 'requested' dates
            const startDate = booking.agreed_start_date || booking.requested_start_date;
            const endDate = booking.agreed_end_date || booking.requested_end_date;
            return { start_date: startDate, end_date: endDate };
        });

        return { success: true, data: bookedPeriods };
    } catch (error: any) {
        console.error("Error fetching vehicle calendar:", error);
        return { success: false, error: error.message };
    }
}

// 3. UPDATED createBooking
export async function createBooking(
    userId: string,
    vehicleId: string,
    ownerId: string, // New required parameter
    startDate: Date,
    endDate: Date,
    totalPrice: number
) {
    const supabase = createClient();
    const chat_id = await getUserChatId();
    if (!chat_id || chat_id !== userId) {
        return { success: false, error: "Authentication failed. User mismatch." };
    }

    try {
        const { error } = await supabase.from('rentals').insert({
            user_id: userId,
            vehicle_id: vehicleId,
            owner_id: ownerId, // Now correctly populated
            requested_start_date: startDate.toISOString(), // Use new schema column
            requested_end_date: endDate.toISOString(),     // Use new schema column
            total_cost: totalPrice,
            // Defaults will handle status ('pending_confirmation') and payment_status ('interest_paid')
        });

        if (error) throw error;

        revalidatePath('/rent-bike');
        return { success: true };
    } catch (error: any) {
        console.error("Error creating booking:", error);
        return { success: false, error: error.message };
    }
}