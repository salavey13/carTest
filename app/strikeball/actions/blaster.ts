"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { getLobbyGeoData } from "./lobby";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { logger } from "@/lib/logger";

// Utility to calculate distance in meters
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export async function executeProximityBoom(attackerId: string, lobbyId: string) {
    try {
        // 1. Get all recent pings for the lobby
        const geoRes = await getLobbyGeoData(lobbyId);
        if (!geoRes.success || !geoRes.data) return { success: false, error: "No telemetry data" };

        const attackerPing = geoRes.data.find((p: any) => p.user_id === attackerId);
        if (!attackerPing) return { success: false, error: "Attacker GPS signal lost" };

        // 2. Find the nearest target (within 5 meters)
        let nearestVictimId = null;
        let minDistance = 5; // Max 5 meters for a "rubber knife" kill

        geoRes.data.forEach((ping: any) => {
            if (ping.user_id === attackerId) return;

            const dist = calculateDistanceMeters(
                attackerPing.lat, attackerPing.lng,
                ping.lat, ping.lng
            );

            if (dist < minDistance) {
                minDistance = dist;
                nearestVictimId = ping.user_id;
            }
        });

        if (!nearestVictimId) return { success: false, error: "No targets in range" };

        // 3. Fetch Attacker and Victim info for the message
        const { data: attacker } = await supabaseAdmin.from("users").select("username, metadata").eq("user_id", attackerId).single();
        const attackerName = attacker?.username || "Ghost Operator";
        const activeSkinMsg = attacker?.metadata?.active_skin_msg || "💥 BOOM! YOU'RE DEAD.";

        // 4. THE SUCKERPUNCH: Direct Telegram Notification to Victim
        const victimMsg = `⚠️ **COMBAT ALERT** ⚠️\n\n${activeSkinMsg}\n\n*Executed by:* @${attackerName}\n*Distance:* ${minDistance.toFixed(1)}m`;
        
        await sendComplexMessage(nearestVictimId, victimMsg, [], { 
            parseMode: 'Markdown',
            imageQuery: 'explosion tactical' 
        });

        // 5. Log the incident for the PDF Dossier
        await supabaseAdmin.from("events").insert({
            type: 'CLOSE_ENCOUNTER_KILL',
            lobby_id: lobbyId,
            created_by: attackerId,
            payload: {
                victim_id: nearestVictimId,
                distance: minDistance,
                attacker_username: attackerName
            }
        });

        return { success: true, victimId: nearestVictimId };

    } catch (e: any) {
        logger.error("[executeProximityBoom] Error:", e);
        return { success: false, error: "Internal system error" };
    }
}