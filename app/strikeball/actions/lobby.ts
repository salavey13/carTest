"use server";

import { supabaseAdmin, fetchUserData } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { logger } from "@/lib/logger";
import { v4 as uuidv4 } from "uuid";

const BOT_USERNAME = "oneSitePlsBot";

/**
 * Создание нового лобби (Create Lobby)
 */
export async function createStrikeballLobby(
  userId: string, 
  payload: { name: string; mode: string; start_at?: string | null; max_players?: number }
) {
  if (!userId) return { success: false, error: "Требуется авторизация" };
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

    // Авто-вход создателя за Синих
    await supabaseAdmin.from("lobby_members").insert({
      lobby_id: lobby.id,
      user_id: userId,
      team: "blue",
      role: "owner",
      is_bot: false,
      status: "ready"
    });

    const deepLink = `https://t.me/${BOT_USERNAME}/app?startapp=lobby_${lobby.id}`;
    const timeStr = start_at ? new Date(start_at).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : 'СКОРО';

    // Уведомление в ЛС
    await sendComplexMessage(
      userId,
      `🔴 **АРЕНА СОЗДАНА** 🔴\n\n**Операция:** ${name}\n**Режим:** ${mode.toUpperCase()}\n**Сбор:** ${timeStr}\n\n[🔗 ПРИГЛАСИТЬ БОЙЦОВ](${deepLink})`,
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
    // Проверка текущего статуса
    const { data: existing } = await supabaseAdmin
      .from("lobby_members")
      .select("id, team")
      .eq("lobby_id", lobbyId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
        if (existing.team !== team) {
            await supabaseAdmin.from("lobby_members").update({ team, status: 'ready' }).eq("id", existing.id);
            return { success: true, message: `Смена команды: ${team.toUpperCase()}` };
        }
        return { success: true, message: "Вы уже в этой команде." };
    }

    // Вставка нового бойца
    await supabaseAdmin.from("lobby_members").insert({
      lobby_id: lobbyId,
      user_id: userId,
      team,
      role: 'member',
      is_bot: false,
      status: "ready"
    });

    // Уведомление владельца
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
 * Получить список открытых игр
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
    return { success: true, data: data || [] };
  } catch (e) {
    return { success: false, error: "Ошибка соединения." };
  }
}

/**
 * Получить список лобби, где пользователь уже участвует
 */
export async function getUserActiveLobbies(userId: string) {
    if (!userId) return { success: false, data: [] };
    const { data } = await supabaseAdmin.from("lobby_members").select("lobby_id").eq("user_id", userId);
    return { success: true, data: data?.map(d => d.lobby_id) || [] };
}

/**
 * Добавить бота
 */
export async function addNoobBot(lobbyId: string, team: string) {
  try {
    await supabaseAdmin.from("lobby_members").insert({
      lobby_id: lobbyId,
      user_id: null, 
      is_bot: true,
      team,
      status: "ready"
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: "Ошибка бота." };
  }
}

/**
 * Переключить статус (Жив/Мертв)
 */
export async function togglePlayerStatus(memberId: string, currentStatus: string) {
    try {
        const newStatus = currentStatus === 'alive' ? 'dead' : 'alive';
        await supabaseAdmin.from("lobby_members").update({ status: newStatus }).eq("id", memberId);
        return { success: true, newStatus };
    } catch (e) {
        return { success: false, error: "Ошибка статуса" };
    }
}