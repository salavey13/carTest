"use server";

import { supabaseAnon, fetchUserData } from "@/hooks/supabase";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";
import { logger } from "@/lib/logger";
import { v4 as uuidv4 } from "uuid";

const BOT_USERNAME = "oneSitePlsBot";

/**
 * Fetches the most recent geo-pings for all active members in a lobby.
 * Privileged access via supabaseAnon.
 */
export async function getLobbyGeoData(lobbyId: string) {
    try {
        const { data, error } = await supabaseAnon
            .from('lobby_geo_pings')
            .select('user_id, lat, lng, timestamp')
            .eq('lobby_id', lobbyId)
            .order('timestamp', { ascending: false });

        if (error) throw error;

        // Оставляем только последний пинг для каждого пользователя
        const latest = data.reduce((acc: any[], current) => {
            if (!acc.find(item => item.user_id === current.user_id)) acc.push(current);
            return acc;
        }, []);

        return { success: true, data: latest };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * FETCH LOBBY DATA (Server-Side "Manual Join")
 */
export async function fetchLobbyData(lobbyId: string) {
  try {
    // 1. Fetch Lobby
    const { data: lobby, error: lobbyError } = await supabaseAnon
      .from("lobbies")
      .select(`*, host_crew:crews(id, name, logo_url)`)
      .eq("id", lobbyId)
      .single();

    if (lobbyError || !lobby) return { success: false, error: "Lobby not found" };

    // 2. Fetch Members
    const { data: members, error: membersError } = await supabaseAnon
      .from("lobby_members")
      .select("*")
      .eq("lobby_id", lobbyId);

    if (membersError) return { success: false, error: "Members fetch failed" };

    // 3. Populate Users & GEAR
    const userIds = members.filter((m) => !m.is_bot && m.user_id).map((m) => m.user_id);
    
    let userMap: Record<string, any> = {};
    let gearMap: Record<string, any[]> = {};

    if (userIds.length > 0) {
      // Users
      const { data: users } = await supabaseAnon
        .from("users")
        .select("user_id, username, full_name, avatar_url")
        .in("user_id", userIds);
      users?.forEach((u) => { userMap[u.user_id] = u; });

      // Gear (Active/Paid items only)
      const { data: purchases } = await supabaseAnon
        .from("user_purchases")
        .select("user_id, metadata")
        .in("user_id", userIds)
        .eq("status", "paid"); // Only show active items
      
      purchases?.forEach(p => {
          if (!gearMap[p.user_id]) gearMap[p.user_id] = [];
          gearMap[p.user_id].push(p.metadata);
      });
    }

    const enrichedMembers = members.map((m) => ({
      ...m,
      user: userMap[m.user_id] || null,
      gear: gearMap[m.user_id] || []
    }));

    return { success: true, lobby, members: enrichedMembers };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Создание нового лобби (Create Lobby)
 * Supports optional hosting by a Crew and Location.
 * Supports 'description' in metadata.
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
    description?: string; // NEW: Description field
  }
) {
  if (!userId) return { success: false, error: "Unauthorized: No User ID" };
  
  const { name, mode, start_at, max_players = 20, crew_id, location, description } = payload;

  try {
    const qrHash = uuidv4(); 
    
    // 1. Create Lobby record
    const { data: lobby, error: lobbyError } = await supabaseAnon
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
        // PROPERLY HANDLE METADATA FOR CREATE
        metadata: { 
            bots_enabled: true,
            description: description 
        }
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
    const { error: memberError } = await supabaseAnon.from("lobby_members").insert({
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
    const squadTag = crew_id ? `\n**Отряд:** OFFICIAL SQUAD RAID` : '';
    
    sendComplexMessage(
      userId,
      `🔴 **ОПЕРАЦИЯ НАЧАТА** 🔴\n\n**Цель:** ${name}\n**Режим:** ${mode.toUpperCase()}\n**Сбор:** ${timeStr}${locStr}${squadTag}\n\n[🔗 ПРИГЛАСИТЬ БОЙЦОВ](${deepLink})`,
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
    // 0. CHECK OWNERSHIP FIRST
    const { data: lobby } = await supabaseAnon.from("lobbies").select("owner_id, name").eq("id", lobbyId).single();
    const isOwner = lobby?.owner_id === userId;
    const role = isOwner ? 'owner' : 'member';

    // 1. Check existing member
    const { data: existing } = await supabaseAnon
      .from("lobby_members")
      .select("id, team, role")
      .eq("lobby_id", lobbyId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
        // Update team AND ensure role is correct (restore owner rank if lost)
        if (existing.team !== team || existing.role !== role) {
            await supabaseAnon
                .from("lobby_members")
                .update({ team, role, status: 'ready' }) 
                .eq("id", existing.id);
            return { success: true, message: `Команда: ${team.toUpperCase()}` };
        }
        return { success: true, message: "Вы уже в этой команде." };
    }

    // 2. Insert new member
    await supabaseAnon.from("lobby_members").insert({
      lobby_id: lobbyId,
      user_id: userId,
      role: role, // Use calculated role
      team,
      is_bot: false,
      status: "ready"
    });

    // 3. Notify Owner (only if joiner != owner)
    if (lobby?.owner_id && !isOwner) {
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
    // Fetch lobbies AND their host crew details
    const { data, error } = await supabaseAnon
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
    return { success: false, error: "Ошибка соединения." };
  }
}

export async function getUserActiveLobbies(userId: string) {
    if (!userId) return { success: false, data: [] };
    const { data } = await supabaseAnon.from("lobby_members").select("lobby_id").eq("user_id", userId);
    return { success: true, data: data?.map(d => d.lobby_id) || [] };
}

export async function addNoobBot(lobbyId: string, team: string) {
  try {
    const botId = uuidv4(); 
    const { error } = await supabaseAnon.from("lobby_members").insert({
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
    const { error } = await supabaseAnon.from("lobby_members").delete().eq("id", memberId);
    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    return { success: false, error: "Ошибка удаления." };
  }
}

export async function togglePlayerStatus(memberId: string, currentStatus: string) {
    try {
        const newStatus = currentStatus === 'alive' ? 'dead' : 'alive';
        await supabaseAnon.from("lobby_members").update({ status: newStatus }).eq("id", memberId);
        return { success: true, newStatus };
    } catch (e) {
        return { success: false, error: "Ошибка статуса" };
    }
}

/**
 * Предложить новую дату (Owner Only)
 */
export async function proposeLobbyDate(lobbyId: string, userId: string, newDate: string) {
    try {
        const { data: lobby } = await supabaseAnon.from("lobbies").select("owner_id, metadata").eq("id", lobbyId).single();
        if (lobby?.owner_id !== userId) throw new Error("Только владелец может менять дату");

        const newMeta = { 
            ...lobby.metadata, 
            proposed_date: newDate,
            approval_status: 'proposed' 
        };

        // Сбрасываем голоса при смене даты
        await supabaseAnon.from("lobby_members").update({ metadata: { vote: null } }).eq("lobby_id", lobbyId);
        await supabaseAnon.from("lobbies").update({ start_at: newDate, metadata: newMeta }).eq("id", lobbyId);

        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

/**
 * Голосование за дату (Member Only)
 */
export async function voteForLobbyDate(lobbyId: string, userId: string, vote: 'ok' | 'not_ok') {
    try {
        const { data: member } = await supabaseAnon.from("lobby_members").select("id, metadata").eq("lobby_id", lobbyId).eq("user_id", userId).single();
        if (!member) throw new Error("Вы не участник операции");

        const newMeta = { ...(member.metadata as object), vote };
        await supabaseAnon.from("lobby_members").update({ metadata: newMeta }).eq("id", member.id);

        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

/**
 * Утверждение даты админом (Admin Only)
 */
export async function setLobbyApprovalStatus(lobbyId: string, status: 'approved_unpaid' | 'approved_paid') {
    try {
        const { data: lobby } = await supabaseAnon.from("lobbies").select("metadata").eq("id", lobbyId).single();
        const newMeta = { ...lobby.metadata, approval_status: status };
        await supabaseAnon.from("lobbies").update({ metadata: newMeta }).eq("id", lobbyId);
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

/**
 * РЕДАКТИРОВАНИЕ ЛОББИ (Edit Lobby)
 * Обновляет поля лобби, включая метаданные.
 * PROPERLY handles 'description' in metadata.
 */
export async function editLobby(
  userId: string, 
  lobbyId: string, 
  payload: { 
    name?: string; 
    mode?: string; 
    start_at?: string | null; 
    max_players?: number;
    location?: string;
    metadata?: any; // Обновление JSONB полей (например, bots_enabled, description)
  }
) {
  if (!userId || !lobbyId) return { success: false, error: "Missing IDs" };

  try {
    // 0. ПРОВЕРКА ПРАВ (Проверка Владельца)
    const { data: lobby } = await supabaseAnon.from("lobbies").select("owner_id").eq("id", lobbyId).single();
    if (!lobby) throw new Error("Lobby not found");
    if (lobby.owner_id !== userId) throw new Error("ACCESS DENIED");

    // 1. ПОДГОТОВКА ОБНОВЛЕНИЙ
    const updateData: any = {};
    
    if (payload.name) updateData.name = payload.name;
    if (payload.mode) updateData.mode = payload.mode;
    if (payload.start_at !== undefined) updateData.start_at = payload.start_at; // Разрешаем null
    if (payload.max_players) updateData.max_players = payload.max_players;
    if (payload.location) updateData.field_id = payload.location;
    
    // Специальная обработка для metadata, чтобы не перезаписать всё целиком, а смержить или обновить по ключу
    if (payload.metadata) {
        const { data: currentLobby } = await supabaseAnon.from("lobbies").select("metadata").eq("id", lobbyId).single();
        const existingMeta = currentLobby?.metadata || {};
        
        // Ensure we don't lose 'bots_enabled' if it wasn't in the payload
        // And we update 'description' correctly
        updateData.metadata = {
            ...existingMeta, // Keep existing stuff
            ...payload.metadata // Overwrite with new stuff
        };
    }

    // 2. ЗАПИСЬ В БАЗУ
    const { error } = await supabaseAnon
      .from("lobbies")
      .update(updateData)
      .eq("id", lobbyId);

    if (error) throw error;

    return { success: true, message: "ОПЕРАЦИЯ ОБНОВЛЕНА" };
  } catch (e: any) {
    logger.error("[editLobby] Exception:", e);
    return { success: false, error: e.message || "Failed to update lobby." };
  }
}