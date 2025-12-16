"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { revalidatePath } from "next/cache";

/**
 * Updates a member's transport status.
 * role: 'driver' | 'passenger' | 'none'
 */
export async function updateTransportStatus(
  memberId: string, 
  payload: { role: string; seats?: number; car_name?: string }
) {
  try {
    const { data: member } = await supabaseAdmin.from("lobby_members").select("metadata").eq("id", memberId).single();
    const currentMeta = (member?.metadata as Record<string, any>) || {};
    
    // If becoming a driver, clear passenger data
    // If becoming passenger (generic), clear driver data
    // If none, clear all
    
    let transportData = { ...currentMeta.transport };
    
    if (payload.role === 'driver') {
        transportData = {
            role: 'driver',
            seats: payload.seats || 3,
            car_name: payload.car_name || "Транспорт",
            passengers: [] // Driver holds list of passenger IDs? Or passengers hold driver ID? Better: Passengers hold driver ID.
        };
    } else if (payload.role === 'passenger') {
        transportData = {
            role: 'passenger',
            driver_id: null // Reset driver
        };
    } else {
        transportData = null;
    }

    const newMeta = { ...currentMeta, transport: transportData };

    const { error } = await supabaseAdmin.from("lobby_members").update({ metadata: newMeta }).eq("id", memberId);
    if (error) throw error;
    
    revalidatePath('/strikeball/lobbies');
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

/**
 * Join a specific car.
 */
export async function joinCar(passengerId: string, driverId: string) {
    try {
        const { data: member } = await supabaseAdmin.from("lobby_members").select("metadata").eq("id", passengerId).single();
        const currentMeta = (member?.metadata as Record<string, any>) || {};
        
        const newMeta = {
            ...currentMeta,
            transport: {
                role: 'passenger',
                driver_id: driverId
            }
        };

        const { error } = await supabaseAdmin.from("lobby_members").update({ metadata: newMeta }).eq("id", passengerId);
        if (error) throw error;
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function signSafetyBriefing(memberId: string) {
  try {
    const { data: member } = await supabaseAdmin.from("lobby_members").select("metadata").eq("id", memberId).single();
    const currentMeta = (member?.metadata as Record<string, any>) || {};
    const newMeta = { ...currentMeta, safety_signed: true, safety_signed_at: new Date().toISOString() };
    const { error } = await supabaseAdmin.from("lobby_members").update({ metadata: newMeta }).eq("id", memberId);
    if (error) throw error;
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}