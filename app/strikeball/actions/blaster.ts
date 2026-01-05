"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { getLobbyGeoData } from "./lobby";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { logger } from "@/lib/logger";

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function executeProximityBoom(attackerId: string, lobbyId: string) {
    try {
        const geoRes = await getLobbyGeoData(lobbyId);
        if (!geoRes.success || !geoRes.data) return { success: false, error: "No telemetry" };

        const attackerPing = geoRes.data.find((p: any) => p.user_id === attackerId);
        if (!attackerPing) return { success: false, error: "GPS Lost" };

        let nearestVictimId = null;
        let minDistance = 5; 

        geoRes.data.forEach((ping: any) => {
            if (ping.user_id === attackerId) return;
            const dist = calculateDistanceMeters(attackerPing.lat, attackerPing.lng, ping.lat, ping.lng);
            if (dist < minDistance) {
                minDistance = dist;
                nearestVictimId = ping.user_id;
            }
        });

        if (!nearestVictimId) return { success: false, error: "Out of range" };

        // 1. FETCH VICTIM CURRENT METADATA
        const { data: victim } = await supabaseAdmin.from("users").select("metadata").eq("user_id", nearestVictimId).single();
        const { data: attacker } = await supabaseAdmin.from("users").select("username").eq("user_id", attackerId).single();

        // 2. INJECT HUMILIATION INTO VICTIM'S METADATA
        const newMetadata = { 
            ...(victim?.metadata || {}), 
            is_humiliated: true, 
            humiliated_by: attacker?.username || "Ghost",
            humiliated_at: new Date().toISOString()
        };

        await supabaseAdmin.from("users").update({ metadata: newMetadata }).eq("user_id", nearestVictimId);

        // 3. SEND NOTIFICATION WITH "GO CHECK IT" LINK
        const victimMsg = `🛠️ **GEAR INTEGRITY COMPROMISED** 🛠️\n\n@${attacker?.username} just bent your barrel into a croissant.\n\n*Distance:* ${minDistance.toFixed(1)}m\n\n👇 **INSPECT DAMAGE / REPAIR**`;
        
        await sendComplexMessage(nearestVictimId, victimMsg, [
            [{ text: "🚀 OPEN HUD", url: "https://t.me/oneSitePlsBot/app" }]
        ], { 
            parseMode: 'Markdown',
            imageQuery: 'broken metal weapon' 
        });

        return { success: true, victimId: nearestVictimId };
    } catch (e: any) {
        logger.error("[executeProximityBoom] Error:", e);
        return { success: false, error: "System Error" };
    }
}

export async function fieldRepair(userId: string) {
    const { data: user } = await supabaseAdmin.from("users").select("metadata").eq("user_id", userId).single();
    const newMetadata = { ...(user?.metadata || {}), is_humiliated: false };
    await supabaseAdmin.from("users").update({ metadata: newMetadata }).eq("user_id", userId);
    return { success: true };
}