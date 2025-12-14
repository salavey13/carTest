"use server";

import { supabaseAdmin, fetchUserData } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { logger } from "@/lib/logger";
import { v4 as uuidv4 } from "uuid";

const BOT_USERNAME = "oneSitePlsBot";

/**
 * Создание нового лобби (Create Lobby)
 * Supports optional hosting by a Crew and Location.
 */
export async function createStrikeballLobby(
  userId: string, 
  payload: { 
    name: string; 
    mode: string; 
    start_at?: string | null; 
    max_players?: number;
    crew_id?: string | null;
    location?: string; // NEW: GPS or Address string
  }
) {
  logger.info(`[createStrikeballLobby] Attempting to create lobby for user: ${userId}`, payload);

  if (!userId) {
    return { success: false, error: "Unauthorized: No User ID" };
  }
  
  if (!supabaseAdmin) {
    return { success: false, error: "Server Error: DB Client Missing" };
  }

  const { name, mode, start_at, max_players = 20, crew_id, location } = payload;

  try {
    const qrHash = uuidv4(); 
    
    // 1. Create the Lobby record
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
        crew_id: crew_id || null,
        field_id: location || null, // Storing location string in field_id
        metadata: { bots_enabled: true }
      })
      .select()
      .single();

    if (lobbyError) {
        throw new Error(`DB Insert Error: ${lobbyError.message}`);
    }

    if (!lobby) {
         throw new Error("Lobby creation failed (no data returned).");
    }

    // 2. Auto-join owner as Blue Team Leader
    const { error: memberError } = await supabaseAdmin.from("lobby_members").insert({
      lobby_id: lobby.id,
      user_id: userId,
      role: 'owner', 
      team: "blue",
      is_bot: false,
      status: "ready"
    });

    if (memberError) {
        throw new Error(`Failed to join owner: ${memberError.message}`);
    }

    // 3. Notify via Telegram (Non-blocking)
    const deepLink = `https://t.me/${BOT_USERNAME}/app?startapp=lobby_${lobby.id}`;
    const timeStr = start_at ? new Date(start_at).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : 'СКОРО';
    const locStr = location ? `\n**Координаты:** ${location}` : '';

    sendComplexMessage(
      userId,
      `🔴 **АРЕНА СОЗДАНА** 🔴\n\n**Операция:** ${name}\n**Режим:** ${mode.toUpperCase()}\n**Сбор:** ${timeStr}${locStr}\n\n[🔗 ПРИГЛАСИТЬ БОЙЦОВ](${deepLink})`,
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
  if (!userId || !lobbyId) return { success: false, error: "Missing IDs" };

  try {
    const { data: existing } = await supabaseAdmin
      .from("lobby_members")
      .select("id, team")
      .eq("lobby_id", lobbyId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
        if (existing.team !== team) {
            await supabaseAdmin
                .from("lobby_members")
                .update({ team, status: 'ready' }) 
                .eq("id", existing.id);
            return { success: true, message: `Смена команды: ${team.toUpperCase()}` };
        }
        return { success: true, message: "Вы уже в этой команде." };
    }

    await supabaseAdmin.from("lobby_members").insert({
      lobby_id: lobbyId,
      user_id: userId,
      role: 'member',
      team,
      is_bot: false,
      status: "ready"
    });

    // Notify Owner
    const { data: lobby } = await supabaseAdmin.from("lobbies").select("owner_id, name").eq("id", lobbyId).single();
    if (lobby?.owner_id && lobby.owner_id !== userId) {
       fetchUserData(userId).then(user => {
           sendComplexMessage(
             lobby.owner_id, 
             `⚠️ **ПОДКРЕПЛЕНИЕ**\nБоец: ${user?.username || userId} -> ${lobby.name} (${team.toUpperCase()}).`
           ).catch(console.error);
       });
    }

    return { success: true, message: "Успешная высадка." };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getOpenLobbies() {
  try {
    const { data, error } = await supabaseAdmin
      .from("lobbies")
      .select(`*, host_crew:crews(id, name, slug, logo_url)`)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (e) {
    return { success: false, error: "Connection lost." };
  }
}

export async function getUserActiveLobbies(userId: string) {
    if (!userId) return { success: false, data: [] };
    const { data } = await supabaseAdmin.from("lobby_members").select("lobby_id").eq("user_id", userId);
    return { success: true, data: data?.map(d => d.lobby_id) || [] };
}

export async function addNoobBot(lobbyId: string, team: string) {
  try {
    const botId = uuidv4(); 
    const { error } = await supabaseAdmin.from("lobby_members").insert({
      lobby_id: lobbyId,
      user_id: botId,
      is_bot: true,
      team,
      status: "ready",
      role: "bot"
    });
    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    return { success: false, error: "Ошибка бота." };
  }
}

export async function removeMember(memberId: string) {
  try {
    const { error } = await supabaseAdmin.from("lobby_members").delete().eq("id", memberId);
    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    return { success: false, error: "Ошибка удаления." };
  }
}

export async function togglePlayerStatus(memberId: string, currentStatus: string) {
    try {
        const newStatus = currentStatus === 'alive' ? 'dead' : 'alive';
        await supabaseAdmin.from("lobby_members").update({ status: newStatus }).eq("id", memberId);
        return { success: true, newStatus };
    } catch (e) {
        return { success: false, error: "Ошибка статуса" };
    }
}