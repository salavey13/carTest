"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { revalidatePath } from "next/cache";

export async function updateTransportStatus(
  memberId: string, 
  payload: { role: string; seats?: number; car_name?: string }
) {
  try {
    const { data: member } = await supabaseAdmin.from("lobby_members").select("metadata").eq("id", memberId).single();
    const currentMeta = (member?.metadata as Record<string, any>) || {};
    const newMeta = {
      ...currentMeta,
      transport: { role: payload.role, seats: payload.seats || 0, car_name: payload.car_name || "Транспорт", updated_at: new Date().toISOString() }
    };
    const { error } = await supabaseAdmin.from("lobby_members").update({ metadata: newMeta }).eq("id", memberId);
    if (error) throw error;
    revalidatePath('/strikeball/lobbies');
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function signSafetyBriefing(memberId: string) {
  try {
    const { data: member } = await supabaseAdmin.from("lobby_members").select("metadata").eq("id", memberId).single();
    const currentMeta = (member?.metadata as Record<string, any>) || {};
    const newMeta = { ...currentMeta, safety_signed: true, safety_signed_at: new Date().toISOString() };
    const { error } = await supabaseAdmin.from("lobby_members").update({ metadata: newMeta }).eq("id", memberId);
    if (error) throw error;
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}