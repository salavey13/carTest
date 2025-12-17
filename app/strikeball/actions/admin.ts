"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";

/**
 * Validate a scanned QR code.
 * Supports: 
 * - user_{id} (Profile check)
 * - gear_buy_{id} (Purchase check)
 * - lobby_{id} (Lobby check)
 */
export async function validateScannedCode(adminUserId: string, rawCode: string) {
  // 1. Verify Admin Permissions
  const { data: user } = await supabaseAdmin.from("users").select("role").eq("user_id", adminUserId).single();
  const isAdmin = user?.role === 'admin' || user?.role === 'vprAdmin';
  
  if (!isAdmin) return { success: false, error: "ACCESS DENIED: NOT AN ADMIN" };

  try {
    let payload = rawCode;
    if (rawCode.includes('startapp=')) {
        payload = rawCode.split('startapp=')[1].split('&')[0];
    }

    // --- CASE A: GEAR PURCHASE (QUICK ISSUE) ---
    if (payload.startsWith('gear_buy_')) {
        const itemId = payload.replace('gear_buy_', '').split('_')[0];
        
        const { data: item, error } = await supabaseAdmin.from("cars").select("*").eq("id", itemId).single();
        if (error || !item) throw new Error("Item not found");
        
        // Decrement stock logic would go here, currently just returning info
        return { 
            success: true, 
            type: 'gear_issue', 
            data: { 
                name: `${item.make} ${item.model}`, 
                remaining: parseInt(item.quantity || "0")
            } 
        };
    }

    // --- CASE B: LOBBY CHECK ---
    if (payload.startsWith('lobby_')) {
        const lobbyId = payload.replace('lobby_', '');
        const { data: lobby } = await supabaseAdmin.from("lobbies").select("*").eq("id", lobbyId).single();
        if (!lobby) throw new Error("Lobby not found");
        
        const { count } = await supabaseAdmin.from("lobby_members").select("*", { count: 'exact', head: true }).eq("lobby_id", lobbyId);
        
        return {
            success: true,
            type: 'lobby_info',
            data: {
                name: lobby.name,
                status: lobby.status,
                count: count || 0
            }
        };
    }

    // --- CASE C: USER PROFILE SCAN (NEW) ---
    if (payload.startsWith('user_')) {
        const targetUserId = payload.replace('user_', '');
        
        // Fetch User
        const { data: targetUser } = await supabaseAdmin.from("users").select("*").eq("user_id", targetUserId).single();
        if (!targetUser) throw new Error("User not found");

        // Fetch Recent Purchases
        const { data: purchases } = await supabaseAdmin
            .from("user_purchases")
            .select("*")
            .eq("user_id", targetUserId)
            .eq("status", "paid")
            .order("created_at", { ascending: false })
            .limit(5);

        // Fetch Active Membership
        const { data: activeMembership } = await supabaseAdmin
            .from("lobby_members")
            .select("status, team, lobbies(name, status)")
            .eq("user_id", targetUserId)
            .eq("lobbies.status", "active") // Check active games only
            .maybeSingle();

        return {
            success: true,
            type: 'user_profile',
            data: {
                username: targetUser.username,
                purchases: purchases || [],
                active_status: activeMembership?.status || 'idle',
                current_lobby: activeMembership?.lobbies?.name || 'NONE',
                user_id: targetUserId
            }
        };
    }

    return { success: false, error: "UNKNOWN CODE FORMAT" };

  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Resurrect Player (Admin Action)
 */
export async function adminResurrectPlayer(adminUserId: string, targetUserId: string) {
    // Basic Admin Check
    const { data: user } = await supabaseAdmin.from("users").select("role").eq("user_id", adminUserId).single();
    if (user?.role !== 'admin' && user?.role !== 'vprAdmin') return { success: false, error: "Unauthorized" };

    // Find active lobby membership for this user
    const { data: membership } = await supabaseAdmin
        .from("lobby_members")
        .select("id, lobby_id")
        .eq("user_id", targetUserId)
        .eq("status", "dead")
        .single();

    if (!membership) return { success: false, error: "Player not found or not dead" };

    await supabaseAdmin
        .from("lobby_members")
        .update({ status: 'alive' })
        .eq("id", membership.id);

    return { success: true, message: "Player Resurrected" };
}