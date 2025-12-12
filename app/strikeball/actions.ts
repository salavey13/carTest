"use server";

import { supabaseAdmin, fetchUserData, updateUserMetadata } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { sendTelegramInvoice, notifyAdmin } from "@/app/actions"; // Core actions
import { logger } from "@/lib/logger";
import { v4 as uuidv4 } from "uuid";

// --- PATH B: COMMANDER (Lobby Management) ---

export async function createStrikeballLobby(
  userId: string, 
  name: string, 
  mode: string
) {
  if (!userId) return { success: false, error: "Unauthorized" };

  try {
    // 1. Create Lobby
    const qrHash = uuidv4(); // Simple unique string for QR generation
    const { data: lobby, error } = await supabaseAdmin
      .from("strikeball_lobbies")
      .insert({
        name,
        owner_id: userId,
        mode,
        qr_code_hash: qrHash,
        status: "open",
        metadata: { bots_enabled: true }
      })
      .select()
      .single();

    if (error) throw error;

    // 2. Add Owner as Member (Blue Team Leader)
    await supabaseAdmin.from("strikeball_members").insert({
      lobby_id: lobby.id,
      user_id: userId,
      team: "blue",
      is_bot: false,
      status: "ready"
    });

    // 3. Notify via Telegram (Tactical feature)
    const deepLink = `https://t.me/oneSitePlsBot/app?startapp=lobby_${lobby.id}`;
    await sendComplexMessage(
      userId,
      `🎮 **Lobby Initialized: ${name}**\n\nMode: ${mode.toUpperCase()}\nStatus: WAITING FOR PLAYERS\n\n[Join Link](${deepLink})`,
      [],
      { parseMode: "Markdown" }
    );

    return { success: true, lobbyId: lobby.id };
  } catch (e) {
    logger.error("Create Lobby Failed", e);
    return { success: false, error: "Failed to deploy lobby." };
  }
}

export async function joinLobby(userId: string, lobbyId: string, team: string = "red") {
  try {
    // Check if already in
    const { data: existing } = await supabaseAdmin
      .from("strikeball_members")
      .select("id")
      .eq("lobby_id", lobbyId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) return { success: true, message: "Already deployed." };

    await supabaseAdmin.from("strikeball_members").insert({
      lobby_id: lobbyId,
      user_id: userId,
      team,
      is_bot: false,
      status: "ready"
    });

    // Notify Lobby Owner (Tactical Update)
    const { data: lobby } = await supabaseAdmin.from("strikeball_lobbies").select("owner_id").eq("id", lobbyId).single();
    if (lobby?.owner_id) {
       // Retrieve username for cleaner notification
       const user = await fetchUserData(userId);
       await sendComplexMessage(
         lobby.owner_id, 
         `⚠️ **New Operator Deployed!**\nUser: ${user?.username || userId}\nTeam: ${team.toUpperCase()}`
       );
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: "Deployment failed." };
  }
}

// --- PATH C: TACTICAL (Bots & Status) ---

export async function addNoobBot(lobbyId: string, team: string) {
  try {
    await supabaseAdmin.from("strikeball_members").insert({
      lobby_id: lobbyId,
      user_id: null, // It's a bot
      is_bot: true,
      team,
      status: "ready"
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: "Bot malfunction." };
  }
}

export async function togglePlayerStatus(memberId: string, currentStatus: string) {
    const newStatus = currentStatus === 'alive' ? 'dead' : 'alive';
    await supabaseAdmin.from("strikeball_members").update({ status: newStatus }).eq("id", memberId);
    return { success: true, newStatus };
}

// --- PATH A: ECONOMY (Gear Rental with XTR) ---

export async function rentGear(userId: string, gearId: string) {
  try {
    // 1. Get Gear Details
    const { data: gear } = await supabaseAdmin.from("cars").select("*").eq("id", gearId).single();
    if (!gear) throw new Error("Item not found");

    if (gear.stock <= 0) return { success: false, error: "Out of stock!" };

    // 2. Send Telegram Invoice (XTR)
    // We use your core action 'sendTelegramInvoice'
    const invoicePayload = `gear_rent_${gearId}_${Date.now()}`;
    const result = await sendTelegramInvoice(
      userId,
      `Rental: ${gear.name}`,
      `Daily rental for ${gear.name}. Pickup at HQ.`,
      invoicePayload,
      gear.price_xtr,
      0, // No subscription ID
      gear.image_url
    );

    if (!result.success) throw new Error(result.error);

    return { success: true, message: "Invoice sent to chat!" };
  } catch (e) {
    logger.error("Rent Gear Failed", e);
    return { success: false, error: (e as Error).message };
  }
}

export async function getGearList() {
    const { data } = await supabaseAdmin.from("strikeball_gear").select("*").gt("stock", 0);
    return { success: true, data: data || [] };
}