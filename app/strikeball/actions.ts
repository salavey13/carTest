"use server";

import { supabaseAdmin, fetchUserData } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { sendTelegramInvoice } from "@/app/actions"; 
import { logger } from "@/lib/logger";
import { v4 as uuidv4 } from "uuid";

const BOT_USERNAME = "oneSitePlsBot";

// --- PATH B: COMMANDER (Lobby Management) ---

/**
 * Creates a new Strikeball lobby.
 * Uses the 'lobbies' table and adds the creator to 'lobby_members'.
 */
export async function createStrikeballLobby(
  userId: string, 
  payload: { name: string; mode: string; start_at?: string | null; max_players?: number }
) {
  logger.info(`[createStrikeballLobby] Attempting to create lobby for user: ${userId}`, payload);

  if (!userId) {
    logger.error("[createStrikeballLobby] User ID missing.");
    return { success: false, error: "Unauthorized: No User ID" };
  }
  
  if (!supabaseAdmin) {
    logger.error("[createStrikeballLobby] Supabase Admin client not initialized.");
    return { success: false, error: "Server Error: DB Client Missing" };
  }

  const { name, mode, start_at, max_players = 20 } = payload;

  try {
    const qrHash = uuidv4(); 
    
    // 1. Create the Lobby record
    logger.info("[createStrikeballLobby] Inserting lobby record...");
    const { data: lobby, error: lobbyError } = await supabaseAdmin
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

    if (lobbyError) {
        logger.error("[createStrikeballLobby] Failed to insert lobby:", lobbyError);
        throw new Error(`DB Insert Error: ${lobbyError.message}`);
    }

    if (!lobby) {
         logger.error("[createStrikeballLobby] Lobby inserted but no data returned.");
         throw new Error("Lobby creation failed (no data returned).");
    }

    logger.info(`[createStrikeballLobby] Lobby created: ${lobby.id}. Joining owner...`);

    // 2. Auto-join owner to Blue team
    const { error: memberError } = await supabaseAdmin.from("lobby_members").insert({
      lobby_id: lobby.id,
      user_id: userId,
      role: 'owner', // Explicitly set role
      team: "blue",
      is_bot: false,
      status: "ready"
    });

    if (memberError) {
        logger.error(`[createStrikeballLobby] Failed to add owner to lobby_members:`, memberError);
        // Optional: Delete the lobby if owner join fails to avoid zombie lobbies? 
        // For now, just throw.
        throw new Error(`Failed to join owner: ${memberError.message}`);
    }

    // 3. Notify via Telegram (Non-blocking)
    const deepLink = `https://t.me/${BOT_USERNAME}/app?startapp=lobby_${lobby.id}`;
    const timeStr = start_at ? new Date(start_at).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : 'ASAP';

    // We don't await this to keep UI snappy, just log errors if any
    sendComplexMessage(
      userId,
      `🔴 **ARENA INITIALIZED** 🔴\n\n**Operation:** ${name}\n**Mode:** ${mode.toUpperCase()}\n**Time:** ${timeStr}\n\n[🔗 CLICK TO DEPLOY SQUAD](${deepLink})`,
      [],
      { parseMode: "Markdown" }
    ).catch(err => logger.error("[createStrikeballLobby] Failed to send TG notification:", err));

    return { success: true, lobbyId: lobby.id };
  } catch (e: any) {
    logger.error("[createStrikeballLobby] Exception:", e);
    return { success: false, error: e.message || "Failed to deploy lobby." };
  }
}

