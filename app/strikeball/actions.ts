"use server";

import { supabaseAdmin, fetchUserData } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { sendTelegramInvoice } from "@/app/actions"; 
import { logger } from "@/lib/logger";
import { v4 as uuidv4 } from "uuid";

const BOT_USERNAME = "oneSitePlsBot";

// --- PATH B: COMMANDER (Lobby Management) ---

export async function createStrikeballLobby(
  userId: string, 
  name: string, 
  mode: string
) {
  if (!userId) return { success: false, error: "Unauthorized" };

  try {
    const qrHash = uuidv4(); 
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

    // Auto-join owner to Blue team
    await supabaseAdmin.from("strikeball_members").insert({
      lobby_id: lobby.id,
      user_id: userId,
      team: "blue",
      is_bot: false,
      status: "ready"
    });

    // Notify via Telegram
    const deepLink = `https://t.me/${BOT_USERNAME}/app?startapp=lobby_${lobby.id}`;
    await sendComplexMessage(
      userId,
      `🎮 **Strikeball Lobby Created: ${name}**\n\nMode: ${mode.toUpperCase()}\n\n[🔗 Click here to Invite Players](${deepLink})`,
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

    // Notify Owner
    const { data: lobby } = await supabaseAdmin.from("strikeball_lobbies").select("owner_id").eq("id", lobbyId).single();
    if (lobby?.owner_id) {
       const user = await fetchUserData(userId);
       await sendComplexMessage(
         lobby.owner_id, 
         `⚠️ **Operator Joined!**\nUser: ${user?.username || userId}\nTeam: ${team.toUpperCase()}`
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
      user_id: null,
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

// --- PATH A: ECONOMY (Gear Rental via 'cars' table) ---

export async function getGearList() {
    // REUSE: Querying 'cars' table for items that are essentially gear.
    // Assuming 'type' column distinguishes them, or we filter by metadata.
    // Here we check for type 'gear' or 'weapon'.
    const { data, error } = await supabaseAdmin
      .from("cars")
      .select("*")
      .in("type", ["gear", "weapon", "consumable"]) 
      .order("daily_price", { ascending: true });

    if (error) {
      logger.error("Failed to fetch gear from cars table", error);
      return { success: false, error: error.message };
    }
    return { success: true, data: data || [] };
}

export async function rentGear(userId: string, gearId: string) {
  try {
    // REUSE: Fetch from 'cars' table
    const { data: item } = await supabaseAdmin
        .from("cars")
        .select("*")
        .eq("id", gearId)
        .single();

    if (!item) throw new Error("Gear not found in armory.");

    // Logic: If it's gear, we might not track "stock" in the same way as cars, 
    // but let's assume if it exists, it's rentable.

    const invoicePayload = `gear_rent_${gearId}_${Date.now()}`;
    
    // Send XTR Invoice
    const result = await sendTelegramInvoice(
      userId,
      `Rental: ${item.make} ${item.model}`, // Mapping Make/Model to Name
      `Tactical gear rental. ${item.description || "No description."}`,
      invoicePayload,
      item.daily_price,
      0,
      item.image_url
    );

    if (!result.success) throw new Error(result.error);

    return { success: true, message: "Invoice sent to Telegram!" };
  } catch (e) {
    logger.error("Rent Gear Failed", e);
    return { success: false, error: (e as Error).message };
  }
}