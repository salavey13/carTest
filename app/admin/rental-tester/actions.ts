"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from 'next/cache';
import { handleWebhookUpdate } from '@/app/actions'; // Import the master handler
import { v4 as uuidv4 } from 'uuid';

// Predefined User IDs (replace with actual IDs from your demo setup)
const DEMO_OWNER_ID_CREW = "413553377"; // Owner of the crew and 1 bike
const DEMO_OWNER_ID_OTHER = "341729406"; // Owner of other 4 bikes (no crew)

const DEMO_BIKE_ID = 'ural-bobber'; // Hardcoded bike ID for predictable tests

async function getDemoBike(): Promise<{ id: string; make: string; model: string; image_url: string; } | null> {
  try {
    const { data: bike, error } = await supabaseAdmin.from('cars').select('id, make, model, image_url').eq('id', DEMO_BIKE_ID).single();
    if (error) {
      logger.error(`[getDemoBike] Error fetching bike ID ${DEMO_BIKE_ID}:`, error);
      return null;
    }
    if (!bike) {
      logger.warn(`[getDemoBike] Demo bike with ID ${DEMO_BIKE_ID} not found. Check your seed data!`);
      return null;
    }
    return bike;
  } catch (error) {
    logger.error(`[getDemoBike] Exception finding bike:`, error);
    return null;
  }
}

// Helper to create the initial rental record
async function createTestRental(renterId: string, ownerId: string, bikeId: string): Promise<{ rentalId: string } | null> {
  try {
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from('rentals')
      .insert({
        user_id: renterId,
        vehicle_id: bikeId,
        owner_id: ownerId,
        status: 'pending_confirmation',
        payment_status: 'interest_paid',
        interest_amount: 10
      })
      .select('rental_id')
      .single();

    if (rentalError || !rental) {
      logger.error(`[createTestRental] Failed to create test rental:`, rentalError);
      return null;
    }

    return { rentalId: rental.rental_id };
  } catch (error) {
    logger.error(`[createTestRental] Exception creating test rental:`, error);
    return null;
  }
}

