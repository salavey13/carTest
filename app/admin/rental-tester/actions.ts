"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from 'next/cache';

// Import the real actions we want to test
import * as rentalActions from '@/app/rentals/actions';

// Helper to create mock users and a vehicle
async function createTestEntities() {
    const renterId = `test_renter_${Date.now()}`;
    const ownerId = `test_owner_${Date.now()}`;

    const { data: renter } = await supabaseAdmin.from('users').insert({ user_id: renterId, username: `testrenter`, full_name: "Test Renter" }).select().single();
    const { data: owner } = await supabaseAdmin.from('users').insert({ user_id: ownerId, username: `testowner`, full_name: "Test Owner" }).select().single();
    
    const { data: vehicle } = await supabaseAdmin.from('cars').insert({ 
        make: "Test", model: "Vibe", daily_price: 100, type: 'bike', owner_id: owner!.user_id 
    }).select().single();

    return { renter, owner, vehicle };
}

export async function setupTestScenario(scenario: string) {
    noStore();
    try {
        const { renter, owner, vehicle } = await createTestEntities();
        if (!renter || !owner || !vehicle) throw new Error("Failed to create test entities.");

        // Create the initial rental record
        const { data: rental, error: rentalError } = await supabaseAdmin
            .from('rentals')
            .insert({
                user_id: renter.user_id,
                vehicle_id: vehicle.id,
                owner_id: owner.user_id,
                status: 'pending_confirmation',
                payment_status: 'interest_paid',
                interest_amount: 10
            })
            .select()
            .single();

        if (rentalError) throw rentalError;
        
        // Setup scenario-specific initial state if needed
        if (scenario === 'sos_fuel_hustle') {
            await supabaseAdmin.from('rentals').update({ status: 'active' }).eq('rental_id', rental.rental_id);
        }

        const { data: events, error: eventsError } = await supabaseAdmin.from('events').select('*').eq('rental_id', rental.rental_id);

        return {
            success: true,
            data: {
                renter: { id: renter.user_id, username: renter.username! },
                owner: { id: owner.user_id, username: owner.username! },
                rental,
                events: events || []
            }
        };

    } catch (error) {
        logger.error(`[setupTestScenario] Error:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

export async function getTestRentalState(rentalId: string) {
    noStore();
    try {
        const { data: rental } = await supabaseAdmin.from('rentals').select('*').eq('rental_id', rentalId).single();
        const { data: events } = await supabaseAdmin.from('events').select('*').eq('rental_id', rentalId).order('created_at');
        return { success: true, data: { rental, events } };
    } catch (error) {
        return { success: false, error: "Failed to fetch state" };
    }
}


export async function triggerTestAction(rentalId: string, actorId: string, actionName: string, payload: any) {
    noStore();
    try {
        let result: any;
        let mockNotification = "No notification for this action.";

        // This is the core of the simulator. It calls the REAL production actions.
        switch (actionName) {
            case 'addRentalPhoto':
                const photoType = events.some(e => e.type === 'photo_start') ? 'end' : 'start';
                result = await rentalActions.addRentalPhoto(rentalId, actorId, 'https://example.com/mock-photo.jpg', photoType);
                mockNotification = `Owner notified about new ${photoType} photo.`;
                break;
            case 'confirmVehiclePickup':
                result = await rentalActions.confirmVehiclePickup(rentalId, actorId);
                mockNotification = `Renter notified that pickup is confirmed and rental is active.`;
                break;
            case 'confirmVehicleReturn':
                 result = await rentalActions.confirmVehicleReturn(rentalId, actorId);
                 mockNotification = `Renter notified that return is confirmed and rental is complete.`;
                 break;
            case 'triggerSos':
                // In a real scenario, this would be more complex (e.g., creating an SOS event)
                // For this test, we'll just log it.
                await supabaseAdmin.from('events').insert({ rental_id: rentalId, type: 'sos_fuel', created_by: actorId, status: 'pending' });
                mockNotification = `SOS Fuel event created. Crew and Owner have been notified.`;
                result = { success: true };
                break;
            default:
                throw new Error(`Unknown test action: ${actionName}`);
        }

        if (!result.success) {
            throw new Error(result.error || `Action ${actionName} failed internally.`);
        }

        return { success: true, mockNotification };
    } catch (error) {
        logger.error(`[triggerTestAction] Error:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}


export async function cleanupTestData(rentalId: string) {
    noStore();
    try {
        const { data: rental, error } = await supabaseAdmin.from('rentals').select('user_id, owner_id, vehicle_id').eq('rental_id', rentalId).single();
        if (error || !rental) {
            logger.warn(`[cleanup] Rental ${rentalId} not found for cleanup.`);
            return { success: true, message: "Nothing to clean." };
        }
        
        // The rest is cascaded from the users table deletion
        await supabaseAdmin.from('users').delete().in('user_id', [rental.user_id, rental.owner_id]);
        await supabaseAdmin.from('cars').delete().eq('id', rental.vehicle_id);

        return { success: true };
    } catch (error) {
        logger.error(`[cleanupTestData] Error:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}