"use server";

import "server-only";
import { randomUUID } from "crypto";

import { supabaseAdmin } from "@/hooks/supabase";

type SupaPlanTaskStatus = "open" | "claimed" | "running" | "ready_for_pr" | "done";

type PickTaskResult = {
  task: Record<string, unknown> | null;
  claim?: Record<string, unknown> | null;
};

const claimFallbackErrorCodes = new Set(["42883", "PGRST202"]);

async function fallbackClaimTask(capability: string, agentId: string): Promise<PickTaskResult> {
  const { data: task, error: selectError } = await supabaseAdmin
    .from("supaplan_tasks")
    .select("*")
    .eq("status", "open")
    .eq("capability", capability)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (!task) {
    return { task: null };
  }

  const nowIso = new Date().toISOString();

  const { data: claimedTask, error: claimTaskError } = await supabaseAdmin
    .from("supaplan_tasks")
    .update({
      status: "claimed",
      updated_at: nowIso,
    })
    .eq("id", task.id)
    .eq("status", "open")
    .select("*")
    .maybeSingle();

  if (claimTaskError) {
    throw claimTaskError;
  }

  if (!claimedTask) {
    return { task: null };
  }

  const claimToken = randomUUID();

  const { data: claim, error: claimError } = await supabaseAdmin
    .from("supaplan_claims")
    .insert({
      task_id: claimedTask.id,
      agent_id: agentId,
      claim_token: claimToken,
      status: "claimed",
      claimed_at: nowIso,
      last_heartbeat: nowIso,
    })
    .select("*")
    .maybeSingle();

  if (claimError) {
    throw claimError;
  }

  return {
    task: claimedTask,
    claim,
  };
}

async function pickTask(capability: string, agentId: string): Promise<PickTaskResult> {
  const { data, error } = await supabaseAdmin.rpc("supaplan_claim_task", {
    p_capability: capability,
    p_agent: agentId,
  });

  if (error) {
    if (claimFallbackErrorCodes.has(error.code ?? "")) {
      return fallbackClaimTask(capability, agentId);
    }

    throw error;
  }

  return (data ?? { task: null }) as PickTaskResult;
}

async function updateStatus(taskId: string, status: SupaPlanTaskStatus): Promise<void> {
  const allowedStatuses: SupaPlanTaskStatus[] = ["claimed", "running", "ready_for_pr"];

  if (!allowedStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}. Agents may only set claimed, running, or ready_for_pr.`);
  }

  const { error } = await supabaseAdmin
    .from("supaplan_tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) {
    throw error;
  }
}

async function logEvent(type: string, payload: Record<string, unknown> = {}): Promise<void> {
  const { error } = await supabaseAdmin.from("supaplan_events").insert({
    source: "codex",
    type,
    payload,
  });

  if (error) {
    throw error;
  }
}

export const supaplan = {
  pick_task: pickTask,
  update_status: updateStatus,
  log_event: logEvent,
};

export type { SupaPlanTaskStatus, PickTaskResult };
