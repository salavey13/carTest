"use server";

import { supabaseAdmin, fetchUserData, updateUserMetadata } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { sendTelegramInvoice } from "@/app/actions"; 
import { logger } from "@/lib/logger";
import { v4 as uuidv4 } from "uuid";

const BOT_USERNAME = "oneSitePlsBot";

// --- PATH B: COMMANDER (Lobby Management) ---

export async function createStrikeballLobby(
  userId: string, 
  payload: { name: string; mode: string; start_at?: string | null; max_players?: number }
) {
  if (!userId) return { success: false, error: "Unauthorized" };
  const { name, mode, start_at, max_players = 20 } = payload;

  try {
    const qrHash = uuidv4(); 
    const { data: lobby, error } = await supabaseAdmin
      .from("lobbies")
      .insert({
        name,
        owner_id: userId,
        mode,
        qr_code_hash: qrHash,
        status: "open",
        start_at: start_at || null,
        max_players,
        metadata: { bots_enabled: true }
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-join owner
    await supabaseAdmin.from("strikeball_members").insert({
      lobby_id: lobby.id,
      user_id: userId,
      team: "blue",
      is_bot: false,
      status: "ready"
    });

    const deepLink = `https://t.me/${BOT_USERNAME}/app?startapp=lobby_${lobby.id}`;
    
    // Format date for message if exists
    const timeStr = start_at ? new Date(start_at).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : 'ASAP';

    await sendComplexMessage(
      userId,
      `🔴 **ARENA INITIALIZED** 🔴\n\n**Operation:** ${name}\n**Mode:** ${mode.toUpperCase()}\n**Time:** ${timeStr}\n\n[🔗 CLICK TO DEPLOY SQUAD](${deepLink})`,
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
    const { data: lobby } = await supabaseAdmin.from("lobbies").select("owner_id, name").eq("id", lobbyId).single();
    if (lobby?.owner_id) {
       const user = await fetchUserData(userId);
       await sendComplexMessage(
         lobby.owner_id, 
         `⚠️ **REINFORCEMENTS ARRIVED**\nUser: ${user?.username || userId} joined ${lobby.name}.`
       );
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: "Deployment failed." };
  }
}

// --- IMPLEMENTATION OF MISSING FUNCTION ---
export async function getOpenLobbies() {
  try {
    const { data, error } = await supabaseAdmin
      .from("lobbies")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (e) {
    logger.error("getOpenLobbies Failed", e);
    return { success: false, error: "Connection lost." };
  }
}

// --- PATH C: TACTICAL ---

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

// --- PATH A: ECONOMY ---

export async function getGearList() {
    const { data, error } = await supabaseAdmin
      .from("cars")
      .select("*")
      .in("type", ["gear", "weapon", "consumable"]) 
      .order("daily_price", { ascending: true });

    if (error) {
      logger.error("Failed to fetch gear", error);
      return { success: false, error: error.message };
    }
    return { success: true, data: data || [] };
}

export async function rentGear(userId: string, gearId: string) {
  try {
    const { data: item } = await supabaseAdmin.from("cars").select("*").eq("id", gearId).single();
    if (!item) throw new Error("Gear not found.");

    const invoicePayload = `gear_rent_${gearId}_${Date.now()}`;
    const result = await sendTelegramInvoice(
      userId,
      `ARMORY: ${item.make} ${item.model}`,
      `Rental for: ${item.description || "Classified Item"}`,
      invoicePayload,
      item.daily_price,
      0,
      item.image_url
    );

    if (!result.success) throw new Error(result.error);
    return { success: true, message: "Invoice sent to datalink." };
  } catch (e) {
    logger.error("Rent Gear Failed", e);
    return { success: false, error: (e as Error).message };
  }
}

export async function updateUserPreferences(userId: string, partialPrefs: Record<string, any>) {
  return await updateUserMetadata(userId, partialPrefs);
}