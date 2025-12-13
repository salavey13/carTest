"use server";

import { supabaseAdmin, fetchUserData } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { logger } from "@/lib/logger";
import { v4 as uuidv4 } from "uuid";

const BOT_USERNAME = "oneSitePlsBot";

/**
 * Создание нового лобби (Create Lobby)
 * Supports optional hosting by a Crew.
 */
export async function createStrikeballLobby(
  userId: string, 
  payload: { 
    name: string; 
    mode: string; 
    start_at?: string | null; 
    max_players?: number;
    crew_id?: string | null;
  }
) {
  if (!userId) return { success: false, error: "Требуется авторизация" };
  const { name, mode, start_at, max_players = 20, crew_id } = payload;

  try {
    const qrHash = uuidv4(); 
    
    // 1. Create Lobby Record
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
        crew_id: crew_id || null,
        metadata: { bots_enabled: true }
      })
      .select()
      .single();

    if (error) throw error;

    // 2. Auto-join owner as Blue Team Leader
    await supabaseAdmin.from("lobby_members").insert({
      lobby_id: lobby.id,
      user_id: userId,
      team: "blue",
      role: "owner",
      is_bot: false,
      status: "ready"
    });

    // 3. Generate Links & Notify
    const deepLink = `https://t.me/${BOT_USERNAME}/app?startapp=lobby_${lobby.id}`;
    const timeStr = start_at ? new Date(start_at).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : 'СКОРО';
    const squadTag = crew_id ? `\n**Отряд:** OFFICIAL SQUAD RAID` : '';

    await sendComplexMessage(
      userId,
      `🔴 **АРЕНА СОЗДАНА** 🔴\n\n**Операция:** ${name}\n**Режим:** ${mode.toUpperCase()}\n**Сбор:** ${timeStr}${squadTag}\n\n[🔗 ПРИГЛАСИТЬ БОЙЦОВ](${deepLink})`,
      [],
      { parseMode: "Markdown" }
    );

    return { success: true, lobbyId: lobby.id };
  } catch (e: any) {
    logger.error("Create Lobby Failed", e);
    return { success: false, error: e.message || "Ошибка создания лобби" };
  }
}

/**
 * Вход в лобби или смена команды (Join/Switch)
 */
export async function joinLobby(userId: string, lobbyId: string, team: string = "red") {
  try {
    // 1. Check current status
    const { data: existing, error: checkError } = await supabaseAdmin
      .from("lobby_members")
      .select("id, team")
      .eq("lobby_id", lobbyId)
      .eq("user_id", userId)
      .maybeSingle();

    if (checkError) throw checkError;

    if (existing) {
        // Switch team if different
        if (existing.team !== team) {
            const { error: updateError } = await supabaseAdmin
                .from("lobby_members")
                .update({ team, status: 'ready' })
                .eq("id", existing.id);
            
            if (updateError) throw updateError;

            return { success: true, message: `Смена команды: ${team.toUpperCase()}` };
        }
        return { success: true, message: "Вы уже в этой команде." };
    }

    // 2. Insert new member
    const { error: insertError } = await supabaseAdmin.from("lobby_members").insert({
      lobby_id: lobbyId,
      user_id: userId,
      team,
      role: 'member',
      is_bot: false,
      status: "ready"
    });

    if (insertError) throw insertError;

    // 3. Notify Owner
    const { data: lobby } = await supabaseAdmin.from("lobbies").select("owner_id, name").eq("id", lobbyId).single();
    if (lobby?.owner_id && lobby.owner_id !== userId) {
       const user = await fetchUserData(userId);
       await sendComplexMessage(
         lobby.owner_id, 
         `⚠️ **ПОДКРЕПЛЕНИЕ ПРИБЫЛО**\nБоец: ${user?.username || userId} вступил в ${lobby.name} (${team.toUpperCase()}).`
       );
    }

    return { success: true, message: "Вы успешно вступили в отряд." };
  } catch (e) {
    logger.error("joinLobby failed", e);
    return { success: false, error: "Ошибка входа." };
  }
}

/**
 * Получить список открытых игр (Lobbies + Host Crew info)
 */
export async function getOpenLobbies() {
  try {
    const { data, error } = await supabaseAdmin
      .from("lobbies")
      .select(`
        *,
        host_crew:crews(id, name, slug, logo_url)
      `)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (e) {
    logger.error("getOpenLobbies Failed", e);
    return { success: false, error: "Ошибка соединения." };
  }
}

/**
 * Получить список лобби, где пользователь уже участвует (для UI индикации)
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
        logger.error("getUserActiveLobbies Failed", e);
        return { success: false, data: [] };
    }
}

/**
 * Добавить бота (Tactical Feature)
 */
export async function addNoobBot(lobbyId: string, team: string) {
  try {
    const { error } = await supabaseAdmin.from("lobby_members").insert({
      lobby_id: lobbyId,
      user_id: null, // Null indicates a bot
      is_bot: true,
      team,
      status: "ready"
    });
    
    if (error) throw error;
    return { success: true };
  } catch (e) {
    logger.error("addNoobBot Failed", e);
    return { success: false, error: "Ошибка бота." };
  }
}

/**
 * Переключить статус (Жив/Мертв)
 */
export async function togglePlayerStatus(memberId: string, currentStatus: string) {
    try {
        const newStatus = currentStatus === 'alive' ? 'dead' : 'alive';
        const { error } = await supabaseAdmin
            .from("lobby_members")
            .update({ status: newStatus })
            .eq("id", memberId);
            
        if (error) throw error;
        return { success: true, newStatus };
    } catch (e) {
        logger.error("togglePlayerStatus Failed", e);
        return { success: false, error: "Ошибка статуса" };
    }
}