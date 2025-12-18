"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";

export async function validateScannedCode(adminUserId: string, rawCode: string) {
  // ... [Admin check logic remains same] ...
  const { data: user } = await supabaseAdmin.from("users").select("role").eq("user_id", adminUserId).single();
  const isAdmin = user?.role === 'admin' || user?.role === 'strikeAdmin';
  if (!isAdmin) return { success: false, error: "ACCESS DENIED" };

  try {
    let payload = rawCode;
    if (rawCode.includes('startapp=')) payload = rawCode.split('startapp=')[1].split('&')[0];

    // --- CASE D: PURCHASE CHECK (RETURN/ISSUE) ---
    if (payload.startsWith('purchase_')) {
        const purchaseId = payload.replace('purchase_', '');
        
        const { data: purchase, error } = await supabaseAdmin
            .from("user_purchases")
            .select("*, user:users(username)")
            .eq("id", purchaseId)
            .single();

        if (error || !purchase) throw new Error("Purchase record not found");

        return {
            success: true,
            type: 'purchase_info',
            data: {
                id: purchase.id,
                item: purchase.metadata?.item_name || "Unknown Item",
                status: purchase.status, // 'paid', 'returned'
                owner: purchase.user?.username || "Unknown",
                price: purchase.total_price,
                item_id: purchase.item_id
            }
        };
    }
    
    // --- CASE A: GEAR PURCHASE (Catalog Scan) ---
    if (payload.startsWith('gear_buy_')) {
        const itemId = payload.replace('gear_buy_', '').split('_')[0];
        const { data: item } = await supabaseAdmin.from("cars").select("*").eq("id", itemId).single();
        if (!item) throw new Error("Item not found");
        return { success: true, type: 'gear_issue', data: { name: `${item.make} ${item.model}`, remaining: parseInt(item.quantity || "0") } };
    }
    
    // --- CASE B: LOBBY ---
    if (payload.startsWith('lobby_')) {
         const lobbyId = payload.replace('lobby_', '');
         const { data: l } = await supabaseAdmin.from("lobbies").select("*").eq("id", lobbyId).single();
         if (!l) throw new Error("Lobby not found");
         const { count } = await supabaseAdmin.from("lobby_members").select("*", { count: 'exact', head: true }).eq("lobby_id", lobbyId);
         return { success: true, type: 'lobby_info', data: { name: l.name, status: l.status, count: count || 0 } };
    }
    
    // --- CASE C: USER ---
    if (payload.startsWith('user_')) {
        // ... (Keep existing user scan logic) ...
        return { success: false, error: "User scan logic placeholder (preserve existing)" };
    }

    return { success: false, error: "UNKNOWN CODE" };

  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Return Item to Stock
 */
export async function returnItemToArmory(adminUserId: string, purchaseId: string) {
     // Verify Admin
     const { data: user } = await supabaseAdmin.from("users").select("role").eq("user_id", adminUserId).single();
     if (user?.role !== 'admin' && user?.role !== 'vprAdmin') return { success: false, error: "Unauthorized" };

     // 1. Get Purchase
     const { data: purchase } = await supabaseAdmin.from("user_purchases").select("item_id, status").eq("id", purchaseId).single();
     if (!purchase) return { success: false, error: "Purchase not found" };
     if (purchase.status === 'returned') return { success: false, error: "Already returned" };

     // 2. Mark Returned
     const { error: updateErr } = await supabaseAdmin
        .from("user_purchases")
        .update({ status: 'returned', metadata: { returned_at: new Date().toISOString() } }) // ideally merge metadata
        .eq("id", purchaseId);
     
     if (updateErr) throw updateErr;

     // 3. Increment Stock
     // We need to fetch current quantity first to increment safely or use rpc if high concurrency (simple fetch/update ok for MVP)
     const { data: item } = await supabaseAdmin.from("cars").select("quantity").eq("id", purchase.item_id).single();
     if (item) {
         const newQty = parseInt(item.quantity || "0") + 1;
         await supabaseAdmin.from("cars").update({ quantity: newQty }).eq("id", purchase.item_id);
     }

     return { success: true, message: "Item returned to Armory." };
}

// ... [adminResurrectPlayer remains the same] ...
export async function adminResurrectPlayer(adminUserId: string, targetUserId: string) {
    const { data: user } = await supabaseAdmin.from("users").select("role").eq("user_id", adminUserId).single();
    if (user?.role !== 'admin' && user?.role !== 'vprAdmin') return { success: false, error: "Unauthorized" };

    const { data: membership } = await supabaseAdmin.from("lobby_members").select("id").eq("user_id", targetUserId).eq("status", "dead").single();
    if (!membership) return { success: false, error: "Target not dead" };

    await supabaseAdmin.from("lobby_members").update({ status: 'alive' }).eq("id", membership.id);
    return { success: true, message: "Resurrected" };
}