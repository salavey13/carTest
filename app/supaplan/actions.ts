"use server";

import { supabaseAdmin } from "@/hooks/supabase";

export async function claimTask(capability: string, agentId: string) {

  const { data, error } = await supabaseAdmin
    .rpc("supaplan_claim_task", {
      p_capability: capability,
      p_agent: agentId,
    });

  if (error) {
    throw error;
  }

  return data;
}

export async function updateTaskStatus(
  taskId: string,
  status: string
) {

  const { error } = await supabaseAdmin
    .from("supaplan_tasks")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    throw error;
  }
}