export async function setupTestScenario(scenario: string) {
  noStore();
  logger.info(`[setupTestScenario] Setting up scenario: ${scenario}`);
  try {
    const demoBikeResult = await getDemoBike();
    if (!demoBikeResult || !demoBikeResult.id) {
      logger.error("[setupTestScenario] No demo bike found.  Scenario setup aborted.");
      return { success: false, error: "No demo bike found in the database. Check your demo setup." };
    }

    const { id: bikeId } = demoBikeResult;

    // Create the initial rental record
    const renterId = DEMO_OWNER_ID_OTHER;
    const ownerId = DEMO_OWNER_ID_CREW;

    const rentalResult = await createTestRental(renterId, ownerId, bikeId);
    if (!rentalResult) {
      logger.error("[setupTestScenario] Rental creation failed, stopping.");
      return { success: false, error: "Failed to create test rental." };
    }

    const { rentalId } = rentalResult;

    // Setup scenario-specific initial state if needed
    if (scenario === 'sos_fuel_hustle') {
      logger.info("[setupTestScenario] Setting rental status to active for sos_fuel_hustle.");
      const { error: updateError } = await supabaseAdmin.from('rentals').update({ status: 'active' }).eq('rental_id', rentalId);
      if (updateError) {
        logger.error(`[setupTestScenario] Failed to update rental status to active for sos_fuel_hustle:`, updateError);
        return { success: false, error: `Failed to set rental to active: ${updateError.message}` };
      }
    }

    const { data: events, error: eventsError } = await supabaseAdmin.from('events').select('*').eq('rental_id', rentalId);
    if (eventsError) {
      logger.error(`[setupTestScenario] Error fetching events:`, eventsError);
    }

    logger.info(`[setupTestScenario] Scenario setup complete for rental ID: ${rentalId}`);
    return {
      success: true,
      data: {
        renter: { id: renterId, username: renterId }, // Using IDs for demonstration
        owner: { id: ownerId, username: ownerId },     // Using IDs for demonstration
        rental: { rental_id: rentalId },
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
  logger.info(`[getTestRentalState] Fetching state for rental: ${rentalId}`);
  try {
    const { data: rental, error } = await supabaseAdmin.from('rentals').select('*').eq('rental_id', rentalId).single();
    if (error) {
      logger.error(`[getTestRentalState] Failed to fetch rental:`, error);
    }
    const { data: events, error: eventsError } = await supabaseAdmin.from('events').select('*').eq('rental_id', rentalId).order('created_at');
    if (eventsError) {
      logger.error(`[getTestRentalState] Failed to fetch events:`, eventsError);
    }

    logger.info(`[getTestRentalState] Successfully fetched state for rental: ${rentalId}. New status: ${rental?.status}`);
    return { success: true, data: { rental, events } };
  } catch (error) {
    logger.error(`[getTestRentalState] Failed to fetch state:`, error);
    return { success: false, error: "Failed to fetch state" };
  }
}

export async function triggerTestAction(rentalId: string, actorId: string, actionName: string, payload: any) {
  noStore();
  logger.info(`[triggerTestAction] Triggering action "${actionName}" for rental ${rentalId} by ${actorId}`);
  try {
    const { data: rental, error: rentalFetchError } = await supabaseAdmin.from('rentals').select('status').eq('rental_id', rentalId).single();
    if (rentalFetchError) {
      logger.error(`[triggerTestAction] Could not fetch rental data before performing ${actionName}`, rentalFetchError);
      return { success: false, error: `Failed to fetch rental details before action: ${rentalFetchError.message}` };
    }

    let result: any;
    let mockNotification = "No notification for this action.";

    switch (actionName) {
      case 'addRentalPhoto': {
        const photoType = (rental?.status === 'active') ? 'end' : 'start';
        logger.info(`[triggerTestAction] addRentalPhoto called (type: ${photoType})`);
        const { error: eventError } = await supabaseAdmin.from('events').insert({
          rental_id: rentalId,
          type: `photo_${photoType}`,
          created_by: actorId,
          payload: { photo_url: 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix//salavey13-15-05-2024-0001.jpg' }
        });
        if (eventError) throw eventError;
        mockNotification = `Owner notified about new ${photoType} photo.`;
        result = { success: true };
        break;
      }
      case 'confirmVehiclePickup': {
        logger.info(`[triggerTestAction] confirmVehiclePickup called`);
        const { error: eventError } = await supabaseAdmin.from('events').insert({
          rental_id: rentalId, type: 'pickup_confirmed', created_by: actorId,
        });
        if (eventError) throw eventError;
        mockNotification = `Renter notified that pickup is confirmed and rental is active.`;
        result = { success: true };
        break;
      }
      case 'confirmVehicleReturn': {
        logger.info(`[triggerTestAction] confirmVehicleReturn called`);
        const { error: eventError } = await supabaseAdmin.from('events').insert({
          rental_id: rentalId, type: 'return_confirmed', created_by: actorId,
        });
        if (eventError) throw eventError;
        mockNotification = `Renter notified that return is confirmed and rental is complete.`;
        result = { success: true };
        break;
      }
      case 'triggerSosFuel':
      case 'triggerSosEvac':
        const isFuel = actionName === 'triggerSosFuel';
        logger.info(`[triggerTestAction] ${actionName} called`);
        const { error: eventError } = await supabaseAdmin.from('events').insert({
            rental_id: rentalId,
            type: isFuel ? 'sos_fuel' : 'sos_evac',
            created_by: actorId,
            status: 'pending',
            payload: { xtr_amount: isFuel ? 50 : 250 }
        });
        if (eventError) throw eventError;
        mockNotification = `SOS ${isFuel ? 'Fuel' : 'Evac'} event created. Crew and Owner have been notified.`;
        result = { success: true };
        break;
      case 'sendGeotag':
         logger.info(`[triggerTestAction] sendGeotag called`);
         const { error: eventUpdateError } = await supabaseAdmin.from('events')
            .update({ payload: { geotag: { latitude: 55.751244, longitude: 37.618423 } }, status: 'pending_acceptance'})
            .eq('rental_id', rentalId)
            .eq('type', 'hustle_pickup'); // Assuming one hustle per rental
         if (eventUpdateError) throw eventUpdateError;
         mockNotification = `Geotag sent. Crew notified.`;
         result = { success: true };
         break;
      case 'simulatePaymentSuccess':
        logger.info(`[triggerTestAction] simulatePaymentSuccess called`);
        const invoice_payload = `test_invoice_${uuidv4()}`;
        const demoBike = await getDemoBike();
        
        const metadata = {
            test_scenario: true,
            car_id: demoBike?.id || 'unknown_bike',
            car_make: demoBike?.make || 'Unknown Make',
            car_model: demoBike?.model || 'Unknown Model',
            image_url: demoBike?.image_url || '',
        };

        const { error: invoiceError } = await supabaseAdmin.from('invoices').insert({
          id: invoice_payload, user_id: actorId, amount: 100, status: 'pending', type: 'car_rental',
          subscription_id: 'dummy_sub_id', metadata: metadata
        });

        if (invoiceError) throw invoiceError;
        logger.info(`[triggerTestAction] Mock invoice ${invoice_payload} created.`);

        const mockPreCheckoutUpdate = {
          pre_checkout_query: { id: "mock_pre_checkout_query_id", from: { id: Number(actorId) }, currency: "XTR", total_amount: 100, invoice_payload }
        };
        const mockPaymentUpdate = {
          message: { successful_payment: { currency: "XTR", total_amount: 100, invoice_payload }, chat: { id: Number(actorId) } }
        };

        try {
          await handleWebhookUpdate(mockPreCheckoutUpdate);
          await handleWebhookUpdate(mockPaymentUpdate);
          mockNotification = "Simulated payment success and processed webhook updates.";
          result = { success: true };
        } catch (paymentError) {
          logger.error("[triggerTestAction] simulatePaymentSuccess handler failed:", paymentError);
          throw new Error(`Payment simulation failed: ${paymentError instanceof Error ? paymentError.message : 'Unknown error'}`);
        }
        break;

      default:
        logger.warn(`[triggerTestAction] Unknown test action: ${actionName}`);
        throw new Error(`Unknown test action: ${actionName}`);
    }

    if (!result.success) {
      logger.error(`[triggerTestAction] Action ${actionName} failed internally:`, result.error);
      throw new Error(result.error || `Action ${actionName} failed internally.`);
    }

    logger.info(`[triggerTestAction] Action "${actionName}" successful.`);
    return { success: true, mockNotification };
  } catch (error) {
    logger.error(`[triggerTestAction] Error during action ${actionName}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function cleanupTestData(rentalId: string) {
  noStore();
  logger.info(`[cleanupTestData] Cleaning up test data for rental: ${rentalId}`);
  try {
    const { error: rentalDeleteError } = await supabaseAdmin.from('rentals').delete().eq('rental_id', rentalId);
    if (rentalDeleteError) {
      logger.error(`[cleanupTestData] Failed to delete rental ${rentalId}:`, rentalDeleteError);
      return { success: false, error: `Failed to delete rental: ${rentalDeleteError.message}` };
    }
    logger.info(`[cleanupTestData] Rental ${rentalId} deleted successfully.`);
    return { success: true };
  } catch (error) {
    logger.error(`[cleanupTestData] Error:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}