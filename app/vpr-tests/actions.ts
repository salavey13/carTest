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

export async function getVprTestsBootstrapAction() {
  const { data: subjectsData, error: subjectsError } = await supabaseAdmin
    .from("subjects")
    .select("*")
    .in("grade_level", [6, 7, 8])
    .order("grade_level", { ascending: true });

  if (subjectsError) {
    return { success: false, error: subjectsError.message, subjects: [], leaderboard: [] as LeaderboardEntry[] };
  }

  const { data: leaderboardData, error: lbError } = await supabaseAdmin.rpc("get_vpr_leaderboard", { limit_count: 5 });

  if (lbError) {
    return {
      success: false,
      error: lbError.message,
      subjects: (subjectsData as Subject[]) || [],
      leaderboard: [] as LeaderboardEntry[],
    };
  }

  return {
    success: true,
    subjects: (subjectsData as Subject[]) || [],
    leaderboard: (leaderboardData as LeaderboardEntry[]) || [],
  };
}