export async function joinLobby(userId: string, lobbyId: string, team: string = "red") {
  logger.info(`[joinLobby] User ${userId} attempting to join lobby ${lobbyId} as ${team}`);

  if (!userId || !lobbyId) {
      return { success: false, error: "Missing User ID or Lobby ID" };
  }

  try {
    // 1. Check if already a member
    const { data: existing, error: checkError } = await supabaseAdmin
      .from("lobby_members")
      .select("id, team")
      .eq("lobby_id", lobbyId)
      .eq("user_id", userId)
      .maybeSingle();

    if (checkError) {
        logger.error(`[joinLobby] Error checking membership:`, checkError);
        throw checkError;
    }

    if (existing) {
        logger.info(`[joinLobby] User already member of team ${existing.team}.`);
        // Logic: If already member, allow switching teams
        if (existing.team !== team) {
            logger.info(`[joinLobby] Switching teams from ${existing.team} to ${team}`);
            const { error: updateError } = await supabaseAdmin
                .from("lobby_members")
                .update({ team, status: 'ready' }) 
                .eq("id", existing.id);
            
            if (updateError) throw updateError;

            return { success: true, message: `Switched to ${team.toUpperCase()} team.` };
        }
        return { success: true, message: "Already deployed in this team." };
    }

    // 2. Insert new member
    logger.info(`[joinLobby] Inserting new member record...`);
    const { error: insertError } = await supabaseAdmin.from("lobby_members").insert({
      lobby_id: lobbyId,
      user_id: userId,
      role: 'member',
      team,
      is_bot: false,
      status: "ready"
    });

    if (insertError) {
        logger.error(`[joinLobby] Insert failed:`, insertError);
        throw insertError;
    }

    // 3. Notify Owner (Non-blocking)
    // Fetch lobby owner to notify
    const { data: lobby } = await supabaseAdmin.from("lobbies").select("owner_id, name").eq("id", lobbyId).single();
    
    if (lobby?.owner_id && lobby.owner_id !== userId) {
       fetchUserData(userId).then(user => {
           const userName = user?.username || `User ${userId}`;
           sendComplexMessage(
             lobby.owner_id, 
             `⚠️ **REINFORCEMENTS ARRIVED**\nUser: ${userName} joined ${lobby.name} (${team.toUpperCase()}).`
           ).catch(err => logger.error("[joinLobby] Failed to notify owner:", err));
       });
    }

    return { success: true, message: "Deployed successfully." };
  } catch (e: any) {
    logger.error("[joinLobby] Failed:", e);
    return { success: false, error: e.message || "Deployment failed." };
  }
}

/**
 * Fetches active lobbies.
 */
export async function getOpenLobbies() {
  try {
    const { data, error } = await supabaseAdmin
      .from("lobbies")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    logger.info(`[getOpenLobbies] Fetched ${data?.length} lobbies.`);
    return { success: true, data: data || [] };
  } catch (e: any) {
    logger.error("[getOpenLobbies] Failed:", e);
    return { success: false, error: "Connection lost." };
  }
}

/**
 * Helper to get IDs of lobbies the user is currently in.
 * Used for UI indicators (Join vs Enter).
 */
export async function getUserActiveLobbies(userId: string) {
    if (!userId) return { success: false, data: [] };
    
    try {
        const { data, error } = await supabaseAdmin
            .from("lobby_members")
            .select("lobby_id")
            .eq("user_id", userId);
            
        if (error) throw error;
        
        return { success: true, data: data?.map(d => d.lobby_id) || [] };
    } catch (e) {
        logger.error("[getUserActiveLobbies] Failed:", e);
        return { success: false, data: [] };
    }
}

// --- PATH C: TACTICAL (Bots & Status) ---

export async function addNoobBot(lobbyId: string, team: string) {
  try {
    await supabaseAdmin.from("lobby_members").insert({
      lobby_id: lobbyId,
      user_id: null, // Null indicates a bot
      is_bot: true,
      team,
      status: "ready"
    });
    return { success: true };
  } catch (e) {
    logger.error("[addNoobBot] failed", e);
    return { success: false, error: "Bot malfunction." };
  }
}

export async function togglePlayerStatus(memberId: string, currentStatus: string) {
    try {
        const newStatus = currentStatus === 'alive' ? 'dead' : 'alive';
        await supabaseAdmin.from("lobby_members").update({ status: newStatus }).eq("id", memberId);
        return { success: true, newStatus };
    } catch (e) {
        return { success: false, error: "Status update failed" };
    }
}

// --- PATH A: ECONOMY (Gear via 'cars' table) ---

/**
 * Fetches gear from the common 'cars' table using specific types.
 */
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

/**
 * Sends a Telegram Invoice (XTR) for gear rental.
 */
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

/**
 * Updates user preferences (metadata).
 */
export async function updateUserPreferences(userId: string, partialPrefs: Record<string, any>) {
  return await updateUserMetadata(userId, partialPrefs);
}