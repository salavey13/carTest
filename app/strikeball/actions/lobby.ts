"use server";

import { supabaseAdmin, fetchUserData } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { logger } from "@/lib/logger";
import { v4 as uuidv4 } from "uuid";

const BOT_USERNAME = "oneSitePlsBot";

/**
 * FETCH LOBBY DATA (Server-Side "Manual Join")
 * Retrieves lobby, members, and user details without relying on DB foreign key joins.
 */
export async function fetchLobbyData(lobbyId: string) {
  try {
    // 1. Fetch Lobby (Raw)
    const { data: lobby, error: lobbyError } = await supabaseAdmin
      .from("lobbies")
      .select("*")
      .eq("id", lobbyId)
      .single();

    if (lobbyError || !lobby) {
      return { success: false, error: "Lobby not found" };
    }

    // 2. Fetch Members (Raw)
    const { data: members, error: membersError } = await supabaseAdmin
      .from("lobby_members")
      .select("*")
      .eq("lobby_id", lobbyId);

    if (membersError) {
      return { success: false, error: "Failed to load members" };
    }

    // 3. Extract Real User IDs (Skip bots or placeholders)
    const userIds = members
      .filter((m) => !m.is_bot && m.user_id && m.user_id.length > 10) // Basic length check for valid UUID/String IDs
      .map((m) => m.user_id);

    // 4. Fetch User Profiles
    let userMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("user_id, username, full_name, avatar_url")
        .in("user_id", userIds);
      
      users?.forEach((u) => {
        userMap[u.user_id] = u;
      });
    }

    // 5. Merge Data manually to mimic the shape the client expects
    const enrichedMembers = members.map((m) => {
      const userProfile = userMap[m.user_id] || null;
      return {
        ...m,
        user: userProfile
      };
    });

    return { success: true, lobby, members: enrichedMembers };
  } catch (e: any) {
    logger.error("fetchLobbyData Failed", e);
    return { success: false, error: e.message };
  }
}

/**
 * Создание нового лобби (Create Lobby)
 */
export async function createStrikeballLobby(
  userId: string, 
  payload: { 
    name: string; 
    mode: string; 
    start_at?: string | null; 
    max_players?: number;
    crew_id?: string | null;
    location?: string;
  }
) {
  if (!userId) return { success: false, error: "Unauthorized: No User ID" };
  
  const { name, mode, start_at, max_players = 20, crew_id, location } = payload;

  try {
    const qrHash = uuidv4(); 
    
    // 1. Create Lobby
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
        field_id: location || null,
        metadata: { bots_enabled: true }
      })
      .select()
      .single();

    if (lobbyError) throw new Error(`DB Insert Error: ${lobbyError.message}`);

    // 2. Add Owner
    const { error: memberError } = await supabaseAdmin.from("lobby_members").insert({
      lobby_id: lobby.id,
      user_id: userId,
      role: 'owner', 
      team: "blue",
      is_bot: false,
      status: "ready"
    });

    if (memberError) throw new Error(`Failed to join owner: ${memberError.message}`);

    // 3. Notify
    const deepLink = `https://t.me/${BOT_USERNAME}/app?startapp=lobby_${lobby.id}`;
    const timeStr = start_at ? new Date(start_at).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : 'СКОРО';
    const locStr = location ? `\n**Координаты:** ${location}` : '';

    sendComplexMessage(
      userId,
      `🔴 **ОПЕРАЦИЯ НАЧАТА** 🔴\n\n**Цель:** ${name}\n**Режим:** ${mode.toUpperCase()}\n**Сбор:** ${timeStr}${locStr}\n\n[🔗 ПРИГЛАСИТЬ БОЙЦОВ](${deepLink})`,
      [],
      { parseMode: "Markdown" }
    ).catch(err => logger.error("TG Notify Error:", err));

    return { success: true, lobbyId: lobby.id };
  } catch (e: any) {
    logger.error("createStrikeballLobby Exception:", e);
    return { success: false, error: e.message };
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