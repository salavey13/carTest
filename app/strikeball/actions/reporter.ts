"use server";

import { supabaseAdmin } from "@/hooks/supabase";

export async function generateBattleReport(lobbyId: string) {
  // 1. Fetch Lobby & Logs
  const { data: lobby } = await supabaseAdmin.from("lobbies").select("*").eq("id", lobbyId).single();
  const { data: members } = await supabaseAdmin.from("lobby_members").select("*, user:users(username)").eq("lobby_id", lobbyId);
  const { data: checkpoints } = await supabaseAdmin.from("lobby_checkpoints").select("*").eq("lobby_id", lobbyId);
  
  // In a real scenario, we'd query an 'events' table for a timeline. 
  // For now, we reconstruct the story from current state.

  const winner = lobby.metadata?.winner?.toUpperCase() || "UNRESOLVED";
  const score = lobby.metadata?.score || { red: 0, blue: 0 };
  const duration = lobby.metadata?.actual_end_at && lobby.metadata?.actual_start_at
    ? Math.round((new Date(lobby.metadata.actual_end_at).getTime() - new Date(lobby.metadata.actual_start_at).getTime()) / 60000)
    : "Unknown";

  // MVP "AI" Template
  const report = `
⚡️ **БОЕВАЯ СВОДКА: ОПЕРАЦИЯ "${lobby.name.toUpperCase()}"** ⚡️

📍 **Локация:** ${lobby.field_id || "Секретный полигон"}
⏱ **Длительность:** ${duration} мин
🏆 **Победитель:** ${winner === 'RED' ? '🔴 КРАСНЫЕ' : winner === 'BLUE' ? '🔵 СИНИЕ' : '🏳️ НИЧЬЯ'}

📊 **Счет:**
🔴 RED: ${score.red}
🔵 BLUE: ${score.blue}

🚩 **Контроль Точек:**
${checkpoints?.map((cp: any) => `- ${cp.name}: ${cp.owner_team === 'red' ? '🔴' : cp.owner_team === 'blue' ? '🔵' : '⚪️'}`).join('\n')}

🎖 **Герои Битвы:**
(Данные засекречены до полной синхронизации логов)

#Strikeball #BattleReport #${lobby.mode}
  `;

  return { success: true, report };
}