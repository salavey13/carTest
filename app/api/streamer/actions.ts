import { supabaseAdmin } from "@/hooks/supabase";

export async function getLeaderboard({ streamerId, limit }: { streamerId: string; limit: number }) {
  // Placeholder implementation to satisfy build
  return { success: true, data: [] };
}

export async function getStreamerProfile(streamerId: string) {
  // Placeholder implementation to satisfy build
  return { success: true, data: { id: streamerId, name: "Streamer" } };
}