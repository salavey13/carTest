"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import type { Database } from "@/types/database.types";

type Subject = Database["public"]["Tables"]["subjects"]["Row"] & { grade_level?: number | null };
type LeaderboardEntry = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  total_score: number | null;
};

type AttemptRow = {
  user_id: string;
  subject_id: number;
  score: number | null;
  completed_at: string | null;
};

/**
 * task215b: лидерборд больше не зовёт RPC get_vpr_leaderboard.
 *
 * Почему: старый SQL делал SUM(vta.score) по ВСЕМ завершённым попыткам —
 * пересдача одного и того же варианта на 10/10 качала XP бесконечно (фарм).
 * Теперь считаем сумму ЛУЧШЕЙ попытки по каждому предмету: ретрейки честные,
 * но бесполезные для рейтинга. Агрегация в JS — объём данных мал (ВПР-контур),
 * и не нужен SQL-деплой миграции на прод.
 */
export async function getVprTestsBootstrapAction() {
  const { data: subjectsData, error: subjectsError } = await supabaseAdmin
    .from("subjects")
    .select("*")
    .in("grade_level", [6, 7, 8])
    .order("grade_level", { ascending: true });

  if (subjectsError) {
    return { success: false, error: subjectsError.message, subjects: [], leaderboard: [] as LeaderboardEntry[] };
  }

  // 1) завершённые оцениваемые попытки
  const { data: attemptsData, error: attemptsError } = await supabaseAdmin
    .from("vpr_test_attempts")
    .select("user_id, subject_id, score, completed_at")
    .not("completed_at", "is", null)
    .not("score", "is", null);

  if (attemptsError) {
    return {
      success: false,
      error: attemptsError.message,
      subjects: (subjectsData as Subject[]) || [],
      leaderboard: [] as LeaderboardEntry[],
    };
  }

  // 2) профили участников (для username/avatar)
  const attempts = (attemptsData as AttemptRow[]) || [];
  const userIds = [...new Set(attempts.map((a) => a.user_id))];
  const usersById = new Map<string, { username: string | null; avatar_url: string | null }>();
  if (userIds.length > 0) {
    const { data: usersData } = await supabaseAdmin
      .from("users")
      .select("user_id, username, avatar_url")
      .in("user_id", userIds);
    for (const u of (usersData as { user_id: string; username: string | null; avatar_url: string | null }[]) || []) {
      usersById.set(u.user_id, { username: u.username || null, avatar_url: u.avatar_url || null });
    }
  }

  // 3) сумма лучших попыток по каждому предмету (антифарм task215b)
  //    плюс lastCompletedAt для тай-брейка (позже сдал — выше при равном XP)
  const bestPerSubject = new Map<string, Map<number, number>>();
  const lastCompleted = new Map<string, string>();
  for (const a of attempts) {
    if (typeof a.score !== "number" || !a.user_id) continue;
    const bySubject = bestPerSubject.get(a.user_id) || new Map<number, number>();
    const prev = bySubject.get(a.subject_id);
    if (prev === undefined || a.score > prev) bySubject.set(a.subject_id, a.score);
    bestPerSubject.set(a.user_id, bySubject);
    const cAt = a.completed_at || "";
    if (cAt && cAt > (lastCompleted.get(a.user_id) || "")) lastCompleted.set(a.user_id, cAt);
  }

  const leaderboard: LeaderboardEntry[] = userIds
    .map((uid) => ({
      user_id: uid,
      username: usersById.get(uid)?.username || null,
      avatar_url: usersById.get(uid)?.avatar_url || null,
      total_score: [...(bestPerSubject.get(uid)?.values() || [])].reduce((s, v) => s + v, 0),
    }))
    .filter((e) => e.total_score > 0)
    .sort((a, b) => {
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      return (lastCompleted.get(b.user_id) || "").localeCompare(lastCompleted.get(a.user_id) || "");
    })
    .slice(0, 5);

  return {
    success: true,
    subjects: (subjectsData as Subject[]) || [],
    leaderboard,
  };
}
